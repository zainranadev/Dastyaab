'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Empty, Field, LinkButton, Loading, PageTitle } from '@/components/ui';
import { ApiError, api, pkr, when } from '@/lib/api';
import { useRequireAuth } from '@/lib/auth';
import type { AdminStats, Booking, ContractorProfile, Problem } from '@/lib/types';

type Tab = 'verification' | 'jobs' | 'bookings' | 'contractors';

export default function AdminHub() {
  const user = useRequireAuth(['ADMIN']);
  const [activeTab, setActiveTab] = useState<Tab>('verification');
  const [stats, setStats] = useState<AdminStats | null>(null);

  // Data states
  const [pendingQueue, setPendingQueue] = useState<ContractorProfile[] | null>(null);
  const [allContractors, setAllContractors] = useState<ContractorProfile[] | null>(null);
  const [problems, setProblems] = useState<Problem[] | null>(null);
  const [bookings, setBookings] = useState<Booking[] | null>(null);

  // Filters
  const [problemStatus, setProblemStatus] = useState<string>('ALL');
  const [bookingStatus, setBookingStatus] = useState<string>('ALL');
  const [contractorStatus, setContractorStatus] = useState<string>('ALL');

  // Action states
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loadingAction, setLoadingAction] = useState(false);

  // Load high level platform stats
  const loadStats = useCallback(async () => {
    try {
      const res = await api<AdminStats>('/admin/stats');
      setStats(res.data);
    } catch {
      // Ignore background error
    }
  }, []);

  // Load verification queue
  const loadPendingQueue = useCallback(async () => {
    try {
      const res = await api<ContractorProfile[]>('/admin/contractors?status=PENDING&limit=50');
      setPendingQueue(res.data);
    } catch (e) {
      setError(e instanceof ApiError ? e.friendly : 'Failed to load verification queue.');
    }
  }, []);

  // Load all jobs / problems
  const loadProblems = useCallback(async () => {
    try {
      const query = problemStatus === 'ALL' ? '' : `?status=${problemStatus}`;
      const res = await api<Problem[]>(`/admin/problems${query}`);
      setProblems(res.data);
    } catch (e) {
      setError(e instanceof ApiError ? e.friendly : 'Failed to load problems.');
    }
  }, [problemStatus]);

  // Load all bookings
  const loadBookings = useCallback(async () => {
    try {
      const query = bookingStatus === 'ALL' ? '' : `?status=${bookingStatus}`;
      const res = await api<Booking[]>(`/admin/bookings${query}`);
      setBookings(res.data);
    } catch (e) {
      setError(e instanceof ApiError ? e.friendly : 'Failed to load bookings.');
    }
  }, [bookingStatus]);

  // Load all contractors
  const loadAllContractors = useCallback(async () => {
    try {
      const query = contractorStatus === 'ALL' ? '' : `?status=${contractorStatus}`;
      const res = await api<ContractorProfile[]>(`/admin/contractors${query}`);
      setAllContractors(res.data);
    } catch (e) {
      setError(e instanceof ApiError ? e.friendly : 'Failed to load contractors directory.');
    }
  }, [contractorStatus]);

  // Initial load
  useEffect(() => {
    if (user) {
      loadStats();
      loadPendingQueue();
    }
  }, [user, loadStats, loadPendingQueue]);

  // Lazy load tab data
  useEffect(() => {
    if (!user) return;
    if (activeTab === 'jobs') loadProblems();
    if (activeTab === 'bookings') loadBookings();
    if (activeTab === 'contractors') loadAllContractors();
  }, [user, activeTab, loadProblems, loadBookings, loadAllContractors]);

  async function handleVerification(contractorUserId: string, action: 'verify' | 'reject', reason?: string) {
    setLoadingAction(true);
    setError('');
    try {
      if (action === 'verify') {
        await api(`/admin/contractors/${contractorUserId}/verify`, { method: 'POST' });
      } else {
        await api(`/admin/contractors/${contractorUserId}/reject`, { method: 'POST', body: { reason } });
      }
      setRejecting(null);
      await Promise.all([loadStats(), loadPendingQueue(), activeTab === 'contractors' ? loadAllContractors() : null]);
    } catch (e) {
      setError(e instanceof ApiError ? e.friendly : 'Action could not be completed.');
    } finally {
      setLoadingAction(false);
    }
  }

  if (!user) return <Loading />;

  return (
    <div className="space-y-6">
      <PageTitle
        title="Admin Operations Hub"
        sub="Full platform oversight: approve contractors, monitor live jobs, track bookings, and ensure transparency between customers and contractors."
      />

      <Alert>{error}</Alert>

      {/* Platform Metrics Overview Cards */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          <Card className="flex flex-col justify-between !p-4 bg-ochre-100/40 border-ochre-300">
            <span className="text-xs font-medium text-clay-700">Pending Approvals</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="font-serif text-2xl font-bold text-ochre-800">{stats.pendingContractors}</span>
              {stats.pendingContractors > 0 && <span className="text-[11px] font-semibold text-ochre-700">Action needed</span>}
            </div>
          </Card>

          <Card className="flex flex-col justify-between !p-4">
            <span className="text-xs font-medium text-clay-700">Active Bookings</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="font-serif text-2xl font-bold text-clay-900">{stats.activeBookings}</span>
              <span className="text-[11px] text-clay-600">in progress</span>
            </div>
          </Card>

          <Card className="flex flex-col justify-between !p-4">
            <span className="text-xs font-medium text-clay-700">Open Jobs</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="font-serif text-2xl font-bold text-clay-900">{stats.openProblems}</span>
              <span className="text-[11px] text-clay-600">awaiting quotes</span>
            </div>
          </Card>

          <Card className="flex flex-col justify-between !p-4">
            <span className="text-xs font-medium text-clay-700">Completed Jobs</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="font-serif text-2xl font-bold text-sage-700">{stats.completedBookings}</span>
              <span className="text-[11px] text-sage-600">settled</span>
            </div>
          </Card>

          <Card className="flex flex-col justify-between !p-4 col-span-2 sm:col-span-1">
            <span className="text-xs font-medium text-clay-700">Verified Workers</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="font-serif text-2xl font-bold text-clay-900">{stats.verifiedContractors}</span>
              <span className="text-[11px] text-clay-600">in network</span>
            </div>
          </Card>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-sand-300 pb-2">
        <button
          onClick={() => setActiveTab('verification')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'verification' ? 'bg-clay-600 text-sand-50 shadow-earth' : 'bg-sand-100 text-clay-800 hover:bg-sand-200'
          }`}
        >
          <span>Verification Queue</span>
          {stats && stats.pendingContractors > 0 && (
            <span className="rounded-full bg-rust-700 px-1.5 py-0.2 text-[10px] font-bold text-sand-50">
              {stats.pendingContractors}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('jobs')}
          className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'jobs' ? 'bg-clay-600 text-sand-50 shadow-earth' : 'bg-sand-100 text-clay-800 hover:bg-sand-200'
          }`}
        >
          Jobs & Problems ({stats?.totalProblems ?? '...'})
        </button>

        <button
          onClick={() => setActiveTab('bookings')}
          className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'bookings' ? 'bg-clay-600 text-sand-50 shadow-earth' : 'bg-sand-100 text-clay-800 hover:bg-sand-200'
          }`}
        >
          Bookings & Audit ({stats?.totalBookings ?? '...'})
        </button>

        <button
          onClick={() => setActiveTab('contractors')}
          className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'contractors' ? 'bg-clay-600 text-sand-50 shadow-earth' : 'bg-sand-100 text-clay-800 hover:bg-sand-200'
          }`}
        >
          Contractors Directory
        </button>
      </div>

      {/* TAB 1: VERIFICATION QUEUE */}
      {activeTab === 'verification' && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-medium text-clay-900">Contractors Waiting for Approval</h2>
            <Button variant="quiet" onClick={loadPendingQueue}>Refresh</Button>
          </div>

          {pendingQueue === null ? (
            <Loading />
          ) : pendingQueue.length === 0 ? (
            <Empty title="Verification queue is clear">No contractors are waiting for approval right now.</Empty>
          ) : (
            <div className="space-y-4">
              {pendingQueue.map((p) => (
                <Card key={p.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-medium">{p.user?.fullName}</h3>
                      <p className="text-sm text-clay-700">
                        Email: {p.user?.email} · Phone: {p.user?.phone} · City: {p.city} · Experience: {p.yearsExperience} yrs
                      </p>
                      <p className="mt-1 text-sm font-medium text-clay-800">
                        Trades: {p.categories.map((c) => c.category.name).join(', ')}
                      </p>
                      {p.serviceAreas.length > 0 && (
                        <p className="text-xs text-clay-600">Areas served: {p.serviceAreas.join(', ')}</p>
                      )}
                      {p.bio && <p className="mt-2 text-sm text-clay-900 bg-sand-100 p-2.5 rounded-lg border border-sand-200">{p.bio}</p>}
                    </div>
                    <Badge value={p.verificationStatus} />
                  </div>

                  {rejecting === p.id ? (
                    <form
                      className="mt-4 flex flex-wrap items-end gap-3 pt-3 border-t border-sand-200"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const reason = String(new FormData(e.currentTarget).get('reason'));
                        handleVerification(p.userId, 'reject', reason);
                      }}
                    >
                      <div className="min-w-60 flex-1">
                        <Field label="Rejection reason (shown to contractor)" name="reason" minLength={5} required />
                      </div>
                      <Button variant="danger" disabled={loadingAction}>Confirm Rejection</Button>
                      <Button type="button" variant="quiet" onClick={() => setRejecting(null)}>Cancel</Button>
                    </form>
                  ) : (
                    <div className="mt-4 flex gap-3 pt-3 border-t border-sand-200">
                      <Button disabled={loadingAction} onClick={() => handleVerification(p.userId, 'verify')}>
                        Approve Contractor
                      </Button>
                      <Button variant="quiet" disabled={loadingAction} onClick={() => setRejecting(p.id)}>
                        Reject
                      </Button>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </section>
      )}

      {/* TAB 2: JOBS & PROBLEMS MONITOR */}
      {activeTab === 'jobs' && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-medium text-clay-900">Platform Jobs (Customer Problems)</h2>
              <p className="text-xs text-clay-600">Monitor all requests, verify trade categorizations, and inspect bids.</p>
            </div>
            {/* Filter buttons */}
            <div className="flex flex-wrap gap-1 text-xs">
              {['ALL', 'OPEN', 'BOOKED', 'COMPLETED', 'CANCELLED'].map((st) => (
                <button
                  key={st}
                  onClick={() => setProblemStatus(st)}
                  className={`rounded-lg px-2.5 py-1.5 font-medium transition-colors ${
                    problemStatus === st ? 'bg-clay-700 text-sand-50' : 'bg-sand-200 text-clay-800 hover:bg-sand-300'
                  }`}
                >
                  {st.toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {problems === null ? (
            <Loading />
          ) : problems.length === 0 ? (
            <Empty title="No problems found with this filter" />
          ) : (
            <div className="space-y-3">
              {problems.map((p) => (
                <Card key={p.id} className="transition-shadow hover:shadow-lift">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <Link href={`/problems/${p.id}`} className="text-lg font-medium hover:underline text-clay-900">
                        {p.title}
                      </Link>
                      <p className="text-xs text-clay-700">
                        Posted by <span className="font-medium">{p.customer?.fullName}</span> · Category: <span className="font-medium">{p.category?.name}</span> · {p.city}{p.area ? `, ${p.area}` : ''}
                      </p>
                      <p className="text-xs text-clay-600">
                        Urgency: {p.urgency.replace(/_/g, ' ').toLowerCase()} · {p._count?.quotes ?? 0} quotes received · Posted {when(p.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge value={p.status} />
                      <LinkButton href={`/problems/${p.id}`} variant="quiet" className="!py-1.5 !px-3 text-xs">
                        Inspect Job
                      </LinkButton>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      )}

      {/* TAB 3: BOOKINGS & AUDIT OVERSIGHT */}
      {activeTab === 'bookings' && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-medium text-clay-900">All Platform Bookings</h2>
              <p className="text-xs text-clay-600">Full audit trail of agreements, status progression, contact details, and chats.</p>
            </div>
            {/* Status filters */}
            <div className="flex flex-wrap gap-1 text-xs">
              {['ALL', 'SCHEDULED', 'ON_THE_WAY', 'IN_PROGRESS', 'AWAITING_CONFIRMATION', 'COMPLETED', 'CANCELLED'].map((st) => (
                <button
                  key={st}
                  onClick={() => setBookingStatus(st)}
                  className={`rounded-lg px-2.5 py-1.5 font-medium transition-colors ${
                    bookingStatus === st ? 'bg-clay-700 text-sand-50' : 'bg-sand-200 text-clay-800 hover:bg-sand-300'
                  }`}
                >
                  {st.replace(/_/g, ' ').toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {bookings === null ? (
            <Loading />
          ) : bookings.length === 0 ? (
            <Empty title="No bookings found with this filter" />
          ) : (
            <div className="space-y-3">
              {bookings.map((b) => (
                <Card key={b.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-medium text-clay-900">{b.problem.title}</h3>
                      <p className="text-xs text-clay-700">
                        {b.problem.category.name} · {b.problem.city}{b.problem.area ? `, ${b.problem.area}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge value={b.status} />
                      <Badge value={b.paymentStatus} />
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-xl bg-sand-100/70 text-xs">
                    <div>
                      <span className="text-clay-600 block">Customer</span>
                      <span className="font-semibold text-clay-900">{b.customer.fullName}</span>
                      <a href={`tel:${b.customer.phone}`} className="text-clay-700 block underline">{b.customer.phone}</a>
                    </div>
                    <div>
                      <span className="text-clay-600 block">Contractor</span>
                      <span className="font-semibold text-clay-900">{b.contractor.fullName}</span>
                      <a href={`tel:${b.contractor.phone}`} className="text-clay-700 block underline">{b.contractor.phone}</a>
                    </div>
                    <div>
                      <span className="text-clay-600 block">Agreed Price</span>
                      <span className="font-serif text-sm font-bold text-clay-900">{pkr(b.agreedPrice)}</span>
                      <span className="text-clay-600 block">Scheduled {when(b.scheduledAt)}</span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between pt-2 border-t border-sand-200">
                    <span className="text-xs text-clay-600">Transparency Audit: view full lifecycle & messages</span>
                    <LinkButton href={`/bookings/${b.id}`} variant="quiet" className="!py-1.5 !px-3 text-xs">
                      Open Audit & Live Chat
                    </LinkButton>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      )}

      {/* TAB 4: CONTRACTORS DIRECTORY */}
      {activeTab === 'contractors' && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-medium text-clay-900">Contractor Directory & Reliability</h2>
              <p className="text-xs text-clay-600">Track worker track record, completed jobs vs cancellations, and rating averages.</p>
            </div>
            {/* Filter buttons */}
            <div className="flex flex-wrap gap-1 text-xs">
              {['ALL', 'VERIFIED', 'PENDING', 'REJECTED'].map((st) => (
                <button
                  key={st}
                  onClick={() => setContractorStatus(st)}
                  className={`rounded-lg px-2.5 py-1.5 font-medium transition-colors ${
                    contractorStatus === st ? 'bg-clay-700 text-sand-50' : 'bg-sand-200 text-clay-800 hover:bg-sand-300'
                  }`}
                >
                  {st.toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {allContractors === null ? (
            <Loading />
          ) : allContractors.length === 0 ? (
            <Empty title="No contractors found with this filter" />
          ) : (
            <div className="space-y-3">
              {allContractors.map((c) => (
                <Card key={c.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-medium text-clay-900">{c.user?.fullName}</h3>
                      <p className="text-xs text-clay-700">
                        {c.user?.email} · {c.user?.phone} · City: {c.city}
                      </p>
                      <p className="mt-1 text-xs font-medium text-clay-800">
                        Trades: {c.categories.map((cat) => cat.category.name).join(', ')}
                      </p>
                    </div>
                    <Badge value={c.verificationStatus} />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-4 text-xs text-clay-800 pt-2 border-t border-sand-200">
                    <div>
                      <span className="text-clay-600">Rating: </span>
                      <span className="font-semibold">{c.reviewCount ? `${c.avgRating.toFixed(1)} ★ (${c.reviewCount} reviews)` : 'No reviews'}</span>
                    </div>
                    <div>
                      <span className="text-clay-600">Jobs Completed: </span>
                      <span className="font-semibold text-sage-700">{c.completedJobs}</span>
                    </div>
                    <div>
                      <span className="text-clay-600">Cancelled Jobs: </span>
                      <span className={`font-semibold ${c.cancelledJobs > 0 ? 'text-rust-700' : 'text-clay-700'}`}>{c.cancelledJobs}</span>
                    </div>
                    <div>
                      <span className="text-clay-600">Experience: </span>
                      <span className="font-semibold">{c.yearsExperience} yrs</span>
                    </div>
                  </div>

                  {c.verificationStatus === 'REJECTED' && c.rejectionReason && (
                    <p className="mt-2 text-xs text-rust-700 bg-rust-100/50 p-2 rounded-lg">
                      Rejection Reason: {c.rejectionReason}
                    </p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
