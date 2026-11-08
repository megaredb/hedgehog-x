import { test } from 'node:test';
import assert from 'node:assert/strict';
import { strings } from './strings';

test('strings: contains valid translation namespaces and keys', () => {
	assert.ok(strings.common.appName);
	assert.ok(strings.common.signIn);
	assert.ok(strings.common.guest);

	// Breadcrumb translations
	assert.equal(strings.breadcrumbs.books, 'Книги');
	assert.equal(strings.breadcrumbs.bookmarks, 'Закладки');
	assert.equal(strings.breadcrumbs.history, 'История');
	assert.equal(strings.breadcrumbs.downloads, 'Загрузки');
	assert.equal(strings.breadcrumbs.community, 'Сообщество');
	assert.equal(strings.breadcrumbs.support, 'Поддержать');
	assert.equal(strings.breadcrumbs.about, 'О проекте');
	assert.equal(strings.breadcrumbs.profile, 'Профиль');
	assert.equal(strings.breadcrumbs.settings, 'Настройки');
	assert.equal(strings.breadcrumbs.admin, 'Панель управления');

	// Bookmarks & History
	assert.ok(strings.bookmarks.title);
	assert.ok(strings.bookmarks.emptyTitle);
	assert.ok(strings.history.title);
	assert.ok(strings.history.emptyTitle);
	assert.ok(strings.volume.volumeCompletedTitle);

	// Share & Settings & Support
	assert.ok(strings.share.title);
	assert.ok(strings.share.directLink);
	assert.ok(strings.settings.title);
	assert.ok(strings.settings.audioSection);
	assert.equal(strings.support.cardQrAriaLabel, 'QR-код карты');
	assert.equal(strings.support.tonQrAriaLabel, 'QR-код TON');
});
