'use client';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Alert, Badge, Button, Card, Empty, Field, LinkButton, Loading, TextArea } from '@/components/ui';
import { ApiError, api, pkr, when } from '@/lib/api';
import { useRequireAuth } from '@/lib/auth';
import type { Problem, Quote } from '@/lib/types';

/* ── tiny star renderer ── */
function Stars({ rating, count }: { rating: number; count: number }) {
  const full = Math.round(rating);
  return (
    <span className="inline-flex items-center gap-0.5 text-sm">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < full ? 'text-amber-500' : 'text-clay-300'}>★</span>
      ))}
      <span className="ml-1 text-clay-600">
        {count > 0 ? `${rating.toFixed(1)} (${count})` : 'No reviews yet'}
      </span>
    </span>
  );
}

/* ── avatar initials ── */
function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const cls = size === 'lg' ? 'h-14 w-14 text-lg' : size === 'sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm';
  return (
    <div className={`${cls} flex shrink-0 items-center justify-center rounded-full bg-clay-700 font-bold text-sand-50`}>
      {initials}
    </div>
  );
}

/* ── counter-note modal ── */
function CounterModal({
  quote,
  onClose,
  onSent,
}: {
  quote: Quote;
  onClose: () => void;
  onSent: () => void;
}) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    setBusy(true);
    setErr('');
    try {
      await api(`/quotes/${quote.id}/counter`, { method: 'POST', body: { note: note.trim() } });
      onSent();
    } catch (e) {
      setErr(e instanceof ApiError ? e.friendly : 'Could not send note.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-clay-900/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-sand-50 shadow-2xl p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-serif">Send a note to contractor</h3>
            <p className="mt-1 text-sm text-clay-700">
              {quote.contractor?.fullName} · quote {pkr(quote.price)}
            </p>
          </div>
          <button onClick={onClose} className="text-clay-500 hover:text-clay-800 text-xl leading-none">&times;</button>
        </div>

        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
          <strong>How it works:</strong> Your note is sent as a notification to the contractor. They can then
          revise their quote price or message. Once you're happy, click "Accept Quote".
        </div>

        {err && <Alert>{err}</Alert>}

        <form onSubmit={submit} className="space-y-3">
          <TextArea
            label="Your message (e.g. budget or timeline request)"
            name="note"
            maxLength={500}
            placeholder="e.g. Can you do it for Rs 8,000? I need it done by Friday."
            value={note}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNote(e.target.value)}
            required
          />
          <div className="flex gap-2">
            <Button disabled={busy || !note.trim()}>Send note</Button>
            <Button type="button" variant="quiet" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── quote card ── */
function QuoteCard({
  quote,
  problemOpen,
  busy,
  onAccept,
  onCounter,
}: {
  quote: Quote;
  problemOpen: boolean;
  busy: boolean;
  onAccept: (q: Quote) => void;
  onCounter: (q: Quote) => void;
}) {
  const p = quote.contractor?.contractorProfile;
  const name = quote.contractor?.fullName ?? 'Contractor';
  const isPending = quote.status === 'PENDING';

  return (
    <Card>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        {/* Avatar + contractor info */}
        <div className="flex gap-3 items-start">
          <Avatar name={name} size="lg" />
          <div>
            <p className="font-semibold text-clay-900">{name}</p>
            {p && (
              <>
                <Stars rating={p.avgRating} count={p.reviewCount} />
                <p className="mt-1 text-xs text-clay-600 space-x-2">
                  <span>✓ {p.completedJobs} jobs done</span>
                  <span>· {p.yearsExperience} yrs exp</span>
                  <span>· {p.city}</span>
                </p>
              </>
            )}
          </div>
        </div>

        {/* Price + duration */}
        <div className="sm:ml-auto text-right shrink-0">
          <p className="font-serif text-3xl text-clay-900">{pkr(quote.price)}</p>
          <p className="text-sm text-clay-600">~{quote.estimatedDurationHours} h estimated</p>
          {quote.proposedStartAt && (
            <p className="text-xs text-clay-500 mt-0.5">Can start {when(quote.proposedStartAt)}</p>
          )}
          <div className="mt-1 flex justify-end">
            <Badge value={quote.status} />
          </div>
        </div>
      </div>

      {/* Contractor's message */}
      {quote.message && (
        <blockquote className="mt-4 rounded-xl bg-sand-100 border-l-4 border-clay-400 px-4 py-3 text-sm text-clay-800 italic">
          "{quote.message}"
        </blockquote>
      )}

      {/* Actions */}
      {isPending && problemOpen && (
        <div className="mt-5 flex flex-wrap gap-3 items-center border-t border-sand-200 pt-4">
          <Button
            disabled={busy}
            onClick={() => onAccept(quote)}
          >
            ✓ Accept this quote — {pkr(quote.price)}
          </Button>
          <Button
            variant="quiet"
            disabled={busy}
            onClick={() => onCounter(quote)}
          >
            💬 Negotiate / Send a note
          </Button>
          <p className="text-xs text-clay-500 w-full sm:w-auto sm:ml-auto">
            Accepting unlocks direct chat &amp; phone number
          </p>
        </div>
      )}

      {quote.status === 'ACCEPTED' && (
        <div className="mt-4 rounded-xl bg-green-50 border border-green-200 p-3 text-sm text-green-800 font-medium">
          ✓ You accepted this quote. Check "Open booking" above to manage the work.
        </div>
      )}
    </Card>
  );
}

/* ── accept confirmation modal ── */
function AcceptModal({
  quote,
  onClose,
  onConfirm,
  busy,
}: {
  quote: Quote;
  onClose: () => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  const name = quote.contractor?.fullName ?? 'this contractor';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-clay-900/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl bg-sand-50 shadow-2xl p-6 space-y-4">
        <h3 className="text-xl font-serif">Confirm acceptance</h3>
        <div className="rounded-xl bg-sand-100 p-4 space-y-1 text-sm">
          <p><span className="text-clay-600">Contractor:</span> <strong>{name}</strong></p>
          <p><span className="text-clay-600">Agreed price:</span> <strong className="font-serif text-lg">{pkr(quote.price)}</strong></p>
          <p><span className="text-clay-600">Duration:</span> {quote.estimatedDurationHours} h</p>
        </div>
        <p className="text-sm text-clay-700">
          All other pending quotes will be declined. A booking will be created and the contractor notified.
          Payment is <strong>cash on completion</strong>.
        </p>
        <div className="flex gap-2">
          <Button disabled={busy} onClick={onConfirm}>Yes, accept quote</Button>
          <Button type="button" variant="quiet" onClick={onClose} disabled={busy}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Main page
══════════════════════════════════════════════════════════ */
export default function ProblemDetail() {
  const { id } = useParams<{ id: string }>();
  const user = useRequireAuth();
  const router = useRouter();
  const quotesRef = useRef<HTMLElement>(null);

  const [problem, setProblem] = useState<Problem | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [acceptTarget, setAcceptTarget] = useState<Quote | null>(null);
  const [counterTarget, setCounterTarget] = useState<Quote | null>(null);
  const [noteSent, setNoteSent] = useState(false);

  const load = useCallback(async () => {
    try {
      const p = (await api<Problem>(`/problems/${id}`)).data;
      setProblem(p);
      setQuotes((await api<Quote[]>(`/problems/${id}/quotes`)).data);
    } catch (e) {
      setError(e instanceof ApiError ? e.friendly : 'Could not load this problem.');
    }
  }, [id]);

  useEffect(() => { if (user) load(); }, [user, load]);

  // Scroll to quotes section when arriving from a notification (#quotes in URL)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash === '#quotes' && quotesRef.current) {
      setTimeout(() => quotesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 400);
    }
  }, [quotes]);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true); setError('');
    try { await fn(); await load(); } catch (e) { setError(e instanceof ApiError ? e.friendly : 'That did not work.'); } finally { setBusy(false); }
  }

  async function doAccept() {
    if (!acceptTarget) return;
    await act(async () => {
      const booking = await api<{ id: string }>(`/quotes/${acceptTarget.id}/accept`, { method: 'POST' });
      setAcceptTarget(null);
      // Navigate to the new booking immediately
      router.push(`/bookings/${booking.data.id}`);
    });
  }

  async function sendQuote(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    await act(() => api(`/problems/${id}/quotes`, { body: { price: Number(f.price), estimatedDurationHours: Number(f.hours), message: f.message || undefined } }));
    (e.target as HTMLFormElement).reset();
  }

  async function editQuote(e: FormEvent<HTMLFormElement>, quoteId: string) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    await act(() => api(`/quotes/${quoteId}`, { method: 'PATCH', body: { price: Number(f.price), estimatedDurationHours: Number(f.hours), message: f.message || undefined } }));
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const form = new FormData(); Array.from(files).forEach((f) => form.append('files', f));
    await act(() => api(`/problems/${id}/media`, { form }));
  }

  if (!user) return <Loading />;
  if (!problem) return error ? <Alert>{error}</Alert> : <Loading />;

  const isOwner = user.role === 'CUSTOMER' && problem.customerId === user.id;
  const isContractor = user.role === 'CONTRACTOR';
  const myQuote = isContractor ? quotes[0] : undefined;
  const booking = problem.booking;
  const problemOpen = problem.status === 'OPEN';

  const pendingQuotes = quotes.filter((q) => q.status === 'PENDING');
  const otherQuotes = quotes.filter((q) => q.status !== 'PENDING');

  return (
    <div className="space-y-6">
      {/* ── Problem header ── */}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl">{problem.title}</h1>
            <p className="mt-1 text-clay-700">
              {problem.category.name} · {problem.city}{problem.area ? `, ${problem.area}` : ''} · posted {when(problem.createdAt)}
            </p>
          </div>
          <Badge value={problem.status} />
        </div>

        <p className="mt-4 whitespace-pre-line">{problem.description}</p>

        <p className="mt-3 text-sm text-clay-700">
          Urgency: {problem.urgency.replaceAll('_', ' ').toLowerCase()}
          {problem.budgetMin != null || problem.budgetMax != null
            ? ` · Budget ${problem.budgetMin != null ? pkr(problem.budgetMin) : ''}${problem.budgetMax != null ? ` to ${pkr(problem.budgetMax)}` : ''}`
            : ''}
          {problemOpen ? ` · expires ${when(problem.expiresAt)}` : ''}
        </p>

        {problem.media.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-3">
            {problem.media.map((m) => (
              // eslint-disable-next-line @next/next/no-img-element
              <a key={m.id} href={m.url} target="_blank" rel="noreferrer">
                <img src={m.url} alt="Problem photo" className="h-28 w-28 rounded-xl object-cover shadow-earth" />
              </a>
            ))}
          </div>
        )}

        {isOwner && problemOpen && (
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {problem.media.length < 5 && (
              <label className="text-sm text-clay-700">
                Add photos{' '}
                <input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(e) => upload(e.target.files)} className="ml-2 text-sm" />
              </label>
            )}
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => confirm('Cancel this problem? Pending quotes will be rejected.') && act(() => api(`/problems/${id}/cancel`, { method: 'POST' }))}
            >
              Cancel problem
            </Button>
          </div>
        )}

        {booking && (user.role !== 'CONTRACTOR' || booking.contractorId === user.id) && (
          <div className="mt-5">
            <LinkButton href={`/bookings/${booking.id}`}>Open booking →</LinkButton>
          </div>
        )}
      </Card>

      <Alert>{error}</Alert>

      {/* ══════════════════════════════════════════════
          CUSTOMER: Quotes section
      ══════════════════════════════════════════════ */}
      {isOwner && (
        <section id="quotes" ref={quotesRef} className="scroll-mt-20">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl">
              Quotes received{' '}
              <span className="ml-1 rounded-full bg-clay-700 px-2.5 py-0.5 text-sm font-bold text-sand-50">
                {quotes.length}
              </span>
            </h2>
            {pendingQuotes.length > 0 && problemOpen && (
              <p className="text-sm text-clay-600 max-w-xs text-right">
                Review each quote below. Negotiate if needed, then accept when ready.
              </p>
            )}
          </div>

          {quotes.length === 0 ? (
            <Empty title="No quotes yet">
              Verified contractors in your city will see this problem and send quotes. Check back soon.
            </Empty>
          ) : (
            <div className="space-y-5">
              {/* Pending quotes first (actionable) */}
              {pendingQuotes.length > 0 && (
                <div className="space-y-4">
                  {pendingQuotes.length > 1 && (
                    <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
                      💡 Sorted cheapest first. You can negotiate with any contractor before accepting.
                    </div>
                  )}
                  {pendingQuotes.map((q) => (
                    <QuoteCard
                      key={q.id}
                      quote={q}
                      problemOpen={problemOpen}
                      busy={busy}
                      onAccept={setAcceptTarget}
                      onCounter={setCounterTarget}
                    />
                  ))}
                </div>
              )}

              {/* Closed quotes (accepted/rejected/withdrawn) */}
              {otherQuotes.length > 0 && (
                <div>
                  {pendingQuotes.length > 0 && (
                    <p className="mb-3 text-sm font-medium text-clay-700">Other quotes</p>
                  )}
                  <div className="space-y-3 opacity-70">
                    {otherQuotes.map((q) => (
                      <QuoteCard
                        key={q.id}
                        quote={q}
                        problemOpen={false}
                        busy={busy}
                        onAccept={setAcceptTarget}
                        onCounter={setCounterTarget}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* ══════════════════════════════════════════════
          CONTRACTOR: Your quote section
      ══════════════════════════════════════════════ */}
      {isContractor && (
        <section>
          <h2 className="mb-3 text-2xl">Your quote</h2>
          {myQuote ? (
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="font-serif text-2xl">{pkr(myQuote.price)}</p>
                  <p className="text-sm text-clay-700">~{myQuote.estimatedDurationHours} h estimated</p>
                  {myQuote.message && <p className="mt-2 italic text-clay-800">"{myQuote.message}"</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge value={myQuote.status} />
                  {myQuote.status === 'PENDING' && (
                    <Button variant="quiet" disabled={busy} onClick={() => act(() => api(`/quotes/${myQuote.id}/withdraw`, { method: 'POST' }))}>
                      Withdraw
                    </Button>
                  )}
                </div>
              </div>

              {/* Contractor can revise their pending quote */}
              {myQuote.status === 'PENDING' && problemOpen && (
                <details className="mt-4 border-t border-sand-200 pt-4">
                  <summary className="cursor-pointer text-sm font-medium text-clay-700 hover:text-clay-900">
                    Revise your quote (the customer may have sent you a note)
                  </summary>
                  <form onSubmit={(e) => editQuote(e, myQuote.id)} className="mt-3 space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="New price (Rs)" name="price" type="number" min={1} defaultValue={myQuote.price} required />
                      <Field label="Time needed (hours)" name="hours" type="number" min={1} defaultValue={myQuote.estimatedDurationHours} required />
                    </div>
                    <TextArea label="Updated note to customer" name="message" maxLength={500} defaultValue={myQuote.message} />
                    <Button disabled={busy}>Update quote</Button>
                  </form>
                </details>
              )}

              {myQuote.status === 'ACCEPTED' && (
                <div className="mt-4 rounded-xl bg-green-50 border border-green-200 p-3 text-sm text-green-800 font-medium">
                  ✓ Your quote was accepted! Check the booking for next steps.
                </div>
              )}
            </Card>
          ) : problemOpen ? (
            <Card>
              <h3 className="mb-3 text-lg font-medium">Send your quote</h3>
              <form onSubmit={sendQuote} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Your price (Rs)" name="price" type="number" min={1} required />
                  <Field label="Time needed (hours)" name="hours" type="number" min={1} required />
                </div>
                <TextArea
                  label="Note to the customer"
                  name="message"
                  maxLength={500}
                  placeholder="When can you start? What materials are included? Any site visit needed?"
                />
                <Button disabled={busy}>Send quote</Button>
              </form>
            </Card>
          ) : (
            <Empty title="This problem is no longer open for quotes" />
          )}
        </section>
      )}

      {/* ── Modals ── */}
      {acceptTarget && (
        <AcceptModal
          quote={acceptTarget}
          busy={busy}
          onClose={() => setAcceptTarget(null)}
          onConfirm={doAccept}
        />
      )}

      {counterTarget && (
        <CounterModal
          quote={counterTarget}
          onClose={() => setCounterTarget(null)}
          onSent={() => {
            setCounterTarget(null);
            setNoteSent(true);
            setTimeout(() => setNoteSent(false), 5000);
          }}
        />
      )}

      {noteSent && (
        <div className="fixed bottom-6 right-6 z-40 rounded-xl bg-green-700 px-5 py-3 text-sm font-medium text-white shadow-xl">
          ✓ Note sent to contractor — they'll see it in their notifications.
        </div>
      )}
    </div>
  );
}
