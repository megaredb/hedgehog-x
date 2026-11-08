import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
	formatDateKey,
	buildDailyStatId,
	validateListenSession,
	formatListeningDuration,
	calculateSummaryMetrics
} from '$lib/analytics/stats';
import { trackEvent, sendListenHeartbeat } from '$lib/client/analytics';

describe('Analytics Math, Formatting, and Validation', () => {
	describe('formatDateKey', () => {
		it('formats Date object to YYYY-MM-DD in UTC', () => {
			const d = new Date('2026-11-08T15:30:00.000Z');
			assert.equal(formatDateKey(d), '2026-11-08');
		});

		it('formats ISO date string to YYYY-MM-DD', () => {
			assert.equal(formatDateKey('2025-01-15T00:00:00.000Z'), '2025-01-15');
		});

		it('formats numeric timestamp to YYYY-MM-DD', () => {
			const timestamp = new Date('2026-05-20T10:00:00.000Z').getTime();
			assert.equal(formatDateKey(timestamp), '2026-05-20');
		});

		it('handles invalid input safely by returning current date format', () => {
			const res = formatDateKey('invalid-date-string');
			assert.match(res, /^\d{4}-\d{2}-\d{2}$/);
		});
	});

	describe('buildDailyStatId', () => {
		it('builds composite id when all fields are present', () => {
			const id = buildDailyStatId('2026-11-08', 'mushoku_tensei', 'ch_1', 'user_123');
			assert.equal(id, '2026-11-08_mushoku_tensei_ch_1_user_123');
		});

		it('substitutes fallback tokens when bookId, chapterId, or userId are nullish', () => {
			const id = buildDailyStatId('2026-11-08', null, 'ch_1', undefined);
			assert.equal(id, '2026-11-08_nobook_ch_1_anon');
		});

		it('handles null date safely by generating fallback key', () => {
			const id = buildDailyStatId('', null, null, null);
			assert.match(id, /^\d{4}-\d{2}-\d{2}_nobook_nochapter_anon$/);
		});
	});

	describe('validateListenSession', () => {
		it('validates a complete valid session payload', () => {
			const input = {
				chapterId: 'chapter_01',
				bookId: 'book_01',
				volumeId: 'vol_01',
				listenedSeconds: 45,
				startedAt: '2026-11-08T12:00:00Z'
			};
			const res = validateListenSession(input);
			assert.equal(res.valid, true);
			assert.ok(res.session);
			assert.equal(res.session.chapterId, 'chapter_01');
			assert.equal(res.session.bookId, 'book_01');
			assert.equal(res.session.volumeId, 'vol_01');
			assert.equal(res.session.listenedSeconds, 45);
			assert.equal(
				res.session.startedAt.toISOString(),
				new Date('2026-11-08T12:00:00Z').toISOString()
			);
		});

		it('accepts boundary listenedSeconds (1 and 300)', () => {
			const min = validateListenSession({ chapterId: 'c1', listenedSeconds: 1 });
			assert.equal(min.valid, true);
			assert.equal(min.session?.listenedSeconds, 1);

			const max = validateListenSession({ chapterId: 'c1', listenedSeconds: 300 });
			assert.equal(max.valid, true);
			assert.equal(max.session?.listenedSeconds, 300);
		});

		it('rejects invalid or non-object payloads', () => {
			assert.equal(validateListenSession(null).valid, false);
			assert.equal(validateListenSession(undefined).valid, false);
			assert.equal(validateListenSession('string').valid, false);
			assert.equal(validateListenSession(123).valid, false);
		});

		it('rejects missing or empty chapterId', () => {
			assert.equal(validateListenSession({ listenedSeconds: 30 }).valid, false);
			assert.equal(validateListenSession({ chapterId: '', listenedSeconds: 30 }).valid, false);
			assert.equal(validateListenSession({ chapterId: '   ', listenedSeconds: 30 }).valid, false);
		});

		it('rejects negative, zero, float, or excessive listenedSeconds (> 300)', () => {
			assert.equal(validateListenSession({ chapterId: 'c1', listenedSeconds: 0 }).valid, false);
			assert.equal(validateListenSession({ chapterId: 'c1', listenedSeconds: -15 }).valid, false);
			assert.equal(validateListenSession({ chapterId: 'c1', listenedSeconds: 301 }).valid, false);
			assert.equal(validateListenSession({ chapterId: 'c1', listenedSeconds: 86400 }).valid, false);
			assert.equal(validateListenSession({ chapterId: 'c1', listenedSeconds: 30.5 }).valid, false);
			assert.equal(validateListenSession({ chapterId: 'c1', listenedSeconds: NaN }).valid, false);
		});

		it('trims whitespace on identifiers and safely defaults startedAt', () => {
			const res = validateListenSession({
				chapterId: '  c1  ',
				bookId: '  b1  ',
				listenedSeconds: 60
			});
			assert.equal(res.valid, true);
			assert.equal(res.session?.chapterId, 'c1');
			assert.equal(res.session?.bookId, 'b1');
			assert.ok(res.session?.startedAt instanceof Date);
		});
	});

	describe('formatListeningDuration', () => {
		it('formats seconds under 1 minute', () => {
			assert.deepEqual(formatListeningDuration(45), {
				hours: 0,
				minutes: 0,
				formatted: '45 сек'
			});
		});

		it('formats whole minutes under 1 hour', () => {
			assert.deepEqual(formatListeningDuration(1800), {
				hours: 0,
				minutes: 30,
				formatted: '30 мин'
			});
		});

		it('formats exact hours without minutes', () => {
			assert.deepEqual(formatListeningDuration(7200), {
				hours: 2,
				minutes: 0,
				formatted: '2 ч'
			});
		});

		it('formats hours and minutes combined', () => {
			assert.deepEqual(formatListeningDuration(3665), {
				hours: 1,
				minutes: 1,
				formatted: '1 ч 1 мин'
			});
			assert.deepEqual(formatListeningDuration(7500), {
				hours: 2,
				minutes: 5,
				formatted: '2 ч 5 мин'
			});
		});

		it('handles 0, negative, and non-numeric values gracefully', () => {
			assert.deepEqual(formatListeningDuration(0), {
				hours: 0,
				minutes: 0,
				formatted: '0 сек'
			});
			assert.deepEqual(formatListeningDuration(-100), {
				hours: 0,
				minutes: 0,
				formatted: '0 сек'
			});
			assert.deepEqual(formatListeningDuration(NaN), {
				hours: 0,
				minutes: 0,
				formatted: '0 сек'
			});
		});
	});

	describe('calculateSummaryMetrics', () => {
		it('aggregates multiple daily listening records into summary', () => {
			const records = [
				{ totalSeconds: 3600, sessionsCount: 2, userId: 'u1' },
				{ totalSeconds: 1800, sessionsCount: 1, userId: 'u2' },
				{ totalSeconds: 7200, sessionsCount: 4, userId: 'u1' }, // same user u1
				{ totalSeconds: 900, sessionsCount: 1, userId: null } // guest
			];

			const summary = calculateSummaryMetrics(records);
			assert.equal(summary.totalSeconds, 13500);
			assert.equal(summary.totalHours, 3.8); // 13500 / 3600 = 3.75 -> 3.8
			assert.equal(summary.totalSessions, 8);
			assert.equal(summary.uniqueListeners, 2); // u1 and u2
			assert.equal(summary.formattedTotalTime, '3 ч 45 мин');
		});

		it('handles empty records cleanly', () => {
			const summary = calculateSummaryMetrics([]);
			assert.equal(summary.totalSeconds, 0);
			assert.equal(summary.totalHours, 0);
			assert.equal(summary.totalSessions, 0);
			assert.equal(summary.uniqueListeners, 0);
			assert.equal(summary.formattedTotalTime, '0 сек');
		});
	});
});

