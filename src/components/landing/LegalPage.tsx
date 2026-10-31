import Link from 'next/link';
import type { ReactNode } from 'react';
import { Workflow } from 'lucide-react';

export const LEGAL_UPDATED = 'October 31, 2026';

export const CONTACT_EMAIL = 'taran.duba3@gmail.com';
export const COPYRIGHT = '© 2026 Taran Duba';

export function ContactLine() {
  return (
    <p>
      Contact: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
    </p>
  );
}

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-white"><Workflow size={15} /></span>
        Lineweave
      </Link>
      <h1 className="mt-10 text-4xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted">Last updated {LEGAL_UPDATED}</p>
      <div className="mt-8 space-y-4 leading-relaxed text-pretty text-muted [&_a]:text-accent [&_a]:underline [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-text [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_strong]:text-text [&_ul]:space-y-1.5">
        {children}
      </div>
      <nav className="mt-14 flex gap-5 border-t border-border pt-6 text-sm text-muted">
        <Link href="/terms-of-service" className="hover:text-text">Terms of Service</Link>
        <Link href="/privacy-policy" className="hover:text-text">Privacy Policy</Link>
        <span className="ml-auto">{COPYRIGHT}</span>
      </nav>
    </main>
  );
}
