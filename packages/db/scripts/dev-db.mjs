// Runs a local PostgreSQL server (no Docker / sudo needed) using the `embedded-postgres`
// binaries. Data persists in packages/db/.data/pg. Set DATABASE_URL to use any other Postgres.
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PG_PORT ?? 54329);
const databaseDir = join(root, '.data', process.env.PG_DATA_NAME ?? 'pg');
const dbNames = (process.env.PG_DATABASES ?? 'post_tracker,post_tracker_test').split(',');

const pg = new EmbeddedPostgres({
  databaseDir,
  user: 'postgres',
  password: 'postgres',
  port,
  persistent: true,
  onLog: () => {},
});

const fresh = !existsSync(join(databaseDir, 'PG_VERSION'));
if (fresh) await pg.initialise();
await pg.start();
for (const name of dbNames) {
  try {
    await pg.createDatabase(name);
    console.log(`created database ${name}`);
  } catch {
    // already exists
  }
}
console.log(`PostgreSQL ready on postgresql://postgres:postgres@localhost:${port}/${dbNames[0]}`);

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
setInterval(() => {}, 1 << 30);
