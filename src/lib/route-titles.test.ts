import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROUTE_TITLES, segmentTitle, routeTitle } from './route-titles.ts';

// Ключи из ТЗ (перечень сегментов, для которых карта обязана дать заголовок).
// Значения проверяем по самой импортированной карте, а не отдельным
// хардкод-списком — чтобы тест не расходился с единственным источником.
const SPEC_KEYS = [
	'',
	'books',
	'bookmarks',
	'community',
	'downloads',
	'history',
	'settings',
	'support',
	'about',
	'auth',
	'profile'
] as const;

test('ROUTE_TITLES: набор ключей ровно совпадает с ТЗ, все значения — непустые русские заголовки', () => {
	// Полнота: в карте нет ни пропущенных, ни лишних ключей относительно ТЗ.
	assert.deepEqual(Object.keys(ROUTE_TITLES).sort(), [...SPEC_KEYS].sort());

	for (const key of SPEC_KEYS) {
		const title = ROUTE_TITLES[key];
		assert.equal(typeof title, 'string');
		assert.ok(
			title.length > 0,
			`ROUTE_TITLES[${JSON.stringify(key)}] должен быть непустой строкой`
		);
		// Заголовок — это русский текст раздела, а не копия сегмента-ключа.
		if (key !== '') assert.notEqual(title, key, `ROUTE_TITLES[${key}] не должен дублировать ключ`);
	}
});

test('ROUTE_TITLES: точные русские значения для пары ключей', () => {
	assert.equal(ROUTE_TITLES[''], 'Главная');
	assert.equal(ROUTE_TITLES['bookmarks'], 'Закладки');
	assert.equal(ROUTE_TITLES['auth'], 'Вход в аккаунт');
});

test('segmentTitle: известный сегмент возвращает русский заголовок из карты', () => {
	assert.equal(segmentTitle(''), 'Главная');
	assert.equal(segmentTitle('books'), 'Книги');
	assert.equal(segmentTitle('bookmarks'), 'Закладки');
	assert.equal(segmentTitle('about'), 'О сайте');
	assert.equal(segmentTitle('auth'), 'Вход в аккаунт');
	assert.equal(segmentTitle('profile'), 'Мой аккаунт');
});

test('segmentTitle: неизвестный сегмент (динамический id книги/тома) возвращает undefined', () => {
	assert.equal(segmentTitle('book-1'), undefined);
	assert.equal(segmentTitle('123'), undefined);
	assert.equal(segmentTitle('nope'), undefined);
});

test('routeTitle: главная и известные статические сегменты дают заголовок раздела', () => {
	assert.equal(routeTitle('/'), 'Главная');
	assert.equal(routeTitle('/bookmarks'), 'Закладки');
	assert.equal(routeTitle('/downloads'), 'Загрузки');
	assert.equal(routeTitle('/about'), 'О сайте');
	assert.equal(routeTitle('/auth'), 'Вход в аккаунт');
	assert.equal(routeTitle('/profile'), 'Мой аккаунт');
});

test('routeTitle: путь с динамическими сегментами → заголовок последнего известного статического сегмента', () => {
	// /books/<bookId> — «Книги» (сегмент books), id книги в карте нет
	assert.equal(routeTitle('/books/abc'), 'Книги');
	// /books/<bookId>/<volumeId> — тоже «Книги»
	assert.equal(routeTitle('/books/abc/def'), 'Книги');
	// Статический префикс + неизвестная «глубина»
	assert.equal(routeTitle('/history/some/deep/page'), 'История');
});

test('routeTitle: полностью неизвестный путь → «Главная» (фиксируем текущий контракт модуля)', () => {
	// Ни один сегмент не известен — модуль возвращает заголовок главной как
	// фолбэк (ROUTE_TITLES['']), а не undefined.
	assert.equal(routeTitle('/whatever'), 'Главная');
	assert.equal(routeTitle('/nope/deep'), 'Главная');
});
