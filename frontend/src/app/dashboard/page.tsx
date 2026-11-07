'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Alert, Badge, Card, Empty, Loading, LinkButton, PageTitle } from '@/components/ui';
import { ApiError, api, pkr } from '@/lib/api';
import { useRequireAuth } from '@/lib/auth';
import type { ContractorProfile, Problem } from '@/lib/types';

function ProblemRow({ p, contractor }: { p: Problem; contractor?: boolean }) {
  const mine = p.quotes?.[0];
  return (
    <Link href={`/problems/${p.id}`} className="block">
      <Card className="transition-shadow hover:shadow-lift">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-lg">{p.title}</h3>
            <p className="text-sm text-clay-700">{p.category.name} · {p.city}{p.area ? `, ${p.area}` : ''} · {p.urgency.replaceAll('_', ' ').toLowerCase()}</p>
          </div>
          <div className="flex items-center gap-2">
            {contractor && mine && <span className="text-sm text-clay-700">Your quote {pkr(mine.price)}</span>}
            <Badge value={p.status} />
          </div>
        </div>
        <p className="mt-2 text-sm text-clay-700">{p._count.quotes} {p._count.quotes === 1 ? 'quote' : 'quotes'}</p>
      </Card>
    </Link>
  );
}

export default function Dashboard() {
  const user = useRequireAuth();
  const [problems, setProblems] = useState<Problem[] | null>(null);
  const [profile, setProfile] = useState<ContractorProfile | null | undefined>(undefined);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    if (user.role === 'ADMIN') { window.location.replace('/admin'); return; }
    if (user.role === 'CONTRACTOR') {
      api<ContractorProfile>('/contractors/me/profile').then((r) => setProfile(r.data)).catch(() => setProfile(null));
    }
    api<Problem[]>('/problems?limit=50').then((r) => setProblems(r.data)).catch((e) => {
      if (e instanceof ApiError && e.code === 'CONTRACTOR_NOT_VERIFIED') setProblems([]); else setError(e instanceof ApiError ? e.friendly : 'Could not load.');
    });
  }, [user]);

  if (!user) return <Loading />;

  if (user.role === 'CUSTOMER') {
    return (
      <>
        <PageTitle title="Your problems" sub="Everything you have posted, and the quotes coming in." action={<LinkButton href="/problems/new">Post a problem</LinkButton>} />
        <Alert>{error}</Alert>
        {problems === null ? <Loading /> : problems.length === 0 ? (
          <Empty title="Nothing posted yet">Describe what needs fixing and workers will send you quotes.</Empty>
        ) : <div className="space-y-4">{problems.map((p) => <ProblemRow key={p.id} p={p} />)}</div>}
      </>
    );
  }

  const verified = profile?.verificationStatus === 'VERIFIED';
  return (
    <>
      <PageTitle title="Matching jobs" sub="Open problems in your trades and cities." />
      {!verified && profile !== undefined && (
        <Card className="mb-6 border-ochre-700/30 bg-ochre-100/60">
          <h2 className="text-lg">{profile === null ? 'Set up your profile to start quoting' : `Verification: ${profile.verificationStatus.toLowerCase()}`}</h2>
          <p className="mt-1 text-sm text-clay-800">
            {profile === null ? 'Add your trades and city, then submit for verification.'
              : profile.verificationStatus === 'PENDING' ? 'An admin is reviewing your profile. You can quote as soon as it is approved.'
              : profile.verificationStatus === 'REJECTED' ? `Rejected: ${profile.rejectionReason}. Update your profile and resubmit.`
              : 'Submit your profile for verification so you can see jobs and send quotes.'}
          </p>
          <div className="mt-3"><LinkButton href="/profile" variant="quiet">Open my profile</LinkButton></div>
        </Card>
      )}
      <Alert>{error}</Alert>
      {verified && (problems === null ? <Loading /> : problems.length === 0 ? (
        <Empty title="No matching jobs right now">New problems in your trades and cities will show up here.</Empty>
      ) : <div className="space-y-4">{problems.map((p) => <ProblemRow key={p.id} p={p} contractor />)}</div>)}
    </>
  );
}
