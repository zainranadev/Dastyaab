'use client';
import Link from 'next/link';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

const btn = 'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
const variants = {
  primary: 'bg-clay-600 text-sand-50 shadow-earth hover:bg-clay-700',
  quiet: 'border border-sand-300 bg-sand-100 text-ink hover:bg-sand-200',
  danger: 'border border-rust-700/30 bg-rust-100 text-rust-700 hover:bg-rust-100/70',
} as const;
type Variant = keyof typeof variants;

export function Button({ variant = 'primary', className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button {...p} className={`${btn} ${variants[variant]} ${className}`} />;
}
export function LinkButton({ href, variant = 'primary', children, className = '' }: { href: string; variant?: Variant; children: ReactNode; className?: string }) {
  return <Link href={href} className={`${btn} ${variants[variant]} ${className}`}>{children}</Link>;
}

const input = 'w-full rounded-xl border border-sand-300 bg-sand-50 px-3.5 py-2.5 text-sm text-ink placeholder:text-sand-500 shadow-[inset_0_1px_2px_rgba(110,64,51,.08)]';
export function Field({ label, hint, ...p }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-clay-800">{label}</span>
      <input {...p} className={input} />
      {hint && <span className="mt-1 block text-xs text-clay-700/70">{hint}</span>}
    </label>
  );
}
export function TextArea({ label, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-clay-800">{label}</span>
      <textarea {...p} className={`${input} min-h-28`} />
    </label>
  );
}
export function Select({ label, children, ...p }: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-clay-800">{label}</span>
      <select {...p} className={input}>{children}</select>
    </label>
  );
}

/** Asymmetric corners read as worn stone rather than a template card. */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-[1.4rem_0.7rem_1.4rem_0.7rem] border border-sand-200 bg-sand-50/90 p-5 shadow-earth ${className}`}>{children}</section>;
}

const tone: Record<string, string> = {
  OPEN: 'bg-sage-100 text-sage-600', VERIFIED: 'bg-sage-100 text-sage-600', COMPLETED: 'bg-sage-100 text-sage-600', ACCEPTED: 'bg-sage-100 text-sage-600', PAID: 'bg-sage-100 text-sage-600',
  PENDING: 'bg-ochre-100 text-ochre-700', BOOKED: 'bg-ochre-100 text-ochre-700', SCHEDULED: 'bg-ochre-100 text-ochre-700', ON_THE_WAY: 'bg-ochre-100 text-ochre-700',
  IN_PROGRESS: 'bg-ochre-100 text-ochre-700', AWAITING_CONFIRMATION: 'bg-ochre-100 text-ochre-700', UNPAID: 'bg-ochre-100 text-ochre-700',
  CANCELLED: 'bg-rust-100 text-rust-700', REJECTED: 'bg-rust-100 text-rust-700', EXPIRED: 'bg-sand-200 text-clay-700', WITHDRAWN: 'bg-sand-200 text-clay-700', UNSUBMITTED: 'bg-sand-200 text-clay-700',
};
export function Badge({ value }: { value: string }) {
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${tone[value] ?? 'bg-sand-200 text-clay-700'}`}>{value.replaceAll('_', ' ').toLowerCase()}</span>;
}

export function Alert({ kind = 'error', children }: { kind?: 'error' | 'ok'; children: ReactNode }) {
  if (!children) return null;
  return <p role={kind === 'error' ? 'alert' : 'status'} className={`rounded-xl px-3.5 py-2.5 text-sm ${kind === 'error' ? 'bg-rust-100 text-rust-700' : 'bg-sage-100 text-sage-600'}`}>{children}</p>;
}
export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-[1.4rem_0.7rem_1.4rem_0.7rem] border border-dashed border-sand-400 px-6 py-10 text-center">
      <p className="font-serif text-lg">{title}</p>
      {children && <div className="mt-2 text-sm text-clay-700">{children}</div>}
    </div>
  );
}
export function PageTitle({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-3xl">{title}</h1>
        {sub && <p className="mt-1 max-w-prose text-clay-700">{sub}</p>}
      </div>
      {action}
    </header>
  );
}
export function Loading() {
  return <p className="py-10 text-center text-clay-700">Loading…</p>;
}

/** Layered ground: the one recurring motif, like strata in a desert cut-bank. */
export function Strata({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 1200 220" preserveAspectRatio="none" aria-hidden className={className}>
      <path d="M0 70 C200 30 360 110 560 70 S980 20 1200 62 V220 H0Z" fill="#E2D2B8" />
      <path d="M0 110 C220 80 380 150 600 112 S1000 70 1200 104 V220 H0Z" fill="#D1BB96" />
      <path d="M0 150 C200 128 420 184 640 150 S1020 120 1200 146 V220 H0Z" fill="#BC9F74" />
      <path d="M0 184 C260 168 460 208 700 184 S1040 164 1200 182 V220 H0Z" fill="#A8664F" opacity=".85" />
      <path d="M0 206 C300 196 500 220 760 206 S1060 196 1200 204 V220 H0Z" fill="#8C5240" />
    </svg>
  );
}
