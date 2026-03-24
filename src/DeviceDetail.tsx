import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Droplet, Gauge, Lightbulb, MapPin, RefreshCw, Signal, Wifi, Clock, Edit, Check, X } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './durablearticles.css';
import { getStatusBadgeClass, statusColors, statusLabels, type DeviceStatus } from './status';
import ReportButton from './ReportButton';
import type { Device, DeviceType } from './types';
import { fetchDeviceComplaints, updateDeviceData } from './lib/data';

const iconDefaultPrototype = (L.Icon.Default as any).prototype;
delete iconDefaultPrototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface DeviceDetailProps {
  type: DeviceType;
  devices: Device[];
  selectedId?: string;
  onSelect: (deviceId: string) => void;
  onRefresh: () => void;
  refreshing: boolean;
  onNavigateOverview: () => void;
  onComplaintSubmitted: () => void;
}

type TypeConfig = { title: string; subtitle: string; icon: string; listIcon: ReactNode; };

const TYPE_CONFIG: Record<DeviceType, TypeConfig> = {
  streetlight: { title: 'ไฟส่องสว่าง', subtitle: 'ฐานข้อมูลครุภัณฑ์ไฟสาธารณะ', icon: '💡', listIcon: <Lightbulb size={20} color="#2563eb" /> },
  wifi: { title: 'ไวไฟชุมชน', subtitle: 'จุดกระจายสัญญาณอินเทอร์เน็ตฟรี', icon: '📶', listIcon: <Wifi size={20} color="#2563eb" /> },
  hydrant: { title: 'ประปาหัวแดง', subtitle: 'จุดจ่ายน้ำดับเพลิงและแรงดันน้ำ', icon: '🚒', listIcon: <Droplet size={20} color="#dc2626" /> },
};

function toLatLng(device: Device): [number, number] | null {
  if (!Number.isFinite(device.lat) || !Number.isFinite(device.lng)) return null;
  return [device.lat, device.lng];
}

