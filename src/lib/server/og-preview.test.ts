import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
	fetchLinkPreview,
	isAllowedPreviewUrl,
	isPrivateIp,
	readLimitedResponseText
} from './og-preview';

describe('og-preview SSRF and size protections', () => {
	it('identifies private, loopback, link-local, and IPv4-mapped IPv6 addresses', () => {
		for (const ip of [
			'127.0.0.1',
			'10.0.0.1',
			'172.16.0.1',
			'172.31.255.254',
			'192.168.1.10',
			'169.254.169.254',
			'0.0.0.0',
			'::1',
			'::',
			'fc00::1',
			'fd12:3456::1',
			'fe80::1',
			'::ffff:127.0.0.1',
			'::ffff:7f00:1'
		]) {
			assert.strictEqual(isPrivateIp(ip), true, `Expected ${ip} to be private`);
		}

		for (const ip of ['8.8.8.8', '1.1.1.1', '172.32.0.1', '2606:4700:4700::1111']) {
			assert.strictEqual(isPrivateIp(ip), false, `Expected ${ip} to be public`);
		}
	});

	it('enforces allowed hosts and ports 80/443 only', () => {
		assert.strictEqual(isAllowedPreviewUrl('https://t.me/channel'), true);
		assert.strictEqual(isAllowedPreviewUrl('https://t.me:443/channel'), true);
		assert.strictEqual(isAllowedPreviewUrl('http://t.me:80/channel'), true);
		assert.strictEqual(isAllowedPreviewUrl('https://t.me:8080/channel'), false);
		assert.strictEqual(isAllowedPreviewUrl('https://evil.example/page'), false);
		assert.strictEqual(isAllowedPreviewUrl('ftp://t.me/file'), false);
	});

	it('blocks redirects to private IPs or disallowed hosts and enforces max 3 hops', async () => {
		const publicLookup = (async () => [{ address: '149.154.167.99', family: 4 }]) as never;
		const privateLookup = (async () => [{ address: '169.254.169.254', family: 4 }]) as never;

		// Redirect to disallowed host
		const blockedHost = await fetchLinkPreview('https://t.me/start', undefined, {
			bypassCache: true,
			lookupImpl: publicLookup,
			fetchImpl: (async () =>
				new Response(null, {
					status: 302,
					headers: { location: 'https://evil.example/secret' }
				})) as typeof fetch
		});
		assert.strictEqual(blockedHost, null);

		// DNS resolves to metadata IP
		const blockedPrivate = await fetchLinkPreview('https://t.me/private', undefined, {
			bypassCache: true,
			lookupImpl: privateLookup,
			fetchImpl: (async () => {
				throw new Error('fetch must not be called for private IP');
			}) as typeof fetch
		});
		assert.strictEqual(blockedPrivate, null);

		// Too many redirects (4 hops)
		let calls = 0;
		const tooManyHops = await fetchLinkPreview('https://t.me/loop0', undefined, {
			bypassCache: true,
			lookupImpl: publicLookup,
			fetchImpl: (async () => {
				calls += 1;
				return new Response(null, {
					status: 302,
					headers: { location: `https://t.me/loop${calls}` }
				});
			}) as typeof fetch
		});
		assert.strictEqual(tooManyHops, null);
		assert.strictEqual(calls, 4);

		// Valid 1-hop redirect with OG metadata
		let step = 0;
		const ok = await fetchLinkPreview('https://t.me/valid0', undefined, {
			bypassCache: true,
			lookupImpl: publicLookup,
			fetchImpl: (async () => {
				step += 1;
				if (step === 1) {
					return new Response(null, {
						status: 302,
						headers: { location: 'https://t.me/valid1' }
					});
				}
				return new Response(
					'<html><head><meta property="og:title" content="Hedgehog"></head></html>',
					{ status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } }
				);
			}) as typeof fetch
		});
		assert.deepStrictEqual(ok, {
			url: 'https://t.me/valid1',
			title: 'Hedgehog',
			description: null,
			image: null
		});
	});

	it('stops reading response stream at the byte limit', async () => {
		let chunksRead = 0;
		const stream = new ReadableStream<Uint8Array>({
			pull(controller) {
				chunksRead += 1;
				controller.enqueue(new Uint8Array(1024).fill(65));
			}
		});
		const response = new Response(stream, {
			headers: { 'content-type': 'text/html' }
		});
		const text = await readLimitedResponseText(response, 4096);
		assert.strictEqual(text.length, 4096);
		assert.strictEqual(chunksRead, 4);
	});
});
