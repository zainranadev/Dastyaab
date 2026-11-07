'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button, Card, LinkButton, Strata } from '@/components/ui';
import { api, pkr } from '@/lib/api';
import type { Category } from '@/lib/types';

interface TradeDetail {
  slug: string;
  name: string;
  icon: string;
  avgResponse: string;
  commonIssues: { title: string; costEstimate: string; urgency: string }[];
}

const TRADE_DETAILS: Record<string, TradeDetail> = {
  electrical: {
    slug: 'electrical',
    name: 'Electrical',
    icon: '⚡',
    avgResponse: '12 mins',
    commonIssues: [
      { title: 'Main breaker tripping or burning smell', costEstimate: 'Rs 1,500 - 3,500', urgency: 'Emergency' },
      { title: 'Ceiling fan / chandelier installation', costEstimate: 'Rs 1,000 - 2,000', urgency: 'Today' },
      { title: 'UPS / Inverter wiring troubleshooting', costEstimate: 'Rs 2,500 - 6,000', urgency: 'This Week' },
    ],
  },
  plumbing: {
    slug: 'plumbing',
    name: 'Plumbing',
    icon: '💧',
    avgResponse: '15 mins',
    commonIssues: [
      { title: 'Concealed pipe leaking or damp ceiling', costEstimate: 'Rs 2,000 - 5,000', urgency: 'Emergency' },
      { title: 'Water motor / pump capacitor replacement', costEstimate: 'Rs 1,500 - 3,500', urgency: 'Today' },
      { title: 'Mixer tap & washroom sanitary fittings', costEstimate: 'Rs 1,200 - 3,000', urgency: 'This Week' },
    ],
  },
  construction: {
    slug: 'construction',
    name: 'Construction',
    icon: '🧱',
    avgResponse: '30 mins',
    commonIssues: [
      { title: 'Boundary wall brickwork and plaster repair', costEstimate: 'Rs 8,000 - 25,000', urgency: 'This Week' },
      { title: 'Roof water-proofing and tile grouting', costEstimate: 'Rs 12,000 - 45,000', urgency: 'Flexible' },
      { title: 'Floor tile replacement and concrete patches', costEstimate: 'Rs 5,000 - 15,000', urgency: 'Flexible' },
    ],
  },
  carpentry: {
    slug: 'carpentry',
    name: 'Carpentry',
    icon: '🪚',
    avgResponse: '20 mins',
    commonIssues: [
      { title: 'Door lock replacement & hinge re-alignment', costEstimate: 'Rs 1,000 - 2,500', urgency: 'Today' },
      { title: 'Wardrobe drawer tracks & hydraulic hinges', costEstimate: 'Rs 1,500 - 4,000', urgency: 'This Week' },
      { title: 'Custom wooden shelving & repair', costEstimate: 'Rs 3,500 - 10,000', urgency: 'Flexible' },
    ],
  },
  painting: {
    slug: 'painting',
    name: 'Painting',
    icon: '🎨',
    avgResponse: '25 mins',
    commonIssues: [
      { title: 'Single bedroom repainting with primer', costEstimate: 'Rs 7,000 - 16,000', urgency: 'This Week' },
      { title: 'Exterior weather-sheet coating', costEstimate: 'Rs 15,000 - 50,000', urgency: 'Flexible' },
      { title: 'Dampness treatment & wall putty smoothing', costEstimate: 'Rs 4,000 - 10,000', urgency: 'This Week' },
    ],
  },
  'ac-appliance': {
    slug: 'ac-appliance',
    name: 'AC & Appliances',
    icon: '❄️',
    avgResponse: '10 mins',
    commonIssues: [
      { title: 'Inverter AC gas refill & chemical master service', costEstimate: 'Rs 3,500 - 7,500', urgency: 'Today' },
      { title: 'Refrigerator compressor check & thermostat repair', costEstimate: 'Rs 2,000 - 6,000', urgency: 'Emergency' },
      { title: 'Automatic washing machine spinning fault', costEstimate: 'Rs 2,500 - 5,000', urgency: 'Today' },
    ],
  },
};

