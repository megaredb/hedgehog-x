import assert from 'node:assert/strict';
import test from 'node:test';
import {
	BROADCAST_CHECK_INTERVAL_MS,
	broadcastWasDeleted,
	replayResumeOffset
} from './broadcast-player';

function response(status: number): Response {
	return new Response(null, { status });
}

test('broadcast deletion probe treats 404 as deleted', async () => {
	let requested = '';
	const deleted = await broadcastWasDeleted('live-1', async (input) => {
		requested = String(input);
		return response(404);
	});
	assert.equal(deleted, true);
	assert.equal(requested, '/api/broadcasts/live-1/status');
});

test('broadcast deletion probe keeps playback on ok and non-404 errors', async () => {
	for (const status of [200, 401, 403, 500]) {
		assert.equal(
			await broadcastWasDeleted('live-1', async () => response(status)),
			false,
			`status ${status} must not clear the player`
		);
	}
});

test('broadcast deletion probe ignores network failures', async () => {
	assert.equal(
		await broadcastWasDeleted('live-1', async () => {
			throw new Error('offline');
		}),
		false
	);
});

test('broadcast deletion probe encodes the broadcast id and ignores empty ids', async () => {
	let requested = '';
	await broadcastWasDeleted('id/with spaces', async (input) => {
		requested = String(input);
		return response(200);
	});
	assert.equal(requested, '/api/broadcasts/id%2Fwith%20spaces/status');
	assert.equal(await broadcastWasDeleted('', async () => response(404)), false);
	assert.equal(BROADCAST_CHECK_INTERVAL_MS, 5_000);
});

test('replay resume uses saved replay position within duration', () => {
	assert.equal(
		replayResumeOffset({ kind: 'replay', positionSeconds: 42, isCompleted: false }, 100),
		42
	);
	assert.equal(
		replayResumeOffset({ kind: 'replay', positionSeconds: 150, isCompleted: false }, 100),
		100
	);
});

test('replay resume ignores live, completed and empty progress', () => {
	assert.equal(
		replayResumeOffset({ kind: 'live', positionSeconds: 42, isCompleted: false }, 100),
		0
	);
	assert.equal(
		replayResumeOffset({ kind: 'replay', positionSeconds: 42, isCompleted: true }, 100),
		0
	);
	assert.equal(replayResumeOffset(null, 100), 0);
});
