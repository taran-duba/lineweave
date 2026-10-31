import Link from 'next/link';
import { ArrowRight, Cable, FileDown, FileInput, History, Layers, Workflow, Zap } from 'lucide-react';
import { SignInButton } from '@/components/auth/SignInButton';
import { COPYRIGHT } from '@/components/landing/LegalPage';
import { HeroDiagram } from '@/components/landing/HeroDiagram';
import { Reveal } from '@/components/landing/Reveal';
import { Showcase } from '@/components/landing/Showcase';
import { SpotlightCard } from '@/components/landing/SpotlightCard';

const features = [
  { icon: Cable, title: 'Electrical schematics', text: 'draw.io’s electrical stencils under the same shape names, so files render identically in both editors.' },
  { icon: Zap, title: 'FRC palettes', text: 'Robotics-ready shape libraries alongside core, extra and thousands of Lucide icons.' },
  { icon: FileInput, title: 'Import anything', text: 'Bring in Mermaid, CSV and Visio (.vsdx) and keep editing as native shapes.' },
  { icon: History, title: 'Comments & history', text: 'Discuss on the canvas and step back through versions stored with your file.' },
  { icon: Layers, title: 'Pages & layers', text: 'Multi-page diagrams, layers and wires with line jumps, just like you’d expect.' },
  { icon: FileDown, title: 'Export cleanly', text: 'Send diagrams out as images or PDF whenever you need them.' },
];

// Signed-in users never reach this page: src/proxy.ts redirects them to /files.
export default function Home() {
  return (
    <main className="relative flex flex-col overflow-x-clip">
      <div className="lw-progress" aria-hidden />

      <header className="sticky top-0 z-30 border-b border-transparent backdrop-blur-md [animation:lw-nav_linear_both] [animation-range:0_160px] [animation-timeline:scroll()]">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-6 py-3.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-white"><Workflow size={17} /></span>
          <span className="font-semibold">Lineweave</span>
          <Link href="/demo" className="ml-auto text-sm text-muted transition-colors hover:text-text">Try the demo</Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative mx-auto w-full max-w-6xl px-6 pt-10 pb-24 sm:pt-16">
        <div className="lw-blob lw-blob-a" aria-hidden />
        <div className="lw-blob lw-blob-b" aria-hidden />
        <div className="relative mx-auto max-w-3xl text-center">
          <p className="lw-rise inline-flex items-center gap-2 rounded-full border border-border bg-panel/80 px-3 py-1 text-xs font-medium text-muted backdrop-blur" style={{ animationDelay: '0ms' }}>
            <span className="h-1.5 w-1.5 rounded-full bg-orange-500" /> Real-time · Google Drive · Free
          </p>
          <h1 className="lw-rise mt-6 text-5xl font-semibold tracking-tight text-balance sm:text-7xl" style={{ animationDelay: '80ms' }}>
            Diagrams your whole team can <span className="lw-gradient-text">draw at once</span>
          </h1>
          <p className="lw-rise mx-auto mt-6 max-w-xl text-lg text-pretty text-muted sm:text-xl" style={{ animationDelay: '160ms' }}>
            A modern take on draw.io with live collaboration, saved straight to your Google Drive as standard .drawio files.
          </p>
          <div className="lw-rise mt-9 flex flex-wrap items-center justify-center gap-3" style={{ animationDelay: '240ms' }}>
            <SignInButton />
            <Link href="/demo" className="group inline-flex h-10 items-center gap-1.5 rounded-md border border-border bg-panel px-4 text-sm font-medium transition-colors hover:bg-panel-2">
              Try it without signing in <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>

        <div className="lw-rise relative mx-auto mt-16 max-w-3xl [perspective:1400px]" style={{ animationDelay: '360ms' }}>
          <div className="lw-hero-frame overflow-hidden rounded-2xl border border-border bg-panel shadow-[0_30px_80px_-30px_rgba(15,118,110,0.4)]">
            <div className="flex items-center gap-1.5 border-b border-border bg-panel-2 px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-border" /><span className="h-2.5 w-2.5 rounded-full bg-border" /><span className="h-2.5 w-2.5 rounded-full bg-border" />
              <span className="ml-3 text-xs text-muted">team-architecture.drawio</span>
            </div>
            <div className="p-3 sm:p-5"><HeroDiagram /></div>
          </div>
        </div>
      </section>

      {/* Story */}
      <section className="relative">
        <Reveal className="mx-auto max-w-2xl px-6 text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-5xl">Built for teams that live in Drive</h2>
          <p className="mt-4 text-lg text-muted">Collaboration without a new silo to manage.</p>
        </Reveal>
        <div className="mt-8"><Showcase /></div>
      </section>

      {/* Feature grid */}
      <section className="mx-auto w-full max-w-6xl px-6 py-24">
        <Reveal className="max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-5xl">Everything else you reach for</h2>
        </Reveal>
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, text }, i) => (
            <Reveal key={title} as="li" delay={(i % 3) * 90}>
              <SpotlightCard className="h-full rounded-2xl border border-border bg-panel p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-accent"><Icon size={19} /></span>
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm text-pretty text-muted">{text}</p>
              </SpotlightCard>
            </Reveal>
          ))}
        </ul>
      </section>

      {/* CTA */}
      <section className="px-6 pb-24">
        <Reveal className="lw-cta relative mx-auto max-w-4xl overflow-hidden rounded-3xl border border-border px-6 py-16 text-center">
          <h2 className="relative text-3xl font-semibold tracking-tight text-balance sm:text-5xl">Start drawing together</h2>
          <p className="relative mx-auto mt-3 max-w-md text-lg text-muted">Sign in with Google and your first diagram is a click away.</p>
          <div className="relative mt-8 flex justify-center"><SignInButton /></div>
        </Reveal>
      </section>

      <footer className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 border-t border-border px-6 py-6 text-xs text-muted">
        <span>Lineweave · Diagrams stay in your Google Drive</span>
        <span>{COPYRIGHT}</span>
        <Link href="/terms-of-service" className="hover:text-text">Terms of Service</Link>
        <Link href="/privacy-policy" className="hover:text-text">Privacy Policy</Link>
      </footer>
    </main>
  );
}
