import { signOut } from '@/lib/server/googleAuth';

export async function POST() {
  await signOut();
  return new Response(null, { status: 204 });
}
