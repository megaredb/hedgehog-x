import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { decideSyncAction } from './syncPolicy';

describe('sync ownership policy', () => {
	it('skips when the server has no user id', () => {
		assert.equal(
			decideSyncAction({
				serverUserId: undefined,
				localOwner: undefined,
				hasLocalData: true,
				hasPendingMutations: false
			}),
			'skip'
		);
	});

	it('merges guest/unknown local data instead of purging it', () => {
		assert.equal(
			decideSyncAction({
				serverUserId: 'user-a',
				localOwner: undefined,
				hasLocalData: true,
				hasPendingMutations: false
			}),
			'merge'
		);
		assert.equal(
			decideSyncAction({
				serverUserId: 'user-a',
				localOwner: null,
				hasLocalData: true,
				hasPendingMutations: false
			}),
			'merge'
		);
	});

	it('replaces an empty guest cache with the authenticated user data', () => {
		assert.equal(
			decideSyncAction({
				serverUserId: 'user-a',
				localOwner: undefined,
				hasLocalData: false,
				hasPendingMutations: false
			}),
			'replace'
		);
	});

	it('lets the same authenticated user replace local data when nothing is pending', () => {
		assert.equal(
			decideSyncAction({
				serverUserId: 'user-a',
				localOwner: 'user-a',
				hasLocalData: true,
				hasPendingMutations: false
			}),
			'replace'
		);
	});

	it('merges for the same user when mutations are still pending', () => {
		assert.equal(
			decideSyncAction({
				serverUserId: 'user-a',
				localOwner: 'user-a',
				hasLocalData: true,
				hasPendingMutations: true
			}),
			'merge'
		);
	});

	it('switches owner instead of applying user B data over user A', () => {
		assert.equal(
			decideSyncAction({
				serverUserId: 'user-b',
				localOwner: 'user-a',
				hasLocalData: true,
				hasPendingMutations: false
			}),
			'switch'
		);
	});
});
