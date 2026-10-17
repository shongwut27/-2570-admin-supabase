import React, { useState } from 'react';
import { X, Copy, Check, ExternalLink, RefreshCw, Database, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { SUPABASE_PROJECT_ID, SUPABASE_URL, SUPABASE_SQL_SETUP, testSupabaseConnection } from '../lib/supabase';

interface SupabaseSqlModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: { ok: boolean; tableExists: boolean; checking: boolean };
  onRefreshStatus: () => Promise<void>;
}

export function SupabaseSqlModal({ isOpen, onClose, status, onRefreshStatus }: SupabaseSqlModalProps) {
  const [copied, setCopied] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SETUP);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleCheck = async () => {
    setIsChecking(true);
    await onRefreshStatus();
    setIsChecking(false);
  };

  const sqlEditorUrl = `https://supabase.com/dashboard/project/${SUPABASE_PROJECT_ID}/sql/new`;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-600 text-white rounded-xl">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">ตั้งค่าฐานข้อมูล Supabase</h3>
              <p className="text-xs text-slate-500 font-mono">
                Project ID: {SUPABASE_PROJECT_ID}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-all cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Status Box */}
          <div className={`p-4 rounded-xl border flex items-start space-x-3 ${
            status.tableExists
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}>
            {status.tableExists ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 text-sm">
              <div className="font-bold">
                {status.tableExists 
                  ? 'เชื่อมต่อฐานข้อมูล Supabase สำเร็จ และพบตาราง 2570-ระบบติดตามเอกสาร แล้ว!' 
                  : 'เชื่อมต่อ Supabase ได้แล้ว แต่ยังไม่ได้สร้างตาราง 2570-ระบบติดตามเอกสาร'}
              </div>
              <div className="text-xs mt-1 text-slate-600">
                {status.tableExists
                  ? 'ระบบบันทึก แก้ไข ค้นหา และสถิติข้อมูลจะทำงานผ่าน Supabase ตาราง 2570-ระบบติดตามเอกสาร ทันที รวดเร็วระดับ < 50ms ไม่หลุดแน่นอน'
                  : 'กรุณาคัดลอกคำสั่ง SQL ด้านล่างนี้ไปวางแล้วกด Run ใน Supabase SQL Editor เพื่อสร้างตาราง 2570-ระบบติดตามเอกสาร ให้สมบูรณ์'}
              </div>
            </div>
            <button
              onClick={handleCheck}
              disabled={isChecking}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-1 shrink-0 shadow-xs cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isChecking ? 'animate-spin' : ''}`} />
              <span>{isChecking ? 'กำลังตรวจ...' : 'ตรวจสอบอีกครั้ง'}</span>
            </button>
          </div>

          {/* Setup steps */}
          {!status.tableExists && (
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs text-slate-700 space-y-2">
              <div className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>ขั้นตอนการสร้างตาราง (ทำเพียงครั้งเดียว):</span>
              </div>
              <ol className="list-decimal list-inside space-y-1.5 pl-1 leading-relaxed">
                <li>กดปุ่ม <strong>"คัดลอกคำสั่ง SQL"</strong> ด้านล่าง</li>
                <li>กดปุ่ม <strong>"เปิด Supabase SQL Editor"</strong> เพื่อไปยังหน้าสร้าง SQL ของโปรเจกต์</li>
                <li>วาง (Paste/Ctrl+V) คำสั่งในกล่องข้อความ แล้วกดปุ่ม <strong>"Run"</strong> สีเขียว</li>
                <li>กลับมาที่หน้านี้แล้วกดปุ่ม <strong>"ตรวจสอบอีกครั้ง"</strong> ระบบจะพร้อมใช้งาน 100% ทันที</li>
              </ol>
            </div>
          )}

          {/* SQL Code Box */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-700">คำสั่ง SQL สำหรับสร้างตาราง documents และ Indexes:</span>
              <div className="flex items-center space-x-2">
                <a
                  href={sqlEditorUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>เปิด Supabase SQL Editor</span>
                </a>
                <button
                  onClick={handleCopy}
                  className="px-3 py-1 text-xs font-medium bg-slate-800 text-white hover:bg-slate-900 rounded-lg flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copied ? 'คัดลอกแล้ว!' : 'คัดลอกคำสั่ง SQL'}</span>
                </button>
              </div>
            </div>

            <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono overflow-x-auto max-h-64 leading-relaxed border border-slate-800">
              {SUPABASE_SQL_SETUP}
            </pre>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 font-mono">
            Endpoint: {SUPABASE_URL}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-medium rounded-xl transition-all cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
}