function DeviceDetail({
  type, devices, selectedId, onSelect, onRefresh, refreshing, onNavigateOverview, onComplaintSubmitted,
}: DeviceDetailProps) {
  const config = TYPE_CONFIG[type];
  const filteredDevices = useMemo(() => devices.filter((device) => device.type === type), [devices, type]);

  const [currentId, setCurrentId] = useState<string | undefined>(selectedId);
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // --- State ใหม่สำหรับ Tabs, History และ Edit Mode ---
  const [activeTab, setActiveTab] = useState<'detail' | 'history'>('detail');
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // --- State สำหรับเก็บค่าตอนแก้ไข ---
  const [editName, setEditName] = useState('');
  const [editStatus, setEditStatus] = useState<DeviceStatus>('normal');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (selectedId) setCurrentId(selectedId);
    else if (!currentId && filteredDevices.length > 0) setCurrentId(filteredDevices[0].id);
  }, [selectedId, filteredDevices, currentId]);

  // สร้างตัวแปร selectedDevice
  const selectedDevice = useMemo(() => filteredDevices.find((item) => item.id === currentId) ?? filteredDevices[0], [filteredDevices, currentId]);

  // --- ย้ายฟังก์ชันและ useEffect ที่เรียกใช้ selectedDevice มาไว้ตรงนี้ ---
  // เมื่อกดปุ่ม "แก้ไข" ให้ดึงค่าปัจจุบันมาใส่ฟอร์มรอไว้
  useEffect(() => {
    if (isEditing && selectedDevice) {
      setEditName(selectedDevice.name);
      setEditStatus(selectedDevice.status);
    }
  }, [isEditing, selectedDevice]);

  // ฟังก์ชันกดบันทึก
  const handleSaveEdit = async () => {
    if (!selectedDevice) return;
    try {
      setIsSaving(true);
      await updateDeviceData(selectedDevice.id, {
        name: editName,
        status: editStatus,
      });
      alert('บันทึกการแก้ไขเรียบร้อยแล้ว');
      setIsEditing(false); // ปิดโหมดแก้ไข
      onRefresh(); // สั่งรีเฟรชข้อมูลให้ตารางอัปเดต
    } catch (error) {
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  // เมื่อเลือกอุปกรณ์ใหม่ ให้ปิดโหมด Edit และถ้าอยู่หน้า History ให้ดึงข้อมูลใหม่
  useEffect(() => {
    if (!selectedDevice) return;
    setCurrentId(selectedDevice.id);
    setIsEditing(false);

    if (activeTab === 'history') {
      loadHistory(selectedDevice.id);
    }
  }, [selectedDevice, activeTab]);

  const loadHistory = async (id: string) => {
    setLoadingHistory(true);
    const data = await fetchDeviceComplaints(id);
    setHistoryList(data);
    setLoadingHistory(false);
  };

  // แผนที่ทำงานเหมือนเดิม (ย่อโค้ดเพื่อความกระชับ)
  useEffect(() => {
    if (!mapContainerRef.current || !selectedDevice) return;
    const latLng = toLatLng(selectedDevice);
    if (!latLng) return;

    if (!mapRef.current) {
      const map = L.map(mapContainerRef.current).setView(latLng, 16);
      mapRef.current = map;
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    } else {
      mapRef.current.setView(latLng, 16);
    }

    if (markerRef.current) markerRef.current.remove();
    const markerColor = statusColors[selectedDevice.status];
    const customIcon = L.divIcon({
      className: 'custom-marker',
      html: `<div class="marker-container" style="background-color: ${markerColor}"><span class="marker-icon">${config.icon}</span></div>`,
      iconSize: [40, 40], iconAnchor: [20, 40], popupAnchor: [0, -40],
    });

    markerRef.current = L.marker(latLng, { icon: customIcon }).addTo(mapRef.current);
  }, [selectedDevice, config.icon]);

  if (filteredDevices.length === 0) {
    return (
      <div className="sl-container"><div className="sl-header"><h2>{config.title}</h2><p>ไม่พบข้อมูลอุปกรณ์</p></div></div>
    );
  }

  const renderDetailRows = (device: Device) => {
    if (device.type === 'streetlight') {
      return (
        <>
          <div><span className="sl-field-label">ประเภทโคม</span><p className="sl-field-value">{device.lampType || '-'}</p></div>
          <div><span className="sl-field-label">หลอดไฟ</span><p className="sl-field-value">{device.bulbType || '-'}</p></div>
          <div><span className="sl-field-label">กำลังไฟ</span><p className="sl-field-value">{device.watt || '-'}</p></div>
        </>
      );
    }
    if (device.type === 'wifi') {
      return (
        <>
          <div><span className="sl-field-label">ผู้ให้บริการ</span><p className="sl-field-value">{device.isp || '-'}</p></div>
          <div><span className="sl-field-label">ความเร็ว</span><p className="sl-field-value"><Signal size={16} style={{ display: 'inline' }} /> {device.speed || '-'}</p></div>
        </>
      );
    }
    return (
      <>
        <div><span className="sl-field-label">ระดับแรงดันน้ำ</span><p className="sl-field-value"><Gauge size={16} style={{ display: 'inline' }} /> {device.pressure || '-'}</p></div>
      </>
    );
  };

  return (
    <div className="sl-container">
      <div className="sl-header">
        <div className="header-row">
          <div><h2>{config.title}</h2><p>{config.subtitle}</p></div>
          <button onClick={onRefresh} className="btn-update" disabled={refreshing}>
            <RefreshCw size={16} className={refreshing ? 'spin-anim' : ''} />
            <span>{refreshing ? 'กำลังโหลด...' : 'อัปเดตข้อมูล'}</span>
          </button>
        </div>
      </div>

      <div className="sl-layout">
        {/* กล่องซ้าย รายการอุปกรณ์ (โค้ดเดิม) */}
        <div className="sl-panel">
          <div className="sl-panel-header">
            {config.listIcon}<h3>รายการ ({filteredDevices.length})</h3>
          </div>
          <div className="sl-list-content">
            {filteredDevices.map((item) => (
              <div key={item.id} onClick={() => onSelect(item.id)} className={`sl-card ${selectedDevice?.id === item.id ? 'active' : ''}`}>
                <div className="sl-card-row">
                  <span className="sl-id">{item.id}</span>
                  <span className={`sl-status ${getStatusBadgeClass(statusLabels[item.status])}`}>{statusLabels[item.status]}</span>
                </div>
                <p className="sl-location">{item.name}</p>
              </div>
            ))}
          </div>
        </div>

        {/* กล่องขวา รายละเอียด / ประวัติ */}
        <div className="sl-panel">
          <div className="sl-panel-header" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MapPin size={20} color="#2563eb" />
              <h3>ข้อมูลอุปกรณ์: {selectedDevice?.id}</h3>
            </div>

            {/* แท็บสลับหน้า */}
            <div style={{ display: 'flex', gap: '8px', background: 'white', padding: '4px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <button
                onClick={() => setActiveTab('detail')}
                style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: activeTab === 'detail' ? '#eff6ff' : 'transparent', color: activeTab === 'detail' ? '#2563eb' : '#64748b', fontWeight: activeTab === 'detail' ? 600 : 400, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <MapPin size={16} /> รายละเอียด
              </button>
              <button
                onClick={() => setActiveTab('history')}
                style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: activeTab === 'history' ? '#eff6ff' : 'transparent', color: activeTab === 'history' ? '#2563eb' : '#64748b', fontWeight: activeTab === 'history' ? 600 : 400, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Clock size={16} /> ประวัติซ่อม
              </button>
            </div>
          </div>

          <div className="sl-scrollable-content">
            {/* แผนที่ย่อ */}
            <div className="sl-map-area" ref={mapContainerRef} style={{ height: '220px', width: '100%', position: 'relative', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }} />

            <div className="sl-detail-box" style={{ flex: 1 }}>

              {/* --- เนื้อหาแท็บ "รายละเอียด" --- */}
              {activeTab === 'detail' && selectedDevice && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                    <div>
                      <h2 style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#1f2937', margin: 0 }}>{selectedDevice.name}</h2>
                      <p style={{ color: '#64748b', margin: '4px 0 0 0', fontSize: '0.9rem' }}>พิกัด: {selectedDevice.lat.toFixed(6)}, {selectedDevice.lng.toFixed(6)}</p>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <span className={`sl-status ${getStatusBadgeClass(statusLabels[selectedDevice.status])}`} style={{ fontSize: '0.9rem', padding: '6px 12px', display: 'flex', alignItems: 'center' }}>
                        {statusLabels[selectedDevice.status]}
                      </span>

                      {/* ปุ่มแก้ไข */}
                      <button
                        onClick={() => setIsEditing(!isEditing)}
                        style={{ padding: '6px 12px', background: isEditing ? '#fef2f2' : '#f1f5f9', color: isEditing ? '#ef4444' : '#475569', border: 'none', borderRadius: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
                      >
                        {isEditing ? <><X size={16} /> ยกเลิก</> : <><Edit size={16} /> แก้ไข</>}
                      </button>
                    </div>
                  </div>

                  {isEditing ? (
                    <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                      <h4 style={{ margin: '0 0 12px 0', color: '#3b82f6' }}>โหมดแก้ไขข้อมูล</h4>
                      <div className="sl-detail-grid">
                        <div>
                          <span className="sl-field-label">สถานที่ตั้ง</span>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                          />
                        </div>
                        <div>
                          <span className="sl-field-label">สถานะ</span>
                          <select
                            value={editStatus}
                            onChange={(e) => setEditStatus(e.target.value as DeviceStatus)}
                            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                          >
                            <option value="normal">ปกติดี</option>
                            <option value="damaged">ชำรุด</option>
                            <option value="repairing">กำลังซ่อม</option>
                          </select>
                        </div>
                      </div>
                      <button
                        onClick={handleSaveEdit}
                        disabled={isSaving}
                        style={{ marginTop: '16px', padding: '8px 16px', background: isSaving ? '#9ca3af' : '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: isSaving ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Check size={16} /> {isSaving ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
                      </button>
                    </div>
                  ) : (
                    <div className="sl-detail-grid">
                      <div><span className="sl-field-label">หน่วยงาน</span><p className="sl-field-value">{selectedDevice.department}</p></div>
                      <div><span className="sl-field-label">รายละเอียด (รวม)</span><p className="sl-field-value" style={{ whiteSpace: 'pre-line' }}>{selectedDevice.description || '-'}</p></div>
                      {renderDetailRows(selectedDevice)}
                    </div>
                  )}

                  <ReportButton
                    deviceId={selectedDevice.id}
                    deviceType={selectedDevice.type}
                    deviceName={selectedDevice.name}
                    location={`${selectedDevice.lat.toFixed(6)}, ${selectedDevice.lng.toFixed(6)}`}
                    status={statusLabels[selectedDevice.status]}
                    onSubmitted={() => {
                      onComplaintSubmitted();
                    }}
                  />
                </>
              )}

              {/* --- เนื้อหาแท็บ "ประวัติการซ่อม" --- */}
              {activeTab === 'history' && (
                <div>
                  <h3 style={{ fontSize: '1.1rem', color: '#1e293b', marginBottom: '16px', borderBottom: '2px solid #f1f5f9', paddingBottom: '8px' }}>ประวัติการแจ้งซ่อม: {selectedDevice?.id}</h3>

                  {loadingHistory ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}><RefreshCw size={24} className="spin-anim" style={{ margin: '0 auto' }} />กำลังโหลดประวัติ...</div>
                  ) : historyList.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1', color: '#64748b' }}>
                      <Check size={32} color="#10b981" style={{ margin: '0 auto 8px auto' }} />
                      ยังไม่มีประวัติการแจ้งซ่อม อุปกรณ์นี้ใช้งานได้ปกติดี
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {historyList.map((historyItem, index) => (
                        <div key={index} style={{ padding: '16px', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <strong style={{ color: '#334155' }}>สถานะแจ้ง: {historyItem.status}</strong>
                            <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                              {historyItem.created_at ? new Date(historyItem.created_at).toLocaleString('th-TH') : 'ไม่ระบุเวลา'}
                            </span>
                          </div>
                          <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>รายละเอียด: {historyItem.description || '-'}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DeviceDetail;