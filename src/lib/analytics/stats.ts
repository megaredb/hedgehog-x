/**
 * Analytics math, date utilities, and validation helpers.
 */

export interface RawListenSession {
	chapterId: string;
	bookId?: string | null;
	volumeId?: string | null;
	listenedSeconds: number;
	startedAt?: string | Date | null;
}

export interface ValidatedListenSession {
	chapterId: string;
	bookId?: string | null;
	volumeId?: string | null;
	listenedSeconds: number;
	startedAt: Date;
}

/**
 * Returns 'YYYY-MM-DD' formatted date string in UTC.
 */
export function formatDateKey(dateInput: Date | string | number = new Date()): string {
	const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
	if (isNaN(d.getTime())) {
		return new Date().toISOString().slice(0, 10);
	}
	return d.toISOString().slice(0, 10);
}

/**
 * Builds a deterministic primary key for daily_listening_stats.
 */
export function buildDailyStatId(
	date: string,
	bookId: string | null | undefined,
	chapterId: string | null | undefined,
	userId: string | null | undefined
): string {
	const safeDate = date || formatDateKey();
	const safeBook = bookId || 'nobook';
	const safeChapter = chapterId || 'nochapter';
	const safeUser = userId || 'anon';
	return `${safeDate}_${safeBook}_${safeChapter}_${safeUser}`;
}

/**
 * Validates a listening heartbeat payload.
 * Constraints:
 * - chapterId must be a non-empty string.
 * - listenedSeconds must be an integer between 1 and 300 (maximum 5 minutes per ping).
 */
export function validateListenSession(input: unknown): {
	valid: boolean;
	session?: ValidatedListenSession;
	error?: string;
} {
	if (!input || typeof input !== 'object') {
		return { valid: false, error: 'Session must be a valid JSON object' };
	}

	const data = input as Partial<RawListenSession>;

	if (!data.chapterId || typeof data.chapterId !== 'string' || data.chapterId.trim().length === 0) {
		return { valid: false, error: 'Missing or invalid chapterId' };
	}

	const seconds = Number(data.listenedSeconds);
	if (!Number.isFinite(seconds) || !Number.isInteger(seconds) || seconds < 1 || seconds > 300) {
		return {
			valid: false,
			error: 'Invalid listenedSeconds: must be an integer between 1 and 300 seconds'
		};
	}

	let startedAt = new Date();
	if (data.startedAt) {
		const parsed = new Date(data.startedAt);
		if (!isNaN(parsed.getTime())) {
			startedAt = parsed;
		}
	}

	return {
		valid: true,
		session: {
			chapterId: data.chapterId.trim(),
			bookId: typeof data.bookId === 'string' ? data.bookId.trim() : null,
			volumeId: typeof data.volumeId === 'string' ? data.volumeId.trim() : null,
			listenedSeconds: seconds,
			startedAt
		}
	};
}

/**
 * Converts total seconds into structured hours, minutes, and localized string.
 */
export function formatListeningDuration(totalSeconds: number): {
	hours: number;
	minutes: number;
	formatted: string;
} {
	const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
	const hours = Math.floor(safeSeconds / 3600);
	const minutes = Math.floor((safeSeconds % 3600) / 60);

	if (hours === 0 && minutes === 0) {
		return {
			hours: 0,
			minutes: 0,
			formatted: `${safeSeconds} сек`
		};
	}

	if (hours === 0) {
		return {
			hours: 0,
			minutes,
			formatted: `${minutes} мин`
		};
	}

	if (minutes === 0) {
		return {
			hours,
			minutes: 0,
			formatted: `${hours} ч`
		};
	}

	return {
		hours,
		minutes,
		formatted: `${hours} ч ${minutes} мин`
	};
}

/**
 * Aggregates daily listening stats into summary metrics.
 */
export function calculateSummaryMetrics(
	items: Array<{
		totalSeconds: number;
		sessionsCount: number;
		userId?: string | null;
	}>
): {
	totalSeconds: number;
	totalHours: number;
	totalSessions: number;
	uniqueListeners: number;
	formattedTotalTime: string;
} {
	let totalSeconds = 0;
	let totalSessions = 0;
	const uniqueUserIds = new Set<string>();

	for (const item of items) {
		totalSeconds += Number(item.totalSeconds) || 0;
		totalSessions += Number(item.sessionsCount) || 0;
		if (item.userId) {
			uniqueUserIds.add(item.userId);
		}
	}

	const hoursFloat = Number((totalSeconds / 3600).toFixed(1));
	const formatted = formatListeningDuration(totalSeconds).formatted;

	return {
		totalSeconds,
		totalHours: hoursFloat,
		totalSessions,
		uniqueListeners: uniqueUserIds.size,
		formattedTotalTime: formatted
	};
}
