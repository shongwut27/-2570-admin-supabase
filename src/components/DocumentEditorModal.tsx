import React, { useState, useEffect, FormEvent } from 'react';
import { X, Save, Edit3, Check, Loader2, Sparkles, Building, FileText, Hash, Phone, User, Tag } from 'lucide-react';
import { DocumentRecord, SheetConfig, PROVIDER_DESKS } from '../types';

export const EP_OPTIONS = [
  { value: '', label: '- ไม่ระบุ EP (งานปกติ) -' },
  { value: '1', label: 'EP 1 - งานด่วน' },
  { value: '2', label: 'EP 2 - งานเก่าด่วน' },
  { value: '3', label: 'EP 3 - งานใหญ่' },
  { value: '4', label: 'EP 4' },
  { value: '5', label: 'EP 5' },
];

export const DESK_OPTIONS_LIST = [
  '(1)ภาคินี',
  '(2)พรนัชชา',
  '(3)ดารารัตน์',
  '(4)สาโรจน์',
  '(5)ละอองดาว',
  '(6)ธนัฏพร',
  '(7)อภิญญา',
  '(8)ทรงวุฒิ',
  '(9)ดุษฎา',
  '(10)ทิพาธร',
  '(C1)สิริลักษ์',
  '(C2)กาญจนา',
  '(C3)ณัฐนันท์',
  '(C4)พรพิไล',
  '(C5)ทิพาธร',
  'งานเบิกจ่ายเงิน',
  '(F8)ประกายมาศ',
  'ผ่องพรรณ',
  '(S2)จิรวรรณ',
  '(S1)จารุวรรณ',
  '(F7)กฤษณา',
];

interface DocumentEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: DocumentRecord;
  recordId?: string;
  dropdownConfig?: SheetConfig;
  onSave: (updatedRecord: DocumentRecord, recordId?: string) => Promise<void> | void;
  isSaving?: boolean;
}

