import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View, Pressable, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import {
  BOOKING_COLUMNS,
  CANCELLABLE,
  SERVICES,
  STATUS_LABEL,
  money,
  openQuote,
  type Booking,
} from '../lib/booking';
import { c, ui } from '../lib/theme';

export default function Bookings() {
  const router = useRouter();
  const [rows, setRows] = useState<Booking[] | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data: session } = await supabase.auth.getSession();
    setSignedIn(!!session.session);
    if (!session.session) return;
    const { data, error } = await supabase
      .from('bookings')
      .select(BOOKING_COLUMNS)
      .order('created_at', { ascending: false });
    if (error) setError(error.message);
    else {
      setError(null);
      setRows(data as Booking[]);
    }
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('my-bookings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  async function accept(quoteId: string) {
    setError(null);
    const { error } = await supabase.rpc('accept_quote', { p_quote_id: quoteId });
    if (error) setError(error.message);
    else load();
  }

  async function cancel(id: string) {
    setError(null);
    const { error } = await supabase.rpc('cancel_booking', { p_booking_id: id });
    if (error) setError(error.message);
    else load();
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace('/');
  }

  return (
    <ScrollView
      style={ui.page}
      contentContainerStyle={ui.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={c.accent}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Pressable onPress={() => router.replace('/')}>
          <Text style={ui.link}>← Home</Text>
        </Pressable>
        {signedIn && (
          <Pressable onPress={signOut}>
            <Text style={[ui.link, { color: c.muted }]}>Sign out</Text>
          </Pressable>
        )}
      </View>
      <Text style={[ui.h1, { marginTop: 28, marginBottom: 20 }]}>My bookings</Text>
      {signedIn === false && (
        <Pressable style={ui.cta} onPress={() => router.push('/login')}>
          <Text style={ui.ctaText}>Sign in to see your bookings</Text>
        </Pressable>
      )}
      {error && <Text style={ui.error}>{error}</Text>}
      {rows && rows.length === 0 && (
        <Pressable style={ui.cta} onPress={() => router.push('/book')}>
          <Text style={ui.ctaText}>No bookings yet. Request a quote</Text>
        </Pressable>
      )}
      {rows?.map((b) => (
        <View key={b.id} style={ui.card}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
            }}
          >
            <View>
              <Text style={{ color: c.muted, fontSize: 12, fontWeight: '700' }}>{b.reference}</Text>
              <Text style={{ color: c.text, fontSize: 18, fontWeight: '700', marginTop: 4 }}>
                {SERVICES.find((s) => s.value === b.service)?.label}
              </Text>
            </View>
            <Text style={{ color: c.accent, fontSize: 12, fontWeight: '800' }}>
              {STATUS_LABEL[b.status] ?? b.status}
            </Text>
          </View>
          <Text style={ui.copy}>
            {b.pickup_address}
            {b.destination_address ? ` → ${b.destination_address}` : ''}
          </Text>
          {(() => {
            const q = openQuote(b);
            if (q) {
              return (
                <View
                  style={{ marginTop: 14, backgroundColor: c.bg, borderRadius: 14, padding: 14 }}
                >
                  <Text style={{ color: c.text, fontWeight: '700' }}>
                    Quote: {money(q.amount, q.currency)}
                  </Text>
                  <Text style={{ color: c.muted, fontSize: 12, marginTop: 4 }}>
                    Valid until {new Date(q.valid_until).toLocaleDateString('en-ZA')}
                  </Text>
                  {q.notes ? <Text style={{ color: c.text, marginTop: 8 }}>{q.notes}</Text> : null}
                  <Pressable
                    style={[ui.cta, { marginTop: 12, padding: 12 }]}
                    onPress={() => accept(q.id)}
                  >
                    <Text style={ui.ctaText}>Accept quote</Text>
                  </Pressable>
                </View>
              );
            }
            if (b.final_price != null) {
              return (
                <Text style={{ color: c.text, fontWeight: '700', marginTop: 14 }}>
                  Agreed price: {money(b.final_price)}
                </Text>
              );
            }
            return null;
          })()}
          {CANCELLABLE.includes(b.status) && (
            <Pressable style={{ marginTop: 14 }} onPress={() => cancel(b.id)}>
              <Text style={[ui.link, { color: c.danger }]}>Cancel booking</Text>
            </Pressable>
          )}
        </View>
      ))}
    </ScrollView>
  );
}
