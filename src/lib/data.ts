import Papa from 'papaparse';
import { parseDeviceStatus } from '../status';
import type { ComplaintInput, Device, HydrantDevice, NewDeviceInput, StreetLightDevice, WifiDevice } from '../types';
import { isSupabaseEnabled, supabase } from './supabase';

const SHEET_STREETLIGHT =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQv7p9ib0xXet8Alyik_Fi9CdBVvZO8xz73K4k0wEoNqpwIWAKFGIfbk0IkE8knnp-LXvNA6OceINr1/pub?gid=0&single=true&output=csv';
const SHEET_WIFI =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQv7p9ib0xXet8Alyik_Fi9CdBVvZO8xz73K4k0wEoNqpwIWAKFGIfbk0IkE8knnp-LXvNA6OceINr1/pub?gid=123712203&single=true&output=csv';
const SHEET_HYDRANT =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQv7p9ib0xXet8Alyik_Fi9CdBVvZO8xz73K4k0wEoNqpwIWAKFGIfbk0IkE8knnp-LXvNA6OceINr1/pub?gid=872918807&single=true&output=csv';

interface StreetLightRow {
  ASSET_ID?: string;
  ASSETOWNER?: string;
  LOCATION?: string;
  MOO?: string;
  LAMP_TYPE?: string;
  BULB_TYPE?: string;
  BULB_QTY?: string;
  WATT?: string;
  BOX_ID?: string;
  STATUS?: string;
  STATUSDATE?: string;
  LAT?: string;
  LNG?: string;
  LON?: string;
  RANGE?: string;
  IMG_DATE?: string;
}

interface WifiRow {
  WIFI_ID?: string;
  LOCATION?: string;
  ISP?: string;
  SPEED?: string;
  DEVICE_COUNT?: string;
  STATUS?: string;
  LAT?: string;
  LNG?: string;
  LON?: string;
  RANGE?: string;
}

interface HydrantRow {
  HYDRANT_ID?: string;
  LOCATION?: string;
  PRESSURE?: string;
  LAST_CHECK?: string;
  STATUS?: string;
  LAT?: string;
  LNG?: string;
  LON?: string;
  RANGE?: string;
}

const DEFAULT_DEPARTMENT = 'เทศบาลตำบลพลูตาหลวง';
const COMPLAINT_IMAGE_BUCKET = import.meta.env.VITE_SUPABASE_COMPLAINT_BUCKET || 'complaint-images';

function encodeStoragePath(path: string): string {
  return path
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
}

async function uploadComplaintImageWithProgress(file: File, path: string, onProgress?: (percent: number) => void): Promise<void> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase environment variables are missing for upload');
  }

  const encodedPath = encodeStoragePath(path);
  const url = `${supabaseUrl}/storage/v1/object/${COMPLAINT_IMAGE_BUCKET}/${encodedPath}`;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.setRequestHeader('apikey', supabaseAnonKey);
    xhr.setRequestHeader('Authorization', `Bearer ${supabaseAnonKey}`);
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.setRequestHeader('content-type', file.type || 'application/octet-stream');

    xhr.upload.onprogress = (event) => {
      if (!onProgress || !event.lengthComputable) return;
      const percent = Math.min(100, Math.max(0, Math.round((event.loaded / event.total) * 100)));
      onProgress(percent);
    };

    xhr.onerror = () => reject(new Error('Network error while uploading image'));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
        return;
      }
      reject(new Error(`Upload failed (${xhr.status}): ${xhr.responseText || 'Unknown error'}`));
    };

    xhr.send(file);
  });
}

function parseCsvRows<T>(url: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<T>(url, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        resolve(result.data ?? []);
      },
      error: (error) => reject(error),
    });
  });
}

