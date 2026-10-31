import type { Metadata } from 'next';
import { ClientOnlyEditor } from '@/components/sessions/ClientOnly';

export const metadata: Metadata = { title: 'Demo' };

export default function DemoPage() {
  return <ClientOnlyEditor kind="demo" />;
}
