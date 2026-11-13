import './globals.css';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Iverson | Moving made simple', description: 'Book moves, supplies and vehicle towing with Iverson.' };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}</body></html>; }
