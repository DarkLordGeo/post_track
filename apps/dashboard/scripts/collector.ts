/**
 * Background engagement collector. Runs forever, collecting snapshots for posts whose
 * `nextCollectAt` has passed. Usage: `pnpm collector` (add `--once` for a single pass).
 */
import { collectDue } from '../src/server/collector';
import { prisma } from '@post-tracker/db';

const TICK_MS = Number(process.env.COLLECTOR_TICK_MS ?? 60_000);
const once = process.argv.includes('--once');

async function tick() {
  const started = Date.now();
  try {
    const s = await collectDue();
    if (s.checked > 0 || once) {
      console.log(
        `[collector] ${new Date().toISOString()} checked=${s.checked} collected=${s.collected} failed=${s.failed} unavailable=${s.unavailable} skipped=${s.skipped}` +
          (s.rateLimited.length ? ` rateLimited=${s.rateLimited.join(',')}` : '') +
          ` (${Date.now() - started}ms)`,
      );
      for (const note of s.notes) console.log(`[collector]   note: ${note}`);
    }
  } catch (err) {
    console.error('[collector] tick failed:', err);
  }
}

if (once) {
  await tick();
  await prisma.$disconnect();
} else {
  console.log(`[collector] running every ${TICK_MS / 1000}s`);
  await tick();
  setInterval(tick, TICK_MS);
}
