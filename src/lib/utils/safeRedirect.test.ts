import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { safeInternalPath } from './safeRedirect';

describe('safeInternalPath', () => {
	it('allows internal paths', () => {
		assert.equal(safeInternalPath('/admin'), '/admin');
		assert.equal(safeInternalPath('/books/overlord?x=1#top'), '/books/overlord?x=1#top');
	});
	it('rejects external, protocol-relative and backslash URLs', () => {
		assert.equal(safeInternalPath('https://evil.example'), '/');
		assert.equal(safeInternalPath('//evil.example'), '/');
		assert.equal(safeInternalPath('/\\evil.example'), '/');
		assert.equal(safeInternalPath(''), '/');
	});
});
