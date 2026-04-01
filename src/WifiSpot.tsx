import DeviceDetail from './DeviceDetail';
import type { Device } from './types';

interface WifiSpotProps {
  devices: Device[];
  selectedId?: string;
  onSelect: (deviceId: string) => void;
  onRefresh: () => void;
  refreshing: boolean;
  onNavigateOverview: () => void;
  onComplaintSubmitted: () => void;
  onOpenReport: (device: Device) => void;
}

function WifiSpot(props: WifiSpotProps) {
  return <DeviceDetail {...props} type="wifi" />;
}

export default WifiSpot;
