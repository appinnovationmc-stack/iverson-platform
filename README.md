# Iverson Platform

A monorepo foundation for Iverson's moving and logistics platform.

## Apps
- `apps/web`: Next.js customer web app and operations dashboard foundation.
- `apps/mobile`: Expo / React Native mobile app foundation.
- `supabase/migrations`: database schema with row-level security.

## Stack
- Next.js + TypeScript + Tailwind (web)
- Expo + React Native + TypeScript (mobile)
- Supabase Auth, Postgres, Realtime, Storage (backend)

## Start
Install Node.js LTS and pnpm, then run `pnpm install`. Copy the `.env.example` files to the local env files, add your Supabase URL and publishable key, then run `pnpm dev:web` or `pnpm dev:mobile`.
Never put a Supabase service-role key in either client app.

## Current scope
This is the clean project foundation and first usable UI shell. Live payments, driver GPS, push notifications, SMS OTP delivery, and production booking workflows require provider credentials and further implementation.
