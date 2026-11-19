#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

if (process.env.ALLOW_AUTH_SCHEMA_OVERWRITE !== '1') {
	console.error(
		'Refusing to overwrite src/lib/server/db/auth.schema.ts.\n' +
			'Review manual fields, then run: ALLOW_AUTH_SCHEMA_OVERWRITE=1 pnpm auth:schema'
	);
	process.exit(1);
}

const result = spawnSync(
	'pnpm',
	[
		'exec',
		'better-auth',
		'generate',
		'--config',
		'src/lib/server/auth.ts',
		'--output',
		'src/lib/server/db/auth.schema.ts',
		'--yes'
	],
	{ stdio: 'inherit' }
);
process.exit(result.status ?? 1);
