'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { Alert, Badge, Button, Card, Field, Loading, PageTitle, TextArea } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { useRequireAuth } from '@/lib/auth';
import type { Category, ContractorProfile } from '@/lib/types';

export default function Profile() {
  const user = useRequireAuth(['CONTRACTOR']);
  const [cats, setCats] = useState<Category[]>([]);
  const [profile, setProfile] = useState<ContractorProfile | null>(null);
  const [ready, setReady] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState(''); const [ok, setOk] = useState(''); const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    api<Category[]>('/categories', { auth: false }).then((r) => setCats(r.data));
    api<ContractorProfile>('/contractors/me/profile').then((r) => { setProfile(r.data); setPicked(r.data.categories.map((c) => c.category.id)); }).catch(() => undefined).finally(() => setReady(true));
  }, [user]);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError(''); setOk('');
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    try {
      const r = await api<ContractorProfile>('/contractors/me/profile', { method: 'PUT', body: {
        city: f.city, bio: f.bio, yearsExperience: Number(f.years || 0), categoryIds: picked,
        serviceAreas: f.areas.split(',').map((s) => s.trim()).filter(Boolean),
      } });
      setProfile(r.data); setOk('Profile saved.');
    } catch (err) { setError(err instanceof ApiError ? err.friendly : 'Could not save.'); } finally { setBusy(false); }
  }
  async function submit() {
    setBusy(true); setError(''); setOk('');
    try { setProfile((await api<ContractorProfile>('/contractors/me/submit-verification', { method: 'POST' })).data); setOk('Submitted. An admin will review it.'); }
    catch (err) { setError(err instanceof ApiError ? err.friendly : 'Could not submit.'); } finally { setBusy(false); }
  }

  if (!user || !ready) return <Loading />;
  const canSubmit = profile && ['UNSUBMITTED', 'REJECTED'].includes(profile.verificationStatus);
  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle title="Your profile" sub="Customers see this next to your quotes." action={profile && <Badge value={profile.verificationStatus} />} />
      {profile?.verificationStatus === 'REJECTED' && <div className="mb-4"><Alert>Rejected: {profile.rejectionReason}. Fix this, save, then submit again.</Alert></div>}
      <Card>
        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Main city" name="city" defaultValue={profile?.city} required />
            <Field label="Years of experience" name="years" type="number" min={0} max={60} defaultValue={profile?.yearsExperience ?? 0} />
          </div>
          <Field label="Other areas you serve" name="areas" defaultValue={profile?.serviceAreas.join(', ')} hint="Separate cities with commas." />
          <TextArea label="About you" name="bio" maxLength={1000} defaultValue={profile?.bio} />
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-clay-800">Your trades</legend>
            <div className="flex flex-wrap gap-2">{cats.map((c) => {
              const on = picked.includes(c.id);
              return <label key={c.id} className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-sm ${on ? 'border-clay-600 bg-clay-600 text-sand-50' : 'border-sand-300 bg-sand-100 text-ink'}`}>
                <input type="checkbox" className="sr-only" checked={on} onChange={() => setPicked(on ? picked.filter((x) => x !== c.id) : [...picked, c.id])} />{c.name}</label>;
            })}</div>
          </fieldset>
          <Alert>{error}</Alert><Alert kind="ok">{ok}</Alert>
          <div className="flex flex-wrap gap-3">
            <Button disabled={busy || picked.length === 0}>Save profile</Button>
            {canSubmit && <Button type="button" variant="quiet" disabled={busy} onClick={submit}>Submit for verification</Button>}
          </div>
        </form>
      </Card>
    </div>
  );
}
