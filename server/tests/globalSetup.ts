/** Applies migrations to the test database once before the suite runs. */
export async function setup() {
  process.env.NODE_ENV = 'test';
  const { migrate } = await import('../src/db/migrate.js');
  const { pool } = await import('../src/db/pool.js');
  await migrate(false);
  await pool.end();
}
