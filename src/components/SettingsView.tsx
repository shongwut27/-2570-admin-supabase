import React, { useState } from 'react';
import { User } from 'firebase/auth';
import {
  SUPER_ADMIN_EMAILS,
  UserPermissionItem,
  PermissionRequestItem,
  UserRole,
  isSuperAdminEmail,
  saveUserPermission,
  removeUserPermission,
  approvePermissionRequest,
  removePermissionRequest,
} from '../lib/firebase';
import {
  Settings,
  Shield,
  Key,
  Users,
  Database,
  ExternalLink,
  Copy,
  Plus,
  Trash2,
  CheckCircle2,
  RefreshCw,
  Search,
  Lock,
  Eye,
  Edit3,
  Crown,
  FileSpreadsheet,
  AlertCircle,
  Mail,
  UserCheck,
  Bell,
  Check,
  X,
  Clock,
  Code,
} from 'lucide-react';
import { SUPABASE_PROJECT_ID, SUPABASE_URL, SUPABASE_SQL_SETUP } from '../lib/supabase';

interface SettingsViewProps {
  user: User | null;
  currentUserRole: UserRole;
  spreadsheetId: string;
  spreadsheetName: string;
  onUpdateSpreadsheetId: (newId: string) => void;
  permissionsList: UserPermissionItem[];
  permissionRequests?: PermissionRequestItem[];
  isLoadingPermissions: boolean;
  onRefreshPermissions: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  isDarkMode: boolean;
}

const REPLICA_SPREADSHEET_ID = '1i-7m571w-h491hO4b7i_X9t9i2vR68UeMbmx1YcWbYg';
const REPLICA_SHEET_NAME = 'DATAINPUT';

