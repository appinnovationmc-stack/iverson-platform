import { useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, Pressable, ActivityIndicator, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { SERVICES, type Service } from '../lib/booking';
import { c, ui } from '../lib/theme';

export default function Book() {
  const router = useRouter();
  const params = useLocalSearchParams<{ service?: string }>();
  const initial = SERVICES.find((s) => s.value === params.service)?.value ?? 'moving';
  const [service, setService] = useState<Service>(initial);
  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
  }, []);

  const dateOk = date === '' || /^\d{4}-\d{2}-\d{2}$/.test(date);

  async function submit() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.from('bookings').insert({
      service,
      pickup_address: pickup.trim(),
      destination_address: destination.trim() || null,
      scheduled_at: date ? new Date(`${date}T08:00:00`).toISOString() : null,
      notes: notes.trim() || null,
    });
    setBusy(false);
    if (error) setError(error.message);
    else router.replace('/bookings');
  }

  if (signedIn === false) {
    return (
      <ScrollView style={ui.page} contentContainerStyle={ui.content}>
        <Pressable onPress={() => router.back()}>
          <Text style={ui.link}>← Back</Text>
        </Pressable>
        <Text style={[ui.h1, { marginTop: 28 }]}>Sign in to book</Text>
        <Text style={ui.copy}>
          We need an account to send you your quote and track your booking.
        </Text>
        <Pressable style={ui.cta} onPress={() => router.push('/login')}>
          <Text style={ui.ctaText}>Sign in or create account</Text>
        </Pressable>
      </ScrollView>
    );
  }

  const canSubmit = !busy && signedIn === true && pickup.trim().length > 0 && dateOk;

  return (
    <ScrollView
      style={ui.page}
      contentContainerStyle={ui.content}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable onPress={() => router.back()}>
        <Text style={ui.link}>← Back</Text>
      </Pressable>
      <Text style={[ui.h1, { marginTop: 28 }]}>What can we help you with?</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 20 }}>
        {SERVICES.map((s) => {
          const on = s.value === service;
          return (
            <Pressable
              key={s.value}
              onPress={() => setService(s.value)}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 16,
                borderRadius: 24,
                borderWidth: 1,
                borderColor: on ? c.accent : c.border,
                backgroundColor: on ? c.accent : c.card,
              }}
            >
              <Text style={{ color: on ? c.accentText : c.text, fontWeight: '700' }}>
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={ui.label}>{service === 'towing' ? 'Vehicle is at' : 'Pick-up address'}</Text>
      <TextInput
        style={ui.input}
        value={pickup}
        onChangeText={setPickup}
        placeholder="Street, suburb, city"
        placeholderTextColor={c.muted}
      />
      <Text style={ui.label}>
        {service === 'supplies' ? 'Delivery address' : 'Drop-off address'}
      </Text>
      <TextInput
        style={ui.input}
        value={destination}
        onChangeText={setDestination}
        placeholder="Street, suburb, city"
        placeholderTextColor={c.muted}
      />
      <Text style={ui.label}>Preferred date (YYYY-MM-DD)</Text>
      <TextInput
        style={ui.input}
        value={date}
        onChangeText={setDate}
        placeholder="2026-12-01"
        keyboardType="numbers-and-punctuation"
        placeholderTextColor={c.muted}
      />
      {!dateOk && <Text style={ui.error}>Use the format YYYY-MM-DD.</Text>}
      <Text style={ui.label}>Notes</Text>
      <TextInput
        style={[ui.input, { minHeight: 90, textAlignVertical: 'top' }]}
        value={notes}
        onChangeText={setNotes}
        multiline
        placeholder="Home size, stairs, vehicle make and model…"
        placeholderTextColor={c.muted}
      />
      {error && <Text style={ui.error}>{error}</Text>}
      <Pressable
        style={[ui.cta, !canSubmit && { opacity: 0.5 }]}
        disabled={!canSubmit}
        onPress={submit}
      >
        {busy ? (
          <ActivityIndicator color={c.accentText} />
        ) : (
          <Text style={ui.ctaText}>Request a quote</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}
