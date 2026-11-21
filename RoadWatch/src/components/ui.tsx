import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { C } from '../theme';
import type { Severity } from '../types';
type IconName = React.ComponentProps<typeof Feather>['name'];
export function Icon({ name, size = 20, color = C.ink }: { name: IconName; size?: number; color?: string }) { return <Feather name={name} size={size} color={color} />; }
export function Button({ title, onPress, icon, secondary, busy, disabled, style }: { title: string; onPress: () => void; icon?: IconName; secondary?: boolean; busy?: boolean; disabled?: boolean; style?: ViewStyle }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} disabled={disabled || busy} onPress={onPress} style={({ pressed }) => [u.button, secondary && u.secondary, { opacity: disabled || busy ? 0.5 : pressed ? 0.75 : 1 }, style]}>
    {busy ? <ActivityIndicator color={C.ink} /> : icon ? <Icon name={icon} size={18} /> : null}<Text style={u.buttonText}>{title}</Text>
  </Pressable>;
}
export function IconButton({ name, onPress, label, dark }: { name: IconName; onPress: () => void; label: string; dark?: boolean }) {
  return <Pressable accessibilityLabel={label} accessibilityRole="button" onPress={onPress} style={[u.iconButton, dark && { backgroundColor: C.dark, borderColor: C.dark }]}><Icon name={name} color={dark ? C.white : C.ink} /></Pressable>;
}
export function Chip({ title, selected, onPress }: { title: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[u.chip, selected && u.activeChip]}><Text style={[u.chipText, selected && { color: C.white }]}>{title}</Text></Pressable>;
}
export function SeverityBadge({ severity }: { severity: Severity }) {
  const color = severity === 'High' ? C.red : severity === 'Medium' ? C.orange : C.olive;
  return <View style={[u.badge, { backgroundColor: severity === 'High' ? '#FBECE5' : severity === 'Medium' ? '#FFF4DC' : C.pale }]}><View style={{ width: 5, height: 5, borderRadius: 5, backgroundColor: color }} /><Text style={{ fontSize: 10, fontWeight: '700', color }}>{severity.toUpperCase()}</Text></View>;
}
export function Note({ children, danger }: { children: React.ReactNode; danger?: boolean }) { return <View style={[u.note, danger && { backgroundColor: '#FBECE5' }]}><Icon name={danger ? 'alert-circle' : 'info'} size={16} color={danger ? C.red : C.olive} /><Text style={{ fontSize: 12, color: danger ? C.red : C.olive, lineHeight: 18, flex: 1 }}>{children}</Text></View>; }
const u = StyleSheet.create({
  button: { backgroundColor: C.lime, borderRadius: 15, minHeight: 54, padding: 16, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
  secondary: { backgroundColor: C.white, borderWidth: 1, borderColor: C.line }, buttonText: { color: C.ink, fontWeight: '700', fontSize: 14 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 24, borderWidth: 1, borderColor: C.line, backgroundColor: C.white },
  chip: { paddingHorizontal: 17, paddingVertical: 10, borderRadius: 24, borderWidth: 1, borderColor: C.line, backgroundColor: C.white }, activeChip: { backgroundColor: C.ink, borderColor: C.ink }, chipText: { fontSize: 12, fontWeight: '600', color: C.muted },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 5 },
  note: { backgroundColor: C.pale, padding: 13, borderRadius: 12, flexDirection: 'row', gap: 9, alignItems: 'flex-start' },
});
