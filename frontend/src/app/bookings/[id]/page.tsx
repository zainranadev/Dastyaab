'use client';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { BookingChat } from '@/components/BookingChat';
import { Alert, Badge, Button, Card, Field, Loading, Select, TextArea } from '@/components/ui';
import { ApiError, api, pkr, when } from '@/lib/api';
import { useRequireAuth } from '@/lib/auth';
import type { Booking } from '@/lib/types';

const NEXT: Record<string, { to: string; label: string }> = {
  SCHEDULED: { to: 'ON_THE_WAY', label: 'I am on the way' },
  ON_THE_WAY: { to: 'IN_PROGRESS', label: 'Start work' },
  IN_PROGRESS: { to: 'AWAITING_CONFIRMATION', label: 'Work is done' },
};

export default function BookingDetail() {
  const { id } = useParams<{ id: string }>();
  const user = useRequireAuth();
  const [b, setB] = useState<Booking | null>(null);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(() => api<Booking>(`/bookings/${id}`).then((r) => setB(r.data)).catch((e) => setError(e instanceof ApiError ? e.friendly : 'Could not load.')), [id]);
  useEffect(() => { if (user) load(); }, [user, load]);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true); setError('');
    try { await fn(); await load(); setCancelling(false); } catch (e) { setError(e instanceof ApiError ? e.friendly : 'That did not work.'); } finally { setBusy(false); }
  }
  const post = (path: string, body?: unknown) => api(`/bookings/${id}/${path}`, { method: 'POST', body });

  if (!user) return <Loading />;
  if (!b) return error ? <Alert>{error}</Alert> : <Loading />;
  const isAdmin = user.role === 'ADMIN';
  const isCustomer = user.id === b.customerId, isContractor = user.id === b.contractorId;
  const other = isCustomer ? b.contractor : b.customer;
  const next = NEXT[b.status];
  const canCancel = (isCustomer && b.status === 'SCHEDULED') || (isContractor && ['SCHEDULED', 'ON_THE_WAY'].includes(b.status));

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h1 className="text-3xl">{b.problem.title}</h1><p className="mt-1 text-clay-700">{b.problem.category.name} · {b.problem.city}{b.problem.area ? `, ${b.problem.area}` : ''}</p></div>
          <div className="flex gap-2"><Badge value={b.status} /><Badge value={b.paymentStatus} /></div>
        </div>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          <div><dt className="text-sm text-clay-700">Agreed price</dt><dd className="font-serif text-xl">{pkr(b.agreedPrice)}</dd></div>
          <div><dt className="text-sm text-clay-700">Scheduled</dt><dd>{when(b.scheduledAt)}</dd></div>
          {isAdmin ? (
            <>
              <div><dt className="text-sm text-clay-700">Customer</dt><dd>{b.customer.fullName}<br /><a className="underline text-clay-800" href={`tel:${b.customer.phone}`}>{b.customer.phone}</a></dd></div>
              <div><dt className="text-sm text-clay-700">Contractor</dt><dd>{b.contractor.fullName}<br /><a className="underline text-clay-800" href={`tel:${b.contractor.phone}`}>{b.contractor.phone}</a></dd></div>
            </>
          ) : (
            <div><dt className="text-sm text-clay-700">{isCustomer ? 'Your contractor' : 'Your customer'}</dt><dd>{other.fullName}<br /><a className="underline" href={`tel:${other.phone}`}>{other.phone}</a></dd></div>
          )}
        </dl>
        <p className="mt-3 text-sm text-clay-700">Payment is cash on completion. The contractor marks it received.</p>
      </Card>

      <Alert>{error}</Alert>

      <Card>
        <h2 className="mb-3 text-xl">What you can do</h2>
        <div className="flex flex-wrap gap-3">
          {isAdmin && <span className="self-center rounded-lg bg-sand-200 px-3 py-1.5 text-xs font-semibold text-clay-800">Admin Oversight Mode (Auditing booking lifecycle & party conduct)</span>}
          {isContractor && next && <Button disabled={busy} onClick={() => act(() => post('status', { status: next.to }))}>{next.label}</Button>}
          {isContractor && ['IN_PROGRESS', 'AWAITING_CONFIRMATION', 'COMPLETED'].includes(b.status) && b.paymentStatus === 'UNPAID' && <Button variant="quiet" disabled={busy} onClick={() => act(() => post('mark-paid'))}>Cash received</Button>}
          {isCustomer && b.status === 'AWAITING_CONFIRMATION' && <Button disabled={busy} onClick={() => act(() => post('confirm'))}>Confirm the work is done</Button>}
          {canCancel && !cancelling && <Button variant="danger" onClick={() => setCancelling(true)}>Cancel booking</Button>}
          {isCustomer && b.status === 'AWAITING_CONFIRMATION' && <p className="self-center text-sm text-clay-700">If you do not respond within 72 hours, the job is completed automatically.</p>}
          {!next && !canCancel && !isAdmin && !(isCustomer && b.status === 'AWAITING_CONFIRMATION') && !(isContractor && b.paymentStatus === 'UNPAID' && ['AWAITING_CONFIRMATION', 'COMPLETED'].includes(b.status)) && <p className="text-sm text-clay-700">Nothing to do right now.</p>}
        </div>
        {cancelling && (
          <form className="mt-4 space-y-3" onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const reason = String(new FormData(e.currentTarget).get('reason')); act(() => post('cancel', { reason })); }}>
            <TextArea label="Why are you cancelling?" name="reason" minLength={5} maxLength={300} required />
            <div className="flex gap-2"><Button variant="danger" disabled={busy}>Confirm cancellation</Button><Button type="button" variant="quiet" onClick={() => setCancelling(false)}>Keep booking</Button></div>
          </form>
        )}
      </Card>

      {isCustomer && b.status === 'COMPLETED' && (b.review ? (
        <Card><h2 className="text-xl">Your review</h2><p className="mt-1">{'★'.repeat(b.review.rating)}{'☆'.repeat(5 - b.review.rating)}</p>{b.review.comment && <p className="mt-1">{b.review.comment}</p>}</Card>
      ) : (
        <Card>
          <h2 className="mb-3 text-xl">How did it go?</h2>
          <form className="space-y-3" onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const f = new FormData(e.currentTarget); act(() => api(`/bookings/${id}/review`, { body: { rating: Number(f.get('rating')), comment: String(f.get('comment') || '') || undefined } })); }}>
            <Select label="Rating" name="rating" defaultValue="5">{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} {n === 1 ? 'star' : 'stars'}</option>)}</Select>
            <TextArea label="Comment (optional)" name="comment" maxLength={1000} />
            <Button disabled={busy}>Leave review</Button>
          </form>
        </Card>
      ))}

      <BookingChat
        bookingId={b.id}
        currentUserId={user.id}
        otherPartyName={isAdmin ? `${b.customer.fullName} & ${b.contractor.fullName}` : other.fullName}
      />

      <Card>
        <h2 className="mb-3 text-xl">History</h2>
        <ol className="space-y-2 border-l-2 border-sand-300 pl-4">
          {b.statusHistory?.map((h) => (
            <li key={h.id} className="text-sm"><span className="font-medium">{h.toStatus.replaceAll('_', ' ').toLowerCase()}</span> <span className="text-clay-700">· {when(h.createdAt)}{h.note ? ` · ${h.note}` : ''}</span></li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
