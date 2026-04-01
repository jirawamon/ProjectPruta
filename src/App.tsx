import { useEffect, useMemo, useState } from 'react';
import { Home, MapPin, List, ChevronUp, ChevronDown, Plus, Menu, X } from 'lucide-react';
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import './App.css';
import './durablearticles.css';
import { getStatusBadgeClass, statusLabels } from './status';
import CityMap from './CityMap.tsx';
import AddPositionModal from './AddPositionModal';
import ReportFormModal from './ReportFormModal';
import StreetLight from './StreetLight';
import WifiSpot from './WifiSpot';
import FireHydrant from './FireHydrant';
import { fetchAllDevices, saveDevicePosition } from './lib/data';
import type { Device, DeviceType, NewDeviceInput } from './types';



function OverviewPage({
  devices,
  loading,
  addMode,
  onToggleAddMode,
  onAddPosition,
  onOpenDevice,
  onReportFromMap,
}: {
  devices: Device[];
  loading: boolean;
  addMode: boolean;
  onToggleAddMode: () => void;
  onAddPosition: (lat: number, lng: number) => void;
  onOpenDevice: (device: Device) => void;
  onReportFromMap: (device: Device) => void;
}) {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const navigate = useNavigate();

  const streetLights = devices.filter((device) => device.type === 'streetlight');
  const wifiSpots = devices.filter((device) => device.type === 'wifi');
  const hydrants = devices.filter((device) => device.type === 'hydrant');

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 1 }}>
        <CityMap
          devices={devices}
          loading={loading}
          showRanges
          addMode={addMode}
          onAddPosition={onAddPosition}
          onOpenDevice={onOpenDevice}
          onReportDevice={onReportFromMap}
        />

        <button
          onClick={onToggleAddMode}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            zIndex: 1000,
            backgroundColor: addMode ? '#ef4444' : '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            padding: '12px 20px',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
          }}
        >
          <Plus size={20} />
          {addMode ? 'ยกเลิก' : 'เพิ่มตำแหน่ง'}
        </button>
      </div>

      <div
      className="overview-right-panel"
        style={{
          position: 'absolute',
          bottom: 0,
          right: '20px',
          width: '380px',
          height: isPanelOpen ? 'calc(100% - 20px)' : '60px',
          borderRadius: '16px',
          marginBottom: isPanelOpen ? '10px' : '0',
          zIndex: 1000,
          backgroundColor: 'white',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transition: 'all 0.3s ease-in-out',
        }}
      >
        <div
          onClick={() => setIsPanelOpen(!isPanelOpen)}
          style={{
            minHeight: '60px',
            background: 'white',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 1rem',
            cursor: 'pointer',
            userSelect: 'none',
            position: 'relative',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ background: '#3b82f6', padding: '8px', borderRadius: '8px', color: 'white' }}>
              <List size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>รายการอุปกรณ์</h3>
            </div>
          </div>

          <div style={{ color: '#94a3b8', display: 'flex' }}>
            {isPanelOpen ? <ChevronDown size={24} /> : <ChevronUp size={24} />}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', background: '#f8fafc' }}>
          <div style={{ marginBottom: '1rem', fontSize: '0.85rem', color: '#64748b' }}>
            ทั้งหมด {devices.length} จุด
          </div>

          <h4 style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 0.5rem 0' }}>💡 ไฟส่องสว่าง ({streetLights.length})</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
            {streetLights.map((item) => (
              <div
                key={`sl-${item.id}`}
                className="list-card"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/devices/streetlight?id=${encodeURIComponent(item.id)}`);
                }}
              >
                <div className="card-left">
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>#{item.id}</div>
                  <div className="card-sub">{item.name}</div>
                </div>
                <div className={`status-pill ${getStatusBadgeClass(statusLabels[item.status])}`}>{statusLabels[item.status]}</div>
              </div>
            ))}
          </div>

          <h4 style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 0.5rem 0' }}>📶 Wi-Fi ({wifiSpots.length})</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
            {wifiSpots.map((item) => (
              <div
                key={`wf-${item.id}`}
                className="list-card"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/devices/wifi?id=${encodeURIComponent(item.id)}`);
                }}
              >
                <div className="card-left">
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>#{item.id}</div>
                  <div className="card-sub">{item.name}</div>
                </div>
                <div className={`status-pill ${getStatusBadgeClass(statusLabels[item.status])}`}>{statusLabels[item.status]}</div>
              </div>
            ))}
          </div>

          <h4 style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 0.5rem 0' }}>🚒 ประปา/ดับเพลิง ({hydrants.length})</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
            {hydrants.map((item) => (
              <div
                key={`hd-${item.id}`}
                className="list-card"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/devices/hydrant?id=${encodeURIComponent(item.id)}`);
                }}
              >
                <div className="card-left">
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>#{item.id}</div>
                  <div className="card-sub">{item.name}</div>
                </div>
                <div className={`status-pill ${getStatusBadgeClass(statusLabels[item.status])}`}>{statusLabels[item.status]}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DeviceRoutePage({
  devices,
  onRefresh,
  refreshing,
  onNavigateOverview,
  onComplaintSubmitted,
  onOpenReport,
}: {
  devices: Device[];
  onRefresh: () => void;
  refreshing: boolean;
  onNavigateOverview: () => void;
  onComplaintSubmitted: () => void;
  onOpenReport: (device: Device) => void;
}) {
  const params = useParams<{ type: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const type = (params.type === 'streetlight' || params.type === 'wifi' || params.type === 'hydrant'
    ? params.type
    : 'streetlight') as DeviceType;

  const selectedId = searchParams.get('id') ?? undefined;

  const setSelectedId = (id: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('id', id);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="device-page" style={{ padding: '20px', background: 'white', height: '100%', overflowY: 'auto' }}>
      <div className="device-tabs">
        <button className={type === 'streetlight' ? 'active' : ''} onClick={() => navigate('/devices/streetlight')}>
          ไฟส่องสว่าง
        </button>
        <button className={type === 'wifi' ? 'active' : ''} onClick={() => navigate('/devices/wifi')}>
          ไวไฟ
        </button>
        <button className={type === 'hydrant' ? 'active' : ''} onClick={() => navigate('/devices/hydrant')}>
          ประปา
        </button>
      </div>
      <div className="device-content">
        {type === 'streetlight' && (
          <StreetLight
            devices={devices}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onRefresh={onRefresh}
            refreshing={refreshing}
            onNavigateOverview={onNavigateOverview}
            onComplaintSubmitted={onComplaintSubmitted}
            onOpenReport={onOpenReport}
          />
        )}
        {type === 'wifi' && (
          <WifiSpot
            devices={devices}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onRefresh={onRefresh}
            refreshing={refreshing}
            onNavigateOverview={onNavigateOverview}
            onComplaintSubmitted={onComplaintSubmitted}
            onOpenReport={onOpenReport}
          />
        )}
        {type === 'hydrant' && (
          <FireHydrant
            devices={devices}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onRefresh={onRefresh}
            refreshing={refreshing}
            onNavigateOverview={onNavigateOverview}
            onComplaintSubmitted={onComplaintSubmitted}
            onOpenReport={onOpenReport}
          />
        )}
      </div>
    </div>
  );
}

function App() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loadingSheets, setLoadingSheets] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addMode, setAddMode] = useState(false);
  const [tempLat, setTempLat] = useState(0);
  const [tempLng, setTempLng] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<Device | null>(null);

  const navigate = useNavigate();
  const location = useLocation();

  const loadDevices = async (withRefreshIndicator: boolean) => {
    if (withRefreshIndicator) {
      setIsRefreshing(true);
    } else {
      setLoadingSheets(true);
    }

    try {
      const data = await fetchAllDevices();
      console.debug('[App] loadDevices fetched:', {
        count: data.length,
        byType: {
          streetlight: data.filter((d) => d.type === 'streetlight').length,
          wifi: data.filter((d) => d.type === 'wifi').length,
          hydrant: data.filter((d) => d.type === 'hydrant').length,
        },
      });
      setDevices(data);
    } finally {
      setLoadingSheets(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void loadDevices(false);
  }, []);

  useEffect(() => {
    console.debug('[App] devices state updated:', {
      count: devices.length,
      latest: devices.length > 0 ? devices[devices.length - 1] : null,
    });
  }, [devices]);

  const handleAddPosition = (lat: number, lng: number) => {
    setTempLat(lat);
    setTempLng(lng);
    setIsAddModalOpen(true);
  };

  const handleSavePosition = async (data: NewDeviceInput) => {
    const newDevice = await saveDevicePosition(data);
    console.debug('[App] saveDevicePosition returned:', newDevice);

    setDevices((prev) => {
      const exists = prev.some((item) => item.type === newDevice.type && item.id === newDevice.id);
      if (exists) return prev;
      return [...prev, newDevice];
    });

    await loadDevices(true);
    setAddMode(false);
    alert('เพิ่มตำแหน่งใหม่สำเร็จ!');
  };

  const toggleAddMode = () => {
    const next = !addMode;
    setAddMode(next);
    if (next) {
      alert('คลิกบนแผนที่เพื่อเลือกตำแหน่งที่ต้องการเพิ่ม');
    }
  };

  const handleOpenDevice = (device: Device) => {
    navigate(`/devices/${device.type}?id=${encodeURIComponent(device.id)}`);
  };

  const handleReportFromMap = (device: Device) => {
    if (reportTarget !== null) return;
    setReportTarget(device);
  };

  const activeMenu = useMemo<'overview' | 'devices'>(() => {
    if (location.pathname.startsWith('/devices')) return 'devices';
    return 'overview';
  }, [location.pathname]);

  return (
    <div className="app-container" style={{ display: 'flex', height: '100vh', width: '100%', overflow: 'hidden' }}>
      
      {/* 🟢 ส่วนที่เพิ่มใหม่ 1: ปุ่มเปิดเมนูบนมือถือ */}
      <button className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(true)}>
        <Menu size={24} />
      </button>

      {/* 🟢 ส่วนที่เพิ่มใหม่ 2: พื้นหลังสีดำจางๆ ตอนกดเปิดเมนู */}
      {isMobileMenuOpen && (
        <div className="sidebar-overlay" onClick={() => setIsMobileMenuOpen(false)}></div>
      )}

      {/* 🟡 ส่วนที่แก้ไข 1: แทรกตัวแปร isMobileMenuOpen ใส่ Class และปรับ zIndex เป็น 9999 */}
      <aside className={`shared-sidebar ${isMobileMenuOpen ? 'open' : ''}`} style={{ width: '250px', flexShrink: 0, zIndex: 9999 }}>
        
        {/* 🟡 ส่วนที่แก้ไข 2: ปรับ Layout Header เพื่อให้ใส่ปุ่ม [X] ปิดเมนูได้ */}
        <div className="sidebar-left-header" style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div className="logo-icon">
              <Home size={20} color="white" />
            </div>
            <div>
              <h3>เทศบาลตำบล</h3>
              <p>พลูตาหลวง</p>
            </div>
          </div>
          
          {/* 🟢 ส่วนที่เพิ่มใหม่ 3: ปุ่ม X สำหรับปิดเมนู (จะโผล่มาเฉพาะมือถือ) */}
          {isMobileMenuOpen && (
            <div onClick={() => setIsMobileMenuOpen(false)} style={{ cursor: 'pointer', padding: '5px' }}>
              <X size={24} color="#94a3b8" />
            </div>
          )}
        </div>

        {/* เมนูรายการอุปกรณ์และภาพรวม (โค้ดเดิม ไม่มีการเปลี่ยนแปลง) */}
        <div className="menu-list">
          <NavLink to="/" className={`menu-item ${activeMenu === 'overview' ? 'active' : ''}`}>
            <Home size={18} /> ภาพรวม
          </NavLink>
          <NavLink to="/devices/streetlight" className={`menu-item ${activeMenu === 'devices' ? 'active' : ''}`}>
            <MapPin size={18} /> อุปกรณ์
          </NavLink>
        </div>
      </aside>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
        <Routes>
          <Route
            path="/"
            element={
              <OverviewPage
                devices={devices}
                loading={loadingSheets}
                addMode={addMode}
                onToggleAddMode={toggleAddMode}
                onAddPosition={handleAddPosition}
                onOpenDevice={handleOpenDevice}
                onReportFromMap={handleReportFromMap}
              />
            }
          />
          <Route
            path="/devices/:type"
            element={
              <DeviceRoutePage
                devices={devices}
                onRefresh={() => {
                  void loadDevices(true);
                }}
                refreshing={isRefreshing}
                onNavigateOverview={() => navigate('/')}
                onComplaintSubmitted={() => {
                  // no-op hook for future analytics
                }}
                onOpenReport={handleReportFromMap}
              />
            }
          />
          <Route path="/devices" element={<Navigate to="/devices/streetlight" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <AddPositionModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setAddMode(false);
        }}
        onSave={(data) => {
          void handleSavePosition(data);
        }}
        initialLat={tempLat}
        initialLng={tempLng}
      />

      <ReportFormModal
        isOpen={reportTarget !== null}
        onClose={() => setReportTarget(null)}
        deviceId={reportTarget?.id ?? ''}
        deviceType={reportTarget?.type ?? 'streetlight'}
        deviceName={reportTarget?.name ?? '-'}
        location={reportTarget ? `${reportTarget.lat.toFixed(6)}, ${reportTarget.lng.toFixed(6)}` : '-'}
        status={reportTarget ? statusLabels[reportTarget.status] : '-'}
        onSubmitted={() => {
          // no-op hook for future analytics
        }}
      />
    </div>
  );
}

export default App;