const FAQS = [
  {
    q: 'How does SortItOut verify contractors?',
    a: 'Every contractor must submit their trade history, primary city, and verifiable contact credentials. Platform administrators personally review each application before granting VERIFIED status. Only verified contractors are permitted to view problems and send quotes.',
  },
  {
    q: 'Do I have to pay anything online or upfront?',
    a: 'No. SortItOut is built around local realities: payment is strictly cash on completion. You only pay after the contractor completes the job and you inspect the work.',
  },
  {
    q: 'How quickly do contractors respond with quotes?',
    a: 'Most problems receive their first quote within 10 to 25 minutes from verified pros working in your neighborhood. You can receive up to 10 competing quotes to compare price, duration, and worker ratings.',
  },
  {
    q: 'What if a contractor does not show up?',
    a: 'Contractors are tracked by their completion and reliability scores. Any cancellation counts against their record on the platform. You also have real-time live chat and booking tracking to coordinate arrival.',
  },
  {
    q: 'Can contractors see my phone number before I hire them?',
    a: 'No. To protect your privacy and prevent unwanted calls, phone numbers remain completely hidden during bidding. Direct contact information is only unlocked after you explicitly choose and accept a quote.',
  },
];

export default function Home() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedTrade, setSelectedTrade] = useState<string>('electrical');
  const [activeFaq, setActiveFaq] = useState<number | null>(0);
  const [roleTab, setRoleTab] = useState<'customer' | 'contractor'>('customer');

  useEffect(() => {
    api<Category[]>('/categories', { auth: false })
      .then((r) => {
        if (r.data.length) setCategories(r.data);
      })
      .catch(() => undefined);
  }, []);

  const currentTrade = TRADE_DETAILS[selectedTrade] || TRADE_DETAILS.electrical;

  return (
    <div className="space-y-24">
      {/* HERO SECTION */}
      <section className="relative -mx-5 overflow-hidden px-5 pb-8 pt-8 sm:pt-14">
        {/* Subtle decorative glow */}
        <div className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-96 w-96 -translate-x-1/2 rounded-full bg-clay-400/10 blur-3xl" />

        <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
          {/* Hero Copy */}
          <div className="lg:col-span-7">
            <div className="settle inline-flex items-center gap-2 rounded-full border border-sand-300 bg-sand-100/80 px-3.5 py-1 text-xs font-medium text-clay-800 shadow-sm backdrop-blur-sm">
              <span className="h-2 w-2 rounded-full bg-sage-600 animate-pulse" />
              <span>Verified local technicians & builders</span>
            </div>

            <h1 className="settle settle-2 mt-5 font-serif text-5xl leading-[1.08] text-clay-900 sm:text-6xl md:text-7xl">
              Describe the problem. <br />
              <span className="text-clay-600 italic">Get it fixed right.</span>
            </h1>

            <p className="settle settle-3 mt-6 max-w-xl text-lg text-clay-800 leading-relaxed">
              A leaking pipe, a tripping breaker, or a wall to be built. Post what is wrong in 2 minutes. Receive comparable quotes from vetted local pros, track the job, and pay cash only when you’re satisfied.
            </p>

            <div className="settle settle-4 mt-8 flex flex-wrap items-center gap-4">
              <LinkButton href="/register" className="!px-6 !py-3 text-base shadow-lift font-semibold">
                Post a Problem (Free)
              </LinkButton>
              <LinkButton href="/register?role=CONTRACTOR" variant="quiet" className="!px-6 !py-3 text-base font-semibold">
                I Do The Work (Join as Pro)
              </LinkButton>
            </div>

            {/* Micro-trust indicators */}
            <div className="settle settle-4 mt-9 flex flex-wrap items-center gap-6 text-xs text-clay-700">
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 text-sage-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span>Admin-verified pros</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 text-sage-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span>Cash on completion</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 text-sage-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span>Zero hidden fees</span>
              </div>
            </div>
          </div>

          {/* Interactive Live Workflow Simulator Card */}
          <div className="lg:col-span-5">
            <div className="animate-float relative rounded-[1.8rem_0.9rem_1.8rem_0.9rem] border border-sand-300 bg-sand-50/95 p-5 shadow-lift backdrop-blur-md">
              <div className="flex items-center justify-between pb-3 border-b border-sand-200">
                <div className="flex items-center gap-2">
                  <span className="flex h-3 w-3 rounded-full bg-rust-700 animate-ping" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-clay-700">Live Problem Feed</span>
                </div>
                <span className="rounded-full bg-ochre-100 px-2 py-0.5 text-[11px] font-bold text-ochre-800">EMERGENCY</span>
              </div>

              {/* Sample Problem Post */}
              <div className="mt-3.5 space-y-2">
                <h3 className="text-lg font-serif font-bold text-clay-950">
                  Main circuit breaker sparks when AC turns on
                </h3>
                <p className="text-xs text-clay-700">
                  ⚡ Electrical · Gulberg III, Lahore · Posted 14m ago
                </p>
                <div className="rounded-xl bg-sand-100 p-2.5 text-xs text-clay-800">
                  &ldquo;Smelled burning wires near the distribution board. AC trips main switch immediately. Need someone urgently with testing tools.&rdquo;
                </div>
              </div>

              {/* Live Incoming Quotes */}
              <div className="mt-4 space-y-2.5">
                <div className="text-[11px] font-bold text-clay-700 uppercase tracking-wider">
                  Quotes Arriving (3 of 10):
                </div>

                {/* Quote 1 */}
                <div className="rounded-xl border border-sand-300 bg-sand-50 p-3 shadow-sm transition-all hover:border-clay-400">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-clay-900">Tariq Mehmood</span>
                        <span className="rounded bg-sage-100 px-1 py-0.2 text-[10px] font-bold text-sage-600">VERIFIED</span>
                      </div>
                      <p className="text-[11px] text-clay-600">★ 4.9 (42 reviews) · 12 yrs exp · 2.1 km away</p>
                    </div>
                    <span className="font-serif text-base font-bold text-clay-900">Rs 2,000</span>
                  </div>
                  <p className="mt-1 text-xs text-clay-700 italic">
                    &ldquo;Can arrive in 25 mins with digital multimeter and 32A breaker replacement.&rdquo;
                  </p>
                </div>

                {/* Quote 2 */}
                <div className="rounded-xl border border-sand-300/60 bg-sand-100/70 p-3 shadow-sm opacity-90">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-clay-900">Zahid Ali & Team</span>
                        <span className="rounded bg-sage-100 px-1 py-0.2 text-[10px] font-bold text-sage-600">VERIFIED</span>
                      </div>
                      <p className="text-[11px] text-clay-600">★ 4.8 (29 reviews) · 8 yrs exp</p>
                    </div>
                    <span className="font-serif text-base font-bold text-clay-900">Rs 2,500</span>
                  </div>
                  <p className="mt-1 text-xs text-clay-700 italic">
                    &ldquo;Full board diagnostic included. Will rewire the burnt junction box safely.&rdquo;
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-sand-200 flex items-center justify-between">
                <span className="text-xs text-clay-600">Customer picks the best offer</span>
                <span className="text-xs font-semibold text-clay-800 underline">Compare quotes →</span>
              </div>
            </div>
          </div>
        </div>

        <Strata className="mt-16 h-32 w-full sm:h-44 opacity-80" />
      </section>

      {/* HOW IT WORKS: 4-STAGE INTERACTIVE WORKFLOW */}
      <section className="space-y-10">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <span className="text-xs font-bold uppercase tracking-widest text-clay-600">Transparent & Accountable</span>
          <h2 className="font-serif text-3xl sm:text-4xl text-clay-900">How SortItOut works for you</h2>
          <p className="text-sm text-clay-700">
            From the minute something breaks to the moment it’s fixed, every step is clear, trackable, and built on trust.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              step: '01',
              title: 'Snap & Post',
              desc: 'Describe what needs fixing, snap up to 5 photos, and set your urgency (Emergency, Today, Flexible). Takes under 2 minutes.',
              badge: 'Fast & Simple',
              icon: (
                <svg className="h-6 w-6 text-clay-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              ),
            },
            {
              step: '02',
              title: 'Compare Quotes',
              desc: 'Verified workers in your area send honest prices, estimated hours, and notes. No unsolicited phone calls.',
              badge: 'Up to 10 bids',
              icon: (
                <svg className="h-6 w-6 text-clay-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              ),
            },
            {
              step: '03',
              title: 'Track & Live Chat',
              desc: 'Accept your favorite quote to unlock contact info. Track job stages: On the way → In progress → Work done, with real-time chat.',
              badge: 'Live Status',
              icon: (
                <svg className="h-6 w-6 text-clay-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              ),
            },
            {
              step: '04',
              title: 'Pay Cash & Review',
              desc: 'Inspect the completed work. Pay cash on the spot, confirm completion, and leave a verified review to help neighbors.',
              badge: '100% Protected',
              icon: (
                <svg className="h-6 w-6 text-clay-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              ),
            },
          ].map((item) => (
            <Card key={item.step} className="relative transition-all duration-300 hover:shadow-lift hover:-translate-y-1">
              <div className="flex items-center justify-between pb-3 border-b border-sand-200">
                <span className="font-serif text-2xl font-bold text-clay-400">{item.step}</span>
                <span className="rounded-full bg-sand-200 px-2 py-0.5 text-[10px] font-bold text-clay-800">
                  {item.badge}
                </span>
              </div>
              <div className="mt-4 flex h-10 w-10 items-center justify-center rounded-xl bg-sand-200/80">
                {item.icon}
              </div>
              <h3 className="mt-3 text-lg font-bold text-clay-900">{item.title}</h3>
              <p className="mt-2 text-xs text-clay-700 leading-relaxed">{item.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* INTERACTIVE TRADES & COST EXPLORER */}
      <section className="space-y-8 rounded-[2rem_1rem_2rem_1rem] border border-sand-300 bg-sand-100/60 p-6 sm:p-10 shadow-earth">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-clay-600">Instant Price & Issue Guide</span>
            <h2 className="mt-1 font-serif text-3xl text-clay-900">Explore trades & everyday fixes</h2>
            <p className="mt-1 text-sm text-clay-700">Select your problem category to see common issues and typical price ranges.</p>
          </div>
          <LinkButton href="/register" className="self-start md:self-auto text-xs !py-2 !px-4">
            Post an Issue in Any Trade
          </LinkButton>
        </div>

        {/* Trade Selector Pills */}
        <div className="flex flex-wrap gap-2">
          {Object.entries(TRADE_DETAILS).map(([key, t]) => (
            <button
              key={key}
              onClick={() => setSelectedTrade(key)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                selectedTrade === key
                  ? 'bg-clay-600 text-sand-50 shadow-earth scale-105'
                  : 'bg-sand-50 text-clay-800 border border-sand-300 hover:bg-sand-200'
              }`}
            >
              <span>{t.icon}</span>
              <span>{t.name}</span>
            </button>
          ))}
        </div>

        {/* Selected Trade Card */}
        <div className="grid gap-4 sm:grid-cols-3">
          {currentTrade.commonIssues.map((issue, idx) => (
            <Card key={idx} className="flex flex-col justify-between bg-sand-50 transition-all hover:border-clay-400">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-clay-600">{currentTrade.name}</span>
                  <span className="rounded bg-ochre-100 px-2 py-0.5 text-[10px] font-bold text-ochre-800">
                    {issue.urgency}
                  </span>
                </div>
                <h4 className="text-base font-semibold text-clay-900 leading-snug">{issue.title}</h4>
              </div>

              <div className="mt-4 pt-3 border-t border-sand-200 flex items-center justify-between">
                <div>
                  <span className="block text-[10px] text-clay-600">Typical estimate</span>
                  <span className="font-serif text-sm font-bold text-clay-900">{issue.costEstimate}</span>
                </div>
                <Link
                  href={`/register?category=${currentTrade.slug}`}
                  className="rounded-lg bg-sand-200 px-2.5 py-1 text-xs font-semibold text-clay-800 hover:bg-clay-600 hover:text-sand-50 transition-colors"
                >
                  Fix this →
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* COMPARISON: OLD WAY VS SORTITOUT */}
      <section className="space-y-8">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-clay-600">Why Switch?</span>
          <h2 className="font-serif text-3xl sm:text-4xl text-clay-900">The Old Way vs. SortItOut</h2>
          <p className="text-sm text-clay-700">
            Stop relying on Facebook groups or asking neighbors for workers who never show up.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Old Way */}
          <div className="rounded-[1.6rem_0.8rem_1.6rem_0.8rem] border border-rust-700/20 bg-rust-100/30 p-6 space-y-4">
            <div className="flex items-center gap-2 text-rust-700">
              <span className="text-lg">❌</span>
              <h3 className="font-serif text-xl font-bold">The Old Unregulated Way</h3>
            </div>
            <ul className="space-y-3 text-sm text-clay-800">
              <li className="flex items-start gap-2.5">
                <span className="text-rust-700 font-bold shrink-0">✕</span>
                <span>Unvetted strangers in your home with no identity verification.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-rust-700 font-bold shrink-0">✕</span>
                <span>Random fluctuating prices and haggling on the spot.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-rust-700 font-bold shrink-0">✕</span>
                <span>Workers disappear midway through the job or no-show completely.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-rust-700 font-bold shrink-0">✕</span>
                <span>Your phone number gets circulated to random contractors without consent.</span>
              </li>
            </ul>
          </div>

          {/* SortItOut Way */}
          <div className="rounded-[1.6rem_0.8rem_1.6rem_0.8rem] border border-sage-600/30 bg-sage-100/40 p-6 space-y-4 shadow-earth">
            <div className="flex items-center gap-2 text-sage-600">
              <span className="text-lg">✅</span>
              <h3 className="font-serif text-xl font-bold text-clay-950">The SortItOut Way</h3>
            </div>
            <ul className="space-y-3 text-sm text-clay-900">
              <li className="flex items-start gap-2.5">
                <span className="text-sage-600 font-bold shrink-0">✓</span>
                <span><strong>Admin-verified identity</strong> and trade verification for every worker.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-sage-600 font-bold shrink-0">✓</span>
                <span><strong>Upfront competitive quotes</strong> with clear prices in PKR and labor duration.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-sage-600 font-bold shrink-0">✓</span>
                <span><strong>Step-by-step job tracking</strong> and live booking chat right on the platform.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-sage-600 font-bold shrink-0">✓</span>
                <span><strong>Phone numbers stay hidden</strong> until you personally accept the quote.</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* DUAL PERSPECTIVE: HOMEOWNERS VS TRADESPEOPLE */}
      <section className="space-y-6">
        <div className="flex items-center justify-center">
          <div className="inline-flex rounded-2xl border border-sand-300 bg-sand-100 p-1">
            <button
              onClick={() => setRoleTab('customer')}
              className={`rounded-xl px-5 py-2 text-sm font-semibold transition-all ${
                roleTab === 'customer' ? 'bg-clay-600 text-sand-50 shadow-earth' : 'text-clay-800 hover:text-clay-950'
              }`}
            >
              For Homeowners
            </button>
            <button
              onClick={() => setRoleTab('contractor')}
              className={`rounded-xl px-5 py-2 text-sm font-semibold transition-all ${
                roleTab === 'contractor' ? 'bg-clay-600 text-sand-50 shadow-earth' : 'text-clay-800 hover:text-clay-950'
              }`}
            >
              For Contractors & Workers
            </button>
          </div>
        </div>

        {roleTab === 'customer' ? (
          <Card className="p-8 sm:p-10">
            <div className="grid gap-8 sm:grid-cols-3">
              <div className="space-y-2">
                <h4 className="font-serif text-xl font-bold text-clay-900">Fair & Comparable Quotes</h4>
                <p className="text-xs text-clay-700 leading-relaxed">
                  Never overpay again. Because multiple verified workers can submit proposals, you see realistic market rates for your specific fix.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-serif text-xl font-bold text-clay-900">Pay After You Verify</h4>
                <p className="text-xs text-clay-700 leading-relaxed">
                  Zero advance payments or unexpected fee demands. You pay cash on completion only after the technician finishes the job.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-serif text-xl font-bold text-clay-900">Real Reviews That Matter</h4>
                <p className="text-xs text-clay-700 leading-relaxed">
                  Only customers with a verified, completed booking can submit reviews. No fake ratings, no bot testimonials.
                </p>
              </div>
            </div>
            <div className="mt-8 pt-6 border-t border-sand-200 flex justify-center">
              <LinkButton href="/register">Post a Problem in 2 Minutes</LinkButton>
            </div>
          </Card>
        ) : (
          <Card className="p-8 sm:p-10 bg-sand-100/60">
            <div className="grid gap-8 sm:grid-cols-3">
              <div className="space-y-2">
                <h4 className="font-serif text-xl font-bold text-clay-900">Steady Stream of Real Jobs</h4>
                <p className="text-xs text-clay-700 leading-relaxed">
                  Stop chasing vague leads on WhatsApp. See exactly what is wrong, the customer location, urgency, and photos before offering a quote.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-serif text-xl font-bold text-clay-900">Direct Customer Chat</h4>
                <p className="text-xs text-clay-700 leading-relaxed">
                  Coordinate timing, parts, and arrival directly through the built-in booking messenger. Full transparency prevents misunderstandings.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-serif text-xl font-bold text-clay-900">Build Your Reputation</h4>
                <p className="text-xs text-clay-700 leading-relaxed">
                  Every 5-star rating updates your public profile and ranking, helping top-rated local workers win more high-value jobs.
                </p>
              </div>
            </div>
            <div className="mt-8 pt-6 border-t border-sand-200 flex justify-center">
              <LinkButton href="/register?role=CONTRACTOR" variant="primary">
                Apply for Verification as Contractor
              </LinkButton>
            </div>
          </Card>
        )}
      </section>

      {/* FAQ SECTION */}
      <section className="space-y-8 max-w-3xl mx-auto">
        <div className="text-center space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-clay-600">Got Questions?</span>
          <h2 className="font-serif text-3xl text-clay-900">Frequently Asked Questions</h2>
        </div>

        <div className="space-y-3">
          {FAQS.map((faq, i) => {
            const isOpen = activeFaq === i;
            return (
              <div
                key={i}
                className="rounded-2xl border border-sand-300 bg-sand-50/80 transition-all overflow-hidden"
              >
                <button
                  onClick={() => setActiveFaq(isOpen ? null : i)}
                  className="w-full flex items-center justify-between p-4 text-left font-serif text-base font-semibold text-clay-900"
                >
                  <span>{faq.q}</span>
                  <span className="ml-3 text-clay-500 font-sans text-xl">{isOpen ? '−' : '+'}</span>
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 pt-1 text-xs text-clay-700 leading-relaxed border-t border-sand-200/60">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* FINAL CALL TO ACTION */}
      <section className="relative overflow-hidden rounded-[2.5rem_1.2rem_2.5rem_1.2rem] bg-gradient-to-br from-clay-700 to-clay-800 p-8 sm:p-14 text-center text-sand-50 shadow-lift">
        <div className="max-w-xl mx-auto space-y-5">
          <span className="inline-block rounded-full bg-sand-100/20 px-3.5 py-1 text-xs font-semibold text-sand-100 backdrop-blur-sm">
            Ready to get it sorted?
          </span>
          <h2 className="font-serif text-4xl sm:text-5xl text-sand-50 leading-tight">
            Stop worrying about repairs. <br />
            Let local pros bid on it.
          </h2>
          <p className="text-sm text-sand-200/90 leading-relaxed">
            Post your problem in under two minutes. Compare transparent quotes from verified plumbers, electricians, and builders in your city.
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/register"
              className="rounded-xl bg-sand-50 px-6 py-3 font-semibold text-clay-800 hover:bg-sand-100 transition-colors shadow-earth"
            >
              Post Your Problem Now
            </Link>
            <Link
              href="/register?role=CONTRACTOR"
              className="rounded-xl border border-sand-200/40 bg-clay-800/60 px-6 py-3 font-semibold text-sand-50 hover:bg-clay-800 transition-colors"
            >
              Join as Verified Contractor
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
