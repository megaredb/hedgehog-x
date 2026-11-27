const MOSCOW_OFFSET_MS = 3 * 60 * 60 * 1000;

/** Parses a datetime-local value as Moscow wall time (UTC+3, no DST). */
export function parseMoscowLocalDateTime(value: string): Date | null {
	const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
	if (!match) return null;
	const [, year, month, day, hour, minute, second = '0'] = match;
	const date = new Date(
		Date.UTC(
			Number(year),
			Number(month) - 1,
			Number(day),
			Number(hour) - 3,
			Number(minute),
			Number(second)
		)
	);
	if (Number.isNaN(date.getTime())) return null;
	const normalized = new Date(date.getTime() + MOSCOW_OFFSET_MS).toISOString().slice(0, 19);
	const expected = `${year}-${month}-${day}T${hour}:${minute}:${second.padStart(2, '0')}`;
	return normalized === expected ? date : null;
}

/** Formats a date as a Moscow datetime-local value (YYYY-MM-DDTHH:mm). */
export function formatMoscowLocalDateTimeInput(value: Date | string): string {
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return '';
	return new Date(date.getTime() + MOSCOW_OFFSET_MS).toISOString().slice(0, 16);
}

/** Formats a date for admin display in Moscow time. */
export function formatMoscowDateTime(value: Date | string | null): string {
	if (!value) return '—';
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return '—';
	return new Intl.DateTimeFormat('ru-RU', {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		timeZone: 'Europe/Moscow'
	}).format(date);
}

/** Formats seconds as m:ss, or h:mm:ss when the duration is at least one hour. */
export function formatDuration(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
	const total = Math.floor(seconds);
	const hours = Math.floor(total / 3600);
	const minutes = Math.floor((total % 3600) / 60);
	const secs = total % 60;
	if (hours > 0) {
		return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
	}
	return `${minutes}:${String(secs).padStart(2, '0')}`;
}
