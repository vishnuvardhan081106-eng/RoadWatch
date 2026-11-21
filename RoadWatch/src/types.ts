export type Damage = 'Pothole' | 'Crack' | 'Longitudinal crack' | 'Transverse crack' | 'Alligator crack' | 'Surface damage';
export type Severity = 'Low' | 'Medium' | 'High';
export type ReportStatus = 'Submitted' | 'In review' | 'Resolved';
export type SyncState = 'Local' | 'Pending' | 'Synced';
export interface Coordinates { latitude: number; longitude: number; accuracy?: number | null }
export interface Detection { label: 'pothole' | 'crack' | 'surface_damage'; confidence: number; left: number; top: number; right: number; bottom: number }
export interface Prediction { damage: Damage; severity: Severity; confidence?: number; source: 'demo' | 'model' | 'manual'; detections?: Detection[] }
export interface RoadReport {
  id: string; remoteId?: string; title: string; address: string; notes: string;
  coordinates: Coordinates; photo?: string; prediction: Prediction;
  status: ReportStatus; sync: SyncState; createdAt: string; isSample?: boolean; locationSource?: 'gps' | 'manual'; backendUrl?: string;
}
export interface Settings {
  mode: 'demo' | 'live'; apiUrl: string; detectPath: string; reportsPath: string;
  imageField: string; name: string;
}
export interface Draft {
  photo?: string; coordinates?: Coordinates; address: string; notes: string;
  prediction?: Prediction; latitudeText?: string; longitudeText?: string;
}
export interface StoredState { reports: RoadReport[]; settings: Settings; draft: Draft }
