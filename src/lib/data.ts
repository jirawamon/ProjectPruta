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
  device_code: string;
  name: string;
  device_type: 'streetlight' | 'wifi' | 'hydrant';
  lat: number;
  lng: number;
  status: string;
  department: string;
  description: string | null;
  range_meters: number | null;
  sketch_pin: boolean | null;
}

function mapDbRows(rows: DeviceDbRow[]): Device[] {
  return rows.map((row) => ({
    id: row.device_code,
    name: row.name,
    type: row.device_type,
    lat: row.lat,
    lng: row.lng,
    status: parseDeviceStatus(row.status),
    department: row.department,
    description: row.description ?? '',
    rangeMeters: row.range_meters ?? 0,
    sketchPin: row.sketch_pin ?? false,
    source: 'supabase',
  }));
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

  const { data, error } = await supabase
    .from('devices')
    .select('device_code,name,device_type,lat,lng,status,department,description,range_meters,sketch_pin')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to fetch devices from Supabase:', error.message);
    return [];
  }

  return mapDbRows(data ?? []);
}

export async function fetchAllDevices(): Promise<Device[]> {
  const [sheetDevices, dbDevices] = await Promise.all([fetchSheetDevices(), fetchDbDevices()]);

  const merged = [...sheetDevices];
  const existing = new Set(sheetDevices.map((item) => `${item.type}:${item.id}`));

  for (const device of dbDevices) {
    const key = `${device.type}:${device.id}`;
    if (!existing.has(key)) {
      merged.push(device);
    }
  }

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

  // Insert ลง Supabase ด้วยโครงสร้างเดิม
  const { error } = await supabase.from('devices').insert({
    device_code: deviceCode,
    name: input.name,
    device_type: input.type,
    lat: input.lat,
    lng: input.lng,
    status: input.status,
    department: DEFAULT_DEPARTMENT,
    description: finalDescription || null, // ส่งลง DB
    range_meters: input.useRadiusPin ? input.radiusMeters ?? 0 : 0,
    sketch_pin: input.useSketchPin,
  });

  if (error) {
    console.error('Failed to save device to Supabase:', error.message);
  }

  return device;
}

export async function saveComplaint(input: ComplaintInput): Promise<void> {
  if (!isSupabaseEnabled || !supabase) {
    return;
  }

  const { error } = await supabase.from('complaints').insert({
    device_id: input.deviceId,
    device_type: input.deviceType,
    device_name: input.deviceName,
    location: input.location,
    status: input.status,
    description: input.description ?? null,
  });

  if (error) {
    throw new Error(error.message);
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

  return data;
}

// อัปเดตข้อมูลอุปกรณ์ (เตรียมไว้สำหรับปุ่ม Save)
export async function updateDeviceData(deviceId: string, updates: Partial<Device>) {
  if (!isSupabaseEnabled || !supabase) return;

  const { error } = await supabase
    .from('devices')
    .update({
      name: updates.name,
      status: updates.status,
      description: updates.description,
      // แปลงฟิลด์อื่นๆ ตามต้องการ
    })
    .eq('device_code', deviceId);

  if (error) {
    throw new Error(error.message);
  }
}
