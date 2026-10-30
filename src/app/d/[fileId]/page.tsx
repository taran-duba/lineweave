import { ClientOnlyEditor } from '@/components/sessions/ClientOnly';

// The editor is client-only; it reads the file id from the URL in the browser.
export default function DiagramPage() {
  return <ClientOnlyEditor kind="drive" />;
}
