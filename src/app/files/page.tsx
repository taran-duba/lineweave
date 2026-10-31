import type { Metadata } from 'next';
import { FilesClient } from '@/components/files/FilesClient';

export const metadata: Metadata = { title: 'Your diagrams' };

export default function FilesPage() {
  return <FilesClient />;
}
