import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { normalizePrediction, validCoordinates } from './domain.ts';
import type { RoadReport, Settings } from './types.ts';

export function endpoint(settings: Settings, route: string) {
  let url: URL;
  try { url = new URL(settings.apiUrl.trim()); } catch { throw new Error('Set a valid backend URL in Profile, for example http://192.168.1.10:8000.'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('The backend URL must use http or https.');
  if (!route.startsWith('/') || route.startsWith('//') || route.includes('://')) throw new Error('Endpoint paths must start with a single /.');
  return settings.apiUrl.trim().replace(/\/+$/, '') + route;
}
async function request(url: string, init?: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const raw = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = typeof raw?.detail === 'string' ? raw.detail : Array.isArray(raw?.detail) ? raw.detail.map((e: any) => e.msg).join('; ') : '';
      throw new Error(detail || `Backend returned ${response.status}. Check your connection settings.`);
    }
    return raw;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('The backend took too long to respond. Saved reports remain available on this device.');
    if (error instanceof TypeError) throw new Error('Cannot reach the backend. Check the server URL, Wi-Fi connection, and that the backend is running.');
    throw error;
  } finally { clearTimeout(timer); }
}
async function photoPart(form: FormData, uri: string, field: string) {
  try {
    const response = await fetch(uri);
    if (response.ok) {
      const blob = await response.blob();
      form.append(field, blob, 'road-damage.jpg');
      return;
    }
  } catch {}
  form.append(field, { uri, name: 'road-damage.jpg', type: 'image/jpeg' } as any);
}
export async function checkConnection(settings: Settings) {
  const health = await request(endpoint(settings, '/health'));
  if (health?.status !== 'ok') throw new Error('The backend is not ready.');
  return health as { status: string; reporting: boolean; detector_configured: boolean };
}
export async function detectPhoto(settings: Settings, uri: string) {
  const targetUrl = endpoint(settings, settings.detectPath);

  if (Platform.OS !== 'web' && !uri.startsWith('http') && !uri.startsWith('data:')) {
    const res = await FileSystem.uploadAsync(targetUrl, uri, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: settings.imageField || 'photo',
      mimeType: 'image/jpeg',
    });
    if (res.status >= 400) {
      let detail = '';
      try {
        const parsed = JSON.parse(res.body);
        detail = parsed?.detail || parsed?.message;
      } catch {}
      throw new Error(detail || `Backend returned ${res.status}. Check your connection settings.`);
    }
    const raw = JSON.parse(res.body);
    if (!raw?.damage_type && Array.isArray(raw?.detections) && !raw.detections.length) {
      throw new Error(raw.message || 'No supported damage was detected. Retake the photo or classify it manually.');
    }
    return normalizePrediction(raw);
  }

  const form = new FormData();
  await photoPart(form, uri, settings.imageField || 'photo');
  const raw = await request(targetUrl, { method: 'POST', body: form });
  if (!raw?.damage_type && Array.isArray(raw?.detections) && !raw.detections.length) throw new Error(raw.message || 'No supported damage was detected. Retake the photo or classify it manually.');
  return normalizePrediction(raw);
}
export async function uploadReport(settings: Settings, report: RoadReport) {
  if (!report.photo) throw new Error('This report has no photo to upload.');
  const targetUrl = endpoint(settings, settings.reportsPath);
  const metadataString = JSON.stringify({
    id: report.id, latitude: report.coordinates.latitude, longitude: report.coordinates.longitude,
    location_source: report.locationSource ?? 'manual', captured_at: report.createdAt,
    note: report.notes, address: report.address, damage_type: report.prediction.damage,
    severity: report.prediction.severity, source: report.prediction.source,
    confidence: report.prediction.confidence ?? null,
    detections: report.prediction.source === 'model' ? report.prediction.detections ?? [] : [],
  });

  if (Platform.OS !== 'web' && !report.photo.startsWith('http') && !report.photo.startsWith('data:')) {
    const res = await FileSystem.uploadAsync(targetUrl, report.photo, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: settings.imageField || 'photo',
      mimeType: 'image/jpeg',
      parameters: {
        metadata: metadataString,
      },
    });
    if (res.status >= 400) {
      let detail = '';
      try {
        const parsed = JSON.parse(res.body);
        detail = parsed?.detail || parsed?.message;
      } catch {}
      throw new Error(detail || `Backend returned ${res.status}. Check your connection settings.`);
    }
    const item = JSON.parse(res.body);
    if (!item?.id) throw new Error('The server did not return a report ID. Keep this report and retry using the same ID.');
    return String(item.id);
  }

  const form = new FormData();
  await photoPart(form, report.photo, settings.imageField || 'photo');
  form.append('metadata', metadataString);
  const item = await request(targetUrl, { method: 'POST', body: form });
  if (!item?.id) throw new Error('The server did not return a report ID. Keep this report and retry using the same ID.');
  return String(item.id);
}
export async function fetchReports(settings: Settings): Promise<RoadReport[]> {
  const all: RoadReport[] = [];
  for (let offset = 0; ; offset += 100) {
    const route = `${settings.reportsPath}${settings.reportsPath.includes('?') ? '&' : '?'}limit=100&offset=${offset}`;
    const items = await request(endpoint(settings, route));
    if (!Array.isArray(items)) throw new Error('Expected a report list from the backend.');
    for (const r of items) {
      const coordinates = validCoordinates(r.latitude, r.longitude);
      if (!coordinates || !r.id) throw new Error('A backend report has no valid ID or coordinates.');
      const first = r.detections?.[0];
      const prediction = normalizePrediction({ ...r, damage_type: r.damage_type || first?.label, confidence: r.confidence ?? first?.confidence });
      prediction.source = ['manual', 'demo'].includes(r.source) ? r.source : 'model';
      if (prediction.source === 'manual') prediction.confidence = undefined;
      const photo = r.photo_url ? new URL(r.photo_url, settings.apiUrl).toString() : undefined;
      all.push({ id: String(r.id), remoteId: String(r.id), title: prediction.damage, address: String(r.address || 'Reported road'), notes: String(r.note ?? ''), coordinates, prediction, status: r.status ?? 'Submitted', sync: 'Synced', createdAt: r.captured_at ?? r.saved_at, photo, locationSource: r.location_source, backendUrl: settings.apiUrl.replace(/\/+$/, '') });
    }
    if (items.length < 100) break;
    if (offset >= 9900) throw new Error('This installation supports loading up to 10,000 reports. Add server-side filtering for larger datasets.');
  }
  return all;
}
