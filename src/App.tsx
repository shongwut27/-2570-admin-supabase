import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User } from 'firebase/auth';
import {
  initAuth,
  googleSignIn,
  logout,
  SUPER_ADMIN_EMAILS,
  UserPermissionItem,
  PermissionRequestItem,
  UserRole,
  isSuperAdminEmail,
  subscribeUserPermissions,
  fetchUserPermissions,
  subscribePermissionRequests,
  submitPermissionRequest,
} from './lib/firebase';
import { SettingsView } from './components/SettingsView';
// Google Sheets import removed permanently. Using Supabase exclusively.
import {
  SUPABASE_PROJECT_ID,
  SUPABASE_URL,
  SUPABASE_DOCUMENTS_TABLE,
  supabase,
  testSupabaseConnection,
  fetchAllDocumentsFromSupabase,
  insertDocumentsToSupabase,
  insertSingleDocumentToSupabase,
  updateDocumentInSupabase,
  updateDocumentByIdInSupabase,
  deleteDocumentFromSupabase,
  clearAllDocumentsFromSupabase,
  lookupBarcodeInSupabase,
  lookupBarcodeForReturnInSupabase,
  lookupBarcodeInChecklists,
  lookupOldWorkForTab2,
  remapProviderToCurrentStandard,
  checkBarcodeExistsInTracking,
  getDeskPhone,
  parseDateToTimestamp,
} from './lib/supabase';
import { SupabaseSqlModal } from './components/SupabaseSqlModal';
import { DocumentEditorModal } from './components/DocumentEditorModal';
import { DocumentRecord, SheetConfig, ScanItem, PROVIDER_DESKS, ALL_PRINTING_PROVIDERS } from './types';
import {
  Barcode,
  Search,
  Plus,
  Trash2,
  Pencil,
  Check,
  Loader2,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Database,
  Info,
  Layers,
  Sparkles,
  RefreshCw,
  FileText,
  FileCheck,
  LogOut,
  LogIn,
  Sliders,
  Calendar,
  Building,
  Tag,
  HelpCircle,
  ChevronDown,
  BarChart3,
  Printer,
  PieChart,
  Award,
  Zap,
  Users,
  TrendingUp,
  Filter,
  ChevronLeft,
  ChevronRight,
  X,
  ZoomIn,
  ZoomOut,
  Eye,
  Sun,
  Moon,
  Settings,
  Shield,
  Lock,
  Phone,
  Send,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const RETURN_STATUS_OPTIONS = [
  'ติดต่อรับคืน',
  'ส่งต่อเคาท์เตอร์จ่าย',
  'เสนออนุมัติผ่านระบบเดินเอกสาร ส.สารบรรณ',
  'ส่งต่อจ่ายทั่วไป',
  'พักเอกสารไว้ที่ผู้ตรวจ',
  'พักเอกสารไว้ที่ธุรการ',
  'ส่งคืน สนว.ชะลอวัยฯ',
  'ส่งคืน รพ.มฟล.กทม.',
  'ส่งคืน น.ประสานงาน กทม.',
  'ส่งต่อ-จิรวรรณ',
  'ส่งต่อ-จารุวรรณ',
  'ผ่านกจน./เสนออนุมัติ',
  'ส่งต่อ ส.พัสดุผ่าน ผอ./เสนออนุมัติ',
  'เปลี่ยนโต๊ะบริการนำเสนอ อธิการบดี',
  'รับคืนจากสอบทาน/รับเข้าระบบใหม่',
  'รับคืนจากงานตรวจ/ส่งเคาท์เตอร์',
  'รับคืน/ส่งต่องานตรวจจ่าย',
];

const getIsoDateTimeString = (d: Date = new Date()): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

const isReturningStatus = (status: string): boolean => {
  const s = status.trim();
  if (RETURN_STATUS_OPTIONS.includes(s)) return true;
  if (s.includes('ส่งคืน') || s === 'ติดต่อรับคืน' || s.includes('ส่งต่อ') || s.includes('พักเอกสาร') || s.includes('รับคืน')) {
    return true;
  }
  return false;
};

const OVERRIDE_DESK_OPTIONS = [
  '(1)ภาคินี',
  '(5)ละอองดาว',
  '(2)พรนัชชา',
  '(4)สาโรจน์',
  '(3)ดารารัตน์',
  '(6)ธนัฏพร',
  '(7)อภิญญา',
  '(8)ทรงวุฒิ',
  '(9)ดุษฎา',
  '(10)ทิพาธร',
  '(C2)กาญจนา',
  '(C3)ณัฐนันท์',
  '(C1)สิริลักษ์',
  '(C4)พรพิไล',
  '(C5)ทิพาธร',
  'งานเบิกจ่ายเงิน',
  '(F8)ประกายมาศ',
  'ผ่องพรรณ',
  '(S2)จิรวรรณ',
  '(S1)จารุวรรณ',
  '(F7)กฤษณา'
];

const normalizeProviderDesk = (desk: string): string => {
  if (!desk) return '';
  const d = desk.trim();
  if (d.includes('ภาคินี')) return '(1)ภาคินี';
  if (d.includes('พรนัชชา')) return '(2)พรนัชชา';
  if (d.includes('ดารารัตน์')) return '(3)ดารารัตน์';
  if (d.includes('สาโรจน์')) return '(4)สาโรจน์';
  if (d.includes('ละอองดาว')) return '(5)ละอองดาว';
  if (d.includes('ธนัฏพร')) return '(6)ธนัฏพร';
  if (d.includes('อภิญญา')) return '(7)อภิญญา';
  if (d.includes('ทรงวุฒิ')) return '(8)ทรงวุฒิ';
  if (d.includes('ดุษฎา')) return '(9)ดุษฎา';
  return d;
};

const cleanNameForCompare = (name: string): string => {
  if (!name) return '';
  // Remove parenthesis and spaces, e.g. "(1) อภิญญา" -> "อภิญญา", "(2)พรนัชชา" -> "พรนัชชา"
  return name.replace(/^\([^)]+\)\s*/, '').trim();
};

const findProviderIndex = (name: string): number => {
  if (!name) return -1;
  const target = cleanNameForCompare(name);
  return PROVIDER_DESKS.findIndex(p => cleanNameForCompare(p) === target);
};

const matchOption = (opt: string, query: string): boolean => {
  if (!query) return true;
  const q = query.trim().toLowerCase().replace(/\s+/g, '');
  const o = opt.toLowerCase().replace(/\s+/g, '');
  return o.includes(q);
};

const isValidUuid = (val?: string | null): boolean => {
  if (!val) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim());
};

const AGENCY_OPTIONS = [
  'สำนักวิชาศิลปศาสตร์',
  'สำนักวิชาวิทยาศาสตร์',
  'สำนักวิชาการจัดการ',
  'สำนักวิชาเทคโนโลยีดิจิทัลประยุกต์',
  'สำนักวิชาอุตสาหกรรมเกษตร',
  'สำนักวิชานิติศาสตร์',
  'สำนักวิชาวิทยาศาสตร์เครื่องสำอาง',
  'สำนักวิชาวิทยาศาสตร์สุขภาพ',
  'สำนักวิชาพยาบาลศาสตร์',
  'สำนักวิชาเวชศาสตร์ชะลอวัยและฟื้นฟูสุขภาพ',
  'สำนักวิชาแพทยศาสตร์',
  'สำนักวิชาทันตแพทยศาสตร์',
  'สำนักวิชานวัตกรรมสังคม',
  'สำนักวิชาจีนวิทยา',
  'สำนักวิชาการแพทย์บูรณาการ',
  'คลินิกทันตกรรม',
  'ศูนย์เครื่องมือวิทยาศาสตร์และเทคโนโลยี',
  'ศูนย์บรรณสารและสื่อการศึกษา (ห้องสมุด)',
  'ศูนย์เทคโนโลยีดิจิทัลและสารสนเทศ',
  'ศูนย์บริการวิชาการ',
  'สถาบันอนุรักษ์ พัฒนาทรัพยากรธรรมชาติและสิ่งแวดล้อม เพื่อความยั่งยืน',
  'โรงพยาบาลศูนย์การแพทย์มหาวิทยาลัยแม่ฟ้าหลวง',
  'สถาบันนวัตกรรมการเรียนรู้มหาวิทยาลัยแม่ฟ้าหลวง',
  'โรงพยาบาลมหาวิทยาลัยแม่ฟ้าหลวง กรุงเทพมหานคร',
  'ศูนย์กีฬามหาวิทยาลัยแม่ฟ้าหลวง',
  'วนาศรม',
  'สำนักงานให้คำปรึกษาและช่วยเหลือนักศึกษา',
  'ศูนย์นวัตกรรมสมุนไพรครบวงจร มหาวิทยาลัยแม่ฟ้าหลวง',
  'สถาบันศิลปวัฒนธรรมและอารยธรรมลุ่มน้ำโขง',
  'ศูนย์ความเป็นเลิศทางด้านการวิจัยเชื้อรา',
  'สถาบันชาและกาแฟ แห่งมหาวิทยาลัยแม่ฟ้าหลวง',
  'ศูนย์ความเป็นเลิศด้านนวัตกรรมผลิตภัณฑ์ธรรมชาติ',
  'ศูนย์นวัตกรรมสังคมและสิ่งแวดล้อมเพื่อการพัฒนาอย่างยั่งยืนแห่งอนุภูมิภาคลุ่มแม่น้ำโขง',
  'ศูนย์วิจัยและนวัตกรรมสังคมเชิงพื้นที่ เพื่อการพัฒนาอย่างยั่งยืน',
  'สำนักงานวิชาการส่วนทะเบียนและประมวลผล',
  'ฝ่ายรับนักศึกษา',
  'ส่วนพัฒนานักศึกษา',
  'ส่วนพัฒนาความสัมพันธ์ระหว่างประเทศ',
  'หน่วยงานส่งเสริมการบริการนักศึกษาเบ็ดเสร็จ (M for U Centre)',
  'หน่วยความร่วมมือทางวิชาการฝรั่งเศส-อนุภูมิภาคลุ่มแม่น้ำโขง',
  'ส่วนประกันคุณภาพการศึกษาและพัฒนาหลักสูตร',
  'สำนักงานบัณฑิตศึกษา',
  'ส่วนจัดหางานและฝึกงานของนักศึกษา',
  'สำนักงานวิจัยส่วนบริหารงานวิจัย',
  'ส่วนจัดการทรัพย์สินทางปัญญาและนวัตกรรม',
  'สำนักงานบริหารกลาง',
  'ส่วนสารบรรณและอำนวยการ',
  'หน่วยประสานงานมหาวิทยาลัยแม่ฟ้าหลวง กรุงเทพฯ',
  'ส่วนทรัพยากรบุคคล',
  'ส่วนนโยบายและแผน',
  'ส่วนการเงินและบัญชี',
  'ส่วนพัสดุ',
  'ส่วนประชาสัมพันธ์',
  'ส่วนอาคารสถานที่',
  'ส่วนนิติการ',
  'สำนักงานสภามหาวิทยาลัย',
  'หน่วยตรวจสอบภายใน',
  'สำนักงานจัดการทรัพย์สินและรายได้',
  'ศูนย์หนังสือ',
  'ผลิตภัณฑ์จากผลงานการวิจัยมหาวิทยาลัยแม่ฟ้าหลวง',
  'ศูนย์บริการที่พัก',
  'ศูนย์บริการอาหาร',
  'ศูนย์บริการสุขภาพแบบครบวงจรแห่งภาคเหนือ และอนุภูมิภาคลุ่มแม่น้ำโขง',
  'ศูนย์ภาษาและวัฒนธรรมจีนสิรินธร'
];

const DOC_TYPE_OPTIONS = [
  'ยืมเงินทดรองจ่าย',
  'คืนเงินยืมทดรอง',
  'เบิกสำรองจ่าย',
  'เบิกจ่ายทั่วไป',
  'เบิกจ่ายตรวจรับพัสดุ',
  'เบิกจ่ายค่าแรง',
  'สวัสดิการ',
  'ค่าอาหารทำการนอกเวลา',
  'ค่าแรงรายวัน',
  'ทุนการศึกษา',
  'โอนเงิน-เข้าบ/ชเงินเดือน',
  'งานเงินลงทุน',
];

export const getTabTypeName = (tabId?: number): string => {
  switch (tabId) {
    case 1:
      return '1. ตรวจจ่าย-งานใหม่';
    case 2:
      return '2. ตรวจจ่าย-งานเก่า';
    case 3:
      return '3. งานด้านอื่น';
    case 4:
      return '4. งานเบิกจ่าย';
    case 5:
      return '5. ไม่มีในฐานข้อมูล';
    case 6:
      return '6. การส่งคืนเอกสาร';
    case 7:
      return '7. แสดงรายงาน & แก้ไข';
    case 8:
      return '8. พิมพ์ใบนำส่งเอกสาร';
    case 9:
      return '9. รายงานสรุป-EP';
    case 10:
      return '10. ตั้งค่าระบบ & สิทธิ์';
    default:
      return tabId ? `แท็บที่ ${tabId}` : '1. ตรวจจ่าย-งานใหม่';
  }
};

export default function App() {
  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  // Theme state (Dark Emerald Mode / Light Mode)
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('mfu_theme_mode');
    return saved === 'dark';
  });

  const toggleTheme = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      localStorage.setItem('mfu_theme_mode', next ? 'dark' : 'light');
      return next;
    });
  };

  // Google Sheets state
  const [spreadsheetId, setSpreadsheetId] = useState('supabasedb');
  const [spreadsheetName, setSpreadsheetName] = useState('กำลังโหลด...');
  const [spreadsheetError, setSpreadsheetError] = useState<string | null>(null);
  const [isVerifyingSheet, setIsVerifyingSheet] = useState(false);

  // Sheet structural configurations loaded from "เงื่อนไข" tab
  const [dropdownConfig, setDropdownConfig] = useState<SheetConfig>({
    agencies: [],
    docTypes: [],
    returnStatuses: [],
    desks: [],
  });

  // Active workspace tab
  // 1: งานใหม่, 2: งานเก่า, 3: งานด้านอื่น, 4: งานเบิกจ่าย, 5: ไม่มีในฐานข้อมูล
  const [activeTab, setActiveTab] = useState<number>(1);

  // Guard against rapid double-clicks or double submits
  const lastSubmitTimeRef = useRef<number>(0);

  // Sequential delete queue to prevent concurrent API race conditions on row indices
  const deleteQueueRef = useRef<Promise<any>>(Promise.resolve());

  // User Permissions state (Super Admins: shongwut.tab@mfu.ac.th & info.finance@mfu.ac.th)
  const [permissionsList, setPermissionsList] = useState<UserPermissionItem[]>([]);
  const [isLoadingPermissions, setIsLoadingPermissions] = useState<boolean>(true);
  const [permissionRequests, setPermissionRequests] = useState<PermissionRequestItem[]>([]);
  const [requestedRoleChoice, setRequestedRoleChoice] = useState<'view' | 'edit'>('edit');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState<boolean>(false);

  useEffect(() => {
    if (!user) {
      setPermissionsList([]);
      setIsLoadingPermissions(false);
      return;
    }
    const unsub = subscribeUserPermissions((perms) => {
      setPermissionsList(perms);
      setIsLoadingPermissions(false);
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribePermissionRequests((reqs) => {
      setPermissionRequests(reqs);
    });
    return () => unsub();
  }, [user]);

  const myPermissionRequest = user?.email
    ? permissionRequests.find(r => r.email.toLowerCase() === user.email?.toLowerCase()) || null
    : null;

  const refreshPermissions = async () => {
    setIsLoadingPermissions(true);
    const perms = await fetchUserPermissions();
    setPermissionsList(perms);
    setIsLoadingPermissions(false);
  };

  const handleSendAccessRequest = async () => {
    if (!user || !user.email) return;
    setIsSubmittingRequest(true);
    try {
      await submitPermissionRequest(
        user.email,
        user.displayName || '',
        user.photoURL || undefined,
        requestedRoleChoice
      );
      showToast('success', 'ส่งคำขอรับสิทธิ์เข้าใช้งานเรียบร้อยแล้ว กรุณารอผู้ดูแลระบบอนุมัติ');
    } catch (err: any) {
      showToast('error', `เกิดข้อผิดพลาดในการส่งคำขอ: ${err.message || 'ไม่สามารถบันทึกได้'}`);
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const currentUserRole: UserRole = (() => {
    if (!user || !user.email) return 'none';
    const email = user.email.toLowerCase().trim();
    if (isSuperAdminEmail(email)) return 'admin';
    const match = permissionsList.find(p => p.email.toLowerCase().trim() === email);
    if (match) return match.role;
    // Default fallback to 'none' if user is not in the allowed list
    return 'none';
  })();

  // Barcode scanning state (Input values)
  const [barcodes, setBarcodes] = useState<string[]>(['', '', '', '', '']);
  const [scannedItems, setScannedItems] = useState<ScanItem[]>([]);

  // Filter items specifically for the active tab ("หน้าใครหน้ามัน"), showing saved & optimistic items, sorted newest first
  const displayedScannedItems = useMemo(() => {
    const list = scannedItems.filter(item => {
      const curType = item.data.type || item.data.TYPE || '';
      const noType = item.data.noType || '';
      const tabId = item.tabId;

      switch (activeTab) {
        case 1:
          // หน้า 1. ตรวจจ่าย-งานใหม่: แสดงเฉพาะรายการของหน้า 1 (TYPE = '1. ตรวจจ่าย-งานใหม่', N/O = 'N')
          if (curType === '1. ตรวจจ่าย-งานใหม่') return (noType || 'N') === 'N';
          if (!curType && tabId === 1) return (noType || 'N') === 'N';
          return false;
        case 2:
          // หน้า 2. ตรวจจ่าย-งานเก่า: แสดงเฉพาะรายการของหน้า 2 (TYPE = '2. ตรวจจ่าย-งานเก่า', N/O = 'O')
          if (curType === '2. ตรวจจ่าย-งานเก่า') return (noType || 'O') === 'O';
          if (!curType && tabId === 2) return (noType || 'O') === 'O';
          if (noType === 'O' && !curType) return true;
          return false;
        case 3:
          // หน้า 3. งานด้านอื่น: แสดงเฉพาะรายการของหน้า 3 (TYPE = '3. งานด้านอื่น')
          return curType === '3. งานด้านอื่น' || (!curType && tabId === 3);
        case 4:
          // หน้า 4. งานเบิกจ่าย: แสดงเฉพาะรายการของหน้า 4 (TYPE = '4. งานเบิกจ่าย')
          return curType === '4. งานเบิกจ่าย' || (!curType && (tabId === 4 || item.data.autoDesk === 'งานเบิกจ่ายเงิน' || item.data.finalDesk === 'งานเบิกจ่ายเงิน'));
        case 5:
          // หน้า 5. ไม่มีในฐานข้อมูล: แสดงเฉพาะรายการของหน้า 5 (TYPE = '5. ไม่มีในฐานข้อมูล')
          return curType === '5. ไม่มีในฐานข้อมูล' || (!curType && tabId === 5);
        case 6:
          // หน้า 6. การส่งคืนเอกสาร: แสดงเฉพาะรายการของหน้า 6 (TYPE = '6. การส่งคืนเอกสาร')
          return curType === '6. การส่งคืนเอกสาร' || (!curType && (tabId === 6 || Boolean(item.data.returnStatus && item.data.returnStatus !== '-' && item.data.returnStatus !== 'ไม่เลือก')));
        default:
          return false;
      }
    });

    // เฉพาะหน้า "1. ตรวจจ่าย-งานใหม่" และ "2. ตรวจจ่าย-งานเก่า": เรียงลำดับรายการล่าสุดขึ้นก่อนเสมอ (Newest First)
    if (activeTab === 1 || activeTab === 2) {
      return [...list].sort((a, b) => {
        const timeA = a.createdAt || parseDateToTimestamp(a.data.receiveDate) || 0;
        const timeB = b.createdAt || parseDateToTimestamp(b.data.receiveDate) || 0;
        if (timeA !== timeB) return timeB - timeA;
        return 0; // รักษาลำดับที่ดึงมาจาก Supabase / React State ที่แทรกรายการล่าสุดไว้บนสุดแล้ว
      });
    }

    // Sort newest/latest first by createdAt timestamp or dataInputRowIndex so new items show at top in 0.1s
    return [...list].sort((a, b) => {
      const timeA = a.createdAt || 0;
      const timeB = b.createdAt || 0;
      if (timeA !== timeB) return timeB - timeA;
      const rowA = a.dataInputRowIndex || 0;
      const rowB = b.dataInputRowIndex || 0;
      if (rowA !== rowB) return rowB - rowA;
      return 0;
    });
  }, [scannedItems, activeTab]);

  // States for general Alert / Validation Modal Popup
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type?: 'warning' | 'error' | 'info';
  } | null>(null);

  // States for Staged Items Table (Tabs 1-6): Filter, Selection, Bulk Delete
  const [stagedFilterQuery, setStagedFilterQuery] = useState<string>('');
  const [selectedStagedIds, setSelectedStagedIds] = useState<string[]>([]);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState<boolean>(false);

  // Filtered displayed items based on search query for staged items table (Tabs 1-6)
  const filteredDisplayedItems = useMemo(() => {
    if (!stagedFilterQuery.trim()) return displayedScannedItems;
    const q = stagedFilterQuery.trim().toLowerCase();
    return displayedScannedItems.filter(item => {
      const b = (item.barcode || item.data?.barcode || '').toLowerCase();
      const ag = (item.data?.agency || '').toLowerCase();
      const dt = (item.data?.docType || '').toLowerCase();
      const num = (item.data?.docNumber || '').toLowerCase();
      const mh = (item.data?.mhesiNumber || '').toLowerCase();
      return b.includes(q) || ag.includes(q) || dt.includes(q) || num.includes(q) || mh.includes(q);
    });
  }, [displayedScannedItems, stagedFilterQuery]);

  // Reset staged table selection & filter when activeTab changes
  useEffect(() => {
    setSelectedStagedIds([]);
    setStagedFilterQuery('');
  }, [activeTab]);

  const [isSearching, setIsSearching] = useState(false);

  // Dedicated Document Editor Modal State (8-field spec)
  const [modalEditItem, setModalEditItem] = useState<{ record: DocumentRecord; id?: string; index: number } | null>(null);
  const [isDocumentEditorOpen, setIsDocumentEditorOpen] = useState(false);

  // Dedicated Pop-up Modal State for Tab 6: Document Return (วันที่ส่งคืน & สถานะ_ธุรการส่งคืน)
  const [tab6ReturnModal, setTab6ReturnModal] = useState<{
    isOpen: boolean;
    docId: string;
    record: DocumentRecord;
    returnDate: string;
    returnStatus: string;
    isSaving: boolean;
  } | null>(null);

  // Edit Modal State
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingData, setEditingData] = useState<DocumentRecord | null>(null);
  const [overrideSearch, setOverrideSearch] = useState('');
  const [isOverrideDropdownOpen, setIsOverrideDropdownOpen] = useState(false);
  const [agencySearch, setAgencySearch] = useState('');
  const [isAgencyDropdownOpen, setIsAgencyDropdownOpen] = useState(false);
  const [docTypeSearch, setDocTypeSearch] = useState('');
  const [isDocTypeDropdownOpen, setIsDocTypeDropdownOpen] = useState(false);
  const [returnStatusSearch, setReturnStatusSearch] = useState('');
  const [isReturnStatusDropdownOpen, setIsReturnStatusDropdownOpen] = useState(false);

  const agenciesToSuggest = Array.from(new Set([
    ...AGENCY_OPTIONS,
    ...(dropdownConfig?.agencies || [])
  ])).filter(Boolean);

  const docTypesToSuggest = DOC_TYPE_OPTIONS;

  const returnStatusesToSuggest = Array.from(new Set([
    ...RETURN_STATUS_OPTIONS,
    ...(dropdownConfig?.returnStatuses || [])
  ])).filter(Boolean);

  // Queue state and ref for round-robin assignment (โต๊ะ 1 - 9)
  const [lastDeskNum, setLastDeskNum] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('mfu_tab1_last_desk_num');
      const parsed = saved ? parseInt(saved, 10) : 0;
      return (parsed >= 1 && parsed <= 9) ? parsed : 0;
    } catch {
      return 0;
    }
  });
  const [lastAssignedIndex, setLastAssignedIndex] = useState<number>(lastDeskNum);
  const lastDeskNumRef = useRef<number>(lastDeskNum);

  const updateLastDeskNum = (num: number) => {
    setLastDeskNum(num);
    setLastAssignedIndex(num);
    lastDeskNumRef.current = num;
    try {
      if (num >= 1 && num <= 9) {
        localStorage.setItem('mfu_tab1_last_desk_num', String(num));
      }
    } catch (e) {}
  };

  // Active/Inactive provider desks state for managing leaves and desk closures
  const [inactiveProviders, setInactiveProviders] = useState<string[]>(() => {
    const saved = localStorage.getItem('inactive_providers');
    const parsed = saved ? JSON.parse(saved) : [];
    // Automatically migrate old plain names to prefixed names
    return parsed.map((oldName: string) => {
      const idx = PROVIDER_DESKS.findIndex(p => p === oldName || p.includes(oldName));
      return idx !== -1 ? PROVIDER_DESKS[idx] : oldName;
    });
  });

  const toggleProviderActive = (name: string) => {
    if (currentUserRole === 'view') {
      showToast('error', 'คุณมีสิทธิ์ "เข้าดู" เท่านั้น (View Only) ไม่สามารถเปิด/ปิดสถานะผู้ให้บริการได้');
      return;
    }
    const isInactive = inactiveProviders.includes(name);
    let updated: string[];
    if (isInactive) {
      updated = inactiveProviders.filter(p => p !== name);
    } else {
      updated = [...inactiveProviders, name];
    }
    // Check if at least one provider remains active
    const activeCount = PROVIDER_DESKS.length - updated.length;
    if (activeCount <= 0) {
      showToast('error', 'ต้องมีผู้ให้บริการเปิดทำงานอย่างน้อย 1 คน');
      return;
    }
    setInactiveProviders(updated);
    localStorage.setItem('inactive_providers', JSON.stringify(updated));
    showToast('info', `ปรับปรุงสถานะโต๊ะทำงานของ "${name}" สำเร็จ`);
  };

  // Form saving progress states
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Supabase Database Integration States
  const [supabaseStatus, setSupabaseStatus] = useState<{ ok: boolean; tableExists: boolean; checking: boolean }>({
    ok: false,
    tableExists: false,
    checking: true,
  });
  const [isSupabaseSqlModalOpen, setIsSupabaseSqlModalOpen] = useState<boolean>(false);
  const [isClearAllConfirmOpen, setIsClearAllConfirmOpen] = useState<boolean>(false);
  const [isClearingAll, setIsClearingAll] = useState<boolean>(false);

  // Dashboard Stats State
  const [stats, setStats] = useState<{ today: number; month: number; total: number; returned: number }>({ today: 0, month: 0, total: 0, returned: 0 });
  const [isLoadingStats, setIsLoadingStats] = useState<boolean>(false);
  const [allStatsRecords, setAllStatsRecords] = useState<Array<{ rowIndex: number; data: DocumentRecord }>>([]);

  // States for interactive stats details view and edit
  const [selectedStatsTab, setSelectedStatsTab] = useState<'today' | 'month' | 'total' | 'returned' | null>(null);
  const [statsSearchQuery, setStatsSearchQuery] = useState<string>('');

  // States for history record edit modal
  const [editingHistoryRecord, setEditingHistoryRecord] = useState<{ id?: string; rowIndex: number; data: DocumentRecord } | null>(null);
  const [editingHistoryData, setEditingHistoryData] = useState<DocumentRecord | null>(null);
  const [historyOverrideSearch, setHistoryOverrideSearch] = useState<string>('');
  const [isHistoryOverrideDropdownOpen, setIsHistoryOverrideDropdownOpen] = useState<boolean>(false);
  const [historyAgencySearch, setHistoryAgencySearch] = useState<string>('');
  const [isHistoryAgencyDropdownOpen, setIsHistoryAgencyDropdownOpen] = useState<boolean>(false);
  const [historyDocTypeSearch, setHistoryDocTypeSearch] = useState<string>('');
  const [isHistoryDocTypeDropdownOpen, setIsHistoryDocTypeDropdownOpen] = useState<boolean>(false);
  const [historyReturnStatusSearch, setHistoryReturnStatusSearch] = useState<string>('');
  const [isHistoryReturnStatusDropdownOpen, setIsHistoryReturnStatusDropdownOpen] = useState<boolean>(false);
  const [deletingHistoryRecord, setDeletingHistoryRecord] = useState<{ id?: string; rowIndex: number; data: DocumentRecord } | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [updatingDeskRowId, setUpdatingDeskRowId] = useState<string | null>(null);


  // States for Tab 7: DATAINPUT Report & Editor
  const [reportSearchQuery, setReportSearchQuery] = useState<string>('');
  const [reportAgencyFilter, setReportAgencyFilter] = useState<string>('');
  const [reportDocTypeFilter, setReportDocTypeFilter] = useState<string>('');
  const [reportDeskFilter, setReportDeskFilter] = useState<string>('');
  const [reportStatusFilter, setReportStatusFilter] = useState<string>('');
  const [reportTypeFilter, setReportTypeFilter] = useState<string>('all'); // all, '1. ตรวจจ่าย-งานใหม่', '2. ตรวจจ่าย-งานเก่า'
  const [reportEpFilter, setReportEpFilter] = useState<string>('all'); // all, O, N
  const [reportPeriodFilter, setReportPeriodFilter] = useState<string>('all'); // all, today, month
  const [reportPage, setReportPage] = useState<number>(1);
  const REPORT_ITEMS_PER_PAGE = 20;

  // States for Tab 8: Print Delivery Slip
  const [printDeskFilter, setPrintDeskFilter] = useState<string>('');
  const [printPeriodFilter, setPrintPeriodFilter] = useState<string>('today'); // today, yesterday, week, custom
  const [printStartDate, setPrintStartDate] = useState<string>('');
  const [printEndDate, setPrintEndDate] = useState<string>('');
  const [printTimeFilterMode, setPrintTimeFilterMode] = useState<string>('all'); // all, morning, afternoon, custom
  const [printTimeStart, setPrintTimeStart] = useState<string>('00:00');
  const [printTimeEnd, setPrintTimeEnd] = useState<string>('23:59');

  // Word-Style Print Preview Modal States
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState<boolean>(false);
  const [printItemsPerPage, setPrintItemsPerPage] = useState<number>(35);
  const [printPreviewZoom, setPrintPreviewZoom] = useState<number>(75);
  const [printMarginSize, setPrintMarginSize] = useState<'normal' | 'narrow' | 'wide'>('narrow');
  const [printPageOrientation, setPrintPageOrientation] = useState<'portrait' | 'landscape'>('portrait');

  // States for Tab 9: EP Summary Report (รายงานสรุป-EP)
  const [epReportPeriodFilter, setEpReportPeriodFilter] = useState<string>('all'); // all, today, month
  const [epReportTypeFilter, setEpReportTypeFilter] = useState<string>('all'); // all, 1, 2, 3, other
  const [epReportDeskFilter, setEpReportDeskFilter] = useState<string>('all'); // all, or desk name
  const [epReportStatusFilter, setEpReportStatusFilter] = useState<string>('all'); // all, pending, returned
  const [epReportSearchQuery, setEpReportSearchQuery] = useState<string>('');
  const [epReportPage, setEpReportPage] = useState<number>(1);
  const EP_REPORT_ITEMS_PER_PAGE = 20;

  const getEpInfo = (epCode: string | undefined) => {
    const code = String(epCode || '').trim();
    if (code === '1') {
      return {
        code: '1',
        label: '1 = งานด่วน',
        shortLabel: 'งานด่วน',
        color: 'rose',
        badgeBg: 'bg-rose-50 text-rose-700 border-rose-200',
      };
    }
    if (code === '2') {
      return {
        code: '2',
        label: '2 = งานเก่าด่วน',
        shortLabel: 'งานเก่าด่วน',
        color: 'purple',
        badgeBg: 'bg-purple-50 text-purple-700 border-purple-200',
      };
    }
    if (code === '3') {
      return {
        code: '3',
        label: '3 = งานใหญ่',
        shortLabel: 'งานใหญ่',
        color: 'amber',
        badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
      };
    }
    if (code && code !== 'N' && code !== 'O') {
      return {
        code: code,
        label: `EP ${code}`,
        shortLabel: `EP ${code}`,
        color: 'blue',
        badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
      };
    }
    return {
      code: '-',
      label: 'ไม่มี EP',
      shortLabel: 'ทั่วไป',
      color: 'slate',
      badgeBg: 'bg-slate-100 text-slate-500 border-slate-200',
    };
  };

  const getThaiDateTimeString = (date: Date = new Date()) => {
    return date.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
  };

  const parseThaiOrIsoDate = (dateStr: string) => {
    if (!dateStr) return null;
    const clean = dateStr.trim();

    // 1. Check if it contains a Thai month name
    const thaiMonthsShort = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const thaiMonthsFull = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

    let monthIdx = -1;
    // Check full names first
    for (let m = 0; m < 12; m++) {
      if (clean.includes(thaiMonthsFull[m])) {
        monthIdx = m + 1;
        break;
      }
    }
    // If not found, check short names
    if (monthIdx === -1) {
      for (let m = 0; m < 12; m++) {
        if (clean.includes(thaiMonthsShort[m])) {
          monthIdx = m + 1;
          break;
        }
      }
    }

    if (monthIdx !== -1) {
      // Extract digits
      const matches = clean.match(/(\d+)/g);
      if (matches && matches.length >= 1) {
        const day = parseInt(matches[0]);
        let year = new Date().getFullYear(); // default fallback
        
        // Find a potential year in the matches
        for (let i = 1; i < matches.length; i++) {
          const val = parseInt(matches[i]);
          if (val > 2400) {
            year = val - 543;
            break;
          } else if (val > 2000 && val < 2400) {
            year = val;
            break;
          } else if (val >= 60 && val <= 99) {
            // e.g. '69' in 2569 or 2069
            year = 2500 + val - 543;
            break;
          }
        }
        return { year, month: monthIdx, day };
      }
    }
    
    // Try matching ISO format YYYY-MM-DD or YYYY/MM/DD
    const isoMatch = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (isoMatch) {
      let year = parseInt(isoMatch[1]);
      const month = parseInt(isoMatch[2]);
      const day = parseInt(isoMatch[3]);
      if (year > 2400) year -= 543; // convert BE to CE
      return { year, month, day };
    }

    // Try matching DD/MM/YYYY or D/M/YYYY
    const datePart = clean.split(/[\s,T]+/)[0];
    const slashMatch = datePart.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (slashMatch) {
      const day = parseInt(slashMatch[1]);
      const month = parseInt(slashMatch[2]);
      let year = parseInt(slashMatch[3]);
      if (year > 2400) year -= 543; // convert BE to CE
      return { year, month, day };
    }

    return null;
  };

  const parseTimeFromDateString = (dateStr: string): { hour: number; minute: number } | null => {
    if (!dateStr) return null;
    const clean = dateStr.trim();
    
    // Try matching HH:mm:ss or HH:mm in the string
    const timeMatch = clean.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (timeMatch) {
      const hour = parseInt(timeMatch[1], 10);
      const minute = parseInt(timeMatch[2], 10);
      return { hour, minute };
    }
    return null;
  };

  const isTimeInRange = (timeStr: string, mode: string, startT: string, endT: string): boolean => {
    if (mode === 'all') return true;
    
    const parsedTime = parseTimeFromDateString(timeStr);
    if (!parsedTime) return true; // If no time is found, default to true to be safe
    
    const { hour, minute } = parsedTime;
    const currentMinutes = hour * 60 + minute;
    
    let startMin = 0;
    let endMin = 24 * 60 - 1;
    
    if (mode === 'morning') {
      startMin = 0 * 60 + 0; // 00:00
      endMin = 12 * 60 + 0;  // 12:00
    } else if (mode === 'afternoon') {
      startMin = 12 * 60 + 1; // 12:01
      endMin = 16 * 60 + 0;   // 16:00
    } else if (mode === 'custom') {
      const startParts = startT.split(':');
      const endParts = endT.split(':');
      if (startParts.length >= 2) {
        startMin = parseInt(startParts[0], 10) * 60 + parseInt(startParts[1], 10);
      }
      if (endParts.length >= 2) {
        endMin = parseInt(endParts[0], 10) * 60 + parseInt(endParts[1], 10);
      }
    }
    
    return currentMinutes >= startMin && currentMinutes <= endMin;
  };

  const getFilteredPrintRecords = () => {
    if (!printDeskFilter) return [];

    const today = new Date();
    let startLimit: Date | null = null;
    let endLimit: Date | null = null;

    if (printPeriodFilter === 'today') {
      startLimit = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      endLimit = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    } else if (printPeriodFilter === 'yesterday') {
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      startLimit = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
      endLimit = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
    } else if (printPeriodFilter === 'week') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(today.getDate() - 7);
      startLimit = new Date(sevenDaysAgo.getFullYear(), sevenDaysAgo.getMonth(), sevenDaysAgo.getDate());
      endLimit = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    } else if (printPeriodFilter === 'custom') {
      if (printStartDate) {
        startLimit = new Date(printStartDate);
        startLimit.setHours(0, 0, 0, 0);
      }
      if (printEndDate) {
        endLimit = new Date(printEndDate);
        endLimit.setHours(23, 59, 59, 999);
      }
    }

    return allStatsRecords.filter(item => {
      const d = item.data;
      
      // Match desk
      if (d.finalDesk !== printDeskFilter) return false;

      // Match date range
      if (startLimit || endLimit) {
        const parsed = parseThaiOrIsoDate(d.receiveDate);
        if (!parsed) return false;
        const recDate = new Date(parsed.year, parsed.month - 1, parsed.day);
        
        if (startLimit && recDate < startLimit) return false;
        if (endLimit && recDate > endLimit) return false;
      }

      // Match time range
      const timestampToUse = d.tableDate || d.receiveDate || '';
      if (!isTimeInRange(timestampToUse, printTimeFilterMode, printTimeStart, printTimeEnd)) {
        return false;
      }

      return true;
    });
  };

  const fetchReceivedData = async () => {
    setIsLoadingStats(true);
    try {
      const { count: totalCountFromDb, error: totalCountError } = await supabase
        .from(SUPABASE_DOCUMENTS_TABLE)
        .select('*', { count: 'exact', head: true });

      const supabaseRes = await fetchAllDocumentsFromSupabase();
      if (supabaseRes.success) {
        const records = supabaseRes.records || [];
        const parsedRecords = records.map((r, i) => ({
          rowIndex: i + 1,
          id: r.id,
          data: r.data,
          createdAt: r.createdAt,
        }));
        recalculateStats(parsedRecords);

        setStats(prev => ({
          ...prev,
          total: totalCountFromDb !== null && totalCountFromDb !== undefined ? totalCountFromDb : records.length
        }));

        // #region agent log
        fetch('http://127.0.0.1:7847/ingest/7db7843b-686d-4237-a285-84294b3f41c0',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'910c87'},body:JSON.stringify({sessionId:'910c87',runId:'post-fix',location:'App.tsx:fetchReceivedData',message:'stats fetched from 2570 table',data:{totalCountFromDb,totalCountError:totalCountError?.message||null,recordsLen:records.length,sourceTable:SUPABASE_DOCUMENTS_TABLE},timestamp:Date.now(),hypothesisId:'D,E'})}).catch(()=>{});
        // #endregion

        setAllStatsRecords(parsedRecords);

        // Sync into scannedItems
        const sheetScans: ScanItem[] = parsedRecords.map(item => {
          const curType = item.data.type || item.data.TYPE || '';
          const noType = item.data.noType || '';
          let tabId = 1;
          if (curType === '6. การส่งคืนเอกสาร' || (item.data.returnStatus && item.data.returnStatus !== '-' && item.data.returnStatus !== 'ไม่เลือก')) {
            tabId = 6;
          } else if (curType === '2. ตรวจจ่าย-งานเก่า' || noType === 'O') {
            tabId = 2;
          } else if (curType === '3. งานด้านอื่น') {
            tabId = 3;
          } else if (curType === '4. งานเบิกจ่าย' || item.data.autoDesk === 'งานเบิกจ่ายเงิน' || item.data.finalDesk === 'งานเบิกจ่ายเงิน') {
            tabId = 4;
          } else if (curType === '5. ไม่มีในฐานข้อมูล') {
            tabId = 5;
          } else if (curType === '1. ตรวจจ่าย-งานใหม่' || noType === 'N') {
            tabId = 1;
          } else {
            tabId = 1;
          }
          const parsedTime = parseDateToTimestamp(item.createdAt || item.data.receiveDate);
          return {
            id: item.id,
            tabId,
            createdAt: parsedTime > 0 ? parsedTime : undefined,
            barcode: item.data.barcode,
            foundInGenerate: true,
            foundInDataInput: true,
            dataInputRowIndex: item.rowIndex,
            isLoading: false,
            data: item.data,
          };
        });
        setScannedItems(sheetScans);
        setIsLoadingStats(false);
        return { success: true, count: totalCountFromDb ?? records.length };
      }
      setIsLoadingStats(false);
      return { success: false };
    } catch (err: any) {
      setIsLoadingStats(false);
      return { success: false, error: err.message };
    }
  };

  const loadDashboardStats = async (token?: string, sheetId?: string) => {
    await fetchReceivedData();
  };

  const recalculateStats = (records: Array<{ rowIndex: number; data: DocumentRecord }>) => {
    const today = new Date();
    const targetYear = today.getFullYear();
    const targetMonth = today.getMonth() + 1;
    const targetDay = today.getDate();

    let todayCount = 0;
    let monthCount = 0;
    let returnedCount = 0;
    const totalCount = records.length;

    for (const rec of records) {
      const dateStr = rec.data.receiveDate;

      const retStatus = rec.data.returnStatus || '';
      const isReturned = retStatus && retStatus !== '-' && retStatus !== 'ไม่เลือก';
      if (isReturned) {
        returnedCount++;
      }

      if (!dateStr) continue;

      const parsed = parseThaiOrIsoDate(dateStr);
      if (parsed) {
        if (parsed.year === targetYear && parsed.month === targetMonth) {
          monthCount++;
          if (parsed.day === targetDay) {
            todayCount++;
          }
        }
      }
    }

    setStats({
      today: todayCount,
      month: monthCount,
      total: totalCount,
      returned: returnedCount
    });
    // #region agent log
    fetch('http://127.0.0.1:7847/ingest/7db7843b-686d-4237-a285-84294b3f41c0',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'910c87'},body:JSON.stringify({sessionId:'910c87',runId:'post-fix',location:'App.tsx:recalculateStats',message:'recalculateStats output',data:{todayCount,monthCount,totalCount,returnedCount,recordCount:records.length},timestamp:Date.now(),hypothesisId:'D,E'})}).catch(()=>{});
    // #endregion
  };

  const handlePrintAction = () => {
    const printableElement = document.getElementById('word-print-preview-content');
    if (!printableElement) {
      showToast('error', 'ไม่พบเนื้อหาเอกสารสำหรับการจัดพิมพ์');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>ใบนำส่งเอกสาร - ${printDeskFilter}</title>
            <meta charset="utf-8">
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&display=swap');
              @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
              
              body {
                font-family: 'Sarabun', 'Inter', sans-serif;
                background-color: white;
                color: black;
                margin: 0;
                padding: 0;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              
              @media print {
                @page {
                  size: A4 portrait;
                  margin: 0;
                }
                body {
                  background: white !important;
                }
                .page-break {
                  page-break-after: always !important;
                  break-after: page !important;
                }
              }
              
              /* Physical A4 dimensions for printing */
              .print-page {
                width: 210mm;
                height: 297mm;
                box-sizing: border-box;
                background: white;
                position: relative;
                page-break-after: always;
                overflow: hidden;
                display: flex;
                flex-direction: column;
              }
              
              .print-page-landscape {
                width: 297mm;
                height: 210mm;
                box-sizing: border-box;
                background: white;
                position: relative;
                page-break-after: always;
                overflow: hidden;
                display: flex;
                flex-direction: column;
              }

              /* Margin sizes */
              .margin-normal {
                padding: 20mm 20mm 15mm 20mm;
              }
              .margin-narrow {
                padding: 10mm 12mm 10mm 12mm;
              }
              .margin-wide {
                padding: 30mm 30mm 25mm 30mm;
              }
              
              /* Flex layouts */
              .flex { display: flex; }
              .flex-col { flex-direction: column; }
              .items-center { align-items: center; }
              .justify-center { justify-content: center; }
              .justify-between { justify-content: space-between; }
              .text-center { text-align: center; }
              .text-right { text-align: right; }
              .w-full { width: 100%; }
              .flex-1 { flex: 1 1 0%; }
              
              /* Styling & typography */
              .font-bold { font-weight: 700; }
              .font-semibold { font-weight: 600; }
              .font-medium { font-weight: 500; }
              .font-mono { font-family: 'JetBrains Mono', monospace; }
              
              .border-b-2 { border-bottom-width: 2px; }
              .border-double { border-style: double; }
              .border-slate-300 { border-color: #cbd5e1; }
              .pb-4 { padding-bottom: 1rem; }
              .mb-2 { margin-bottom: 0.5rem; }
              .mt-1 { margin-top: 0.25rem; }
              .mt-3 { margin-top: 0.75rem; }
              .mt-4 { margin-top: 1rem; }
              .mt-6 { margin-top: 1.5rem; }
              .pt-5 { padding-top: 1.25rem; }
              .gap-1 { gap: 0.25rem; }
              .gap-8 { gap: 2rem; }
              
              /* Logo */
              .logo-box {
                width: 48px;
                height: 48px;
                background-color: #0f172a;
                color: white;
                border-radius: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
                font-size: 18px;
                margin-bottom: 0.5rem;
              }
              
              /* Text Sizes */
              .title-lg { font-size: 18px; margin: 0; }
              .subtitle-sm { font-size: 12px; color: #64748b; margin: 0; }
              .meta-row {
                display: flex;
                flex-wrap: wrap;
                justify-content: center;
                gap: 12px;
                font-size: 11px;
                color: #334155;
                margin-top: 8px;
              }
              .badge-bg {
                background-color: #f1f5f9;
                padding: 2px 8px;
                border-radius: 4px;
                border: 1px solid #e2e8f0;
              }
              .badge-teal {
                background-color: #f0fdf4;
                color: #166534;
                padding: 2px 8px;
                border-radius: 4px;
                border: 1px solid #bbf7d0;
                font-weight: bold;
              }
              .badge-indigo {
                background-color: #e0e7ff;
                color: #3730a3;
                padding: 2px 8px;
                border-radius: 4px;
                border: 1px solid #c7d2fe;
                font-weight: bold;
              }
              
              /* Table formatting */
              table {
                width: 100%;
                border-collapse: collapse;
                font-size: 11px;
                margin-top: 10px;
              }
              th, td {
                border: 1px solid #475569 !important;
                padding: 5px 6px;
                text-align: left;
                vertical-align: middle;
              }
              th {
                background-color: #f8fafc !important;
                font-weight: bold;
                color: #1e293b;
              }
              .row-even { background-color: #f8fafc; }
              
              /* Signatures */
              .grid-cols-2 {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 2rem;
              }
              .sig-title { font-size: 10px; font-weight: bold; color: #475569; }
              .sig-line {
                height: 32px;
                width: 176px;
                border-bottom: 1px dashed #64748b;
                margin-top: 4px;
              }
              .sig-name { font-size: 10px; color: #334155; margin-top: 4px; }
              .sig-date { font-size: 9px; color: #94a3b8; margin-top: 2px; }
              
              /* Print Footer Metadata */
              .print-footer {
                display: flex;
                justify-content: space-between;
                font-size: 8px;
                color: #94a3b8;
                margin-top: auto;
                padding-top: 6px;
                border-top: 1px solid #cbd5e1;
                font-family: monospace;
              }
              
              /* Signature grid position adjustments */
              .signature-section {
                margin-top: 15px;
                border-top: 1px solid #cbd5e1;
                padding-top: 15px;
              }
            </style>
          </head>
          <body>
            ${printableElement.innerHTML}
            <script>
              window.onload = function() {
                window.focus();
                window.print();
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } else {
      showToast('error', 'ระบบเปิดหน้าต่างใหม่ถูกบล็อกโดยเบราว์เซอร์ โปรดอนุญาตป๊อปอัปสำหรับเว็บไซต์นี้เพื่อจัดพิมพ์เอกสาร');
    }
  };

  const handleSaveHistoryEdit = async () => {
    if (currentUserRole === 'view') {
      showToast('error', 'คุณมีสิทธิ์ "เข้าดู" เท่านั้น (View Only) ไม่สามารถแก้ไขข้อมูลได้');
      return;
    }
    if (!editingHistoryRecord || !editingHistoryData) return;
    const recordId = editingHistoryRecord.id || (editingHistoryRecord as any).id;
    if (!recordId || String(recordId).startsWith('sb-') || String(recordId).startsWith('item_')) {
      showToast('error', 'ไม่พบ Primary Key (ID) ของรายการนี้ในระบบ ไม่สามารถแก้ไขได้');
      return;
    }
    if (isSaving) return;
    setIsSaving(true);
    try {
      const override = editingHistoryData.overrideDesk;
      const finalDesk = override && override !== 'ไม่เลือก' ? override : editingHistoryData.autoDesk;
      const updatedRecord: DocumentRecord = {
        ...editingHistoryData,
        finalDesk: finalDesk,
      };

      // สำหรับงาน "1. ตรวจจ่าย-งานใหม่": อัปเดตเบอร์โทรประจำโต๊ะตาม finalDesk ใหม่
      if (updatedRecord.type === '1. ตรวจจ่าย-งานใหม่' || updatedRecord.TYPE === '1. ตรวจจ่าย-งานใหม่') {
        const deskPhone = getDeskPhone(finalDesk);
        if (deskPhone) {
          updatedRecord.senderPhone = deskPhone;
          updatedRecord['โทรศัพท์'] = deskPhone;
          (updatedRecord as any)['โทร.'] = deskPhone;
        }
      }

      // 1. Update in Supabase strictly by Primary Key (.eq('id', recordId)) only
      // ⚠️ ห้ามใช้ เลขทะเบียนรับ ในการ UPDATE และห้ามสั่ง INSERT เด็ดขาด
      const res = await updateDocumentByIdInSupabase(recordId, updatedRecord);
      if (!res.success) {
        throw new Error(res.error || 'ไม่สามารถแก้ไขข้อมูลใน Supabase ได้');
      }

      await fetchReceivedData();

      setEditingHistoryRecord(null);
      setEditingHistoryData(null);
      setHistoryOverrideSearch('');
      setIsHistoryOverrideDropdownOpen(false);
      showToast('success', 'บันทึกแก้ไขข้อมูลใน Supabase สำเร็จ');
    } catch (err: any) {
      console.error('handleSaveHistoryEdit error:', err);
      showToast('error', `เกิดข้อผิดพลาดในการแก้ไข: ${err.message || 'ไม่สามารถติดต่อฐานข้อมูลได้'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteHistoryConfirm = async () => {
    if (currentUserRole === 'view') {
      showToast('error', 'คุณมีสิทธิ์ "เข้าดู" เท่านั้น (View Only) ไม่สามารถลบข้อมูลได้');
      return;
    }
    if (!deletingHistoryRecord) return;
    const historyId = deletingHistoryRecord.id || (deletingHistoryRecord as any).id;
    if (!historyId || String(historyId).startsWith('sb-') || String(historyId).startsWith('item_')) {
      showToast('error', 'ไม่พบ Primary Key (ID) ของรายการนี้ในระบบ ไม่สามารถลบได้');
      return;
    }
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      // ลบโดยใช้ .eq('id', historyId) เท่านั้น (ห้ามใช้ barcode เพื่อไม่ให้กระทบรายการอื่นที่เลขทะเบียนรับซ้ำกัน)
      const deleteRes = await deleteDocumentFromSupabase(historyId);

      if (!deleteRes.success || deleteRes.error) {
        showToast('error', `ลบข้อมูลไม่สำเร็จ: ${deleteRes.error || 'ไม่สามารถลบข้อมูลจาก Supabase ได้'}`);
        return;
      }

      await fetchReceivedData();

      setDeletingHistoryRecord(null);
      setEditingHistoryRecord(null);
      setEditingHistoryData(null);
      showToast('success', 'ลบข้อมูลรายการนี้จากตาราง 2570-ระบบติดตามเอกสาร สำเร็จ');
    } catch (err: any) {
      console.error('handleDeleteHistoryConfirm error:', err);
      showToast('error', `เกิดข้อผิดพลาดในการลบ: ${err.message || 'ไม่สามารถติดต่อฐานข้อมูลได้'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Dedicated handler for changing provider directly in Tab 7 table strictly by Primary Key (id)
  const handleTab7InlineDeskChange = async (targetId: string, newDesk: string, currentData: DocumentRecord) => {
    if (currentUserRole === 'view') {
      showToast('error', 'คุณมีสิทธิ์ "เข้าดู" เท่านั้น (View Only) ไม่สามารถแก้ไขข้อมูลได้');
      return;
    }
    const cleanId = String(targetId || '').trim();
    if (!cleanId || cleanId.startsWith('sb-') || cleanId.startsWith('item_')) {
      showToast('error', 'ไม่พบ Primary Key (ID) ของรายการนี้ในระบบ');
      return;
    }
    if (updatingDeskRowId) return; // Prevent double triggering

    setUpdatingDeskRowId(cleanId);
    try {
      const deskPhone = getDeskPhone(newDesk);
      const updatedRecord: DocumentRecord = {
        ...currentData,
        finalDesk: newDesk,
        overrideDesk: newDesk,
        senderPhone: deskPhone || currentData.senderPhone || '',
        'โทรศัพท์': deskPhone || currentData['โทรศัพท์'] || '',
        'โทร.': deskPhone || (currentData as any)['โทร.'] || '',
      };

      // Optimistic UI update
      setAllStatsRecords(prev => prev.map(r => r.id === cleanId ? { ...r, data: updatedRecord } : r));
      setScannedItems(prev => prev.map(s => s.id === cleanId ? { ...s, data: updatedRecord } : s));

      // Strictly UPDATE by Primary Key (id) only:
      const res = await updateDocumentByIdInSupabase(cleanId, updatedRecord);
      if (!res.success) {
        throw new Error(res.error || 'บันทึกแก้ไขผู้ให้บริการไม่สำเร็จ');
      }

      await fetchReceivedData();
      showToast('success', `เปลี่ยนผู้ให้บริการเป็น ${newDesk} เรียบร้อยแล้ว`);
    } catch (err: any) {
      console.error('Tab 7 inline desk change error:', err);
      showToast('error', `เกิดข้อผิดพลาด: ${err.message || ''}`);
      await fetchReceivedData();
    } finally {
      setUpdatingDeskRowId(null);
    }
  };

  const handleClearAllData = async () => {
    if (currentUserRole === 'view') {
      showToast('error', 'คุณมีสิทธิ์ "เข้าดู" เท่านั้น (View Only) ไม่สามารถล้างข้อมูลได้');
      return;
    }
    setIsClearingAll(true);
    try {
      const res = await clearAllDocumentsFromSupabase();
      if (!res.success && res.error && !res.error.includes('schema cache')) {
        throw new Error(res.error);
      }
      setScannedItems([]);
      setAllStatsRecords([]);
      setStats({ today: 0, month: 0, total: 0, returned: 0 });
      setIsClearAllConfirmOpen(false);
      showToast('success', 'ล้างข้อมูลเอกสารทั้งหมดในระบบและ Supabase เรียบร้อยแล้ว');
    } catch (err: any) {
      console.error(err);
      showToast('error', `เกิดข้อผิดพลาดในการล้างข้อมูล: ${err.message || 'ไม่สามารถติดต่อฐานข้อมูลได้'}`);
    } finally {
      setIsClearingAll(false);
    }
  };

  const getFilteredStatsRecords = () => {
    const today = new Date();
    const targetYear = today.getFullYear();
    const targetMonth = today.getMonth() + 1;
    const targetDay = today.getDate();

    // 1. Filter by Tab
    let tabFiltered = allStatsRecords;
    if (selectedStatsTab === 'today') {
      tabFiltered = allStatsRecords.filter(item => {
        const parsed = parseThaiOrIsoDate(item.data.receiveDate);
        return parsed && parsed.day === targetDay && parsed.month === targetMonth && parsed.year === targetYear;
      });
    } else if (selectedStatsTab === 'month') {
      tabFiltered = allStatsRecords.filter(item => {
        const parsed = parseThaiOrIsoDate(item.data.receiveDate);
        return parsed && parsed.month === targetMonth && parsed.year === targetYear;
      });
    } else if (selectedStatsTab === 'returned') {
      tabFiltered = allStatsRecords.filter(item => {
        const retStatus = item.data.returnStatus || '';
        return retStatus && retStatus !== '-' && retStatus !== 'ไม่เลือก';
      });
    }

    // 2. Filter by search query
    if (statsSearchQuery.trim()) {
      const query = statsSearchQuery.toLowerCase().trim();
      tabFiltered = tabFiltered.filter(item => {
        const d = item.data;
        return (
          String(d.barcode || '').toLowerCase().includes(query) ||
          String(d.mhesiNumber || '').toLowerCase().includes(query) ||
          String(d.agency || '').toLowerCase().includes(query) ||
          String(d.docNumber || '').toLowerCase().includes(query) ||
          String(d.docType || '').toLowerCase().includes(query) ||
          String(d.finalDesk || '').toLowerCase().includes(query) ||
          String(d.receiveDate || '').toLowerCase().includes(query) ||
          String(d.remarks || '').toLowerCase().includes(query)
        );
      });
    }

    // Reverse to show newest records first
    return [...tabFiltered].reverse();
  };

  // Global toast / status message
  const [toastMessage, setToastMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  const showToast = (type: 'success' | 'error' | 'info', text: string) => {
    setToastMessage({ type, text });
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 4000);
    return () => clearTimeout(timer);
  };

  // Convert Tab index to human-readable Thai Sheet name
  const getSheetNameByTab = (tabId: number): string => {
    switch (tabId) {
      case 1: return 'งานใหม่';
      case 2: return 'งานเก่า';
      case 3: return 'งานด้านอื่น';
      case 4: return 'งานเบิกจ่าย';
      case 5: return 'ไม่มีในฐานข้อมูล';
      case 6: return 'การส่งคืนเอกสาร';
      default: return 'งานใหม่';
    }
  };

  // 0. Initialize & Test Supabase Connection on mount
  const checkSupabase = async () => {
    setSupabaseStatus(prev => ({ ...prev, checking: true }));
    const res = await testSupabaseConnection();
    setSupabaseStatus({
      ok: res.ok,
      tableExists: res.tableExists,
      checking: false,
    });
    // Load dashboard stats directly from Supabase (works with or without Google token)
    await fetchReceivedData();
  };

  useEffect(() => {
    checkSupabase();
    fetchReceivedData();
  }, []);

  // 1. Initialize Firebase Auth
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setAccessToken(token);
        setIsLoadingAuth(false);
        showToast('success', 'เข้าสู่ระบบด้วย Google บัญชีสำเร็จ!');
      },
      () => {
        setUser(null);
        setAccessToken(null);
        setIsLoadingAuth(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // 2. Fetch sheet configurations & verify spreadsheet whenever token or ID changes
  useEffect(() => {
    if (accessToken) {
      verifyAndLoadConfig();

      // Supabase is loaded directly via fetchReceivedData
      fetchReceivedData();
    }
  }, [accessToken, spreadsheetId]);

  // 3. Auto-Sync ข้อมูลเมื่อเปิดเข้าหน้า 7 (แสดงรายงาน & แก้ไข) หรือสลับแท็บระหว่างหน้า 1-7
  const prevTabRef = useRef<number>(activeTab);
  useEffect(() => {
    fetchReceivedData();
    prevTabRef.current = activeTab;
  }, [activeTab]);

  const verifyAndLoadConfig = async (tokenOverride?: string) => {
    setIsVerifyingSheet(true);
    setSpreadsheetError(null);
    try {
      const res = await testSupabaseConnection();
      setSupabaseStatus({ ok: res.ok, tableExists: res.tableExists, checking: false });
      setSpreadsheetName('Supabase Connected');
      await fetchReceivedData();
    } catch (err: any) {
      console.warn('Verify Supabase warning:', err);
      setSpreadsheetError(`เชื่อมโยง Supabase ไม่สำเร็จ: ${err.message || ''}`);
    } finally {
      setIsVerifyingSheet(false);
    }
  };

  // Round-robin calculator: takes currentDeskNum (1-based index 1-9), advances to next active desk skipping inactive ones
  const getNextActiveDesk = (currentDeskNum: number): { deskName: string; deskNum: number } => {
    const activeList = PROVIDER_DESKS.filter(p => !inactiveProviders.includes(p));
    if (activeList.length === 0) {
      return { deskName: PROVIDER_DESKS[0], deskNum: 1 };
    }

    // Start candidate check at 0-based index corresponding to currentDeskNum
    // E.g., if currentDeskNum is 5, candidate check starts at index 5 (Desk 6)
    const startIdx = currentDeskNum > 0 ? currentDeskNum : 0;
    for (let i = 0; i < PROVIDER_DESKS.length; i++) {
      const idx = (startIdx + i) % PROVIDER_DESKS.length;
      const candidateName = PROVIDER_DESKS[idx];
      if (activeList.includes(candidateName)) {
        const deskNum = idx + 1; // 1-based index (1 to 9)
        return { deskName: candidateName, deskNum };
      }
    }

    return { deskName: PROVIDER_DESKS[0], deskNum: 1 };
  };

  // 1. Safe Regex Helper Function to extract desk number (supports whitespace like "(7) อภิญญา")
  const extractDeskNum = (str?: string): number => {
    if (!str || str === 'ไม่เลือก') return 0;
    const match = str.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  };

  // 2. Synchronous Next Desk Provider calculation (uses useRef + latest item + fail-safe)
  const getNextDeskProvider = (
    currentItems: ScanItem[],
    lastRef: React.MutableRefObject<number>,
    inactiveList: string[]
  ): string => {
    const DESK_LIST = [
      "(1)ภาคินี", "(2)พรนัชชา", "(3)ดารารัตน์",
      "(4)สาโรจน์", "(5)ละอองดาว", "(6)ธนัฏพร",
      "(7)อภิญญา", "(8)ทรงวุฒิ", "(9)ดุษฎา"
    ];

    let baseDeskNum = lastRef.current;

    // วนลูปหาเลขโต๊ะจากรายการล่าสุดใน State (ไล่หาจากรายการล่าสุด)
    if (currentItems && currentItems.length > 0) {
      for (const item of currentItems) {
        // ดึงจาก overrideDesk (คอลัมน์ P) ก่อน -> ถ้าไม่มีใช้ finalDesk (คอลัมน์ Q) -> ถ้าไม่มีใช้ autoDesk (คอลัมน์ O)
        const targetStr = item.data?.overrideDesk || item.data?.finalDesk || item.data?.autoDesk;
        const extracted = extractDeskNum(targetStr);
        if (extracted > 0) {
          baseDeskNum = extracted;
          break; // เจอเลขโต๊ะจากแถวล่าสุดแล้ว ให้หยุดลูปทันที
        }
      }
    }

    // ป้องกันกรณีระบบหาเลขไม่เจอจริงๆ ให้ใช้งานจากโต๊ะ 9 เพื่อให้ +1 ได้โต๊ะ 1
    if (baseDeskNum <= 0) {
      baseDeskNum = 9;
    }

    // คำนวณวนลำดับโต๊ะถัดไป (1 -> 2 -> ... -> 9 -> 1) โดยข้ามโต๊ะที่อยู่ใน inactiveList
    let nextNum = baseDeskNum;
    for (let i = 0; i < 9; i++) {
      nextNum = (nextNum % 9) + 1;
      const providerName = DESK_LIST[nextNum - 1];
      if (!inactiveList.includes(providerName)) {
        break;
      }
    }

    // อัปเดต Ref ใน Memory ทันทีแบบ Synchronous
    lastRef.current = nextNum;
    setLastDeskNum(nextNum);
    return DESK_LIST[nextNum - 1];
  };

  // Dedicated Round-Robin Desk Calculator for Tab 1 ("1. ตรวจจ่าย-งานใหม่")
  // ตรวจสอบและรองรับครบทั้ง 9 โต๊ะบริการ:
  // 1) (1)ภาคินี, 2) (2)พรนัชชา, 3) (3)ดารารัตน์, 4) (4)สาโรจน์,
  // 5) (5)ละอองดาว, 6) (6)ธนัฏพร, 7) (7)อภิญญา, 8) (8)ทรงวุฒิ, 9) (9)ดุษฎา
  // คำนวณตำแหน่งโต๊ะถัดไปแบบ Dynamic อิงตามโต๊ะเปิดใช้งานจริงทั้งหมด (Active Desks): nextIndex = (currentIndex + 1) % activeDesks.length
  const getNextTab1Desk = (): string => {
    const ALL_9_DESKS = [
      '(1)ภาคินี',
      '(2)พรนัชชา',
      '(3)ดารารัตน์',
      '(4)สาโรจน์',
      '(5)ละอองดาว',
      '(6)ธนัฏพร',
      '(7)อภิญญา',
      '(8)ทรงวุฒิ',
      '(9)ดุษฎา'
    ];

    // กรองเฉพาะโต๊ะที่เปิดทำงานอยู่จริง (ไม่ติดสถานะลา/ปิดโต๊ะ) จากทั้ง 9 โต๊ะ
    const activeDesks = ALL_9_DESKS.filter(desk => !inactiveProviders.includes(desk));
    if (activeDesks.length === 0) {
      updateLastDeskNum(1);
      return ALL_9_DESKS[0];
    }

    // ดึงค่าหมายเลขโต๊ะล่าสุด (1-9) จาก Ref / State lastAssignedIndex / localStorage / ข้อมูลล่าสุด
    let currentNum = lastDeskNumRef.current;
    if (currentNum < 1 || currentNum > 9) {
      currentNum = lastAssignedIndex;
    }
    if (currentNum < 1 || currentNum > 9) {
      try {
        const saved = localStorage.getItem('mfu_tab1_last_desk_num');
        const parsed = saved ? parseInt(saved, 10) : 0;
        if (parsed >= 1 && parsed <= 9) currentNum = parsed;
      } catch (e) {}
    }

    if (currentNum < 1 || currentNum > 9) {
      // Fallback: ดูจากรายการล่าสุดของ Tab 1 ใน scannedItems
      const recentTab1 = scannedItems.find(item =>
        (item.data.type === '1. ตรวจจ่าย-งานใหม่' || item.data.TYPE === '1. ตรวจจ่าย-งานใหม่') &&
        extractDeskNum(item.data.finalDesk || item.data.overrideDesk || item.data.autoDesk) > 0
      );
      if (recentTab1) {
        const extracted = extractDeskNum(recentTab1.data.finalDesk || recentTab1.data.overrideDesk || recentTab1.data.autoDesk);
        if (extracted >= 1 && extracted <= 9) currentNum = extracted;
      }
    }

    // หา index ของโต๊ะล่าสุดใน activeDesks
    let currentIndex = -1;
    if (currentNum >= 1 && currentNum <= 9) {
      currentIndex = activeDesks.findIndex(d => extractDeskNum(d) === currentNum);
    }

    let nextIndex: number;
    if (currentIndex !== -1) {
      // คำนวณตำแหน่งโต๊ะถัดไปแบบ Dynamic ตามจำนวนโต๊ะที่เปิดใช้งานจริงทั้งหมด
      nextIndex = (currentIndex + 1) % activeDesks.length;
    } else {
      // กรณีไม่พบโต๊ะล่าสุดใน activeDesks (เช่น โต๊ะนั้นลา/ปิดโต๊ะ หรือเพิ่งเริ่มระบบ)
      // เลือกโต๊ะเปิดตัวแรกที่มีหมายเลขมากกว่า currentNum หรือวนกลับไปที่โต๊ะแรก
      const forwardIdx = activeDesks.findIndex(d => extractDeskNum(d) > currentNum);
      nextIndex = forwardIdx !== -1 ? forwardIdx : 0;
    }

    const assignedDesk = activeDesks[nextIndex];
    const assignedNum = extractDeskNum(assignedDesk);

    // Persist synchronously to ref, state, and localStorage
    if (assignedNum >= 1 && assignedNum <= 9) {
      updateLastDeskNum(assignedNum);
    }

    return assignedDesk;
  };

  // Legacy fallback helper for getNextDeskName
  const getNextDeskName = (_offset: number, baseLastNum: number): string => {
    return getNextActiveDesk(baseLastNum).deskName;
  };

  // Extract desk index directly from latest row (scannedItems[0]) prioritizing overrideDesk then finalDesk
  const getEffectiveLastDeskNum = (): number => {
    if (scannedItems.length > 0) {
      const latestItem = scannedItems[0];
      const override = latestItem.data.overrideDesk;
      const effectiveStr = (override && override !== 'ไม่เลือก') ? override : (latestItem.data.finalDesk || latestItem.data.autoDesk);
      
      const num = extractDeskNum(effectiveStr);
      if (num > 0) {
        lastDeskNumRef.current = num;
        return num;
      }
    }
    return lastDeskNumRef.current || lastDeskNum || 0;
  };

  // Auto desk mapping for Tab 3 (งานด้านอื่น) based on document type
  const getDeskByDocType = (docType: string): string => {
    const norm = docType.trim();
    if (norm.includes('สวัสดิการ')) return '(10)ทิพาธร';
    if (norm.includes('ค่าอาหารทำการนอกเวลา')) return '(S2)จิรวรรณ';
    if (norm.includes('ค่าแรง') || norm.includes('เบิกจ่ายค่าแรง')) return '(S2)จิรวรรณ';
    if (norm.includes('ทุนการศึกษา')) return '(F7)กฤษณา';
    if (norm.includes('โอนเงิน-เข้าบ/ชเงินเดือน')) return '(S1)จารุวรรณ';
    if (norm.includes('งานเงินลงทุน')) return '(F8)ประกายมาศ';
    if (norm.includes('งานเงินเดือน')) return '(S1)จารุวรรณ';

    if (norm.includes('คำสั่ง')) return '(3)ดารารัตน์'; // Desk 3
    if (norm.includes('ประกาศ')) return '(4)สาโรจน์'; // Desk 4
    if (norm.includes('เบิกจ่าย') || norm.includes('เงิน')) return 'งานเบิกจ่ายเงิน';
    return '(1)ภาคินี'; // Desk 1
  };

  // Trigger search / import from GENERATE database
  const handleFetchBarcodes = async () => {
    if (isSearching) return;
    if (currentUserRole === 'view') {
      showToast('error', 'คุณมีสิทธิ์ "เข้าดู" เท่านั้น (View Only) ไม่สามารถทำการค้นหาหรือเพิ่มข้อมูลลงระบบได้');
      return;
    }
    if (activeTab !== 1 && activeTab !== 2 && !accessToken) {
      showToast('error', 'กรุณาเข้าสู่ระบบด้วยบัญชี Google ก่อนเริ่มดำเนินการ');
      return;
    }

    const now = Date.now();
    if (now - lastSubmitTimeRef.current < 500) {
      console.warn('Blocked rapid double submit in handleFetchBarcodes');
      return;
    }
    lastSubmitTimeRef.current = now;

    const activeBarcodes = barcodes.map(b => b.trim()).filter(b => b.length > 0);
    if (activeBarcodes.length === 0) {
      showToast('error', 'กรุณากรอกหรือสแกนเลขทะเบียนรับอย่างน้อย 1 รายการ');
      return;
    }

    // บังคับตรวจสอบเลขทะเบียนรับ 8 หลัก ในทุกหน้างาน (1 ถึง 6)
    if (activeTab >= 1 && activeTab <= 6) {
      for (const barcode of activeBarcodes) {
        if (barcode.length !== 8) {
          setAlertModal({
            isOpen: true,
            title: 'เลขทะเบียนรับไม่ถูกต้อง',
            message: `เลขทะเบียนรับต้องเป็นตัวเลข 8 หลักเท่านั้น (ปัจจุบันกรอก ${barcode.length} หลัก: "${barcode}") กรุณาตรวจสอบและแก้ไขให้ครบ 8 หลักก่อนดำเนินการ`,
            type: 'warning',
          });
          showToast('error', `เลขทะเบียนรับต้องเป็นตัวเลข 8 หลักเท่านั้น (ปัจจุบันกรอก ${barcode.length} หลัก)`);
          return;
        }
      }
    }

    // SPECIALIZED IMPLEMENTATION FOR: "1. ตรวจจ่าย-งานใหม่"
    if (activeTab === 1) {
      setIsSearching(true);
      const tab1Scans: ScanItem[] = [];
      const nowStr = getThaiDateTimeString();
      let hasError = false;

      try {
        for (const barcode of activeBarcodes) {
          // 1. Check if barcode already exists in 2570-ระบบติดตามเอกสาร
          const existCheck = await checkBarcodeExistsInTracking(barcode);
          if (existCheck.exists && existCheck.doc) {
            showToast(
              'info',
              `⚠️ เลขทะเบียนรับ "${barcode}" นี้เคยบันทึกในระบบติดตามเอกสารแล้ว (ผู้ให้บริการ: ${existCheck.doc.finalDesk || existCheck.doc.autoDesk || '-'})`
            );
          }

          // 2. Automated Data Lookup: Checklist-2570 first, then Checklist-2569
          const clRes = await lookupBarcodeInChecklists(barcode);
          const clData = clRes.found && clRes.data ? clRes.data : {};

          // 3. Round-Robin Desk Routing (1 -> 2 -> ... -> 9 -> 1, skip inactive desks)
          const assignedAutoDesk = getNextTab1Desk();
          const finalDesk = assignedAutoDesk;
          const deskPhone = getDeskPhone(finalDesk);

          // 4. Construct INSERT Payload (เฉพาะหน้างานใหม่: เบอร์โทรใช้เบอร์ประจำโต๊ะตามผู้ให้บริการ-final)
          const sName = clData.senderName || clData['ผู้ส่งเอกสาร'] || '';
          const sPhone = deskPhone || clData.senderPhone || clData['โทรศัพท์'] || '';
          const sEmail = clData.senderEmail || clData['ที่อยู่อีเมล'] || '';

          const newRecord: DocumentRecord = {
            noType: 'N',
            type: '1. ตรวจจ่าย-งานใหม่',
            TYPE: '1. ตรวจจ่าย-งานใหม่',
            ep: '',
            barcode,
            mhesiNumber: clData.mhesiNumber || '',
            agency: clData.agency || '',
            docType: clData.docType || '',
            docNumber: clData.docNumber || '',
            senderName: sName,
            'ผู้ส่งเอกสาร': sName,
            senderPhone: sPhone,
            'โทรศัพท์': sPhone,
            'โทร.': sPhone,
            senderEmail: sEmail,
            'ที่อยู่อีเมล': sEmail,
            receiveDate: nowStr,
            tableDate: nowStr,
            autoDesk: assignedAutoDesk,
            finalDesk: finalDesk,
            overrideDesk: '',
            remarks: '',
          };

          // 5. INSERT into 2570-ระบบติดตามเอกสาร (Await Supabase response)
          const sbInsert = await insertSingleDocumentToSupabase(newRecord);
          if (!sbInsert.success) {
            hasError = true;
            showToast('error', `บันทึก Supabase ไม่สำเร็จ: ${sbInsert.error || 'เกิดข้อผิดพลาด'}`);
            break;
          }

          const savedId = sbInsert.id ? sbInsert.id : `sb-${Date.now()}-${barcode}`;
          const scanItem: ScanItem = {
            id: savedId,
            createdAt: Date.now(),
            tabId: 1,
            barcode,
            foundInGenerate: clRes.found,
            foundInDataInput: true,
            isLoading: false,
            data: newRecord,
          };
          tab1Scans.push(scanItem);

          // แทรกรายการใหม่ไว้ด้านบนสุดใน React State ทันทีที่สแกนสำเร็จ: [newItem, ...prev]
          setScannedItems(prev => [scanItem, ...prev.filter(p => p.barcode !== barcode)]);

          showToast(
            'success',
            `บันทึกรับงานใหม่สำเร็จ: ${barcode} -> โต๊ะ ${assignedAutoDesk} ${clRes.found ? `(ดึงจาก ${clRes.source})` : '(ไม่พบใน Checklist)'}`
          );
        }

        if (!hasError && tab1Scans.length > 0) {
          await fetchReceivedData();
          // Reset form input ONLY AFTER successful Supabase insert and sync
          setBarcodes(['', '', '', '', '']);
        }
      } catch (err: any) {
        console.error('Error in handleFetchBarcodes tab 1:', err);
        showToast('error', `เกิดข้อผิดพลาดในการบันทึก: ${err.message || ''}`);
      } finally {
        setIsSearching(false);
      }
      return;
    }

    // SPECIALIZED IMPLEMENTATION FOR: "2. ตรวจจ่าย-งานเก่า"
    if (activeTab === 2) {
      setIsSearching(true);
      const tab2Scans: ScanItem[] = [];
      const nowStr = getThaiDateTimeString();
      let hasError = false;

      try {
        for (const barcode of activeBarcodes) {
          // 1. ตรวจสอบข้อมูลเดิม: ในตาราง 2570-ระบบติดตามเอกสาร ลำดับแรก หากไม่พบ fallback ไป 2569-ดึงข้อมูล (หรือ Checklist-2569)
          // เรียงตาม วันที่ธุรการส่ง ล่าสุดลงมาก่อน (Descending) พร้อมแมปเข้ากับมาตรฐาน 9 โต๊ะปี 2570 และเบอร์โทรศัพท์โต๊ะทันที
          const tab2Lookup = await lookupOldWorkForTab2(barcode);
          const existingData = tab2Lookup.data || {};
          const assignedDesk = tab2Lookup.provider || 'กรอกมือระบุเอง';
          const deskPhone = tab2Lookup.phone || getDeskPhone(assignedDesk);

          // 2. เตรียมข้อมูลผู้ส่งและเบอร์โทร (แมปเบอร์โทรประจำโต๊ะเข้าฟิลด์โทรศัพท์อัตโนมัติ)
          const sName = existingData.senderName || existingData['ผู้ส่งเอกสาร'] || '';
          const sPhone = deskPhone || existingData.senderPhone || existingData['โทรศัพท์'] || (existingData as any)['โทร.'] || '';
          const sEmail = existingData.senderEmail || existingData['ที่อยู่อีเมล'] || '';

          // 3. สร้าง Payload ครบถ้วนทุกฟิลด์ โดยกำหนด TYPE = '2. ตรวจจ่าย-งานเก่า' และ N/O = 'O'
          const newRecord: DocumentRecord = {
            noType: 'O',
            type: '2. ตรวจจ่าย-งานเก่า',
            TYPE: '2. ตรวจจ่าย-งานเก่า',
            ep: '',
            barcode,
            mhesiNumber: existingData.mhesiNumber || '',
            agency: existingData.agency || '',
            docType: existingData.docType || '',
            docNumber: existingData.docNumber || '',
            senderName: sName,
            'ผู้ส่งเอกสาร': sName,
            senderPhone: sPhone,
            'โทรศัพท์': sPhone,
            'โทร.': sPhone,
            senderEmail: sEmail,
            'ที่อยู่อีเมล': sEmail,
            receiveDate: existingData.receiveDate || nowStr,
            tableDate: nowStr,
            autoDesk: assignedDesk,
            finalDesk: assignedDesk,
            overrideDesk: '',
            remarks: existingData.remarks || '',
            returnDate: '',
            returnStatus: '',
          };

          // 4. INSERT เข้า 2570-ระบบติดตามเอกสาร (Await Supabase response)
          const sbInsert = await insertSingleDocumentToSupabase(newRecord);
          if (!sbInsert.success) {
            hasError = true;
            showToast('error', `บันทึก Supabase ไม่สำเร็จ: ${sbInsert.error || 'เกิดข้อผิดพลาด'}`);
            break;
          }

          const savedId = sbInsert.id ? sbInsert.id : `sb-${Date.now()}-${barcode}`;
          const scanItem: ScanItem = {
            id: savedId,
            createdAt: Date.now(),
            tabId: 2,
            barcode,
            foundInGenerate: tab2Lookup.found,
            foundInDataInput: true,
            isLoading: false,
            data: newRecord,
          };
          tab2Scans.push(scanItem);

          // แทรกรายการใหม่ไว้ด้านบนสุดใน React State ทันที: [newItem, ...prev]
          setScannedItems(prev => [scanItem, ...prev.filter(p => p.barcode !== barcode)]);

          showToast(
            'success',
            `บันทึกรับงานเก่าสำเร็จ: ${barcode} -> ผู้ให้บริการ: ${assignedDesk} (โทร. ${deskPhone || '-'}) ${tab2Lookup.found ? `(ดึงจาก ${tab2Lookup.source})` : '(ไม่พบประวัติเดิม)'}`
          );
        }

        if (!hasError && tab2Scans.length > 0) {
          await fetchReceivedData();
          // Reset form input ONLY AFTER successful Supabase insert and sync
          setBarcodes(['', '', '', '', '']);
        }
      } catch (err: any) {
        console.error('Error in handleFetchBarcodes tab 2:', err);
        showToast('error', `เกิดข้อผิดพลาดในการบันทึก: ${err.message || ''}`);
      } finally {
        setIsSearching(false);
      }
      return;
    }

    // SPECIALIZED IMPLEMENTATION FOR: "6. การส่งคืนเอกสาร"
    if (activeTab === 6) {
      setIsSearching(true);
      try {
        const barcode = activeBarcodes[0];
        const sbRes = await lookupBarcodeForReturnInSupabase(barcode);

        if (!sbRes.found || !sbRes.data) {
          setAlertModal({
            isOpen: true,
            title: 'ไม่พบข้อมูลการรับเอกสารในระบบ',
            message: 'ไม่พบข้อมูลการรับเอกสารในระบบ',
            type: 'warning',
          });
          showToast('error', 'ไม่พบข้อมูลการรับเอกสารในระบบ');
          return;
        }

        // เมื่อค้นพบข้อมูลสำเร็จ ให้เปิด Pop-up Modal เด้งขึ้นมาทันที
        // ช่องที่ 1: วันที่ส่งคืน -> Format: YYYY-MM-DD HH:mm:ss ปัจจุบัน
        // ช่องที่ 2: สถานะ_ธุรการส่งคืน -> Dropdown ค่าเริ่มต้น "ติดต่อรับคืน"
        setTab6ReturnModal({
          isOpen: true,
          docId: sbRes.id || '',
          record: sbRes.data,
          returnDate: getIsoDateTimeString(),
          returnStatus: 'ติดต่อรับคืน',
          isSaving: false,
        });
      } catch (err: any) {
        console.error('Error in Tab 6 return lookup:', err);
        showToast('error', `เกิดข้อผิดพลาดในการค้นหาข้อมูล: ${err.message || ''}`);
      } finally {
        setIsSearching(false);
      }
      return;
    }

    setIsSearching(true);
    const newScans: ScanItem[] = [];
    const nowStr = getThaiDateTimeString();

    // 1. Parallel Batch Lookups (Instant < 2-3s resolution using indexed HashMaps)
    const currentTabName = getTabTypeName(activeTab);
    const lookupResults = await Promise.all(
      activeBarcodes.map(async (barcode) => {
        const uuid = `item_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const nowTimestamp = Date.now();
        const baseRecord: DocumentRecord = {
          noType: activeTab === 1 ? 'N' : activeTab === 2 || activeTab === 4 ? 'O' : 'N',
          type: currentTabName,
          TYPE: currentTabName,
          ep: '',
          barcode,
          senderName: '',
          'ผู้ส่งเอกสาร': '',
          senderPhone: '',
          'โทรศัพท์': '',
          senderEmail: '',
          'ที่อยู่อีเมล': '',
          mhesiNumber: '',
          agency: '',
          docNumber: '',
          docType: '',
          receiveDate: nowStr,
          tableDate: nowStr,
          autoDesk: '',
          finalDesk: '',
          remarks: ''
        };

        try {
          if (activeTab === 6) {
            const sbRes = await lookupBarcodeForReturnInSupabase(barcode);
            if (sbRes.found && sbRes.data) {
              return {
                barcode,
                uuid: sbRes.id || uuid,
                nowTimestamp,
                baseRecord,
                isTab6: true,
                datainputRes: { found: true, data: sbRes.data, rowIndex: 1 },
              };
            }
            return {
              barcode,
              uuid,
              nowTimestamp,
              baseRecord,
              isTab6: true,
              datainputRes: { found: false, errorReason: sbRes.errorReason },
            };
          }
          if (activeTab === 5) {
            return { barcode, uuid, nowTimestamp, baseRecord, isTab5: true };
          }
          if (activeTab === 2) {
            const sbRes = await lookupBarcodeInSupabase(barcode);
            if (sbRes.found && sbRes.data) {
              return { barcode, uuid, nowTimestamp, baseRecord, foundInInput: true, inputData: sbRes.data };
            }
            const clRes = await lookupBarcodeInChecklists(barcode);
            if (clRes.found && clRes.data) {
              return { barcode, uuid, nowTimestamp, baseRecord, res: clRes };
            }
            return { barcode, uuid, nowTimestamp, baseRecord, res: { found: false } };
          }

          // Tabs 1, 3, 4:
          const clRes = await lookupBarcodeInChecklists(barcode);
          if (clRes.found && clRes.data) {
            return { barcode, uuid, nowTimestamp, baseRecord, res: clRes };
          }
          const sbRes = await lookupBarcodeInSupabase(barcode);
          if (sbRes.found && sbRes.data) {
            return { barcode, uuid, nowTimestamp, baseRecord, foundInInput: true, inputData: sbRes.data };
          }
          return { barcode, uuid, nowTimestamp, baseRecord, res: { found: false } };
        } catch (err: any) {
          return { barcode, uuid, nowTimestamp, baseRecord, error: err.message || 'เกิดข้อผิดพลาด' };
        }
      })
    );

    // 2. Sequential In-Memory Desk Assignment & Scan Item Building
    let runningDeskNum = getEffectiveLastDeskNum();
    const tab6MissingBarcodes: string[] = [];

    for (const item of lookupResults) {
      const { barcode, uuid, nowTimestamp, baseRecord } = item;

      if (item.error) {
        newScans.push({
          id: uuid,
          createdAt: nowTimestamp,
          tabId: activeTab,
          barcode,
          foundInGenerate: false,
          isLoading: false,
          error: item.error,
          data: baseRecord
        });
        continue;
      }

      if (item.isTab6) {
        const datainputRes = item.datainputRes!;
        if (datainputRes.found && datainputRes.data) {
          const sName = datainputRes.data.senderName || datainputRes.data['ผู้ส่งเอกสาร'] || '';
          const sPhone = datainputRes.data.senderPhone || datainputRes.data['โทรศัพท์'] || '';
          const sEmail = datainputRes.data.senderEmail || datainputRes.data['ที่อยู่อีเมล'] || '';
          newScans.push({
            id: uuid,
            createdAt: nowTimestamp,
            tabId: activeTab,
            barcode,
            foundInGenerate: true,
            foundInDataInput: true,
            dataInputRowIndex: 1,
            isLoading: false,
            data: {
              ...datainputRes.data,
              noType: 'O',
              type: datainputRes.data.type || currentTabName,
              TYPE: datainputRes.data.type || currentTabName,
              senderName: sName,
              'ผู้ส่งเอกสาร': sName,
              senderPhone: sPhone,
              'โทรศัพท์': sPhone,
              senderEmail: sEmail,
              'ที่อยู่อีเมล': sEmail,
              returnStatus: datainputRes.data.returnStatus || (dropdownConfig.returnStatuses && dropdownConfig.returnStatuses[0]) || 'ติดต่อรับคืน',
              returnDate: datainputRes.data.returnDate || nowStr,
            }
          });
        } else {
          // ไม่พบประวัติการรับเอกสารจากหน้า 1-5: ห้ามนำรายการนั้นเพิ่มเข้าตารางรอตรวจสอบเด็ดขาด
          tab6MissingBarcodes.push(barcode);
        }
        continue;
      }

      if (item.isTab5) {
        let autoDesk = 'กรอกมือระบุเอง';
        if (activeTab === 1) {
          const combined = [...newScans, ...scannedItems];
          autoDesk = getNextDeskProvider(combined, lastDeskNumRef, inactiveProviders);
        }
        newScans.push({
          id: uuid,
          createdAt: nowTimestamp,
          tabId: activeTab,
          barcode,
          foundInGenerate: false,
          isLoading: false,
          data: {
            ...baseRecord,
            noType: activeTab === 1 ? 'N' : 'O',
            type: currentTabName,
            TYPE: currentTabName,
            autoDesk: autoDesk,
            finalDesk: autoDesk,
          }
        });
        continue;
      }

      const res = item.res;
      const foundInInput = item.foundInInput;
      const inputData = item.inputData;

      if (res && res.found && res.data) {
        let autoDesk = '';

        if (activeTab === 1) {
          const combined = [...newScans, ...scannedItems];
          autoDesk = getNextDeskProvider(combined, lastDeskNumRef, inactiveProviders);
        } else if (activeTab === 4) {
          autoDesk = 'งานเบิกจ่ายเงิน';
        } else if (activeTab === 3) {
          autoDesk = getDeskByDocType(res.data.docType || '');
          if (!autoDesk) {
            autoDesk = normalizeProviderDesk(res.data.autoDesk || '') || 'กรอกมือระบุเอง';
          }
        } else {
          autoDesk = normalizeProviderDesk(res.data.autoDesk || '');
          if (!autoDesk) {
            autoDesk = 'กรอกมือระบุเอง';
          }
        }

        const sName = res.data.senderName || res.data['ผู้ส่งเอกสาร'] || '';
        const sPhone = res.data.senderPhone || res.data['โทรศัพท์'] || '';
        const sEmail = res.data.senderEmail || res.data['ที่อยู่อีเมล'] || '';

        newScans.push({
          id: uuid,
          createdAt: nowTimestamp,
          tabId: activeTab,
          barcode,
          foundInGenerate: true,
          isLoading: false,
          data: {
            ...baseRecord,
            noType: activeTab === 1 ? 'N' : activeTab === 2 ? 'O' : (res.data.noType || baseRecord.noType),
            type: currentTabName,
            TYPE: currentTabName,
            ep: res.data.ep || '',
            senderName: sName,
            'ผู้ส่งเอกสาร': sName,
            senderPhone: sPhone,
            'โทรศัพท์': sPhone,
            senderEmail: sEmail,
            'ที่อยู่อีเมล': sEmail,
            mhesiNumber: res.data.mhesiNumber || '',
            agency: res.data.agency || '',
            docNumber: res.data.docNumber || '',
            docType: res.data.docType || '',
            autoDesk: autoDesk,
            finalDesk: autoDesk,
          }
        });
      } else if (foundInInput && inputData) {
        let autoDesk = '';
        if (activeTab === 4) {
          autoDesk = 'งานเบิกจ่ายเงิน';
        } else if (activeTab === 3) {
          autoDesk = getDeskByDocType(inputData.docType || '');
          if (!autoDesk) {
            autoDesk = normalizeProviderDesk(inputData.finalDesk || inputData.autoDesk || '') || 'กรอกมือระบุเอง';
          }
        } else {
          autoDesk = normalizeProviderDesk(inputData.finalDesk || inputData.autoDesk || '');
          if (!autoDesk) {
            autoDesk = 'กรอกมือระบุเอง';
          }
        }

        const sName = inputData.senderName || inputData['ผู้ส่งเอกสาร'] || '';
        const sPhone = inputData.senderPhone || inputData['โทรศัพท์'] || '';
        const sEmail = inputData.senderEmail || inputData['ที่อยู่อีเมล'] || '';

        newScans.push({
          id: uuid,
          createdAt: nowTimestamp,
          tabId: activeTab,
          barcode,
          foundInGenerate: false,
          foundInDataInput: true,
          isLoading: false,
          data: {
            ...baseRecord,
            noType: activeTab === 1 ? 'N' : activeTab === 2 ? 'O' : (inputData.noType || baseRecord.noType),
            type: inputData.type || currentTabName,
            TYPE: inputData.type || currentTabName,
            ep: inputData.ep || '',
            senderName: sName,
            'ผู้ส่งเอกสาร': sName,
            senderPhone: sPhone,
            'โทรศัพท์': sPhone,
            senderEmail: sEmail,
            'ที่อยู่อีเมล': sEmail,
            mhesiNumber: inputData.mhesiNumber || '',
            agency: inputData.agency || '',
            docNumber: inputData.docNumber || '',
            docType: inputData.docType || '',
            autoDesk: autoDesk,
            finalDesk: autoDesk,
            remarks: inputData.remarks || '',
          }
        });
      } else {
        let autoDesk = '';
        if (activeTab === 1) {
          const combined = [...newScans, ...scannedItems];
          autoDesk = getNextDeskProvider(combined, lastDeskNumRef, inactiveProviders);
        } else if (activeTab === 4) {
          autoDesk = 'งานเบิกจ่ายเงิน';
        } else {
          autoDesk = 'กรอกมือระบุเอง';
        }

        newScans.push({
          id: uuid,
          createdAt: nowTimestamp,
          tabId: activeTab,
          barcode,
          foundInGenerate: false,
          isLoading: false,
          data: {
            ...baseRecord,
            noType: activeTab === 1 ? 'N' : activeTab === 2 ? 'O' : 'N',
            type: currentTabName,
            TYPE: currentTabName,
            autoDesk: autoDesk,
            finalDesk: autoDesk,
            remarks: ''
          }
        });
      }
    }

    const validAppends = newScans.filter(s => Boolean(s.barcode) && !s.error);
    const notFoundCount = newScans.filter(s => !s.foundInGenerate && !s.foundInDataInput && s.error).length;

    try {
      if (activeTab === 6) {
        if (tab6MissingBarcodes.length > 0) {
          const missingStr = tab6MissingBarcodes.join(', ');
          setAlertModal({
            isOpen: true,
            title: 'ไม่พบข้อมูลการรับเอกสารในระบบ',
            message: `ไม่พบข้อมูลการรับเอกสารในระบบ (กรุณาบันทึกรับเอกสารในหน้า 1-5 ก่อนทำการส่งคืน)\nสำหรับเลขทะเบียนรับ: ${missingStr}`,
            type: 'warning',
          });
          showToast('error', 'ไม่พบข้อมูลการรับเอกสารในระบบ (กรุณาบันทึกรับเอกสารในหน้า 1-5 ก่อนทำการส่งคืน)');
        }

        let updateCount = 0;
        for (const scan of newScans) {
          if (scan.barcode && scan.id) {
            const finalType = scan.data.type || getTabTypeName(scan.tabId || activeTab);
            const finalRecord: DocumentRecord = {
              ...scan.data,
              noType: 'O',
              type: finalType,
              TYPE: finalType,
              senderName: scan.data.senderName || scan.data['ผู้ส่งเอกสาร'] || '',
              'ผู้ส่งเอกสาร': scan.data.senderName || scan.data['ผู้ส่งเอกสาร'] || '',
              senderPhone: scan.data.senderPhone || scan.data['โทรศัพท์'] || '',
              'โทรศัพท์': scan.data.senderPhone || scan.data['โทรศัพท์'] || '',
              senderEmail: scan.data.senderEmail || scan.data['ที่อยู่อีเมล'] || '',
              'ที่อยู่อีเมล': scan.data.senderEmail || scan.data['ที่อยู่อีเมล'] || '',
              tableDate: scan.data.tableDate || nowStr,
              returnStatus: scan.data.returnStatus || (dropdownConfig.returnStatuses && dropdownConfig.returnStatuses[0]) || 'ติดต่อรับคืน',
              returnDate: scan.data.returnDate || nowStr,
            };
            const updateRes = await updateDocumentByIdInSupabase(scan.id, finalRecord);
            if (!updateRes.success) {
              throw new Error(updateRes.error || `อัปเดตสถานะส่งคืนสำหรับ ${scan.barcode} ไม่สำเร็จ`);
            }
            scan.data = finalRecord;
            updateCount++;
          }
        }
        if (updateCount > 0) {
          await fetchReceivedData();
          setBarcodes(['', '', '', '', '']);
          showToast('success', `บันทึกส่งคืนเอกสารเรียบร้อยแล้ว (${updateCount} รายการ)`);
        }
      } else if (validAppends.length > 0) {
        const finalRecords: DocumentRecord[] = validAppends.map(scan => {
          const finalNoType = activeTab === 1 ? 'N' : activeTab === 2 ? 'O' : (scan.data.noType || 'N');
          const finalType = scan.data.type || getTabTypeName(scan.tabId || activeTab);
          scan.data.noType = finalNoType;
          scan.data.type = finalType;
          scan.data.TYPE = finalType;
          return {
            ...scan.data,
            noType: finalNoType,
            type: finalType,
            TYPE: finalType,
            senderName: scan.data.senderName || scan.data['ผู้ส่งเอกสาร'] || '',
            'ผู้ส่งเอกสาร': scan.data.senderName || scan.data['ผู้ส่งเอกสาร'] || '',
            senderPhone: scan.data.senderPhone || scan.data['โทรศัพท์'] || '',
            'โทรศัพท์': scan.data.senderPhone || scan.data['โทรศัพท์'] || '',
            senderEmail: scan.data.senderEmail || scan.data['ที่อยู่อีเมล'] || '',
            'ที่อยู่อีเมล': scan.data.senderEmail || scan.data['ที่อยู่อีเมล'] || '',
            tableDate: scan.data.tableDate || nowStr,
            returnStatus: '',
            returnDate: '',
          };
        });

        // 1. AWAIT SAVE TO SUPABASE (Guaranteed Persistence)
        const sbRes = await insertDocumentsToSupabase(finalRecords);
        if (!sbRes.success) {
          throw new Error(sbRes.error || 'บันทึกลง Supabase ไม่สำเร็จ');
        }

        const isRoundRobinTab = activeTab === 1;
        if (isRoundRobinTab && finalRecords.length > 0) {
          const lastAssigned = [...finalRecords].reverse().find(r => {
            const name = r.finalDesk || r.overrideDesk || r.autoDesk;
            return name && findProviderIndex(name) !== -1;
          });
          if (lastAssigned) {
            const effectiveName = lastAssigned.finalDesk || lastAssigned.overrideDesk || lastAssigned.autoDesk;
            const idx = findProviderIndex(effectiveName);
            if (idx !== -1) {
              updateLastDeskNum(idx + 1);
            }
          }
        }

        // 2. Refresh state from Supabase to sync UI
        await fetchReceivedData();

        // 3. Reset form input ONLY AFTER Supabase responds successfully
        setBarcodes(['', '', '', '', '']);
        showToast('success', `บันทึกข้อมูลเรียบร้อยแล้ว (${finalRecords.length} รายการ)`);
      } else if (notFoundCount === activeBarcodes.length) {
        showToast('error', 'ไม่พบเลขทะเบียนรับนี้ในระบบ');
      }
    } catch (saveErr: any) {
      console.error('Supabase save error:', saveErr);
      showToast('error', `บันทึกข้อมูลลง Supabase ไม่สำเร็จ: ${saveErr.message || 'เกิดข้อผิดพลาด'}`);
      // Do NOT clear barcodes on error so user can retry without re-typing
    } finally {
      setIsSearching(false);
    }
  };

  // Change individual input value
  const handleInputChange = (idx: number, value: string) => {
    const updated = [...barcodes];
    updated[idx] = value;
    setBarcodes(updated);
  };

  // Load demo barcodes
  const handleLoadDemo = () => {
    setBarcodes(['66010001', '66010002', '66010003', '', '']);
    showToast('info', 'โหลดข้อมูลรหัสจำลองสำหรับทดสอบดึงข้อมูลแล้ว');
  };

  // Start edit item before saving
  const handleStartEdit = (idx: number) => {
    setEditingIndex(idx);
    const itemData = { ...scannedItems[idx].data };
    if (!itemData.tableDate) {
      itemData.tableDate = getThaiDateTimeString();
    }
    setEditingData(itemData);
    setOverrideSearch(itemData.overrideDesk && itemData.overrideDesk !== 'ไม่เลือก' ? itemData.overrideDesk : '');
    setIsOverrideDropdownOpen(false);
    setAgencySearch(itemData.agency || '');
    setIsAgencyDropdownOpen(false);
    setDocTypeSearch(itemData.docType || '');
    setIsDocTypeDropdownOpen(false);
    setReturnStatusSearch(itemData.returnStatus || '');
    setIsReturnStatusDropdownOpen(false);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditingData(null);
    setOverrideSearch('');
    setIsOverrideDropdownOpen(false);
    setAgencySearch('');
    setIsAgencyDropdownOpen(false);
    setDocTypeSearch('');
    setIsDocTypeDropdownOpen(false);
    setReturnStatusSearch('');
    setIsReturnStatusDropdownOpen(false);
  };

  // Open dedicated 8-field DocumentEditorModal
  const handleOpenDocumentEditor = (item: ScanItem, idx: number) => {
    if (currentUserRole === 'view') {
      showToast('error', 'คุณมีสิทธิ์ "เข้าดู" เท่านั้น (View Only) ไม่สามารถแก้ไขข้อมูลได้');
      return;
    }
    setModalEditItem({
      record: { ...item.data },
      id: item.id,
      index: idx,
    });
    setIsDocumentEditorOpen(true);
  };

  // Save handler for DocumentEditorModal (Updates Supabase 2570-ระบบติดตามเอกสาร immediately)
  const handleSaveFromDocumentEditor = async (updatedRecord: DocumentRecord, recordId?: string) => {
    if (currentUserRole === 'view') {
      showToast('error', 'คุณมีสิทธิ์ "เข้าดู" เท่านั้น (View Only) ไม่สามารถแก้ไขข้อมูลได้');
      return;
    }
    setIsSaving(true);
    try {
      // เฉพาะหน้า "1. ตรวจจ่าย-งานใหม่" และ "2. ตรวจจ่าย-งานเก่า": แมปเบอร์โทรศัพท์ประจำโต๊ะตามผู้ให้บริการ-final
      if (
        updatedRecord.type === '1. ตรวจจ่าย-งานใหม่' || updatedRecord.TYPE === '1. ตรวจจ่าย-งานใหม่' ||
        updatedRecord.type === '2. ตรวจจ่าย-งานเก่า' || updatedRecord.TYPE === '2. ตรวจจ่าย-งานเก่า'
      ) {
        const finalDeskName = updatedRecord.finalDesk || updatedRecord.overrideDesk || updatedRecord.autoDesk || '';
        const deskPhone = getDeskPhone(finalDeskName);
        if (deskPhone) {
          updatedRecord.senderPhone = deskPhone;
          updatedRecord['โทรศัพท์'] = deskPhone;
          (updatedRecord as any)['โทร.'] = deskPhone;
        }
      }

      const cleanId = String(recordId || '').trim();
      if (!cleanId || cleanId.startsWith('sb-') || cleanId.startsWith('item_')) {
        throw new Error('ไม่พบรหัสอ้างอิง (ID) ของเอกสารที่ต้องการแก้ไขใน Supabase กรุณารีเฟรชหน้าจอแล้วลองใหม่อีกครั้ง');
      }

      const sbRes = await updateDocumentByIdInSupabase(cleanId, updatedRecord);
      if (!sbRes.success) {
        throw new Error(sbRes.error || 'ไม่สามารถแก้ไขข้อมูลใน Supabase ได้');
      }

      // Re-fetch to ensure fresh data
      await fetchReceivedData();

      // Update next desk queue pointer if desk was changed manually (เฉพาะหน้างานใหม่)
      if (updatedRecord.type === '1. ตรวจจ่าย-งานใหม่' || updatedRecord.TYPE === '1. ตรวจจ่าย-งานใหม่') {
        const finalDeskName = updatedRecord.finalDesk || updatedRecord.overrideDesk || '';
        let newDeskNum = extractDeskNum(finalDeskName);
        if (!newDeskNum || newDeskNum < 1 || newDeskNum > 9) {
          const foundIdx = PROVIDER_DESKS.findIndex(d => d === finalDeskName || cleanNameForCompare(d) === cleanNameForCompare(finalDeskName));
          if (foundIdx !== -1) {
            newDeskNum = foundIdx + 1;
          }
        }
        if (newDeskNum >= 1 && newDeskNum <= 9) {
          updateLastDeskNum(newDeskNum);
        }
      }

      setIsDocumentEditorOpen(false);
      setModalEditItem(null);
      showToast('success', `บันทึกแก้ไขข้อมูลเอกสาร ${updatedRecord.barcode} ใน Supabase สำเร็จ`);
    } catch (err: any) {
      console.error('Error saving document edit:', err);
      showToast('error', `เกิดข้อผิดพลาดในการแก้ไข: ${err.message || 'ไม่สามารถติดต่อฐานข้อมูลได้'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Save handler for Tab 6: Document Return Pop-up Modal
  const handleSaveTab6Return = async () => {
    if (!tab6ReturnModal) return;
    const { docId, record, returnDate, returnStatus } = tab6ReturnModal;

    if (!docId) {
      showToast('error', 'ไม่พบรหัสอ้างอิง (ID) ของรายการนี้ในระบบ Supabase');
      return;
    }

    setTab6ReturnModal(prev => prev ? { ...prev, isSaving: true } : null);
    try {
      const nowFormatted = getIsoDateTimeString();
      const finalReturnDate = returnDate.trim() || nowFormatted;
      const finalReturnStatus = returnStatus.trim() || 'ติดต่อรับคืน';

      const updatedRecord: DocumentRecord = {
        ...record,
        type: '6. การส่งคืนเอกสาร',
        TYPE: '6. การส่งคืนเอกสาร',
        returnDate: finalReturnDate,
        returnStatus: finalReturnStatus,
        'วันที่ส่งคืน': finalReturnDate,
        'สถานะ_ธุรการส่งคืน': finalReturnStatus,
      };

      // 1. บันทึก/อัปเดตข้อมูลลงตาราง 2570-ระบบติดตามเอกสาร ใน Supabase ทันที (.eq('id', docId))
      const updateRes = await updateDocumentByIdInSupabase(docId, updatedRecord);
      if (!updateRes.success) {
        throw new Error(updateRes.error || 'ไม่สามารถอัปเดตข้อมูลส่งคืนใน Supabase ได้');
      }

      // 2. นำรายการที่บันทึกสำเร็จไปแสดงในตาราง "รายการที่ดึงมารอตรวจสอบ" ของหน้า 6 ทันที พร้อมเก็บค่า id จาก Supabase
      const scanItem: ScanItem = {
        id: docId,
        createdAt: Date.now(),
        tabId: 6,
        barcode: updatedRecord.barcode,
        foundInGenerate: true,
        foundInDataInput: true,
        dataInputRowIndex: 1,
        isLoading: false,
        data: updatedRecord,
      };

      setScannedItems(prev => [scanItem, ...prev.filter(item => item.id !== docId)]);
      setAllStatsRecords(prev => [
        { rowIndex: prev.length + 1, data: updatedRecord, id: docId } as any,
        ...prev.filter(r => (r as any).id !== docId),
      ]);

      // 3. Clear ช่องสแกนเลขทะเบียนรับเพื่อรอรับสแกนรายการถัดไป
      setBarcodes(['', '', '', '', '']);

      // 4. ปิด Pop-up Modal
      setTab6ReturnModal(null);

      showToast('success', `บันทึกส่งคืนเอกสาร "${updatedRecord.barcode}" (${finalReturnStatus}) เรียบร้อยแล้ว`);

      // 5. Sync ข้อมูลสถิติและประวัติจาก Supabase ใน background
      await fetchReceivedData();
    } catch (err: any) {
      console.error('Error saving tab 6 return:', err);
      showToast('error', `เกิดข้อผิดพลาดในการบันทึก: ${err.message || ''}`);
      setTab6ReturnModal(prev => prev ? { ...prev, isSaving: false } : null);
    }
  };

  const handleSaveEdit = async () => {
    if (editingIndex !== null && editingData) {
      setIsSaving(true);
      try {
        const override = editingData.overrideDesk;
        const finalDesk = override && override !== 'ไม่เลือก' ? override : editingData.autoDesk;
        
        const finalRecord: DocumentRecord = {
          ...editingData,
          finalDesk: finalDesk
        };

        // เฉพาะหน้า "1. ตรวจจ่าย-งานใหม่" และ "2. ตรวจจ่าย-งานเก่า": แมปเบอร์โทรศัพท์ประจำโต๊ะตามผู้ให้บริการ-final
        if (
          finalRecord.type === '1. ตรวจจ่าย-งานใหม่' || finalRecord.TYPE === '1. ตรวจจ่าย-งานใหม่' ||
          finalRecord.type === '2. ตรวจจ่าย-งานเก่า' || finalRecord.TYPE === '2. ตรวจจ่าย-งานเก่า'
        ) {
          const deskPhone = getDeskPhone(finalDesk);
          if (deskPhone) {
            finalRecord.senderPhone = deskPhone;
            finalRecord['โทรศัพท์'] = deskPhone;
            (finalRecord as any)['โทร.'] = deskPhone;
          }
        }

        const targetItem = scannedItems[editingIndex];
        const cleanId = String(targetItem?.id || '').trim();
        if (!cleanId || cleanId.startsWith('sb-') || cleanId.startsWith('item_')) {
          throw new Error('ไม่พบรหัสอ้างอิง (ID) ของเอกสารที่ต้องการแก้ไขใน Supabase กรุณารีเฟรชหน้าจอแล้วลองใหม่อีกครั้ง');
        }

        const res = await updateDocumentByIdInSupabase(cleanId, finalRecord);
        if (!res.success) {
          throw new Error(res.error || 'ไม่สามารถบันทึกข้อมูลลงฐานข้อมูลได้');
        }

        // เฉพาะหน้า "1. ตรวจจ่าย-งานใหม่": อัปเดต Queue Pointer เมื่อมีการเปลี่ยนโต๊ะ
        if (finalRecord.type === '1. ตรวจจ่าย-งานใหม่' || finalRecord.TYPE === '1. ตรวจจ่าย-งานใหม่') {
          const num = extractDeskNum(finalRecord.overrideDesk && finalRecord.overrideDesk !== 'ไม่เลือก' ? finalRecord.overrideDesk : finalRecord.finalDesk);
          if (num >= 1 && num <= 9) {
            updateLastDeskNum(num);
          }
        } else if (finalRecord.type !== '2. ตรวจจ่าย-งานเก่า' && finalRecord.TYPE !== '2. ตรวจจ่าย-งานเก่า') {
          const num = extractDeskNum(finalRecord.overrideDesk && finalRecord.overrideDesk !== 'ไม่เลือก' ? finalRecord.overrideDesk : finalRecord.finalDesk);
          if (num > 0) {
            updateLastDeskNum(num);
          }
        }

        await fetchReceivedData();

        setEditingIndex(null);
        setEditingData(null);
        setOverrideSearch('');
        setIsOverrideDropdownOpen(false);
        setAgencySearch('');
        setIsAgencyDropdownOpen(false);
        setDocTypeSearch('');
        setIsDocTypeDropdownOpen(false);
        setReturnStatusSearch('');
        setIsReturnStatusDropdownOpen(false);
        showToast('success', 'แก้ไขข้อมูลรายการเรียบร้อยแล้ว');
      } catch (err: any) {
        showToast('error', `แก้ไขข้อมูลไม่สำเร็จ: ${err.message || ''}`);
      } finally {
        setIsSaving(false);
      }
    }
  };

  // Remove individual scan item with Confirm Dialog, strict Supabase deletion, and refetch
  const handleRemoveItem = async (idx: number) => {
    const itemToRemove = scannedItems[idx];
    if (!itemToRemove) return;

    const targetBarcode = itemToRemove.barcode || itemToRemove.data?.barcode;

    // 1. Confirm Dialog
    const confirmed = window.confirm(`คุณต้องการลบรายการเลขทะเบียนรับ "${targetBarcode}" จากระบบและ Supabase หรือไม่?`);
    if (!confirmed) return;

    setIsLoadingStats(true);
    try {
      const cleanId = String(itemToRemove.id || '').trim();
      if (!cleanId || cleanId.startsWith('sb-') || cleanId.startsWith('item_')) {
        throw new Error('ไม่พบรหัสอ้างอิง (ID) ของรายการนี้ในระบบ ไม่สามารถลบได้');
      }

      const deleteRes = await deleteDocumentFromSupabase(cleanId);
      if (!deleteRes.success || deleteRes.error) {
        throw new Error(deleteRes.error || 'ไม่สามารถลบข้อมูลจาก Supabase ได้');
      }

      await fetchReceivedData();

      showToast('success', `ลบรายการ "${targetBarcode}" จากตาราง 2570-ระบบติดตามเอกสาร เรียบร้อยแล้ว`);
    } catch (err: any) {
      console.error('Failed to delete item:', err);
      showToast('error', `ลบข้อมูลไม่สำเร็จ: ${err.message || ''}`);
      setIsLoadingStats(false);
    }
  };

  // Bulk Delete selected items from staged items table & Supabase strictly by ID
  const handleConfirmBulkDelete = async () => {
    if (currentUserRole === 'view') {
      showToast('error', 'คุณมีสิทธิ์ "เข้าดู" เท่านั้น (View Only) ไม่สามารถลบข้อมูลได้');
      setIsBulkDeleteConfirmOpen(false);
      return;
    }
    if (selectedStagedIds.length === 0) {
      setIsBulkDeleteConfirmOpen(false);
      return;
    }

    setIsDeleting(true);
    const targetIds = [...selectedStagedIds];
    try {
      let deletedCount = 0;
      for (const targetId of targetIds) {
        const cleanId = String(targetId || '').trim();
        if (cleanId && !cleanId.startsWith('sb-') && !cleanId.startsWith('item_')) {
          await deleteDocumentFromSupabase(cleanId);
          deletedCount++;
        }
      }

      // Optimistic update state: remove from scannedItems & allStatsRecords strictly by id
      setScannedItems(prev => prev.filter(item => !targetIds.includes(item.id)));
      setAllStatsRecords(prev => prev.filter(item => !targetIds.includes(item.id)));
      setSelectedStagedIds([]);
      setIsBulkDeleteConfirmOpen(false);

      await fetchReceivedData();
      showToast('success', `ลบรายการที่เลือก (${targetIds.length} รายการ) เรียบร้อยแล้ว`);
    } catch (err: any) {
      console.error('Failed to bulk delete items:', err);
      showToast('error', `ลบรายการที่เลือกไม่สำเร็จ: ${err.message || ''}`);
    } finally {
      setIsDeleting(false);
      setIsBulkDeleteConfirmOpen(false);
    }
  };

  // Save to Google Sheet Action (Instant 0.1s Non-blocking UI)
  const handleSaveToSheet = async () => {
    if (currentUserRole === 'view') {
      showToast('error', 'คุณมีสิทธิ์ "เข้าดู" เท่านั้น (View Only) ไม่สามารถบันทึกหรือเพิ่มข้อมูลลงระบบได้');
      return;
    }
    if (!accessToken) {
      showToast('error', 'กรุณาเข้าสู่ระบบ Google Account ก่อนบันทึกข้อมูล');
      return;
    }

    const now = Date.now();
    if (now - lastSubmitTimeRef.current < 500) {
      console.warn('Blocked rapid double submit in handleSaveToSheet');
      return;
    }
    lastSubmitTimeRef.current = now;

    if (scannedItems.length === 0) {
      showToast('error', 'ไม่มีข้อมูลให้ทำรายการบันทึก');
      return;
    }

    const nowStr = getThaiDateTimeString();

    if (activeTab === 6) {
      const invalidItems = scannedItems.filter(item => !item.foundInDataInput || !item.dataInputRowIndex);
      if (invalidItems.length > 0) {
        showToast('error', 'กรุณาลบรายการที่ไม่พบประวัติการรับเอกสารออกก่อนทำการบันทึกส่งคืน');
        setSaveError('พบรายการที่ไม่สามารถบันทึกส่งคืนได้เนื่องจากไม่มีประวัติการรับในระบบ');
        return;
      }
    }

    setIsSaving(true);
    setSaveError(null);
    try {
      const itemsToProcess = [...scannedItems];
      const updates = itemsToProcess.filter(item => item.foundInDataInput && item.dataInputRowIndex);
      const appends = itemsToProcess.filter(item => !item.foundInDataInput || !item.dataInputRowIndex);

      if (updates.length > 0) {
        // 1. Update in Supabase
        const updateResults = await Promise.all(
          updates.map(item => {
            const isReturnTab = activeTab === 6;
            const finalType = item.data.type || getTabTypeName(item.tabId || activeTab);
            const finalRecord: DocumentRecord = {
              ...item.data,
              noType: activeTab === 1 ? 'N' : activeTab === 2 ? 'O' : (item.data.noType || 'N'),
              type: finalType,
              TYPE: finalType,
              senderName: item.data.senderName || item.data['ผู้ส่งเอกสาร'] || '',
              'ผู้ส่งเอกสาร': item.data.senderName || item.data['ผู้ส่งเอกสาร'] || '',
              senderPhone: item.data.senderPhone || item.data['โทรศัพท์'] || '',
              'โทรศัพท์': item.data.senderPhone || item.data['โทรศัพท์'] || '',
              senderEmail: item.data.senderEmail || item.data['ที่อยู่อีเมล'] || '',
              'ที่อยู่อีเมล': item.data.senderEmail || item.data['ที่อยู่อีเมล'] || '',
              tableDate: item.data.tableDate || nowStr,
              returnStatus: isReturnTab ? (item.data.returnStatus || '') : (item.data.returnStatus || ''),
              returnDate: isReturnTab ? (item.data.returnDate || (item.data.returnStatus ? nowStr : '')) : '',
            };
            return updateDocumentByIdInSupabase(item.id, finalRecord);
          })
        );
        const fail = updateResults.find(r => !r.success);
        if (fail) {
          throw new Error(fail.error || 'อัปเดตข้อมูลบางรายการไม่สำเร็จ');
        }
      }

      if (appends.length > 0) {
        const isReturnTab = activeTab === 6;
        const finalAppends: DocumentRecord[] = appends.map(item => {
          const finalType = item.data.type || getTabTypeName(item.tabId || activeTab);
          return {
            ...item.data,
            noType: activeTab === 1 ? 'N' : activeTab === 2 ? 'O' : (item.data.noType || 'N'),
            type: finalType,
            TYPE: finalType,
            senderName: item.data.senderName || item.data['ผู้ส่งเอกสาร'] || '',
            'ผู้ส่งเอกสาร': item.data.senderName || item.data['ผู้ส่งเอกสาร'] || '',
            senderPhone: item.data.senderPhone || item.data['โทรศัพท์'] || '',
            'โทรศัพท์': item.data.senderPhone || item.data['โทรศัพท์'] || '',
            senderEmail: item.data.senderEmail || item.data['ที่อยู่อีเมล'] || '',
            'ที่อยู่อีเมล': item.data.senderEmail || item.data['ที่อยู่อีเมล'] || '',
            tableDate: item.data.tableDate || nowStr,
            returnStatus: isReturnTab ? (item.data.returnStatus || '') : '',
            returnDate: isReturnTab ? (item.data.returnDate || (item.data.returnStatus ? nowStr : '')) : '',
          };
        });

        // 1. Insert into Supabase (Guaranteed Persistence)
        const sbRes = await insertDocumentsToSupabase(finalAppends);
        if (!sbRes.success) {
          throw new Error(sbRes.error || 'บันทึกลง Supabase ไม่สำเร็จ');
        }

        const isRoundRobinTab = activeTab === 1 || activeTab === 5;
        if (isRoundRobinTab && finalAppends.length > 0) {
          const lastAssigned = [...finalAppends].reverse().find(r => findProviderIndex(r.autoDesk) !== -1);
          if (lastAssigned) {
            const idx = findProviderIndex(lastAssigned.autoDesk);
            if (idx !== -1) {
              updateLastDeskNum(idx + 1);
            }
          }
        }
      }

      // 2. Re-fetch from Supabase to sync UI stats & table
      await fetchReceivedData();

      // 3. Clear items ONLY AFTER Supabase operations succeeded
      setScannedItems([]);
      setSaveSuccess('บันทึกข้อมูลเรียบร้อยแล้ว');
      showToast('success', 'บันทึกข้อมูลเรียบร้อยแล้ว');
    } catch (err: any) {
      console.error('Save to Supabase error:', err);
      setSaveError(err.message || 'การบันทึกข้อมูลล้มเหลว');
      showToast('error', `การบันทึกฐานข้อมูลล้มเหลว: ${err.message || 'เกิดข้อผิดพลาด'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Login handler
  const handleGoogleLogin = async () => {
    try {
      setIsLoadingAuth(true);
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setAccessToken(res.accessToken);
        showToast('success', 'ลงชื่อเข้าใช้งานด้วยบัญชี Google สำเร็จ');
        await verifyAndLoadConfig(res.accessToken);
      }
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
        return;
      }
      console.error(err);
      showToast('error', `ล็อกอินล้มเหลว: ${err.message || 'กรุณาลองใหม่อีกครั้ง'}`);
    } finally {
      setIsLoadingAuth(false);
    }
  };

  // Logout handler
  const handleGoogleLogout = async () => {
    try {
      await logout();
      setUser(null);
      setAccessToken(null);
      setScannedItems([]);
      showToast('info', 'ออกจากระบบแล้ว');
    } catch (err: any) {
      console.error(err);
    }
  };

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col items-center justify-center antialiased">
        <div className="flex flex-col items-center gap-4 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center max-w-md w-full mx-4">
          <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center">
            <RefreshCw className="w-7 h-7 animate-spin" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 font-display">กำลังตรวจสอบสิทธิ์การเข้าใช้งาน</h2>
            <p className="text-xs text-slate-500 mt-1 font-mono">กำลังเชื่อมต่อระบบรักษาความปลอดภัยและการยืนยันตัวตน...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#f1f5f9] font-sans text-slate-800 flex flex-col justify-between items-center py-6 sm:py-10 px-4 antialiased relative">
        {/* TOAST SYSTEM */}
        <AnimatePresence>
          {toastMessage && (
            <div className="fixed top-6 right-4 z-50">
              <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border text-sm font-medium ${
                  toastMessage.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : toastMessage.type === 'error'
                    ? 'bg-rose-50 border-rose-200 text-rose-800'
                    : 'bg-blue-50 border-blue-200 text-blue-800'
                }`}
              >
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{toastMessage.text}</span>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Main Login Card - Scaled Up 200% with Official MFU Logo */}
        <main className="w-full flex-1 flex items-center justify-center py-6 sm:py-10">
          <div className="w-full max-w-[760px] bg-white rounded-3xl sm:rounded-[36px] shadow-2xl overflow-hidden border border-slate-200/80 flex flex-col my-auto transition-all">
            {/* Top Deep Green Banner */}
            <div className="bg-[#064e3b] px-8 sm:px-14 pt-12 pb-10 text-center flex flex-col items-center justify-center relative overflow-hidden">
              {/* Subtle ambient light glow behind logo */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-56 bg-emerald-400/15 blur-3xl rounded-full pointer-events-none" />

              {/* MFU Official Emblem Logo */}
              <div className="mb-4 z-10 flex items-center justify-center">
                <img
                  src="/MFU_logo.png"
                  alt="ตราสัญลักษณ์ มหาวิทยาลัยแม่ฟ้าหลวง"
                  className="h-32 sm:h-44 w-auto object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.45)] hover:scale-105 transition-transform duration-300"
                  onError={(e) => {
                    e.currentTarget.src = "https://upload.wikimedia.org/wikipedia/th/d/da/%E0%B8%AA%E0%B8%B1%E0%B8%8D%E0%B8%A5%E0%B8%B1%E0%B8%81%E0%B8%A9%E0%B8%93%E0%B9%8C%E0%B8%9B%E0%B8%A3%E0%B8%B0%E0%B8%88%E0%B8%B3%E0%B8%A1%E0%B8%AB%E0%B8%B2%E0%B8%A7%E0%B8%B4%E0%B8%97%E0%B8%A2%E0%B8%B2%E0%B8%A5%E0%B8%B1%E0%B8%A2%E0%B9%81%E0%B8%A1%E0%B9%88%E0%B8%9F%E0%B9%89%E0%B8%B2%E0%B8%AB%E0%B8%A5%E0%B8%A7%E0%B8%87.png";
                  }}
                />
              </div>

              {/* System Header in Golden Typography */}
              <h1 className="text-amber-300 font-extrabold text-2xl sm:text-3xl md:text-4xl tracking-wide font-display uppercase drop-shadow-sm z-10 mt-1">
                ระบบธุรการส่วนการเงินและบัญชี
              </h1>
              <p className="text-sm sm:text-lg font-medium text-amber-100/90 mt-2 z-10">
                ส่วนการเงินและบัญชี มหาวิทยาลัยแม่ฟ้าหลวง
              </p>
              <p className="text-[11px] sm:text-xs md:text-sm font-medium text-emerald-100/90 tracking-widest font-display uppercase mt-1.5 z-10">
                DIVISION OF FINANCE AND ACCOUNTING MAE FAH LUANG UNIVERSITY
              </p>

              {/* Login Title */}
              <h2 className="text-2xl sm:text-3xl font-bold text-white mt-7 tracking-tight z-10">
                เข้าสู่ระบบ / ลงทะเบียน
              </h2>
            </div>

            {/* White Body Section */}
            <div className="p-8 sm:p-12 flex flex-col items-center text-center">
              <h3 className="text-base sm:text-xl font-bold text-slate-800 mb-3 font-display">
                กรุณาลงทะเบียนหรือเข้าสู่ระบบด้วยอีเมล Google
              </h3>

              {/* Pill badge constraint */}
              <div className="inline-flex items-center px-5 py-1.5 rounded-full border border-emerald-300/80 bg-emerald-50 text-emerald-800 text-xs sm:text-sm font-semibold mb-8 shadow-2xs">
                กำหนดสิทธิ์ผู้ใช้งานต้องเป็นอีเมล @mfu.ac.th เท่านั้น
              </div>

              {/* Main Login Button */}
              <button
                id="landing-login-btn"
                onClick={handleGoogleLogin}
                disabled={isLoadingAuth}
                className="w-full flex items-center justify-center gap-3 bg-[#064e3b] hover:bg-[#053f30] active:bg-[#043327] text-white font-semibold text-base sm:text-lg py-4 px-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer disabled:opacity-60 group"
              >
                {isLoadingAuth ? (
                  <Loader2 className="w-6 h-6 animate-spin text-amber-300" />
                ) : (
                  <span className="text-amber-400 font-bold text-xl group-hover:translate-x-1 transition-transform">
                    ➔
                  </span>
                )}
                <span>ลงทะเบียนด้วยอีเมล Google (@mfu.ac.th)</span>
              </button>

              {/* Subtle Divider */}
              <div className="w-full border-t border-slate-100 my-8" />

              {/* Numbered Information Points */}
              <div className="w-full space-y-4 text-left">
                <div className="flex items-start gap-3.5">
                  <span className="w-7 h-7 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold text-xs sm:text-sm flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <span className="text-sm sm:text-base text-slate-600 leading-snug">
                    สำหรับการบันทึก คัดแยก และจ่ายงานเอกสารรับเข้า (Checklist)
                  </span>
                </div>
                <div className="flex items-start gap-3.5">
                  <span className="w-7 h-7 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold text-xs sm:text-sm flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <span className="text-sm sm:text-base text-slate-600 leading-snug">
                    ตรวจสอบประวัติและแก้ไขข้อมูลเอกสารย้อนหลัง
                  </span>
                </div>
                <div className="flex items-start gap-3.5">
                  <span className="w-7 h-7 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold text-xs sm:text-sm flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </span>
                  <span className="text-sm sm:text-base text-slate-700 font-medium leading-snug">
                    ติดปัญหาการใช้งาน โทร 6465 ทรงวุฒิ
                  </span>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="py-4 text-center text-[11px] sm:text-xs text-slate-400 font-sans tracking-wide">
          ส่วนการเงินและบัญชี มหาวิทยาลัยแม่ฟ้าหลวง DIVISION OF FINANCE AND ACCOUNTING MAE FAH LUANG UNIVERSITY
        </footer>
      </div>
    );
  }

  // If user is authenticated but not a Super Admin and permissions are still loading
  if (user && !isSuperAdminEmail(user.email) && isLoadingPermissions) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center font-sans transition-colors duration-300 ${
        isDarkMode ? 'bg-[#061612] text-slate-100' : 'bg-slate-50 text-slate-800'
      }`}>
        <div className="flex flex-col items-center gap-4 text-center p-6">
          <div className="w-16 h-16 rounded-2xl bg-emerald-600/10 border border-emerald-500/30 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          </div>
          <h2 className="text-lg font-bold font-display">กำลังตรวจสอบสิทธิ์การเข้าใช้งาน...</h2>
          <p className="text-xs text-slate-400 font-mono">{user.email}</p>
        </div>
      </div>
    );
  }

  // User is logged in, but not authorized by Super Admins
  if (user && !isSuperAdminEmail(user.email) && currentUserRole === 'none') {
    return (
      <div className={`min-h-screen flex flex-col font-sans transition-colors duration-300 ${
        isDarkMode ? 'bg-[#061612] text-slate-100' : 'bg-slate-50 text-slate-800'
      }`}>
        <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
          <div className="w-full max-w-lg">
            <div className={`rounded-3xl shadow-2xl border overflow-hidden transition-all ${
              isDarkMode ? 'bg-[#0a221b] border-emerald-500/30' : 'bg-white border-slate-200'
            }`}>
              {/* Top Banner */}
              <div className="bg-gradient-to-r from-amber-700 via-amber-600 to-amber-800 p-6 text-center text-white relative">
                <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center mx-auto mb-3 shadow-lg">
                  <Shield className="w-8 h-8 text-amber-300" />
                </div>
                <h2 className="text-xl font-bold font-display">
                  ยังไม่ได้รับสิทธิ์เข้าใช้งานระบบ
                </h2>
                <p className="text-xs text-amber-100/90 mt-1">
                  Access Pending Approval
                </p>
              </div>

              {/* Body */}
              <div className="p-6 sm:p-8 flex flex-col gap-5 text-center">
                {/* User Info Card */}
                <div className={`p-4 rounded-2xl border flex items-center gap-3.5 text-left ${
                  isDarkMode ? 'bg-[#071914] border-emerald-500/30' : 'bg-slate-50 border-slate-200'
                }`}>
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName || 'User'} className="w-12 h-12 rounded-full border border-emerald-500/40 object-cover shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-base shrink-0">
                      {user.displayName?.charAt(0) || 'U'}
                    </div>
                  )}
                  <div className="flex flex-col min-w-0">
                    <span className={`text-sm font-bold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      {user.displayName || 'ผู้ใช้งาน'}
                    </span>
                    <span className={`text-xs font-mono font-medium truncate ${isDarkMode ? 'text-amber-300' : 'text-amber-700'}`}>
                      {user.email}
                    </span>
                    <span className="text-[11px] text-rose-500 font-bold mt-0.5">
                      ● สถานะ: ยังไม่ได้รับการอนุมัติสิทธิ์ (เข้าดู / แก้ไข)
                    </span>
                  </div>
                </div>

                {/* ONLINE ACCESS REQUEST FORM */}
                <div className={`p-4 rounded-2xl border text-left flex flex-col gap-3 ${
                  isDarkMode ? 'bg-[#071914] border-emerald-500/40' : 'bg-emerald-50/50 border-emerald-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold font-display text-xs text-emerald-400">
                      <Send className="w-4 h-4" />
                      <span className={isDarkMode ? 'text-emerald-300' : 'text-emerald-800'}>
                        ส่งคำขอรับสิทธิ์เข้าใช้งานระบบ:
                      </span>
                    </div>
                    {myPermissionRequest && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40">
                        ส่งคำขอแล้ว ({myPermissionRequest.requestedRole === 'edit' ? 'แก้ไข' : 'เข้าดู'})
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className={`text-[11px] font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                      เลือกระดับสิทธิ์ที่ต้องการขอรับ:
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setRequestedRoleChoice('view')}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center gap-1 cursor-pointer ${
                          requestedRoleChoice === 'view'
                            ? isDarkMode
                              ? 'bg-sky-950 border-sky-400 text-sky-200 shadow-sm'
                              : 'bg-sky-100/80 border-sky-400 text-sky-800 shadow-xs'
                            : isDarkMode
                              ? 'bg-[#0f2e25]/50 border-emerald-500/20 text-slate-400 hover:text-slate-200'
                              : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        <Eye className="w-4 h-4 text-sky-400" />
                        <span>สิทธิ์เข้าดู (View)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setRequestedRoleChoice('edit')}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center gap-1 cursor-pointer ${
                          requestedRoleChoice === 'edit'
                            ? isDarkMode
                              ? 'bg-emerald-950 border-emerald-400 text-emerald-200 shadow-sm'
                              : 'bg-emerald-100/80 border-emerald-400 text-emerald-800 shadow-xs'
                            : isDarkMode
                              ? 'bg-[#0f2e25]/50 border-emerald-500/20 text-slate-400 hover:text-slate-200'
                              : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        <Pencil className="w-4 h-4 text-emerald-400" />
                        <span>สิทธิ์แก้ไข (Edit)</span>
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSendAccessRequest}
                    disabled={isSubmittingRequest}
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSubmittingRequest ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    <span>
                      {myPermissionRequest ? 'ส่งคำขอรับสิทธิ์อีกครั้ง' : '🚀 ส่งคำขอรับสิทธิ์ให้อนุมัติ'}
                    </span>
                  </button>
                </div>

                {/* CONTACT INFO CARD */}
                <div className={`p-4 rounded-xl border text-left flex flex-col gap-2.5 text-xs ${
                  isDarkMode ? 'bg-amber-950/20 border-amber-500/30 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}>
                  <div className="flex items-start gap-2 font-bold font-display">
                    <Phone className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span className="text-amber-300 font-bold">
                      กรุณาติดต่อ ทรงวุฒิ โทร 6465 เพื่อขอรับสิทธิการใช้งานระบบ
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 pl-6 text-[11px]">
                    <span className="font-semibold opacity-90">อีเมลผู้กำหนดสิทธิ์ (Super Admin):</span>
                    {SUPER_ADMIN_EMAILS.map((adminEmail, idx) => (
                      <span key={idx} className="font-mono font-bold">
                        • {adminEmail}
                      </span>
                    ))}
                  </div>
                  <div className="text-[11px] opacity-80 pt-1 border-t border-amber-500/20">
                    เมื่อได้รับการกำหนดสิทธิ์แล้ว ให้กดปุ่ม "ตรวจสอบสิทธิ์ใหม่" ด้านล่าง
                  </div>
                </div>

                {/* ACTION BUTTONS */}
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <button
                    type="button"
                    onClick={refreshPermissions}
                    className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>ตรวจสอบสิทธิ์ใหม่</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleGoogleLogout}
                    className={`w-full sm:flex-1 py-3 px-4 rounded-xl border font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer ${
                      isDarkMode ? 'border-emerald-500/30 hover:bg-rose-950/40 text-rose-300' : 'border-slate-200 hover:bg-rose-50 text-rose-600'
                    }`}
                  >
                    <LogOut className="w-4 h-4" />
                    <span>ออกจากระบบ</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>

        <footer className="py-4 text-center text-[11px] sm:text-xs text-slate-400 font-sans tracking-wide">
          ส่วนการเงินและบัญชี มหาวิทยาลัยแม่ฟ้าหลวง DIVISION OF FINANCE AND ACCOUNTING MAE FAH LUANG UNIVERSITY
        </footer>
      </div>
    );
  }

  return (
    <div className={`min-h-screen font-sans flex flex-col antialiased transition-colors duration-300 ${
      isDarkMode ? 'bg-[#061612] text-slate-100' : 'bg-slate-50 text-slate-800'
    }`}>
      {/* PROFESSIONAL ADMIN HEADER */}
      <header className={`sticky top-0 z-40 print:hidden transition-colors duration-300 ${
        isDarkMode 
          ? 'bg-[#0a221b]/95 backdrop-blur-md border-b border-emerald-500/20 shadow-lg shadow-black/40' 
          : 'bg-white border-b border-slate-200 shadow-xs'
      }`}>
        <div className="max-w-[98%] mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative shrink-0 flex items-center justify-center p-1 bg-white/10 rounded-2xl border border-emerald-500/20 shadow-xs">
              <img
                src="/MFU_logo.png"
                alt="ตราสัญลักษณ์ มหาวิทยาลัยแม่ฟ้าหลวง"
                className="h-14 sm:h-16 w-auto object-contain drop-shadow-md hover:scale-105 transition-transform duration-300"
                onError={(e) => {
                  e.currentTarget.src = "https://upload.wikimedia.org/wikipedia/th/d/da/%E0%B8%AA%E0%B8%B1%E0%B8%8D%E0%B8%A5%E0%B8%B1%E0%B8%81%E0%B8%A9%E0%B8%93%E0%B9%8C%E0%B8%9B%E0%B8%A3%E0%B8%B0%E0%B8%88%E0%B8%B3%E0%B8%A1%E0%B8%AB%E0%B8%B2%E0%B8%A7%E0%B8%B4%E0%B8%97%E0%B8%A2%E0%B8%B2%E0%B8%A5%E0%B8%B1%E0%B8%A2%E0%B9%81%E0%B8%A1%E0%B9%88%E0%B8%9F%E0%B9%89%E0%B8%B2%E0%B8%AB%E0%B8%A5%E0%B8%A7%E0%B8%87.png";
                }}
              />
            </div>
            <div>
              <h1 className={`text-xl sm:text-2xl lg:text-3xl font-display font-black tracking-tight ${
                isDarkMode ? 'text-white' : 'text-slate-900'
              }`}>
                ระบบธุรการส่วนการเงินและบัญชี <span className="text-emerald-500 font-extrabold">(FA Central Admin)</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3.5 self-stretch sm:self-auto justify-end flex-wrap">


            {/* Settings Button */}
            <button
              type="button"
              id="settings-header-btn"
              onClick={() => setActiveTab(10)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer shadow-xs ${
                activeTab === 10
                  ? isDarkMode
                    ? 'bg-emerald-600 text-white border-emerald-500'
                    : 'bg-emerald-600 text-white border-emerald-700'
                  : isDarkMode
                  ? 'bg-[#0f2e25] border-emerald-500/50 text-emerald-300 hover:bg-[#153e32] hover:border-emerald-400'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100 hover:border-emerald-300'
              }`}
              title="ตั้งค่าระบบและจัดการสิทธิ์การเข้าใช้งาน"
            >
              <Settings className={`w-4 h-4 ${activeTab === 10 ? 'animate-spin' : 'text-emerald-500'}`} style={{ animationDuration: '8s' }} />
              <span>ตั้งค่าระบบ</span>
            </button>

            {/* Theme Toggle Button (Dark Emerald / Light) */}
            <button
              type="button"
              id="theme-toggle-btn"
              onClick={toggleTheme}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer shadow-xs ${
                isDarkMode
                  ? 'bg-[#0f2e25] border-emerald-500/50 text-emerald-300 hover:bg-[#153e32] hover:border-emerald-400'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100 hover:border-emerald-300'
              }`}
              title={isDarkMode ? "คลิกเพื่อสลับเป็นโหมดสว่าง" : "คลิกเพื่อสลับเป็นโหมดมืด (Dark Emerald)"}
            >
              {isDarkMode ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400 animate-spin" style={{ animationDuration: '10s' }} />
                  <span>โหมดสว่าง</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-emerald-700" />
                  <span>โหมดมืด</span>
                </>
              )}
            </button>

            {isLoadingAuth ? (
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>กำลังโหลดสิทธิ์...</span>
              </div>
            ) : user ? (
              <div className={`flex items-center gap-3 px-3 py-1.5 rounded-xl border ${
                isDarkMode ? 'bg-[#0f2e25] border-emerald-500/30' : 'bg-slate-100 border-slate-200'
              }`}>
                <div className="flex flex-col text-right">
                  <span className={`text-xs sm:text-sm font-bold ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>
                    {user.displayName || 'ผู้ใช้งาน'}
                  </span>
                  <span className={`text-[11px] truncate max-w-[150px] ${isDarkMode ? 'text-emerald-300/70' : 'text-slate-400'}`}>
                    {user.email}
                  </span>
                </div>
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || 'User'} referrerPolicy="no-referrer" className="w-9 h-9 rounded-full border border-emerald-500/40" />
                ) : (
                  <div className="w-9 h-9 bg-emerald-600 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-xs">
                    {user.displayName?.charAt(0) || 'U'}
                  </div>
                )}
                <button
                  id="logout-btn"
                  onClick={handleGoogleLogout}
                  title="ออกจากระบบ"
                  className="p-1 hover:text-red-400 text-slate-400 transition cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                id="login-btn"
                onClick={handleGoogleLogin}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-sm px-4 py-2.5 rounded-xl transition shadow-md shadow-emerald-700/20 cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>เข้าสู่ระบบด้วย Google Account</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* SUPABASE NOTICE BANNER */}
      {!supabaseStatus.tableExists && !supabaseStatus.checking && (
        <div className="bg-gradient-to-r from-amber-500/15 via-emerald-500/10 to-amber-500/15 border-b border-amber-500/30 px-4 py-2.5 text-xs sm:text-sm flex flex-col sm:flex-row items-center justify-between gap-2.5 text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <span>
              <strong>ฐานข้อมูล Supabase:</strong> เชื่อมต่อโปรเจกต์ <span className="font-mono font-bold">{SUPABASE_PROJECT_ID}</span> สำเร็จแล้ว แต่ยังไม่พบตาราง <code className="font-mono bg-amber-200/50 dark:bg-amber-900/50 px-1 py-0.5 rounded">documents</code>
            </span>
          </div>
          <button
            onClick={() => setIsSupabaseSqlModalOpen(true)}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-xs cursor-pointer flex items-center gap-1.5 shrink-0"
          >
            <span>คลิกดูคำสั่ง SQL และวิธีเปิดใช้งาน</span>
          </button>
        </div>
      )}

      {/* TOAST SYSTEM */}
      <AnimatePresence>
        {toastMessage && (
          <div className="fixed top-20 right-4 z-50">
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border text-sm font-medium ${
                toastMessage.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : toastMessage.type === 'error'
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : 'bg-blue-50 border-blue-200 text-blue-800'
              }`}
            >
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{toastMessage.text}</span>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <main className="flex-1 max-w-[98%] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6">
        
        {/* DASHBOARD STATISTICS OVERVIEW */}
        <div className={`rounded-2xl border p-6 flex flex-col gap-6 print:hidden transition-colors ${
          isDarkMode
            ? 'bg-[#0a221b] border-emerald-500/20 shadow-xl'
            : 'bg-white border-slate-200/80 shadow-xs'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-emerald-500/15">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-emerald-500/30 shrink-0">
                <Sliders className="w-6 h-6" />
              </div>
              <div>
                <h2 className={`text-xl sm:text-2xl font-bold font-display tracking-tight flex items-center gap-2 ${
                  isDarkMode ? 'text-white' : 'text-slate-900'
                }`}>
                  <span>สถิติการให้บริการ</span>
                </h2>
              </div>
            </div>
            
            <button
                type="button"
                onClick={() => loadDashboardStats()}
                disabled={isLoadingStats}
                className={`flex items-center justify-center gap-2 px-4 py-2.5 text-xs sm:text-sm transition-all rounded-xl font-bold font-display cursor-pointer shrink-0 border ${
                  isDarkMode
                    ? 'text-emerald-300 bg-[#0f2e25] border-emerald-500/40 hover:bg-[#153e32]'
                    : 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingStats ? 'animate-spin' : ''}`} />
                <span>รีเฟรชข้อมูล</span>
              </button>
          </div>

          {isLoadingStats ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 animate-pulse">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className={`h-36 rounded-2xl p-5 flex flex-col justify-between border ${
                  isDarkMode ? 'bg-[#071914] border-emerald-500/20' : 'bg-slate-50 border-slate-100'
                }`}>
                  <div className="h-4 bg-emerald-500/20 rounded w-1/3"></div>
                  <div className="h-10 bg-emerald-500/20 rounded w-1/2"></div>
                  <div className="h-4 bg-emerald-500/20 rounded w-2/3"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* Card 1: รับเอกสารวันนี้ */}
              <div 
                onClick={() => { setSelectedStatsTab('today'); setStatsSearchQuery(''); }}
                className={`p-6 rounded-2xl border shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-xl cursor-pointer active:scale-[0.98] hover:-translate-y-1 transition-all duration-200 ${
                  isDarkMode
                    ? 'bg-gradient-to-br from-[#0c2821] to-[#071914] border-emerald-500/30 hover:border-emerald-400/60'
                    : 'bg-gradient-to-br from-emerald-50/90 to-teal-50/40 border-emerald-200/90'
                }`}
              >
                <div className="flex items-start justify-between z-10">
                  <span className={`text-xs sm:text-sm font-bold font-display uppercase tracking-wider ${
                    isDarkMode ? 'text-emerald-300' : 'text-slate-600'
                  }`}>
                    รับเอกสารวันนี้ (TODAY)
                  </span>
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30 group-hover:scale-110 transition-transform">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                </div>
                
                <div className="flex items-baseline gap-2 mt-4 z-10">
                  <span className={`text-4xl sm:text-5xl font-black font-sans tracking-tight ${
                    isDarkMode ? 'text-white' : 'text-emerald-900'
                  }`}>
                    {stats.today.toLocaleString('th-TH')}
                  </span>
                  <span className="text-sm font-bold text-emerald-500">รายการ</span>
                </div>

                <div className={`mt-5 pt-3 border-t text-xs font-mono flex justify-between items-center z-10 ${
                  isDarkMode ? 'border-emerald-500/20 text-emerald-200/60' : 'border-emerald-200/60 text-slate-500'
                }`}>
                  <span>ประจำวันที่: {new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}</span>
                  <span className="text-emerald-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity font-sans">
                    ดูข้อมูล ↗
                  </span>
                </div>
              </div>

              {/* Card 2: รับเอกสารเดือนนี้ */}
              <div 
                onClick={() => { setSelectedStatsTab('month'); setStatsSearchQuery(''); }}
                className={`p-6 rounded-2xl border shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-xl cursor-pointer active:scale-[0.98] hover:-translate-y-1 transition-all duration-200 ${
                  isDarkMode
                    ? 'bg-gradient-to-br from-[#0a232c] to-[#06171d] border-cyan-500/30 hover:border-cyan-400/60'
                    : 'bg-gradient-to-br from-cyan-50/90 to-blue-50/40 border-cyan-200/90'
                }`}
              >
                <div className="flex items-start justify-between z-10">
                  <span className={`text-xs sm:text-sm font-bold font-display uppercase tracking-wider ${
                    isDarkMode ? 'text-cyan-300' : 'text-slate-600'
                  }`}>
                    รับเอกสารเดือนนี้ (MONTH)
                  </span>
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/30 group-hover:scale-110 transition-transform">
                    <Calendar className="w-6 h-6" />
                  </div>
                </div>

                <div className="flex items-baseline gap-2 mt-4 z-10">
                  <span className={`text-4xl sm:text-5xl font-black font-sans tracking-tight ${
                    isDarkMode ? 'text-white' : 'text-cyan-950'
                  }`}>
                    {stats.month.toLocaleString('th-TH')}
                  </span>
                  <span className="text-sm font-bold text-cyan-500">รายการ</span>
                </div>

                <div className={`mt-5 pt-3 border-t text-xs font-mono flex justify-between items-center z-10 ${
                  isDarkMode ? 'border-cyan-500/20 text-cyan-200/60' : 'border-cyan-200/60 text-slate-500'
                }`}>
                  <span>ประจำเดือน: {new Date().toLocaleDateString('th-TH', { month: 'short', year: '2-digit' })}</span>
                  <span className="text-cyan-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity font-sans">
                    ดูข้อมูล ↗
                  </span>
                </div>
              </div>

              {/* Card 3: รับเอกสารทั้งหมด */}
              <div 
                onClick={() => { setSelectedStatsTab('total'); setStatsSearchQuery(''); }}
                className={`p-6 rounded-2xl border shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-xl cursor-pointer active:scale-[0.98] hover:-translate-y-1 transition-all duration-200 ${
                  isDarkMode
                    ? 'bg-gradient-to-br from-[#291e0a] to-[#1a1306] border-amber-500/30 hover:border-amber-400/60'
                    : 'bg-gradient-to-br from-amber-50/90 to-orange-50/40 border-amber-200/90'
                }`}
              >
                <div className="flex items-start justify-between z-10">
                  <span className={`text-xs sm:text-sm font-bold font-display uppercase tracking-wider ${
                    isDarkMode ? 'text-amber-300' : 'text-slate-600'
                  }`}>
                    รับเอกสารทั้งหมด (TOTAL)
                  </span>
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-lg shadow-amber-500/30 group-hover:scale-110 transition-transform">
                    <Database className="w-6 h-6" />
                  </div>
                </div>

                <div className="flex items-baseline gap-2 mt-4 z-10">
                  <span className={`text-4xl sm:text-5xl font-black font-sans tracking-tight ${
                    isDarkMode ? 'text-white' : 'text-amber-950'
                  }`}>
                    {stats.total.toLocaleString('th-TH')}
                  </span>
                  <span className="text-sm font-bold text-amber-500">รายการ</span>
                </div>

                <div className={`mt-5 pt-3 border-t text-xs font-mono flex justify-between items-center z-10 ${
                  isDarkMode ? 'border-amber-500/20 text-amber-200/60' : 'border-amber-200/60 text-slate-500'
                }`}>
                  <span>ตาราง 2570-ระบบติดตามเอกสาร</span>
                  <span className="text-amber-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity font-sans">
                    ดูข้อมูล ↗
                  </span>
                </div>
              </div>

              {/* Card 4: ส่งคืนเอกสาร */}
              <div 
                onClick={() => { setSelectedStatsTab('returned'); setStatsSearchQuery(''); }}
                className={`p-6 rounded-2xl border shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-xl cursor-pointer active:scale-[0.98] hover:-translate-y-1 transition-all duration-200 ${
                  isDarkMode
                    ? 'bg-gradient-to-br from-[#2a0e14] to-[#1a080c] border-rose-500/30 hover:border-rose-400/60'
                    : 'bg-gradient-to-br from-rose-50/90 to-pink-50/40 border-rose-200/90'
                }`}
              >
                <div className="flex items-start justify-between z-10">
                  <span className={`text-xs sm:text-sm font-bold font-display uppercase tracking-wider ${
                    isDarkMode ? 'text-rose-300' : 'text-slate-600'
                  }`}>
                    ส่งคืนเอกสาร (RETURNED)
                  </span>
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center text-white shadow-lg shadow-rose-500/30 group-hover:scale-110 transition-transform">
                    <RefreshCw className="w-6 h-6" />
                  </div>
                </div>

                <div className="flex items-baseline gap-2 mt-4 z-10">
                  <span className={`text-4xl sm:text-5xl font-black font-sans tracking-tight ${
                    isDarkMode ? 'text-white' : 'text-rose-950'
                  }`}>
                    {stats.returned?.toLocaleString('th-TH') || 0}
                  </span>
                  <span className="text-sm font-bold text-rose-500">รายการ</span>
                </div>

                <div className={`mt-5 pt-3 border-t text-xs font-mono flex justify-between items-center z-10 ${
                  isDarkMode ? 'border-rose-500/20 text-rose-200/60' : 'border-rose-200/60 text-slate-500'
                }`}>
                  <span>สถานะมีผลส่งคืน</span>
                  <span className="text-rose-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity font-sans">
                    ดูข้อมูล ↗
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 2-COLUMN SIDEBAR & WORKSPACE GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT COLUMN: SIDEBAR NAVIGATION */}
          <div className={`lg:col-span-3 rounded-2xl border p-4 sm:p-5 flex flex-col gap-5 print:hidden transition-colors ${
            isDarkMode
              ? 'bg-[#0a221b] border-emerald-500/20 shadow-xl'
              : 'bg-white border-slate-200/80 shadow-xs'
          }`}>
            {/* Header / Section */}
            <div className={`px-2 py-1.5 border-b pb-2 ${isDarkMode ? 'border-emerald-500/20' : 'border-slate-100'}`}>
              <span className={`text-xs font-bold uppercase tracking-wider font-mono ${
                isDarkMode ? 'text-emerald-400' : 'text-slate-400'
              }`}>
                ลงทะเบียน & สแกนรับ-คืน
              </span>
            </div>
            
            <div className="flex flex-col gap-2">
              {[
                { id: 1, name: '1. ตรวจจ่าย-งานใหม่', desc: 'ลงทะเบียนรับงานใหม่', icon: FileText, gradient: 'from-emerald-500 to-teal-600', shadow: 'shadow-emerald-500/30' },
                { id: 2, name: '2. ตรวจจ่าย-งานเก่า', desc: 'งานเก่ามีเลขเดิม', icon: FileCheck, gradient: 'from-blue-500 to-indigo-600', shadow: 'shadow-blue-500/30' },
                { id: 3, name: '3. งานด้านอื่น', desc: 'งานประเภทอื่นๆ', icon: Layers, gradient: 'from-violet-500 to-purple-600', shadow: 'shadow-violet-500/30' },
                { id: 4, name: '4. งานเบิกจ่าย', desc: 'งานเบิกจ่ายเงินสด', icon: Database, gradient: 'from-amber-500 to-orange-600', shadow: 'shadow-amber-500/30' },
                { id: 5, name: '5. ไม่มีในฐานข้อมูล', desc: 'กรอกเอกสารใหม่มือ', icon: Plus, gradient: 'from-rose-500 to-red-600', shadow: 'shadow-rose-500/30' },
                { id: 6, name: '6. การส่งคืนเอกสาร', desc: 'บันทึกสถานะส่งคืนเอกสาร', icon: RefreshCw, gradient: 'from-cyan-500 to-teal-600', shadow: 'shadow-cyan-500/30' }
              ].map((tab) => {
                const isActive = activeTab === tab.id;
                const IconComponent = tab.icon;

                return (
                  <button
                    id={`tab-${tab.id}`}
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full relative flex items-center gap-3.5 p-3 rounded-xl text-left transition-all duration-200 cursor-pointer border select-none group focus:outline-hidden ${
                      isActive
                        ? isDarkMode
                          ? 'bg-[#0f2e25] border-emerald-400/80 shadow-lg shadow-emerald-950/60 ring-2 ring-emerald-400/40 translate-x-1'
                          : 'bg-emerald-50 border-emerald-400 shadow-md ring-2 ring-emerald-300/40 translate-x-1'
                        : isDarkMode
                          ? 'bg-[#071914]/60 border-emerald-500/10 text-slate-300 hover:bg-[#0e2c24] hover:text-white hover:border-emerald-500/30'
                          : 'bg-slate-50/70 border-slate-200/60 text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 shrink-0 bg-gradient-to-br ${tab.gradient} text-white shadow-md ${tab.shadow} ${
                      isActive ? 'scale-105' : 'group-hover:scale-105 opacity-90 group-hover:opacity-100'
                    }`}>
                      <IconComponent className="w-5 h-5" />
                    </div>

                    <div className="flex flex-col min-w-0">
                      <span className={`text-sm sm:text-base font-bold font-display tracking-tight leading-snug truncate transition-colors ${
                        isActive
                          ? isDarkMode ? 'text-emerald-300' : 'text-emerald-950'
                          : isDarkMode ? 'text-slate-200' : 'text-slate-800'
                      }`}>
                        {tab.name}
                      </span>
                      <span className={`text-xs tracking-wide truncate transition-all duration-200 ${
                        isActive
                          ? isDarkMode ? 'text-emerald-200/80 font-medium' : 'text-emerald-700 font-medium'
                          : isDarkMode ? 'text-slate-400' : 'text-slate-500'
                      }`}>
                        {tab.desc}
                      </span>
                    </div>

                    {isActive && (
                      <div className="absolute left-0 top-1/4 h-1/2 w-1 rounded-r-full bg-emerald-400" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Header / Section 2 */}
            <div className={`px-2 py-1.5 border-b pb-2 mt-2 ${isDarkMode ? 'border-emerald-500/20' : 'border-slate-100'}`}>
              <span className={`text-xs font-bold uppercase tracking-wider font-mono ${
                isDarkMode ? 'text-emerald-400' : 'text-slate-400'
              }`}>
                รายงานและการจัดการ
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {[
                { id: 7, name: '7. แสดงรายงาน & แก้ไข', desc: 'ดูรายงาน / แก้ไขข้อมูล 2570-ระบบติดตามเอกสาร', icon: BarChart3, gradient: 'from-sky-500 to-indigo-600', shadow: 'shadow-sky-500/30' },
                { id: 8, name: '8. พิมพ์ใบนำส่งเอกสาร', desc: 'สร้างและพิมพ์ใบนำส่งเอกสาร', icon: Printer, gradient: 'from-emerald-600 to-teal-700', shadow: 'shadow-emerald-600/30' },
                { id: 9, name: '9. รายงานสรุป-EP', desc: 'สรุปงานใหญ่/ด่วนตามผู้ให้บริการ', icon: PieChart, gradient: 'from-fuchsia-500 to-purple-600', shadow: 'shadow-fuchsia-500/30' },
                { id: 10, name: '10. ตั้งค่าระบบ & สิทธิ์', desc: 'ฐานข้อมูล & สิทธิ์การเข้าใช้งาน', icon: Settings, gradient: 'from-amber-500 to-emerald-600', shadow: 'shadow-amber-500/30' }
              ].map((tab) => {
                const isActive = activeTab === tab.id;
                const IconComponent = tab.icon;

                return (
                  <button
                    id={`tab-${tab.id}`}
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full relative flex items-center gap-3.5 p-3 rounded-xl text-left transition-all duration-200 cursor-pointer border select-none group focus:outline-hidden ${
                      isActive
                        ? isDarkMode
                          ? 'bg-[#0f2e25] border-emerald-400/80 shadow-lg shadow-emerald-950/60 ring-2 ring-emerald-400/40 translate-x-1'
                          : 'bg-emerald-50 border-emerald-400 shadow-md ring-2 ring-emerald-300/40 translate-x-1'
                        : isDarkMode
                          ? 'bg-[#071914]/60 border-emerald-500/10 text-slate-300 hover:bg-[#0e2c24] hover:text-white hover:border-emerald-500/30'
                          : 'bg-slate-50/70 border-slate-200/60 text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 shrink-0 bg-gradient-to-br ${tab.gradient} text-white shadow-md ${tab.shadow} ${
                      isActive ? 'scale-105' : 'group-hover:scale-105 opacity-90 group-hover:opacity-100'
                    }`}>
                      <IconComponent className="w-5 h-5" />
                    </div>

                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className={`text-sm sm:text-base font-bold font-display tracking-tight leading-snug truncate transition-colors ${
                          isActive
                            ? isDarkMode ? 'text-emerald-300' : 'text-emerald-950'
                            : isDarkMode ? 'text-slate-200' : 'text-slate-800'
                        }`}>
                          {tab.name}
                        </span>
                        {tab.id === 10 && currentUserRole === 'admin' && permissionRequests.filter(r => r.status === 'pending').length > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-amber-950 animate-pulse shrink-0">
                            {permissionRequests.filter(r => r.status === 'pending').length}
                          </span>
                        )}
                      </div>
                      <span className={`text-xs tracking-wide truncate transition-all duration-200 ${
                        isActive
                          ? isDarkMode ? 'text-emerald-200/80 font-medium' : 'text-emerald-700 font-medium'
                          : isDarkMode ? 'text-slate-400' : 'text-slate-500'
                      }`}>
                        {tab.desc}
                      </span>
                    </div>

                    {isActive && (
                      <div className="absolute left-0 top-1/4 h-1/2 w-1 rounded-r-full bg-emerald-400" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* RIGHT COLUMN: MAIN WORKSPACE CONTENT */}
          <div className="lg:col-span-9 flex flex-col gap-6">
            
            {/* DESK STATUS MANAGEMENT CARD (ATTENDANCE & LEAVES) */}
            {activeTab === 1 && (
              <div id="desk-management" className={`rounded-xl border p-5 shadow-xs transition-colors ${
                isDarkMode ? 'bg-[#0a221b] border-emerald-500/20' : 'bg-white border-slate-200'
              }`}>
                <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-3 mb-4 ${
                  isDarkMode ? 'border-emerald-500/20' : 'border-slate-100'
                }`}>
                  <div className="flex items-start sm:items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      isDarkMode ? 'bg-emerald-950/60 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
                    }`}>
                      <Sliders className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className={`text-sm font-bold font-display ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        ตั้งค่าสถานะผู้ให้บริการ (คนลา / ปิดโต๊ะทำงาน)
                      </h2>
                      <p className={`text-xs ${isDarkMode ? 'text-emerald-300/70' : 'text-slate-500'}`}>
                        คลิกที่รายชื่อเพื่อ เปิด/ปิด โต๊ะทำงาน (คนลา/ปิดหน้าโต๊ะ) ระบบคิวรันอัตโนมัติจะสลับข้ามคนที่มีสถานะ "ลา/ปิดโต๊ะ" โดยทันที
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs ${isDarkMode ? 'text-emerald-300/80' : 'text-slate-500'}`}>พร้อมทำงาน:</span>
                    <span className={`border text-xs font-bold px-2.5 py-0.5 rounded-full font-mono ${
                      isDarkMode ? 'bg-[#0f2e25] text-emerald-300 border-emerald-500/40' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                      {PROVIDER_DESKS.length - inactiveProviders.length} / {PROVIDER_DESKS.length} คน
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2">
                  {PROVIDER_DESKS.map((name, idx) => {
                    const isInactive = inactiveProviders.includes(name);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => toggleProviderActive(name)}
                        className={`flex flex-col items-center justify-between p-3 rounded-lg border transition-all text-center h-24 cursor-pointer focus:outline-hidden ${
                          isInactive
                            ? isDarkMode
                              ? 'bg-purple-950/40 border-purple-500/30 text-purple-300 hover:bg-purple-900/40 shadow-2xs'
                              : 'bg-purple-50/80 border-purple-200 text-purple-700 hover:bg-purple-100/90 hover:border-purple-300 shadow-2xs'
                            : isDarkMode
                              ? 'bg-[#0f2e25]/60 border-emerald-500/30 hover:border-emerald-400 hover:bg-[#153e32] text-slate-100 shadow-2xs'
                              : 'bg-emerald-50/40 border-emerald-200 hover:border-emerald-300 hover:bg-emerald-50/80 text-slate-800 shadow-2xs'
                        }`}
                      >
                        <div className="flex flex-col items-center gap-0.5">
                          <span className={`text-[9px] font-mono font-bold leading-none ${isInactive ? 'text-purple-400' : isDarkMode ? 'text-emerald-400/70' : 'text-slate-400'}`}>
                            โต๊ะ {idx + 1}
                          </span>
                          <span className={`text-xs font-bold leading-tight ${isInactive ? (isDarkMode ? 'text-purple-300 line-through decoration-purple-400' : 'text-purple-900 line-through decoration-purple-300 decoration-1') : (isDarkMode ? 'text-white' : 'text-slate-900')}`}>
                            {name}
                          </span>
                        </div>

                        <div className="flex items-center justify-center gap-1 mt-1.5 w-full">
                          <span className={`w-1.5 h-1.5 rounded-full ${isInactive ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500 animate-pulse'}`} />
                          <span className={`text-[9px] font-bold tracking-wider ${isInactive ? (isDarkMode ? 'text-rose-400' : 'text-rose-600') : (isDarkMode ? 'text-emerald-400' : 'text-emerald-700')}`}>
                            {isInactive ? 'ลา / ปิดโต๊ะ' : 'เปิดทำงาน'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* SCANNING MODULE & REVIEW PANEL (TABS 1-6) */}
            {activeTab <= 6 && (
              <div className="flex flex-col gap-6">
                
                {/* TOP: SCANNER MODULE (SINGLE INPUT) */}
                <div className={`rounded-xl border shadow-xs p-5 flex flex-col gap-4 transition-colors ${
                  isDarkMode
                    ? 'bg-[#0a221b] border-emerald-500/20 text-slate-100'
                    : 'bg-white border-slate-200 text-slate-900'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sliders className={`w-4 h-4 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`} />
                      <h3 className={`text-sm font-bold font-display ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        ป้อนหรือสแกนเลขทะเบียนรับ
                      </h3>
                    </div>
                    <button
                      id="demo-fill-btn"
                      onClick={handleLoadDemo}
                      className={`text-[10px] font-medium px-2 py-1 rounded transition border cursor-pointer ${
                        isDarkMode
                          ? 'text-emerald-300 bg-emerald-950/60 border-emerald-500/40 hover:bg-emerald-900/50'
                          : 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border-emerald-200'
                      }`}
                    >
                      ใส่เลขตัวอย่าง
                    </button>
                  </div>

                  <p className={`text-xs leading-relaxed ${isDarkMode ? 'text-emerald-300/70' : 'text-slate-500'}`}>
                    {activeTab === 5 ? (
                      'กรอกเลขบาร์โค้ดลงทะเบียนด้านล่างเพื่อสร้างบันทึกเอกสารชุดใหม่ด้วยตนเอง'
                    ) : activeTab === 6 ? (
                      'ระบุเลขทะเบียนเอกสารหรือสแกนด้วยบาร์โค้ด เพื่อดึงข้อมูลประวัติเดิมจากตาราง 2570-ระบบติดตามเอกสาร มาบันทึกเปลี่ยนสถานะส่งคืน'
                    ) : (
                      'ระบุเลขทะเบียนเอกสารหรือสแกนด้วยบาร์โค้ด เพื่อดึงข้อมูลและระบุคิวลงทะเบียน'
                    )}
                  </p>

                  {/* SINGLE BARCODE INPUT & SEARCH BAR */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                    <div className="relative flex-1">
                      <input
                        id="barcode-input-0"
                        type="text"
                        placeholder={activeTab === 5 ? 'กรอกรหัสสำหรับพิมพ์ข้อมูล...' : 'พิมพ์หรือสแกนบาร์โค้ดทะเบียนรับ...'}
                        value={barcodes[0]}
                        onChange={(e) => handleInputChange(0, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleFetchBarcodes();
                          }
                        }}
                        className={`w-full rounded-lg pl-3 pr-8 py-2.5 text-xs font-mono transition focus:outline-hidden ${
                          isDarkMode
                            ? 'bg-[#0f2e25] border border-emerald-500/30 text-emerald-100 placeholder-emerald-400/40 focus:border-emerald-400 focus:bg-[#153e32]'
                            : 'bg-slate-50 border border-slate-200 text-slate-700 focus:border-emerald-500 focus:bg-white'
                        }`}
                      />
                      {barcodes[0] && (
                        <button
                          onClick={() => handleInputChange(0, '')}
                          className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold ${
                            isDarkMode ? 'text-emerald-400/60 hover:text-emerald-200' : 'text-slate-400 hover:text-slate-600'
                          }`}
                        >
                          ×
                        </button>
                      )}
                    </div>

                    <button
                      id="lookup-barcodes-btn"
                      onClick={handleFetchBarcodes}
                      disabled={isSearching || (!accessToken && activeTab !== 1 && activeTab !== 2)}
                      className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-xs px-5 py-2.5 rounded-lg transition shadow-xs flex items-center justify-center gap-2 cursor-pointer shrink-0"
                    >
                      {isSearching ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>
                            {activeTab === 6
                              ? 'กำลังค้นหาในตาราง 2570-ระบบติดตามเอกสาร...'
                              : 'กำลังค้นหาในหน้า GENERATE...'}
                          </span>
                        </>
                      ) : (
                        <>
                          <Search className="w-3.5 h-3.5" />
                          <span>
                            {activeTab === 6
                              ? 'ดึงประวัติเพื่อเตรียมส่งคืน'
                              : 'ดึงข้อมูลและระบุคิวลงทะเบียน'}
                          </span>
                        </>
                      )}
                    </button>
                  </div>

                  {!accessToken && activeTab !== 1 && activeTab !== 2 && (
                    <div className={`p-2.5 rounded-lg border flex items-start gap-2 text-[10px] ${
                      isDarkMode ? 'bg-rose-950/40 border-rose-500/30 text-rose-300' : 'bg-rose-50 border-rose-100 text-rose-700'
                    }`}>
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>กรุณาคลิก "เข้าสู่ระบบด้วย Google Account" บริเวณด้านบนขวาก่อน เพื่อเริ่มการใช้งาน</span>
                    </div>
                  )}
                </div>

                {/* BOTTOM: DATA REVIEW LIST (EXPANDED TO FULL WIDTH) */}
                <div className={`rounded-xl border shadow-xs overflow-hidden flex flex-col w-full transition-colors ${
                  isDarkMode
                    ? 'bg-[#0a221b] border-emerald-500/20'
                    : 'bg-white border-slate-200'
                }`}>
                  
                  <div className={`p-4 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                    isDarkMode ? 'bg-[#071d17] border-emerald-500/20' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div>
                      <h3 className={`text-sm font-bold font-display flex items-center gap-1.5 ${
                        isDarkMode ? 'text-white' : 'text-slate-900'
                      }`}>
                        <CheckCircle2 className={`w-4 h-4 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`} />
                        <span>รายการที่ดึงมารอตรวจสอบ ({displayedScannedItems.length})</span>
                        {stagedFilterQuery.trim() && (
                          <span className={`text-[11px] font-normal px-2 py-0.5 rounded-full ${
                            isDarkMode ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30' : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            พบ {filteredDisplayedItems.length} รายการ
                          </span>
                        )}
                      </h3>
                      <p className={`text-[11px] mt-0.5 ${isDarkMode ? 'text-emerald-300/70' : 'text-slate-400'}`}>
                        ตารางบันทึกปลายทาง: <span className={`font-semibold ${isDarkMode ? 'text-emerald-300' : 'text-emerald-700'}`}>2570-ระบบติดตามเอกสาร</span>
                      </p>
                    </div>

                    {/* Filter & Bulk Actions Bar */}
                    <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                      {/* Search Filter Input */}
                      <div className="relative flex-1 sm:w-64">
                        <Search className={`w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none ${
                          isDarkMode ? 'text-emerald-400/50' : 'text-slate-400'
                        }`} />
                        <input
                          type="text"
                          value={stagedFilterQuery}
                          onChange={(e) => setStagedFilterQuery(e.target.value)}
                          placeholder="ค้นหาเลขรับ, หน่วยงาน, ประเภท..."
                          className={`w-full text-xs pl-8 pr-7 py-1.5 rounded-lg border transition outline-hidden ${
                            isDarkMode
                              ? 'bg-[#0f2e25] border-emerald-500/30 text-emerald-100 placeholder-emerald-400/40 focus:border-emerald-400'
                              : 'bg-white border-slate-300 text-slate-700 placeholder-slate-400 focus:border-emerald-500'
                          }`}
                        />
                        {stagedFilterQuery && (
                          <button
                            type="button"
                            onClick={() => setStagedFilterQuery('')}
                            className={`absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-emerald-900/50 transition cursor-pointer ${
                              isDarkMode ? 'text-emerald-400' : 'text-slate-400'
                            }`}
                            title="ล้างคำค้นหา"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {/* Bulk Delete Button */}
                      {selectedStagedIds.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setIsBulkDeleteConfirmOpen(true)}
                          className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>ลบรายการที่เลือก ({selectedStagedIds.length})</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="p-5 flex-1 min-h-[300px] flex flex-col justify-between">
                    {displayedScannedItems.length === 0 ? (
                      <div className={`flex flex-col items-center justify-center py-16 gap-3 ${
                        isDarkMode ? 'text-emerald-300/50' : 'text-slate-400'
                      }`}>
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                          isDarkMode ? 'bg-[#0f2e25]' : 'bg-slate-100'
                        }`}>
                          <Search className={`w-6 h-6 ${isDarkMode ? 'text-emerald-500/50' : 'text-slate-300'}`} />
                        </div>
                        <div className="text-center">
                          <p className={`text-sm font-semibold ${isDarkMode ? 'text-emerald-200' : 'text-slate-600'}`}>
                            ยังไม่มีรายการเอกสารในหน้านี้
                          </p>
                          <p className={`text-xs max-w-xs mt-1 leading-relaxed ${isDarkMode ? 'text-emerald-400/60' : 'text-slate-400'}`}>
                            โปรดสแกนบาร์โค้ดหรือกรอกเลขทะเบียนรับด้านบนเพื่อนำเข้าเอกสารสำหรับลงคิวและตรวจสอบ
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-4 overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[900px]">
                          <thead>
                            <tr className={`border-b text-[10px] font-mono font-bold uppercase tracking-wider ${
                              isDarkMode ? 'border-emerald-500/20 text-emerald-400/80' : 'border-slate-100 text-slate-400'
                            }`}>
                              <th className="py-2.5 px-2 w-10 text-center">
                                <input
                                  type="checkbox"
                                  checked={filteredDisplayedItems.length > 0 && filteredDisplayedItems.every(item => selectedStagedIds.includes(item.id))}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      const visibleIds = filteredDisplayedItems.map(item => item.id);
                                      setSelectedStagedIds(Array.from(new Set([...selectedStagedIds, ...visibleIds])));
                                    } else {
                                      const visibleIds = new Set(filteredDisplayedItems.map(item => item.id));
                                      setSelectedStagedIds(selectedStagedIds.filter(id => !visibleIds.has(id)));
                                    }
                                  }}
                                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer w-3.5 h-3.5"
                                  title="เลือกทั้งหมด"
                                />
                              </th>
                              <th className="py-2.5 px-2">N/O</th>
                              <th className="py-2.5 px-2">EP</th>
                              <th className="py-2.5 px-2">เลขทะเบียนรับ</th>
                              <th className="py-2.5 px-2">ผู้ส่งเอกสาร</th>
                              <th className="py-2.5 px-2">โทรศัพท์</th>
                              <th className="py-2.5 px-2">อีเมล</th>
                              <th className="py-2.5 px-2">เลขที่ อว/ ชื่อ</th>
                              <th className="py-2.5 px-2">หน่วยงาน</th>
                              <th className="py-2.5 px-2">เลขที่เอกสาร</th>
                              <th className="py-2.5 px-2">ประเภทเอกสาร</th>
                              {activeTab === 6 ? (
                                <th className="py-2.5 px-2">สถานะการส่งคืน (วันที่ส่งคืน)</th>
                              ) : (
                                <th className="py-2.5 px-2">ผู้ให้บริการ (Final)</th>
                              )}
                              <th className="py-2.5 px-2 text-center">จัดการ</th>
                            </tr>
                          </thead>
                          <tbody className={`divide-y ${isDarkMode ? 'divide-emerald-500/15' : 'divide-slate-100'}`}>
                            {filteredDisplayedItems.length === 0 ? (
                              <tr>
                                <td colSpan={13} className="py-12 text-center">
                                  <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                                    <Search className="w-5 h-5 text-slate-300 dark:text-emerald-500/40" />
                                    <p className="text-xs font-semibold">ไม่พบข้อมูลที่ตรงกับคำค้นหา "{stagedFilterQuery}"</p>
                                    <button
                                      type="button"
                                      onClick={() => setStagedFilterQuery('')}
                                      className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                                    >
                                      ล้างคำค้นหา
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ) : (
                              filteredDisplayedItems.map((item, index) => {
                                const isFound = item.foundInGenerate;
                                const realIndex = scannedItems.findIndex(s => s.id === item.id);
                                const isSelected = selectedStagedIds.includes(item.id);
                                return (
                                  <tr key={item.id} className={`text-xs transition ${
                                    isSelected
                                      ? isDarkMode ? 'bg-emerald-950/40 text-emerald-100' : 'bg-emerald-50/60 text-slate-800'
                                      : isDarkMode ? 'text-emerald-100 hover:bg-[#0f2e25]/50' : 'text-slate-700 hover:bg-slate-50'
                                  }`}>
                                    <td className="py-3 px-2 text-center">
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setSelectedStagedIds(prev => [...prev, item.id]);
                                          } else {
                                            setSelectedStagedIds(prev => prev.filter(id => id !== item.id));
                                          }
                                        }}
                                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer w-3.5 h-3.5"
                                      />
                                    </td>
                                  <td className="py-3 px-2">
                                    <span className={`px-1.5 py-0.5 rounded font-mono font-bold text-[10px] ${
                                      (item.data.noType || 'N') === 'N'
                                        ? isDarkMode
                                          ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
                                          : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                        : isDarkMode
                                          ? 'bg-purple-950/60 text-purple-300 border border-purple-500/30'
                                          : 'bg-purple-50 text-purple-700 border border-purple-100'
                                    }`}>
                                      {item.data.noType || 'N'}
                                    </span>
                                  </td>
                                  <td className={`py-3 px-2 font-mono text-xs font-medium ${
                                    isDarkMode ? 'text-emerald-200' : 'text-slate-700'
                                  }`}>
                                    {item.data.ep || '-'}
                                  </td>
                                  <td className={`py-3 px-2 font-mono font-bold ${
                                    isDarkMode ? 'text-white' : 'text-slate-950'
                                  }`}>
                                    <div className="flex flex-col gap-0.5">
                                      <span>{item.barcode}</span>
                                      {item.foundInDataInput && (
                                        <span className={`text-[8px] leading-none px-1 py-0.5 rounded font-sans w-max font-normal border ${
                                          isDarkMode
                                            ? 'text-teal-300 bg-teal-950/60 border-teal-500/30'
                                            : 'text-teal-700 bg-teal-50 border-teal-200'
                                        }`}>
                                          อัปเดตรายการเดิม (แถวที่ {item.dataInputRowIndex})
                                        </span>
                                      )}
                                      {activeTab === 6 && item.data.tableDate && (
                                        <span className={`text-[9px] leading-none font-sans font-normal mt-0.5 ${
                                          isDarkMode ? 'text-emerald-300/70' : 'text-slate-500'
                                        }`}>
                                          ลงโต๊ะ: {item.data.tableDate} ({item.data.finalDesk || item.data.autoDesk || 'ไม่ระบุโต๊ะ'})
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className={`py-3 px-2 truncate max-w-[130px] ${
                                    isDarkMode ? 'text-emerald-100' : 'text-slate-700'
                                  }`} title={item.data.senderName}>
                                    {item.data.senderName || '-'}
                                  </td>
                                  <td className={`py-3 px-2 font-mono text-xs ${
                                    isDarkMode ? 'text-emerald-300' : 'text-slate-600'
                                  }`}>
                                    {item.data.senderPhone || '-'}
                                  </td>
                                  <td className={`py-3 px-2 font-mono text-xs truncate max-w-[130px] ${
                                    isDarkMode ? 'text-emerald-300' : 'text-slate-600'
                                  }`} title={item.data.senderEmail}>
                                    {item.data.senderEmail || '-'}
                                  </td>
                                  <td className={`py-3 px-2 font-medium truncate max-w-[140px] ${
                                    isDarkMode ? 'text-emerald-100' : 'text-slate-800'
                                  }`} title={item.data.mhesiNumber}>
                                    {item.data.mhesiNumber || (
                                      <span className={`italic font-mono text-[10px] ${
                                        isDarkMode ? 'text-emerald-400/50' : 'text-slate-400'
                                      }`}>
                                        {isFound ? '-' : 'ระบุเอง'}
                                      </span>
                                    )}
                                  </td>
                                  <td className={`py-3 px-2 truncate max-w-[140px] ${
                                    isDarkMode ? 'text-emerald-200' : 'text-slate-600'
                                  }`} title={item.data.agency}>
                                    {item.data.agency || (
                                      <span className={`italic font-mono text-[10px] ${
                                        isDarkMode ? 'text-emerald-400/50' : 'text-slate-400'
                                      }`}>
                                        {isFound ? '-' : 'ระบุเอง'}
                                      </span>
                                    )}
                                  </td>
                                  <td className={`py-3 px-2 font-mono truncate max-w-[110px] ${
                                    isDarkMode ? 'text-emerald-200' : 'text-slate-600'
                                  }`} title={item.data.docNumber}>
                                    {item.data.docNumber || (
                                      <span className={`italic font-mono text-[10px] ${
                                        isDarkMode ? 'text-emerald-400/50' : 'text-slate-400'
                                      }`}>
                                        {isFound ? '-' : 'ระบุเอง'}
                                      </span>
                                    )}
                                  </td>
                                  <td className={`py-3 px-2 truncate max-w-[120px] ${
                                    isDarkMode ? 'text-emerald-200' : 'text-slate-600'
                                  }`} title={item.data.docType}>
                                    {item.data.docType || '-'}
                                  </td>
                                  <td className="py-3 px-2">
                                    {activeTab === 6 ? (
                                      <div className="flex flex-col gap-0.5">
                                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border w-max ${
                                          item.data.returnStatus === 'ส่งคืนเรียบร้อย' 
                                            ? isDarkMode ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                            : isDarkMode ? 'bg-amber-950/60 text-amber-300 border-amber-500/40' : 'bg-amber-50 text-amber-700 border-amber-200'
                                        }`}>
                                          {item.data.returnStatus || 'ติดต่อรับคืน'}
                                        </span>
                                        {item.data.returnDate && (
                                          <span className={`text-[10px] font-mono mt-0.5 ${
                                            isDarkMode ? 'text-emerald-300/70' : 'text-slate-500'
                                          }`}>
                                            {item.data.returnDate}
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      activeTab === 1 || activeTab === 2 ? (
                                        <div className="flex flex-col gap-1 min-w-[130px]">
                                          <select
                                            disabled={updatingDeskRowId === item.id || isSaving}
                                            value={item.data.finalDesk || item.data.overrideDesk || item.data.autoDesk}
                                            onChange={async (e) => {
                                              if (updatingDeskRowId) return;
                                              const targetId = item.id;
                                              setUpdatingDeskRowId(targetId);
                                              try {
                                                const newDesk = e.target.value;
                                              const initialDesk = item.data.autoDesk || item.data.finalDesk;
                                              const isOverride = newDesk !== initialDesk;
                                              const deskPhone = getDeskPhone(newDesk);

                                              // เฉพาะหน้า 1: อัปเดต Queue Pointer และ State lastAssignedIndex เมื่อมีการเปลี่ยน Dropdown
                                              if (activeTab === 1) {
                                                let newDeskNum = extractDeskNum(newDesk);
                                                if (!newDeskNum || newDeskNum < 1 || newDeskNum > 9) {
                                                  const foundIdx = PROVIDER_DESKS.findIndex(d => d === newDesk || cleanNameForCompare(d) === cleanNameForCompare(newDesk));
                                                  if (foundIdx !== -1) {
                                                    newDeskNum = foundIdx + 1;
                                                  }
                                                }

                                                if (newDeskNum >= 1 && newDeskNum <= 9) {
                                                  updateLastDeskNum(newDeskNum);
                                                }
                                              }

                                              // เตรียมข้อมูลรายการใหม่ พร้อมอัปเดตเบอร์โทรประจำโต๊ะให้อัตโนมัติ
                                              const currentTabType = activeTab === 2 ? '2. ตรวจจ่าย-งานเก่า' : '1. ตรวจจ่าย-งานใหม่';
                                              const currentNoType = activeTab === 2 ? 'O' : 'N';
                                              const updatedRecord: DocumentRecord = {
                                                ...item.data,
                                                autoDesk: initialDesk,
                                                type: currentTabType,
                                                TYPE: currentTabType,
                                                noType: currentNoType,
                                                overrideDesk: isOverride ? newDesk : '',
                                                finalDesk: newDesk,
                                                senderPhone: deskPhone || item.data.senderPhone || '',
                                                'โทรศัพท์': deskPhone || item.data['โทรศัพท์'] || '',
                                                'โทร.': deskPhone || (item.data as any)['โทร.'] || '',
                                              };

                                              // อัปเดต React State บนหน้าจอทันที (Optimistic UI) เฉพาะแถวนี้เท่านั้น (ห้ามเทียบด้วย barcode/docNumber)
                                              const targetId = item.id;
                                              setScannedItems(prev => prev.map((s, idx) => {
                                                if (targetId && s.id === targetId) return { ...s, data: updatedRecord };
                                                if (!targetId && (realIndex !== -1 ? idx === realIndex : idx === index)) return { ...s, data: updatedRecord };
                                                return s;
                                              }));
                                              setAllStatsRecords(prev => prev.map((r, idx) => {
                                                if (targetId && r.id === targetId) return { ...r, data: updatedRecord };
                                                if (!targetId && (realIndex !== -1 ? idx === realIndex : idx === index)) return { ...r, data: updatedRecord };
                                                return r;
                                              }));

                                              // บันทึกเข้า Supabase เฉพาะ Record เดียวนี้เท่านั้น (.eq('id', targetId))
                                              if (targetId && !targetId.startsWith('sb-') && !targetId.startsWith('item_')) {
                                                const sbRes = await updateDocumentByIdInSupabase(targetId, updatedRecord);
                                                if (!sbRes.success) {
                                                  throw new Error(sbRes.error || 'อัปเดตข้อมูลผู้ให้บริการไม่สำเร็จ');
                                                }
                                              }
                                              await fetchReceivedData();
                                              // Sync State อีกครั้งหลัง fetch เฉพาะแถวนี้เท่านั้น
                                              setScannedItems(prev => prev.map((s, idx) => {
                                                if (targetId && s.id === targetId) return { ...s, data: updatedRecord };
                                                if (!targetId && (realIndex !== -1 ? idx === realIndex : idx === index)) return { ...s, data: updatedRecord };
                                                return s;
                                              }));
                                              setAllStatsRecords(prev => prev.map((r, idx) => {
                                                if (targetId && r.id === targetId) return { ...r, data: updatedRecord };
                                                if (!targetId && (realIndex !== -1 ? idx === realIndex : idx === index)) return { ...r, data: updatedRecord };
                                                return r;
                                              }));
                                              if (activeTab === 1) {
                                                showToast('success', `เปลี่ยนโต๊ะเป็น ${newDesk} (โทร. ${deskPhone || '-'}) และตั้งเป็นคิวเริ่มต้นสำหรับรอบถัดไปแล้ว`);
                                              } else {
                                                showToast('success', `เปลี่ยนโต๊ะเป็น ${newDesk} (โทร. ${deskPhone || '-'}) เรียบร้อยแล้ว`);
                                              }
                                            } catch (err: any) {
                                              console.error('Error saving manual desk override to Supabase:', err);
                                              showToast('error', `เปลี่ยนโต๊ะบนหน้าจอสำเร็จ แต่เกิดข้อผิดพลาดในการบันทึก Supabase: ${err.message || ''}`);
                                            } finally {
                                              setUpdatingDeskRowId(null);
                                            }
                                          }}
                                            className={`text-xs font-semibold rounded-lg px-2 py-1 border transition cursor-pointer font-sans ${
                                              isDarkMode
                                                ? 'bg-[#0f2e25] border-emerald-500/40 text-emerald-200 focus:border-emerald-400'
                                                : 'bg-white border-slate-300 text-slate-800 focus:border-emerald-500 shadow-2xs'
                                            }`}
                                          >
                                            <optgroup label={activeTab === 2 ? "9 โต๊ะประจำงานบริการ" : "9 โต๊ะประจำหน้างานใหม่"}>
                                              {PROVIDER_DESKS.map(d => (
                                                <option key={d} value={d}>{d}</option>
                                              ))}
                                            </optgroup>
                                            <optgroup label="โต๊ะอื่นๆ">
                                              {OVERRIDE_DESK_OPTIONS.filter(d => !PROVIDER_DESKS.includes(d)).map(d => (
                                                <option key={d} value={d}>{d}</option>
                                              ))}
                                            </optgroup>
                                          </select>
                                          {item.data.overrideDesk && item.data.overrideDesk !== item.data.autoDesk && item.data.overrideDesk !== 'ไม่เลือก' && (
                                            <span className={`text-[9px] font-mono px-1 py-0.2 rounded border w-max ${
                                              isDarkMode
                                                ? 'text-amber-300 bg-amber-950/50 border-amber-500/30'
                                                : 'text-amber-700 bg-amber-50 border-amber-200'
                                            }`}>
                                              เปลี่ยนจาก: {item.data.autoDesk}
                                            </span>
                                          )}
                                        </div>
                                      ) : (
                                        <div className="flex flex-col gap-0.5">
                                          <span className={`font-semibold ${
                                            isDarkMode ? 'text-white' : 'text-slate-900'
                                          }`}>{item.data.finalDesk}</span>
                                          {item.data.overrideDesk && item.data.overrideDesk !== 'ไม่เลือก' && (
                                            <span className={`text-[9px] font-mono px-1 py-0.2 rounded border w-max ${
                                              isDarkMode
                                                ? 'text-amber-300 bg-amber-950/50 border-amber-500/30'
                                                : 'text-amber-600 bg-amber-50 border-amber-100'
                                            }`}>
                                              เปลี่ยนจาก: {item.data.autoDesk}
                                            </span>
                                          )}
                                        </div>
                                      )
                                    )}
                                  </td>
                                  <td className="py-3 px-2 text-center">
                                    <div className="flex items-center justify-center gap-1.5">
                                      <button
                                        id={`edit-item-btn-${index}`}
                                        onClick={() => {
                                          if (activeTab === 1 || activeTab === 2) {
                                            handleOpenDocumentEditor(item, realIndex !== -1 ? realIndex : index);
                                          } else if (activeTab === 6) {
                                            setTab6ReturnModal({
                                              isOpen: true,
                                              docId: item.id,
                                              record: item.data,
                                              returnDate: item.data.returnDate || getIsoDateTimeString(),
                                              returnStatus: item.data.returnStatus || 'ติดต่อรับคืน',
                                              isSaving: false,
                                            });
                                          } else {
                                            handleStartEdit(realIndex !== -1 ? realIndex : index);
                                          }
                                        }}
                                        className="p-1 hover:text-amber-500 text-slate-400 transition cursor-pointer"
                                        title="แก้ไขข้อมูล (8 ฟิลด์)"
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        id={`remove-item-btn-${index}`}
                                        onClick={() => handleRemoveItem(realIndex !== -1 ? realIndex : index)}
                                        className="p-1 hover:text-rose-500 text-slate-400 transition cursor-pointer"
                                        title="ลบรายการ"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 7: แสดงรายงาน & แก้ไขข้อมูล (DATAINPUT) */}
            {activeTab === 7 && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col overflow-hidden">
                {/* HEADER */}
                <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-sky-50 rounded-lg flex items-center justify-center text-sky-600">
                      <BarChart3 className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-900 font-display">
                        รายงานประวัติการบันทึกเอกสาร (2570-ระบบติดตามเอกสาร)
                      </h2>
                      <p className="text-xs text-slate-500">
                        แสดงข้อมูลบันทึกทั้งหมด ค้นหา กรองข้อมูล และเรียกแก้ไขรายตัวโดยเขียนลง Google Sheets โดยตรง
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-xs text-slate-500 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-3xs">
                    <span>จำนวนทั้งหมด:</span>
                    <span className="font-bold text-sky-700">{allStatsRecords.length.toLocaleString('th-TH')}</span>
                    <span>รายการ</span>
                  </div>
                </div>

                {/* SEARCH & FILTERS PANEL */}
                <div className="p-5 border-b border-slate-200 bg-slate-50/30 flex flex-col gap-4">
                  {/* Search Input */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    <div className="md:col-span-8 relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="ค้นหาบาร์โค้ด, เลขที่เอกสาร, เลขที่ อว, หน่วยงาน, หมายเหตุ..."
                        value={reportSearchQuery}
                        onChange={(e) => {
                          setReportSearchQuery(e.target.value);
                          setReportPage(1); // reset to first page
                        }}
                        className="w-full bg-white border border-slate-200 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20 transition-all shadow-3xs"
                      />
                      {reportSearchQuery && (
                        <button
                          onClick={() => { setReportSearchQuery(''); setReportPage(1); }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-bold text-xs"
                        >
                          เคลียร์
                        </button>
                      )}
                    </div>
                    
                    {/* Quick Period Filter */}
                    <div className="md:col-span-4 grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                      {[
                        { id: 'all', label: 'ทั้งหมด' },
                        { id: 'today', label: 'วันนี้' },
                        { id: 'month', label: 'เดือนนี้' }
                      ].map((item) => (
                        <button
                          key={item.id}
                          onClick={() => { setReportPeriodFilter(item.id); setReportPage(1); }}
                          className={`text-center py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                            reportPeriodFilter === item.id
                              ? 'bg-white text-sky-700 shadow-2xs'
                              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50/50'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Advanced Select Dropdowns */}
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mt-1">
                    {/* TYPE Filter */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-400 font-mono">ประเภทงาน (TYPE)</label>
                      <select
                        value={reportTypeFilter}
                        onChange={(e) => { setReportTypeFilter(e.target.value); setReportPage(1); }}
                        className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:border-sky-500 focus:outline-hidden focus:ring-1 focus:ring-sky-500/20"
                      >
                        <option value="all">ทั้งหมด (TYPE)</option>
                        <option value="1. ตรวจจ่าย-งานใหม่">1. ตรวจจ่าย-งานใหม่</option>
                        <option value="2. ตรวจจ่าย-งานเก่า">2. ตรวจจ่าย-งานเก่า</option>
                        <option value="3. งานด้านอื่น">3. งานด้านอื่น</option>
                        <option value="4. งานเบิกจ่าย">4. งานเบิกจ่าย</option>
                        <option value="5. ไม่มีในฐานข้อมูล">5. ไม่มีในฐานข้อมูล</option>
                        <option value="6. การส่งคืนเอกสาร">6. การส่งคืนเอกสาร</option>
                      </select>
                    </div>

                    {/* N/O Filter */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-400 font-mono">ลักษณะงาน (N/O)</label>
                      <select
                        value={reportEpFilter}
                        onChange={(e) => { setReportEpFilter(e.target.value); setReportPage(1); }}
                        className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:border-sky-500 focus:outline-hidden focus:ring-1 focus:ring-sky-500/20"
                      >
                        <option value="all">ทั้งหมด (N/O)</option>
                        <option value="N">N (งานใหม่)</option>
                        <option value="O">O (งานเก่า)</option>
                      </select>
                    </div>

                    {/* Agency Filter */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-400 font-mono">หน่วยงานผู้เสนอ</label>
                      <select
                        value={reportAgencyFilter}
                        onChange={(e) => { setReportAgencyFilter(e.target.value); setReportPage(1); }}
                        className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:border-sky-500 focus:outline-hidden focus:ring-1 focus:ring-sky-500/20"
                      >
                        <option value="">ทั้งหมด (หน่วยงาน)</option>
                        {dropdownConfig.agencies?.map((agency, i) => (
                          <option key={i} value={agency}>{agency}</option>
                        ))}
                      </select>
                    </div>

                    {/* Doc Type Filter */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-400 font-mono">ประเภทเอกสาร</label>
                      <select
                        value={reportDocTypeFilter}
                        onChange={(e) => { setReportDocTypeFilter(e.target.value); setReportPage(1); }}
                        className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:border-sky-500 focus:outline-hidden focus:ring-1 focus:ring-sky-500/20"
                      >
                        <option value="">ทั้งหมด (ประเภท)</option>
                        {dropdownConfig.docTypes?.map((type, i) => (
                          <option key={i} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>

                    {/* Return Status Filter */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-400 font-mono">สถานะการส่งคืน</label>
                      <select
                        value={reportStatusFilter}
                        onChange={(e) => { setReportStatusFilter(e.target.value); setReportPage(1); }}
                        className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:border-sky-500 focus:outline-hidden focus:ring-1 focus:ring-sky-500/20"
                      >
                        <option value="">ทั้งหมด (สถานะคืน)</option>
                        {dropdownConfig.returnStatuses?.map((status, i) => (
                          <option key={i} value={status}>{status}</option>
                        ))}
                      </select>
                    </div>

                    {/* Provider Desk Filter */}
                    <div className="flex flex-col gap-1 col-span-2 md:col-span-1">
                      <label className="text-[10px] font-bold text-slate-400 font-mono">โต๊ะ/ผู้ให้บริการ</label>
                      <select
                        value={reportDeskFilter}
                        onChange={(e) => { setReportDeskFilter(e.target.value); setReportPage(1); }}
                        className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:border-sky-500 focus:outline-hidden focus:ring-1 focus:ring-sky-500/20"
                      >
                        <option value="">ทั้งหมด (โต๊ะ)</option>
                        {ALL_PRINTING_PROVIDERS.map((desk, i) => (
                          <option key={i} value={desk}>{desk}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* DATA TABLE AREA */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse table-fixed min-w-[950px]">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                        <th className="px-3 py-3 text-center w-[5%]">N/O</th>
                        <th className="px-3 py-3 text-center w-[5%]">EP</th>
                        <th className="px-4 py-3 w-[12%]">เลขทะเบียนรับ</th>
                        <th className="px-4 py-3 w-[14%]">เลขที่อว</th>
                        <th className="px-4 py-3 w-[22%]">หน่วยงาน</th>
                        <th className="px-4 py-3 w-[10%]">เลขที่เอกสาร</th>
                        <th className="px-4 py-3 w-[10%]">ประเภทเอกสาร</th>
                        <th className="px-4 py-3 w-[7%]">วันที่รับ</th>
                        <th className="px-4 py-3 w-[9%]">สถานะการส่งคืน</th>
                        <th className="px-4 py-3 w-[9%]">ผู้ให้บริการ (Final)</th>
                        <th className="px-4 py-3 text-center w-[12%]">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-sans">
                      {(() => {
                        // Filter logic
                        const today = new Date();
                        const targetYear = today.getFullYear();
                        const targetMonth = today.getMonth() + 1;
                        const targetDay = today.getDate();

                        // Show newest/latest records first (by parsed date and row index)
                        let filtered = [...allStatsRecords].filter(item => {
                          const d = item.data;
                          
                          // 1. Search Query
                          if (reportSearchQuery.trim()) {
                            const query = reportSearchQuery.toLowerCase().trim();
                            const matchQuery = 
                              d.barcode.toLowerCase().includes(query) ||
                              (d.mhesiNumber || '').toLowerCase().includes(query) ||
                              (d.docNumber || '').toLowerCase().includes(query) ||
                              (d.agency || '').toLowerCase().includes(query) ||
                              (d.docType || '').toLowerCase().includes(query) ||
                              (d.ep || '').toLowerCase().includes(query) ||
                              (d.type || d.TYPE || '').toLowerCase().includes(query) ||
                              (d.senderName || d['ผู้ส่งเอกสาร'] || '').toLowerCase().includes(query) ||
                              (d.senderPhone || d['โทรศัพท์'] || '').toLowerCase().includes(query) ||
                              (d.senderEmail || d['ที่อยู่อีเมล'] || '').toLowerCase().includes(query) ||
                              (d.remarks || '').toLowerCase().includes(query);
                            if (!matchQuery) return false;
                          }

                          // 2. Period Filter
                          if (reportPeriodFilter === 'today') {
                            const parsed = parseThaiOrIsoDate(d.receiveDate);
                            const isToday = parsed && parsed.day === targetDay && parsed.month === targetMonth && parsed.year === targetYear;
                            if (!isToday) return false;
                          } else if (reportPeriodFilter === 'month') {
                            const parsed = parseThaiOrIsoDate(d.receiveDate);
                            const isThisMonth = parsed && parsed.month === targetMonth && parsed.year === targetYear;
                            if (!isThisMonth) return false;
                          }

                          // 2.1 TYPE Filter (ห้ามกรองทิ้งเมื่อเลือกทั้งหมด)
                          if (reportTypeFilter !== 'all') {
                            const curType = d.type || d.TYPE || (d.noType === 'O' ? '2. ตรวจจ่าย-งานเก่า' : '1. ตรวจจ่าย-งานใหม่');
                            if (curType !== reportTypeFilter) return false;
                          }

                          // 3. N/O Filter
                          if (reportEpFilter !== 'all') {
                            if ((d.noType || 'N') !== reportEpFilter) return false;
                          }

                          // 4. Agency Filter
                          if (reportAgencyFilter) {
                            if (d.agency !== reportAgencyFilter) return false;
                          }

                          // 5. Doc Type Filter
                          if (reportDocTypeFilter) {
                            if (d.docType !== reportDocTypeFilter) return false;
                          }

                          // 6. Return Status Filter
                          if (reportStatusFilter) {
                            if (d.returnStatus !== reportStatusFilter) return false;
                          }

                          // 7. Desk Filter
                          if (reportDeskFilter) {
                            if (d.finalDesk !== reportDeskFilter) return false;
                          }

                          return true;
                        }).sort((a, b) => {
                          const dateA = a.data.receiveDate || a.data.tableDate || '';
                          const dateB = b.data.receiveDate || b.data.tableDate || '';
                          const parsedA = parseThaiOrIsoDate(dateA);
                          const parsedB = parseThaiOrIsoDate(dateB);
                          if (parsedA && parsedB) {
                            const timeA = new Date(parsedA.year, parsedA.month - 1, parsedA.day).getTime();
                            const timeB = new Date(parsedB.year, parsedB.month - 1, parsedB.day).getTime();
                            if (timeA !== timeB) return timeB - timeA;
                          } else if (parsedA && !parsedB) {
                            return -1;
                          } else if (!parsedA && parsedB) {
                            return 1;
                          }
                          // หากมีรายการที่บันทึกวันเดียวกัน ให้เรียงจากเวลาที่บันทึกล่าสุดก่อน (Newest First)
                          const createdA = parseDateToTimestamp(a.createdAt || a.data.tableDate || a.data.receiveDate);
                          const createdB = parseDateToTimestamp(b.createdAt || b.data.tableDate || b.data.receiveDate);
                          if (createdA !== createdB) return createdB - createdA;
                          return b.rowIndex - a.rowIndex;
                        });

                        // Pagination calculations
                        const totalItems = filtered.length;
                        const totalPages = Math.ceil(totalItems / REPORT_ITEMS_PER_PAGE) || 1;
                        const startIndex = (reportPage - 1) * REPORT_ITEMS_PER_PAGE;
                        const paginatedItems = filtered.slice(startIndex, startIndex + REPORT_ITEMS_PER_PAGE);

                        if (paginatedItems.length === 0) {
                          return (
                            <tr>
                              <td colSpan={11} className="px-4 py-12 text-center text-slate-400 font-medium">
                                ไม่พบข้อมูลที่ตรงกับเงื่อนไขการค้นหา
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <>
                            {paginatedItems.map((item, idx) => {
                              const d = item.data;
                              const triggerEdit = () => {
                                setEditingHistoryRecord(item);
                                setEditingHistoryData({
                                  ...item.data,
                                  returnDate: '',
                                  returnStatus: ''
                                });
                                setHistoryAgencySearch(item.data.agency || '');
                                setHistoryDocTypeSearch(item.data.docType || '');
                                setHistoryReturnStatusSearch('');
                                setHistoryOverrideSearch(item.data.overrideDesk && item.data.overrideDesk !== 'ไม่เลือก' ? item.data.overrideDesk : '');
                              };
                              return (
                                <tr 
                                  key={item.id ? `${item.id}-${d.barcode || ''}-${idx}` : `${d.barcode || ''}-${d.receiveDate || ''}-${idx}`} 
                                  onClick={triggerEdit}
                                  className="hover:bg-slate-50/90 transition-colors cursor-pointer group"
                                >
                                  <td className="px-3 py-2.5 text-center">
                                    <span className={`px-1.5 py-0.5 rounded-sm text-[10px] font-bold ${
                                      (d.noType || 'N') === 'O' 
                                        ? 'bg-purple-50 text-purple-700 border border-purple-200' 
                                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    }`}>
                                      {d.noType || 'N'}
                                    </span>
                                    {(d.type || d.TYPE) && (
                                      <span className="block text-[8px] text-slate-400 whitespace-nowrap mt-0.5">
                                        {(d.type || d.TYPE).includes('งานเก่า') ? 'งานเก่า' : (d.type || d.TYPE).includes('งานใหม่') ? 'งานใหม่' : (d.type || d.TYPE)}
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2.5 text-center font-mono text-xs font-semibold text-slate-700">
                                    {d.ep || '-'}
                                  </td>
                                  <td className="px-4 py-2.5 font-mono font-bold text-slate-900 break-all">
                                    {d.barcode}
                                  </td>
                                  <td className="px-4 py-2.5 font-medium text-slate-700 break-words leading-tight" title={d.mhesiNumber}>
                                    {d.mhesiNumber || '-'}
                                  </td>
                                  <td className="px-4 py-2.5 text-slate-600 break-words leading-tight font-medium" title={d.agency}>
                                    {d.agency || '-'}
                                  </td>
                                  <td className="px-4 py-2.5 font-mono text-slate-600 break-all leading-tight" title={d.docNumber}>
                                    {d.docNumber || '-'}
                                  </td>
                                  <td className="px-4 py-2.5 text-slate-600 break-words leading-tight" title={d.docType}>
                                    {d.docType || '-'}
                                  </td>
                                  <td className="px-4 py-2.5 font-mono text-slate-500 whitespace-nowrap">
                                    {d.receiveDate ? d.receiveDate.split(' ')[0] : '-'}
                                  </td>
                                  <td className="px-4 py-2.5">
                                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      d.returnStatus?.includes('คืน') || d.returnStatus?.includes('ชะลอ')
                                        ? 'bg-rose-50 text-rose-700 border border-rose-100'
                                        : d.returnStatus?.includes('ผ่าน') || d.returnStatus?.includes('อนุมัติ')
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                        : 'bg-blue-50 text-blue-700 border border-blue-100'
                                    }`}>
                                      {d.returnStatus || '-'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2.5 font-semibold text-slate-800 whitespace-nowrap">
                                    <div className="flex items-center gap-1.5">
                                      <select
                                        value={d.finalDesk || ''}
                                        disabled={updatingDeskRowId === item.id || isSaving}
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          if (item.id) {
                                            handleTab7InlineDeskChange(item.id, e.target.value, d);
                                          }
                                        }}
                                        className="text-xs border border-slate-200 rounded-md px-2 py-1 bg-white font-medium text-slate-800 hover:border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 disabled:opacity-50 cursor-pointer"
                                      >
                                        <option value="">-- ไม่ระบุ --</option>
                                        {PROVIDER_DESKS.map(p => (
                                          <option key={p} value={p}>{p}</option>
                                        ))}
                                      </select>
                                      {updatingDeskRowId === item.id && (
                                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600 shrink-0" />
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-2.5 text-center whitespace-nowrap">
                                    <div className="flex items-center justify-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          triggerEdit();
                                        }}
                                        className="inline-flex items-center gap-1 bg-sky-50 hover:bg-sky-100 text-sky-700 font-bold px-2 py-1 rounded-md transition cursor-pointer text-[11px]"
                                      >
                                        <Pencil className="w-3 h-3" />
                                        <span>แก้ไข</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setDeletingHistoryRecord(item);
                                        }}
                                        className="inline-flex items-center gap-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold px-2 py-1 rounded-md transition cursor-pointer text-[11px]"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                        <span>ลบ</span>
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}

                            {/* PAGINATION PANEL FOOTER */}
                            <tr>
                              <td colSpan={10} className="px-4 py-3 bg-slate-50/50 border-t border-slate-200">
                                <div className="flex items-center justify-between">
                                  <div className="text-[11px] text-slate-500 font-medium">
                                    แสดงข้อมูล {startIndex + 1} ถึง {Math.min(startIndex + REPORT_ITEMS_PER_PAGE, totalItems)} จากทั้งหมด {totalItems.toLocaleString('th-TH')} รายการ
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      disabled={reportPage === 1}
                                      onClick={() => setReportPage(prev => Math.max(1, prev - 1))}
                                      className="p-1 text-slate-500 hover:text-slate-800 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                                    >
                                      <ChevronLeft className="w-5 h-5" />
                                    </button>
                                    <span className="text-xs font-bold text-slate-600 px-2">
                                      หน้า {reportPage} / {totalPages}
                                    </span>
                                    <button
                                      type="button"
                                      disabled={reportPage === totalPages}
                                      onClick={() => setReportPage(prev => Math.min(totalPages, prev + 1))}
                                      className="p-1 text-slate-500 hover:text-slate-800 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                                    >
                                      <ChevronRight className="w-5 h-5" />
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          </>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 8: พิมพ์ใบนำส่งเอกสาร */}
            {activeTab === 8 && (
              <div className="flex flex-col gap-6">
                {/* FILTER CONTROL CARD (HIDDEN ON PRINT) */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex flex-col gap-4 print:hidden">
                  <div className="flex items-center gap-3 border-b border-slate-150 pb-3">
                    <div className="w-9 h-9 bg-teal-50 rounded-lg flex items-center justify-center text-teal-600">
                      <Printer className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-slate-900 font-display">
                        ตั้งค่าพิมพ์ใบนำส่งเอกสาร (Print Delivery Dispatch Slip)
                      </h2>
                      <p className="text-xs text-slate-500">
                        เลือกผู้ให้บริการและช่วงเวลาในการสแกนลงโต๊ะ เพื่อกรองรายการสรุปใบนำส่งสำหรับงานพิมพ์ลายมือชื่อ
                      </p>
                    </div>
                  </div>

                  {/* QUICK SELECTOR GUIDE GRID */}
                  <div className="flex flex-col gap-2.5 bg-slate-50 rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 font-display flex items-center gap-2">
                        <span className="flex h-2.5 w-2.5 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-teal-500"></span>
                        </span>
                        <span>คู่มือเลือกผู้ให้บริการด่วน (พิมพ์ไกด์ทางลัด - คลิกเลือกด่วน)</span>
                      </span>
                      {printDeskFilter && (
                        <button
                          type="button"
                          onClick={() => setPrintDeskFilter('')}
                          className="text-[11px] font-bold text-rose-500 hover:text-rose-700 hover:underline transition cursor-pointer flex items-center gap-1"
                        >
                          <span>ล้างตัวกรอง (Reset)</span>
                        </button>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-1.5">
                      {ALL_PRINTING_PROVIDERS.map((desk, idx) => {
                        const isSelected = printDeskFilter === desk;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setPrintDeskFilter(desk)}
                            className={`py-1.5 px-2 bg-white text-slate-600 border border-slate-200 hover:bg-teal-50 hover:border-teal-300 hover:text-teal-700 text-xs text-left font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                              isSelected
                                ? '!bg-teal-600 !text-white !border-teal-600 shadow-sm scale-[0.98]'
                                : ''
                            }`}
                          >
                            <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-mono shrink-0 ${
                              isSelected ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {idx + 1}
                            </span>
                            <span className="truncate" title={desk}>{desk}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    {/* Desk Selector */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-500 font-display flex items-center gap-1">
                        <span>1. เลือกโต๊ะ/ผู้ให้บริการ</span>
                        <span className="text-rose-500 font-bold">*</span>
                      </label>
                      <select
                        value={printDeskFilter}
                        onChange={(e) => setPrintDeskFilter(e.target.value)}
                        className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 font-semibold focus:border-teal-500 focus:outline-hidden focus:ring-1 focus:ring-teal-500/20"
                      >
                        <option value="">-- โปรดเลือกโต๊ะทำงาน --</option>
                        {ALL_PRINTING_PROVIDERS.map((desk, idx) => (
                          <option key={idx} value={desk}>{desk}</option>
                        ))}
                      </select>
                    </div>

                    {/* Period Selector */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-500 font-display">2. เลือกช่วงเวลาเอกสาร</label>
                      <select
                        value={printPeriodFilter}
                        onChange={(e) => {
                          setPrintPeriodFilter(e.target.value);
                          if (e.target.value !== 'custom') {
                            setPrintStartDate('');
                            setPrintEndDate('');
                          }
                        }}
                        className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-hidden focus:ring-1 focus:ring-teal-500/20"
                      >
                        <option value="today">วันนี้</option>
                        <option value="yesterday">เมื่อวานนี้</option>
                        <option value="week">ในช่วง 7 วันล่าสุด</option>
                        <option value="custom">ระบุช่วงวันที่เอง (กำหนดเอง)</option>
                      </select>
                    </div>

                    {/* Start Date */}
                    <div className={`flex flex-col gap-1.5 transition-all ${printPeriodFilter === 'custom' ? 'opacity-100 pointer-events-auto' : 'opacity-40 pointer-events-none'}`}>
                      <label className="text-xs font-bold text-slate-500 font-display">วันที่เริ่มต้น</label>
                      <input
                        type="date"
                        value={printStartDate}
                        disabled={printPeriodFilter !== 'custom'}
                        onChange={(e) => setPrintStartDate(e.target.value)}
                        className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:border-teal-500 focus:outline-hidden"
                      />
                    </div>

                    {/* End Date */}
                    <div className={`flex flex-col gap-1.5 transition-all ${printPeriodFilter === 'custom' ? 'opacity-100 pointer-events-auto' : 'opacity-40 pointer-events-none'}`}>
                      <label className="text-xs font-bold text-slate-500 font-display">วันที่สิ้นสุด</label>
                      <input
                        type="date"
                        value={printEndDate}
                        disabled={printPeriodFilter !== 'custom'}
                        onChange={(e) => setPrintEndDate(e.target.value)}
                        className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:border-teal-500 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  {/* Row 2: Time Filter */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end border-t border-slate-100 pt-3">
                    {/* Time Round Selector */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-500 font-display flex items-center gap-1">
                        <span>3. เลือกช่วงเวลาจัดส่ง (รอบทำงาน)</span>
                      </label>
                      <select
                        value={printTimeFilterMode}
                        onChange={(e) => {
                          setPrintTimeFilterMode(e.target.value);
                          if (e.target.value === 'morning') {
                            setPrintTimeStart('00:00');
                            setPrintTimeEnd('12:00');
                          } else if (e.target.value === 'afternoon') {
                            setPrintTimeStart('12:01');
                            setPrintTimeEnd('16:00');
                          } else if (e.target.value === 'all') {
                            setPrintTimeStart('00:00');
                            setPrintTimeEnd('23:59');
                          }
                        }}
                        className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-hidden focus:ring-1 focus:ring-teal-500/20"
                      >
                        <option value="all">ทั้งหมด (00:00 - 23:59 น.)</option>
                        <option value="morning">รอบเช้า (00:00 - 12:00 น.)</option>
                        <option value="afternoon">รอบบ่าย (12:01 - 16:00 น.)</option>
                        <option value="custom">กำหนดเวลาเอง (ระบุช่วงเวลา)</option>
                      </select>
                    </div>

                    {/* Start Time */}
                    <div className={`flex flex-col gap-1.5 transition-all ${printTimeFilterMode === 'custom' ? 'opacity-100 pointer-events-auto' : 'opacity-40 pointer-events-none'}`}>
                      <label className="text-xs font-bold text-slate-500 font-display">เวลาเริ่มต้น (HH:MM)</label>
                      <input
                        type="time"
                        value={printTimeStart}
                        disabled={printTimeFilterMode !== 'custom'}
                        onChange={(e) => setPrintTimeStart(e.target.value)}
                        className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:border-teal-500 focus:outline-hidden"
                      />
                    </div>

                    {/* End Time */}
                    <div className={`flex flex-col gap-1.5 transition-all ${printTimeFilterMode === 'custom' ? 'opacity-100 pointer-events-auto' : 'opacity-40 pointer-events-none'}`}>
                      <label className="text-xs font-bold text-slate-500 font-display">เวลาสิ้นสุด (HH:MM)</label>
                      <input
                        type="time"
                        value={printTimeEnd}
                        disabled={printTimeFilterMode !== 'custom'}
                        onChange={(e) => setPrintTimeEnd(e.target.value)}
                        className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:border-teal-500 focus:outline-hidden"
                      />
                    </div>

                    {/* Helper badge */}
                    <div className="text-xs text-slate-400 py-2.5">
                      {printTimeFilterMode === 'all' && <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-sm border font-medium">แสดงเอกสารทุกรอบเวลา</span>}
                      {printTimeFilterMode === 'morning' && <span className="bg-teal-50 text-teal-700 px-2.5 py-1 rounded-sm border border-teal-100 font-semibold">กรองรอบเช้า 00:00 - 12:00 น.</span>}
                      {printTimeFilterMode === 'afternoon' && <span className="bg-amber-50 text-amber-700 px-2.5 py-1 rounded-sm border border-amber-100 font-semibold">กรองรอบบ่าย 12:01 - 16:00 น.</span>}
                      {printTimeFilterMode === 'custom' && <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-sm border border-emerald-100 font-semibold">{`ช่วงเวลา: ${printTimeStart} - ${printTimeEnd} น.`}</span>}
                    </div>
                  </div>
                </div>

                {/* PRINT BUTTON HEADER (HIDDEN ON PRINT) */}
                <div className="flex justify-end print:hidden">
                  <button
                    type="button"
                    onClick={() => {
                      if (!printDeskFilter) {
                        showToast('error', 'โปรดเลือกโต๊ะ/ผู้ให้บริการก่อนแสดงตัวอย่างการพิมพ์');
                        return;
                      }
                      const recs = getFilteredPrintRecords();
                      if (recs.length === 0) {
                        showToast('error', 'ไม่พบรายการเอกสารสำหรับการแสดงตัวอย่างก่อนพิมพ์ ในช่วงเวลาที่ระบุ');
                        return;
                      }
                      setIsPrintPreviewOpen(true);
                    }}
                    className={`flex items-center gap-2.5 font-bold text-sm px-6 py-3.5 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg cursor-pointer ${
                      printDeskFilter 
                        ? 'bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 active:scale-98 text-white' 
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed hover:shadow-none'
                    }`}
                  >
                    <Printer className="w-5 h-5" />
                    <span>แสดงตัวอย่างก่อนพิมพ์และตั้งค่าแบบ Word (Print Preview)</span>
                  </button>
                </div>

                {/* DISPATCH SLIP PRINT PREVIEW CARD */}
                {(() => {
                  if (!printDeskFilter) {
                    return (
                      <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center text-slate-400 font-medium print:hidden">
                        <Printer className="w-12 h-12 mx-auto mb-3 text-slate-300 opacity-80" />
                        <p className="text-base font-semibold text-slate-700">กรุณาเลือกโต๊ะ/ผู้ให้บริการ เพื่อแสดงพรีวิวใบนำส่ง</p>
                        <p className="text-xs text-slate-400 mt-1">ใบนำส่งเอกสารจะถูกสร้างแบบฟอร์มเพื่อลงชื่อสำหรับการจัดส่งจริง</p>
                      </div>
                    );
                  }

                  const matches = getFilteredPrintRecords();

                  if (matches.length === 0) {
                    return (
                      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500 font-medium print:hidden">
                        <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-2" />
                        <p className="text-sm font-bold text-slate-700">ไม่พบรายการเอกสารในเงื่อนไขและช่วงเวลาที่ระบุ</p>
                        <p className="text-xs text-slate-400 mt-1">โปรดลองเปลี่ยนช่วงเวลา หรือตรวจสอบข้อมูลในหน้าประวัติเพิ่มเติม</p>
                      </div>
                    );
                  }

                  const today = new Date();
                  // Formatting period label
                  let periodLabel = '';
                  if (printPeriodFilter === 'today') {
                    periodLabel = `ประจำวันที่ ${today.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}`;
                  } else if (printPeriodFilter === 'yesterday') {
                    const yesterday = new Date();
                    yesterday.setDate(today.getDate() - 1);
                    periodLabel = `ประจำวันที่ ${yesterday.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}`;
                  } else if (printPeriodFilter === 'week') {
                    const sevenDaysAgo = new Date();
                    sevenDaysAgo.setDate(today.getDate() - 7);
                    periodLabel = `ตั้งแต่วันที่ ${sevenDaysAgo.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} ถึงวันที่ ${today.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}`;
                  } else {
                    const startStr = printStartDate ? new Date(printStartDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : 'เริ่มต้น';
                    const endStr = printEndDate ? new Date(printEndDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : 'ปัจจุบัน';
                    periodLabel = `ช่วงวันที่ ${startStr} ถึง ${endStr}`;
                  }

                  // 3. Chunk items into sets of 50 for page-by-page printing
                  const CHUNK_SIZE = 50;
                  const chunks: typeof matches[] = [];
                  for (let i = 0; i < matches.length; i += CHUNK_SIZE) {
                    chunks.push(matches.slice(i, i + CHUNK_SIZE));
                  }

                  return (
                    <div className="flex flex-col gap-8 w-full printable-slip print:p-0 print:border-none print:shadow-none print:bg-white">
                      {chunks.map((chunk, chunkIdx) => {
                        const totalPages = chunks.length;
                        return (
                          <div
                            key={chunkIdx}
                            className={`bg-white border border-slate-300 rounded-xl p-8 shadow-sm flex flex-col gap-5 printable-slip-page print:p-0 print:border-none print:shadow-none print:rounded-none ${
                              chunkIdx < totalPages - 1 ? 'page-break' : ''
                            }`}
                          >
                            {/* SLIP LOGO & TITLE */}
                            <div className="flex flex-col items-center justify-center text-center gap-1 border-b-2 border-double border-slate-300 pb-4">
                              <div className="w-12 h-12 bg-slate-900 text-white rounded-xl flex items-center justify-center font-bold text-lg mb-2 print:border print:border-slate-300">
                                FA
                              </div>
                              <h1 className="text-lg font-bold text-slate-900 tracking-tight font-display">
                                ใบนำส่งและตรวจสอบเอกสารการรับเงิน/บัญชี
                              </h1>
                              <p className="text-xs text-slate-500 font-medium">
                                ส่วนการเงินและบัญชี มหาวิทยาลัยแม่ฟ้าหลวง (Mae Fah Luang University)
                              </p>
                              
                              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 mt-3 text-[11px] text-slate-600 font-mono">
                                <span className="bg-slate-100 px-2.5 py-0.5 rounded-sm border border-slate-200">
                                  ผู้ให้บริการ: <strong className="text-slate-800">{printDeskFilter}</strong>
                                </span>
                                <span>•</span>
                                <span>{periodLabel}</span>
                                <span>•</span>
                                <span className="bg-slate-100 px-2.5 py-0.5 rounded-sm border border-slate-200">
                                  รอบส่งงาน: <strong className="text-slate-800">
                                    {printTimeFilterMode === 'all' && 'ทั้งหมด (00:00 - 23:59 น.)'}
                                    {printTimeFilterMode === 'morning' && 'รอบเช้า (00:00 - 12:00 น.)'}
                                    {printTimeFilterMode === 'afternoon' && 'รอบบ่าย (12:01 - 16:00 น.)'}
                                    {printTimeFilterMode === 'custom' && `กำหนดเอง (${printTimeStart} - ${printTimeEnd} น.)`}
                                  </strong>
                                </span>
                                <span>•</span>
                                <span className="font-bold text-teal-700 bg-teal-50 border border-teal-100 px-2 py-0.5 rounded-sm">
                                  รายการที่: {chunkIdx * CHUNK_SIZE + 1} - {Math.min((chunkIdx + 1) * CHUNK_SIZE, matches.length)} (หน้า {chunkIdx + 1}/{totalPages})
                                </span>
                                <span>•</span>
                                <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-sm">
                                  ทั้งหมด: {matches.length} รายการ
                                </span>
                              </div>
                            </div>

                            {/* DOCUMENTS SLIP TABLE */}
                            <div className="overflow-x-auto flex-1">
                              <table className="w-full text-[11px] text-left border-collapse border border-slate-400 table-fixed">
                                <thead>
                                  <tr className="bg-slate-100 text-slate-700 border-b border-slate-400 font-bold">
                                    <th className="border border-slate-400 px-2 py-2 text-center w-[5%]">ลำดับ</th>
                                    <th className="border border-slate-400 px-2 py-2 w-[11%]">เลขทะเบียนรับ</th>
                                    <th className="border border-slate-400 px-2 py-2 w-[14%]">เลขที่อว</th>
                                    <th className="border border-slate-400 px-2 py-2 w-[28%]">หน่วยงาน</th>
                                    <th className="border border-slate-400 px-2 py-2 w-[10%]">เลขที่เอกสาร</th>
                                    <th className="border border-slate-400 px-2 py-2 w-[10%]">ประเภทเอกสาร</th>
                                    <th className="border border-slate-400 px-2 py-2 w-[9%] text-center">วันที่ส่ง</th>
                                    <th className="border border-slate-400 px-2 py-2 w-[13%] text-center">ลายเซ็นผู้รับเอกสาร</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-300">
                                  {chunk.map((item, idx) => {
                                    const d = item.data;
                                    const globalIdx = chunkIdx * CHUNK_SIZE + idx + 1;
                                    return (
                                      <tr key={idx} className="hover:bg-slate-50/20 print:hover:bg-transparent">
                                        <td className="border border-slate-400 px-2 py-1.5 text-center font-bold text-slate-500 font-mono">
                                          {globalIdx}
                                        </td>
                                        <td className="border border-slate-400 px-2 py-1.5 font-mono font-bold text-slate-900 break-all">
                                          {d.barcode}
                                        </td>
                                        <td className="border border-slate-400 px-2 py-1.5 font-medium text-slate-700 leading-tight break-words">
                                          {d.mhesiNumber || '-'}
                                        </td>
                                        <td className="border border-slate-400 px-2 py-1.5 text-slate-800 leading-tight break-words font-semibold">
                                          {d.agency || '-'}
                                        </td>
                                        <td className="border border-slate-400 px-2 py-1.5 font-mono text-slate-600 leading-tight break-words">
                                          {d.docNumber || '-'}
                                        </td>
                                        <td className="border border-slate-400 px-2 py-1.5 text-slate-500 leading-tight break-words">
                                          {d.docType || '-'}
                                        </td>
                                        <td className="border border-slate-400 px-2 py-1.5 font-mono text-slate-500 text-center whitespace-normal leading-tight">
                                          {d.tableDate ? d.tableDate.split(' ')[0] : '-'}
                                          {(() => {
                                            const timeParsed = parseTimeFromDateString(d.tableDate || d.receiveDate || '');
                                            if (timeParsed) {
                                              const hrStr = String(timeParsed.hour).padStart(2, '0');
                                              const minStr = String(timeParsed.minute).padStart(2, '0');
                                              return <div className="text-[9px] text-slate-400 mt-0.5">{hrStr}:{minStr} น.</div>;
                                            }
                                            return null;
                                          })()}
                                        </td>
                                        <td className="border border-slate-400 px-2 py-1.5 text-center h-9 print:h-10 bg-slate-50/20">
                                          <div className="w-full h-3.5 border-b border-dashed border-slate-300 opacity-50 mt-1"></div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>

                            {/* FOOTER SIGNATURE SECTION */}
                            <div className="grid grid-cols-2 gap-8 mt-6 pt-5 border-t border-slate-300 print:mt-4 print:pt-4">
                              <div className="flex flex-col items-center justify-center text-center gap-1">
                                <span className="text-[10px] font-bold text-slate-500">ลงชื่อผู้ส่งมอบเอกสาร (เจ้าหน้าที่ทะเบียน)</span>
                                <div className="h-8 w-44 border-b border-dashed border-slate-400 mt-1"></div>
                                <span className="text-[10px] text-slate-700 font-semibold mt-1">
                                  (......................................................)
                                </span>
                                <span className="text-[9px] text-slate-400">วันที่: ......./......./....... เวลา: ................ น.</span>
                              </div>
                              
                              <div className="flex flex-col items-center justify-center text-center gap-1">
                                <span className="text-[10px] font-bold text-slate-500">ลงชื่อผู้รับมอบเอกสาร (เจ้าหน้าที่ผู้ตรวจจ่าย)</span>
                                <div className="h-8 w-44 border-b border-dashed border-slate-400 mt-1"></div>
                                <span className="text-[10px] text-slate-700 font-semibold mt-1">
                                  (......................................................)
                                </span>
                                <span className="text-[9px] text-slate-400">วันที่: ......./......./....... เวลา: ................ น.</span>
                              </div>
                            </div>

                            {/* PRINT-ONLY FOOTER TIMESTAMP */}
                            <div className="hidden print:flex items-center justify-between text-[8px] text-slate-400 mt-4 font-mono border-t border-slate-100 pt-1.5">
                              <span>หน้า {chunkIdx + 1} จาก {totalPages}</span>
                              <span>พิมพ์โดยระบบธุรการ FA Central Admin เมื่อ {getThaiDateTimeString()}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* TAB 9: รายงานสรุป-EP */}
            {activeTab === 9 && (
              <div className="flex flex-col gap-6">
                {/* HEADER BANNER */}
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600 shrink-0">
                      <PieChart className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold text-slate-900 font-display">
                          รายงานสรุป-EP (สรุปภาระงานใหญ่และงานด่วน)
                        </h2>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-100 text-purple-700 border border-purple-200">
                          EP SUMMARY
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        วิเคราะห์การกระจายงานใหญ่และงานด่วนตามผู้ให้บริการ เพื่อการบริหารจัดการและมอบหมายงานอย่างมีประสิทธิภาพ
                      </p>
                    </div>
                  </div>

                  {accessToken && (
                    <button
                      type="button"
                      onClick={() => loadDashboardStats(accessToken, spreadsheetId)}
                      disabled={isLoadingStats}
                      className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs text-purple-700 bg-purple-50 hover:bg-purple-100 disabled:opacity-50 transition-colors rounded-lg font-medium font-display cursor-pointer shrink-0"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingStats ? 'animate-spin' : ''}`} />
                      <span>อัปเดตข้อมูล</span>
                    </button>
                  )}
                </div>

                {/* CODE EP LEGEND BANNER */}
                <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-white/10 rounded-xl text-amber-300 shrink-0 backdrop-blur-xs">
                      <Award className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white font-display flex items-center gap-2">
                        <span>รหัสประเภทงาน EP ในระบบ</span>
                      </h3>
                      <p className="text-xs text-purple-200/90 mt-0.5">
                        ใช้จำแนกความสำคัญและขนาดชุดเอกสารเพื่อคำนวณภาระงาน
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 shrink-0">
                    <div className="bg-white/10 border border-white/15 rounded-xl px-3 py-2 flex items-center gap-2.5 backdrop-blur-xs">
                      <span className="w-6 h-6 rounded-lg bg-rose-500 text-white text-xs font-mono font-bold flex items-center justify-center shrink-0">
                        1
                      </span>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-white">EP 1</span>
                        <span className="text-[10px] text-rose-200 font-medium">งานด่วน</span>
                      </div>
                    </div>

                    <div className="bg-white/10 border border-white/15 rounded-xl px-3 py-2 flex items-center gap-2.5 backdrop-blur-xs">
                      <span className="w-6 h-6 rounded-lg bg-purple-500 text-white text-xs font-mono font-bold flex items-center justify-center shrink-0">
                        2
                      </span>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-white">EP 2</span>
                        <span className="text-[10px] text-purple-200 font-medium">งานเก่าด่วน</span>
                      </div>
                    </div>

                    <div className="bg-white/10 border border-white/15 rounded-xl px-3 py-2 flex items-center gap-2.5 backdrop-blur-xs">
                      <span className="w-6 h-6 rounded-lg bg-amber-500 text-white text-xs font-mono font-bold flex items-center justify-center shrink-0">
                        3
                      </span>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-white">EP 3</span>
                        <span className="text-[10px] text-amber-200 font-medium">งานใหญ่</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* COMPUTATIONS & METRICS */}
                {(() => {
                  const today = new Date();
                  const targetYear = today.getFullYear();
                  const targetMonth = today.getMonth() + 1;
                  const targetDay = today.getDate();

                  // Filter all records with EP (or filtered)
                  const allEpRecords = allStatsRecords.filter(item => {
                    const d = item.data;
                    const epCode = String(d.ep || '').trim();
                    // Consider valid EP code if non-empty and not just N/O
                    return Boolean(epCode && epCode !== 'N' && epCode !== 'O');
                  });

                  // Period Filter
                  const filteredByPeriod = allEpRecords.filter(item => {
                    if (epReportPeriodFilter === 'all') return true;
                    const dateStr = item.data.receiveDate;
                    if (!dateStr) return false;
                    const parsed = parseThaiOrIsoDate(dateStr);
                    if (!parsed) return false;

                    if (epReportPeriodFilter === 'today') {
                      return parsed.year === targetYear && parsed.month === targetMonth && parsed.day === targetDay;
                    }
                    if (epReportPeriodFilter === 'month') {
                      return parsed.year === targetYear && parsed.month === targetMonth;
                    }
                    return true;
                  });

                  // Overall counts
                  const totalEpCount = filteredByPeriod.length;
                  const ep1Count = filteredByPeriod.filter(i => String(i.data.ep).trim() === '1').length;
                  const ep2Count = filteredByPeriod.filter(i => String(i.data.ep).trim() === '2').length;
                  const ep3Count = filteredByPeriod.filter(i => String(i.data.ep).trim() === '3').length;

                  // Compute summary per provider desk
                  const knownDesks = [...PROVIDER_DESKS];
                  const extraDesks = Array.from(new Set(
                    filteredByPeriod.map(i => String(i.data.finalDesk || i.data.autoDesk || '')).filter(Boolean)
                  )).filter((d: string) => !knownDesks.includes(d as any));

                  const deskListToAnalyze = [...knownDesks, ...extraDesks];

                  const providerStats = deskListToAnalyze.map(desk => {
                    const deskRecords = filteredByPeriod.filter(i => (i.data.finalDesk || i.data.autoDesk) === desk);
                    const c1 = deskRecords.filter(i => String(i.data.ep).trim() === '1').length;
                    const c2 = deskRecords.filter(i => String(i.data.ep).trim() === '2').length;
                    const c3 = deskRecords.filter(i => String(i.data.ep).trim() === '3').length;
                    const cOther = deskRecords.filter(i => {
                      const code = String(i.data.ep).trim();
                      return code !== '1' && code !== '2' && code !== '3';
                    }).length;
                    const pendingCount = deskRecords.filter(i => {
                      const st = String(i.data.returnStatus || '').trim();
                      return !st || st === '-' || st === 'ไม่เลือก';
                    }).length;
                    
                    const isActive = !inactiveProviders.includes(desk);

                    return {
                      desk,
                      total: deskRecords.length,
                      c1,
                      c2,
                      c3,
                      cOther,
                      pendingCount,
                      isActive
                    };
                  });

                  // Find active desk with min total EP
                  const activeStats = providerStats.filter(p => p.isActive && PROVIDER_DESKS.includes(p.desk as any));
                  let recommendedDesk = activeStats.length > 0 ? activeStats[0] : null;
                  if (activeStats.length > 0) {
                    recommendedDesk = activeStats.reduce((min, cur) => (cur.total < min.total ? cur : min), activeStats[0]);
                  }

                  const maxDeskTotal = Math.max(...providerStats.map(p => p.total), 1);

                  // Filtered items for detailed table
                  let detailedItems = filteredByPeriod.filter(item => {
                    const d = item.data;
                    const code = String(d.ep || '').trim();

                    // EP Type Filter
                    if (epReportTypeFilter !== 'all') {
                      if (epReportTypeFilter === 'other') {
                        if (code === '1' || code === '2' || code === '3') return false;
                      } else {
                        if (code !== epReportTypeFilter) return false;
                      }
                    }

                    // Desk Filter
                    if (epReportDeskFilter !== 'all') {
                      if ((d.finalDesk || d.autoDesk) !== epReportDeskFilter) return false;
                    }

                    // Status Filter
                    if (epReportStatusFilter !== 'all') {
                      const retStatus = String(d.returnStatus || '').trim();
                      const isRet = retStatus && retStatus !== '-' && retStatus !== 'ไม่เลือก';
                      if (epReportStatusFilter === 'returned' && !isRet) return false;
                      if (epReportStatusFilter === 'pending' && isRet) return false;
                    }

                    // Search Query
                    if (epReportSearchQuery.trim()) {
                      const q = epReportSearchQuery.toLowerCase().trim();
                      const match = 
                        (d.barcode || '').toLowerCase().includes(q) ||
                        (d.mhesiNumber || '').toLowerCase().includes(q) ||
                        (d.docNumber || '').toLowerCase().includes(q) ||
                        (d.agency || '').toLowerCase().includes(q) ||
                        (d.docType || '').toLowerCase().includes(q) ||
                        (d.finalDesk || '').toLowerCase().includes(q) ||
                        (d.remarks || '').toLowerCase().includes(q);
                      if (!match) return false;
                    }

                    return true;
                  });

                  // Reverse to show newest first
                  detailedItems = [...detailedItems].reverse();

                  const totalDetailed = detailedItems.length;
                  const totalPages = Math.max(1, Math.ceil(totalDetailed / EP_REPORT_ITEMS_PER_PAGE));
                  const currentPage = Math.min(epReportPage, totalPages);
                  const startIndex = (currentPage - 1) * EP_REPORT_ITEMS_PER_PAGE;
                  const paginatedItems = detailedItems.slice(startIndex, startIndex + EP_REPORT_ITEMS_PER_PAGE);

                  return (
                    <>
                      {/* STATS OVERVIEW CARDS */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Total EP */}
                        <div 
                          onClick={() => setEpReportTypeFilter('all')}
                          className={`bg-white p-5 rounded-2xl border transition-all cursor-pointer shadow-xs hover:shadow-md ${
                            epReportTypeFilter === 'all' ? 'border-purple-500 ring-2 ring-purple-500/20 bg-purple-50/20' : 'border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between text-slate-500 text-xs font-bold font-display">
                            <span>เอกสาร EP ทั้งหมด</span>
                            <PieChart className="w-4 h-4 text-purple-600" />
                          </div>
                          <div className="flex items-baseline gap-2 mt-3">
                            <span className="text-3xl font-extrabold text-slate-900 font-sans tracking-tight">
                              {totalEpCount.toLocaleString('th-TH')}
                            </span>
                            <span className="text-xs text-slate-500 font-medium">ชุด/รายการ</span>
                          </div>
                          <div className="mt-3 text-[11px] text-slate-400">
                            รวมงานใหญ่และงานด่วนตามตัวกรอง
                          </div>
                        </div>

                        {/* EP 1 */}
                        <div 
                          onClick={() => setEpReportTypeFilter('1')}
                          className={`bg-white p-5 rounded-2xl border transition-all cursor-pointer shadow-xs hover:shadow-md ${
                            epReportTypeFilter === '1' ? 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/20' : 'border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between text-rose-700 text-xs font-bold font-display">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                              <span>EP 1: งานด่วน</span>
                            </span>
                            <Zap className="w-4 h-4 text-rose-600" />
                          </div>
                          <div className="flex items-baseline gap-2 mt-3">
                            <span className="text-3xl font-extrabold text-rose-900 font-sans tracking-tight">
                              {ep1Count.toLocaleString('th-TH')}
                            </span>
                            <span className="text-xs text-rose-600 font-medium">ชุด</span>
                          </div>
                          <div className="mt-3 text-[11px] text-rose-600/80 font-medium flex items-center gap-1">
                            <span>คลิกเพื่อกรองงานด่วน</span>
                          </div>
                        </div>

                        {/* EP 2 */}
                        <div 
                          onClick={() => setEpReportTypeFilter('2')}
                          className={`bg-white p-5 rounded-2xl border transition-all cursor-pointer shadow-xs hover:shadow-md ${
                            epReportTypeFilter === '2' ? 'border-purple-500 ring-2 ring-purple-500/20 bg-purple-50/20' : 'border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between text-purple-700 text-xs font-bold font-display">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                              <span>EP 2: งานเก่าด่วน</span>
                            </span>
                            <Award className="w-4 h-4 text-purple-600" />
                          </div>
                          <div className="flex items-baseline gap-2 mt-3">
                            <span className="text-3xl font-extrabold text-purple-900 font-sans tracking-tight">
                              {ep2Count.toLocaleString('th-TH')}
                            </span>
                            <span className="text-xs text-purple-600 font-medium">ชุด</span>
                          </div>
                          <div className="mt-3 text-[11px] text-purple-600/80 font-medium flex items-center gap-1">
                            <span>คลิกเพื่อกรองงานเก่าด่วน</span>
                          </div>
                        </div>

                        {/* EP 3 */}
                        <div 
                          onClick={() => setEpReportTypeFilter('3')}
                          className={`bg-white p-5 rounded-2xl border transition-all cursor-pointer shadow-xs hover:shadow-md ${
                            epReportTypeFilter === '3' ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/20' : 'border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between text-amber-800 text-xs font-bold font-display">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                              <span>EP 3: งานใหญ่</span>
                            </span>
                            <Layers className="w-4 h-4 text-amber-600" />
                          </div>
                          <div className="flex items-baseline gap-2 mt-3">
                            <span className="text-3xl font-extrabold text-amber-900 font-sans tracking-tight">
                              {ep3Count.toLocaleString('th-TH')}
                            </span>
                            <span className="text-xs text-amber-700 font-medium">ชุด</span>
                          </div>
                          <div className="mt-3 text-[11px] text-amber-700/80 font-medium flex items-center gap-1">
                            <span>คลิกเพื่อกรองงานใหญ่</span>
                          </div>
                        </div>
                      </div>

                      {/* WORKLOAD RECOMMENDATION BOX */}
                      {recommendedDesk && (
                        <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-sky-500/10 border border-emerald-300/80 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-3.5">
                            <div className="w-11 h-11 bg-emerald-600 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm">
                              <Sparkles className="w-6 h-6 animate-pulse" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide font-mono bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200">
                                  คำแนะนำมอบหมายงานถัดไป
                                </span>
                                <span className="text-xs text-slate-500">
                                  (วิเคราะห์จากโต๊ะทำงานเปิดให้บริการ)
                                </span>
                              </div>
                              <h4 className="text-base font-extrabold text-slate-900 font-display mt-1">
                                โต๊ะทำงานที่ได้รับงาน EP น้อยที่สุด: <span className="text-emerald-700 underline decoration-emerald-400 decoration-2">{recommendedDesk.desk}</span>
                              </h4>
                              <p className="text-xs text-slate-600 mt-0.5">
                                ปัจจุบันรับภาระงาน EP ไปแล้ว <strong className="text-emerald-800 font-sans">{recommendedDesk.total} ชุด</strong> (งานด่วน EP1: {recommendedDesk.c1}, EP2: {recommendedDesk.c2}, งานใหญ่ EP3: {recommendedDesk.c3})
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setEpReportDeskFilter(recommendedDesk.desk)}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer shrink-0 flex items-center gap-1.5"
                          >
                            <span>ดูรายการโต๊ะนี้</span>
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      {/* PROVIDER DESK WORKLOAD SUMMARY TABLE */}
                      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 flex flex-col gap-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                          <div className="flex items-center gap-2.5">
                            <div className="p-1.5 bg-purple-50 rounded-lg text-purple-600 shrink-0">
                              <Users className="w-5 h-5" />
                            </div>
                            <div>
                              <h3 className="text-sm font-bold text-slate-900 font-display">
                                ตารางสรุปภาระงาน EP แยกตามผู้ให้บริการ (โต๊ะทำงาน 1-9)
                              </h3>
                              <p className="text-xs text-slate-400">
                                แสดงจำนวนชุดงานด่วนและงานใหญ่ที่แต่ละคนได้รับมอบหมาย เพื่อเปรียบเทียบภาระงาน
                              </p>
                            </div>
                          </div>

                          {epReportDeskFilter !== 'all' && (
                            <button
                              type="button"
                              onClick={() => setEpReportDeskFilter('all')}
                              className="text-xs font-bold text-purple-600 hover:text-purple-800 hover:underline transition cursor-pointer flex items-center gap-1"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>แสดงโต๊ะทำงานทั้งหมด</span>
                            </button>
                          )}
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                          <table className="w-full text-left border-collapse min-w-[750px]">
                            <thead>
                              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                                <th className="px-4 py-3">ผู้ให้บริการ (โต๊ะ)</th>
                                <th className="px-3 py-3 text-center text-rose-700">EP 1 (งานด่วน)</th>
                                <th className="px-3 py-3 text-center text-purple-700">EP 2 (งานเก่าด่วน)</th>
                                <th className="px-3 py-3 text-center text-amber-800">EP 3 (งานใหญ่)</th>
                                <th className="px-3 py-3 text-center text-blue-700">EP อื่นๆ</th>
                                <th className="px-4 py-3 text-center text-slate-900 font-extrabold bg-slate-100/80">รวม EP ทั้งหมด</th>
                                <th className="px-4 py-3 text-center text-amber-700">ยังไม่ส่งคืน</th>
                                <th className="px-4 py-3 w-[25%]">สัดส่วนภาระงาน</th>
                                <th className="px-4 py-3 text-center">จัดการ</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs font-sans">
                              {providerStats.map((p, idx) => {
                                const isSelected = epReportDeskFilter === p.desk;
                                const isRecommended = recommendedDesk && recommendedDesk.desk === p.desk;
                                const pct = maxDeskTotal > 0 ? Math.round((p.total / maxDeskTotal) * 100) : 0;

                                return (
                                  <tr 
                                    key={idx} 
                                    onClick={() => setEpReportDeskFilter(isSelected ? 'all' : p.desk)}
                                    className={`hover:bg-slate-50 transition-colors cursor-pointer ${
                                      isSelected ? 'bg-purple-50/60 font-semibold' : ''
                                    }`}
                                  >
                                    <td className="px-4 py-3 font-bold text-slate-900 flex items-center gap-2">
                                      <span>{p.desk}</span>
                                      {!p.isActive && (
                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-400 border border-slate-200">
                                          ปิด/ลา
                                        </span>
                                      )}
                                      {isRecommended && (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                                          <Sparkles className="w-3 h-3 text-emerald-600" />
                                          <span>แนะถัดไป</span>
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-3 py-3 text-center font-mono font-bold text-rose-600">
                                      {p.c1 > 0 ? p.c1 : '-'}
                                    </td>
                                    <td className="px-3 py-3 text-center font-mono font-bold text-purple-600">
                                      {p.c2 > 0 ? p.c2 : '-'}
                                    </td>
                                    <td className="px-3 py-3 text-center font-mono font-bold text-amber-700">
                                      {p.c3 > 0 ? p.c3 : '-'}
                                    </td>
                                    <td className="px-3 py-3 text-center font-mono font-medium text-blue-600">
                                      {p.cOther > 0 ? p.cOther : '-'}
                                    </td>
                                    <td className="px-4 py-3 text-center font-mono font-extrabold text-slate-900 text-sm bg-slate-50/70">
                                      {p.total}
                                    </td>
                                    <td className="px-4 py-3 text-center font-mono font-semibold text-amber-700">
                                      {p.pendingCount}
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-2">
                                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                          <div 
                                            className={`h-full rounded-full transition-all duration-500 ${
                                              pct > 75 ? 'bg-rose-500' : pct > 40 ? 'bg-amber-500' : 'bg-emerald-500'
                                            }`}
                                            style={{ width: `${pct}%` }}
                                          />
                                        </div>
                                        <span className="text-[10px] text-slate-400 font-mono w-8 text-right">
                                          {pct}%
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEpReportDeskFilter(isSelected ? 'all' : p.desk);
                                        }}
                                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                                          isSelected
                                            ? 'bg-purple-600 text-white'
                                            : 'bg-slate-100 hover:bg-purple-50 text-slate-700 hover:text-purple-700'
                                        }`}
                                      >
                                        {isSelected ? 'เลือกอยู่' : 'กรองโต๊ะนี้'}
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* DETAILED EP RECORDS LIST & FILTERS */}
                      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 flex flex-col gap-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                          <div className="flex items-center gap-2.5">
                            <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600 shrink-0">
                              <FileText className="w-5 h-5" />
                            </div>
                            <div>
                              <h3 className="text-sm font-bold text-slate-900 font-display">
                                รายการเอกสาร EP รายละเอียดทั้งหมด ({totalDetailed.toLocaleString('th-TH')} รายการ)
                              </h3>
                              <p className="text-xs text-slate-400">
                                รายการเอกสารงานด่วนและงานใหญ่ตามเงื่อนไข สามารถค้นหาและตรวจสอบสถานะได้
                              </p>
                            </div>
                          </div>

                          {/* FILTERS BAR */}
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Search */}
                            <div className="relative flex-1 sm:w-52">
                              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                              <input
                                type="text"
                                placeholder="ค้นหาเลขรับ, อว, หน่วยงาน..."
                                value={epReportSearchQuery}
                                onChange={(e) => {
                                  setEpReportSearchQuery(e.target.value);
                                  setEpReportPage(1);
                                }}
                                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-purple-500 focus:bg-white transition"
                              />
                              {epReportSearchQuery && (
                                <button
                                  onClick={() => setEpReportSearchQuery('')}
                                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>

                            {/* Period Filter */}
                            <select
                              value={epReportPeriodFilter}
                              onChange={(e) => {
                                setEpReportPeriodFilter(e.target.value);
                                setEpReportPage(1);
                              }}
                              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-medium focus:outline-hidden focus:border-purple-500"
                            >
                              <option value="all">ช่วงเวลา: ทั้งหมด</option>
                              <option value="today">ช่วงเวลา: วันนี้</option>
                              <option value="month">ช่วงเวลา: เดือนนี้</option>
                            </select>

                            {/* EP Type Filter */}
                            <select
                              value={epReportTypeFilter}
                              onChange={(e) => {
                                setEpReportTypeFilter(e.target.value);
                                setEpReportPage(1);
                              }}
                              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-medium focus:outline-hidden focus:border-purple-500"
                            >
                              <option value="all">ประเภท EP: ทุกรหัส</option>
                              <option value="1">EP 1 = งานด่วน</option>
                              <option value="2">EP 2 = งานเก่าด่วน</option>
                              <option value="3">EP 3 = งานใหญ่</option>
                              <option value="other">EP อื่นๆ</option>
                            </select>

                            {/* Desk Filter */}
                            <select
                              value={epReportDeskFilter}
                              onChange={(e) => {
                                setEpReportDeskFilter(e.target.value);
                                setEpReportPage(1);
                              }}
                              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-medium focus:outline-hidden focus:border-purple-500 max-w-[160px] truncate"
                            >
                              <option value="all">ผู้ให้บริการ: ทั้งหมด</option>
                              {ALL_PRINTING_PROVIDERS.map((d, i) => (
                                <option key={i} value={d}>{d}</option>
                              ))}
                            </select>

                            {/* Status Filter */}
                            <select
                              value={epReportStatusFilter}
                              onChange={(e) => {
                                setEpReportStatusFilter(e.target.value);
                                setEpReportPage(1);
                              }}
                              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-medium focus:outline-hidden focus:border-purple-500"
                            >
                              <option value="all">สถานะ: ทั้งหมด</option>
                              <option value="pending">ยังไม่ส่งคืน (รอดำเนินการ)</option>
                              <option value="returned">ส่งคืนแล้ว</option>
                            </select>
                          </div>
                        </div>

                        {/* TABLE DATA */}
                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                          <table className="w-full text-left border-collapse table-fixed min-w-[950px]">
                            <thead>
                              <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                                <th className="px-3 py-3 text-center w-[5%]">N/O</th>
                                <th className="px-3 py-3 text-center w-[11%]">รหัส EP</th>
                                <th className="px-4 py-3 w-[12%]">เลขทะเบียนรับ</th>
                                <th className="px-4 py-3 w-[13%]">เลขที่ อว / ชื่อ</th>
                                <th className="px-4 py-3 w-[22%]">หน่วยงาน</th>
                                <th className="px-4 py-3 w-[11%]">ประเภทเอกสาร</th>
                                <th className="px-4 py-3 w-[7%]">วันที่รับ</th>
                                <th className="px-4 py-3 w-[10%]">ผู้ให้บริการ</th>
                                <th className="px-4 py-3 text-center w-[9%]">จัดการ</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs font-sans">
                              {paginatedItems.length === 0 ? (
                                <tr>
                                  <td colSpan={9} className="px-4 py-12 text-center text-slate-400 font-medium">
                                    ไม่พบรายการเอกสาร EP ที่ตรงกับเงื่อนไข
                                  </td>
                                </tr>
                              ) : (
                                paginatedItems.map((item, idx) => {
                                  const d = item.data;
                                  const epInfo = getEpInfo(d.ep);

                                  return (
                                    <tr 
                                      key={item.id ? `${item.id}-${d.barcode || ''}-${idx}` : `${d.barcode || ''}-${d.receiveDate || ''}-${idx}`}
                                      onClick={() => {
                                        setEditingHistoryRecord(item);
                                        setEditingHistoryData({ ...d });
                                      }}
                                      className="hover:bg-slate-50/90 transition-colors cursor-pointer group"
                                    >
                                      <td className="px-3 py-2.5 text-center">
                                        <span className={`px-1.5 py-0.5 rounded-sm text-[10px] font-bold ${
                                          (d.noType || 'N') === 'O' 
                                            ? 'bg-purple-50 text-purple-700 border border-purple-200' 
                                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        }`}>
                                          {d.noType || 'N'}
                                        </span>
                                      </td>
                                      <td className="px-3 py-2.5 text-center">
                                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${epInfo.badgeBg}`}>
                                          {epInfo.label}
                                        </span>
                                      </td>
                                      <td className="px-4 py-2.5 font-mono font-bold text-slate-900 break-all">
                                        {d.barcode}
                                      </td>
                                      <td className="px-4 py-2.5 font-mono text-slate-700 break-all">
                                        {d.mhesiNumber || '-'}
                                      </td>
                                      <td className="px-4 py-2.5 text-slate-700 truncate" title={d.agency}>
                                        {d.agency || '-'}
                                      </td>
                                      <td className="px-4 py-2.5 text-slate-600 truncate" title={d.docType}>
                                        {d.docType || '-'}
                                      </td>
                                      <td className="px-4 py-2.5 font-mono text-slate-500 text-[11px]">
                                        {d.receiveDate || '-'}
                                      </td>
                                      <td className="px-4 py-2.5 font-semibold text-slate-800 truncate">
                                        {d.finalDesk || d.autoDesk || '-'}
                                      </td>
                                      <td className="px-4 py-2.5 text-center">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingHistoryRecord(item);
                                            setEditingHistoryData({ ...d });
                                          }}
                                          className="inline-flex items-center gap-1 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold px-2 py-1 rounded-md transition cursor-pointer text-[11px]"
                                        >
                                          <Pencil className="w-3 h-3" />
                                          <span>แก้ไข</span>
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })
                              )}

                              {/* PAGINATION FOOTER */}
                              <tr>
                                <td colSpan={9} className="px-4 py-3 bg-slate-50/50 border-t border-slate-200">
                                  <div className="flex items-center justify-between">
                                    <div className="text-[11px] text-slate-500 font-medium">
                                      แสดงข้อมูล {totalDetailed === 0 ? 0 : startIndex + 1} ถึง {Math.min(startIndex + EP_REPORT_ITEMS_PER_PAGE, totalDetailed)} จากทั้งหมด {totalDetailed.toLocaleString('th-TH')} รายการ
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        disabled={currentPage === 1}
                                        onClick={() => setEpReportPage(prev => Math.max(1, prev - 1))}
                                        className="p-1 text-slate-500 hover:text-slate-800 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                                      >
                                        <ChevronLeft className="w-5 h-5" />
                                      </button>
                                      <span className="text-xs font-bold text-slate-600 px-2">
                                        หน้า {currentPage} / {totalPages}
                                      </span>
                                      <button
                                        type="button"
                                        disabled={currentPage === totalPages}
                                        onClick={() => setEpReportPage(prev => Math.min(totalPages, prev + 1))}
                                        className="p-1 text-slate-500 hover:text-slate-800 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                                      >
                                        <ChevronRight className="w-5 h-5" />
                                      </button>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {/* TAB 10: SETTINGS & USER PERMISSIONS & DATABASE MANAGEMENT */}
            {activeTab === 10 && (
              <SettingsView
                user={user}
                currentUserRole={currentUserRole}
                spreadsheetId={spreadsheetId}
                spreadsheetName={spreadsheetName}
                onUpdateSpreadsheetId={(newId) => {
                  setSpreadsheetId(newId);
                }}
                permissionsList={permissionsList}
                permissionRequests={permissionRequests}
                isLoadingPermissions={isLoadingPermissions}
                onRefreshPermissions={refreshPermissions}
                showToast={(text, type) => showToast(type || 'info', text)}
                isDarkMode={isDarkMode}
              />
            )}

            {/* FEEDBACK NOTIFICATION AREA */}
            {saveSuccess && (
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center gap-3 text-sm text-emerald-800 shadow-xs animate-in slide-in-from-bottom-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <p className="font-bold">เสร็จสิ้น!</p>
                  <p className="text-xs text-slate-600 mt-0.5">{saveSuccess}</p>
                </div>
              </div>
            )}

            {saveError && (
              <div className="p-4 bg-rose-50 rounded-xl border border-rose-200 flex items-center gap-3 text-sm text-rose-800 shadow-xs animate-in slide-in-from-bottom-2">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <div>
                  <p className="font-bold font-display">การส่งข้อมูลผิดพลาด</p>
                  <p className="text-xs text-slate-600 mt-0.5">{saveError}</p>
                </div>
              </div>
            )}

          </div> {/* END OF RIGHT COLUMN */}
        </div> {/* END OF 2-COLUMN SIDEBAR & WORKSPACE GRID */}
      </main>

      {/* FOOTER */}
      <footer className="mt-auto bg-white border-t border-slate-200 py-6">
        <div className="max-w-[98%] mx-auto px-4 text-center text-xs text-slate-400 font-mono">
          <p>ระบบธุรการส่วนการเงินและบัญชี มหาวิทยาลัยแม่ฟ้าหลวง © 2026</p>
        </div>
      </footer>

      {/* OVERLAY EDIT DIALOG MODAL */}
      <AnimatePresence>
        {editingIndex !== null && editingData && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-xl overflow-hidden flex flex-col"
            >
              {/* MODAL HEADER */}
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 font-display">
                    แก้ไขรายละเอียดข้อมูลเอกสารลงทะเบียน
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    เลขทะเบียนรับ: <span className="font-mono font-bold text-slate-700">{editingData.barcode}</span>
                  </p>
                </div>
                <button
                  onClick={handleCancelEdit}
                  className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* MODAL BODY */}
              <div className="p-5 flex flex-col gap-4 overflow-y-auto max-h-[70vh]">
                {activeTab === 6 ? (
                  /* TAB 6: Document Return Specific Inputs */
                  <>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-700 flex flex-col gap-2 shadow-xs">
                      <div className="flex items-center gap-1.5 border-b border-slate-100 pb-1.5 mb-1 text-slate-900 font-bold">
                        <FileText className="w-4 h-4 text-emerald-600" />
                        <span>รายละเอียดเอกสารที่ดึงจากระบบ</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <span className="text-slate-400 font-semibold">เลขทะเบียนรับ:</span>{' '}
                          <span className="font-mono font-bold text-slate-900">{editingData.barcode}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-semibold">EP:</span>{' '}
                          <span className="font-mono font-bold text-slate-900">{editingData.ep}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-slate-400 font-semibold">เลขที่ อว / ชื่อ:</span>{' '}
                          <span className="font-sans font-medium text-slate-900">{editingData.mhesiNumber || '-'}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-slate-400 font-semibold">หน่วยงาน:</span>{' '}
                          <span className="font-sans text-slate-900">{editingData.agency || '-'}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-slate-400 font-semibold">เลขที่เอกสาร:</span>{' '}
                          <span className="font-mono text-slate-900">{editingData.docNumber || '-'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-semibold">ผู้ให้บริการ:</span>{' '}
                          <span className="font-semibold text-emerald-800">{editingData.finalDesk || '-'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-semibold">วันที่ลงโต๊ะ:</span>{' '}
                          <span className="font-mono text-slate-600 text-[10px]">{editingData.tableDate || '-'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Return Status Inputs */}
                    <div className="border border-slate-200 rounded-xl p-4 bg-emerald-50/20 flex flex-col gap-3">
                      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 mb-1">
                        <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[11px] flex items-center justify-center font-bold">✓</span>
                        <h4 className="text-xs font-bold text-slate-800 font-display">บันทึกส่งคืนเอกสาร</h4>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 font-mono">
                            1. วันที่ส่งคืน
                          </label>
                          <input
                            id="edit-return-date-part2-input"
                            type="text"
                            placeholder="วว/ดด/ปปปป ชช:นน:ทท"
                            value={editingData.returnDate || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditingData({ ...editingData, returnDate: val });
                            }}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-mono focus:outline-hidden focus:border-emerald-500 focus:bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 font-mono">
                            2. สถานะการส่งคืน
                          </label>
                          <div className="relative font-sans">
                            <input
                              id="edit-return-status-search"
                              type="text"
                              placeholder="พิมพ์ค้นหาหรือระบุสถานะส่งคืน..."
                              value={returnStatusSearch}
                              onChange={(e) => {
                                const val = e.target.value;
                                setReturnStatusSearch(val);
                                setIsReturnStatusDropdownOpen(true);
                                
                                const updated = { ...editingData, returnStatus: val };
                                if (val) {
                                  if (!updated.returnDate) {
                                    updated.returnDate = getThaiDateTimeString();
                                  }
                                } else {
                                  updated.returnDate = '';
                                }
                                setEditingData(updated);
                              }}
                              onFocus={() => setIsReturnStatusDropdownOpen(true)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-16 py-1.5 text-xs text-slate-700 focus:outline-hidden focus:border-emerald-500 focus:bg-white font-sans"
                            />
                            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                              <Search className="w-3.5 h-3.5" />
                            </div>
                            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                              {returnStatusSearch && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReturnStatusSearch('');
                                    setEditingData({ ...editingData, returnStatus: '', returnDate: '' });
                                  }}
                                  className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer rounded-full hover:bg-slate-200/50"
                                  title="ล้างค่า"
                                >
                                  ✕
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setIsReturnStatusDropdownOpen(!isReturnStatusDropdownOpen)}
                                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer rounded-full hover:bg-slate-200/50"
                                title="แสดงตัวเลือกแนะนำทั้งหมด"
                              >
                                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isReturnStatusDropdownOpen ? 'rotate-180' : ''}`} />
                              </button>
                            </div>

                            {isReturnStatusDropdownOpen && (
                              <>
                                <div
                                  className="fixed inset-0 z-40 cursor-default"
                                  onClick={() => setIsReturnStatusDropdownOpen(false)}
                                />
                                <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-y-auto z-50 py-1 font-sans">
                                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase border-b border-slate-100 bg-slate-50 mb-1 flex items-center justify-between">
                                    <span>ตัวเลือกไกด์นำทาง</span>
                                    <span className="text-[9px] lowercase font-normal text-slate-400">({returnStatusesToSuggest.length} รายการ)</span>
                                  </div>
                                  {returnStatusesToSuggest.filter(opt => matchOption(opt, returnStatusSearch)).length > 0 ? (
                                    returnStatusesToSuggest.filter(opt => matchOption(opt, returnStatusSearch)).map((opt, i) => {
                                      const isSelected = editingData.returnStatus === opt;
                                      return (
                                        <button
                                          key={i}
                                          type="button"
                                          onClick={() => {
                                            setReturnStatusSearch(opt);
                                            const updated = { ...editingData, returnStatus: opt };
                                            if (!updated.returnDate) {
                                              updated.returnDate = getThaiDateTimeString();
                                            }
                                            setEditingData(updated);
                                            setIsReturnStatusDropdownOpen(false);
                                          }}
                                          className={`w-full text-left px-3 py-2 text-xs transition flex items-center justify-between cursor-pointer ${
                                            isSelected 
                                              ? 'bg-emerald-50 text-emerald-900 font-semibold font-sans' 
                                              : 'text-slate-700 hover:bg-slate-100 active:bg-slate-200 font-sans font-normal'
                                          }`}
                                        >
                                          <span>{opt}</span>
                                          {isSelected && (
                                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                                          )}
                                        </button>
                                      );
                                    })
                                  ) : (
                                    <div className="px-3 py-2 text-xs text-slate-400 italic text-center">
                                      ไม่พบตัวเลือกที่ตรงกัน (คุณสามารถพิมพ์กำหนดเองได้)
                                    </div>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 font-mono">
                          3. เหตุผล / รายละเอียดหมายเหตุ (เพิ่มเติม)
                        </label>
                        <textarea
                          id="edit-remarks-textarea"
                          placeholder="บันทึกหมายเหตุเกี่ยวกับการส่งคืน..."
                          value={editingData.remarks || ''}
                          onChange={(e) => setEditingData({ ...editingData, remarks: e.target.value })}
                          rows={2}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-hidden focus:border-emerald-500 focus:bg-white transition"
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  /* TAB 1-5: Standard Document Registration Inputs (With returns fields removed) */
                  <>
                    {/* N/O, EP & BARCODE SLOT */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 font-mono">
                          ลักษณะงาน (N/O)
                        </label>
                        <select
                          id="edit-no-select"
                          value={editingData.noType || 'N'}
                          onChange={(e) => setEditingData({ ...editingData, noType: e.target.value as 'N' | 'O' })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-hidden focus:border-emerald-500 focus:bg-white"
                        >
                          <option value="N">N (งานใหม่)</option>
                          <option value="O">O (งานเก่า)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 font-mono">
                          ช่อง EP (งานใหญ่/ด่วน/พิเศษ)
                        </label>
                        <input
                          id="edit-ep-input"
                          type="text"
                          placeholder="กรอกตัวเลข EP (ถ้ามี)"
                          value={editingData.ep || ''}
                          onChange={(e) => setEditingData({ ...editingData, ep: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-hidden focus:border-emerald-500 focus:bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 font-mono">
                          เลขทะเบียนรับ (บาร์โค้ด)
                        </label>
                        <input
                          id="edit-barcode-input"
                          type="text"
                          value={editingData.barcode}
                          onChange={(e) => setEditingData({ ...editingData, barcode: e.target.value })}
                          className="w-full bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-mono focus:outline-hidden"
                        />
                      </div>
                    </div>

                    {/* SENDER NAME, SENDER PHONE & EMAIL */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 font-mono">
                          ผู้ส่งเอกสาร
                        </label>
                        <input
                          id="edit-sender-name-input"
                          type="text"
                          placeholder="ชื่อ-สกุล ผู้ส่งเอกสาร..."
                          value={editingData.senderName || ''}
                          onChange={(e) => setEditingData({ ...editingData, senderName: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-hidden focus:border-emerald-500 focus:bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 font-mono">
                          โทรศัพท์
                        </label>
                        <input
                          id="edit-sender-phone-input"
                          type="text"
                          placeholder="เบอร์โทรศัพท์..."
                          value={editingData.senderPhone || ''}
                          onChange={(e) => setEditingData({ ...editingData, senderPhone: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-mono focus:outline-hidden focus:border-emerald-500 focus:bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 font-mono">
                          อีเมล
                        </label>
                        <input
                          id="edit-sender-email-input"
                          type="email"
                          placeholder="อีเมลผู้ส่ง..."
                          value={editingData.senderEmail || ''}
                          onChange={(e) => setEditingData({ ...editingData, senderEmail: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-mono focus:outline-hidden focus:border-emerald-500 focus:bg-white"
                        />
                      </div>
                    </div>

                    {/* MHESI NUMBER AND AGENCY */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 font-mono">
                          เลขที่ อว / ชื่อ
                        </label>
                        <input
                          id="edit-mhesi-input"
                          type="text"
                          placeholder="อว 6601..."
                          value={editingData.mhesiNumber}
                          onChange={(e) => setEditingData({ ...editingData, mhesiNumber: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-hidden focus:border-emerald-500 focus:bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 font-mono">
                          หน่วยงานผู้เสนอเรื่อง
                        </label>
                        <div className="relative">
                          <input
                            id="edit-agency-search"
                            type="text"
                            placeholder="พิมพ์ค้นหาหน่วยงาน (เช่น ศิลปศาสตร์, สารบรรณ)..."
                            value={agencySearch}
                            onChange={(e) => {
                              const val = e.target.value;
                              setAgencySearch(val);
                              setIsAgencyDropdownOpen(true);
                              setEditingData({ ...editingData, agency: val });
                            }}
                            onFocus={() => setIsAgencyDropdownOpen(true)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-700 focus:outline-hidden focus:border-emerald-500 focus:bg-white font-sans"
                          />
                          <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                            <Search className="w-3.5 h-3.5" />
                          </div>
                          {agencySearch && (
                            <button
                              type="button"
                              onClick={() => {
                                setAgencySearch('');
                                setEditingData({ ...editingData, agency: '' });
                              }}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                              ✕
                            </button>
                          )}

                          {isAgencyDropdownOpen && (
                            <>
                              <div
                                className="fixed inset-0 z-40 cursor-default"
                                onClick={() => setIsAgencyDropdownOpen(false)}
                              />
                              <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-y-auto z-50 py-1 font-sans">
                                {agenciesToSuggest.filter(opt => matchOption(opt, agencySearch)).length > 0 ? (
                                  agenciesToSuggest.filter(opt => matchOption(opt, agencySearch)).map((opt, i) => {
                                    const isSelected = editingData.agency === opt;
                                    return (
                                      <button
                                        key={i}
                                        type="button"
                                        onClick={() => {
                                          setAgencySearch(opt);
                                          setEditingData({ ...editingData, agency: opt });
                                          setIsAgencyDropdownOpen(false);
                                        }}
                                        className={`w-full text-left px-3 py-1.5 text-xs transition flex items-center justify-between cursor-pointer ${
                                          isSelected 
                                            ? 'bg-emerald-50 text-emerald-900 font-semibold' 
                                            : 'text-slate-700 hover:bg-slate-100 active:bg-slate-200'
                                        }`}
                                      >
                                        <span>{opt}</span>
                                        {isSelected && (
                                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                                        )}
                                      </button>
                                    );
                                  })
                                ) : (
                                  <div className="px-3 py-2 text-xs text-slate-400 italic text-center">
                                    ไม่พบตัวเลือกที่ตรงกัน
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* DOC NUMBER AND TYPE */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 font-mono">
                          เลขที่เอกสาร
                        </label>
                        <input
                          id="edit-docnum-input"
                          type="text"
                          placeholder="พท 10/2566"
                          value={editingData.docNumber}
                          onChange={(e) => setEditingData({ ...editingData, docNumber: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-hidden focus:border-emerald-500 focus:bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 font-mono">
                          ประเภทเอกสาร
                        </label>
                        <div className="relative">
                          <input
                            id="edit-doctype-search"
                            type="text"
                            placeholder="พิมพ์ค้นหาประเภท (เช่น ยืมเงิน, ทุน)..."
                            value={docTypeSearch}
                            onChange={(e) => {
                              const val = e.target.value;
                              setDocTypeSearch(val);
                              setIsDocTypeDropdownOpen(true);
                              setEditingData({ ...editingData, docType: val });
                            }}
                            onFocus={() => setIsDocTypeDropdownOpen(true)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-700 focus:outline-hidden focus:border-emerald-500 focus:bg-white font-sans"
                          />
                          <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                            <Search className="w-3.5 h-3.5" />
                          </div>
                          {docTypeSearch && (
                            <button
                              type="button"
                              onClick={() => {
                                setDocTypeSearch('');
                                setEditingData({ ...editingData, docType: '' });
                              }}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                              ✕
                            </button>
                          )}

                          {isDocTypeDropdownOpen && (
                            <>
                              <div
                                className="fixed inset-0 z-40 cursor-default"
                                onClick={() => setIsDocTypeDropdownOpen(false)}
                              />
                              <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-y-auto z-50 py-1 font-sans">
                                {docTypesToSuggest.filter(opt => matchOption(opt, docTypeSearch)).length > 0 ? (
                                  docTypesToSuggest.filter(opt => matchOption(opt, docTypeSearch)).map((opt, i) => {
                                    const isSelected = editingData.docType === opt;
                                    return (
                                      <button
                                        key={i}
                                        type="button"
                                        onClick={() => {
                                          setDocTypeSearch(opt);
                                          const nextDesk = (activeTab === 3 || !editingData.autoDesk || editingData.autoDesk === 'กรอกมือระบุเอง') ? getDeskByDocType(opt) : editingData.autoDesk;
                                          const nextOverride = (editingData.overrideDesk && editingData.overrideDesk !== 'ไม่เลือก') ? editingData.overrideDesk : '';
                                          setEditingData({
                                            ...editingData,
                                            docType: opt,
                                            autoDesk: nextDesk || editingData.autoDesk,
                                            finalDesk: nextOverride || nextDesk || editingData.finalDesk,
                                          });
                                          setIsDocTypeDropdownOpen(false);
                                        }}
                                        className={`w-full text-left px-3 py-1.5 text-xs transition flex items-center justify-between cursor-pointer ${
                                          isSelected 
                                            ? 'bg-emerald-50 text-emerald-900 font-semibold' 
                                            : 'text-slate-700 hover:bg-slate-100 active:bg-slate-200'
                                        }`}
                                      >
                                        <span>{opt}</span>
                                        {isSelected && (
                                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                                        )}
                                      </button>
                                    );
                                  })
                                ) : (
                                  <div className="px-3 py-2 text-xs text-slate-400 italic text-center">
                                    ไม่พบตัวเลือกที่ตรงกัน
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* PART 1: การรับเอกสาร */}
                    <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 flex flex-col gap-3">
                      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 mb-1">
                        <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[11px] flex items-center justify-center font-bold">1</span>
                        <h4 className="text-xs font-bold text-slate-800 font-display">การรับเอกสาร</h4>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 font-mono">
                            1. วันที่รับ
                          </label>
                          <input
                            id="edit-receive-date-input"
                            type="text"
                            value={editingData.receiveDate || ''}
                            onChange={(e) => setEditingData({ ...editingData, receiveDate: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-mono focus:outline-hidden focus:border-emerald-500 focus:bg-white"
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono">
                              2. วันที่ลงโต๊ะ
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                if (editingData) {
                                  setEditingData({
                                    ...editingData,
                                    tableDate: getThaiDateTimeString()
                                  });
                                }
                              }}
                              className="text-[9px] font-bold text-emerald-600 hover:text-emerald-700 underline cursor-pointer"
                            >
                              ประทับเวลาปัจจุบัน
                            </button>
                          </div>
                          <input
                            id="edit-table-date-input"
                            type="text"
                            placeholder="วว/ดด/ปปปป ชช:นน:ทท"
                            value={editingData.tableDate || ''}
                            onChange={(e) => setEditingData({ ...editingData, tableDate: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-mono focus:outline-hidden focus:border-emerald-500 focus:bg-white"
                          />
                          <span className="text-[9px] text-slate-400 block mt-0.5 font-sans">
                            ไกด์รูปแบบ: {getThaiDateTimeString()}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 font-mono">
                            3. ผู้ให้บริการ (อัตโนมัติ)
                          </label>
                          <input
                            id="edit-autodesk-input"
                            type="text"
                            disabled
                            value={editingData.autoDesk}
                            className="w-full bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-500 font-semibold"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 font-mono">
                            4. เปลี่ยนผู้ให้บริการ
                          </label>
                          <div className="relative">
                            <input
                              id="edit-override-desk-search"
                              type="text"
                              placeholder="พิมพ์ค้นหา (เช่น 1, C1, f)..."
                              value={overrideSearch}
                              onChange={(e) => {
                                const val = e.target.value;
                                setOverrideSearch(val);
                                setIsOverrideDropdownOpen(true);
                                setEditingData({ ...editingData, overrideDesk: val || 'ไม่เลือก' });
                              }}
                              onFocus={() => setIsOverrideDropdownOpen(true)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-700 focus:outline-hidden focus:border-emerald-500 focus:bg-white font-sans"
                            />
                            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                              <Search className="w-3.5 h-3.5" />
                            </div>
                            {overrideSearch && (
                              <button
                                type="button"
                                onClick={() => {
                                  setOverrideSearch('');
                                  setEditingData({ ...editingData, overrideDesk: 'ไม่เลือก' });
                                }}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                              >
                                ✕
                              </button>
                            )}

                            {isOverrideDropdownOpen && (
                              <>
                                <div
                                  className="fixed inset-0 z-40 cursor-default"
                                  onClick={() => setIsOverrideDropdownOpen(false)}
                                />
                                <div className="absolute bottom-full mb-1 left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-y-auto z-50 py-1 font-sans">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOverrideSearch('');
                                      setEditingData({ ...editingData, overrideDesk: 'ไม่เลือก' });
                                      setIsOverrideDropdownOpen(false);
                                    }}
                                    className="w-full text-left px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 font-bold border-b border-slate-100 cursor-pointer"
                                  >
                                    -- คงเดิมตามที่ระบบรันคิว (ไม่เลือก) --
                                  </button>

                                  {OVERRIDE_DESK_OPTIONS.filter(opt => matchOption(opt, overrideSearch)).length > 0 ? (
                                    OVERRIDE_DESK_OPTIONS.filter(opt => matchOption(opt, overrideSearch)).map((opt, i) => {
                                      const isSelected = editingData.overrideDesk === opt;
                                      return (
                                        <button
                                          key={i}
                                          type="button"
                                          onClick={() => {
                                            setOverrideSearch(opt);
                                            setEditingData({ ...editingData, overrideDesk: opt });
                                            setIsOverrideDropdownOpen(false);
                                          }}
                                          className={`w-full text-left px-3 py-1.5 text-xs transition flex items-center justify-between cursor-pointer ${
                                            isSelected 
                                              ? 'bg-emerald-50 text-emerald-900 font-semibold' 
                                              : 'text-slate-700 hover:bg-slate-100 active:bg-slate-200'
                                          }`}
                                        >
                                          <span>{opt}</span>
                                          {isSelected && (
                                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                                          )}
                                        </button>
                                      );
                                    })
                                  ) : (
                                    <div className="px-3 py-2 text-xs text-slate-400 italic text-center">
                                      ไม่พบตัวเลือกที่ตรงกัน
                                    </div>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Remarks/Notes */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 font-mono">
                        หมายเหตุ / รายละเอียด
                      </label>
                      <textarea
                        id="edit-remarks-textarea"
                        placeholder="ป้อนรายละเอียดเพิ่มเติม..."
                        value={editingData.remarks || ''}
                        onChange={(e) => setEditingData({ ...editingData, remarks: e.target.value })}
                        rows={2}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-hidden focus:border-emerald-500 focus:bg-white transition"
                      />
                    </div>
                  </>
                )}
              </div>

              {/* MODAL ACTION FOOTER */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  id="cancel-edit-btn"
                  onClick={handleCancelEdit}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs px-4 py-2 rounded-lg transition cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  id="confirm-edit-btn"
                  onClick={handleSaveEdit}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-lg transition shadow-xs cursor-pointer"
                >
                  ยืนยันบันทึกการแก้ไข
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 1. STATS DETAILS OVERLAY MODAL */}
      <AnimatePresence>
        {selectedStatsTab !== null && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-40 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-5xl h-[85vh] overflow-hidden flex flex-col"
            >
              {/* MODAL HEADER */}
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600 shrink-0">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 font-display">
                      {selectedStatsTab === 'today' && "รายละเอียดประวัติการรับเอกสาร (วันนี้)"}
                      {selectedStatsTab === 'month' && "รายละเอียดประวัติการรับเอกสาร (เดือนนี้)"}
                      {selectedStatsTab === 'total' && "รายละเอียดประวัติการรับเอกสารทั้งหมดในระบบ"}
                      {selectedStatsTab === 'returned' && "รายละเอียดประวัติการส่งคืนเอกสารทั้งหมดในระบบ"}
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      แสดงรายการข้อมูลล่าสุดเรียงลำดับจากใหม่ไปเก่า สามารถกด 'แก้ไข' เพื่อปรับปรุงข้อมูลลงไปยัง Google Sheets โดยตรง
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedStatsTab(null)}
                  className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* SEARCH & FILTER CONTROLS */}
              <div className="p-4 bg-slate-50/50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                <div className="relative flex-1 max-w-md">
                  <input
                    type="text"
                    placeholder="ค้นหาตาม บาร์โค้ด, หน่วยงาน, เลขที่ อว, ประเภทเอกสาร, ผู้ให้บริการ..."
                    value={statsSearchQuery}
                    onChange={(e) => setStatsSearchQuery(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-8 py-1.5 text-xs text-slate-700 focus:outline-hidden focus:border-emerald-500 font-sans"
                  />
                  <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <Search className="w-4 h-4" />
                  </div>
                  {statsSearchQuery && (
                    <button
                      onClick={() => setStatsSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <div className="text-xs text-slate-500 font-mono flex items-center gap-1">
                  <span>พบทั้งหมด:</span>
                  <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-md font-bold">
                    {getFilteredStatsRecords().length} รายการ
                  </span>
                </div>
              </div>

              {/* MODAL BODY (TABLE & LIST) */}
              <div className="flex-1 overflow-y-auto p-4">
                {getFilteredStatsRecords().length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-3">
                      <FileText className="w-8 h-8" />
                    </div>
                    <p className="text-sm text-slate-500 font-bold">ไม่พบประวัติเอกสารที่ตรงกัน</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm">
                      ลองเปลี่ยนคีย์เวิร์ดในการค้นหา หรือกดรีเฟรชสถิติเพื่ออัปเดตข้อมูลจากชีตล่าสุด
                    </p>
                  </div>
                ) : (
                  <div className="border border-slate-100 rounded-xl overflow-hidden shadow-xs">
                    {/* Desktop Table View */}
                    <table className="min-w-full divide-y divide-slate-100 text-left text-xs text-slate-700 hidden md:table">
                      <thead className="bg-slate-50 font-bold text-slate-500">
                        <tr>
                          <th className="px-3 py-3 text-center font-semibold w-14">ลำดับ</th>
                          <th className="px-3 py-3">เลขทะเบียนรับ</th>
                          <th className="px-3 py-3">วันที่รับ</th>
                          <th className="px-3 py-3">ข้อมูลเอกสาร</th>
                          <th className="px-3 py-3">หน่วยงานผู้เสนอ</th>
                          <th className="px-3 py-3">ผู้ให้บริการ (Final)</th>
                          <th className="px-3 py-3 text-center">จัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {getFilteredStatsRecords().map((item, idx) => {
                          const doc = item.data;
                          const triggerEdit = () => {
                            setEditingHistoryRecord(item);
                            setEditingHistoryData({
                              ...item.data,
                              returnDate: '',
                              returnStatus: ''
                            });
                            setHistoryAgencySearch(item.data.agency || '');
                            setHistoryDocTypeSearch(item.data.docType || '');
                            setHistoryReturnStatusSearch('');
                            setHistoryOverrideSearch(item.data.overrideDesk && item.data.overrideDesk !== 'ไม่เลือก' ? item.data.overrideDesk : '');
                          };
                          return (
                            <tr 
                              key={idx} 
                              onClick={triggerEdit}
                              className="hover:bg-slate-50/75 transition-colors cursor-pointer group"
                            >
                              <td className="px-3 py-3 text-center font-mono text-xs text-slate-400 font-bold bg-slate-50/30">
                                {idx + 1}
                              </td>
                              <td className="px-3 py-3">
                                <div className="flex flex-col">
                                  <span className="font-mono font-bold text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md max-w-fit shadow-2xs">
                                    {doc.barcode}
                                  </span>
                                  {doc.ep && (
                                    <span className="text-[9px] mt-1 text-emerald-600 font-bold font-mono pl-1">
                                      EP: {doc.ep}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-3 text-[11px] text-slate-500">
                                <div className="flex items-center gap-1.5 font-sans">
                                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span className="font-mono">{doc.receiveDate}</span>
                                </div>
                              </td>
                              <td className="px-3 py-3 max-w-xs">
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-bold text-slate-800 line-clamp-1">{doc.docType || 'ไม่มีระบุประเภท'}</span>
                                  <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                                    <span className="text-slate-400">เลขเอกสาร:</span> {doc.docNumber || '-'}
                                  </span>
                                  {doc.mhesiNumber && (
                                    <span className="text-[10px] text-slate-500 font-sans flex items-center gap-1 mt-0.5">
                                      <span className="text-slate-400">อว:</span> {doc.mhesiNumber}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-3 font-medium text-slate-700 max-w-[180px] truncate" title={doc.agency}>
                                {doc.agency || '-'}
                              </td>
                              <td className="px-3 py-3">
                                <div className="flex flex-col">
                                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                                    <span>{doc.finalDesk || '-'}</span>
                                  </span>
                                  {doc.overrideDesk && doc.overrideDesk !== 'ไม่เลือก' && (
                                    <span className="text-[9px] text-amber-600 font-semibold mt-1 ml-3">
                                      เปลี่ยนจาก: {doc.autoDesk}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={triggerEdit}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-md transition cursor-pointer font-bold border border-sky-200"
                                  >
                                    <Pencil className="w-3 h-3" />
                                    <span>แก้ไข</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeletingHistoryRecord(item)}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-md transition cursor-pointer font-bold border border-rose-200"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    <span>ลบ</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
 
                    {/* Mobile Card List View */}
                    <div className="md:hidden flex flex-col divide-y divide-slate-100 bg-white">
                      {getFilteredStatsRecords().map((item, idx) => {
                        const doc = item.data;
                        const triggerEdit = () => {
                          setEditingHistoryRecord(item);
                          setEditingHistoryData({
                            ...item.data,
                            returnDate: '',
                            returnStatus: ''
                          });
                          setHistoryAgencySearch(item.data.agency || '');
                          setHistoryDocTypeSearch(item.data.docType || '');
                          setHistoryReturnStatusSearch('');
                          setHistoryOverrideSearch(item.data.overrideDesk && item.data.overrideDesk !== 'ไม่เลือก' ? item.data.overrideDesk : '');
                        };
                        return (
                          <div 
                            key={idx} 
                            onClick={triggerEdit}
                            className="p-4 hover:bg-slate-50/50 transition-colors flex flex-col gap-3 cursor-pointer"
                          >
                            <div className="flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">
                                  #{idx + 1}
                                </span>
                                <span className="font-mono font-bold text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md">
                                  {doc.barcode}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={triggerEdit}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-md transition font-bold border border-sky-200 cursor-pointer"
                                >
                                  <Pencil className="w-3 h-3" />
                                  <span>แก้ไข</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeletingHistoryRecord(item)}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-md transition font-bold border border-rose-200 cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>ลบ</span>
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-[11px] text-slate-600 font-sans mt-0.5">
                              <div>
                                <span className="text-slate-400 block mb-0.5 font-medium">วันที่รับ</span>
                                <span className="font-mono text-slate-700 font-semibold flex items-center gap-1">
                                  <Calendar className="w-3 h-3 text-slate-400" />
                                  {doc.receiveDate}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-400 block mb-0.5 font-medium">ประเภทเอกสาร</span>
                                <span className="font-bold text-slate-900">{doc.docType || '-'}</span>
                              </div>
                              <div className="col-span-2">
                                <span className="text-slate-400 block mb-0.5 font-medium">เลขที่เอกสาร</span>
                                <span className="font-mono text-slate-700 font-semibold">{doc.docNumber || '-'}</span>
                                {doc.mhesiNumber && (
                                  <span className="text-[10px] text-slate-400 block mt-0.5">อว: {doc.mhesiNumber}</span>
                                )}
                              </div>
                              <div className="col-span-2">
                                <span className="text-slate-400 block mb-0.5 font-medium">หน่วยงานผู้เสนอ</span>
                                <span className="font-semibold text-slate-800">{doc.agency || '-'}</span>
                              </div>
                              <div className="col-span-2 bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">
                                <span className="text-slate-400 block mb-0.5 font-medium">ผู้ให้บริการ (Final)</span>
                                <span className="font-bold text-emerald-800 flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                                  {doc.finalDesk || '-'}
                                </span>
                                {doc.overrideDesk && doc.overrideDesk !== 'ไม่เลือก' && (
                                  <span className="text-[10px] text-amber-600 block mt-1 pl-3 font-medium">
                                    (เปลี่ยนจากเดิม: {doc.autoDesk})
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* MODAL FOOTER */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5 shrink-0">
                <button
                  onClick={() => setSelectedStatsTab(null)}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs px-5 py-2 rounded-lg transition cursor-pointer"
                >
                  ปิดหน้าต่าง
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. HISTORICAL RECORD EDITING MODAL (ON TOP OF DETAILS) */}
      <AnimatePresence>
        {editingHistoryRecord !== null && editingHistoryData !== null && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-xl overflow-hidden flex flex-col"
            >
              {/* HEADER */}
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 font-display">
                    แก้ไขประวัติเอกสาร (แถวที่ {editingHistoryRecord.rowIndex})
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    เลขทะเบียนรับ: <span className="font-mono font-bold text-slate-700">{editingHistoryData.barcode}</span>
                  </p>
                </div>
                <button
                  onClick={() => {
                    setEditingHistoryRecord(null);
                    setEditingHistoryData(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* BODY */}
              <div className="p-5 flex flex-col gap-4 overflow-y-auto max-h-[70vh]">
                {/* N/O, EP & BARCODE SLOT */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 font-mono">
                      ลักษณะงาน (N/O)
                    </label>
                    <select
                      value={editingHistoryData.noType || 'N'}
                      onChange={(e) => setEditingHistoryData({ ...editingHistoryData, noType: e.target.value as 'N' | 'O' })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-hidden focus:border-emerald-500"
                    >
                      <option value="N">N (งานใหม่)</option>
                      <option value="O">O (งานเก่า)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 font-mono">
                      ช่อง EP (งานใหญ่/ด่วน/พิเศษ)
                    </label>
                    <input
                      type="text"
                      placeholder="กรอกตัวเลข EP (ถ้ามี)"
                      value={editingHistoryData.ep || ''}
                      onChange={(e) => setEditingHistoryData({ ...editingHistoryData, ep: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-hidden focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 font-mono">
                      เลขทะเบียนรับ (บาร์โค้ด)
                    </label>
                    <input
                      type="text"
                      disabled
                      value={editingHistoryData.barcode}
                      className="w-full bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-500 font-mono"
                    />
                  </div>
                </div>

                {/* SENDER NAME, SENDER PHONE & EMAIL */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 font-mono">
                      ผู้ส่งเอกสาร
                    </label>
                    <input
                      type="text"
                      placeholder="ชื่อ-สกุล ผู้ส่งเอกสาร..."
                      value={editingHistoryData.senderName || ''}
                      onChange={(e) => setEditingHistoryData({ ...editingHistoryData, senderName: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-hidden focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 font-mono">
                      โทรศัพท์
                    </label>
                    <input
                      type="text"
                      placeholder="เบอร์โทรศัพท์..."
                      value={editingHistoryData.senderPhone || ''}
                      onChange={(e) => setEditingHistoryData({ ...editingHistoryData, senderPhone: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-hidden focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 font-mono">
                      อีเมล
                    </label>
                    <input
                      type="email"
                      placeholder="อีเมลผู้ส่ง..."
                      value={editingHistoryData.senderEmail || ''}
                      onChange={(e) => setEditingHistoryData({ ...editingHistoryData, senderEmail: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-hidden focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* MHESI NUMBER AND AGENCY */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 font-mono">
                      เลขที่ อว / ชื่อ
                    </label>
                    <input
                      type="text"
                      placeholder="อว 6601..."
                      value={editingHistoryData.mhesiNumber || ''}
                      onChange={(e) => setEditingHistoryData({ ...editingHistoryData, mhesiNumber: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-hidden focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 font-mono">
                      หน่วยงานผู้เสนอเรื่อง
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="พิมพ์ค้นหาหน่วยงาน..."
                        value={historyAgencySearch}
                        onChange={(e) => {
                          const val = e.target.value;
                          setHistoryAgencySearch(val);
                          setIsHistoryAgencyDropdownOpen(true);
                          setEditingHistoryData({ ...editingHistoryData, agency: val });
                        }}
                        onFocus={() => setIsHistoryAgencyDropdownOpen(true)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-700 focus:outline-hidden focus:border-emerald-500"
                      />
                      <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                        <Search className="w-3.5 h-3.5" />
                      </div>
                      {historyAgencySearch && (
                        <button
                          type="button"
                          onClick={() => {
                            setHistoryAgencySearch('');
                            setEditingHistoryData({ ...editingHistoryData, agency: '' });
                          }}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          ✕
                        </button>
                      )}

                      {isHistoryAgencyDropdownOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-40 cursor-default"
                            onClick={() => setIsHistoryAgencyDropdownOpen(false)}
                          />
                          <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-y-auto z-50 py-1 font-sans">
                            {agenciesToSuggest.filter(opt => matchOption(opt, historyAgencySearch)).length > 0 ? (
                              agenciesToSuggest.filter(opt => matchOption(opt, historyAgencySearch)).map((opt, i) => {
                                const isSelected = editingHistoryData.agency === opt;
                                return (
                                  <button
                                    key={i}
                                    type="button"
                                    onClick={() => {
                                      setHistoryAgencySearch(opt);
                                      setEditingHistoryData({ ...editingHistoryData, agency: opt });
                                      setIsHistoryAgencyDropdownOpen(false);
                                    }}
                                    className={`w-full text-left px-3 py-1.5 text-xs transition flex items-center justify-between cursor-pointer ${
                                      isSelected 
                                        ? 'bg-emerald-50 text-emerald-900 font-semibold' 
                                        : 'text-slate-700 hover:bg-slate-100 active:bg-slate-200'
                                    }`}
                                  >
                                    <span>{opt}</span>
                                    {isSelected && (
                                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    )}
                                  </button>
                                );
                              })
                            ) : (
                              <div className="px-3 py-2 text-xs text-slate-400 italic text-center">
                                ไม่พบตัวเลือกที่ตรงกัน
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* DOC NUMBER AND TYPE */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 font-mono">
                      เลขที่เอกสาร
                    </label>
                    <input
                      type="text"
                      placeholder="พท 10/2566"
                      value={editingHistoryData.docNumber || ''}
                      onChange={(e) => setEditingHistoryData({ ...editingHistoryData, docNumber: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-hidden focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 font-mono">
                      ประเภทเอกสาร
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="พิมพ์ค้นหาประเภทเอกสาร..."
                        value={historyDocTypeSearch}
                        onChange={(e) => {
                          const val = e.target.value;
                          setHistoryDocTypeSearch(val);
                          setIsHistoryDocTypeDropdownOpen(true);
                          setEditingHistoryData({ ...editingHistoryData, docType: val });
                        }}
                        onFocus={() => setIsHistoryDocTypeDropdownOpen(true)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-700 focus:outline-hidden focus:border-emerald-500"
                      />
                      <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                        <Search className="w-3.5 h-3.5" />
                      </div>
                      {historyDocTypeSearch && (
                        <button
                          type="button"
                          onClick={() => {
                            setHistoryDocTypeSearch('');
                            setEditingHistoryData({ ...editingHistoryData, docType: '' });
                          }}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          ✕
                        </button>
                      )}

                      {isHistoryDocTypeDropdownOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-40 cursor-default"
                            onClick={() => setIsHistoryDocTypeDropdownOpen(false)}
                          />
                          <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-y-auto z-50 py-1 font-sans">
                            {docTypesToSuggest.filter(opt => matchOption(opt, historyDocTypeSearch)).length > 0 ? (
                              docTypesToSuggest.filter(opt => matchOption(opt, historyDocTypeSearch)).map((opt, i) => {
                                const isSelected = editingHistoryData.docType === opt;
                                return (
                                  <button
                                    key={i}
                                    type="button"
                                    onClick={() => {
                                      setHistoryDocTypeSearch(opt);
                                      const nextDesk = getDeskByDocType(opt);
                                      const nextOverride = (editingHistoryData.overrideDesk && editingHistoryData.overrideDesk !== 'ไม่เลือก') ? editingHistoryData.overrideDesk : '';
                                      setEditingHistoryData({
                                        ...editingHistoryData,
                                        docType: opt,
                                        autoDesk: nextDesk || editingHistoryData.autoDesk,
                                        finalDesk: nextOverride || nextDesk || editingHistoryData.finalDesk,
                                      });
                                      setIsHistoryDocTypeDropdownOpen(false);
                                    }}
                                    className={`w-full text-left px-3 py-1.5 text-xs transition flex items-center justify-between cursor-pointer ${
                                      isSelected 
                                        ? 'bg-emerald-50 text-emerald-900 font-semibold' 
                                        : 'text-slate-700 hover:bg-slate-100 active:bg-slate-200'
                                    }`}
                                  >
                                    <span>{opt}</span>
                                    {isSelected && (
                                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    )}
                                  </button>
                                );
                              })
                            ) : (
                              <div className="px-3 py-2 text-xs text-slate-400 italic text-center">
                                ไม่พบตัวเลือกที่ตรงกัน
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* TIMESTAMPS SECTION */}
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 flex flex-col gap-3">
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-2 mb-1">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[11px] flex items-center justify-center font-bold">1</span>
                    <h4 className="text-xs font-bold text-slate-800 font-display">การรับเอกสาร</h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 font-mono">
                        1. วันที่รับ
                      </label>
                      <input
                        type="text"
                        value={editingHistoryData.receiveDate || ''}
                        onChange={(e) => setEditingHistoryData({ ...editingHistoryData, receiveDate: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-mono focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono">
                          2. วันที่ลงโต๊ะ
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingHistoryData({
                              ...editingHistoryData,
                              tableDate: getThaiDateTimeString()
                            });
                          }}
                          className="text-[9px] font-bold text-emerald-600 hover:text-emerald-700 underline cursor-pointer"
                        >
                          ประทับเวลาปัจจุบัน
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="วว/ดด/ปปปป ชช:นน:ทท"
                        value={editingHistoryData.tableDate || ''}
                        onChange={(e) => setEditingHistoryData({ ...editingHistoryData, tableDate: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-mono focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 font-mono">
                        3. ผู้ให้บริการ (อัตโนมัติ)
                      </label>
                      <input
                        type="text"
                        disabled
                        value={editingHistoryData.autoDesk || ''}
                        className="w-full bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-500 font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 font-mono">
                        4. เปลี่ยนผู้ให้บริการ
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="พิมพ์ค้นหาชื่อ/สัญลักษณ์..."
                          value={historyOverrideSearch}
                          onChange={(e) => {
                            const val = e.target.value;
                            setHistoryOverrideSearch(val);
                            setIsHistoryOverrideDropdownOpen(true);
                            setEditingHistoryData({ ...editingHistoryData, overrideDesk: val || 'ไม่เลือก' });
                          }}
                          onFocus={() => setIsHistoryOverrideDropdownOpen(true)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-700 focus:outline-hidden font-sans"
                        />
                        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                          <Search className="w-3.5 h-3.5" />
                        </div>
                        {historyOverrideSearch && (
                          <button
                            type="button"
                            onClick={() => {
                              setHistoryOverrideSearch('');
                              setEditingHistoryData({ ...editingHistoryData, overrideDesk: 'ไม่เลือก' });
                            }}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            ✕
                          </button>
                        )}

                        {isHistoryOverrideDropdownOpen && (
                          <>
                            <div
                              className="fixed inset-0 z-40 cursor-default"
                              onClick={() => setIsHistoryOverrideDropdownOpen(false)}
                            />
                            <div className="absolute bottom-full mb-1 left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-y-auto z-50 py-1 font-sans">
                              <button
                                type="button"
                                onClick={() => {
                                  setHistoryOverrideSearch('');
                                  setEditingHistoryData({ ...editingHistoryData, overrideDesk: 'ไม่เลือก' });
                                  setIsHistoryOverrideDropdownOpen(false);
                                }}
                                className="w-full text-left px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 font-bold border-b border-slate-100 cursor-pointer"
                              >
                                -- คงเดิมตามที่ระบบรันคิว (ไม่เลือก) --
                              </button>

                              {OVERRIDE_DESK_OPTIONS.filter(opt => matchOption(opt, historyOverrideSearch)).length > 0 ? (
                                OVERRIDE_DESK_OPTIONS.filter(opt => matchOption(opt, historyOverrideSearch)).map((opt, i) => {
                                  const isSelected = editingHistoryData.overrideDesk === opt;
                                  return (
                                    <button
                                      key={i}
                                      type="button"
                                      onClick={() => {
                                        setHistoryOverrideSearch(opt);
                                        setEditingHistoryData({ ...editingHistoryData, overrideDesk: opt });
                                        setIsHistoryOverrideDropdownOpen(false);
                                      }}
                                      className={`w-full text-left px-3 py-1.5 text-xs transition flex items-center justify-between cursor-pointer ${
                                        isSelected 
                                          ? 'bg-emerald-50 text-emerald-900 font-semibold' 
                                          : 'text-slate-700 hover:bg-slate-100 active:bg-slate-200'
                                      }`}
                                    >
                                      <span>{opt}</span>
                                      {isSelected && (
                                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                                      )}
                                    </button>
                                  );
                                })
                              ) : (
                                <div className="px-3 py-2 text-xs text-slate-400 italic text-center">
                                  ไม่พบตัวเลือกที่ตรงกัน
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* RETURN SECTION */}
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 flex flex-col gap-3">
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-2 mb-1">
                    <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 text-[11px] flex items-center justify-center font-bold">2</span>
                    <h4 className="text-xs font-bold text-slate-800 font-display">การส่งคืนเอกสาร</h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Return Date */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono">
                          1. วันที่ส่งคืน
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingHistoryData({
                              ...editingHistoryData,
                              returnDate: getThaiDateTimeString()
                            });
                          }}
                          className="text-[9px] font-bold text-rose-600 hover:text-rose-700 underline cursor-pointer"
                        >
                          ประทับเวลาปัจจุบัน
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="วว/ดด/ปปปป ชช:นน:ทท"
                        value={editingHistoryData.returnDate || ''}
                        onChange={(e) => setEditingHistoryData({ ...editingHistoryData, returnDate: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-mono focus:outline-hidden focus:border-rose-500"
                      />
                    </div>

                    {/* Return Status */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 font-mono">
                        2. สถานะการส่งคืน
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="พิมพ์ค้นหาหรือเลือกสถานะคืน..."
                          value={historyReturnStatusSearch}
                          onChange={(e) => {
                            const val = e.target.value;
                            setHistoryReturnStatusSearch(val);
                            setIsHistoryReturnStatusDropdownOpen(true);
                            setEditingHistoryData({ ...editingHistoryData, returnStatus: val });
                          }}
                          onFocus={() => setIsHistoryReturnStatusDropdownOpen(true)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-700 focus:outline-hidden focus:border-rose-500 font-sans"
                        />
                        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                          <Search className="w-3.5 h-3.5" />
                        </div>
                        {historyReturnStatusSearch && (
                          <button
                            type="button"
                            onClick={() => {
                              setHistoryReturnStatusSearch('');
                              setEditingHistoryData({ ...editingHistoryData, returnStatus: '' });
                            }}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            ✕
                          </button>
                        )}

                        {isHistoryReturnStatusDropdownOpen && (
                          <>
                            <div
                              className="fixed inset-0 z-40 cursor-default"
                              onClick={() => setIsHistoryReturnStatusDropdownOpen(false)}
                            />
                            <div className="absolute bottom-full mb-1 left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto z-50 py-1 font-sans">
                              {dropdownConfig.returnStatuses?.filter(opt => matchOption(opt, historyReturnStatusSearch)).length > 0 ? (
                                dropdownConfig.returnStatuses?.filter(opt => matchOption(opt, historyReturnStatusSearch)).map((opt, i) => {
                                  const isSelected = editingHistoryData.returnStatus === opt;
                                  return (
                                    <button
                                      key={i}
                                      type="button"
                                      onClick={() => {
                                        setHistoryReturnStatusSearch(opt);
                                        setEditingHistoryData({ ...editingHistoryData, returnStatus: opt });
                                        setIsHistoryReturnStatusDropdownOpen(false);
                                      }}
                                      className={`w-full text-left px-3 py-1.5 text-xs transition flex items-center justify-between cursor-pointer ${
                                        isSelected 
                                          ? 'bg-rose-50 text-rose-900 font-semibold' 
                                          : 'text-slate-700 hover:bg-slate-100 active:bg-slate-200'
                                      }`}
                                    >
                                      <span>{opt}</span>
                                      {isSelected && (
                                        <Check className="w-3.5 h-3.5 text-rose-600" />
                                      )}
                                    </button>
                                  );
                                })
                              ) : (
                                <div className="px-3 py-2 text-xs text-slate-400 italic text-center">
                                  ไม่พบตัวเลือกที่ตรงกัน
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Remarks/Notes */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 font-mono">
                    หมายเหตุ / รายละเอียด
                  </label>
                  <textarea
                    placeholder="ป้อนรายละเอียดเพิ่มเติม..."
                    value={editingHistoryData.remarks || ''}
                    onChange={(e) => setEditingHistoryData({ ...editingHistoryData, remarks: e.target.value })}
                    rows={2}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* ACTION FOOTER */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2.5">
                <div>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => {
                      setDeletingHistoryRecord(editingHistoryRecord);
                    }}
                    className="bg-rose-50 hover:bg-rose-100 disabled:opacity-50 text-rose-700 font-bold text-xs px-4 py-2 rounded-lg transition border border-rose-200 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>ลบข้อมูลนี้</span>
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    disabled={isSaving}
                    onClick={() => {
                      setEditingHistoryRecord(null);
                      setEditingHistoryData(null);
                    }}
                    className="bg-slate-200 hover:bg-slate-300 disabled:opacity-50 text-slate-700 font-semibold text-xs px-4 py-2 rounded-lg transition cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    disabled={isSaving}
                    onClick={handleSaveHistoryEdit}
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs px-4 py-2 rounded-lg transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    {isSaving && <RefreshCw className="w-3 h-3 animate-spin" />}
                    <span>ยืนยันบันทึกการแก้ไข</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* DELETE CONFIRMATION DIALOG */}
        {deletingHistoryRecord !== null && (
          <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-md w-full overflow-hidden"
            >
              <div className="p-6 text-center">
                <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-rose-100">
                  <AlertCircle className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-slate-800 font-display mb-2">
                  ยืนยันการลบข้อมูลใช่หรือไม่?
                </h3>
                <p className="text-xs text-slate-500 mb-6 font-sans leading-relaxed">
                  คุณกำลังจะลบรายการเอกสารทะเบียนรับ <strong className="text-slate-800 font-mono font-bold">"{deletingHistoryRecord.data.barcode}"</strong> ออกจากตาราง 2570-ระบบติดตามเอกสาร ใน Supabase อย่างถาวร การดำเนินการนี้ไม่สามารถย้อนกลับได้
                </p>

                <div className="flex items-center gap-3 justify-center">
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => setDeletingHistoryRecord(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer transition"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={handleDeleteHistoryConfirm}
                    className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer transition shadow-sm"
                  >
                    {isDeleting ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                    <span>ยืนยันการลบ</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* WORD-STYLE PRINT PREVIEW MODAL */}
        {isPrintPreviewOpen && printDeskFilter && (
          <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-sm z-[100] flex flex-col md:flex-row overflow-hidden font-sans">
            <style>{`
              .print-page {
                width: 210mm;
                height: 297mm;
                box-sizing: border-box;
                background: white !important;
                position: relative;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                color: black !important;
                border-radius: 4px;
              }
              
              .print-page-landscape {
                width: 297mm;
                height: 210mm;
                box-sizing: border-box;
                background: white !important;
                position: relative;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                color: black !important;
                border-radius: 4px;
              }

              /* Margin sizes */
              .margin-normal {
                padding: 20mm 20mm 15mm 20mm;
              }
              .margin-narrow {
                padding: 10mm 12mm 10mm 12mm;
              }
              .margin-wide {
                padding: 30mm 30mm 25mm 30mm;
              }
              
              /* Flex layouts */
              .logo-box {
                width: 48px;
                height: 48px;
                background-color: #0f172a;
                color: white;
                border-radius: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
                font-size: 18px;
                margin-bottom: 0.5rem;
              }
              
              /* Text Sizes */
              .title-lg { font-size: 18px; margin: 0; }
              .subtitle-sm { font-size: 12px; color: #64748b; margin: 0; }
              .meta-row {
                display: flex;
                flex-wrap: wrap;
                justify-content: center;
                gap: 12px;
                font-size: 11px;
                color: #334155;
                margin-top: 8px;
              }
              .badge-bg {
                background-color: #f1f5f9;
                padding: 2px 8px;
                border-radius: 4px;
                border: 1px solid #e2e8f0;
              }
              .badge-teal {
                background-color: #f0fdf4;
                color: #166534;
                padding: 2px 8px;
                border-radius: 4px;
                border: 1px solid #bbf7d0;
                font-weight: bold;
              }
              .badge-indigo {
                background-color: #e0e7ff;
                color: #3730a3;
                padding: 2px 8px;
                border-radius: 4px;
                border: 1px solid #c7d2fe;
                font-weight: bold;
              }
              
              /* Table formatting */
              #word-print-preview-content table {
                width: 100%;
                border-collapse: collapse;
                font-size: 11px;
                margin-top: 10px;
              }
              #word-print-preview-content th, #word-print-preview-content td {
                border: 1px solid #475569 !important;
                padding: 5px 6px;
                text-align: left;
                vertical-align: middle;
              }
              #word-print-preview-content th {
                background-color: #f8fafc !important;
                font-weight: bold;
                color: #1e293b;
              }
              .row-even { background-color: #f8fafc; }
              
              /* Signatures */
              .grid-cols-2 {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 2rem;
              }
              .sig-title { font-size: 10px; font-weight: bold; color: #475569; }
              .sig-line {
                height: 32px;
                width: 176px;
                border-bottom: 1px dashed #64748b;
                margin-top: 4px;
              }
              .sig-name { font-size: 10px; color: #334155; margin-top: 4px; }
              .sig-date { font-size: 9px; color: #94a3b8; margin-top: 2px; }
              
              /* Print Page Metadata Footer */
              .print-footer {
                display: flex;
                justify-content: space-between;
                font-size: 8px;
                color: #94a3b8;
                margin-top: auto;
                padding-top: 6px;
                border-top: 1px solid #cbd5e1;
                font-family: monospace;
              }
              
              .signature-section {
                margin-top: 15px;
                border-top: 1px solid #cbd5e1;
                padding-top: 15px;
              }
            `}</style>
            {/* WORD-STYLE CONTROL PANEL (SIDEBAR) */}
            <div className="w-full md:w-[350px] bg-slate-50 border-r border-slate-200 flex flex-col h-full shrink-0 shadow-2xl overflow-y-auto">
              {/* Sidebar Header */}
              <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-teal-50 rounded-lg border border-teal-100 text-teal-600">
                    <Printer className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 font-display">ตั้งค่าและพิมพ์เอกสาร</h3>
                    <p className="text-[10px] text-slate-400">Word-Style Print Studio</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPrintPreviewOpen(false)}
                  className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg transition cursor-pointer"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              {/* Sidebar Settings Content */}
              <div className="p-5 flex-1 flex flex-col gap-6">
                {/* 1. HUGE WORD PRINT BUTTON */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <button
                    type="button"
                    onClick={handlePrintAction}
                    className="w-full bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white p-4 rounded-lg flex flex-col items-center justify-center gap-2 transition shadow-md hover:shadow-lg font-bold group cursor-pointer"
                  >
                    <Printer className="w-8 h-8 group-hover:scale-105 transition" />
                    <span className="text-sm">พิมพ์ออกทางเครื่องพิมพ์ (Print)</span>
                    <span className="text-[11px] font-normal opacity-85 text-center">
                      รวมทั้งหมด {Math.ceil(getFilteredPrintRecords().length / printItemsPerPage)} หน้า ({getFilteredPrintRecords().length} รายการ)
                    </span>
                  </button>
                </div>

                {/* 2. PAGE ORIENTATION */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-500 font-display uppercase tracking-wider">การวางแนวหน้ากระดาษ</label>
                  <div className="grid grid-cols-2 gap-2 bg-white p-1 rounded-lg border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setPrintPageOrientation('portrait')}
                      className={`py-2 px-3 text-xs font-bold rounded-md transition-all cursor-pointer ${
                        printPageOrientation === 'portrait'
                          ? 'bg-teal-50 text-teal-700 border border-teal-100 shadow-xs'
                          : 'text-slate-600 hover:bg-slate-50 border border-transparent'
                      }`}
                    >
                      แนวตั้ง (Portrait)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPrintPageOrientation('landscape')}
                      className={`py-2 px-3 text-xs font-bold rounded-md transition-all cursor-pointer ${
                        printPageOrientation === 'landscape'
                          ? 'bg-teal-50 text-teal-700 border border-teal-100 shadow-xs'
                          : 'text-slate-600 hover:bg-slate-50 border border-transparent'
                      }`}
                    >
                      แนวนอน (Landscape)
                    </button>
                  </div>
                </div>

                {/* 3. MARGIN SETUP */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-500 font-display uppercase tracking-wider">ระยะขอบกระดาษ (Margins)</label>
                  <div className="grid grid-cols-3 gap-1 bg-white p-1 rounded-lg border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setPrintMarginSize('narrow')}
                      className={`py-1.5 px-1 text-[10px] font-bold rounded-sm transition-all cursor-pointer ${
                        printMarginSize === 'narrow'
                          ? 'bg-teal-50 text-teal-700 border border-teal-100 shadow-xs'
                          : 'text-slate-600 hover:bg-slate-50 border border-transparent'
                      }`}
                    >
                      แคบ (1.0 ซม.)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPrintMarginSize('normal')}
                      className={`py-1.5 px-1 text-[10px] font-bold rounded-sm transition-all cursor-pointer ${
                        printMarginSize === 'normal'
                          ? 'bg-teal-50 text-teal-700 border border-teal-100 shadow-xs'
                          : 'text-slate-600 hover:bg-slate-50 border border-transparent'
                      }`}
                    >
                      ปกติ (2.0 ซม.)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPrintMarginSize('wide')}
                      className={`py-1.5 px-1 text-[10px] font-bold rounded-sm transition-all cursor-pointer ${
                        printMarginSize === 'wide'
                          ? 'bg-teal-50 text-teal-700 border border-teal-100 shadow-xs'
                          : 'text-slate-600 hover:bg-slate-50 border border-transparent'
                      }`}
                    >
                      กว้าง (3.0 ซม.)
                    </button>
                  </div>
                </div>

                {/* 4. ITEMS PER PAGE */}
                <div className="flex flex-col gap-2 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-slate-500 font-display uppercase tracking-wider">จำนวนรายการต่อหน้า</label>
                    <span className="text-xs font-bold text-teal-700 bg-teal-50 border border-teal-100 px-2 py-0.5 rounded-sm">{printItemsPerPage} แถว</span>
                  </div>
                  <input
                    type="range"
                    min="15"
                    max="55"
                    step="1"
                    value={printItemsPerPage}
                    onChange={(e) => setPrintItemsPerPage(parseInt(e.target.value, 10))}
                    className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-teal-600 mt-1"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5">ลากเพื่อปรับความแน่นแถวตารางแต่ละหน้าอัตโนมัติ</span>
                </div>

                {/* 5. PREVIEW ZOOM LEVEL */}
                <div className="flex flex-col gap-2 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-slate-500 font-display uppercase tracking-wider">ระดับการซูมตัวอย่าง</label>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-sm">{printPreviewZoom}%</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setPrintPreviewZoom(Math.max(40, printPreviewZoom - 10))}
                      className="p-1.5 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg transition cursor-pointer"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="range"
                      min="40"
                      max="120"
                      step="5"
                      value={printPreviewZoom}
                      onChange={(e) => setPrintPreviewZoom(parseInt(e.target.value, 10))}
                      className="flex-1 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-teal-600"
                    />
                    <button
                      type="button"
                      onClick={() => setPrintPreviewZoom(Math.min(120, printPreviewZoom + 10))}
                      className="p-1.5 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg transition cursor-pointer"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 mt-1.5">
                    <button
                      type="button"
                      onClick={() => setPrintPreviewZoom(50)}
                      className="py-1 text-[9px] font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-sm cursor-pointer"
                    >
                      50%
                    </button>
                    <button
                      type="button"
                      onClick={() => setPrintPreviewZoom(75)}
                      className="py-1 text-[9px] font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-sm cursor-pointer"
                    >
                      75%
                    </button>
                    <button
                      type="button"
                      onClick={() => setPrintPreviewZoom(90)}
                      className="py-1 text-[9px] font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-sm cursor-pointer"
                    >
                      90%
                    </button>
                    <button
                      type="button"
                      onClick={() => setPrintPreviewZoom(100)}
                      className="py-1 text-[9px] font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-sm cursor-pointer"
                    >
                      100%
                    </button>
                  </div>
                </div>

                {/* 6. STATIC READ-ONLY SPECS */}
                <div className="bg-slate-100 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 flex flex-col gap-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">ขนาดกระดาษพิมพ์:</span>
                    <span className="font-semibold text-slate-700">A4 (21.0 x 29.7 ซม.)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">โต๊ะคัดกรอง:</span>
                    <span className="font-semibold text-teal-800 text-right">{printDeskFilter}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">รอบเวลาการจัดส่ง:</span>
                    <span className="font-semibold text-slate-700 text-right">
                      {printTimeFilterMode === 'all' && 'ทุกรอบเวลา'}
                      {printTimeFilterMode === 'morning' && 'รอบเช้า (00:00 - 12:00)'}
                      {printTimeFilterMode === 'afternoon' && 'รอบบ่าย (12:01 - 16:00)'}
                      {printTimeFilterMode === 'custom' && `${printTimeStart} - ${printTimeEnd}`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Sidebar Footer */}
              <div className="p-4 border-t border-slate-200 bg-white flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsPrintPreviewOpen(false)}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-bold rounded-lg text-xs transition cursor-pointer"
                >
                  ปิดหน้าต่างนี้ (Close)
                </button>
              </div>
            </div>

            {/* DESKTOP DESK AREA (RIGHT PANEL) */}
            <div className="flex-1 bg-slate-900 p-8 overflow-y-auto flex flex-col items-center gap-8 relative select-none">
              {/* Desktop zoom helper */}
              <div className="sticky top-0 bg-slate-800/80 backdrop-blur-md text-white text-[10px] px-3 py-1.5 rounded-full z-10 flex items-center gap-1.5 shadow-md">
                <Eye className="w-3.5 h-3.5 text-teal-400" />
                <span>จำลองพรีวิวเอกสารบนโต๊ะทำงานด้วยซูม {printPreviewZoom}%</span>
              </div>

              {/* A4 PAGES GRID CONTAINER WITH SCALE TRANSFORMATION */}
              <div
                id="word-print-preview-content"
                style={{
                  transform: `scale(${printPreviewZoom / 100})`,
                  transformOrigin: 'top center',
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '2.5rem',
                  paddingBottom: '4rem',
                }}
              >
                {(() => {
                  const matches = getFilteredPrintRecords();
                  const totalPages = Math.ceil(matches.length / printItemsPerPage);
                  
                  // Helper list for chunking
                  const pageChunks: typeof matches[] = [];
                  for (let i = 0; i < matches.length; i += printItemsPerPage) {
                    pageChunks.push(matches.slice(i, i + printItemsPerPage));
                  }

                  const today = new Date();
                  let periodLabel = '';
                  if (printPeriodFilter === 'today') {
                    periodLabel = `ประจำวันที่ ${today.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}`;
                  } else if (printPeriodFilter === 'yesterday') {
                    const yesterday = new Date();
                    yesterday.setDate(today.getDate() - 1);
                    periodLabel = `ประจำวันที่ ${yesterday.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}`;
                  } else if (printPeriodFilter === 'week') {
                    const sevenDaysAgo = new Date();
                    sevenDaysAgo.setDate(today.getDate() - 7);
                    periodLabel = `ตั้งแต่วันที่ ${sevenDaysAgo.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} ถึงวันที่ ${today.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}`;
                  } else {
                    const startStr = printStartDate ? new Date(printStartDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : 'เริ่มต้น';
                    const endStr = printEndDate ? new Date(printEndDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : 'ปัจจุบัน';
                    periodLabel = `ช่วงวันที่ ${startStr} ถึง ${endStr}`;
                  }

                  return pageChunks.map((chunk, chunkIdx) => {
                    const pageMarginClass = 
                      printMarginSize === 'narrow' ? 'margin-narrow' :
                      printMarginSize === 'wide' ? 'margin-wide' : 'margin-normal';

                    const isPortrait = printPageOrientation === 'portrait';
                    const pageClass = isPortrait ? 'print-page' : 'print-page-landscape';

                    return (
                      <div
                        key={chunkIdx}
                        className={`${pageClass} ${pageMarginClass} shadow-2xl border border-slate-200 shrink-0 text-slate-800 flex flex-col justify-between`}
                        style={{
                          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.15)',
                        }}
                      >
                        {/* Page Top Body */}
                        <div>
                          {/* PAGE HEADER */}
                          <div className="flex flex-col items-center text-center pb-4 border-b-2 border-double border-slate-300">
                            {/* Emblem */}
                            <div className="logo-box">FA</div>
                            <h2 className="title-lg font-bold font-display text-slate-900">
                              ใบนำส่งและตรวจสอบเอกสารการรับเงิน/บัญชี
                            </h2>
                            <p className="subtitle-sm font-semibold">
                              ส่วนการเงินและบัญชี มหาวิทยาลัยแม่ฟ้าหลวง
                            </p>
                            
                            {/* Meta Badge Rows */}
                            <div className="meta-row">
                              <span className="badge-teal">
                                ผู้เสนอ: {printDeskFilter}
                              </span>
                              <span className="badge-bg font-bold">
                                {periodLabel}
                              </span>
                              <span className="badge-indigo">
                                {printTimeFilterMode === 'all' && 'ทุกรอบเวลา'}
                                {printTimeFilterMode === 'morning' && 'รอบจัดส่งเช้า (00:00 - 12:00)'}
                                {printTimeFilterMode === 'afternoon' && 'รอบจัดส่งบ่าย (12:01 - 16:00)'}
                                {printTimeFilterMode === 'custom' && `รอบจัดส่ง: ${printTimeStart} - ${printTimeEnd} น.`}
                              </span>
                            </div>
                          </div>

                          {/* DATA TABLE */}
                          <table>
                            <thead>
                              <tr>
                                <th style={{ width: '40px', textAlign: 'center' }}>ลำดับ</th>
                                <th style={{ width: '110px' }}>เลขทะเบียนรับ</th>
                                <th style={{ width: '90px' }}>เลขที่อว</th>
                                <th>หน่วยงาน</th>
                                <th style={{ width: '90px' }}>เลขที่เอกสาร</th>
                                <th style={{ width: '90px' }}>ประเภทเอกสาร</th>
                                <th style={{ width: '80px', textAlign: 'center' }}>วันที่ส่ง</th>
                                <th style={{ width: '130px', textAlign: 'center' }}>ลงชื่อผู้รับมอบ</th>
                              </tr>
                            </thead>
                            <tbody>
                              {chunk.map((item, itemIdx) => {
                                const globalIdx = chunkIdx * printItemsPerPage + itemIdx + 1;
                                const isEven = itemIdx % 2 === 1;
                                return (
                                  <tr key={itemIdx} className={isEven ? 'row-even' : ''}>
                                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{globalIdx}</td>
                                    <td className="font-mono font-medium">{item.data.barcode}</td>
                                    <td className="font-mono">{item.data.mhesiNumber || '-'}</td>
                                    <td>{item.data.agency || '-'}</td>
                                    <td>{item.data.docNumber || '-'}</td>
                                    <td style={{ fontSize: '10px' }}>{item.data.docType || '-'}</td>
                                    <td style={{ textAlign: 'center', fontSize: '10px' }}>{item.data.receiveDate}</td>
                                    <td style={{ height: '24px' }}></td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* SIGNATURE SECTION (ONLY ON LAST PAGE) */}
                        <div className="flex flex-col gap-4 mt-6">
                          {chunkIdx === totalPages - 1 && (
                            <div className="signature-section grid-cols-2 pt-5">
                              {/* Sender Signature */}
                              <div className="flex flex-col items-center justify-center text-center gap-1">
                                <span className="sig-title">ลงชื่อผู้เสนอส่งเอกสาร (ฝ่ายธุรการ)</span>
                                <div className="sig-line"></div>
                                <span className="sig-name">
                                  (......................................................)
                                </span>
                                <span className="sig-date">วันที่: ......./......./....... เวลา: ................ น.</span>
                              </div>
                              
                              {/* Receiver Signature */}
                              <div className="flex flex-col items-center justify-center text-center gap-1">
                                <span className="sig-title">ลงชื่อผู้รับมอบเอกสาร (เจ้าหน้าที่ผู้ตรวจจ่าย)</span>
                                <div className="sig-line"></div>
                                <span className="sig-name">
                                  (......................................................)
                                </span>
                                <span className="sig-date">วันที่: ......./......./....... เวลา: ................ น.</span>
                              </div>
                            </div>
                          )}

                          {/* Print Page Metadata Footer */}
                          <div className="print-footer">
                            <span>หน้า {chunkIdx + 1} จาก {totalPages} | ใบนำส่งเลขที่ {printDeskFilter}-{today.getFullYear()}{(today.getMonth() + 1).toString().padStart(2, '0')}{today.getDate().toString().padStart(2, '0')}</span>
                            <span>พิมพ์ด้วยระบบ Word-Style Print Studio เมื่อ {getThaiDateTimeString()}</span>
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* SUPABASE SQL SETUP MODAL */}
      <SupabaseSqlModal
        isOpen={isSupabaseSqlModalOpen}
        onClose={() => setIsSupabaseSqlModalOpen(false)}
        status={supabaseStatus}
        onRefreshStatus={checkSupabase}
      />

      {/* DOCUMENT EDITOR MODAL (8-FIELD SPEC FOR TAB 1) */}
      {isDocumentEditorOpen && modalEditItem && (
        <DocumentEditorModal
          isOpen={isDocumentEditorOpen}
          onClose={() => {
            setIsDocumentEditorOpen(false);
            setModalEditItem(null);
          }}
          record={modalEditItem.record}
          recordId={modalEditItem.id}
          dropdownConfig={dropdownConfig}
          onSave={handleSaveFromDocumentEditor}
          isSaving={isSaving}
        />
      )}

      {/* CLEAR ALL DATA CONFIRMATION MODAL */}
      {isClearAllConfirmOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0a221b] rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 dark:border-emerald-500/30 p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-100 dark:bg-rose-950/50 text-rose-600 rounded-xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">ยืนยันล้างข้อมูลเอกสารทั้งหมด?</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">การกระทำนี้จะล้างข้อมูลเอกสารออกจากระบบและ Supabase</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-[#071914] p-3 rounded-xl border border-slate-100 dark:border-emerald-500/20">
              ระบบจะลบข้อมูลเอกสารทั้งหมดในตาราง <strong>documents</strong> บนฐานข้อมูล Supabase (<code className="font-mono">{SUPABASE_PROJECT_ID}</code>) และรีเซ็ตจำนวนสถิติบนหน้าจอทั้งหมดให้เป็น 0 เริ่มต้นใหม่
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsClearAllConfirmOpen(false)}
                disabled={isClearingAll}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleClearAllData}
                disabled={isClearingAll}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer flex items-center gap-2"
              >
                {isClearingAll ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>{isClearingAll ? 'กำลังล้างข้อมูล...' : 'ยืนยันล้างข้อมูลทั้งหมด'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ALERT / VALIDATION MODAL POPUP */}
      {alertModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0a221b] rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 dark:border-emerald-500/30 p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl ${
                alertModal.type === 'error'
                  ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-600'
                  : 'bg-amber-100 dark:bg-amber-950/50 text-amber-600'
              }`}>
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{alertModal.title}</h3>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-[#071914] p-3 rounded-xl border border-slate-100 dark:border-emerald-500/20 whitespace-pre-line">
              {alertModal.message}
            </p>

            <div className="flex items-center justify-end pt-2">
              <button
                type="button"
                onClick={() => setAlertModal(null)}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer transition"
              >
                ตกลง / รับทราบ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK DELETE CONFIRMATION MODAL */}
      {isBulkDeleteConfirmOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0a221b] rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 dark:border-emerald-500/30 p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-100 dark:bg-rose-950/50 text-rose-600 rounded-xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">ยืนยันการลบรายการที่เลือก?</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  เลือกไว้จำนวน {selectedStagedIds.length} รายการ
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-[#071914] p-3 rounded-xl border border-slate-100 dark:border-emerald-500/20">
              ระบบจะลบข้อมูลที่เลือกทั้ง {selectedStagedIds.length} รายการออกจากตารางตรวจสอบ และลบออกจากฐานข้อมูล Supabase ตามรหัสอ้างอิง (Primary Key) ของแต่ละรายการอย่างถาวร
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsBulkDeleteConfirmOpen(false)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer flex items-center gap-2"
              >
                {isDeleting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>{isDeleting ? 'กำลังลบ...' : `ยืนยันลบ ${selectedStagedIds.length} รายการ`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: POP-UP MODAL FOR DOCUMENT RETURN */}
      {tab6ReturnModal && tab6ReturnModal.isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !tab6ReturnModal.isSaving) {
                e.preventDefault();
                handleSaveTab6Return();
              }
            }}
            className="bg-white dark:bg-[#0a221b] rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 dark:border-emerald-500/30 overflow-hidden flex flex-col"
          >
            {/* HEADER */}
            <div className="p-4 border-b border-slate-100 dark:border-emerald-500/20 flex items-center justify-between bg-slate-50/70 dark:bg-[#071914]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 rounded-xl">
                  <FileCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 font-display">
                    บันทึกส่งคืนเอกสาร (หน้า 6)
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    เลขทะเบียนรับ: <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{tab6ReturnModal.record.barcode}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={tab6ReturnModal.isSaving}
                onClick={() => setTab6ReturnModal(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg cursor-pointer transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* DOCUMENT SUMMARY CARD */}
            <div className="p-4 flex flex-col gap-3">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0f2e25]/50 border border-slate-100 dark:border-emerald-500/20 text-xs flex flex-col gap-1.5">
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-400 dark:text-emerald-400/60">ผู้ส่งเอกสาร:</span>{' '}
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{tab6ReturnModal.record.senderName || tab6ReturnModal.record['ผู้ส่งเอกสาร'] || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-emerald-400/60">หน่วยงาน:</span>{' '}
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{tab6ReturnModal.record.agency || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-emerald-400/60">เลขที่เอกสาร:</span>{' '}
                    <span className="font-mono text-slate-700 dark:text-slate-300">{tab6ReturnModal.record.docNumber || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-emerald-400/60">ประเภทเอกสาร:</span>{' '}
                    <span className="text-slate-700 dark:text-slate-300">{tab6ReturnModal.record.docType || '-'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 dark:text-emerald-400/60">ผู้ให้บริการเดิม:</span>{' '}
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                      {tab6ReturnModal.record.finalDesk || tab6ReturnModal.record.autoDesk || '-'}
                    </span>
                    {tab6ReturnModal.record.tableDate && (
                      <span className="text-[10px] text-slate-400 dark:text-emerald-400/50 ml-2 font-mono">
                        (ลงโต๊ะ: {tab6ReturnModal.record.tableDate})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* FIELD 1: วันที่ส่งคืน */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1 font-mono">
                  1. วันที่ส่งคืน (Format: YYYY-MM-DD HH:mm:ss)
                </label>
                <input
                  type="text"
                  value={tab6ReturnModal.returnDate}
                  onChange={(e) => setTab6ReturnModal({ ...tab6ReturnModal, returnDate: e.target.value })}
                  placeholder="YYYY-MM-DD HH:mm:ss"
                  className="w-full text-xs font-mono px-3 py-2 rounded-lg border bg-white dark:bg-[#0f2e25] border-slate-300 dark:border-emerald-500/30 text-slate-800 dark:text-emerald-100 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              {/* FIELD 2: สถานะ_ธุรการส่งคืน */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1 font-mono">
                  2. สถานะ_ธุรการส่งคืน
                </label>
                <select
                  autoFocus
                  value={tab6ReturnModal.returnStatus}
                  onChange={(e) => setTab6ReturnModal({ ...tab6ReturnModal, returnStatus: e.target.value })}
                  className="w-full text-xs px-3 py-2 rounded-lg border bg-white dark:bg-[#0f2e25] border-slate-300 dark:border-emerald-500/30 text-slate-800 dark:text-emerald-100 focus:outline-hidden focus:border-emerald-500 cursor-pointer"
                >
                  {RETURN_STATUS_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* FOOTER ACTIONS */}
            <div className="p-4 bg-slate-50 dark:bg-[#071914] border-t border-slate-100 dark:border-emerald-500/20 flex items-center justify-between">
              <p className="text-[10px] text-slate-400 dark:text-emerald-400/50">
                💡 กด <kbd className="px-1 py-0.5 bg-slate-200 dark:bg-emerald-950 rounded text-slate-700 dark:text-emerald-300">Enter</kbd> หรือคลิกปุ่มบันทึกเพื่อดำเนินการ
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={tab6ReturnModal.isSaving}
                  onClick={() => setTab6ReturnModal(null)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-emerald-950/50 rounded-lg cursor-pointer transition"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={tab6ReturnModal.isSaving}
                  onClick={handleSaveTab6Return}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer transition"
                >
                  {tab6ReturnModal.isSaving ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>{tab6ReturnModal.isSaving ? 'กำลังบันทึก...' : 'บันทึก'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
