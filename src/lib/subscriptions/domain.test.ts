import test from 'node:test';
import assert from 'node:assert/strict';
import {
	computeManualExpiry,
	daysFromAmount,
	pluralDays,
	repriceRemainingMs,
	summarizeSubscription
} from './domain';

const NOW = new Date('2026-11-23T12:00:00.000Z');
const DAY = 86400000;

test('daysFromAmount uses whole days and floor division', () => {
	assert.equal(daysFromAmount(7), 1);
	assert.equal(daysFromAmount(6), 0);
	assert.equal(daysFromAmount(100), 14);
	assert.equal(daysFromAmount(1000), 142);
	assert.equal(daysFromAmount(13), 1);
	assert.equal(daysFromAmount(0), 0);
	assert.equal(daysFromAmount(-7), 0);
	assert.equal(daysFromAmount(100, 10), 10);
});

test('price change reprices remaining time proportionally', () => {
	assert.equal(repriceRemainingMs(10 * DAY, 7, 10), 7 * DAY);
	assert.equal(repriceRemainingMs(10 * DAY, 10, 20), 5 * DAY);
	assert.equal(repriceRemainingMs(10 * DAY, 20, 10), 20 * DAY);
	assert.equal(repriceRemainingMs(0, 7, 10), 0);
	assert.equal(repriceRemainingMs(10 * DAY, 7, 0), 0);
});

test('manual expiry stacks from the later of now and current expiry', () => {
	const future = new Date(NOW.getTime() + 10 * DAY);
	const stacked = computeManualExpiry(future, 30, NOW);
	assert.equal(stacked.getTime(), future.getTime() + 30 * DAY);

	const past = new Date(NOW.getTime() - 5 * DAY);
	const renewed = computeManualExpiry(past, 30, NOW);
	assert.equal(renewed.getTime(), NOW.getTime() + 30 * DAY);

	const fresh = computeManualExpiry(null, 7, NOW);
	assert.equal(fresh.getTime(), NOW.getTime() + 7 * DAY);
});

test('summary: no subscription', () => {
	const summary = summarizeSubscription({ now: NOW });
	assert.equal(summary.active, false);
	assert.equal(summary.source, 'none');
	assert.equal(summary.daysLeft, null);
});

test('summary: active manual subscription', () => {
	const summary = summarizeSubscription({
		subscription: {
			manualExpiresAt: new Date(NOW.getTime() + 30 * DAY),
			isLifetime: false,
			revokedAt: null,
			revokedRemainingMs: null,
			blockedAt: null,
			blockedReason: null,
			blockedRemainingMs: null
		},
		now: NOW
	});
	assert.equal(summary.active, true);
	assert.equal(summary.source, 'manual');
	assert.equal(summary.daysLeft, 30);
	assert.equal(summary.expiresAt?.getTime(), NOW.getTime() + 30 * DAY);
});

test('summary: lifetime wins over dates', () => {
	const summary = summarizeSubscription({
		subscription: {
			manualExpiresAt: null,
			isLifetime: true,
			revokedAt: null,
			revokedRemainingMs: null,
			blockedAt: null,
			blockedReason: null,
			blockedRemainingMs: null
		},
		now: NOW
	});
	assert.equal(summary.active, true);
	assert.equal(summary.source, 'lifetime');
	assert.equal(summary.expiresAt, null);
	assert.equal(summary.daysLeft, null);
});

test('summary: block disables access but keeps source flags', () => {
	const summary = summarizeSubscription({
		subscription: {
			manualExpiresAt: new Date(NOW.getTime() + 30 * DAY),
			isLifetime: false,
			revokedAt: null,
			revokedRemainingMs: null,
			blockedAt: NOW,
			blockedReason: 'refund',
			blockedRemainingMs: 30 * DAY
		},
		now: NOW
	});
	assert.equal(summary.active, false);
	assert.equal(summary.blocked, true);
	assert.equal(summary.blockedReason, 'refund');
});

test('summary: revoked subscription keeps remaining days but disables access', () => {
	const summary = summarizeSubscription({
		subscription: {
			manualExpiresAt: null,
			isLifetime: false,
			revokedAt: NOW,
			revokedRemainingMs: 5 * DAY,
			blockedAt: null,
			blockedReason: null,
			blockedRemainingMs: null
		},
		now: NOW
	});
	assert.equal(summary.active, false);
	assert.equal(summary.revoked, true);
	assert.equal(summary.revokedDaysLeft, 5);
	assert.equal(summary.source, 'none');
});

test('summary: telegram source grants access without a manual date', () => {
	const summary = summarizeSubscription({
		sources: [
			{
				provider: 'telegram',
				externalId: '42',
				active: true,
				checkedAt: NOW,
				lastError: null
			}
		],
		now: NOW
	});
	assert.equal(summary.active, true);
	assert.equal(summary.boostyActive, true);
	assert.equal(summary.source, 'telegram');
	assert.equal(summary.expiresAt, null);
});

test('summary: both boosty sources and manual date', () => {
	const summary = summarizeSubscription({
		subscription: {
			manualExpiresAt: new Date(NOW.getTime() + 10 * DAY),
			isLifetime: false,
			revokedAt: null,
			revokedRemainingMs: null,
			blockedAt: null,
			blockedReason: null,
			blockedRemainingMs: null
		},
		sources: [
			{ provider: 'telegram', externalId: '42', active: true, checkedAt: NOW, lastError: null },
			{ provider: 'discord', externalId: '99', active: true, checkedAt: NOW, lastError: null }
		],
		now: NOW
	});
	assert.equal(summary.active, true);
	assert.equal(summary.source, 'both');
	assert.equal(summary.telegramActive, true);
	assert.equal(summary.discordActive, true);
	assert.equal(summary.daysLeft, 10);
});

test('summary: expired manual date does not revoke boosty access', () => {
	const summary = summarizeSubscription({
		subscription: {
			manualExpiresAt: new Date(NOW.getTime() - DAY),
			isLifetime: false,
			revokedAt: null,
			revokedRemainingMs: null,
			blockedAt: null,
			blockedReason: null,
			blockedRemainingMs: null
		},
		sources: [
			{ provider: 'telegram', externalId: '42', active: true, checkedAt: NOW, lastError: null }
		],
		now: NOW
	});
	assert.equal(summary.active, true);
	assert.equal(summary.source, 'telegram');
	assert.equal(summary.expiresAt, null);
	assert.equal(summary.daysLeft, null);
});

test('pluralDays handles Russian forms', () => {
	assert.equal(pluralDays(1), 'день');
	assert.equal(pluralDays(2), 'дня');
	assert.equal(pluralDays(5), 'дней');
	assert.equal(pluralDays(11), 'дней');
	assert.equal(pluralDays(21), 'день');
	assert.equal(pluralDays(142), 'дня');
});
