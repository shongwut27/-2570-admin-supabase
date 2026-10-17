export interface DocumentRecord {
  noType?: 'N' | 'O' | string; // N = งานใหม่, O = งานเก่า
  ep?: string; // เลข EP สำหรับงานใหญ่/ด่วน/พิเศษ (กรอกตัวเลข)
  barcode: string; // เลขทะเบียนรับ
  type?: string; // หน้างาน/แท็บงาน (เช่น '1. ตรวจจ่าย-งานใหม่', '4. งานเบิกจ่าย', 'งานด้านอื่น')
  TYPE?: string; // คอลัมน์ TYPE ใน Supabase
  senderName?: string; // ผู้ส่งเอกสาร (คอลัมน์ D จาก Checklist)
  ผู้ส่งเอกสาร?: string; // คอลัมน์ ผู้ส่งเอกสาร ใน Supabase
  senderPhone?: string; // โทรศัพท์ (คอลัมน์ E จาก Checklist)
  โทรศัพท์?: string; // คอลัมน์ โทรศัพท์ ใน Supabase
  'โทร.'?: string; // คอลัมน์ โทร. ใน Supabase
  senderEmail?: string; // ที่อยู่อีเมล (คอลัมน์ F จาก Checklist)
  ที่อยู่อีเมล?: string; // คอลัมน์ ที่อยู่อีเมล ใน Supabase
  mhesiNumber: string; // เลขที่ อว/ ชื่อ
  agency: string; // หน่วยงาน
  docNumber: string; // เลขที่เอกสาร
  docType: string; // ประเภทเอกสาร
  receiveDate: string; // วันที่รับ
  tableDate?: string; // วันที่ลงโต๊ะ
  returnDate?: string; // วันที่ส่งคืน
  returnStatus?: string; // สถานะการส่งคืน
  autoDesk: string; // ผู้ให้บริการ (อัตโนมัติ)
  overrideDesk?: string; // เปลี่ยนผู้ให้บริการ
  finalDesk: string; // ผู้ให้บริการ (Final)
  remarks?: string; // เหตุผล/หมายเหตุ
}

export interface SheetConfig {
  agencies: string[];
  docTypes: string[];
  returnStatuses: string[];
  desks: string[];
}

export interface SpreadsheetInfo {
  id: string;
  name: string;
  sheets: string[];
}

export interface ScanItem {
  id: string; // UUID/Local unique ID
  createdAt?: number; // Timestamp for sorting
  tabId?: number; // Origin tab ID (1: งานใหม่, 2: งานเก่า, etc.)
  barcode: string;
  foundInGenerate: boolean;
  foundInDataInput?: boolean;
  dataInputRowIndex?: number;
  isLoading: boolean;
  error?: string;
  data: DocumentRecord;
}

export const PROVIDER_DESKS = [
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

export const ALL_PRINTING_PROVIDERS = [
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

