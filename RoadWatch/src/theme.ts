import { StyleSheet } from 'react-native';
export const C = { bg: '#F6F7F2', ink: '#20271F', muted: '#7A8076', line: '#E3E6DD', lime: '#D4F45B', olive: '#536139', white: '#FFFFFF', red: '#B74529', orange: '#9E651E', pale: '#EEF1E7', dark: '#273123' };
export const styles = StyleSheet.create({
  page: { paddingHorizontal: 24, paddingTop: 18, paddingBottom: 26, gap: 23 },
  row: { flexDirection: 'row', alignItems: 'center' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 31, fontWeight: '800', color: C.ink, letterSpacing: -1.3, lineHeight: 37 },
  heading: { fontSize: 20, fontWeight: '700', color: C.ink, letterSpacing: -0.6 },
  body: { fontSize: 14, color: C.muted, lineHeight: 21 },
  label: { fontSize: 10, color: C.olive, letterSpacing: 1.8, fontWeight: '700' },
  card: { backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 22, padding: 18 },
  input: { borderWidth: 1, borderColor: C.line, borderRadius: 14, backgroundColor: C.white, color: C.ink, padding: 15, fontSize: 14, minHeight: 50 },
  fieldLabel: { color: C.ink, fontSize: 12, fontWeight: '600', marginBottom: 8 },
});
