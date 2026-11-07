'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Alert, Button, Card, Field, PageTitle, Select, TextArea } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { useRequireAuth } from '@/lib/auth';
import type { Category, Problem } from '@/lib/types';

export default function NewProblem() {
  const user = useRequireAuth(['CUSTOMER']);
  const router = useRouter();
  const [cats, setCats] = useState<Category[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { api<Category[]>('/categories', { auth: false }).then((r) => setCats(r.data)); }, []);

  function pick(list: FileList | null) {
    const chosen = Array.from(list ?? []);
    if (chosen.length > 5) return setError('You can attach up to 5 photos.');
    const bad = chosen.find((f) => !['image/jpeg', 'image/png', 'image/webp'].includes(f.type) || f.size > 5 * 1024 * 1024);
    if (bad) return setError(`${bad.name}: photos must be jpg, png or webp, up to 5 MB each.`);
    setError(''); setFiles(chosen);
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError('');
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const body: Record<string, unknown> = { title: f.title, description: f.description, categoryId: f.categoryId, city: f.city, area: f.area || undefined, urgency: f.urgency };
    if (f.budgetMin) body.budgetMin = Number(f.budgetMin);
    if (f.budgetMax) body.budgetMax = Number(f.budgetMax);
    try {
      const { data } = await api<Problem>('/problems', { body });
      if (files.length) {
        const form = new FormData(); files.forEach((file) => form.append('files', file));
        await api(`/problems/${data.id}/media`, { form });
      }
      router.push(`/problems/${data.id}`);
    } catch (err) { setError(err instanceof ApiError ? err.friendly : 'Could not post the problem.'); setBusy(false); }
  }
  if (!user) return null;
  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle title="Post a problem" sub="The clearer the description, the better the quotes." />
      <Card>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Title" name="title" minLength={5} maxLength={100} placeholder="Kitchen sink is leaking" required />
          <TextArea label="What is wrong?" name="description" minLength={20} maxLength={2000} placeholder="When did it start? What have you already tried?" required />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Trade" name="categoryId" required defaultValue=""><option value="" disabled>Choose a trade</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
            <Select label="How urgent?" name="urgency" defaultValue="THIS_WEEK">
              <option value="EMERGENCY">Emergency</option><option value="TODAY">Today</option><option value="THIS_WEEK">This week</option><option value="FLEXIBLE">Flexible</option>
            </Select>
            <Field label="City" name="city" required />
            <Field label="Area or address" name="area" />
            <Field label="Budget from (Rs)" name="budgetMin" type="number" min={0} />
            <Field label="Budget up to (Rs)" name="budgetMax" type="number" min={0} />
          </div>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-clay-800">Photos (up to 5)</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => pick(e.target.files)} className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-sand-200 file:px-3 file:py-2 file:text-clay-800" />
          </label>
          <Alert>{error}</Alert>
          <Button disabled={busy}>{busy ? 'Posting…' : 'Post problem'}</Button>
        </form>
      </Card>
    </div>
  );
}
