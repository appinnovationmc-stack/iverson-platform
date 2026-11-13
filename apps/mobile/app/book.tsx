import { useEffect, useState } from 'react';
import {
  ScrollView,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  View,
  Switch,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { SERVICES, money, type Service, type SupplyItem } from '../lib/booking';
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
  const [items, setItems] = useState<SupplyItem[]>([]);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [reg, setReg] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [runs, setRuns] = useState(true);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
  }, []);

  useEffect(() => {
    if (service !== 'supplies' || signedIn !== true) return;
    supabase
      .from('supply_items')
      .select('id, sku, name, price')
      .eq('active', true)
      .order('name')
      .then(({ data }) => setItems((data as SupplyItem[] | null) ?? []));
  }, [service, signedIn]);

  const dateOk = date === '' || /^\d{4}-\d{2}-\d{2}$/.test(date);

  async function submit() {
    setBusy(true);
    setError(null);
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        service,
        pickup_address: pickup.trim(),
        destination_address: destination.trim() || null,
        scheduled_at: date ? new Date(`${date}T08:00:00`).toISOString() : null,
        notes: notes.trim() || null,
      })
      .select('id')
      .single();
    if (bookingError || !booking) {
      setError(bookingError?.message ?? 'Could not create your booking');
      setBusy(false);
      return;
    }

    let followUpError: string | null = null;
    if (service === 'supplies') {
      const lines = Object.entries(qty)
        .filter(([, n]) => n > 0)
        .map(([item_id, quantity]) => ({ booking_id: booking.id, item_id, quantity }));
      if (lines.length) {
        const { error } = await supabase.from('booking_supply_items').insert(lines);
        followUpError = error?.message ?? null;
      }
    } else if (service === 'towing') {
      const { error } = await supabase.from('towing_details').insert({
        booking_id: booking.id,
        registration: reg.trim(),
        vehicle_make: make.trim() || null,
        vehicle_model: model.trim() || null,
        vehicle_runs: runs,
      });
      followUpError = error?.message ?? null;
    }

    if (followUpError) {
      await supabase.rpc('cancel_booking', { p_booking_id: booking.id });
      setError(`${followUpError}. Your request was not sent, please try again.`);
      setBusy(false);
      return;
    }
    setBusy(false);
    router.replace('/bookings');
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

  const canSubmit =
    !busy &&
    signedIn === true &&
    pickup.trim().length > 0 &&
    dateOk &&
    (service !== 'towing' || reg.trim().length >= 2);

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

      {service === 'supplies' && (
        <View style={[ui.card, { marginTop: 20, marginBottom: 0 }]}>
          <Text style={{ color: c.text, fontWeight: '700', marginBottom: 12 }}>
            What do you need?
          </Text>
          {items.length === 0 ? (
            <Text style={{ color: c.muted }}>
              The supplies catalogue is not available yet. Describe what you need in the notes.
            </Text>
          ) : (
            items.map((it) => {
              const n = qty[it.id] ?? 0;
              return (
                <View
                  key={it.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 12,
                  }}
                >
                  <Text style={{ color: c.text, flex: 1 }}>
                    {it.name} <Text style={{ color: c.muted }}>{money(it.price)}</Text>
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                    <Pressable
                      accessibilityLabel={`Fewer ${it.name}`}
                      onPress={() => setQty({ ...qty, [it.id]: Math.max(0, n - 1) })}
                    >
                      <Text style={[ui.link, { fontSize: 22 }]}>−</Text>
                    </Pressable>
                    <Text style={{ color: c.text, minWidth: 20, textAlign: 'center' }}>{n}</Text>
                    <Pressable
                      accessibilityLabel={`More ${it.name}`}
                      onPress={() => setQty({ ...qty, [it.id]: Math.min(1000, n + 1) })}
                    >
                      <Text style={[ui.link, { fontSize: 22 }]}>+</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })
          )}
        </View>
      )}

      {service === 'towing' && (
        <View style={[ui.card, { marginTop: 20, marginBottom: 0 }]}>
          <Text style={{ color: c.text, fontWeight: '700' }}>Your vehicle</Text>
          <Text style={ui.label}>Registration</Text>
          <TextInput
            style={ui.input}
            value={reg}
            onChangeText={setReg}
            autoCapitalize="characters"
            placeholderTextColor={c.muted}
          />
          <Text style={ui.label}>Make</Text>
          <TextInput
            style={ui.input}
            value={make}
            onChangeText={setMake}
            placeholderTextColor={c.muted}
          />
          <Text style={ui.label}>Model</Text>
          <TextInput
            style={ui.input}
            value={model}
            onChangeText={setModel}
            placeholderTextColor={c.muted}
          />
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 18,
            }}
          >
            <Text style={{ color: c.text }}>The vehicle starts and rolls</Text>
            <Switch value={runs} onValueChange={setRuns} trackColor={{ true: c.accent }} />
          </View>
        </View>
      )}

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
        placeholder="Home size, stairs, anything we should know…"
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
