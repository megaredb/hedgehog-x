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

// adapter-node emits this after the HTTP server has stopped accepting requests.
// Without closing postgres-js, its pool keeps the process alive until Docker
// sends SIGKILL, so the container is never actually graceful.
process.once('sveltekit:shutdown', async () => {
	try {
		await client.end({ timeout: 5 });
	} catch {
		// Already closed or shutdown deadline exceeded.
	}
});
