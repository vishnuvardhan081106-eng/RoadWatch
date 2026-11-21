import React from 'react';
import { Image, Linking, Platform, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Button, Icon, IconButton, Note, SeverityBadge } from '../components/ui';
import { C, styles as t } from '../theme';
import { dateLabel, reportLabel } from '../domain';
import type { RoadReport } from '../types';
export default function Detail({ report, onClose, notify }: { report: RoadReport; onClose: () => void; notify: (s: string) => void }) {
  const steps = ['Submitted', 'In review', 'Resolved'];
  const current = steps.indexOf(report.status);
  const openMap = async () => {
    const { latitude, longitude } = report.coordinates;
    const url = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`;
    try { await Linking.openURL(url); } catch { notify('Could not open maps on this device.'); }
  };
  const share = async () => { try { await Share.share({ message: `${report.isSample ? 'SAMPLE REPORT\n' : ''}RoadWatch ${report.id}\n${report.title} · ${report.prediction.severity} severity\n${report.address}\n${report.coordinates.latitude}, ${report.coordinates.longitude}\nStatus: ${report.status}` }); } catch { notify('Sharing is unavailable on this device.'); } };
  return <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={t.page}>
    <View style={t.between}><IconButton name="arrow-left" label="Close report details" onPress={onClose} /><Text style={t.label}>REPORT DETAILS</Text><IconButton name="share-2" label="Share report" onPress={share} /></View>
    <View style={s.photo}>{report.photo ? <Image source={{ uri: report.photo }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : <><Icon name="activity" size={60} color={C.olive} /><Text style={[t.label, { marginTop: 20 }]}>SAMPLE REPORT / NO PHOTO</Text></>}</View>
    <View style={{ gap: 10 }}><View style={t.between}><Text style={{ fontSize: 10, color: C.olive, fontWeight: '600' }}>{reportLabel(report.id)}</Text><SeverityBadge severity={report.prediction.severity} /></View><Text style={t.title}>{report.title}</Text><View style={[t.row, { gap: 7 }]}><Icon name="map-pin" size={14} color={C.olive} /><Text style={[t.body, { flex: 1 }]}>{report.address}</Text></View></View>
    {report.isSample ? <Note>This sample illustrates report tracking. The road condition and repair status have not been verified.</Note> : report.sync !== 'Synced' ? <Note>Saved on this device. {report.sync === 'Pending' ? 'Waiting for backend sync.' : 'Connect a backend in Profile to upload.'} No authority has been notified by this app.</Note> : <Note>Stored on your configured backend. Status updates come from that backend.</Note>}
    <View style={[t.card, { gap: 18 }]}><Text style={t.heading}>Report timeline</Text>{steps.map((step, i) => <View key={step} style={[t.row, { gap: 13 }]}><View style={[s.step, { backgroundColor: i <= current ? C.ink : C.pale }]}>{i < current ? <Icon name="check" size={14} color={C.lime} /> : <Text style={{ color: i <= current ? C.lime : C.muted, fontSize: 10, fontWeight: '700' }}>{String(i + 1).padStart(2, '0')}</Text>}</View><View style={{ flex: 1 }}><Text style={{ fontSize: 13, fontWeight: i === current ? '700' : '500', color: i <= current ? C.ink : C.muted }}>{step}</Text>{i === current && <Text style={{ fontSize: 10, color: C.olive, marginTop: 3 }}>Current status{report.isSample ? ' · sample' : ''}</Text>}</View>{i === current && <View style={s.currentDot} />}</View>)}</View>
    <View style={[t.card, { gap: 15 }]}><Text style={t.heading}>The finer details</Text>{[
      ['Created', dateLabel(report.createdAt)],
      ['Classification', report.prediction.source === 'demo' ? 'Demo result (illustrative)' : report.prediction.source === 'manual' ? 'Manually selected' : 'Backend model'],
      ['Confidence', report.prediction.confidence === undefined ? 'Not provided' : `${Math.round(report.prediction.confidence * 100)}%${report.prediction.source === 'demo' ? ' (sample)' : ''}`],
      ['Coordinates', `${report.coordinates.latitude.toFixed(5)}, ${report.coordinates.longitude.toFixed(5)}`],
      ['Storage', report.sync],
    ].map(([key, value]) => <View key={key} style={t.between}><Text style={{ fontSize: 11, color: C.muted }}>{key}</Text><Text style={{ fontSize: 11, color: C.ink, maxWidth: '67%', textAlign: 'right' }}>{value}</Text></View>)}
      {report.notes ? <View style={{ borderTopWidth: 1, borderColor: C.line, paddingTop: 12, gap: 6 }}><Text style={t.fieldLabel}>Field notes</Text><Text style={t.body}>{report.notes}</Text></View> : null}
    </View>
    <Button title="Open location in maps" icon="navigation" onPress={openMap} secondary />
  </ScrollView>;
}
const s = StyleSheet.create({ photo: { height: 235, borderRadius: 23, overflow: 'hidden', backgroundColor: '#E5EADB', alignItems: 'center', justifyContent: 'center' }, step: { width: 31, height: 31, borderRadius: 16, justifyContent: 'center', alignItems: 'center' }, currentDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.olive } });
