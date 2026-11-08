import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
	calculateTotalPages,
	clampPage,
	calculateSliceIndices,
	calculateItemRange,
	formatPaginationSummary,
	generatePaginationPages
} from './pagination';

describe('Pagination Math & Helpers', () => {
	describe('calculateTotalPages', () => {
		it('calculates exact division correctly', () => {
			assert.equal(calculateTotalPages(100, 10), 10);
			assert.equal(calculateTotalPages(20, 5), 4);
		});

		it('calculates inexact division with remainder (ceiling)', () => {
			assert.equal(calculateTotalPages(101, 10), 11);
			assert.equal(calculateTotalPages(1, 10), 1);
			assert.equal(calculateTotalPages(19, 10), 2);
		});

		it('returns at least 1 page for 0 or negative items', () => {
			assert.equal(calculateTotalPages(0, 10), 1);
			assert.equal(calculateTotalPages(-5, 10), 1);
		});

		it('safely handles non-positive or invalid pageSize without throwing', () => {
			assert.equal(calculateTotalPages(10, 0), 10);
			assert.equal(calculateTotalPages(10, -5), 10);
			assert.equal(calculateTotalPages(10, NaN), 10);
		});
	});

	describe('clampPage', () => {
		it('returns the page unchanged when within range', () => {
			assert.equal(clampPage(1, 10), 1);
			assert.equal(clampPage(5, 10), 5);
			assert.equal(clampPage(10, 10), 10);
		});

		it('clamps values below 1 to 1', () => {
			assert.equal(clampPage(0, 10), 1);
			assert.equal(clampPage(-10, 10), 1);
		});

		it('clamps values above totalPages to totalPages', () => {
			assert.equal(clampPage(11, 10), 10);
			assert.equal(clampPage(100, 5), 5);
		});

		it('floors floating numbers and handles invalid values', () => {
			assert.equal(clampPage(3.8, 10), 3);
			assert.equal(clampPage(NaN, 10), 1);
		});
	});

	describe('calculateSliceIndices', () => {
		it('calculates slice for the first page', () => {
			const { startIndex, endIndex } = calculateSliceIndices(100, 1, 10);
			assert.equal(startIndex, 0);
			assert.equal(endIndex, 10);
		});

		it('calculates slice for an intermediate page', () => {
			const { startIndex, endIndex } = calculateSliceIndices(100, 3, 10);
			assert.equal(startIndex, 20);
			assert.equal(endIndex, 30);
		});

		it('clamps endIndex to totalItems on the final remainder page', () => {
			const { startIndex, endIndex } = calculateSliceIndices(25, 3, 10);
			assert.equal(startIndex, 20);
			assert.equal(endIndex, 25);
		});

		it('handles 0 items gracefully', () => {
			const { startIndex, endIndex } = calculateSliceIndices(0, 1, 10);
			assert.equal(startIndex, 0);
			assert.equal(endIndex, 0);
		});

		it('auto-clamps currentPage beyond total pages to the last page slice', () => {
			const { startIndex, endIndex } = calculateSliceIndices(25, 99, 10);
			assert.equal(startIndex, 20);
			assert.equal(endIndex, 25);
		});
	});

	describe('calculateItemRange & formatPaginationSummary', () => {
		it('formats summary for 0 items', () => {
			assert.equal(formatPaginationSummary(0, 1, 10), 'Показано 0 из 0');
			const range = calculateItemRange(0, 1, 10);
			assert.deepEqual(range, { startItem: 0, endItem: 0, totalItems: 0 });
		});

		it('formats summary for first page of many items', () => {
			assert.equal(formatPaginationSummary(45, 1, 10), 'Показано 1–10 из 45');
			const range = calculateItemRange(45, 1, 10);
			assert.deepEqual(range, { startItem: 1, endItem: 10, totalItems: 45 });
		});

		it('formats summary for the last page with remainder', () => {
			assert.equal(formatPaginationSummary(45, 5, 10), 'Показано 41–45 из 45');
			const range = calculateItemRange(45, 5, 10);
			assert.deepEqual(range, { startItem: 41, endItem: 45, totalItems: 45 });
		});

		it('formats single item correctly', () => {
			assert.equal(formatPaginationSummary(1, 1, 10), 'Показано 1–1 из 1');
		});
	});

	describe('generatePaginationPages', () => {
		it('displays all pages without ellipsis when totalPages <= 7', () => {
			assert.deepEqual(generatePaginationPages(1, 1), [1]);
			assert.deepEqual(generatePaginationPages(1, 3), [1, 2, 3]);
			assert.deepEqual(generatePaginationPages(4, 7), [1, 2, 3, 4, 5, 6, 7]);
		});

		it('displays right ellipsis when current page is near the beginning', () => {
			const pages1 = generatePaginationPages(1, 10, 1);
			assert.deepEqual(pages1, [1, 2, 3, 4, 5, 'ellipsis', 10]);

			const pages2 = generatePaginationPages(2, 10, 1);
			assert.deepEqual(pages2, [1, 2, 3, 4, 5, 'ellipsis', 10]);

			const pages3 = generatePaginationPages(3, 10, 1);
			assert.deepEqual(pages3, [1, 2, 3, 4, 5, 'ellipsis', 10]);
		});

		it('displays left and right ellipsis when current page is in the middle', () => {
			const pages4 = generatePaginationPages(4, 10, 1);
			assert.deepEqual(pages4, [1, 'ellipsis', 3, 4, 5, 'ellipsis', 10]);

			const pages5 = generatePaginationPages(5, 10, 1);
			assert.deepEqual(pages5, [1, 'ellipsis', 4, 5, 6, 'ellipsis', 10]);

			const pages6 = generatePaginationPages(6, 10, 1);
			assert.deepEqual(pages6, [1, 'ellipsis', 5, 6, 7, 'ellipsis', 10]);

			const pages7 = generatePaginationPages(7, 10, 1);
			assert.deepEqual(pages7, [1, 'ellipsis', 6, 7, 8, 'ellipsis', 10]);
		});

		it('displays left ellipsis when current page is near the end', () => {
			const pages8 = generatePaginationPages(8, 10, 1);
			assert.deepEqual(pages8, [1, 'ellipsis', 6, 7, 8, 9, 10]);

			const pages9 = generatePaginationPages(9, 10, 1);
			assert.deepEqual(pages9, [1, 'ellipsis', 6, 7, 8, 9, 10]);

			const pages10 = generatePaginationPages(10, 10, 1);
			assert.deepEqual(pages10, [1, 'ellipsis', 6, 7, 8, 9, 10]);
		});

		it('clamps out of bounds currentPage before generating pages', () => {
			const underflow = generatePaginationPages(0, 10, 1);
			assert.deepEqual(underflow, [1, 2, 3, 4, 5, 'ellipsis', 10]);

			const overflow = generatePaginationPages(99, 10, 1);
			assert.deepEqual(overflow, [1, 'ellipsis', 6, 7, 8, 9, 10]);
		});

		it('supports custom siblingCount', () => {
			// With siblingCount = 2 on 15 pages and currentPage = 8:
			// leftSibling = 6, rightSibling = 10
			const pages = generatePaginationPages(8, 15, 2);
			assert.deepEqual(pages, [1, 'ellipsis', 6, 7, 8, 9, 10, 'ellipsis', 15]);
		});
	});
});
