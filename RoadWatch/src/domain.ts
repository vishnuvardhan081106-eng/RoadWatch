import type { Coordinates, Damage, Prediction, RoadReport, Severity, StoredState } from './types.ts';

export const DAMAGE_TYPES: Damage[] = ['Pothole', 'Crack', 'Longitudinal crack', 'Transverse crack', 'Alligator crack', 'Surface damage'];
export const SEVERITIES: Severity[] = ['Low', 'Medium', 'High'];
export const DEFAULT_CENTER: Coordinates = { latitude: 14.4426, longitude: 79.9865 };
export const INITIAL_STATE: StoredState = {
  settings: { mode: 'live', apiUrl: '', detectPath: '/api/v1/detect', reportsPath: '/api/v1/reports', imageField: 'photo', name: 'Muskan' },
  draft: { address: '', notes: '' },
  reports: [
    { id: 'RW-DEMO-01', title: 'Pothole', address: 'Grand Trunk Road, Nellore', notes: 'Sample report for exploring the app.', coordinates: { latitude: 14.4461, longitude: 79.9872 }, prediction: { damage: 'Pothole', severity: 'High', source: 'demo', confidence: 0.94 }, status: 'Submitted', sync: 'Local', createdAt: '2026-11-18T08:30:00Z', isSample: true },
    { id: 'RW-DEMO-02', title: 'Longitudinal crack', address: 'Mini Bypass Road, Nellore', notes: 'Sample report for exploring the app.', coordinates: { latitude: 14.4359, longitude: 79.9818 }, prediction: { damage: 'Longitudinal crack', severity: 'Medium', source: 'demo', confidence: 0.88 }, status: 'In review', sync: 'Local', createdAt: '2026-11-17T06:20:00Z', isSample: true },
    { id: 'RW-DEMO-03', title: 'Surface damage', address: 'Magunta Layout, Nellore', notes: 'Sample resolved report. No actual repair is being claimed.', coordinates: { latitude: 14.4284, longitude: 79.9756 }, prediction: { damage: 'Surface damage', severity: 'Low', source: 'demo', confidence: 0.91 }, status: 'Resolved', sync: 'Local', createdAt: '2026-11-16T09:10:00Z', isSample: true },
  ],
};
export function validCoordinates(lat: string | number, lng: string | number): Coordinates | undefined {
  if (String(lat).trim() === '' || String(lng).trim() === '') return;
  const latitude = Number(lat), longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return;
  return { latitude, longitude };
}
export function distanceKm(a: Coordinates, b: Coordinates) {
  const r = Math.PI / 180, dLat = (b.latitude - a.latitude) * r, dLng = (b.longitude - a.longitude) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * r) * Math.cos(b.latitude * r) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
export function validateDraft(draft: StoredState['draft']) {
  if (!draft.photo) return 'Add a photo of the damaged road.';
  if (!draft.prediction) return 'Analyze the photo or choose the damage type manually.';
  if (!draft.coordinates || !validCoordinates(draft.coordinates.latitude, draft.coordinates.longitude)) return 'Add valid GPS coordinates.';
  if (!draft.address.trim()) return 'Add a road name or nearby landmark.';
  return '';
}
export function normalizePrediction(raw: any): Prediction {
  const p = raw?.prediction ?? raw?.result ?? raw?.detections?.[0] ?? raw;
  if (!p || typeof p !== 'object') throw new Error('The detection endpoint returned an invalid response.');
  const label = String(p.damage_type ?? p.damage ?? p.label ?? p.class ?? '').toLowerCase().replace(/[_-]/g, ' ');
  const damage: Damage | undefined = label.includes('pothole') || label === 'd40' ? 'Pothole' : label.includes('longitudinal') || label === 'd00' ? 'Longitudinal crack' : label.includes('transverse') || label === 'd10' ? 'Transverse crack' : label.includes('alligator') || label === 'd20' ? 'Alligator crack' : label.includes('surface') ? 'Surface damage' : label === 'crack' ? 'Crack' : undefined;
  if (!damage) throw new Error('No supported damage class was returned. You can classify the photo manually.');
  const rawConfidence = Number(p.confidence ?? p.score);
  const confidence = Number.isFinite(rawConfidence) && rawConfidence >= 0 && rawConfidence <= 100 ? (rawConfidence > 1 ? rawConfidence / 100 : rawConfidence) : undefined;
  const severity = SEVERITIES.find(s => s.toLowerCase() === String(p.severity).toLowerCase()) ?? 'Medium';
  const detections = (raw?.detections ?? p.detections) as Prediction['detections'];
  return { damage, confidence, severity, source: 'model', ...(Array.isArray(detections) && detections.length ? { detections } : {}) };
}
export function filterReports(reports: RoadReport[], query: string, status: string) {
  const term = query.trim().toLowerCase();
  return reports.filter(r => (status === 'All' || r.status === status) && `${r.id} ${r.address} ${r.title}`.toLowerCase().includes(term));
}
// These UUIDs identify reports; they are not authentication credentials.
export function newId() { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const n = Math.floor(Math.random() * 16); return (c === 'x' ? n : (n & 3) | 8).toString(16); }); }
export function reportLabel(id: string) { return id.startsWith('RW-') ? id : `RW-${id.slice(0, 8).toUpperCase()}`; }
export function dateLabel(iso: string) { return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); }
