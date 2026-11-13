import { useState } from 'react';
import { ScrollView, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { c, ui } from '../lib/theme';

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    setNotice(null);
    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) setError(error.message);
      else router.replace('/bookings');
    } else {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: fullName.trim() } },
      });
      if (error) setError(error.message);
      else if (data.session) router.replace('/bookings');
      else setNotice('Check your email to confirm your account, then sign in.');
    }
    setBusy(false);
  }

  const canSubmit = !busy && email.includes('@') && password.length >= 8 && (mode === 'signin' || fullName.trim().length > 0);

  return (
    <ScrollView style={ui.page} contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
      <Pressable onPress={() => router.back()}>
        <Text style={ui.link}>← Back</Text>
      </Pressable>
      <Text style={[ui.h1, { marginTop: 28 }]}>{mode === 'signin' ? 'Welcome back' : 'Create your account'}</Text>
      {mode === 'signup' && (
        <>
          <Text style={ui.label}>Full name</Text>
          <TextInput style={ui.input} value={fullName} onChangeText={setFullName} autoComplete="name" placeholderTextColor={c.muted} />
        </>
      )}
      <Text style={ui.label}>Email</Text>
      <TextInput style={ui.input} value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" placeholderTextColor={c.muted} />
      <Text style={ui.label}>Password (8+ characters)</Text>
      <TextInput style={ui.input} value={password} onChangeText={setPassword} secureTextEntry autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} placeholderTextColor={c.muted} />
      {error && <Text style={ui.error}>{error}</Text>}
      {notice && <Text style={[ui.copy, { color: c.accent }]}>{notice}</Text>}
      <Pressable style={[ui.cta, !canSubmit && { opacity: 0.5 }]} disabled={!canSubmit} onPress={submit}>
        {busy ? <ActivityIndicator color={c.accentText} /> : <Text style={ui.ctaText}>{mode === 'signin' ? 'Sign in' : 'Create account'}</Text>}
      </Pressable>
      <Pressable style={{ marginTop: 24 }} onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
        <Text style={ui.link}>{mode === 'signin' ? 'New to Iverson? Create an account' : 'Already have an account? Sign in'}</Text>
      </Pressable>
    </ScrollView>
  );
}
