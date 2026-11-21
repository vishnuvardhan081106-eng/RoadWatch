import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable, Platform } from 'react-native';
import AreaMap from '../components/AreaMap';
import ReportCard from '../components/ReportCard';
import { Chip, Icon, IconButton, Note } from '../components/ui';
import { C, styles as t } from '../theme';
import { DEFAULT_CENTER, distanceKm } from '../domain';
import { useStore } from '../store';
import type { Coordinates, RoadReport } from '../types';
export default function Explore({ onDetail, onLocate, location, locating }: { onDetail: (r: RoadReport) => void; onLocate: () => void; location?: Coordinates; locating: boolean }) {
  const { state } = useStore();
  const [filter, setFilter] = useState('All'), [selected, setSelected] = useState<RoadReport>();
  const reports = useMemo(() => state.reports.filter(r => (state.settings.mode === 'demo' || !r.isSample) && (filter === 'All' || r.prediction.severity === filter)).sort((a, b) => location ? distanceKm(location, a.coordinates) - distanceKm(location, b.coordinates) : 0), [state.reports, state.settings.mode, filter, location]);
  const active = reports.find(r => r.id === selected?.id);
  const center = active?.coordinates ?? location ?? reports[0]?.coordinates ?? DEFAULT_CENTER;
  return <ScrollView contentContainerStyle={t.page} showsVerticalScrollIndicator={false}>
    <View style={{ gap: 8 }}><Text style={t.label}>MODULE 02 / GPS REPORTING</Text><Text style={t.title}>Know your roads.</Text><Text style={t.body}>A clearer picture of the roads around you.</Text></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{['All', 'High', 'Medium', 'Low'].map(f => <Chip key={f} title={f === 'All' ? 'All reports' : `${f} severity`} selected={filter === f} onPress={() => setFilter(f)} />)}</ScrollView>
    <View style={s.map}><AreaMap reports={reports} center={center} selected={active?.id} onSelect={setSelected} /><View style={s.mapLabel}><View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.olive }} /><Text style={s.mapLabelText}>{reports.length} REPORTS {state.settings.mode === 'demo' ? '· SAMPLE DATA' : ''}</Text></View><View style={s.locate}><IconButton name={locating ? 'loader' : 'crosshair'} label="Use my location" onPress={() => { setSelected(undefined); onLocate(); }} /></View></View>
    {state.settings.mode === 'demo' && <Note>These are sample locations in Nellore. They do not represent verified road conditions.</Note>}
    <View style={{ gap: 12 }}><View style={t.between}><Text style={t.heading}>{location ? 'Nearest to you' : 'Mapped reports'}</Text><Text style={s.count}>{reports.length} locations</Text></View>
      {Platform.OS === 'web' && <Text style={{ fontSize: 11, lineHeight: 17, color: C.muted }}>Tap a location pin beside a report to center the map.</Text>}
      {reports.map(r => <View key={r.id} style={{ gap: 6 }}><ReportCard report={r} onPress={() => onDetail(r)} /><Pressable accessibilityRole="button" accessibilityLabel={`Locate ${r.address}`} onPress={() => setSelected(r)} style={[t.row, { gap: 5, alignSelf: 'flex-end', padding: 5 }]}><Icon name="map-pin" size={12} color={C.olive} /><Text style={{ fontSize: 10, color: C.olive }}>{location ? `${distanceKm(location, r.coordinates).toFixed(1)} km · ` : ''}{active?.id === r.id ? 'Centered on map' : 'Show on map'}</Text></Pressable></View>)}
      {!reports.length && <View style={t.card}><Icon name="map" size={32} color={C.olive} /><Text style={[t.heading, { marginTop: 15 }]}>A clean slate.</Text><Text style={[t.body, { marginTop: 6 }]}>No reports match this filter. Add a report or try another severity.</Text></View>}
    </View>
  </ScrollView>;
}
const s = StyleSheet.create({ map: { height: 365, borderRadius: 23, overflow: 'hidden', backgroundColor: '#E4E9DA', borderWidth: 1, borderColor: C.line }, mapLabel: { position: 'absolute', top: 15, left: 15, borderRadius: 10, padding: 10, backgroundColor: C.white, flexDirection: 'row', gap: 6, alignItems: 'center' }, mapLabelText: { fontSize: 8, color: C.olive, fontWeight: '700', letterSpacing: 0.7 }, locate: { position: 'absolute', right: 15, bottom: 29 }, count: { fontSize: 11, color: C.muted } });
