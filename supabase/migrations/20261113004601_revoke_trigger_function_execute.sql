revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.log_booking_status() from public, anon, authenticated;
comment on table public.staff_roles is 'Managed only by the service role. RLS enabled with no client policies on purpose.';