export function DocumentEditorModal({
  isOpen,
  onClose,
  record,
  recordId,
  dropdownConfig,
  onSave,
  isSaving = false,
}: DocumentEditorModalProps) {
  const [formData, setFormData] = useState<DocumentRecord>({ ...record });
  const [selectedDesk, setSelectedDesk] = useState<string>(
    record.finalDesk || record.overrideDesk || record.autoDesk || PROVIDER_DESKS[0]
  );

  useEffect(() => {
    setFormData({ ...record });
    const desk = record.finalDesk || record.overrideDesk || record.autoDesk || PROVIDER_DESKS[0];
    setSelectedDesk(desk);
  }, [record]);

  if (!isOpen) return null;

  const handleChange = (field: keyof DocumentRecord, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleDeskChange = (desk: string) => {
    setSelectedDesk(desk);
    setFormData(prev => ({
      ...prev,
      overrideDesk: desk,
      finalDesk: desk,
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const finalRecord: DocumentRecord = {
      ...formData,
      ep: formData.ep ? String(formData.ep).trim() : '',
      noType: formData.noType || 'N',
      overrideDesk: selectedDesk !== formData.autoDesk ? selectedDesk : '',
      finalDesk: selectedDesk || formData.autoDesk,
      type: formData.type || formData.TYPE || '',
      TYPE: formData.type || formData.TYPE || '',
      senderName: formData.senderName || formData['ผู้ส่งเอกสาร'] || '',
      'ผู้ส่งเอกสาร': formData.senderName || formData['ผู้ส่งเอกสาร'] || '',
      senderPhone: formData.senderPhone || formData['โทรศัพท์'] || '',
      'โทรศัพท์': formData.senderPhone || formData['โทรศัพท์'] || '',
      senderEmail: formData.senderEmail || formData['ที่อยู่อีเมล'] || '',
      'ที่อยู่อีเมล': formData.senderEmail || formData['ที่อยู่อีเมล'] || '',
    };
    await onSave(finalRecord, recordId);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in-50 zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-xs">
              <Edit3 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 font-display flex items-center gap-2">
                <span>แก้ไขรายละเอียดเอกสาร</span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  {formData.barcode}
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                ปรับปรุงข้อมูลลงตาราง 2570-ระบบติดตามเอกสาร ใน Supabase ทันที
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-all cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          
          {/* Row 1: 1) EP. (Dropdown - ห้ามหายเด็ดขาด) & 2) N/O & 3) เลขทะเบียนรับ */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* 1) EP. Dropdown */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-purple-600" />
                <span>1) EP. (งานด่วน/ใหญ่) *</span>
              </label>
              <select
                id="edit-modal-ep-select"
                value={formData.ep || ''}
                onChange={e => handleChange('ep', e.target.value)}
                className="w-full rounded-xl border border-slate-300 shadow-2xs text-xs py-2 px-3 bg-white text-slate-800 font-semibold focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              >
                {EP_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                เลือกประเภท EP เพื่อสรุปภาระงาน
              </span>
            </div>

            {/* 2) N/O Dropdown */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                2) N/O (ลักษณะงาน) *
              </label>
              <select
                id="edit-modal-no-select"
                value={formData.noType || 'N'}
                onChange={e => handleChange('noType', e.target.value as 'N' | 'O')}
                className="w-full rounded-xl border border-slate-300 shadow-2xs text-xs py-2 px-3 bg-white text-slate-800 font-semibold focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="N">N (งานใหม่)</option>
                <option value="O">O (งานเก่า)</option>
              </select>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                N = งานใหม่, O = งานเก่า
              </span>
            </div>

            {/* 3) เลขทะเบียนรับ */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Hash className="w-3.5 h-3.5 text-emerald-600" />
                <span>3) เลขทะเบียนรับ *</span>
              </label>
              <input
                id="edit-modal-barcode-input"
                type="text"
                value={formData.barcode}
                onChange={e => handleChange('barcode', e.target.value)}
                required
                className="w-full rounded-xl border border-slate-300 shadow-2xs text-xs font-mono font-bold py-2 px-3 bg-slate-50 text-slate-800 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                รหัสบาร์โค้ดลงทะเบียน
              </span>
            </div>
          </div>

          {/* Row 2: 4) เลขที่ อว/ ชื่อ & 5) หน่วยงาน */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 4) เลขที่ อว/ ชื่อ */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                <span>4) เลขที่ อว/ ชื่อ (ดึงอัตโนมัติ)</span>
              </label>
              <input
                id="edit-modal-mhesi-input"
                type="text"
                placeholder="เช่น อว 6601/..."
                value={formData.mhesiNumber || ''}
                onChange={e => handleChange('mhesiNumber', e.target.value)}
                className="w-full rounded-xl border border-slate-300 shadow-2xs text-xs py-2 px-3 bg-white text-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            {/* 5) หน่วยงาน */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Building className="w-3.5 h-3.5 text-slate-500" />
                <span>5) หน่วยงาน (ดึงอัตโนมัติ)</span>
              </label>
              <input
                id="edit-modal-agency-input"
                type="text"
                placeholder="ระบุหน่วยงานผู้เสนอ..."
                value={formData.agency || ''}
                onChange={e => handleChange('agency', e.target.value)}
                list="agency-suggestions"
                className="w-full rounded-xl border border-slate-300 shadow-2xs text-xs py-2 px-3 bg-white text-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              />
              {dropdownConfig?.agencies && (
                <datalist id="agency-suggestions">
                  {dropdownConfig.agencies.map((a, i) => (
                    <option key={i} value={a} />
                  ))}
                </datalist>
              )}
            </div>
          </div>

          {/* Row 3: 6) ประเภทเอกสาร & 7) เลขที่เอกสาร */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 6) ประเภทเอกสาร */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                <span>6) ประเภทเอกสาร (ดึงอัตโนมัติ)</span>
              </label>
              <input
                id="edit-modal-doctype-input"
                type="text"
                placeholder="เช่น เบิกจ่ายตรวจรับพัสดุ, ยืมเงินทดรองจ่าย..."
                value={formData.docType || ''}
                onChange={e => handleChange('docType', e.target.value)}
                list="doctype-suggestions"
                className="w-full rounded-xl border border-slate-300 shadow-2xs text-xs py-2 px-3 bg-white text-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              />
              {dropdownConfig?.docTypes && (
                <datalist id="doctype-suggestions">
                  {dropdownConfig.docTypes.map((d, i) => (
                    <option key={i} value={d} />
                  ))}
                </datalist>
              )}
            </div>

            {/* 7) เลขที่เอกสาร */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Hash className="w-3.5 h-3.5 text-slate-500" />
                <span>7) เลขที่เอกสาร (ดึงอัตโนมัติ)</span>
              </label>
              <input
                id="edit-modal-docnum-input"
                type="text"
                placeholder="เลขที่เอกสารภายใน..."
                value={formData.docNumber || ''}
                onChange={e => handleChange('docNumber', e.target.value)}
                className="w-full rounded-xl border border-slate-300 shadow-2xs text-xs font-mono py-2 px-3 bg-white text-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>

          {/* Row 4: 8) ผู้ให้บริการ-final (Dropdown เลือกโต๊ะ) */}
          <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>8) ผู้ให้บริการ-final (โต๊ะผู้ให้บริการสุดท้าย) *</span>
              </label>
              <span className="text-[10px] text-emerald-700 font-mono">
                โต๊ะเดิมที่รันคิว: {formData.autoDesk || '-'}
              </span>
            </div>

            <select
              id="edit-modal-final-desk-select"
              value={selectedDesk}
              onChange={e => handleDeskChange(e.target.value)}
              className="w-full rounded-xl border border-emerald-300 shadow-2xs text-xs font-bold py-2.5 px-3 bg-white text-emerald-950 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
            >
              <optgroup label="9 โต๊ะประจำหน้างานใหม่ (เรียงตามลำดับ)">
                {PROVIDER_DESKS.map(desk => (
                  <option key={desk} value={desk}>
                    {desk}
                  </option>
                ))}
              </optgroup>
              <optgroup label="โต๊ะผู้ให้บริการอื่นๆ / ส่งต่อ">
                {DESK_OPTIONS_LIST.filter(d => !PROVIDER_DESKS.includes(d)).map(desk => (
                  <option key={desk} value={desk}>
                    {desk}
                  </option>
                ))}
              </optgroup>
            </select>
            <p className="text-[11px] text-emerald-700">
              * หากเลือกเปลี่ยนโต๊ะด้วยตนเอง ระบบจะบันทึกลงในคอลัมน์ <strong>"ผู้ให้บริการ-final"</strong> และการสแกนรับงานครั้งถัดไปจะรันคิวต่อจากโต๊ะนี้ทันที
            </p>
          </div>

          {/* Row 5: ข้อมูลผู้ส่งและประเภทงาน (TYPE) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1 flex items-center gap-1">
                <User className="w-3 h-3 text-slate-400" />
                <span>ชื่อผู้ส่งเอกสาร</span>
              </label>
              <input
                type="text"
                placeholder="ชื่อ-สกุล ผู้ส่ง..."
                value={formData.senderName || formData['ผู้ส่งเอกสาร'] || ''}
                onChange={e => {
                  handleChange('senderName', e.target.value);
                  handleChange('ผู้ส่งเอกสาร', e.target.value);
                }}
                className="w-full rounded-xl border border-slate-200 text-xs py-1.5 px-3 bg-slate-50 text-slate-700 focus:border-emerald-500 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1 flex items-center gap-1">
                <Phone className="w-3 h-3 text-slate-400" />
                <span>เบอร์โทรศัพท์</span>
              </label>
              <input
                type="text"
                placeholder="เบอร์โทรติดต่อ..."
                value={formData.senderPhone || formData['โทรศัพท์'] || ''}
                onChange={e => {
                  handleChange('senderPhone', e.target.value);
                  handleChange('โทรศัพท์', e.target.value);
                }}
                className="w-full rounded-xl border border-slate-200 text-xs py-1.5 px-3 bg-slate-50 text-slate-700 focus:border-emerald-500 focus:bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                ที่อยู่อีเมล
              </label>
              <input
                type="email"
                placeholder="อีเมลผู้ส่ง..."
                value={formData.senderEmail || formData['ที่อยู่อีเมล'] || ''}
                onChange={e => {
                  handleChange('senderEmail', e.target.value);
                  handleChange('ที่อยู่อีเมล', e.target.value);
                }}
                className="w-full rounded-xl border border-slate-200 text-xs py-1.5 px-3 bg-slate-50 text-slate-700 focus:border-emerald-500 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                ประเภทหน้างาน (TYPE)
              </label>
              <input
                type="text"
                placeholder="เช่น 1. ตรวจจ่าย-งานใหม่, 4. งานเบิกจ่าย..."
                value={formData.type || formData.TYPE || ''}
                onChange={e => {
                  handleChange('type', e.target.value);
                  handleChange('TYPE', e.target.value);
                }}
                className="w-full rounded-xl border border-slate-200 text-xs py-1.5 px-3 bg-slate-50 text-slate-700 focus:border-emerald-500 focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              หมายเหตุ / รายละเอียดเพิ่มเติม
            </label>
            <input
              type="text"
              placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)..."
              value={formData.remarks || ''}
              onChange={e => handleChange('remarks', e.target.value)}
              className="w-full rounded-xl border border-slate-200 text-xs py-1.5 px-3 bg-slate-50 text-slate-700 focus:border-emerald-500 focus:bg-white"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition-all cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              id="save-edit-record-btn"
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>กำลังบันทึก Supabase...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>บันทึกลง 2570-ระบบติดตามเอกสาร</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
