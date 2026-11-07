import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Nav } from '@/components/Nav';
import { AuthProvider } from '@/lib/auth';
import { QueryProvider } from "@/providers/query-provider";
import './globals.css';

export const metadata: Metadata = { title: 'SortItOut: describe the problem, get it fixed', description: 'Post a problem, compare quotes from verified local workers, and track the job to the end.' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <Nav />

          <main className="mx-auto max-w-5xl px-5 pb-20">{children}</main>
          
        </AuthProvider>
      </body>
    </html>
  );
}