export function SettingsView({
  user,
  currentUserRole,
  spreadsheetId,
  spreadsheetName,
  onUpdateSpreadsheetId,
  permissionsList,
  permissionRequests = [],
  isLoadingPermissions,
  onRefreshPermissions,
  showToast,
  isDarkMode,
}: SettingsViewProps) {
  const [copied, setCopied] = useState(false);
  const [copiedReplica, setCopiedReplica] = useState(false);
  const [isEditingSheetId, setIsEditingSheetId] = useState(false);
  const [tempSheetId, setTempSheetId] = useState(spreadsheetId);

  // New permission form state
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'view' | 'edit'>('view');
  const [isSavingPermission, setIsSavingPermission] = useState(false);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);

  // Search filter for permissions list
  const [searchFilter, setSearchFilter] = useState('');

  const isAdmin = currentUserRole === 'admin' || (user?.email && isSuperAdminEmail(user.email));

  const handleCopyId = (text: string, isReplica = false) => {
    navigator.clipboard.writeText(text);
    if (isReplica) {
      setCopiedReplica(true);
      setTimeout(() => setCopiedReplica(false), 2000);
    } else {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
    showToast('คัดลอก Spreadsheet ID แล้ว', 'info');
  };

  const handleSaveSpreadsheetId = () => {
    if (!tempSheetId.trim()) {
      showToast('กรุณาระบุ Google Spreadsheet ID', 'error');
      return;
    }
    onUpdateSpreadsheetId(tempSheetId.trim());
    setIsEditingSheetId(false);
    showToast('อัปเดตการเชื่อมต่อ Google Sheets เรียบร้อย', 'success');
  };

  const handleAddOrUpdatePermission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      showToast('เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถกำหนดสิทธิ์ได้', 'error');
      return;
    }

    const cleanEmail = newEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      showToast('กรุณาระบุอีเมลที่ถูกต้อง', 'error');
      return;
    }

    setIsSavingPermission(true);
    try {
      await saveUserPermission(cleanEmail, newRole, user?.email || 'admin');
      showToast(`บันทึกสิทธิ์ (${newRole === 'edit' ? 'แก้ไข' : 'เข้าดู'}) ให้กับ ${cleanEmail} สำเร็จ!`, 'success');
      setNewEmail('');
      setNewRole('view');
      onRefreshPermissions();
    } catch (err: any) {
      console.error(err);
      showToast(`เกิดข้อผิดพลาดในการบันทึกสิทธิ์: ${err.message || 'ไม่สามารถติดต่อฐานข้อมูลได้'}`, 'error');
    } finally {
      setIsSavingPermission(false);
    }
  };

  const handleApprove = async (request: PermissionRequestItem, approvedRole: 'view' | 'edit') => {
    if (!isAdmin) return;
    setProcessingRequestId(request.id);
    try {
      await approvePermissionRequest(request.email, approvedRole, user?.email || 'admin');
      showToast(`อนุมัติสิทธิ์ (${approvedRole === 'edit' ? 'แก้ไข' : 'เข้าดู'}) ให้กับ ${request.email} สำเร็จ!`, 'success');
      onRefreshPermissions();
    } catch (err: any) {
      showToast(`เกิดข้อผิดพลาดในการอนุมัติ: ${err.message}`, 'error');
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleReject = async (request: PermissionRequestItem) => {
    if (!isAdmin) return;
    if (!window.confirm(`คุณต้องการปฏิเสธ/ลบคำขอของ ${request.email} ใช่หรือไม่?`)) return;
    setProcessingRequestId(request.id);
    try {
      await removePermissionRequest(request.email);
      showToast(`ปฏิเสธคำขอของ ${request.email} เรียบร้อยแล้ว`, 'info');
    } catch (err: any) {
      showToast(`เกิดข้อผิดพลาด: ${err.message}`, 'error');
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleQuickRoleChange = async (email: string, targetRole: 'view' | 'edit') => {
    if (!isAdmin) {
      showToast('เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถเปลี่ยนสิทธิ์ได้', 'error');
      return;
    }

    if (isSuperAdminEmail(email)) {
      showToast('ไม่สามารถเปลี่ยนสิทธิ์ของ Super Admin ได้', 'error');
      return;
    }

    try {
      await saveUserPermission(email, targetRole, user?.email || 'admin');
      showToast(`ปรับสิทธิ์ ${email} เป็น "${targetRole === 'edit' ? 'แก้ไข' : 'เข้าดู'}" เรียบร้อย`, 'success');
      onRefreshPermissions();
    } catch (err: any) {
      showToast('เกิดข้อผิดพลาดในการปรับสิทธิ์', 'error');
    }
  };

  const handleDeletePermission = async (email: string) => {
    if (!isAdmin) {
      showToast('เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถลบสิทธิ์ได้', 'error');
      return;
    }

    if (isSuperAdminEmail(email)) {
      showToast('ไม่สามารถลบสิทธิ์ของ Super Admin ได้', 'error');
      return;
    }

    if (!window.confirm(`คุณแน่ใจหรือไม่ที่จะยกเลิกสิทธิ์ของอีเมล:\n${email}`)) {
      return;
    }

    try {
      await removeUserPermission(email);
      showToast(`ยกเลิกสิทธิ์ของ ${email} เรียบร้อยแล้ว`, 'success');
      onRefreshPermissions();
    } catch (err: any) {
      showToast('เกิดข้อผิดพลาดในการลบสิทธิ์', 'error');
    }
  };

  // Combine Super Admins with Firestore permissions list
  const allUserPermissionsMap = new Map<string, { email: string; role: 'admin' | 'edit' | 'view'; isSuperAdmin: boolean; addedBy?: string; updatedAt?: string }>();

  // Add super admins first
  SUPER_ADMIN_EMAILS.forEach(adminEmail => {
    allUserPermissionsMap.set(adminEmail.toLowerCase(), {
      email: adminEmail,
      role: 'admin',
      isSuperAdmin: true,
      addedBy: 'ระบบหลัก (System Root)',
      updatedAt: 'ถาวร (Permanent)'
    });
  });

  // Add firestore permissions
  permissionsList.forEach(p => {
    const clean = p.email.toLowerCase();
    if (!allUserPermissionsMap.has(clean)) {
      allUserPermissionsMap.set(clean, {
        email: p.email,
        role: p.role,
        isSuperAdmin: isSuperAdminEmail(p.email),
        addedBy: p.addedBy || '-',
        updatedAt: p.updatedAt ? new Date(p.updatedAt).toLocaleString('th-TH') : '-'
      });
    }
  });

  const allDisplayUsers = Array.from(allUserPermissionsMap.values()).filter(item => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return item.email.toLowerCase().includes(q) || item.role.toLowerCase().includes(q);
  });

  const pendingRequests = permissionRequests.filter(r => r.status === 'pending');

  return (
    <div className="flex flex-col gap-6">
      {/* HEADER BANNER */}
      <div className={`p-6 rounded-2xl border shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-colors ${
        isDarkMode
          ? 'bg-gradient-to-br from-[#0c2821] to-[#081b16] border-emerald-500/40 text-slate-100'
          : 'bg-gradient-to-br from-emerald-50 to-teal-50/60 border-emerald-200 text-slate-800'
      }`}>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30 shrink-0">
            <Settings className="w-7 h-7 animate-spin" style={{ animationDuration: '10s' }} />
          </div>
          <div>
            <h2 className={`text-xl sm:text-2xl font-bold font-display tracking-tight flex items-center gap-2 ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}>
              <span>ตั้งค่าระบบ & สิทธิ์การเข้าใช้งาน</span>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-sans font-bold border ${
                isDarkMode ? 'bg-emerald-900/90 text-emerald-200 border-emerald-400/50' : 'bg-emerald-100 text-emerald-800 border-emerald-300'
              }`}>
                System Settings
              </span>
            </h2>
            <p className={`text-xs sm:text-sm mt-1 font-medium ${isDarkMode ? 'text-emerald-200' : 'text-slate-600'}`}>
              จัดการเชื่อมต่อฐานข้อมูล Google Sheets และกำหนดสิทธิ์การเข้าใช้งานระบบ (เข้าดู / แก้ไข)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className={`px-4 py-2 rounded-xl border text-xs sm:text-sm font-bold flex items-center gap-2 shadow-xs ${
            currentUserRole === 'admin'
              ? isDarkMode ? 'bg-amber-950/80 text-amber-200 border-amber-400/60' : 'bg-amber-50 text-amber-800 border-amber-300'
              : currentUserRole === 'edit'
              ? isDarkMode ? 'bg-emerald-950/80 text-emerald-200 border-emerald-400/60' : 'bg-emerald-50 text-emerald-800 border-emerald-300'
              : isDarkMode ? 'bg-sky-950/80 text-sky-200 border-sky-400/60' : 'bg-sky-50 text-sky-800 border-sky-300'
          }`}>
            {currentUserRole === 'admin' ? (
              <>
                <Crown className="w-4 h-4 text-amber-400" />
                <span>สิทธิ์ของคุณ: ผู้ดูแลระบบ (Admin)</span>
              </>
            ) : currentUserRole === 'edit' ? (
              <>
                <Edit3 className="w-4 h-4 text-emerald-400" />
                <span>สิทธิ์ของคุณ: แก้ไขข้อมูลได้ (Edit)</span>
              </>
            ) : (
              <>
                <Eye className="w-4 h-4 text-sky-400" />
                <span>สิทธิ์ของคุณ: เข้าดูอย่างเดียว (View Only)</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 1: GOOGLE SHEETS CONNECTION INFO */}
      <div className={`rounded-2xl border p-6 shadow-sm flex flex-col gap-5 transition-colors ${
        isDarkMode ? 'bg-[#0a221b] border-emerald-500/30 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 border-emerald-500/20">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isDarkMode ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-500/10 text-emerald-600'
            }`}>
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className={`text-base font-bold font-display ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                การเชื่อมต่อฐานข้อมูล Google Sheets
              </h3>
              <p className={`text-xs font-medium ${isDarkMode ? 'text-emerald-200' : 'text-slate-500'}`}>
                ระบบเชื่อมต่อข้อมูลหลักกับ Google Sheets เพื่ออ่าน-เขียนข้อมูลแบบเรียลไทม์
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
              isDarkMode ? 'bg-emerald-950 text-emerald-300 border-emerald-400/50' : 'bg-emerald-50 text-emerald-700 border-emerald-300'
            }`}>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              เชื่อมต่อแล้ว: พร้อมใช้งาน
            </span>
          </div>
        </div>

        {/* Supabase Database Integration Box */}
        <div className={`p-5 rounded-xl border flex flex-col gap-3 ${
          isDarkMode ? 'bg-[#071914] border-emerald-500/40 text-slate-100' : 'bg-emerald-50/60 border-emerald-200'
        }`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <div className="p-2.5 rounded-lg bg-emerald-600 text-white shadow-sm shrink-0">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <div className={`text-xs font-bold ${isDarkMode ? 'text-emerald-300' : 'text-emerald-800'}`}>
                  ฐานข้อมูลหลัก Supabase (PostgreSQL - ความเร็วสูง):
                </div>
                <div className={`text-base sm:text-lg font-bold font-mono tracking-tight flex items-center gap-2 ${
                  isDarkMode ? 'text-emerald-200' : 'text-emerald-900'
                }`}>
                  <span>Project ID: {SUPABASE_PROJECT_ID}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <a
                href={`https://supabase.com/dashboard/project/${SUPABASE_PROJECT_ID}/sql/new`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-sm cursor-pointer"
              >
                <Code className="w-3.5 h-3.5" />
                <span>เปิด Supabase SQL Editor</span>
              </a>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(SUPABASE_SQL_SETUP);
                  showToast('คัดลอกคำสั่ง SQL สร้างตารางแล้ว', 'success');
                }}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold border transition shadow-2xs cursor-pointer ${
                  isDarkMode ? 'bg-[#0f2e25] text-emerald-200 border-emerald-500/40 hover:bg-[#153e32]' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                <Copy className="w-3.5 h-3.5" />
                <span>คัดลอก SQL สร้างตาราง</span>
              </button>
            </div>
          </div>

          <div className={`pt-3 border-t text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-mono ${
            isDarkMode ? 'border-emerald-500/20 text-slate-300' : 'border-emerald-200 text-slate-600'
          }`}>
            <div className="flex items-center gap-2 truncate">
              <span className="font-bold shrink-0">Endpoint URL:</span>
              <span className={`truncate px-2 py-0.5 rounded border text-[11px] ${
                isDarkMode ? 'bg-[#0f2e25] border-emerald-500/40 text-emerald-200' : 'bg-white border-slate-200 text-slate-700'
              }`}>
                {SUPABASE_URL}
              </span>
            </div>
            <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-sans font-medium">
              ⚡ บันทึกและดึงข้อมูล &lt; 50ms ไม่ติด Quota
            </span>
          </div>
        </div>

        {/* Primary Connected Sheet Box (Auxiliary Backup) */}
        <div className={`p-5 rounded-xl border flex flex-col gap-3 ${
          isDarkMode ? 'bg-[#071914] border-emerald-500/40 text-slate-100' : 'bg-slate-50/90 border-slate-200'
        }`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <div className="p-2.5 rounded-lg bg-emerald-600 text-white shadow-sm shrink-0">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <div className={`text-xs font-bold ${isDarkMode ? 'text-emerald-300' : 'text-slate-500'}`}>
                  แผ่นงานหลักที่เชื่อมต่อ (Primary Database):
                </div>
                <div className={`text-base sm:text-lg font-bold font-mono tracking-tight flex items-center gap-2 ${
                  isDarkMode ? 'text-emerald-300' : 'text-emerald-800'
                }`}>
                  <span>{spreadsheetName || 'PROJECT-{2570}-งานธุรการ-ระบบติดตามเอกสาร'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <a
                href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-sm cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>เปิดแผ่นงาน Google Sheets</span>
              </a>
            </div>
          </div>

          <div className={`pt-3 border-t text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-mono ${
            isDarkMode ? 'border-emerald-500/20 text-slate-200' : 'border-slate-200 text-slate-600'
          }`}>
            <div className="flex items-center gap-2 truncate">
              <span className={`font-bold shrink-0 ${isDarkMode ? 'text-emerald-300' : 'text-slate-700'}`}>
                Spreadsheet ID:
              </span>
              <span className={`truncate select-all px-2.5 py-1 rounded font-mono font-bold text-xs border ${
                isDarkMode ? 'bg-[#0f2e25] text-emerald-200 border-emerald-500/40' : 'bg-white text-slate-800 border-slate-200'
              }`}>
                {spreadsheetId}
              </span>
              <button
                type="button"
                onClick={() => handleCopyId(spreadsheetId)}
                className={`p-1.5 rounded-lg border transition cursor-pointer shrink-0 ${
                  isDarkMode ? 'bg-[#0f2e25] hover:bg-[#153e32] text-emerald-300 border-emerald-500/40' : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
                }`}
                title="คัดลอก ID"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              {copied && <span className="text-emerald-400 font-sans text-xs font-bold animate-pulse">คัดลอกแล้ว!</span>}
            </div>

            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setTempSheetId(spreadsheetId);
                  setIsEditingSheetId(!isEditingSheetId);
                }}
                className={`text-xs font-sans font-bold underline hover:opacity-80 transition cursor-pointer self-start sm:self-auto ${
                  isDarkMode ? 'text-amber-300' : 'text-emerald-700'
                }`}
              >
                {isEditingSheetId ? '✕ ยกเลิกการแก้ไข' : '✏️ เปลี่ยน Spreadsheet ID'}
              </button>
            )}
          </div>

          {/* Edit Sheet ID Form */}
          {isEditingSheetId && isAdmin && (
            <div className={`mt-3 pt-3 border-t flex flex-col sm:flex-row items-center gap-2 ${
              isDarkMode ? 'border-emerald-500/30' : 'border-slate-200'
            }`}>
              <input
                type="text"
                value={tempSheetId}
                onChange={(e) => setTempSheetId(e.target.value)}
                placeholder="ระบุ Google Spreadsheet ID ใหม่..."
                className={`flex-1 w-full px-3.5 py-2 text-xs font-mono rounded-lg border focus:outline-hidden focus:ring-2 focus:ring-emerald-500 ${
                  isDarkMode ? 'bg-[#0f2e25] border-emerald-500/50 text-white placeholder-slate-400' : 'bg-white border-slate-300 text-slate-800'
                }`}
              />
              <button
                type="button"
                onClick={handleSaveSpreadsheetId}
                className="w-full sm:w-auto px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-sm cursor-pointer shrink-0"
              >
                บันทึกและเชื่อมต่อใหม่
              </button>
            </div>
          )}
        </div>

        {/* Replica Sheet Info */}
        <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
          isDarkMode ? 'bg-[#071914]/80 border-emerald-500/30 text-slate-200' : 'bg-slate-50/50 border-slate-200 text-slate-600'
        }`}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse shrink-0" />
            <span className={`font-bold font-display ${isDarkMode ? 'text-emerald-300' : 'text-slate-600'}`}>
              แผ่นงานสำรอง (Replica Mirror):
            </span>
            <span className={`font-mono font-semibold ${isDarkMode ? 'text-blue-300' : 'text-blue-600'}`}>
              {REPLICA_SPREADSHEET_ID}
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold border ${
              isDarkMode ? 'bg-blue-950/80 text-blue-300 border-blue-500/40' : 'bg-blue-50 text-blue-700 border-blue-200'
            }`}>
              แท็บ {REPLICA_SHEET_NAME}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleCopyId(REPLICA_SPREADSHEET_ID, true)}
              className={`flex items-center gap-1 text-xs font-bold transition cursor-pointer ${
                isDarkMode ? 'text-slate-300 hover:text-emerald-300' : 'text-slate-600 hover:text-emerald-700'
              }`}
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copiedReplica ? 'คัดลอกแล้ว!' : 'คัดลอก Replica ID'}</span>
            </button>
            <a
              href={`https://docs.google.com/spreadsheets/d/${REPLICA_SPREADSHEET_ID}`}
              target="_blank"
              rel="noreferrer"
              className={`text-xs font-bold hover:underline flex items-center gap-1 ${
                isDarkMode ? 'text-emerald-300' : 'text-emerald-600'
              }`}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>เปิดดู</span>
            </a>
          </div>
        </div>
      </div>

      {/* SECTION 2: PERMISSION MANAGEMENT */}
      <div className={`rounded-2xl border p-6 shadow-sm flex flex-col gap-6 transition-colors ${
        isDarkMode ? 'bg-[#0a221b] border-emerald-500/30 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 border-emerald-500/20">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isDarkMode ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-500/10 text-amber-600'
            }`}>
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className={`text-base font-bold font-display ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                การจัดการสิทธิ์การเข้าใช้งาน (Access Control & Permissions)
              </h3>
              <p className={`text-xs font-medium ${isDarkMode ? 'text-emerald-200' : 'text-slate-500'}`}>
                กำหนดอีเมลและเลือกระดับสิทธิ์: <span className={isDarkMode ? 'text-sky-300 font-bold' : 'text-sky-600 font-bold'}>เข้าดู (View)</span> หรือ <span className={isDarkMode ? 'text-emerald-300 font-bold' : 'text-emerald-600 font-bold'}>แก้ไข (Edit)</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefreshPermissions}
              disabled={isLoadingPermissions}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-bold transition cursor-pointer ${
                isDarkMode
                  ? 'bg-[#0f2e25] border-emerald-500/40 text-emerald-200 hover:bg-[#153e32]'
                  : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingPermissions ? 'animate-spin text-amber-400' : ''}`} />
              <span>รีเฟรชสิทธิ์</span>
            </button>
          </div>
        </div>

        {/* Super Admins Info Banner */}
        <div className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
          isDarkMode
            ? 'bg-amber-950/40 border-amber-500/40 text-amber-100'
            : 'bg-amber-50/80 border-amber-200 text-amber-900'
        }`}>
          <div className="flex items-start gap-3">
            <Crown className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className={`text-xs font-bold font-display ${isDarkMode ? 'text-amber-200' : 'text-amber-900'}`}>
                ผู้กำหนดสิทธิ์สูงสุด (Super Administrators):
              </div>
              <div className="flex items-center gap-2 flex-wrap mt-1.5">
                {SUPER_ADMIN_EMAILS.map((adminEmail, idx) => (
                  <span
                    key={idx}
                    className={`inline-flex items-center gap-1.5 text-xs font-mono font-bold px-3 py-1 rounded-lg border ${
                      isDarkMode
                        ? 'bg-amber-950/90 border-amber-400/60 text-amber-200'
                        : 'bg-white border-amber-300 text-amber-800'
                    }`}
                  >
                    <Mail className="w-3.5 h-3.5 text-amber-400" />
                    {adminEmail}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className={`text-xs font-sans font-medium shrink-0 ${isDarkMode ? 'text-amber-200/80' : 'text-amber-800/80'}`}>
            * ติดต่อ ทรงวุฒิ โทร 6465 เพื่อขอรับสิทธิ์ใช้งานระบบ
          </div>
        </div>

        {/* PENDING PERMISSION REQUESTS LIST (For Admins) */}
        {isAdmin && pendingRequests.length > 0 && (
          <div className={`p-5 rounded-2xl border flex flex-col gap-4 animate-in fade-in duration-300 ${
            isDarkMode ? 'bg-[#0f2e25] border-amber-500/50' : 'bg-amber-50/60 border-amber-300'
          }`}>
            <div className="flex items-center justify-between gap-2 border-b pb-3 border-amber-500/30">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                  <Bell className="w-4 h-4 animate-bounce" />
                </div>
                <div>
                  <h4 className={`text-sm font-bold font-display flex items-center gap-2 ${
                    isDarkMode ? 'text-white' : 'text-amber-900'
                  }`}>
                    <span>คำขอรับสิทธิ์เข้าใช้งานที่รอดำเนินการ</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-amber-950">
                      {pendingRequests.length} รายการ
                    </span>
                  </h4>
                  <p className={`text-xs ${isDarkMode ? 'text-amber-200/80' : 'text-amber-800'}`}>
                    มีผู้ใช้งานส่งคำขอรับสิทธิ์เข้าใช้งานระบบ คุณสามารถคลิกอนุมัติหรือปฏิเสธได้ทันที
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {pendingRequests.map((req) => (
                <div
                  key={req.id}
                  className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
                    isDarkMode ? 'bg-[#071914] border-emerald-500/40 text-slate-100' : 'bg-white border-amber-200 text-slate-900 shadow-xs'
                  }`}
                >
                  <div className="flex items-start sm:items-center gap-3">
                    {req.photoURL ? (
                      <img src={req.photoURL} alt={req.displayName} className="w-10 h-10 rounded-full border border-emerald-500/40 object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-sm shrink-0">
                        {req.displayName?.charAt(0) || 'U'}
                      </div>
                    )}
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-bold font-display ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                          {req.displayName || req.email}
                        </span>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                          req.requestedRole === 'edit'
                            ? isDarkMode ? 'bg-emerald-950 text-emerald-300 border-emerald-400/50' : 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : isDarkMode ? 'bg-sky-950 text-sky-300 border-sky-400/50' : 'bg-sky-50 text-sky-700 border-sky-300'
                        }`}>
                          ขอสิทธิ์: {req.requestedRole === 'edit' ? '✏️ แก้ไข (Edit)' : '👁️ เข้าดู (View Only)'}
                        </span>
                      </div>
                      <span className={`text-xs font-mono mt-0.5 ${isDarkMode ? 'text-emerald-300' : 'text-slate-600'}`}>
                        {req.email}
                      </span>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-1">
                        <Clock className="w-3 h-3" />
                        <span>ส่งเมื่อ: {new Date(req.requestedAt).toLocaleString('th-TH')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <button
                      type="button"
                      disabled={processingRequestId === req.id}
                      onClick={() => handleApprove(req, 'view')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition flex items-center gap-1 cursor-pointer disabled:opacity-50 ${
                        isDarkMode
                          ? 'bg-sky-950/80 hover:bg-sky-900 text-sky-200 border-sky-400/60'
                          : 'bg-sky-50 hover:bg-sky-100 text-sky-700 border-sky-300'
                      }`}
                      title="อนุมัติให้มีสิทธิ์เข้าดูเท่านั้น"
                    >
                      <Eye className="w-3.5 h-3.5 text-sky-400" />
                      <span>อนุมัติ: เข้าดู</span>
                    </button>

                    <button
                      type="button"
                      disabled={processingRequestId === req.id}
                      onClick={() => handleApprove(req, 'edit')}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-sm transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      title="อนุมัติให้มีสิทธิ์แก้ไขและบันทึกข้อมูล"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>อนุมัติ: แก้ไข</span>
                    </button>

                    <button
                      type="button"
                      disabled={processingRequestId === req.id}
                      onClick={() => handleReject(req)}
                      className={`p-1.5 rounded-lg text-rose-400 hover:text-rose-200 border transition cursor-pointer disabled:opacity-50 ${
                        isDarkMode ? 'bg-rose-950/60 border-rose-500/40 hover:bg-rose-900' : 'bg-rose-50 border-rose-200 hover:bg-rose-100'
                      }`}
                      title="ปฏิเสธคำขอ"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ADD USER PERMISSION FORM (Only available for Admins) */}
        {isAdmin ? (
          <form
            onSubmit={handleAddOrUpdatePermission}
            className={`p-5 rounded-xl border flex flex-col gap-4 ${
              isDarkMode ? 'bg-[#071914] border-emerald-500/40' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-400" />
              <span className={`text-xs sm:text-sm font-bold font-display ${
                isDarkMode ? 'text-emerald-200' : 'text-slate-800'
              }`}>
                เพิ่มหรือกำหนดสิทธิ์ให้อีเมลใหม่โดยตรง:
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              {/* Email Input */}
              <div className="sm:col-span-6 flex flex-col gap-1.5">
                <label className={`text-xs font-bold ${isDarkMode ? 'text-emerald-200' : 'text-slate-700'}`}>
                  อีเมลผู้ใช้งาน (Google Account / MFU Email):
                </label>
                <div className="relative">
                  <Mail className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-emerald-400' : 'text-slate-400'}`} />
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="เช่น user.nam@mfu.ac.th"
                    className={`w-full pl-9 pr-3 py-2 text-xs font-mono rounded-xl border focus:outline-hidden focus:ring-2 focus:ring-emerald-500 ${
                      isDarkMode ? 'bg-[#0f2e25] border-emerald-500/50 text-white placeholder-slate-400 font-bold' : 'bg-white border-slate-300 text-slate-800'
                    }`}
                  />
                </div>
              </div>

              {/* Role Select */}
              <div className="sm:col-span-4 flex flex-col gap-1.5">
                <label className={`text-xs font-bold ${isDarkMode ? 'text-emerald-200' : 'text-slate-700'}`}>
                  ระดับสิทธิ์การเข้าถึง (Permission Level):
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as 'view' | 'edit')}
                  className={`w-full px-3 py-2 text-xs font-bold rounded-xl border focus:outline-hidden focus:ring-2 focus:ring-emerald-500 cursor-pointer ${
                    isDarkMode ? 'bg-[#0f2e25] border-emerald-500/50 text-white' : 'bg-white border-slate-300 text-slate-800'
                  }`}
                >
                  <option value="view" className={isDarkMode ? 'bg-[#071914] text-white' : ''}>👁️ สิทธิ์เข้าดู (View Only)</option>
                  <option value="edit" className={isDarkMode ? 'bg-[#071914] text-white' : ''}>✏️ สิทธิ์แก้ไข (Edit / Full Access)</option>
                </select>
              </div>

              {/* Submit Button */}
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={isSavingPermission}
                  className="w-full py-2 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold shadow-md shadow-emerald-700/20 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSavingPermission ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  <span>บันทึกสิทธิ์</span>
                </button>
              </div>
            </div>

            {/* Permission description note */}
            <div className={`grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-2 border-t ${
              isDarkMode ? 'border-emerald-500/20 text-emerald-200' : 'border-slate-200 text-slate-600'
            }`}>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-400 shrink-0" />
                <span><strong className={isDarkMode ? 'text-sky-300' : 'text-slate-800'}>เข้าดู (View Only):</strong> ดูสถิติ, ค้นหา, ดูรายงาน EP, พิมพ์ใบนำส่งได้ (บันทึก/แก้ไขไม่ได้)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0" />
                <span><strong className={isDarkMode ? 'text-emerald-300' : 'text-slate-800'}>แก้ไข (Edit):</strong> สแกนรับเอกสาร, บันทึกส่งต่อ, ปรับปรุงสถานะ, แก้ไขข้อมูลในตาราง 2570-ระบบติดตามเอกสาร ได้ทั้งหมด</span>
              </div>
            </div>
          </form>
        ) : (
          <div className={`p-4 rounded-xl border flex items-center gap-2 text-xs font-medium ${
            isDarkMode ? 'bg-sky-950/30 border-sky-500/30 text-sky-200' : 'bg-sky-50 border-sky-200 text-sky-800'
          }`}>
            <Lock className="w-4 h-4 shrink-0 text-sky-400" />
            <span>คุณเข้าใช้งานในสถานะผู้ใช้งานทั่วไป (ติดต่อ ทรงวุฒิ โทร 6465 หรือ shongwut.tab@mfu.ac.th, info.finance@mfu.ac.th เพื่อขอสิทธิ์)</span>
          </div>
        )}

        {/* USERS LIST TABLE */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-400" />
              <h4 className={`text-xs sm:text-sm font-bold font-display ${
                isDarkMode ? 'text-white' : 'text-slate-800'
              }`}>
                รายชื่อผู้มีสิทธิ์ใช้งานทั้งหมด ({allDisplayUsers.length} รายการ):
              </h4>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-emerald-400' : 'text-slate-400'}`} />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="ค้นหาอีเมลหรือสิทธิ์..."
                className={`w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border focus:outline-hidden focus:ring-2 focus:ring-emerald-500 ${
                  isDarkMode ? 'bg-[#0f2e25] border-emerald-500/40 text-white placeholder-slate-400' : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              />
            </div>
          </div>

          <div className={`overflow-x-auto rounded-xl border ${
            isDarkMode ? 'border-emerald-500/30 bg-[#071914]' : 'border-slate-200 bg-white'
          }`}>
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className={`border-b font-display text-xs font-bold uppercase tracking-wider ${
                  isDarkMode ? 'bg-[#0f2e25] border-emerald-500/30 text-emerald-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                }`}>
                  <th className="p-3.5 w-12 text-center">ลำดับ</th>
                  <th className="p-3.5">อีเมลผู้ใช้งาน (Google Account)</th>
                  <th className="p-3.5 w-44 text-center">สิทธิ์การใช้งาน</th>
                  <th className="p-3.5 hidden md:table-cell">กำหนดโดย</th>
                  <th className="p-3.5 hidden sm:table-cell">อัปเดตล่าสุด</th>
                  {isAdmin && <th className="p-3.5 w-36 text-center">การจัดการ</th>}
                </tr>
              </thead>
              <tbody className={`divide-y ${isDarkMode ? 'divide-emerald-500/20' : 'divide-slate-200'}`}>
                {allDisplayUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className={`p-8 text-center text-xs font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      ไม่พบรายชื่อผู้ใช้งานที่ตรงกับการค้นหา
                    </td>
                  </tr>
                ) : (
                  allDisplayUsers.map((u, idx) => {
                    const isSelf = user?.email?.toLowerCase() === u.email.toLowerCase();
                    return (
                      <tr
                        key={u.email}
                        className={`transition-colors ${
                          isSelf
                            ? isDarkMode ? 'bg-emerald-950/60' : 'bg-emerald-50/80'
                            : isDarkMode ? 'hover:bg-[#0f2e25]/60' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className={`p-3.5 text-center font-mono font-bold ${isDarkMode ? 'text-emerald-300' : 'text-slate-500'}`}>
                          {idx + 1}
                        </td>
                        <td className="p-3.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`font-mono font-bold text-xs sm:text-sm ${
                              isDarkMode ? 'text-white' : 'text-slate-900'
                            }`}>
                              {u.email}
                            </span>
                            {isSelf && (
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                isDarkMode ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40' : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              }`}>
                                คุณ (You)
                              </span>
                            )}
                            {u.isSuperAdmin && (
                              <Crown className="w-4 h-4 text-amber-400 shrink-0" title="Super Admin" />
                            )}
                          </div>
                        </td>
                        <td className="p-3.5 text-center">
                          {u.role === 'admin' ? (
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                              isDarkMode ? 'bg-amber-950/80 text-amber-200 border-amber-400/50' : 'bg-amber-50 text-amber-800 border-amber-300'
                            }`}>
                              <Crown className="w-3.5 h-3.5 text-amber-400" />
                              ผู้กำหนดสิทธิ์ (Admin)
                            </span>
                          ) : u.role === 'edit' ? (
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                              isDarkMode ? 'bg-emerald-950/80 text-emerald-200 border-emerald-400/50' : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            }`}>
                              <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
                              แก้ไข (Edit)
                            </span>
                          ) : (
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                              isDarkMode ? 'bg-sky-950/80 text-sky-200 border-sky-400/50' : 'bg-sky-50 text-sky-800 border-sky-300'
                            }`}>
                              <Eye className="w-3.5 h-3.5 text-sky-400" />
                              เข้าดู (View Only)
                            </span>
                          )}
                        </td>
                        <td className={`p-3.5 hidden md:table-cell text-xs font-mono truncate max-w-[160px] ${
                          isDarkMode ? 'text-slate-300' : 'text-slate-600'
                        }`}>
                          {u.addedBy || '-'}
                        </td>
                        <td className={`p-3.5 hidden sm:table-cell text-xs font-mono ${
                          isDarkMode ? 'text-slate-300' : 'text-slate-600'
                        }`}>
                          {u.updatedAt || '-'}
                        </td>
                        {isAdmin && (
                          <td className="p-3.5 text-center">
                            {u.isSuperAdmin ? (
                              <span className={`text-xs font-bold italic ${isDarkMode ? 'text-amber-300' : 'text-amber-700'}`}>
                                ผู้ดูแลหลัก
                              </span>
                            ) : (
                              <div className="flex items-center justify-center gap-2">
                                {/* Toggle Role */}
                                <button
                                  type="button"
                                  onClick={() => handleQuickRoleChange(u.email, u.role === 'edit' ? 'view' : 'edit')}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
                                    u.role === 'edit'
                                      ? isDarkMode
                                        ? 'bg-sky-950 text-sky-300 border-sky-400/50 hover:bg-sky-900'
                                        : 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100'
                                      : isDarkMode
                                        ? 'bg-emerald-950 text-emerald-300 border-emerald-400/50 hover:bg-emerald-900'
                                        : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                  }`}
                                  title={`เปลี่ยนเป็นสิทธิ์ ${u.role === 'edit' ? 'เข้าดู' : 'แก้ไข'}`}
                                >
                                  {u.role === 'edit' ? 'ปรับเป็นเข้าดู' : 'ปรับเป็นแก้ไข'}
                                </button>

                                {/* Delete Permission */}
                                <button
                                  type="button"
                                  onClick={() => handleDeletePermission(u.email)}
                                  className={`p-1.5 rounded-lg border transition cursor-pointer ${
                                    isDarkMode
                                      ? 'text-rose-300 hover:text-rose-100 bg-rose-950/60 border-rose-500/40 hover:bg-rose-900'
                                      : 'text-rose-600 hover:text-rose-800 bg-rose-50 border-rose-200 hover:bg-rose-100'
                                  }`}
                                  title="ลบสิทธิ์"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
