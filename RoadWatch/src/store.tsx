import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { INITIAL_STATE, newId } from './domain';
import { defaultApiUrl } from './config';
import { fetchReports, uploadReport } from './api';
import type { RoadReport, StoredState } from './types';

const KEY = '@roadwatch/state/v1';
type Store = {
  state: StoredState; ready: boolean; storageError: string; serverError: string; syncing: boolean;
  update: (patch: Partial<StoredState> | ((state: StoredState) => StoredState)) => void;
  sync: () => Promise<string>;
  saveReport: (report: RoadReport) => Promise<void>;
};
const Context = createContext<Store | null>(null);
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<StoredState>(() => ({ ...INITIAL_STATE, settings: { ...INITIAL_STATE.settings, apiUrl: defaultApiUrl() } }));
  const [ready, setReady] = useState(false), [storageError, setStorageError] = useState(''), [syncing, setSyncing] = useState(false);
  const current = useRef(state), lock = useRef(false), writable = useRef(true);
  const [serverError, setServerError] = useState('');
  current.current = state;
  const update: Store['update'] = patch => setState(s => {
    const next = typeof patch === 'function' ? patch(s) : { ...s, ...patch };
    current.current = next;
    return next;
  });
  useEffect(() => {
    AsyncStorage.getItem(KEY).then(raw => {
      if (raw) {
        const saved = JSON.parse(raw);
        if (!Array.isArray(saved.reports) || !saved.settings || !saved.draft) throw new Error('Invalid saved data');
        const settings = { ...INITIAL_STATE.settings, ...saved.settings };
        if (!settings.name || settings.name.trim().toLowerCase() === 'vishnu') {
          settings.name = 'Muskan';
        }
        if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
          if (!settings.apiUrl || settings.apiUrl.includes('localhost') || settings.apiUrl.includes('127.0.0.1')) {
            settings.apiUrl = window.location.origin;
          }
        } else {
          settings.apiUrl ||= defaultApiUrl();
        }
        if (settings.reportsPath === '/reports') settings.reportsPath = '/api/v1/reports';
        if (settings.detectPath === '/detect') settings.detectPath = '/api/v1/detect';
        if (settings.imageField === 'file') settings.imageField = 'photo';
        const reports = saved.reports.map((r: RoadReport) => !r.isSample && !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(r.id) ? { ...r, id: newId(), remoteId: undefined, sync: 'Pending' } : r);
        setState({ ...INITIAL_STATE, ...saved, settings, reports });
      }
    }).catch(() => {
      writable.current = false;
      setStorageError('Saved data could not be loaded. Existing storage has been preserved. Please restart the app before creating reports.');
    }).finally(() => setReady(true));
  }, []);
  const writeQueue = useRef(Promise.resolve());
  useEffect(() => {
    if (!ready || !writable.current) return;
    writeQueue.current = writeQueue.current.then(() => AsyncStorage.setItem(KEY, JSON.stringify(state))).then(() => setStorageError('')).catch(() => {
      setStorageError('Changes could not be saved to this device. Free some storage and keep the app open.');
    });
  }, [state, ready]);
  async function saveReport(report: RoadReport) {
    if (!ready || !writable.current) throw new Error('Device storage is unavailable. Restart the app before saving.');
    await writeQueue.current;
    const next: StoredState = { ...current.current, reports: [report, ...current.current.reports], draft: { address: '', notes: '' } };
    try { await AsyncStorage.setItem(KEY, JSON.stringify(next)); }
    catch { throw new Error('The report could not be saved. Free some storage and try again. Your draft is still open.'); }
    update(next);
  }
  function mergeRemote(remote: RoadReport[], settings: StoredState['settings']) {
    if (current.current.settings.apiUrl !== settings.apiUrl || current.current.settings.mode !== 'live') return;
    update(s => {
      const merged = [...s.reports];
      remote.forEach(report => {
        const index = merged.findIndex(r => r.id === report.id || r.remoteId === report.remoteId);
        if (index < 0) merged.push(report);
        else merged[index] = { ...merged[index], ...report, id: merged[index].id, photo: merged[index].photo ?? report.photo };
      });
      return { ...s, reports: merged.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)) };
    });
  }
  useEffect(() => {
    if (!ready || state.settings.mode !== 'live') { setServerError(''); return; }
    let active = true;
    const settings = state.settings;
    fetchReports(settings).then(remote => { if (active) { mergeRemote(remote, settings); setServerError(''); } }).catch(() => { if (active) setServerError('Backend not connected. Check the server address in Profile. Your local reports remain available.'); });
    return () => { active = false; };
  }, [ready, state.settings.mode, state.settings.apiUrl, state.settings.reportsPath]);
  async function sync() {
    if (lock.current) return 'A sync is already in progress.';
    const settings = current.current.settings;
    if (settings.mode !== 'live') return 'Switch to backend mode in Profile to sync your reports.';
    lock.current = true; setSyncing(true);
    let uploaded = 0;
    try {
      const pending = current.current.reports.filter(r => !r.isSample && r.sync !== 'Synced');
      for (const report of pending) {
        const remoteId = await uploadReport(settings, report);
        update(s => ({ ...s, reports: s.reports.map(r => r.id === report.id ? { ...r, remoteId, sync: 'Synced' } : r) }));
        uploaded++;
      }
      const remote = await fetchReports(settings);
      mergeRemote(remote, settings);
      setServerError('');
      return `${uploaded ? `${uploaded} report${uploaded > 1 ? 's' : ''} uploaded. ` : ''}Reports are up to date.`;
    } finally { lock.current = false; setSyncing(false); }
  }
  return <Context.Provider value={{ state, ready, storageError, serverError, syncing, update, saveReport, sync }}>{children}</Context.Provider>;
}
export function useStore() { const store = useContext(Context); if (!store) throw new Error('Missing StoreProvider'); return store; }
