import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { c } from '../lib/theme';

export default function Layout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }} />
    </>
  );
}
