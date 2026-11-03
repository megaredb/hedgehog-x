import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

let databaseUrl = process.env.DATABASE_URL;
try {
	const dynamicPrivate = await import('$env/dynamic/private');
	if (dynamicPrivate?.env?.DATABASE_URL) {
		databaseUrl = dynamicPrivate.env.DATABASE_URL;
	}
} catch {
	// Fallback to process.env in standalone scripts / tests
}

const client = postgres(databaseUrl ?? 'postgres://root:mysecretpassword@localhost:5432/local');

export const db = drizzle(client, { schema });
