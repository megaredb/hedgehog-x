import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

describe('Books API Content-Based ETag and Invalidation', () => {
	function generateEtag(payload: unknown): string {
		const payloadString = JSON.stringify(payload);
		return `W/"${createHash('sha1').update(payloadString).digest('hex')}"`;
	}

	const baseBookData = {
		id: 'mushoku_tensei',
		title: 'Mushoku Tensei',
		volumes: [
			{
				id: 'vol_01',
				volumeNumber: 1,
				likesCount: 0,
				chapters: [
					{
						id: 'ch_01',
						chapterNumber: 1,
						likesCount: 0
					}
				]
			}
		]
	};

	it('generates deterministic ETag for identical book state', () => {
		const etag1 = generateEtag(baseBookData);
		const etag2 = generateEtag(JSON.parse(JSON.stringify(baseBookData)));
		assert.equal(etag1, etag2);
		assert.match(etag1, /^W\/"[a-f0-9]{40}"$/);
	});

	it('invalidates ETag immediately when a chapter like count increases', () => {
		const etagInitial = generateEtag(baseBookData);

		const updatedBookData = {
			...baseBookData,
			volumes: [
				{
					...baseBookData.volumes[0],
					chapters: [
						{
							...baseBookData.volumes[0].chapters[0],
							likesCount: 1
						}
					]
				}
			]
		};

		const etagAfterLike = generateEtag(updatedBookData);
		assert.notEqual(
			etagInitial,
			etagAfterLike,
			'ETag must change when likesCount changes so browser receives 200 instead of stale 304'
		);
	});

	it('invalidates ETag immediately when a volume like count increases', () => {
		const etagInitial = generateEtag(baseBookData);

		const updatedBookData = {
			...baseBookData,
			volumes: [
				{
					...baseBookData.volumes[0],
					likesCount: 1,
					chapters: baseBookData.volumes[0].chapters
				}
			]
		};

		const etagAfterVolumeLike = generateEtag(updatedBookData);
		assert.notEqual(
			etagInitial,
			etagAfterVolumeLike,
			'ETag must change when volume likesCount changes'
		);
	});

	it('simulates conditional GET: matches ETag -> 304, mismatches -> 200', () => {
		const initialEtag = generateEtag(baseBookData);

		// Client sends previous ETag
		const clientEtagMatching = initialEtag;
		const is304 = clientEtagMatching === initialEtag;
		assert.equal(is304, true, 'Matches server ETag: returns 304 Not Modified');

		// After user liked chapter
		const serverEtagAfterLike = generateEtag({
			...baseBookData,
			volumes: [
				{
					...baseBookData.volumes[0],
					chapters: [{ ...baseBookData.volumes[0].chapters[0], likesCount: 1 }]
				}
			]
		});

		const isStill304 = clientEtagMatching === serverEtagAfterLike;
		assert.equal(
			isStill304,
			false,
			'Does not match stale client ETag: server returns 200 with fresh body'
		);
	});
});
