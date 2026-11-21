import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { C, styles as t } from '../theme';
import { dateLabel } from '../domain';
import { Icon, SeverityBadge } from './ui';
import type { RoadReport } from '../types';

export default function ReportCard({ report, onPress, compact }: { report: RoadReport; onPress: () => void; compact?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${report.title} at ${report.address}`} onPress={onPress} style={({ pressed }) => [s.card, compact && { padding: 13 }, { opacity: pressed ? 0.7 : 1 }]}>
    <View style={s.thumb}>{report.photo ? <Image source={{ uri: report.photo }} style={{ width: '100%', height: '100%' }} /> : <><View style={s.road} /><View style={s.roadStripe} /><Icon name={report.prediction.damage === 'Pothole' ? 'alert-triangle' : 'activity'} color={C.olive} size={23} /></>}</View>
    <View style={{ flex: 1, gap: 6 }}>
      <View style={t.between}><Text style={s.name} numberOfLines={1}>{report.title}</Text><Icon name="arrow-up-right" size={16} color={C.muted} /></View>
      <Text style={s.address} numberOfLines={1}>{report.address}</Text>
      <View style={[t.row, { gap: 8, flexWrap: 'wrap' }]}><SeverityBadge severity={report.prediction.severity} /><Text style={s.meta}>{report.isSample ? 'SAMPLE' : dateLabel(report.createdAt)} · {report.status}</Text></View>
    </View>
  </Pressable>;
}
const s = StyleSheet.create({
  card: { flexDirection: 'row', gap: 13, backgroundColor: C.white, borderRadius: 18, borderWidth: 1, borderColor: C.line, padding: 15, alignItems: 'center' },
  thumb: { width: 60, height: 74, borderRadius: 12, backgroundColor: '#E5E8DD', overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  road: { position: 'absolute', width: 27, height: 120, backgroundColor: '#CED4C3', transform: [{ rotate: '28deg' }] }, roadStripe: { position: 'absolute', width: 2, height: 120, backgroundColor: '#F7F8F4', transform: [{ rotate: '28deg' }] },
  name: { fontSize: 14, fontWeight: '700', letterSpacing: -0.3, color: C.ink, flex: 1, paddingRight: 4 }, address: { fontSize: 11, color: C.muted }, meta: { fontSize: 9, color: C.muted, fontWeight: '500' },
});
