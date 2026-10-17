import { User } from 'firebase/auth';
import { LogOut, Database, FileSpreadsheet, Copy, Trash2, CheckCircle2, AlertTriangle, ExternalLink, Code } from 'lucide-react';
import { logout } from '../lib/firebase';
import { useState } from 'react';
import { SUPABASE_PROJECT_ID } from '../lib/supabase';

interface HeaderProps {
  user: User | null;
  sheetName: string;
  spreadsheetId: string;
  onLogout: () => void;
  supabaseStatus: { ok: boolean; tableExists: boolean; checking: boolean };
  onClearAllData: () => void;
  onOpenSqlModal: () => void;
}

export function Header({
  user,
  sheetName,
  spreadsheetId,
  onLogout,
  supabaseStatus,
  onClearAllData,
  onOpenSqlModal
}: HeaderProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(spreadsheetId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSignOut = async () => {
    if (window.confirm('คุณแน่ใจหรือไม่ที่จะออกจากระบบ?')) {
      await logout();
      onLogout();
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo / Title */}
          <div className="flex items-center space-x-3">
            <div className="bg-emerald-600 text-white p-2 rounded-xl shadow-sm">
              <Database className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight font-display flex items-center gap-2">
                <span>ระบบติดตามเอกสาร</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-medium">
                  Supabase Edition
                </span>
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Document Tracking System • FA Central Admin
              </p>
            </div>
          </div>

          {/* Database Indicators */}
          <div className="hidden lg:flex items-center space-x-3">
            {/* Supabase Indicator */}
            <div 
              onClick={onOpenSqlModal}
              className={`flex items-center border rounded-xl px-3 py-1.5 text-xs cursor-pointer transition-all ${
                supabaseStatus.tableExists 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                  : 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100'
              }`}
              title="คลิกเพื่อดูการตั้งค่า Supabase"
            >
              {supabaseStatus.tableExists ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 mr-1.5 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-600 mr-1.5 shrink-0 animate-pulse" />
              )}
              <div className="text-left font-mono">
                <div className="font-semibold flex items-center gap-1">
                  <span>Supabase: {SUPABASE_PROJECT_ID}</span>
                </div>
                <div className="text-[10px] text-slate-500 flex items-center gap-1">
                  <span>{supabaseStatus.tableExists ? 'ตาราง: 2570-ระบบติดตามเอกสาร' : 'รอสร้างตาราง (คลิกเพื่อดู SQL)'}</span>
                </div>
              </div>
            </div>

            {/* Connected Sheet Information */}
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs max-w-xs">
              <FileSpreadsheet className="h-4 w-4 text-slate-500 mr-1.5 shrink-0" />
              <div className="truncate">
                <div className="font-semibold text-slate-700 text-[11px] truncate">
                  ชีทสำรอง: {sheetName || 'เชื่อมต่อ Google'}
                </div>
                <div className="text-[10px] text-slate-400 font-mono truncate flex items-center space-x-1">
                  <span className="truncate">{spreadsheetId.slice(0, 12)}...</span>
                  <button 
                    onClick={handleCopy} 
                    className="hover:text-emerald-600 p-0.5 rounded-sm shrink-0"
                    title="คัดลอก Sheet ID"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                  {copied && <span className="text-emerald-600 text-[9px] font-sans">คัดลอกแล้ว!</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Action & User Section */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Clear All Data Button */}
            <button
              onClick={onClearAllData}
              className="px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-all flex items-center gap-1 cursor-pointer"
              title="ล้างข้อมูลเอกสารทั้งหมดในระบบและ Supabase"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">ล้างข้อมูลทั้งหมด</span>
            </button>

            {/* SQL Button */}
            <button
              onClick={onOpenSqlModal}
              className="px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-all flex items-center gap-1 cursor-pointer"
              title="ดูคำสั่ง SQL สำหรับ Supabase"
            >
              <Code className="h-3.5 w-3.5 text-emerald-600" />
              <span className="hidden sm:inline">SQL Supabase</span>
            </button>

            {user && (
              <div className="flex items-center space-x-2 pl-1 border-l border-slate-200">
                <div className="flex items-center space-x-2 bg-slate-50 rounded-xl p-1 pr-2 border border-slate-100">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'User'}
                      className="h-7 w-7 rounded-lg shadow-inner"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="h-7 w-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                      {user.displayName?.charAt(0) || 'U'}
                    </div>
                  )}
                  <div className="hidden sm:block text-left">
                    <div className="text-[11px] font-bold text-slate-800 leading-tight">
                      {user.displayName}
                    </div>
                    <div className="text-[9px] text-slate-400 truncate max-w-[120px]">
                      {user.email}
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleSignOut}
                  className="p-2 rounded-xl border border-rose-100 text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-all flex items-center justify-center cursor-pointer"
                  title="ออกจากระบบ"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
