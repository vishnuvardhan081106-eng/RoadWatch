import React, { useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { File, Paths } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { useStore } from '../store';
import { withTimeout } from '../async';
import { DAMAGE_TYPES, newId, reportLabel, SEVERITIES, validCoordinates, validateDraft } from '../domain';
import { detectPhoto, uploadReport } from '../api';
import { Button, Chip, Icon, IconButton, Note, SeverityBadge } from '../components/ui';
import { C, styles as t } from '../theme';
import type { RoadReport } from '../types';

export default function Capture({ onClose, onDetail, notify }: { onClose: () => void; onDetail: (r: RoadReport) => void; notify: (s: string) => void }) {
  const { state, update, saveReport, storageError } = useStore();
  const draft = state.draft, demo = state.settings.mode === 'demo';
  const [step, setStep] = useState(draft.prediction ? 2 : 1), [busy, setBusy] = useState(''), [error, setError] = useState('');
  const [latitude, setLatitude] = useState(draft.latitudeText ?? (draft.coordinates ? String(draft.coordinates.latitude) : '')), [longitude, setLongitude] = useState(draft.longitudeText ?? (draft.coordinates ? String(draft.coordinates.longitude) : ''));
  const [result, setResult] = useState<RoadReport>();
  const locked = useRef(false);
  const patch = (values: Partial<typeof draft>) => update(s => ({ ...s, draft: { ...s.draft, ...values } }));
  const fail = (e: unknown) => setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
  async function selectPhoto(camera: boolean) {
    if (locked.current) return;
    locked.current = true; setBusy('photo'); setError('');
    try {
      if (camera && Platform.OS !== 'web') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) throw new Error('Camera access is off. Enable it in device settings, or choose a photo from your gallery.');
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8, allowsEditing: false };
      let selection: ImagePicker.ImagePickerResult;
      if (camera) {
        try {
          selection = await ImagePicker.launchCameraAsync(options);
        } catch {
          selection = await ImagePicker.launchImageLibraryAsync(options);
        }
      } else {
        selection = await ImagePicker.launchImageLibraryAsync(options);
      }
      if (selection.canceled || !selection.assets?.[0]) return;
      const asset = selection.assets[0];
      const image = await manipulateAsync(asset.uri, [{ resize: { width: Math.min(asset.width || 1280, 1280) } }], { compress: 0.65, format: SaveFormat.JPEG, base64: Platform.OS === 'web' });
      let uri = image.uri;
      if (Platform.OS === 'web') uri = `data:image/jpeg;base64,${image.base64}`;
      else { const destination = new File(Paths.document, `${newId()}.jpg`); new File(image.uri).copy(destination); uri = destination.uri; }
      patch({ photo: uri, prediction: undefined });
    } catch (e) { fail(e); } finally { locked.current = false; setBusy(''); }
  }
  async function analyze() {
    if (!draft.photo || locked.current) return;
    locked.current = true; setBusy('analysis'); setError('');
    try {
      const prediction = demo ? { damage: 'Pothole' as const, severity: 'High' as const, confidence: 0.94, source: 'demo' as const } : await detectPhoto(state.settings, draft.photo);
      patch({ prediction }); setStep(2);
    } catch (e) { fail(e); } finally { locked.current = false; setBusy(''); }
  }
  async function locate() {
    if (locked.current) return;
    locked.current = true; setBusy('gps'); setError('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) throw new Error('Location access is off. You can enter the coordinates below instead.');
      const pos = await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High, mayShowUserSettingsDialog: true }), 15000, 'GPS took too long to respond. Try again or enter the coordinates manually.');
      patch({ coordinates: pos.coords, latitudeText: pos.coords.latitude.toFixed(6), longitudeText: pos.coords.longitude.toFixed(6) }); setLatitude(pos.coords.latitude.toFixed(6)); setLongitude(pos.coords.longitude.toFixed(6));
      if (Platform.OS !== 'web' && !draft.address) {
        const [place] = await withTimeout(Location.reverseGeocodeAsync(pos.coords), 5000, 'Coordinates were attached, but the road name could not be found. Enter it below.');
        if (place) patch({ address: [place.street, place.district, place.city].filter(Boolean).join(', ') });
      }
    } catch (e) { fail(e); } finally { locked.current = false; setBusy(''); }
  }
  async function submit() {
    if (locked.current) return;
    const coordinates = validCoordinates(latitude, longitude);
    const finalDraft = { ...draft, coordinates };
    const message = validateDraft(finalDraft);
    if (message) { setError(message); return; }
    if (storageError) { setError('Device storage is unavailable. Resolve the storage warning before saving this report.'); return; }
    locked.current = true; setBusy('save'); setError('');
    const report: RoadReport = { id: newId(), title: draft.prediction!.damage, address: draft.address.trim(), notes: draft.notes.trim(), photo: draft.photo, coordinates: coordinates!, prediction: draft.prediction!, status: 'Submitted', sync: demo ? 'Local' : 'Pending', createdAt: new Date().toISOString(), locationSource: draft.coordinates?.accuracy != null ? 'gps' : 'manual', backendUrl: demo ? undefined : state.settings.apiUrl };
    try { await saveReport(report); }
    catch (e) { fail(e); setBusy(''); locked.current = false; return; }
    setResult(report);
    if (!demo) {
      try {
        const remoteId = await uploadReport(state.settings, report);
        const synced: RoadReport = { ...report, remoteId, sync: 'Synced' };
        update(s => ({ ...s, reports: s.reports.map(r => r.id === report.id ? synced : r) })); setResult(synced);
      } catch (e) { notify(`Saved locally. ${e instanceof Error ? e.message : 'Backend sync failed.'}`); }
    }
    setBusy(''); locked.current = false;
  }
  if (result) return <ScrollView contentContainerStyle={[t.page, { paddingTop: 55, alignItems: 'center', gap: 22 }]}>
    <View style={s.successIcon}><Icon name="check" size={38} color={C.ink} /></View><Text style={t.label}>SMALL ACTION. REAL INTENT.</Text><Text style={[t.title, { textAlign: 'center', fontSize: 34 }]}>You've done{'\n'}your part.</Text><Text style={[t.body, { textAlign: 'center' }]}>{result.sync === 'Synced' ? 'Your report has reached the configured backend.' : 'Your report is saved on this device.'}</Text><View style={[t.card, { width: '100%', gap: 13 }]}><View style={t.between}><Text style={t.heading}>{result.title}</Text><SeverityBadge severity={result.prediction.severity} /></View><Text style={t.body}>{result.address}</Text><Text style={{ fontSize: 11, color: C.olive }}>{reportLabel(result.id)}</Text></View>
    <View style={{ width: '100%' }}><Note>{busy ? 'Uploading to your backend…' : result.sync === 'Synced' ? 'Refresh your journal to retrieve status changes from the backend.' : demo ? 'Demo mode: this report has not been sent to an authority. You can connect a backend in Profile.' : 'Waiting for backend sync. Retry from your report journal.'}</Note></View>
    <Button title="View my report" icon="file-text" disabled={!!busy} onPress={() => onDetail(result)} style={{ width: '100%' }} /><Button title="Back to home" secondary disabled={!!busy} onPress={onClose} style={{ width: '100%' }} />
  </ScrollView>;
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView pointerEvents={busy ? 'none' : 'auto'} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={t.page}>
    <View style={t.between}><IconButton name={step === 1 ? 'x' : 'arrow-left'} label={step === 1 ? 'Close and keep draft' : 'Previous step'} onPress={() => { if (busy) return; step === 1 ? onClose() : setStep(step - 1); setError(''); }} /><Text style={t.label}>NEW FIELD REPORT</Text><Text style={{ fontSize: 11, color: C.muted }}>0{step} / 03</Text></View>
    <View style={[t.row, { gap: 6 }]}>{[1, 2, 3].map(i => <View key={i} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i <= step ? C.olive : C.line }} />)}</View>
    <View style={{ gap: 8 }}><Text style={t.label}>{step === 1 ? 'MODULE 01 / DAMAGE DETECTION' : step === 2 ? 'CHECK THE DETAILS' : 'MODULE 02 / GPS REPORTING'}</Text><Text style={t.title}>{step === 1 ? 'See it. Snap it.' : step === 2 ? 'A closer look.' : 'Put it on the map.'}</Text><Text style={t.body}>{step === 1 ? 'A clear photo is the first step toward a better road.' : step === 2 ? 'Review the classification. You can change any detail.' : 'Add the location so the damage can be found.'}</Text></View>
    {!!error && <Note danger>{error}</Note>}
    {step === 1 && <>
      <View style={s.photo}>{draft.photo ? <Image source={{ uri: draft.photo }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : <><View style={s.scanCornerTL} /><View style={s.scanCornerBR} /><View style={s.cameraCircle}><Icon name="camera" size={35} color={C.olive} /></View><Text style={s.photoTitle}>Give the road a voice.</Text><Text style={s.photoBody}>Keep the damage in frame, with good light.</Text></>}</View>
      <View style={[t.row, { gap: 10 }]}><Button title={draft.photo ? 'Retake' : 'Take photo'} icon="camera" busy={busy === 'photo'} disabled={!!busy} onPress={() => selectPhoto(true)} style={{ flex: 1 }} /><Button title="Gallery" icon="image" secondary disabled={!!busy} onPress={() => selectPhoto(false)} style={{ flex: 1 }} /></View>
      <Note>{demo ? 'Demo analysis shows an illustrative result. It does not analyze image pixels. Connect a trained model in Profile for real detection.' : 'Your selected photo will be uploaded to the detection endpoint you configured.'}</Note>
      {draft.photo && <><Button title={demo ? 'Try demo analysis' : 'Analyze road damage'} icon="zap" busy={busy === 'analysis'} disabled={!!busy} onPress={analyze} /><Button title="Classify manually" secondary disabled={!!busy} onPress={() => { patch({ prediction: { damage: 'Pothole', severity: 'Medium', source: 'manual' } }); setStep(2); setError(''); }} /></>}
      <View style={[t.row, { gap: 10, justifyContent: 'center' }]}><Icon name="shield" size={15} color={C.olive} /><Text style={{ fontSize: 11, color: C.muted }}>Stop safely before taking a photo.</Text></View>
    </>}
    {step === 2 && draft.prediction && <>
      <View style={[s.photo, { height: 205 }]}><Image source={{ uri: draft.photo }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /><View style={s.predictionTag}><Icon name={draft.prediction.source === 'model' ? 'cpu' : 'edit-3'} size={14} color={C.lime} /><Text style={{ fontSize: 10, color: C.white, fontWeight: '600' }}>{draft.prediction.source === 'demo' ? 'ILLUSTRATIVE DEMO RESULT' : draft.prediction.source === 'model' ? 'BACKEND MODEL RESULT' : 'MANUAL CLASSIFICATION'}</Text></View></View>
      {draft.prediction.confidence !== undefined && <View style={[t.card, { gap: 10 }]}><View style={t.between}><Text style={t.fieldLabel}>{draft.prediction.source === 'demo' ? 'Sample confidence' : 'Model confidence'}</Text><Text style={t.heading}>{Math.round(draft.prediction.confidence * 100)}%</Text></View><View style={{ height: 5, backgroundColor: C.pale, borderRadius: 4 }}><View style={{ height: 5, backgroundColor: C.olive, width: `${Math.round(draft.prediction.confidence * 100)}%`, borderRadius: 4 }} /></View></View>}
      <View style={{ gap: 10 }}><Text style={t.fieldLabel}>Damage type</Text><View style={[t.row, { flexWrap: 'wrap', gap: 8 }]}>{DAMAGE_TYPES.map(damage => <Chip key={damage} title={damage} selected={draft.prediction!.damage === damage} onPress={() => patch({ prediction: { ...draft.prediction!, damage, confidence: undefined, source: 'manual', detections: undefined } })} />)}</View></View>
      <View style={{ gap: 10 }}><Text style={t.fieldLabel}>Severity</Text><View style={[t.row, { gap: 8 }]}>{SEVERITIES.map(severity => <Chip key={severity} title={severity} selected={draft.prediction!.severity === severity} onPress={() => patch({ prediction: { ...draft.prediction!, severity, confidence: undefined, source: 'manual' } })} />)}</View></View>
      {draft.prediction.reason ? (
        <View style={[t.card, { backgroundColor: '#F0F4E8', borderColor: '#DCE4CF', gap: 6 }]}>
          <View style={[t.row, { gap: 6 }]}>
            <Icon name="check-circle" size={14} color={C.olive} />
            <Text style={{ fontSize: 11, fontWeight: '700', color: C.ink, letterSpacing: 0.5 }}>WHY AI CHOSE THIS</Text>
          </View>
          <Text style={{ fontSize: 12, color: '#2B3322', lineHeight: 18, fontWeight: '500' }}>
            {draft.prediction.reason}
          </Text>
        </View>
      ) : null}
      <Note>Classification supports reporting. It does not measure pothole depth or certify road safety.</Note><Button title="Continue to location" icon="arrow-right" onPress={() => { if (!draft.notes.trim() && draft.prediction?.reason) patch({ notes: draft.prediction.reason }); setStep(3); setError(''); }} />
    </>}
    {step === 3 && <>
      <View style={[t.card, { gap: 15 }]}>
        <View style={t.row}><View style={s.gpsIcon}><Icon name="crosshair" size={24} color={C.olive} /></View><View style={{ flex: 1, gap: 5 }}><Text style={{ fontSize: 14, color: C.ink, fontWeight: '700' }}>Pinpoint the damage</Text><Text style={{ fontSize: 11, color: C.muted }}>{draft.coordinates ? 'Coordinates attached' : 'Use GPS or enter coordinates below'}</Text></View></View>
        <View style={[t.row, { gap: 10 }]}>
          <Button title={draft.coordinates ? 'Update GPS' : 'Current GPS'} icon="navigation" busy={busy === 'gps'} disabled={!!busy} onPress={locate} secondary style={{ flex: 1 }} />
          <Button title="Demo GPS" icon="map-pin" secondary disabled={!!busy} onPress={() => {
            const demoCoords = { latitude: 13.026568, longitude: 80.015277 };
            patch({ coordinates: demoCoords, latitudeText: '13.026568', longitudeText: '80.015277', address: draft.address || 'Near the main road' });
            setLatitude('13.026568'); setLongitude('80.015277');
          }} style={{ flex: 1 }} />
        </View>
        {draft.coordinates?.accuracy != null && <Text style={{ fontSize: 10, color: C.olive }}>Reported GPS accuracy: ±{Math.round(draft.coordinates.accuracy)} m. Confirm the position before submitting.</Text>}
      </View>
      <View style={[t.row, { gap: 10 }]}><View style={{ flex: 1 }}><Text style={t.fieldLabel}>Latitude</Text><TextInput accessibilityLabel="Latitude" value={latitude} onChangeText={text => { setLatitude(text); patch({ latitudeText: text, coordinates: validCoordinates(text, longitude) }); }} keyboardType="numbers-and-punctuation" placeholder="14.442600" placeholderTextColor={C.muted} style={t.input} /></View><View style={{ flex: 1 }}><Text style={t.fieldLabel}>Longitude</Text><TextInput accessibilityLabel="Longitude" value={longitude} onChangeText={text => { setLongitude(text); patch({ longitudeText: text, coordinates: validCoordinates(latitude, text) }); }} keyboardType="numbers-and-punctuation" placeholder="79.986500" placeholderTextColor={C.muted} style={t.input} /></View></View>
      <View><Text style={t.fieldLabel}>Road name or landmark *</Text><TextInput accessibilityLabel="Road name or landmark" value={draft.address} onChangeText={address => patch({ address })} placeholder="e.g. Near the bus stand, GT Road" placeholderTextColor={C.muted} style={t.input} maxLength={200} /></View>
      <View><Text style={t.fieldLabel}>Field notes (optional)</Text><TextInput accessibilityLabel="Field notes" value={draft.notes} onChangeText={notes => patch({ notes })} placeholder="Anything else someone should know?" placeholderTextColor={C.muted} style={[t.input, { minHeight: 105, textAlignVertical: 'top' }]} multiline maxLength={1000} /></View>
      <Note>{demo ? 'This report stays on your device in demo mode.' : 'Your photo, GPS coordinates, and notes will be sent to your configured backend.'}</Note>
      <Button title={demo ? 'Save road report' : 'Submit road report'} icon="arrow-up-right" busy={busy === 'save'} disabled={!!busy || !!storageError} onPress={submit} />
    </>}
    <Text style={{ fontSize: 9, textAlign: 'center', color: C.muted }}>Your draft is kept when you close this screen.</Text>
  </ScrollView></KeyboardAvoidingView>;
}
const s = StyleSheet.create({
  photo: { height: 285, borderRadius: 23, overflow: 'hidden', backgroundColor: '#E9EDE1', alignItems: 'center', justifyContent: 'center' }, cameraCircle: { width: 80, height: 80, borderRadius: 28, backgroundColor: '#DDE5CF', alignItems: 'center', justifyContent: 'center', marginBottom: 22 }, photoTitle: { fontSize: 18, color: C.ink, fontWeight: '700', letterSpacing: -0.4 }, photoBody: { fontSize: 11, color: C.muted, marginTop: 8 }, scanCornerTL: { position: 'absolute', top: 23, left: 23, width: 27, height: 27, borderLeftWidth: 2, borderTopWidth: 2, borderColor: '#A9B496', borderTopLeftRadius: 9 }, scanCornerBR: { position: 'absolute', bottom: 23, right: 23, width: 27, height: 27, borderRightWidth: 2, borderBottomWidth: 2, borderColor: '#A9B496', borderBottomRightRadius: 9 }, predictionTag: { position: 'absolute', bottom: 15, left: 15, right: 15, backgroundColor: C.ink, padding: 12, borderRadius: 10, flexDirection: 'row', gap: 8, alignItems: 'center' }, gpsIcon: { width: 50, height: 50, borderRadius: 15, backgroundColor: C.pale, alignItems: 'center', justifyContent: 'center', marginRight: 12 }, successIcon: { width: 100, height: 100, borderRadius: 50, backgroundColor: C.lime, marginTop: 15, alignItems: 'center', justifyContent: 'center' },
});
