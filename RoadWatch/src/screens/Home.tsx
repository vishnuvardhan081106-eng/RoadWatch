import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useStore } from '../store';
import { C, styles as t } from '../theme';
import { Icon, IconButton } from '../components/ui';
import ReportCard from '../components/ReportCard';
import type { RoadReport } from '../types';

export default function Home({ onCapture, onExplore, onReports, onProfile, onDetail }: { onCapture: () => void; onExplore: () => void; onReports: () => void; onProfile: () => void; onDetail: (r: RoadReport) => void }) {
  const { state } = useStore();
  const reports = state.reports.filter(r => state.settings.mode === 'demo' || !r.isSample);
  const resolved = reports.filter(r => r.status === 'Resolved').length;
  const sample = reports.some(r => r.isSample);
  return <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={t.page}>
    <View style={t.between}>
      <View style={[t.row, { gap: 9 }]}><View style={s.logo}><Icon name="aperture" size={24} color={C.lime} /></View><Text style={s.brand}>roadwatch<Text style={{ color: C.olive }}>.</Text></Text></View>
      <Pressable accessibilityLabel="Open profile" accessibilityRole="button" onPress={onProfile} style={s.avatar}><Text style={s.avatarText}>{state.settings.name.slice(0, 1).toUpperCase() || 'R'}</Text><View style={s.online} /></Pressable>
    </View>
    <View style={{ gap: 9 }}>
      <View style={[t.row, { gap: 5 }]}><Icon name="map-pin" size={12} color={C.olive} /><Text style={s.location}>{state.settings.mode === 'demo' ? 'Nellore, India' : 'Your road community'}</Text><Text style={s.mode}>{state.settings.mode === 'demo' ? 'DEMO AREA' : 'YOUR COMMUNITY'}</Text></View>
      <Text style={s.greeting}>A little care.{'\n'}A better way forward.</Text>
      <Text style={t.body}>Spot it. Report it. Make your roads safer.</Text>
    </View>
    <View style={s.hero}>
      <Image source={require('../../assets/road.jpg')} style={[StyleSheet.absoluteFill, { borderRadius: 23 }]} resizeMode="cover" />
      <View style={s.heroShade} />
      <View style={s.heroTop}><View style={s.heroPill}><View style={s.dot} /><Text style={s.heroPillText}>BUILT FOR BETTER ROADS</Text></View><Icon name="arrow-up-right" size={23} color={C.white} /></View>
      <View style={s.heroBottom}><Text style={s.heroTitle}>Your city.{'\n'}Your next move.</Text><Text style={s.heroSub}>A single photo can make a difference.</Text><Pressable accessibilityRole="button" accessibilityLabel="Report road damage" onPress={onCapture} style={({ pressed }) => [s.cta, { opacity: pressed ? 0.8 : 1 }]}><Icon name="camera" size={19} /><Text style={s.ctaText}>Report road damage</Text><View style={{ flex: 1 }} /><Icon name="arrow-right" size={19} /></Pressable></View>
    </View>
    <View style={{ gap: 12 }}><View style={t.between}><Text style={t.label}>{state.settings.mode === 'live' ? 'REPORTING ACTIVITY' : 'YOUR CONTRIBUTION'}</Text><Text style={s.small}>{sample ? 'Sample activity' : 'Every report counts'}</Text></View>
      <View style={[t.row, { gap: 12 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="View all reports" onPress={onReports} style={[s.stat, { flex: 1 }]}><View style={t.between}><Icon name="file-text" color={C.olive} size={19} /><Icon name="arrow-up-right" size={15} color={C.muted} /></View><Text style={s.statValue}>{String(reports.length).padStart(2, '0')}</Text><Text style={s.statLabel}>Reports logged</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="View resolved reports" onPress={onReports} style={[s.stat, { flex: 1, backgroundColor: '#E9EEDC', borderColor: '#E0E6D1' }]}><View style={t.between}><Icon name="check-circle" color={C.olive} size={19} /><Icon name="arrow-up-right" size={15} color={C.olive} /></View><Text style={s.statValue}>{String(resolved).padStart(2, '0')}</Text><Text style={s.statLabel}>Marked resolved</Text></Pressable>
      </View>
    </View>
    <View style={{ gap: 13 }}><View style={t.between}><Text style={t.heading}>On your radar</Text><Pressable accessibilityRole="button" onPress={onExplore} style={[t.row, { gap: 5, paddingVertical: 7 }]}><Text style={s.link}>Explore map</Text><Icon name="arrow-right" size={14} color={C.olive} /></Pressable></View>
      {reports.length ? reports.slice(0, 2).map(r => <ReportCard key={r.id} report={r} onPress={() => onDetail(r)} compact />) : <Pressable onPress={onCapture} style={t.card}><Text style={t.heading}>Start with your street.</Text><Text style={[t.body, { marginTop: 8 }]}>Your first report will appear here.</Text></Pressable>}
    </View>
    <View style={s.tip}><View style={s.tipIcon}><Icon name="shield" size={22} color={C.olive} /></View><View style={{ flex: 1, gap: 4 }}><Text style={s.tipTitle}>A safer shot, every time.</Text><Text style={s.tipBody}>Stop somewhere safe before taking a photo. Never report while driving.</Text></View></View>
    <View style={[t.row, { justifyContent: 'center', gap: 7 }]}><View style={s.footerLine} /><Text style={s.footer}>SMALL ACTIONS. SAFER JOURNEYS.</Text><View style={s.footerLine} /></View>
  </ScrollView>;
}
const s = StyleSheet.create({
  logo: { width: 37, height: 37, borderRadius: 12, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }, brand: { color: C.ink, fontSize: 24, fontWeight: '800', letterSpacing: -1.2 },
  avatar: { width: 43, height: 43, borderRadius: 23, borderWidth: 1, borderColor: '#D5DCCA', backgroundColor: '#E5EBD9', alignItems: 'center', justifyContent: 'center' }, avatarText: { fontSize: 15, color: C.olive, fontWeight: '700' }, online: { position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: C.olive, borderWidth: 2, borderColor: C.bg, bottom: 0, right: 0 },
  location: { fontSize: 11, color: C.olive, fontWeight: '600' }, mode: { fontSize: 8, color: C.muted, marginLeft: 8, letterSpacing: 1 }, greeting: { color: C.ink, fontSize: 32, letterSpacing: -1.5, fontWeight: '800', lineHeight: 38 },
  hero: { height: 318, borderRadius: 23, overflow: 'hidden', justifyContent: 'space-between', backgroundColor: C.dark }, heroShade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(12,23,12,0.40)' }, heroTop: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems: 'center' }, heroPill: { backgroundColor: 'rgba(255,255,255,0.13)', borderColor: 'rgba(255,255,255,0.23)', borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', gap: 7, alignItems: 'center' }, dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.lime }, heroPillText: { color: C.white, fontSize: 8, letterSpacing: 1.1, fontWeight: '700' },
  heroBottom: { padding: 20, gap: 10 }, heroTitle: { color: C.white, fontSize: 31, fontWeight: '700', lineHeight: 34, letterSpacing: -1.2 }, heroSub: { color: '#E0E5D9', fontSize: 11, marginBottom: 6 }, cta: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.lime, padding: 15, borderRadius: 13, gap: 10 }, ctaText: { fontSize: 12, fontWeight: '800', color: C.ink },
  small: { fontSize: 10, color: C.muted }, stat: { padding: 17, borderRadius: 18, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, gap: 8 }, statValue: { fontSize: 36, fontWeight: '700', color: C.ink, letterSpacing: -2, marginTop: 2 }, statLabel: { fontSize: 11, color: '#656C5B' }, link: { color: C.olive, fontSize: 11, fontWeight: '700' },
  tip: { flexDirection: 'row', gap: 13, borderTopWidth: 1, borderColor: C.line, paddingTop: 22 }, tipIcon: { width: 42, height: 45, borderRadius: 12, backgroundColor: C.pale, alignItems: 'center', justifyContent: 'center' }, tipTitle: { fontSize: 12, color: C.ink, fontWeight: '700' }, tipBody: { fontSize: 11, color: C.muted, lineHeight: 17 }, footer: { fontSize: 7, fontWeight: '600', letterSpacing: 1.6, color: '#969D8D' }, footerLine: { height: 1, width: 17, backgroundColor: C.line },
});
