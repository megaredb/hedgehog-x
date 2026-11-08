export type PaginationItem = number | 'ellipsis';

export interface PaginationRange {
	startIndex: number;
	endIndex: number;
}

export interface ItemRange {
	startItem: number;
	endItem: number;
	totalItems: number;
}

/**
 * Calculates the total number of pages based on item count and page size.
 * Returns at least 1 page.
 */
export function calculateTotalPages(totalItems: number, pageSize: number): number {
	const validPageSize = Math.max(1, Math.floor(pageSize) || 1);
	const validTotal = Math.max(0, Math.floor(totalItems) || 0);
	return Math.max(1, Math.ceil(validTotal / validPageSize));
}

/**
 * Clamps the page number between 1 and totalPages.
 */
export function clampPage(page: number, totalPages: number): number {
	const validTotal = Math.max(1, Math.floor(totalPages) || 1);
	const validPage = Math.floor(page) || 1;
	return Math.max(1, Math.min(validPage, validTotal));
}

/**
 * Calculates 0-based array slice indices [startIndex, endIndex) for array.slice().
 */
export function calculateSliceIndices(
	totalItems: number,
	currentPage: number,
	pageSize: number
): PaginationRange {
	const validTotal = Math.max(0, Math.floor(totalItems) || 0);
	const validPageSize = Math.max(1, Math.floor(pageSize) || 1);
	const totalPages = calculateTotalPages(validTotal, validPageSize);
	const page = clampPage(currentPage, totalPages);

	const startIndex = (page - 1) * validPageSize;
	const endIndex = Math.min(validTotal, startIndex + validPageSize);

	return { startIndex, endIndex };
}

/**
 * Calculates 1-based item display numbers (e.g., items 1 to 10 of 45).
 */
export function calculateItemRange(
	totalItems: number,
	currentPage: number,
	pageSize: number
): ItemRange {
	const validTotal = Math.max(0, Math.floor(totalItems) || 0);
	if (validTotal === 0) {
		return { startItem: 0, endItem: 0, totalItems: 0 };
	}

	const { startIndex, endIndex } = calculateSliceIndices(totalItems, currentPage, pageSize);
	return {
		startItem: startIndex + 1,
		endItem: endIndex,
		totalItems: validTotal
	};
}

/**
 * Formats standard Russian pagination summary string:
 * "Показано X–Y из Z" or "Показано 0 из 0".
 */
export function formatPaginationSummary(
	totalItems: number,
	currentPage: number,
	pageSize: number
): string {
	const {
		startItem,
		endItem,
		totalItems: total
	} = calculateItemRange(totalItems, currentPage, pageSize);
	if (total === 0) {
		return 'Показано 0 из 0';
	}
	return `Показано ${startItem}–${endItem} из ${total}`;
}

/**
 * Generates an array of page numbers and ellipses for smart pagination window.
 * E.g., [1, 'ellipsis', 4, 5, 6, 'ellipsis', 10] or [1, 2, 3, 4, 5, 'ellipsis', 10].
 */
export function generatePaginationPages(
	currentPage: number,
	totalPages: number,
	siblingCount: number = 1
): PaginationItem[] {
	const total = Math.max(1, Math.floor(totalPages) || 1);
	const current = clampPage(currentPage, total);
	const siblings = Math.max(0, Math.floor(siblingCount) || 1);

	// Total visible numbers when compact = siblings * 2 + 5 (first, last, current, 2 ellipses)
	const maxTotalVisible = siblings * 2 + 5;

	// If total pages is small enough, display all pages without ellipsis
	if (total <= maxTotalVisible) {
		return Array.from({ length: total }, (_, i) => i + 1);
	}

	const leftSiblingIndex = Math.max(current - siblings, 1);
	const rightSiblingIndex = Math.min(current + siblings, total);

	const showLeftEllipsis = leftSiblingIndex > 2;
	const showRightEllipsis = rightSiblingIndex < total - 1;

	// Case 1: Only right ellipsis
	if (!showLeftEllipsis && showRightEllipsis) {
		const leftItemCount = 3 + 2 * siblings;
		const leftRange = Array.from({ length: leftItemCount }, (_, i) => i + 1);
		return [...leftRange, 'ellipsis', total];
	}

	// Case 2: Only left ellipsis
	if (showLeftEllipsis && !showRightEllipsis) {
		const rightItemCount = 3 + 2 * siblings;
		const start = total - rightItemCount + 1;
		const rightRange = Array.from({ length: rightItemCount }, (_, i) => start + i);
		return [1, 'ellipsis', ...rightRange];
	}

	// Case 3: Both left and right ellipsis
	const middleRange = Array.from(
		{ length: rightSiblingIndex - leftSiblingIndex + 1 },
		(_, i) => leftSiblingIndex + i
	);
	return [1, 'ellipsis', ...middleRange, 'ellipsis', total];
}
