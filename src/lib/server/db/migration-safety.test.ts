import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const DRIZZLE_DIR = join(process.cwd(), 'drizzle');

function migrationFiles(): string[] {
	return readdirSync(DRIZZLE_DIR)
		.filter((file) => file.endsWith('.sql'))
		.map((file) => join(DRIZZLE_DIR, file));
}

const SENSITIVE_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
	{
		name: 'TON wallet address',
		pattern: /\b(?:UQ|EQ)[A-Za-z0-9_-]{20,}\b|\b-?\d+:[0-9a-fA-F]{64}\b/
	},
	{
		name: 'card number',
		pattern: /\b(?:\d{4}[ -]\d{4}[ -]\d{4}[ -]\d{4}|\d{16})\b/
	},
	{
		name: 'private key',
		pattern: /BEGIN (?:RSA|OPENSSH|EC|PGP) PRIVATE KEY/
	},
	{
		name: 'known API/secret token',
		pattern: /\b(?:sk_(?:live|test)_|whsec_|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,})/
	},
	{
		name: 'literal password/secret assignment',
		pattern: /\b(?:password|passwd|api[_-]?key|secret|token)\s*=\s*['"][^'"]{8,}['"]/i
	}
];

test('migrations contain no wallet, card, key, password or secret literals', () => {
	const violations: string[] = [];
	for (const file of migrationFiles()) {
		const sql = readFileSync(file, 'utf8');
		for (const { name, pattern } of SENSITIVE_PATTERNS) {
			if (pattern.test(sql)) violations.push(`${name}: ${file.split('/').pop()}`);
		}
	}
	assert.deepEqual(violations, []);
});

test('migration directory does not embed remote URLs with credentials', () => {
	const violations: string[] = [];
	for (const file of migrationFiles()) {
		const sql = readFileSync(file, 'utf8');
		if (/https?:\/\/[^\s'"]+:[^\s'"]+@/i.test(sql)) {
			violations.push(file.split('/').pop() ?? file);
		}
	}
	assert.deepEqual(violations, []);
});
