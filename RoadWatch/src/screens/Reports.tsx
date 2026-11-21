import React, { useState } from 'react';
import { RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { useStore } from '../store';
import { C, styles as t } from '../theme';
import { filterReports } from '../domain';
import { Chip, Icon, IconButton, Note } from '../components/ui';
import ReportCard from '../components/ReportCard';
import type { RoadReport } from '../types';
export default function Reports({ onDetail, notify }: { onDetail: (r: RoadReport) => void; notify: (s: string) => void }) {
  const { state, sync, syncing } = useStore();
  const [query, setQuery] = useState(''), [status, setStatus] = useState('All');
  const visible = state.reports.filter(r => state.settings.mode === 'demo' || !r.isSample);
  const reports = filterReports(visible, query, status);
  const refresh = async () => { try { notify(await sync()); } catch (e) { notify(e instanceof Error ? e.message : 'Could not sync reports.'); } };
  return <ScrollView contentContainerStyle={t.page} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={syncing} onRefresh={refresh} tintColor={C.olive} />}>
    <View style={t.between}><View style={{ gap: 7 }}><Text style={t.label}>YOUR REPORT JOURNAL</Text><Text style={t.title}>Every detail counts.</Text></View><IconButton name="refresh-cw" label="Refresh reports" onPress={refresh} /></View>
    <Text style={t.body}>Follow each report from the first photo to the final update.</Text>
    <View style={[t.row, { backgroundColor: C.white, borderRadius: 15, borderWidth: 1, borderColor: C.line, paddingHorizontal: 15, gap: 10 }]}><Icon name="search" size={17} color={C.muted} /><TextInput accessibilityLabel="Search reports" placeholder="Search by road, damage, or ID" placeholderTextColor={C.muted} value={query} onChangeText={setQuery} style={{ flex: 1, minHeight: 50, color: C.ink, fontSize: 12 }} /></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{['All', 'Submitted', 'In review', 'Resolved'].map(s => <Chip key={s} title={s} selected={status === s} onPress={() => setStatus(s)} />)}</ScrollView>
    {state.settings.mode === 'demo' && <Note>Demo mode includes sample reports. New reports are saved on your device; no authority is notified.</Note>}
    <View style={{ gap: 12 }}><Text style={t.label}>{reports.length} REPORT{reports.length === 1 ? '' : 'S'}</Text>{reports.map(r => <ReportCard key={r.id} report={r} onPress={() => onDetail(r)} />)}
      {!reports.length && <View style={[t.card, { alignItems: 'center', paddingVertical: 35, gap: 14 }]}><Icon name="inbox" size={35} color={C.olive} /><Text style={t.heading}>Nothing here yet.</Text><Text style={[t.body, { textAlign: 'center' }]}>Try another search or start a new report with the camera button below.</Text></View>}
    </View>
  </ScrollView>;
}
