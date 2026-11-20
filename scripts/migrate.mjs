import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
	console.error('[migrate] DATABASE_URL is required');
	process.exit(1);
}

const client = postgres(databaseUrl, { max: 1 });
try {
	await migrate(drizzle(client), {
		migrationsFolder: process.env.MIGRATIONS_FOLDER || '/app/drizzle'
	});
	console.log('[migrate] Database migrations applied');
} catch (err) {
	console.error('[migrate] Migration failed:', err);
	process.exitCode = 1;
} finally {
	await client.end({ timeout: 5 });
}
