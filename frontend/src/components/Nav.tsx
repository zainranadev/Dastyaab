'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { NotificationsMenu } from './NotificationsMenu';

export function Nav() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const links = !user ? [] : user.role === 'ADMIN' ? [['Admin Hub', '/admin']] : user.role === 'CUSTOMER'
    ? [['My problems', '/dashboard'], ['Bookings', '/bookings']] : [['Matching jobs', '/dashboard'], ['Bookings', '/bookings'], ['My profile', '/profile']];
  return (
    <nav className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-4" aria-label="Main">
      <Link href="/" className="font-serif text-xl text-clay-700">Sort<span className="text-clay-500">it</span>Out</Link>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {links.map(([label, href]) => <Link key={href} href={href} className="rounded-lg px-3 py-2 text-clay-800 hover:bg-sand-200">{label}</Link>)}
        {user ? (
          <>
            <NotificationsMenu />
            <button onClick={async () => { await logout(); router.push('/'); }} className="rounded-lg px-3 py-2 text-clay-800 hover:bg-sand-200">Log out</button>
          </>
        ) : (
          <>
            <Link href="/login" className="rounded-lg px-3 py-2 text-clay-800 hover:bg-sand-200">Log in</Link>
            <Link href="/register" className="rounded-xl bg-clay-600 px-4 py-2 font-medium text-sand-50 shadow-earth hover:bg-clay-700">Sign up</Link>
          </>
        )}
      </div>
    </nav>
  );
}
