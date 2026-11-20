import postgres from 'postgres';

const email = process.argv[2]?.trim();
if (!email) {
	console.error('Usage: pnpm admin:grant <email>');
	process.exit(1);
}
const url = process.env.DATABASE_URL;
if (!url) {
	console.error('DATABASE_URL is required');
	process.exit(1);
}

const client = postgres(url, { max: 1 });
try {
	const rows =
		await client`update "user" set role = 'admin', updated_at = now() where email = ${email} returning id, email`;
	if (rows.length === 0) {
		console.error('User not found: ' + email);
		process.exitCode = 1;
	} else {
		console.log('Admin granted: ' + rows[0].email);
	}
} finally {
	await client.end({ timeout: 5 });
}
