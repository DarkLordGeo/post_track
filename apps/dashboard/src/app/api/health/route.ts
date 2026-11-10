import { prisma } from '@post-tracker/db';
import { json, preflight } from '@/lib/http';

export const dynamic = 'force-dynamic';
export const OPTIONS = preflight;

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return json({ ok: true, app: 'post-tracker', version: '0.1.0' });
  } catch {
    return json({ ok: false, error: 'Database unreachable' }, { status: 503 });
  }
}
