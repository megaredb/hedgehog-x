/** Clamp a requested page to the available range. */
export function clampPage(requested: number, total: number, pageSize: number): number {
	const totalPages = Math.max(1, Math.ceil(Math.max(0, total) / pageSize));
	if (!Number.isFinite(requested)) return 1;
	return Math.min(Math.max(1, Math.floor(requested)), totalPages);
}

export function pageCount(total: number, pageSize: number): number {
	return Math.max(1, Math.ceil(Math.max(0, total) / pageSize));
}
