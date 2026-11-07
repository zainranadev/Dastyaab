'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { Alert, Button, Card, Field, Select } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';

function Form() {
  const { register } = useAuth();
  const router = useRouter();
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const preset = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('role') === 'CONTRACTOR' ? 'CONTRACTOR' : 'CUSTOMER';

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError('');
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    try { const u = await register(f); router.push(u.role === 'CONTRACTOR' ? '/profile' : '/dashboard'); }
    catch (err) { setError(err instanceof ApiError ? err.friendly : 'Could not create the account.'); setBusy(false); }
  }
  return (
    <div className="mx-auto mt-8 max-w-md">
      <h1 className="mb-5 text-3xl">Create your account</h1>
      <Card>
        <form onSubmit={submit} className="space-y-4">
          <Select label="I want to" name="role" defaultValue={preset}>
            <option value="CUSTOMER">Get a problem fixed</option>
            <option value="CONTRACTOR">Offer my services</option>
          </Select>
          <Field label="Full name" name="fullName" autoComplete="name" required />
          <Field label="Email" name="email" type="email" autoComplete="email" required />
          <Field label="Phone" name="phone" type="tel" autoComplete="tel" placeholder="+923001234567" hint="Shared only with the other person once a job is booked." required />
          <Field label="Password" name="password" type="password" autoComplete="new-password" hint="At least 8 characters, with a letter and a number." required />
          <Alert>{error}</Alert>
          <Button disabled={busy} className="w-full">{busy ? 'Creating…' : 'Create account'}</Button>
        </form>
      </Card>
      <p className="mt-4 text-sm text-clay-700">Already registered? <Link className="underline" href="/login">Log in</Link></p>
    </div>
  );
}
export default function Register() { return <Suspense><Form /></Suspense>; }
