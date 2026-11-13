import { StyleSheet } from 'react-native';

export const c = {
  bg: '#090b12',
  card: '#121722',
  border: '#252d3b',
  accent: '#d8ff62',
  accentText: '#10140a',
  text: 'white',
  muted: '#929daf',
  danger: '#ff7a7a',
};

export const ui = StyleSheet.create({
  page: { flex: 1, backgroundColor: c.bg },
  content: { padding: 24, paddingTop: 64, paddingBottom: 48 },
  h1: { color: c.text, fontSize: 32, fontWeight: '700', lineHeight: 38 },
  copy: { color: c.muted, fontSize: 15, lineHeight: 24, marginTop: 12 },
  label: { color: c.text, fontSize: 13, fontWeight: '700', marginTop: 20, marginBottom: 8 },
  input: {
    backgroundColor: c.card,
    borderColor: c.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 15,
    color: c.text,
    fontSize: 16,
  },
  cta: { backgroundColor: c.accent, padding: 17, borderRadius: 30, alignItems: 'center', marginTop: 28 },
  ctaText: { color: c.accentText, fontWeight: '800', fontSize: 15 },
  link: { color: c.accent, fontWeight: '700', fontSize: 14 },
  error: { color: c.danger, fontSize: 14, fontWeight: '600', marginTop: 16 },
  card: { backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: 22, padding: 20, marginBottom: 13 },
});
