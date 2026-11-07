'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Alert, Button, Card, Field } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function Login() {
  const { login } = useAuth();
  const router = useRouter();
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError('');
    const f = new FormData(e.currentTarget);
    try { const u = await login(String(f.get('email')), String(f.get('password'))); router.push(u.role === 'ADMIN' ? '/admin' : '/dashboard'); }
    catch (err) { setError(err instanceof ApiError ? err.friendly : 'Could not log in.'); setBusy(false); }
  }
  return (
    <div className="mx-auto mt-8 max-w-md">
      <h1 className="mb-5 text-3xl">Log in</h1>
      <Card>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email" name="email" type="email" autoComplete="email" required />
          <Field label="Password" name="password" type="password" autoComplete="current-password" required />
          <Alert>{error}</Alert>
          <Button disabled={busy} className="w-full">{busy ? 'Logging in…' : 'Log in'}</Button>
        </form>
      </Card>
      <p className="mt-4 text-sm text-clay-700">New here? <Link className="underline" href="/register">Create an account</Link></p>
    </div>
  );
}
