import { useEffect, useState } from 'react';
import { ScrollView, Text, View, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { c, ui } from '../lib/theme';

const services = [
  { icon: '↗', title: 'Move home', desc: 'Plan your next move', service: 'moving' },
  { icon: '▣', title: 'Moving supplies', desc: 'Boxes and packing essentials', service: 'supplies' },
  { icon: '⌁', title: 'Car towing', desc: 'Get help with your vehicle', service: 'towing' },
] as const;

export default function Home() {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setSignedIn(!!session));
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <ScrollView style={ui.page} contentContainerStyle={ui.content}>
      <View style={s.top}>
        <Text style={s.brand}>
          IVERSON<Text style={{ color: c.accent }}>.</Text>
        </Text>
        {signedIn ? (
          <Pressable onPress={() => router.push('/bookings')}>
            <Text style={ui.link}>My bookings</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => router.push('/login')}>
            <Text style={ui.link}>Sign in</Text>
          </Pressable>
        )}
      </View>
      <Text style={s.eyebrow}>MOVING, WITHOUT THE MAYHEM</Text>
      <Text style={s.hero}>
        Your next move starts <Text style={{ color: c.accent }}>here.</Text>
      </Text>
      <Text style={ui.copy}>Book a move, arrange a tow or get the supplies you need.</Text>
      <Pressable style={[ui.cta, { alignSelf: 'flex-start' }]} onPress={() => router.push('/book')}>
        <Text style={ui.ctaText}>Start a booking →</Text>
      </Pressable>
      <Text style={s.section}>What do you need?</Text>
      {services.map((x) => (
        <Pressable
          key={x.title}
          style={ui.card}
          onPress={() => router.push({ pathname: '/book', params: { service: x.service } })}
        >
          <Text style={s.icon}>{x.icon}</Text>
          <Text style={s.title}>{x.title}</Text>
          <Text style={ui.copy}>{x.desc}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 58 },
  brand: { color: 'white', fontSize: 21, fontWeight: '900', letterSpacing: 5 },
  eyebrow: { color: c.accent, fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  hero: { color: 'white', fontSize: 43, fontWeight: '700', lineHeight: 48, marginTop: 14 },
  section: { color: 'white', fontSize: 24, fontWeight: '700', marginTop: 55, marginBottom: 18 },
  icon: { color: c.accent, fontSize: 27 },
  title: { color: 'white', fontSize: 18, fontWeight: '700', marginTop: 15 },
});
