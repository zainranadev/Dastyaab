'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Alert, Badge, Card, Empty, Loading, PageTitle } from '@/components/ui';
import { ApiError, api, pkr, when } from '@/lib/api';
import { useRequireAuth } from '@/lib/auth';
import type { Booking } from '@/lib/types';

export default function Bookings() {
  const user = useRequireAuth(['CUSTOMER', 'CONTRACTOR']);
  const [rows, setRows] = useState<Booking[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { if (user) api<Booking[]>('/bookings?limit=50').then((r) => setRows(r.data)).catch((e) => setError(e instanceof ApiError ? e.friendly : 'Could not load.')); }, [user]);
  if (!user) return <Loading />;
  return (
    <>
      <PageTitle title="Bookings" sub="Jobs that have a quote accepted." />
      <Alert>{error}</Alert>
      {rows === null ? <Loading /> : rows.length === 0 ? <Empty title="No bookings yet">A booking appears when a customer accepts a quote.</Empty> : (
        <div className="space-y-4">{rows.map((b) => {
          const other = user.role === 'CUSTOMER' ? b.contractor : b.customer;
          return (
            <Link key={b.id} href={`/bookings/${b.id}`} className="block">
              <Card className="transition-shadow hover:shadow-lift">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div><h3 className="text-lg">{b.problem.title}</h3><p className="text-sm text-clay-700">{other.fullName} · {pkr(b.agreedPrice)} · scheduled {when(b.scheduledAt)}</p></div>
                  <div className="flex gap-2"><Badge value={b.status} /><Badge value={b.paymentStatus} /></div>
                </div>
              </Card>
            </Link>
          );
        })}</div>
      )}
    </>
  );
}
