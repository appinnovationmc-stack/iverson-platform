export type Service = 'moving' | 'supplies' | 'towing';

export const SERVICES: { value: Service; label: string }[] = [
  { value: 'moving', label: 'Moving' },
  { value: 'supplies', label: 'Moving supplies' },
  { value: 'towing', label: 'Car towing' },
];

export const STATUS_LABEL: Record<string, string> = {
  requested: 'Quote requested',
  quoted: 'Quoted',
  confirmed: 'Confirmed',
  assigned: 'Driver assigned',
  in_progress: 'In transit',
  packed: 'Packed',
  loaded: 'Loaded',
  out_for_delivery: 'Out for delivery',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const CANCELLABLE = ['requested', 'quoted', 'confirmed'];

export type Quote = {
  id: string;
  amount: number;
  currency: string;
  status: 'sent' | 'accepted' | 'declined' | 'expired';
  valid_until: string;
  notes: string | null;
  created_at: string;
};

export type Booking = {
  id: string;
  reference: string;
  service: Service;
  status: string;
  pickup_address: string;
  destination_address: string | null;
  scheduled_at: string | null;
  created_at: string;
  final_price: number | null;
  quotes: Quote[];
};

export type SupplyItem = { id: string; sku: string; name: string; price: number };

export const BOOKING_COLUMNS =
  'id, reference, service, status, pickup_address, destination_address, scheduled_at, created_at, final_price, quotes(id, amount, currency, status, valid_until, notes, created_at)';

export function money(amount: number, currency = 'ZAR'): string {
  const n = Number(amount).toFixed(2);
  return currency === 'ZAR' ? `R ${n}` : `${currency} ${n}`;
}

/** The quote a customer can act on right now, if any. */
export function openQuote(b: Booking, now = Date.now()): Quote | undefined {
  if (b.status !== 'quoted') return undefined;
  return [...b.quotes]
    .sort((a, c) => c.created_at.localeCompare(a.created_at))
    .find((q) => q.status === 'sent' && new Date(q.valid_until).getTime() > now);
}
