import { createClient } from '@supabase/supabase-js';
import { DocumentRecord } from '../types';

export function formatSupabaseUrl(input?: string): string {
  let val = (input || '').trim();
  val = val.replace(/^["']+|["']+$/g, '').trim();
  if (!val) {
    return 'https://xuyyzwejrzhrymqhecsm.supabase.co';
  }
  if (val.startsWith('http://') || val.startsWith('https://')) {
    return val;
  }
  if (/^[a-z0-9_-]+$/i.test(val)) {
    return `https://${val}.supabase.co`;
  }
  return `https://${val}`;
}

export function extractProjectId(input?: string): string {
  const val = (input || '').trim().replace(/^["']+|["']+$/g, '');
  if (!val) return 'xuyyzwejrzhrymqhecsm';
  if (/^[a-z0-9_-]+$/i.test(val)) return val;
  const match = val.match(/https?:\/\/([a-z0-9_-]+)\.supabase\.co/i);
  return match ? match[1] : 'xuyyzwejrzhrymqhecsm';
}

const rawUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://xuyyzwejrzhrymqhecsm.supabase.co';
export const SUPABASE_URL = formatSupabaseUrl(rawUrl);
export const SUPABASE_PROJECT_ID = extractProjectId(rawUrl);
export const SUPABASE_ANON_KEY = ((import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1eXl6d2VqcnpocnltcWhlY3NtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzMjM2MjgsImV4cCI6MjEwNjg5OTYyOH0.NWOlOkk5l7STSG5xlq5cztjM9L-77JUgMTttsdnFcG8').trim().replace(/^["']+|["']+$/g, '');

// Target table names specified by user:
export const SUPABASE_DOCUMENTS_TABLE = '2570-ระบบติดตามเอกสาร';
export const SUPABASE_CHECKLIST_2570 = 'Checklist-2570';
export const SUPABASE_CHECKLIST_2569 = 'Checklist-2569';
export const SUPABASE_2569_PULL = '2569-ดึงข้อมูล';

function initSupabaseClient() {
  try {
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  } catch (err) {
    console.error('Error creating primary Supabase client, using fallback:', err);
    return createClient('https://xuyyzwejrzhrymqhecsm.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1eXl6d2VqcnpocnltcWhlY3NtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzMjM2MjgsImV4cCI6MjEwNjg5OTYyOH0.NWOlOkk5l7STSG5xlq5cztjM9L-77JUgMTttsdnFcG8');
  }
}

export const supabase = initSupabaseClient();

export const SUPABASE_SQL_SETUP = `-- โครงสร้างตารางปัจจุบัน: "${SUPABASE_DOCUMENTS_TABLE}"
ALTER TABLE public."${SUPABASE_DOCUMENTS_TABLE}" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to 2570-ระบบติดตามเอกสาร" ON public."${SUPABASE_DOCUMENTS_TABLE}";
CREATE POLICY "Allow all access to 2570-ระบบติดตามเอกสาร"
ON public."${SUPABASE_DOCUMENTS_TABLE}"
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);
`;

const safeStr = (val: any): string => {
  if (val === null || val === undefined) return '';
  return String(val).trim();
};

/**
 * Desk phone mapping for "1. ตรวจจ่าย-งานใหม่":
 * - '(1)ภาคินี', '(2)พรนัชชา' -> '6005'
 * - '(3)ดารารัตน์', '(4)สาโรจน์' -> '6572'
 * - '(5)ละอองดาว', '(6)ธนัฏพร', '(7)อภิญญา', '(8)ทรงวุฒิ', '(9)ดุษฎา' -> '6465'
 */
export function getDeskPhone(deskName?: string): string {
  if (!deskName) return '';
  const d = deskName.trim();
  if (d.includes('ภาคินี') || d.includes('พรนัชชา') || d.startsWith('(1)') || d.startsWith('(2)')) return '6005';
  if (d.includes('ดารารัตน์') || d.includes('สาโรจน์') || d.startsWith('(3)') || d.startsWith('(4)')) return '6572';
  if (
    d.includes('ละอองดาว') || d.includes('ธนัฏพร') || d.includes('อภิญญา') ||
    d.includes('ทรงวุฒิ') || d.includes('ดุษฎา') ||
    d.startsWith('(5)') || d.startsWith('(6)') || d.startsWith('(7)') || d.startsWith('(8)') || d.startsWith('(9)')
  ) return '6465';
  return '';
}

export function mapRecordToRow(record: DocumentRecord, id?: string): Record<string, any> {
  const autoDesk = safeStr(record.autoDesk);
  const overrideDesk = safeStr(record.overrideDesk && record.overrideDesk !== 'ไม่เลือก' ? record.overrideDesk : '');
  const finalDesk = safeStr(record.finalDesk || overrideDesk || autoDesk);
  const typeVal = safeStr(record.type || record.TYPE);
  const senderNameVal = safeStr(record.senderName || record['ผู้ส่งเอกสาร']);
  let senderPhoneVal = safeStr(record.senderPhone || record['โทรศัพท์'] || (record as any)['โทร.']);
  const senderEmailVal = safeStr(record.senderEmail || record['ที่อยู่อีเมล']);

  // เฉพาะหน้า "1. ตรวจจ่าย-งานใหม่" และ "2. ตรวจจ่าย-งานเก่า": ใช้เบอร์ประจำโต๊ะตามผู้ให้บริการ-final
  if (typeVal === '1. ตรวจจ่าย-งานใหม่' || typeVal === '2. ตรวจจ่าย-งานเก่า') {
    const deskPhone = getDeskPhone(finalDesk);
    if (deskPhone) {
      senderPhoneVal = deskPhone;
    }
  }

  const noTypeVal = record.noType || (typeVal === '2. ตรวจจ่าย-งานเก่า' ? 'O' : 'N');

  const row: Record<string, any> = {
    ...(id ? { id } : {}),
    'TYPE': typeVal || (noTypeVal === 'O' ? '2. ตรวจจ่าย-งานเก่า' : '1. ตรวจจ่าย-งานใหม่'),
    'ผู้ส่งเอกสาร': senderNameVal || null,
    'โทรศัพท์': senderPhoneVal || null,
    'ที่อยู่อีเมล': senderEmailVal || null,
    'EP.': record.ep && record.ep !== 'ไม่ระบุ' ? record.ep : null,
    'N/O': noTypeVal || 'N',
    'เลขทะเบียนรับ': record.barcode,
    'เลขที่ อว/ ชื่อ': record.mhesiNumber || null,
    'หน่วยงาน': record.agency || null,
    'เลขที่เอกสาร': record.docNumber || null,
    'ประเภทเอกสาร': record.docType || null,
    // กรณีที่ 1 (ไม่มีเลือกเปลี่ยนโต๊ะ): ผู้ให้บริการ และ ผู้ให้บริการ-final = autoDesk
    // กรณีที่ 2 (มีเลือกเปลี่ยนโต๊ะ): ผู้ให้บริการ = autoDesk, ผู้ให้บริการ-final = override/finalDesk
    'ผู้ให้บริการ': autoDesk || finalDesk || null,
    'ผู้ให้บริการ-final': finalDesk || autoDesk || null,
    'เปลี่ยนโต๊ะบริการ': overrideDesk || null,
    'โทร.': senderPhoneVal || null,
    'วันที่รับ': record.receiveDate || null,
    'วันที่ส่ง': record.tableDate || null,
    'วันที่ส่งคืน': record.returnDate || null,
    'สถานะ_ธุรการส่งคืน': record.returnStatus || null,
    'หมายเหตุ': record.remarks || null,
  };
  return row;
}

export function mapRowToRecord(row: Record<string, any>): DocumentRecord {
  const noTypeVal = safeStr(row['N/O'] || row.no_type);
  const autoDeskVal = safeStr(row['ผู้ให้บริการ'] || row.auto_desk || row['ผู้ให้บริการ (อัตโนมัติ)']);
  const overrideDeskVal = safeStr(row['เปลี่ยนโต๊ะบริการ'] || row.override_desk || row['เปลี่ยนผู้ให้บริการ']);
  const finalDeskVal = safeStr(row['ผู้ให้บริการ-final'] || row.final_desk || row['ผู้ให้บริการ (Final)']) || (overrideDeskVal || autoDeskVal);
  const rawType = safeStr(row['TYPE'] || row.type || row['ประเภทงาน']);
  const senderNameVal = safeStr(row['ผู้ส่งเอกสาร'] || row['ชื่อผู้ส่งเอกสาร'] || row.sender_name);
  let senderPhoneVal = safeStr(row['โทรศัพท์'] || row['โทร.'] || row.sender_phone);
  const senderEmailVal = safeStr(row['ที่อยู่อีเมล'] || row['อีเมล'] || row.sender_email);

  // อนุมานประเภทงานและ N/O ให้สอดคล้องกันอย่างแม่นยำ
  const typeVal = rawType || (noTypeVal === 'O' ? '2. ตรวจจ่าย-งานเก่า' : '1. ตรวจจ่าย-งานใหม่');
  const finalNoType = (noTypeVal === 'O' || typeVal === '2. ตรวจจ่าย-งานเก่า') ? 'O' : 'N';

  // เฉพาะหน้า "1. ตรวจจ่าย-งานใหม่" และ "2. ตรวจจ่าย-งานเก่า": หากมี finalDesk ให้ดึงเบอร์ประจำโต๊ะ
  if (typeVal === '1. ตรวจจ่าย-งานใหม่' || typeVal === '2. ตรวจจ่าย-งานเก่า') {
    const deskPhone = getDeskPhone(finalDeskVal);
    if (deskPhone) {
      senderPhoneVal = deskPhone;
    }
  }

  return {
    barcode: safeStr(row['เลขทะเบียนรับ'] || row.barcode),
    type: typeVal,
    TYPE: typeVal,
    senderName: senderNameVal,
    'ผู้ส่งเอกสาร': senderNameVal,
    senderPhone: senderPhoneVal,
    'โทรศัพท์': senderPhoneVal,
    'โทร.': senderPhoneVal,
    senderEmail: senderEmailVal,
    'ที่อยู่อีเมล': senderEmailVal,
    ep: safeStr(row['EP.'] || row.ep),
    noType: finalNoType,
    mhesiNumber: safeStr(row['เลขที่ อว/ ชื่อ'] || row['เลขที่ อว.'] || row.mhesi_number),
    agency: safeStr(row['หน่วยงาน'] || row.agency),
    docNumber: safeStr(row['เลขที่เอกสาร'] || row.doc_number),
    docType: safeStr(row['ประเภทเอกสาร'] || row.doc_type),
    receiveDate: safeStr(row['วันที่รับ'] || row.receive_date),
    tableDate: safeStr(row['วันที่ส่ง'] || row['วันที่ลงโต๊ะ'] || row.table_date),
    returnDate: safeStr(row['วันที่ส่งคืน'] || row.return_date),
    returnStatus: safeStr(row['สถานะ_ธุรการส่งคืน'] || row['สถานะการส่งคืน'] || row.return_status),
    autoDesk: autoDeskVal,
    overrideDesk: overrideDeskVal,
    finalDesk: finalDeskVal,
    remarks: safeStr(row['หมายเหตุ'] || row.remarks),
  };
}

/**
 * Check if barcode is already recorded in "2570-ระบบติดตามเอกสาร"
 */
export async function checkBarcodeExistsInTracking(barcode: string): Promise<{
  exists: boolean;
  doc?: DocumentRecord;
  id?: string;
}> {
  const clean = barcode.trim();
  if (!clean) return { exists: false };

  try {
    const { data, error } = await supabase
      .from(SUPABASE_DOCUMENTS_TABLE)
      .select('*')
      .eq('"เลขทะเบียนรับ"', clean)
      .limit(1);

    if (!error && data && data.length > 0) {
      return {
        exists: true,
        doc: mapRowToRecord(data[0]),
        id: data[0].id,
      };
    }
  } catch (e) {
    console.warn('checkBarcodeExistsInTracking error:', e);
  }
  return { exists: false };
}

/**
 * Automated Data Lookup:
 * Checks Checklist-2570 first; if not found, checks Checklist-2569.
 */
export async function lookupBarcodeInChecklists(barcode: string): Promise<{
  found: boolean;
  source?: 'Checklist-2570' | 'Checklist-2569';
  data?: Partial<DocumentRecord>;
  raw?: Record<string, any>;
}> {
  const clean = barcode.trim();
  if (!clean) return { found: false };

  // 1. Try Checklist-2570 first
  try {
    const { data: list2570, error: err2570 } = await supabase
      .from(SUPABASE_CHECKLIST_2570)
      .select('*')
      .eq('"เลขทะเบียนรับ"', clean)
      .limit(1);

    if (!err2570 && list2570 && list2570.length > 0) {
      const row = list2570[0];
      const sName = safeStr(row['ผู้ส่งเอกสาร'] || row['ชื่อผู้ส่งเอกสาร'] || row['ผู้ส่ง'] || row['ชื่อผู้ส่ง'] || row.sender_name);
      const sPhone = safeStr(row['โทรศัพท์'] || row['โทร.'] || row['เบอร์โทร'] || row['เบอร์โทรศัพท์'] || row.sender_phone);
      const sEmail = safeStr(row['ที่อยู่อีเมล'] || row['อีเมล'] || row['ที่อยู่อีเมล์'] || row['E-mail'] || row['email'] || row.sender_email);
      return {
        found: true,
        source: 'Checklist-2570',
        raw: row,
        data: {
          barcode: clean,
          mhesiNumber: safeStr(row['เลขที่ อว/ ชื่อ'] || row['เลขที่ อว.'] || row['เลขที่ อว']),
          agency: safeStr(row['หน่วยงาน']),
          docType: safeStr(row['ประเภทเอกสาร']),
          docNumber: safeStr(row['เลขที่เอกสาร']),
          senderName: sName,
          'ผู้ส่งเอกสาร': sName,
          senderPhone: sPhone,
          'โทรศัพท์': sPhone,
          senderEmail: sEmail,
          'ที่อยู่อีเมล': sEmail,
        },
      };
    }
  } catch (e) {
    console.warn('Checklist-2570 query error:', e);
  }

  // 2. Try Checklist-2569
  try {
    const { data: list2569, error: err2569 } = await supabase
      .from(SUPABASE_CHECKLIST_2569)
      .select('*')
      .eq('"เลขทะเบียนรับ"', clean)
      .limit(1);

    if (!err2569 && list2569 && list2569.length > 0) {
      const row = list2569[0];
      const sName = safeStr(row['ผู้ส่งเอกสาร'] || row['ชื่อผู้ส่งเอกสาร'] || row['ผู้ส่ง'] || row['ชื่อผู้ส่ง'] || row.sender_name);
      const sPhone = safeStr(row['โทรศัพท์'] || row['โทร.'] || row['เบอร์โทร'] || row['เบอร์โทรศัพท์'] || row.sender_phone);
      const sEmail = safeStr(row['ที่อยู่อีเมล'] || row['อีเมล'] || row['ที่อยู่อีเมล์'] || row['E-mail'] || row['email'] || row.sender_email);
      return {
        found: true,
        source: 'Checklist-2569',
        raw: row,
        data: {
          barcode: clean,
          mhesiNumber: safeStr(row['เลขที่ อว/ ชื่อ'] || row['เลขที่ อว.'] || row['เลขที่ อว']),
          agency: safeStr(row['หน่วยงาน']),
          docType: safeStr(row['ประเภทเอกสาร']),
          docNumber: safeStr(row['เลขที่เอกสาร']),
          senderName: sName,
          'ผู้ส่งเอกสาร': sName,
          senderPhone: sPhone,
          'โทรศัพท์': sPhone,
          senderEmail: sEmail,
          'ที่อยู่อีเมล': sEmail,
        },
      };
    }
  } catch (e) {
    console.warn('Checklist-2569 query error:', e);
  }

  return { found: false };
}

/**
 * Check if the Supabase documents table is ready
 */
export async function testSupabaseConnection(): Promise<{ ok: boolean; error?: string; tableExists: boolean; rowCount?: number }> {
  try {
    const { data, count, error } = await supabase
      .from(SUPABASE_DOCUMENTS_TABLE)
      .select('id', { count: 'exact' })
      .limit(1);

    if (error) {
      return { ok: false, error: error.message, tableExists: false };
    }
    return { ok: true, tableExists: true, rowCount: count ?? (data?.length || 0) };
  } catch (err: any) {
    return { ok: false, error: err.message || 'เชื่อมต่อกับ Supabase ไม่สำเร็จ', tableExists: false };
  }
}

/**
 * Fetch all documents from Supabase ordered by creation date
 */
/**
 * Robust date parser supporting ISO, Thai Buddhist Era (e.g. 13/10/2569 12:30:00), and timestamps
 */
export function parseThaiOrIsoDate(dateStr?: string): { year: number; month: number; day: number } | null {
  if (!dateStr) return null;
  const clean = String(dateStr).trim();
  if (!clean) return null;

  // 1. Check Thai month names
  const thaiMonthsShort = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const thaiMonthsFull = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

  let monthIdx = -1;
  for (let m = 0; m < 12; m++) {
    if (clean.includes(thaiMonthsFull[m])) {
      monthIdx = m + 1;
      break;
    }
  }
  if (monthIdx === -1) {
    for (let m = 0; m < 12; m++) {
      if (clean.includes(thaiMonthsShort[m])) {
        monthIdx = m + 1;
        break;
      }
    }
  }

  if (monthIdx !== -1) {
    const matches = clean.match(/(\d+)/g);
    if (matches && matches.length >= 1) {
      const day = parseInt(matches[0], 10);
      let year = new Date().getFullYear();
      for (let i = 1; i < matches.length; i++) {
        const val = parseInt(matches[i], 10);
        if (val > 2400) {
          year = val - 543;
          break;
        } else if (val > 2000 && val < 2400) {
          year = val;
          break;
        } else if (val >= 60 && val <= 99) {
          year = 2500 + val - 543;
          break;
        }
      }
      return { year, month: monthIdx, day };
    }
  }

  // 2. Try ISO format YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    let year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    if (year > 2400) year -= 543;
    return { year, month, day };
  }

  // 3. Try DD/MM/YYYY or D/M/YYYY
  const datePart = clean.split(/[\s,T]+/)[0];
  const slashMatch = datePart.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (slashMatch) {
    const day = parseInt(slashMatch[1], 10);
    const month = parseInt(slashMatch[2], 10);
    let year = parseInt(slashMatch[3], 10);
    if (year > 2400) year -= 543;
    return { year, month, day };
  }

  return null;
}

/**
 * Robust date parser supporting ISO, Thai Buddhist Era (e.g. 13/10/2569 12:30:00), and timestamps
 */
export function parseDateToTimestamp(val?: any): number {
  if (!val) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const str = String(val).trim();
  if (!str) return 0;

  // 1. Try standard ISO or RFC date parsing
  const std = new Date(str).getTime();
  if (!isNaN(std) && std > 0) return std;

  // 2. Try Thai/Gregorian slash format: DD/MM/YYYY or DD/MM/BBBB HH:mm:ss
  const slashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[,\s]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (slashMatch) {
    const day = parseInt(slashMatch[1], 10);
    const month = parseInt(slashMatch[2], 10) - 1;
    let year = parseInt(slashMatch[3], 10);
    if (year > 2400) year -= 543;
    const hour = slashMatch[4] ? parseInt(slashMatch[4], 10) : 0;
    const minute = slashMatch[5] ? parseInt(slashMatch[5], 10) : 0;
    const second = slashMatch[6] ? parseInt(slashMatch[6], 10) : 0;
    const d = new Date(year, month, day, hour, minute, second);
    const t = d.getTime();
    if (!isNaN(t)) return t;
  }

  // 3. Try hyphen format: YYYY-MM-DD or BBBB-MM-DD HH:mm:ss
  const dashMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (dashMatch) {
    let year = parseInt(dashMatch[1], 10);
    if (year > 2400) year -= 543;
    const month = parseInt(dashMatch[2], 10) - 1;
    const day = parseInt(dashMatch[3], 10);
    const hour = dashMatch[4] ? parseInt(dashMatch[4], 10) : 0;
    const minute = dashMatch[5] ? parseInt(dashMatch[5], 10) : 0;
    const second = dashMatch[6] ? parseInt(dashMatch[6], 10) : 0;
    const d = new Date(year, month, day, hour, minute, second);
    const t = d.getTime();
    if (!isNaN(t)) return t;
  }

  // 4. Try Thai text parser
  const parsedThai = parseThaiOrIsoDate(str);
  if (parsedThai) {
    const timeMatch = str.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    const hour = timeMatch ? parseInt(timeMatch[1], 10) : 0;
    const minute = timeMatch ? parseInt(timeMatch[2], 10) : 0;
    const second = timeMatch && timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
    const d = new Date(parsedThai.year, parsedThai.month - 1, parsedThai.day, hour, minute, second);
    const t = d.getTime();
    if (!isNaN(t)) return t;
  }

  return 0;
}

export async function fetchAllDocumentsFromSupabase(): Promise<{
  success: boolean;
  records: Array<{ id: string; rowIndex: number; data: DocumentRecord; createdAt?: string }>;
  error?: string;
}> {
  try {
    let { data, error } = await supabase
      .from(SUPABASE_DOCUMENTS_TABLE)
      .select('*')
      .order('วันที่รับ', { ascending: false });

    // Fallback if 'วันที่รับ' does not exist or errors in schema
    if (error && (error.message?.includes('วันที่รับ') || error.code === '42703')) {
      const fallbackDate = await supabase
        .from(SUPABASE_DOCUMENTS_TABLE)
        .select('*')
        .order('created_at', { ascending: false });

      if (!fallbackDate.error && fallbackDate.data) {
        data = fallbackDate.data;
        error = null;
      } else {
        const fallback = await supabase
          .from(SUPABASE_DOCUMENTS_TABLE)
          .select('*');
        data = fallback.data;
        error = fallback.error;
      }
    }

    if (error) {
      console.warn('fetchAllDocumentsFromSupabase error:', error);
      return { success: false, records: [], error: error.message };
    }

    const records = (data || []).map((row: any, index: number) => ({
      id: row.id,
      rowIndex: index + 1,
      data: mapRowToRecord(row),
      createdAt: row.created_at || row['วันที่รับ'] || '',
    }));

    // 3.2: จัดเรียงรายการโดยอิงจาก วันที่รับเอกสารล่าสุดขึ้นก่อนเสมอ
    // หากมีรายการที่บันทึกวันเดียวกัน ให้เรียงจากเวลาที่บันทึกล่าสุดก่อน (Newest First)
    records.sort((a, b) => {
      const dateA = a.data.receiveDate || a.data['วันที่รับ'] || '';
      const dateB = b.data.receiveDate || b.data['วันที่รับ'] || '';
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
      return 0;
    });

    // Re-index rowIndex after sort to reflect newest-first display
    records.forEach((r, idx) => {
      r.rowIndex = idx + 1;
    });

    return { success: true, records };
  } catch (err: any) {
    console.warn('fetchAllDocumentsFromSupabase exception:', err);
    return { success: false, records: [], error: err.message };
  }
}

/**
 * Insert document records into Supabase
 */
export async function insertDocumentsToSupabase(
  records: DocumentRecord[]
): Promise<{ success: boolean; insertedIds: string[]; error?: string }> {
  try {
    if (records.length === 0) return { success: true, insertedIds: [] };

    const rows = records.map(r => mapRecordToRow(r));
    const { data, error } = await supabase
      .from(SUPABASE_DOCUMENTS_TABLE)
      .insert(rows)
      .select('id, "เลขทะเบียนรับ"');

    if (error) {
      console.error('insertDocumentsToSupabase error:', error);
      return { success: false, insertedIds: [], error: error.message };
    }

    const insertedIds = (data || []).map(d => d.id);
    return { success: true, insertedIds };
  } catch (err: any) {
    console.error('insertDocumentsToSupabase exception:', err);
    return { success: false, insertedIds: [], error: err.message };
  }
}

/**
 * Insert a single document record into Supabase
 */
export async function insertSingleDocumentToSupabase(
  record: DocumentRecord
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const row = mapRecordToRow(record);
    const { data, error } = await supabase
      .from(SUPABASE_DOCUMENTS_TABLE)
      .insert([row])
      .select('id, "เลขทะเบียนรับ"');

    if (error) {
      console.error('insertSingleDocumentToSupabase error:', error);
      return { success: false, error: error.message };
    }

    const id = data && data[0] ? data[0].id : undefined;
    return { success: true, id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Update document record in Supabase strictly by Primary Key (id)
 * (ห้ามใช้ เลขทะเบียนรับ ในการ UPDATE เพื่อป้องกันการอัปเดตทับซ้อนข้อมูลซ้ำ)
 */
export async function updateDocumentInSupabase(
  id: string,
  record: DocumentRecord
): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanId = String(id || '').trim();
    if (!cleanId) {
      return { success: false, error: 'ต้องระบุ Primary Key (id) ในการ UPDATE เท่านั้น' };
    }
    const row = mapRecordToRow(record);
    const { error } = await supabase
      .from(SUPABASE_DOCUMENTS_TABLE)
      .update(row)
      .eq('id', cleanId);

    if (error) {
      console.error('updateDocumentInSupabase error:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Update document record in Supabase directly by UUID / Primary Key id
 */
export async function updateDocumentByIdInSupabase(
  id: string,
  record: DocumentRecord
): Promise<{ success: boolean; error?: string }> {
  return updateDocumentInSupabase(id, record);
}

/**
 * Delete document record from Supabase strictly by Primary Key (id)
 * (ห้ามใช้ เลขทะเบียนรับ ในการ DELETE เพื่อให้ลบเฉพาะรายการที่เลือกได้)
 */
export async function deleteDocumentFromSupabase(
  id: string
): Promise<{ success: boolean; error?: string; count?: number }> {
  try {
    const cleanId = String(id || '').trim();
    if (!cleanId) {
      return { success: false, error: 'ต้องระบุ Primary Key (id) ในการลบข้อมูลเท่านั้น', count: 0 };
    }
    const { data, error } = await supabase
      .from(SUPABASE_DOCUMENTS_TABLE)
      .delete()
      .eq('id', cleanId)
      .select('id');

    const deletedCount = (data || []).length;

    if (error) {
      console.error('deleteDocumentFromSupabase error:', error);
      return { success: false, error: error.message, count: 0 };
    }
    if (deletedCount === 0) {
      return { success: false, error: `ไม่พบรายการที่ต้องการลบในตาราง 2570-ระบบติดตามเอกสาร (ID: ${cleanId})`, count: 0 };
    }
    return { success: true, count: deletedCount };
  } catch (err: any) {
    return { success: false, error: err.message, count: 0 };
  }
}

/**
 * Delete ALL documents from Supabase (ล้างข้อมูลทั้งหมด)
 */
export async function clearAllDocumentsFromSupabase(): Promise<{ success: boolean; error?: string; count?: number }> {
  try {
    const { data, error } = await supabase
      .from(SUPABASE_DOCUMENTS_TABLE)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
      .select('id');

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, count: data?.length || 0 };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Lookup barcode directly in Supabase
 */
export async function lookupBarcodeInSupabase(
  barcode: string
): Promise<{ found: boolean; data?: DocumentRecord; id?: string }> {
  try {
    const clean = barcode.trim();
    if (!clean) return { found: false };

    const { data, error } = await supabase
      .from(SUPABASE_DOCUMENTS_TABLE)
      .select('*')
      .eq('"เลขทะเบียนรับ"', clean)
      .limit(1);

    if (error || !data || data.length === 0) {
      return { found: false };
    }

    const row = data[0];
    return {
      found: true,
      data: mapRowToRecord(row),
      id: row.id,
    };
  } catch {
    return { found: false };
  }
}

/**
 * Lookup barcode in 2570-ระบบติดตามเอกสาร specifically for Return (Tab 6):
 * Strictly requires the record to have been received in Tabs 1 to 5:
 * TYPE in ('1. ตรวจจ่าย-งานใหม่', '2. ตรวจจ่าย-งานเก่า', '3. งานด้านอื่น', '4. งานเบิกจ่าย', '5. ไม่มีในฐานข้อมูล')
 */
export async function lookupBarcodeForReturnInSupabase(
  barcode: string
): Promise<{ found: boolean; data?: DocumentRecord; id?: string; errorReason?: string }> {
  try {
    const clean = barcode.trim();
    if (!clean) return { found: false, errorReason: 'ไม่ได้ระบุเลขทะเบียนรับ' };

    const { data, error } = await supabase
      .from(SUPABASE_DOCUMENTS_TABLE)
      .select('*')
      .eq('"เลขทะเบียนรับ"', clean);

    if (error || !data || data.length === 0) {
      return { found: false, errorReason: 'ไม่พบข้อมูลการรับเอกสารในระบบ' };
    }

    const VALID_TAB1_TO_5 = [
      '1. ตรวจจ่าย-งานใหม่',
      '2. ตรวจจ่าย-งานเก่า',
      '3. งานด้านอื่น',
      '4. งานเบิกจ่าย',
      '5. ไม่มีในฐานข้อมูล'
    ];

    // Filter only records that were received from Tabs 1-5
    const validRows = data.filter((row: any) => {
      const t = String(row['TYPE'] || row.type || row['ประเภทงาน'] || '').trim();
      return (
        VALID_TAB1_TO_5.includes(t) ||
        t.startsWith('1.') ||
        t.startsWith('2.') ||
        t.startsWith('3.') ||
        t.startsWith('4.') ||
        t.startsWith('5.') ||
        t.includes('งานใหม่') ||
        t.includes('งานเก่า') ||
        t.includes('งานด้านอื่น') ||
        t.includes('เบิกจ่าย') ||
        t.includes('ไม่มีในฐานข้อมูล')
      );
    });

    if (validRows.length === 0) {
      return { found: false, errorReason: 'ไม่พบข้อมูลการรับเอกสารในระบบ' };
    }

    // Sort to pick the latest / bottom-most matching row (เวลาลงรับล่าสุด/ล่างสุด)
    validRows.sort((a: any, b: any) => {
      const timeA = parseDateToTimestamp(a['วันที่รับ'] || a['วันที่ส่ง'] || a.created_at) || 0;
      const timeB = parseDateToTimestamp(b['วันที่รับ'] || b['วันที่ส่ง'] || b.created_at) || 0;
      if (timeA !== timeB) return timeA - timeB;
      const idA = String(a.id || '');
      const idB = String(b.id || '');
      return idA.localeCompare(idB);
    });

    const targetRow = validRows[validRows.length - 1];
    return {
      found: true,
      data: mapRowToRecord(targetRow),
      id: targetRow.id,
    };
  } catch (err: any) {
    return { found: false, errorReason: err?.message || 'เกิดข้อผิดพลาดในการค้นหาข้อมูล' };
  }
}

/**
 * Re-map Provider to 2570 Standard (9 Desks) & Desk Phone:
 * 1) "ภาคินี" -> (1)ภาคินี | เบอร์โทรศัพท์ 6005
 * 2) "พรนัชชา" -> (2)พรนัชชา | เบอร์โทรศัพท์ 6005
 * 3) "ดารารัตน์" -> (3)ดารารัตน์ | เบอร์โทรศัพท์ 6572
 * 4) "สาโรจน์" -> (4)สาโรจน์ | เบอร์โทรศัพท์ 6572
 * 5) "ละอองดาว" -> (5)ละอองดาว | เบอร์โทรศัพท์ 6465
 * 6) "ธนัฏพร" -> (6)ธนัฏพร | เบอร์โทรศัพท์ 6465
 * 7) "อภิญญา" -> (7)อภิญญา | เบอร์โทรศัพท์ 6465
 * 8) "ทรงวุฒิ" -> (8)ทรงวุฒิ | เบอร์โทรศัพท์ 6465
 * 9) "ดุษฎา" -> (9)ดุษฎา | เบอร์โทรศัพท์ 6465
 */
export function remapProviderToCurrentStandard(rawName?: string): { desk: string; phone: string } {
  if (!rawName) return { desk: '', phone: '' };
  const str = rawName.trim();
  if (str.includes('ภาคินี') || str.startsWith('(1)') || str.startsWith('1)')) return { desk: '(1)ภาคินี', phone: '6005' };
  if (str.includes('พรนัชชา') || str.startsWith('(2)') || str.startsWith('2)')) return { desk: '(2)พรนัชชา', phone: '6005' };
  if (str.includes('ดารารัตน์') || str.startsWith('(3)') || str.startsWith('3)')) return { desk: '(3)ดารารัตน์', phone: '6572' };
  if (str.includes('สาโรจน์') || str.startsWith('(4)') || str.startsWith('4)')) return { desk: '(4)สาโรจน์', phone: '6572' };
  if (str.includes('ละอองดาว') || str.startsWith('(5)') || str.startsWith('5)')) return { desk: '(5)ละอองดาว', phone: '6465' };
  if (str.includes('ธนัฏพร') || str.startsWith('(6)') || str.startsWith('6)')) return { desk: '(6)ธนัฏพร', phone: '6465' };
  if (str.includes('อภิญญา') || str.startsWith('(7)') || str.startsWith('7)')) return { desk: '(7)อภิญญา', phone: '6465' };
  if (str.includes('ทรงวุฒิ') || str.startsWith('(8)') || str.startsWith('8)')) return { desk: '(8)ทรงวุฒิ', phone: '6465' };
  if (str.includes('ดุษฎา') || str.startsWith('(9)') || str.startsWith('9)')) return { desk: '(9)ดุษฎา', phone: '6465' };

  // If already starts with (1) to (9) or has recognized phone
  const phone = getDeskPhone(str);
  if (phone) {
    return { desk: str, phone };
  }

  return { desk: str, phone: '' };
}

export interface Tab2OldWorkLookupResult {
  found: boolean;
  source?: string;
  provider: string;
  phone: string;
  data: Partial<DocumentRecord>;
  raw?: Record<string, any>;
}

/**
 * Specialized 4-Table Lookup for "2. ตรวจจ่าย-งานเก่า":
 * เมื่อป้อนหรือสแกน เลขทะเบียนรับ ให้ค้นหาและดึงข้อมูลแยกเป็น 2 ส่วน
 * โดยหากพบหลายรายการซ้ำ ให้เลือกใช้ รายการที่อยู่ล่างสุดของตาราง (Last / Bottom-most Record) เสมอ
 *
 * 1.1 [การดึงรายละเอียดเอกสาร (Metadata)]:
 *     - ลำดับที่ 1: ค้นหาในตาราง Checklist-2570
 *     - ลำดับที่ 2: หากไม่พบ ให้ค้นหาต่อในตาราง Checklist-2569
 *     - คัดลอกเฉพาะข้อมูลรายละเอียดเอกสาร: ผู้ส่งเอกสาร, อีเมล, เลขที่ อว/ ชื่อ, หน่วยงาน, เลขที่เอกสาร, ประเภทเอกสาร (⚠️ ไม่ต้องดึงคอลัมน์ EP)
 *
 * 1.2 [การดึงประวัติผู้ให้บริการเดิม (Provider History)]:
 *     - ลำดับที่ 1: ค้นหาคอลัมน์ ผู้ให้บริการ-final จากตาราง 2570-ระบบติดตามเอกสาร
 *     - ลำดับที่ 2: หากไม่พบ ให้ค้นหาคอลัมน์ ผู้ให้บริการ-final จากตาราง 2569-ดึงข้อมูล
 *
 * 1.3 [Re-map ผู้ให้บริการและเบอร์โทรศัพท์เป็นปัจจุบัน]:
 *     - นำชื่อผู้ให้บริการเดิมจาก 1.2 มา re-map โต๊ะและเบอร์โทรศัพท์เป็นปัจจุบันเสมอ
 */
export async function lookupOldWorkForTab2(barcode: string): Promise<Tab2OldWorkLookupResult> {
  const clean = barcode.trim();
  if (!clean) return { found: false, provider: 'กรอกมือระบุเอง', phone: '', data: {} };

  // =========================================================================
  // 1.1 [การดึงรายละเอียดเอกสาร (Metadata)]
  // =========================================================================
  let metaRow: Record<string, any> | null = null;
  let metaSource = '';

  // ลำดับที่ 1: ค้นหาในตาราง Checklist-2570
  try {
    const { data: cl2570, error: errCl2570 } = await supabase
      .from(SUPABASE_CHECKLIST_2570)
      .select('*')
      .eq('"เลขทะเบียนรับ"', clean);

    if (!errCl2570 && cl2570 && cl2570.length > 0) {
      // รายการที่อยู่ล่างสุดของตาราง (Last / Bottom-most Record)
      metaRow = cl2570[cl2570.length - 1];
      metaSource = SUPABASE_CHECKLIST_2570;
    }
  } catch (e) {
    console.warn('Tab 2 lookup in Checklist-2570 error:', e);
  }

  // ลำดับที่ 2: หากไม่พบ ให้ค้นหาต่อในตาราง Checklist-2569
  if (!metaRow) {
    try {
      const { data: cl2569, error: errCl2569 } = await supabase
        .from(SUPABASE_CHECKLIST_2569)
        .select('*')
        .eq('"เลขทะเบียนรับ"', clean);

      if (!errCl2569 && cl2569 && cl2569.length > 0) {
        // รายการที่อยู่ล่างสุดของตาราง (Last / Bottom-most Record)
        metaRow = cl2569[cl2569.length - 1];
        metaSource = SUPABASE_CHECKLIST_2569;
      }
    } catch (e) {
      console.warn('Tab 2 lookup in Checklist-2569 error:', e);
    }
  }

  // =========================================================================
  // 1.2 [การดึงประวัติผู้ให้บริการเดิม (Provider History)]
  // =========================================================================
  let rawProvider = '';
  let providerSource = '';

  // ลำดับที่ 1: ค้นหาคอลัมน์ ผู้ให้บริการ-final จากตาราง 2570-ระบบติดตามเอกสาร
  try {
    const { data: list2570, error: err2570 } = await supabase
      .from(SUPABASE_DOCUMENTS_TABLE)
      .select('*')
      .eq('"เลขทะเบียนรับ"', clean);

    if (!err2570 && list2570 && list2570.length > 0) {
      // รายการที่อยู่ล่างสุดของตาราง (Last / Bottom-most Record)
      const lastRow2570 = list2570[list2570.length - 1];
      const provVal = safeStr(
        lastRow2570['ผู้ให้บริการ-final'] ||
        lastRow2570['ผู้ให้บริการ (Final)'] ||
        lastRow2570['ผู้ให้บริการ'] ||
        lastRow2570['เปลี่ยนโต๊ะบริการ'] ||
        lastRow2570.final_desk ||
        lastRow2570.auto_desk
      );
      if (provVal) {
        rawProvider = provVal;
        providerSource = SUPABASE_DOCUMENTS_TABLE;
      }
    }
  } catch (e) {
    console.warn('Tab 2 lookup in 2570-ระบบติดตามเอกสาร error:', e);
  }

  // ลำดับที่ 2: หากไม่พบ ให้ค้นหาคอลัมน์ ผู้ให้บริการ-final จากตาราง 2569-ดึงข้อมูล
  if (!rawProvider) {
    try {
      const { data: list2569, error: err2569 } = await supabase
        .from(SUPABASE_2569_PULL)
        .select('*')
        .eq('"เลขทะเบียนรับ"', clean);

      if (!err2569 && list2569 && list2569.length > 0) {
        // รายการที่อยู่ล่างสุดของตาราง (Last / Bottom-most Record)
        const lastRow2569 = list2569[list2569.length - 1];
        const provVal = safeStr(
          lastRow2569['ผู้ให้บริการ-final'] ||
          lastRow2569['ผู้ให้บริการ (Final)'] ||
          lastRow2569['ผู้ให้บริการ'] ||
          lastRow2569['เปลี่ยนโต๊ะบริการ'] ||
          lastRow2569['ผู้ตรวจสอบ'] ||
          lastRow2569.final_desk ||
          lastRow2569.auto_desk
        );
        if (provVal) {
          rawProvider = provVal;
          providerSource = SUPABASE_2569_PULL;
        }
      }
    } catch (e) {
      console.warn('Tab 2 lookup in 2569-ดึงข้อมูล error:', e);
    }
  }

  // Safety fallback เผื่อพบใน metaRow แต่ไม่พบใน 2570/2569
  if (!rawProvider && metaRow) {
    rawProvider = safeStr(metaRow['ผู้ให้บริการ-final'] || metaRow['ผู้ให้บริการ (Final)'] || metaRow['ผู้ให้บริการ'] || '');
    if (rawProvider) {
      providerSource = metaSource;
    }
  }

  // =========================================================================
  // 1.3 [Re-map ผู้ให้บริการและเบอร์โทรศัพท์เป็นปัจจุบัน]
  // =========================================================================
  const remapped = remapProviderToCurrentStandard(rawProvider);
  const assignedDesk = remapped.desk || (rawProvider ? rawProvider : 'กรอกมือระบุเอง');
  const assignedPhone = remapped.phone || getDeskPhone(assignedDesk);

  // คัดลอกเฉพาะข้อมูลรายละเอียดเอกสาร ได้แก่ ผู้ส่งเอกสาร, อีเมล, เลขที่ อว/ ชื่อ, หน่วยงาน, เลขที่เอกสาร, ประเภทเอกสาร (⚠️ ไม่ต้องดึงคอลัมน์ EP)
  const sName = metaRow ? safeStr(metaRow['ผู้ส่งเอกสาร'] || metaRow['ชื่อผู้ส่งเอกสาร'] || metaRow['ผู้ส่ง'] || metaRow.sender_name) : '';
  const sEmail = metaRow ? safeStr(metaRow['ที่อยู่อีเมล'] || metaRow['อีเมล'] || metaRow['ที่อยู่อีเมล์'] || metaRow.sender_email) : '';
  const mhesi = metaRow ? safeStr(metaRow['เลขที่ อว/ ชื่อ'] || metaRow['เลขที่ อว.'] || metaRow['เลขที่ อว'] || metaRow.mhesi_number) : '';
  const agency = metaRow ? safeStr(metaRow['หน่วยงาน'] || metaRow['สำนักวิชา/หน่วยงาน'] || metaRow['หน่วยงาน/สังกัด'] || metaRow.agency) : '';
  const docNum = metaRow ? safeStr(metaRow['เลขที่เอกสาร'] || metaRow['เลขที่หนังสือ'] || metaRow.doc_number) : '';
  const docType = metaRow ? safeStr(metaRow['ประเภทเอกสาร'] || metaRow['ประเภท'] || metaRow.doc_type) : '';
  const remarks = metaRow ? safeStr(metaRow['หมายเหตุ'] || metaRow.remarks) : '';
  const recDate = metaRow ? safeStr(metaRow['วันที่รับ'] || metaRow['วันที่รับเอกสาร'] || metaRow.receive_date) : '';

  return {
    found: Boolean(metaRow || rawProvider),
    source: [metaSource && `Metadata: ${metaSource}`, providerSource && `Provider: ${providerSource}`].filter(Boolean).join(' | ') || undefined,
    provider: assignedDesk,
    phone: assignedPhone,
    raw: metaRow || undefined,
    data: {
      barcode: clean,
      mhesiNumber: mhesi,
      agency,
      docType,
      docNumber: docNum,
      ep: '', // ⚠️ ไม่ต้องดึงคอลัมน์ EP ตามข้อกำหนด 1.1
      senderName: sName,
      'ผู้ส่งเอกสาร': sName,
      senderPhone: assignedPhone,
      'โทรศัพท์': assignedPhone,
      'โทร.': assignedPhone,
      senderEmail: sEmail,
      'ที่อยู่อีเมล': sEmail,
      receiveDate: recDate,
      remarks,
      autoDesk: assignedDesk,
      finalDesk: assignedDesk,
      overrideDesk: '',
    },
  };
}

