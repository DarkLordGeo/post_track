import { collectDue } from '@/server/collector';
import { json, preflight } from '@/lib/http';

export const dynamic = 'force-dynamic';
export const OPTIONS = preflight;

/** Run one collection pass over due posts (for cron/manual triggering). */
export async function POST() {
  return json(await collectDue());
}
