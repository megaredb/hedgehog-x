/** Human-readable byte size for UI. */
export function formatBytes(bytes: number): string {
	if (!Number.isFinite(bytes) || bytes <= 0) return '0 Б';
	const units = ['Б', 'КБ', 'МБ', 'ГБ'];
	const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
	const value = bytes / Math.pow(1024, index);
	return (index === 0 ? Math.round(value) : value.toFixed(1)) + ' ' + units[index];
}
