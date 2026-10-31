import Link from 'next/link';
import { Cloud, MousePointer2, Users, Workflow } from 'lucide-react';
import { SignInButton } from '@/components/auth/SignInButton';

const features = [
  { icon: Users, title: 'Edit together, live', text: 'See collaborators’ cursors and selections, and every change the moment it happens.' },
  { icon: Cloud, title: 'Saved to your Google Drive', text: 'Diagrams are .drawio files in your Drive. Share them the way you already share files.' },
  { icon: MousePointer2, title: 'draw.io compatible', text: 'Open the same file in diagrams.net and back again; nothing is lost.' },
];

export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col">
      <header className="flex items-center gap-2 px-6 py-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-white">
          <Workflow size={17} />
        </span>
        <span className="font-semibold">Lineweave</span>
      </header>
      <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">Diagrams your whole team can draw at once</h1>
        <p className="mt-4 max-w-xl text-lg text-pretty text-muted">
          A modern take on draw.io with real-time collaboration, saved straight to Google Drive. Free.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <SignInButton />
          <Link href="/demo" className="inline-flex h-10 items-center rounded-md border border-border bg-panel px-4 text-sm font-medium hover:bg-panel-2">
            Try it without signing in
          </Link>
        </div>
        <ul className="mt-16 grid w-full gap-4 text-left sm:grid-cols-3">
          {features.map(({ icon: Icon, title, text }) => (
            <li key={title} className="rounded-xl border border-border bg-panel p-5">
              <Icon size={18} className="text-accent" />
              <h2 className="mt-3 text-sm font-semibold">{title}</h2>
              <p className="mt-1 text-sm text-muted">{text}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
