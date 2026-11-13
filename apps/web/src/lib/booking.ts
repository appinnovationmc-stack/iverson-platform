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

export type Booking = {
  id: string;
  reference: string;
  service: Service;
  status: string;
  pickup_address: string;
  destination_address: string | null;
  scheduled_at: string | null;
  created_at: string;
};