function parseNumber(value: string | number | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (!value) return null;
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseRange(value: string | undefined): number {
  const parsed = parseNumber(value);
  if (parsed === null || parsed <= 0) return 0;
  return parsed;
}

function mapStreetLights(rows: StreetLightRow[]): StreetLightDevice[] {
  const result: StreetLightDevice[] = [];

  for (const row of rows) {
    if ((row.ASSET_ID ?? '').trim() === '') continue;
    const lat = parseNumber(row.LAT);
    const lng = parseNumber(row.LNG) ?? parseNumber(row.LON);
    if (lat === null || lng === null) continue;

    result.push({
      id: row.ASSET_ID ?? '',
      name: row.LOCATION || 'โคมไฟ',
      type: 'streetlight',
      lat,
      lng,
      status: parseDeviceStatus(row.STATUS),
      department: DEFAULT_DEPARTMENT,
      description: row.LAMP_TYPE,
      rangeMeters: parseRange(row.RANGE),
      lampType: row.LAMP_TYPE,
      bulbType: row.BULB_TYPE,
      watt: row.WATT,
      boxId: row.BOX_ID,
      owner: row.ASSETOWNER,
      imageDate: row.IMG_DATE,
      source: 'sheet',
    });
  }

  return result;
}

function mapWifi(rows: WifiRow[]): WifiDevice[] {
  const result: WifiDevice[] = [];

  for (const row of rows) {
    if ((row.WIFI_ID ?? '').trim() === '') continue;
    const lat = parseNumber(row.LAT);
    const lng = parseNumber(row.LNG) ?? parseNumber(row.LON);
    if (lat === null || lng === null) continue;

    result.push({
      id: row.WIFI_ID ?? '',
      name: row.LOCATION || 'Wi-Fi',
      type: 'wifi',
      lat,
      lng,
      status: parseDeviceStatus(row.STATUS),
      department: DEFAULT_DEPARTMENT,
      description: row.ISP,
      rangeMeters: parseRange(row.RANGE),
      isp: row.ISP,
      speed: row.SPEED,
      deviceCount: parseNumber(row.DEVICE_COUNT) ?? 0,
      source: 'sheet',
    });
  }

  return result;
}

function mapHydrants(rows: HydrantRow[]): HydrantDevice[] {
  const result: HydrantDevice[] = [];

  for (const row of rows) {
    if ((row.HYDRANT_ID ?? '').trim() === '') continue;
    const lat = parseNumber(row.LAT);
    const lng = parseNumber(row.LNG) ?? parseNumber(row.LON);
    if (lat === null || lng === null) continue;

    result.push({
      id: row.HYDRANT_ID ?? '',
      name: row.LOCATION || 'ประปา',
      type: 'hydrant',
      lat,
      lng,
      status: parseDeviceStatus(row.STATUS),
      department: DEFAULT_DEPARTMENT,
      description: row.PRESSURE,
      rangeMeters: parseRange(row.RANGE),
      pressure: row.PRESSURE,
      lastCheck: row.LAST_CHECK,
      source: 'sheet',
    });
  }

  return result;
}

interface DeviceDbRow {
  id?: string;
  device_code?: string;
  name?: string;
  device_type?: string;
  type?: string;
  lat?: number | string;
  lng?: number | string;
  lon?: number | string;
  status?: string;
  department?: string;
  description?: string | null;
  range_meters?: number | string | null;
  range?: number | string | null;
  sketch_pin?: boolean | null;
  sketchPin?: boolean | null;
  device_image_url?: string | null;
  image_url?: string | null;
  photo_url?: string | null;
}

function mapDeviceType(value: string | undefined): Device['type'] | null {
  if (value === 'streetlight' || value === 'wifi' || value === 'hydrant') {
    return value;
  }
  return null;
}

function mapDbRows(rows: DeviceDbRow[]): Device[] {
  const mapped: Array<Device | null> = rows
    .map((row) => {
      const id = (row.device_code ?? row.id ?? '').trim();
      const type = mapDeviceType(row.device_type ?? row.type);
      const lat = parseNumber(row.lat);
      const lng = parseNumber(row.lng) ?? parseNumber(row.lon);
      if (!id || type === null || lat === null || lng === null) {
        return null;
      }

      return {
        id,
        name: row.name?.trim() || id,
        type,
        lat,
        lng,
        status: parseDeviceStatus(row.status),
        department: row.department ?? DEFAULT_DEPARTMENT,
        description: row.description ?? '',
        deviceImageUrl: row.device_image_url ?? row.image_url ?? row.photo_url ?? undefined,
        rangeMeters: parseNumber((row.range_meters ?? row.range) ?? undefined) ?? 0,
        sketchPin: row.sketch_pin ?? row.sketchPin ?? false,
        source: 'supabase' as const,
      };
    });

  return mapped.filter((item): item is Device => item !== null);
}

export async function fetchSheetDevices(): Promise<Device[]> {
  const [streetRows, wifiRows, hydrantRows] = await Promise.all([
    parseCsvRows<StreetLightRow>(SHEET_STREETLIGHT),
    parseCsvRows<WifiRow>(SHEET_WIFI),
    parseCsvRows<HydrantRow>(SHEET_HYDRANT),
  ]);

  return [...mapStreetLights(streetRows), ...mapWifi(wifiRows), ...mapHydrants(hydrantRows)];
}

export async function fetchDbDevices(): Promise<Device[]> {
  if (!isSupabaseEnabled || !supabase) return [];

  const devicesTable = supabase.from('devices') as any;

  const orderedResult = await devicesTable.select('*').order('created_at', { ascending: true });

  if (orderedResult.error) {
    console.warn('[data] Ordered fetch failed, retrying without order(created_at):', {
      message: orderedResult.error.message,
      code: orderedResult.error.code,
      details: orderedResult.error.details,
      hint: orderedResult.error.hint,
    });

    const fallbackResult = await devicesTable.select('*');
    if (fallbackResult.error) {
      console.error('[data] Failed to fetch devices from Supabase:', {
        message: fallbackResult.error.message,
        code: fallbackResult.error.code,
        details: fallbackResult.error.details,
        hint: fallbackResult.error.hint,
      });
      return [];
    }

    const mapped = mapDbRows(fallbackResult.data ?? []);
    console.debug('[data] Supabase fallback fetch success:', {
      rawCount: (fallbackResult.data ?? []).length,
      mappedCount: mapped.length,
    });
    return mapped;
  }

  const mapped = mapDbRows(orderedResult.data ?? []);
  console.debug('[data] Supabase ordered fetch success:', {
    rawCount: (orderedResult.data ?? []).length,
    mappedCount: mapped.length,
  });
  return mapped;
}

export async function fetchAllDevices(): Promise<Device[]> {
  const [sheetDevices, dbDevices] = await Promise.all([fetchSheetDevices(), fetchDbDevices()]);

  // ให้ข้อมูลจากฐานข้อมูลเป็นแหล่งล่าสุด เพื่อให้ค่าแก้ไขทับข้อมูลที่มาจากชีตได้
  const mergedByKey = new Map<string, Device>();
  for (const device of sheetDevices) {
    mergedByKey.set(`${device.type}:${device.id}`, device);
  }
  for (const device of dbDevices) {
    mergedByKey.set(`${device.type}:${device.id}`, device);
  }

  const merged = Array.from(mergedByKey.values());

  console.debug('[data] fetchAllDevices merged result:', {
    sheetCount: sheetDevices.length,
    dbCount: dbDevices.length,
    mergedCount: merged.length,
  });

  return merged;
}

export async function saveDevicePosition(input: NewDeviceInput): Promise<Device> {
  const deviceCode = `NEW-${Date.now()}`;
  
  // --- จัดการแพ็กข้อมูลยืดหยุ่นใส่เข้าไปใน Description ---
  let finalDescription = input.description || '';
  const extraDetails: string[] = [];

  if (input.type === 'streetlight') {
    if (input.owner) extraDetails.push(`เจ้าของ: ${input.owner}`);
    if (input.watt) extraDetails.push(`กำลังไฟ: ${input.watt}`);
    if (input.lampType) extraDetails.push(`โคม: ${input.lampType}`);
    if (input.bulbType) extraDetails.push(`หลอด: ${input.bulbType}`);
  } else if (input.type === 'wifi') {
    if (input.isp) extraDetails.push(`ISP: ${input.isp}`);
    if (input.speed) extraDetails.push(`ความเร็ว: ${input.speed}`);
  } else if (input.type === 'hydrant') {
    if (input.pressure) extraDetails.push(`แรงดันน้ำ: ${input.pressure}`);
  }

  // ถ้ามีการกรอกข้อมูลเพิ่มเติม ให้เอามาต่อท้ายหมายเหตุเดิม
  if (extraDetails.length > 0) {
    const detailsString = extraDetails.join(' | ');
    finalDescription = finalDescription 
      ? `${finalDescription}\n(รายละเอียด: ${detailsString})` 
      : `รายละเอียด: ${detailsString}`;
  }

  // สร้าง Object Device เตรียมคืนค่า
  const device: Device = {
    id: deviceCode,
    name: input.name,
    type: input.type,
    lat: input.lat,
    lng: input.lng,
    status: input.status,
    department: DEFAULT_DEPARTMENT,
    description: finalDescription, // ใช้ description ที่รวมร่างแล้ว
    rangeMeters: input.useRadiusPin ? input.radiusMeters ?? 0 : 0,
    sketchPin: input.useSketchPin,
    source: 'supabase',
    // แนบค่าจริงไปด้วยเผื่อ Frontend เอาไปใช้ต่อเลย (Cast type เพื่อเลี่ยง TS Error ชั่วคราว)
    ...(input as any) 
  };

  if (!isSupabaseEnabled || !supabase) {
    return device;
  }

  const devicesTable = supabase.from('devices') as any;
  const legacyPayload = {
    device_code: deviceCode,
    name: input.name,
    device_type: input.type,
    lat: input.lat,
    lng: input.lng,
    status: input.status,
    department: DEFAULT_DEPARTMENT,
    description: finalDescription || null,
    range_meters: input.useRadiusPin ? input.radiusMeters ?? 0 : 0,
    sketch_pin: input.useSketchPin,
  };

  const modernPayload = {
    id: deviceCode,
    name: input.name,
    type: input.type,
    lat: input.lat,
    lng: input.lng,
    status: input.status,
    department: DEFAULT_DEPARTMENT,
    description: finalDescription || null,
    range: input.useRadiusPin ? input.radiusMeters ?? 0 : 0,
    sketch_pin: input.useSketchPin,
  };

  let insertResult = await devicesTable.insert(legacyPayload);
  if (insertResult.error?.code === '42703') {
    console.warn('[data] Legacy insert payload failed, retrying modern payload:', {
      message: insertResult.error.message,
      code: insertResult.error.code,
    });
    insertResult = await devicesTable.insert(modernPayload);
  }

  if (insertResult.error) {
    console.error('Failed to save device to Supabase:', {
      message: insertResult.error.message,
      code: insertResult.error.code,
      details: insertResult.error.details,
      hint: insertResult.error.hint,
    });
  }

  return device;
}

export async function saveComplaint(input: ComplaintInput): Promise<void> {
  if (!isSupabaseEnabled || !supabase) {
    return;
  }

  let imageUrl = input.imageUrl ?? null;
  if (input.attachmentFile) {
    const safeName = input.attachmentFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${input.deviceType}/${input.deviceId}/${Date.now()}-${safeName}`;
    input.onUploadProgress?.(0);

    try {
      await uploadComplaintImageWithProgress(input.attachmentFile, path, input.onUploadProgress);
      const publicUrl = supabase.storage.from(COMPLAINT_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
      imageUrl = publicUrl || null;
    } catch (xhrError) {
      console.warn('[data] XHR upload failed, fallback to supabase-js upload:', xhrError);

      const upload = await supabase.storage.from(COMPLAINT_IMAGE_BUCKET).upload(path, input.attachmentFile, {
        upsert: false,
        contentType: input.attachmentFile.type || undefined,
      });

      if (upload.error) {
        console.warn('[data] Complaint image upload failed, continue without image:', {
          message: upload.error.message,
          bucket: COMPLAINT_IMAGE_BUCKET,
        });
      } else {
        input.onUploadProgress?.(100);
        const publicUrl = supabase.storage.from(COMPLAINT_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
        imageUrl = publicUrl || null;
      }
    }
  }

  const complaintsTable = supabase.from('complaints') as any;
  const basePayload = {
    device_id: input.deviceId,
    device_type: input.deviceType,
    device_name: input.deviceName,
    location: input.location,
    status: input.status,
    description: input.description ?? null,
  };

  let result = await complaintsTable.insert({
    ...basePayload,
    image_url: imageUrl,
  });

  if (result.error?.code === '42703') {
    result = await complaintsTable.insert(basePayload);
  }

  if (result.error) {
    throw new Error(result.error.message);
  }
}

// ดึงข้อมูลประวัติการซ่อม/ร้องเรียนของอุปกรณ์นั้นๆ
export async function fetchDeviceComplaints(deviceId: string) {
  if (!isSupabaseEnabled || !supabase) return [];

  const { data, error } = await supabase
    .from('complaints')
    .select('*')
    .eq('device_id', deviceId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch complaints:', error.message);
    return [];
  }

  return (data ?? []).map((row: any) => ({
    ...row,
    image_url: row.image_url ?? row.attachment_url ?? null,
  }));
}

export interface DeviceEditHistoryItem {
  id: string;
  device_id: string;
  changed_by: string | null;
  before_name: string | null;
  after_name: string | null;
  before_status: string | null;
  after_status: string | null;
  note: string | null;
  created_at: string | null;
}

type UpdateDeviceMeta = {
  changedBy?: string;
  note?: string;
  before?: {
    name?: string;
    status?: string;
  };
};

function formatSupabaseError(error: any): string {
  if (!error) return 'Unknown Supabase error';
  const parts = [error.message, error.code, error.hint].filter(Boolean);
  return parts.join(' | ');
}

async function writeDeviceEditLog(deviceId: string, payload: Omit<DeviceEditHistoryItem, 'id' | 'device_id' | 'created_at'>) {
  if (!isSupabaseEnabled || !supabase) return;

  const result = await (supabase.from('device_change_logs') as any).insert({
    device_id: deviceId,
    changed_by: payload.changed_by,
    before_name: payload.before_name,
    after_name: payload.after_name,
    before_status: payload.before_status,
    after_status: payload.after_status,
    note: payload.note,
  });

  if (result.error) {
    // ไม่ทำให้การบันทึกหลักล้มเหลว หากตาราง log ยังไม่ถูกสร้างหรือ policy ยังไม่พร้อม
    console.warn('[data] Failed to write device change log:', {
      message: result.error.message,
      code: result.error.code,
    });
  }
}

export async function fetchDeviceEditLogs(deviceId: string): Promise<DeviceEditHistoryItem[]> {
  if (!isSupabaseEnabled || !supabase) return [];

  const { data, error } = await (supabase.from('device_change_logs') as any)
    .select('*')
    .eq('device_id', deviceId)
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('[data] Failed to fetch device change logs:', {
      message: error.message,
      code: error.code,
    });
    return [];
  }

  return (data ?? []) as DeviceEditHistoryItem[];
}

// อัปเดตข้อมูลอุปกรณ์ (เตรียมไว้สำหรับปุ่ม Save)
export async function updateDeviceData(deviceId: string, updates: Partial<Device>, meta?: UpdateDeviceMeta) {
  if (!isSupabaseEnabled || !supabase) return;

  const devicesTable = supabase.from('devices') as any;
  const payload: Record<string, unknown> = {};
  if (typeof updates.name === 'string') {
    const normalizedName = updates.name.trim();
    payload.name = normalizedName;
  }
  if (updates.status) {
    payload.status = updates.status;
  }
  if (typeof updates.description === 'string') {
    payload.description = updates.description;
  }

  if (Object.keys(payload).length === 0) {
    return;
  }

  const beforeName = meta?.before?.name ?? updates.name ?? null;
  const beforeStatus = meta?.before?.status ?? updates.status ?? null;
  const afterName = typeof payload.name === 'string' ? payload.name : (updates.name ?? null);
  const afterStatus = typeof payload.status === 'string' ? payload.status : (updates.status ?? null);

  let result = await devicesTable.update(payload).eq('device_code', deviceId).select('id');
  if (result.error?.code === '42703') {
    result = await devicesTable.update(payload).eq('id', deviceId).select('id');
  }

  if (result.error) {
    throw new Error(formatSupabaseError(result.error));
  }

  // ถ้าไม่เจอแถวเดิม ให้สร้างแถวใหม่สำหรับ device นี้เพื่อให้ค่าแก้ไขใช้งานได้จริง
  if ((result.data?.length ?? 0) === 0) {
    const fallbackPayload = {
      device_code: deviceId,
      name: (payload.name as string) ?? deviceId,
      device_type: updates.type,
      lat: updates.lat,
      lng: updates.lng,
      status: (payload.status as string) ?? 'normal',
      department: updates.department ?? DEFAULT_DEPARTMENT,
      description: (payload.description as string | null | undefined) ?? null,
      range_meters: updates.rangeMeters ?? 0,
      sketch_pin: updates.sketchPin ?? false,
    };

    if (!fallbackPayload.device_type || typeof fallbackPayload.lat !== 'number' || typeof fallbackPayload.lng !== 'number') {
      throw new Error('Cannot create missing device row: missing type or coordinates.');
    }

    let insertResult = await devicesTable.insert(fallbackPayload);
    if (insertResult.error) {
      // fallback สำหรับ schema แบบ modern (type/range) และ id auto-generated
      insertResult = await devicesTable.insert({
        name: fallbackPayload.name,
        type: fallbackPayload.device_type,
        lat: fallbackPayload.lat,
        lng: fallbackPayload.lng,
        status: fallbackPayload.status,
        department: fallbackPayload.department,
        description: fallbackPayload.description,
        range: fallbackPayload.range_meters,
        sketch_pin: fallbackPayload.sketch_pin,
      });
    }

    if (insertResult.error) {
      // fallback สุดท้าย: modern schema ที่ต้องการ id เป็น device_code
      insertResult = await devicesTable.insert({
        id: deviceId,
        name: fallbackPayload.name,
        type: fallbackPayload.device_type,
        lat: fallbackPayload.lat,
        lng: fallbackPayload.lng,
        status: fallbackPayload.status,
        department: fallbackPayload.department,
        description: fallbackPayload.description,
        range: fallbackPayload.range_meters,
        sketch_pin: fallbackPayload.sketch_pin,
      });
    }

    if (insertResult.error) {
      throw new Error(formatSupabaseError(insertResult.error));
    }
  }

  const hasNameChanged = (beforeName ?? '') !== (afterName ?? '');
  const hasStatusChanged = (beforeStatus ?? '') !== (afterStatus ?? '');

  if (hasNameChanged || hasStatusChanged) {
    await writeDeviceEditLog(deviceId, {
      changed_by: meta?.changedBy ?? 'web-user',
      before_name: beforeName,
      after_name: afterName,
      before_status: beforeStatus,
      after_status: afterStatus,
      note: meta?.note ?? null,
    });
  }
}