describe('Client Umami Analytics & Heartbeat Service', () => {
	const originalWindow = globalThis.window;
	const originalFetch = globalThis.fetch;

	afterEach(() => {
		globalThis.window = originalWindow;
		globalThis.fetch = originalFetch;
	});

	describe('trackEvent', () => {
		it('safely no-ops during SSR (when window is undefined)', () => {
			// @ts-expect-error test mock
			globalThis.window = undefined;
			assert.doesNotThrow(() => {
				trackEvent('chapter_listen', { bookId: 'b1' });
			});
		});

		it('safely no-ops when window.umami is not defined', () => {
			// @ts-expect-error test mock
			globalThis.window = {};
			assert.doesNotThrow(() => {
				trackEvent('play_clicked');
			});
		});

		it('calls window.umami.track with eventName and eventData when available', () => {
			const calls: Array<{ name: string; data?: Record<string, unknown> }> = [];
			// @ts-expect-error test mock
			globalThis.window = {
				umami: {
					track: (name: string, data?: Record<string, unknown>) => {
						calls.push({ name, data });
					}
				}
			};

			trackEvent('audio_play', { chapterId: 'ch_42', duration: 180 });
			assert.equal(calls.length, 1);
			assert.equal(calls[0].name, 'audio_play');
			assert.deepEqual(calls[0].data, { chapterId: 'ch_42', duration: 180 });
		});

		it('does not crash if window.umami.track throws an error', () => {
			// @ts-expect-error test mock
			globalThis.window = {
				umami: {
					track: () => {
						throw new Error('Blocked by adblocker');
					}
				}
			};

			assert.doesNotThrow(() => {
				trackEvent('audio_pause');
			});
		});
	});

	describe('sendListenHeartbeat', () => {
		it('returns false during SSR', async () => {
			// @ts-expect-error test mock
			globalThis.window = undefined;
			const res = await sendListenHeartbeat({ chapterId: 'c1', listenedSeconds: 30 });
			assert.equal(res, false);
		});

		it('sends POST request to /api/analytics/listen and returns true on success', async () => {
			let calledUrl = '';
			let calledOptions: RequestInit | undefined;

			// @ts-expect-error test mock
			globalThis.window = {};
			globalThis.fetch = (async (url: string, options: RequestInit) => {
				calledUrl = url;
				calledOptions = options;
				return { ok: true, status: 200 } as Response;
			}) as unknown as typeof fetch;

			const payload = {
				chapterId: 'ch_1',
				bookId: 'b_1',
				volumeId: 'v_1',
				listenedSeconds: 60,
				startedAt: '2026-11-08T00:00:00Z'
			};

			const res = await sendListenHeartbeat(payload);
			assert.equal(res, true);
			assert.equal(calledUrl, '/api/analytics/listen');
			assert.equal(calledOptions?.method, 'POST');
			const headers = calledOptions?.headers as Record<string, string> | undefined;
			assert.equal(headers?.['Content-Type'], 'application/json');
			assert.equal(JSON.parse(calledOptions?.body as string).chapterId, 'ch_1');
		});

		it('returns false when server responds with 400 or network fails', async () => {
			// @ts-expect-error test mock
			globalThis.window = {};
			globalThis.fetch = (async () => {
				return { ok: false, status: 400 } as Response;
			}) as unknown as typeof fetch;

			const res = await sendListenHeartbeat({ chapterId: 'c1', listenedSeconds: 999 });
			assert.equal(res, false);

			// Network error throwing
			globalThis.fetch = (async () => {
				throw new Error('Network offline');
			}) as unknown as typeof fetch;

			const resErr = await sendListenHeartbeat({ chapterId: 'c1', listenedSeconds: 30 });
			assert.equal(resErr, false);
		});
	});
});
