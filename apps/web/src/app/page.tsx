import Link from 'next/link';

const services = [
  { title: 'Moving', copy: 'Local or long-distance, house to house, office to office.', href: '/book?service=moving' },
  { title: 'Moving supplies', copy: 'Boxes, tape and packing essentials delivered to your door.', href: '/book?service=supplies' },
  { title: 'Car towing', copy: 'Vehicle transport by our expert team, day or night.', href: '/book?service=towing' },
];

export default function Home() {
  return (
    <main>
      <section className="bg-navy text-white">
        <div className="mx-auto max-w-6xl px-6 pb-20 pt-10 md:pb-28">
          <p className="text-xs font-bold tracking-[.28em] text-brand-soft">MOVING, SORTED</p>
          <h1 className="mt-4 max-w-3xl text-5xl font-extrabold leading-[1.05] md:text-7xl">
            Moves, supplies and towing in one place.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-white/80">
            Local and long distance, home or business. Book, pack and follow your load live.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/book" className="rounded-full bg-brand px-7 py-3 font-bold">Book a service</Link>
            <Link href="/bookings" className="rounded-full border border-white/30 px-7 py-3 font-semibold">Track a booking</Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-3xl font-extrabold">What do you need?</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {services.map((s) => (
            <article key={s.title} className="rounded-3xl bg-white p-7 shadow-[0_8px_22px_rgba(23,32,107,0.08)]">
              <h3 className="text-xl font-bold">{s.title}</h3>
              <p className="mt-3 leading-7 text-muted">{s.copy}</p>
              <Link href={s.href} className="mt-6 inline-block text-sm font-bold text-brand">Get started →</Link>
            </article>
          ))}
        </div>
      </section>

      <footer className="mx-auto max-w-6xl border-t border-navy/10 px-6 py-8 text-sm text-muted">
        © {new Date().getFullYear()} Iverson Holdings &amp; Logistics
      </footer>
    </main>
  );
}
