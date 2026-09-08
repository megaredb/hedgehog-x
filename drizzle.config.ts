import { defineConfig } from 'drizzle-kit';

// generate/check работают без подключения к БД; URL нужен только командам,
// которые ходят в базу (push/migrate/pull).
const urlRequiredCommands = ['push', 'migrate', 'pull'];
const command = process.argv[2];
if (urlRequiredCommands.includes(command) && !process.env.DATABASE_URL) {
	throw new Error('DATABASE_URL is not set');
}

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	out: './drizzle',
	dialect: 'postgresql',
	dbCredentials: { url: process.env.DATABASE_URL ?? '' },
	verbose: true,
	strict: true
});
