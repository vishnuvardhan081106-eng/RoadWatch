import React, { useState } from 'react';
import { Linking, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useStore } from '../store';
import { endpoint, checkConnection } from '../api';
import { C, styles as t } from '../theme';
import { Button, Icon, Note } from '../components/ui';
import type { Settings } from '../types';
export default function Profile({ notify }: { notify: (s: string) => void }) {
  const { state, update, syncing, sync } = useStore();
  const [settings, setSettings] = useState<Settings>(state.settings), [error, setError] = useState('');
  const [checking, setChecking] = useState(false), [connection, setConnection] = useState('');
  const patch = (p: Partial<Settings>) => setSettings(s => ({ ...s, ...p }));
  const pending = state.reports.filter(r => !r.isSample && r.sync !== 'Synced').length;
  function save() {
    try {
      if (!settings.name.trim()) throw new Error('Enter a display name.');
      if (settings.mode === 'live') { endpoint(settings, settings.detectPath); endpoint(settings, settings.reportsPath); }
      update(s => ({ ...s, settings: { ...settings, name: settings.name.trim() } }));
      setError(''); notify('Preferences saved.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Check your settings.'); }
  }
  async function runSync() { try { notify(await sync()); } catch (e) { notify(e instanceof Error ? e.message : 'Could not sync reports.'); } }
  async function testConnection() {
    setChecking(true); setError(''); setConnection('');
    try {
      const status = await checkConnection(settings);
      setConnection(status.detector_configured ? 'Backend connected. Reporting is ready and model weights are configured.' : 'Backend connected. Reporting is ready. No trained model is configured; choose manual classification when creating a report.');
    } catch (e) { setError(e instanceof Error ? e.message : 'The backend could not be reached.'); }
    finally { setChecking(false); }
  }
  return <ScrollView contentContainerStyle={t.page} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
    <View style={{ gap: 8 }}><Text style={t.label}>MAKE IT YOURS</Text><Text style={t.title}>A good road citizen.</Text><Text style={t.body}>Your space, your preferences, your impact.</Text></View>
    <View style={[t.card, t.row, { gap: 17 }]}><View style={{ width: 65, height: 65, borderRadius: 33, backgroundColor: C.lime, justifyContent: 'center', alignItems: 'center' }}><Text style={{ fontSize: 25, fontWeight: '700', color: C.ink }}>{state.settings.name.slice(0, 1).toUpperCase()}</Text></View><View style={{ flex: 1, gap: 5 }}><Text style={t.heading}>{state.settings.name}</Text><Text style={{ fontSize: 11, color: C.muted }}>Community reporter · On this device</Text></View><Icon name="feather" color={C.olive} /></View>
    <View><Text style={t.fieldLabel}>Display name</Text><TextInput accessibilityLabel="Display name" value={settings.name} onChangeText={name => patch({ name })} style={t.input} maxLength={40} /></View>
    <View style={[t.card, { gap: 18 }]}><View style={t.between}><View style={{ flex: 1, gap: 6, paddingRight: 15 }}><Text style={t.heading}>Backend mode</Text><Text style={{ fontSize: 11, lineHeight: 17, color: C.muted }}>Upload reports and use your trained detection model.</Text></View><Switch accessibilityLabel="Backend mode" value={settings.mode === 'live'} onValueChange={live => patch({ mode: live ? 'live' : 'demo' })} trackColor={{ true: '#65764A', false: '#DDE2D4' }} thumbColor={C.white} /></View><Note>{settings.mode === 'demo' ? 'Demo mode uses local storage and illustrative results. No image analysis or authority notification happens.' : 'Photo uploads start only when you tap Analyze, Submit, or Sync. Backend settings take effect after saving.'}</Note></View>
    {settings.mode === 'live' && <View style={{ gap: 17 }}>
      <Text style={t.label}>YOUR BACKEND CONNECTION</Text>
      <View><Text style={t.fieldLabel}>Backend URL</Text><TextInput accessibilityLabel="Backend URL" placeholder="http://172.25.111.246:8000" placeholderTextColor={C.muted} value={settings.apiUrl} onChangeText={apiUrl => patch({ apiUrl })} style={t.input} autoCapitalize="none" autoCorrect={false} keyboardType="url" /></View>
      <Text style={{ fontSize: 11, lineHeight: 17, color: C.muted }}>On a mobile phone, connect to the same Wi-Fi and use http://172.25.111.246:8000.</Text>
      {([['detectPath', 'Detection endpoint'], ['reportsPath', 'Reports endpoint'], ['imageField', 'Image upload field']] as const).map(([key, label]) => <View key={key}><Text style={t.fieldLabel}>{label}</Text><TextInput accessibilityLabel={label} value={settings[key]} onChangeText={value => patch({ [key]: value })} style={t.input} autoCapitalize="none" autoCorrect={false} /></View>)}
      <Note>Your backend must accept the image and report fields described in the included API contract. Match the endpoint and upload field names to your server.</Note>
    </View>}
    {!!error && <Note danger>{error}</Note>}{!!connection && <Note>{connection}</Note>}<Button title="Save preferences" icon="check" onPress={save} />
    {settings.mode === 'live' && <Button title="Test backend connection" icon="wifi" secondary busy={checking} onPress={testConnection} />}
    <View style={[t.card, { gap: 14 }]}><View style={t.between}><Text style={t.heading}>Ready to sync</Text><Text style={{ fontSize: 19, fontWeight: '700', color: C.olive }}>{pending.toString().padStart(2, '0')}</Text></View><Text style={t.body}>Real reports saved on this device and waiting for an upload.</Text><Button title="Sync & refresh reports" secondary icon="refresh-cw" busy={syncing} onPress={runSync} /></View>
    <View style={{ gap: 14 }}><Text style={t.label}>TWO MODULES. ONE PURPOSE.</Text><View style={[t.row, { gap: 12 }]}><Icon name="camera" color={C.olive} /><View style={{ flex: 1 }}><Text style={{ color: C.ink, fontWeight: '700', fontSize: 12 }}>01 · Road damage detection</Text><Text style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>Capture, classify, and review the damage.</Text></View></View><View style={[t.row, { gap: 12 }]}><Icon name="map-pin" color={C.olive} /><View style={{ flex: 1 }}><Text style={{ color: C.ink, fontWeight: '700', fontSize: 12 }}>02 · GPS reporting & tracking</Text><Text style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>Locate, submit, and follow every report.</Text></View></View></View>
    <View style={{ borderTopWidth: 1, borderColor: C.line, paddingTop: 20, gap: 8 }}><Text style={{ fontSize: 12, color: C.ink, fontWeight: '700' }}>A note on your data</Text><Text style={{ fontSize: 11, color: C.muted, lineHeight: 18 }}>Photos, drafts, and reports are stored locally. Backend mode sends selected report data to the server you configure. This frontend does not include user authentication; use sample data for classroom demonstrations until your backend access controls are connected.</Text></View>
    <Text style={{ textAlign: 'center', fontSize: 10, color: C.muted, letterSpacing: 1 }}>ROADWATCH / MOBILE COMPUTING / v1.0</Text>
  </ScrollView>;
}
