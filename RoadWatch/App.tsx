import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Modal, Platform, Pressable, StatusBar as NativeStatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import Home from './src/screens/Home';
import Explore from './src/screens/Explore';
import Reports from './src/screens/Reports';
import Profile from './src/screens/Profile';
import Capture from './src/screens/Capture';
import Detail from './src/screens/Detail';
import { StoreProvider, useStore } from './src/store';
import { Icon, Note } from './src/components/ui';
import { C } from './src/theme';
import { withTimeout } from './src/async';
import type { Coordinates, RoadReport } from './src/types';

type Tab = 'Home' | 'Explore' | 'Reports' | 'Profile';
export default function App() { return <SafeAreaProvider><StoreProvider><Shell /></StoreProvider></SafeAreaProvider>; }
function Shell() {
  const { state, ready, storageError, serverError } = useStore();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('Home'), [capture, setCapture] = useState(false), [detailId, setDetailId] = useState<string>();
  const [toast, setToast] = useState(''), [location, setLocation] = useState<Coordinates>(), [locating, setLocating] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const detail = state.reports.find(r => r.id === detailId);
  function notify(message: string) { setToast(message); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(''), 7000); }
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (detailId) { setDetailId(undefined); return true; }
      if (capture) { setCapture(false); return true; }
      if (tab !== 'Home') { setTab('Home'); return true; }
      return false;
    });
    return () => sub.remove();
  }, [detailId, capture, tab]);
  function navigate(next: Tab) { setTab(next); if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {}); }
  function onDetail(report: RoadReport) { setCapture(false); setDetailId(report.id); }
  async function locate() {
    if (locating) return;
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) throw new Error('Enable location access to sort reports by distance from you.');
      const pos = await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), 15000, 'GPS took too long to respond. Try again when location service is available.'); setLocation(pos.coords);
      notify('Map centered on your current location.');
    } catch (e) { notify(e instanceof Error ? e.message : 'Location is unavailable.'); } finally { setLocating(false); }
  }
  const topInset = Platform.OS === 'web' ? 0 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 0 : insets.bottom;
  return <View style={s.outer}><StatusBar style="dark" /><View style={[s.app, { paddingTop: topInset }]}>
    {!ready ? <View style={s.loading}><Icon name="aperture" size={46} color={C.olive} /><Text style={s.loadingText}>roadwatch.</Text><ActivityIndicator color={C.olive} /></View> : <>
      {!!storageError && <View style={{ paddingHorizontal: 15, paddingTop: 10 }}><Note danger>{storageError}</Note></View>}
      {!!serverError && !capture && !detail && <View style={{ paddingHorizontal: 15, paddingTop: 10 }}><Note>{serverError}</Note></View>}
      <View style={{ flex: 1 }}>
        {capture ? <Capture onClose={() => { setCapture(false); setTab('Home'); }} onDetail={onDetail} notify={notify} /> : detail ? <Detail report={detail} onClose={() => setDetailId(undefined)} notify={notify} /> : tab === 'Home' ? <Home onCapture={() => setCapture(true)} onExplore={() => navigate('Explore')} onReports={() => navigate('Reports')} onProfile={() => navigate('Profile')} onDetail={onDetail} /> : tab === 'Explore' ? <Explore onDetail={onDetail} onLocate={locate} locating={locating} location={location} /> : tab === 'Reports' ? <Reports onDetail={onDetail} notify={notify} /> : <Profile notify={notify} />}
      </View>
      {!capture && !detail && <View style={[s.nav, { paddingBottom: Math.max(bottomInset, 12) }]}>
        {(['Home', 'Explore', 'Capture', 'Reports', 'Profile'] as const).map(item => item === 'Capture' ? <Pressable key={item} accessibilityRole="button" accessibilityLabel="Create road damage report" onPress={() => setCapture(true)} style={s.capture}><Icon name="plus" size={27} color={C.ink} /></Pressable> : <Pressable key={item} accessibilityRole="tab" accessibilityLabel={item} accessibilityState={{ selected: tab === item }} onPress={() => navigate(item)} style={s.navItem}><View style={[s.navIcon, tab === item && { backgroundColor: '#E9EEDC' }]}><Icon name={item === 'Home' ? 'grid' : item === 'Explore' ? 'map' : item === 'Reports' ? 'file-text' : 'user'} size={19} color={tab === item ? C.ink : '#969C8F'} /></View><Text style={[s.navText, tab === item && { color: C.ink, fontWeight: '700' }]}>{item}</Text></Pressable>)}
      </View>}
    </>}
    {!!toast && <Pressable accessibilityRole="alert" accessibilityLabel={toast} onPress={() => setToast('')} style={[s.toast, { bottom: !capture && !detail ? 100 + bottomInset : 22 + bottomInset }]}><Text style={s.toastText}>{toast}</Text><Icon name="x" size={15} color={C.lime} /></Pressable>}
  </View></View>;
}
const s = StyleSheet.create({
  outer: { flex: 1, backgroundColor: '#E6E9DF', alignItems: 'center' }, app: { flex: 1, width: '100%', maxWidth: 520, backgroundColor: C.bg, overflow: 'hidden', borderLeftWidth: Platform.OS === 'web' ? 1 : 0, borderRightWidth: Platform.OS === 'web' ? 1 : 0, borderColor: '#DCE0D3' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 25 }, loadingText: { color: C.ink, fontSize: 35, fontWeight: '800', letterSpacing: -2 },
  nav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 10, backgroundColor: C.white, borderTopWidth: 1, borderColor: C.line, gap: 5 }, navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 50 }, navIcon: { paddingHorizontal: 13, paddingVertical: 6, borderRadius: 16 }, navText: { fontSize: 8, color: '#92998A' }, capture: { width: 54, height: 54, borderRadius: 20, backgroundColor: C.lime, justifyContent: 'center', alignItems: 'center', marginHorizontal: 8, marginTop: -20, borderWidth: 4, borderColor: C.bg },
  toast: { position: 'absolute', left: 18, right: 18, backgroundColor: C.ink, borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }, toastText: { color: C.white, fontSize: 12, lineHeight: 18, flex: 1 },
});
