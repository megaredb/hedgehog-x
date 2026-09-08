/**
 * Page Object для страницы профиля (src/routes/profile/+page.svelte).
 *
 * Селекторы — по ролям / текстам / data-* хукам (data-provider у строк способов
 * входа, data-slot у оверлея/модалки), НЕ по CSS-классам. Все действия и точки
 * поиска собраны здесь, чтобы тесты оставались декларативными и не зависели от
 * вёрстки.
 *
 * Не содержит expect-ассертов — только селекторы (Locator) и действия.
 */

import type { Locator, Page } from '@playwright/test';
import { openPage } from '../fixtures/utils';

/** Строки «отмены» в многошаговой модалке удаления (см. src/lib/delete-confirm.ts). */
export const DELETE_CANCEL_PATTERN = /Не надо|Передумал|Оставить аккаунт|Вернуться|Отмена/;

/** Подписи шагов подтверждения удаления по порядку появления (delete-confirm.ts). */
export const DELETE_CONFIRM_LABELS = [
	'Удалить аккаунт',
	'Точно удалить?',
	'Да, удалить навсегда',
	'Удалить безвозвратно'
] as const;

export class ProfilePage {
	readonly page: Page;

	constructor(page: Page) {
		this.page = page;
	}

	// ─── Навигация ──────────────────────────────────────────────────────────────

	/** Перейти на /profile и погасить CSS-анимации (см. openPage). */
	async goto(): Promise<void> {
		await openPage(this.page, '/profile');
	}

	// ─── Карточка профиля ───────────────────────────────────────────────────────

	/** Заголовок страницы (h1 из PageHeader). */
	get heading(): Locator {
		return this.page.getByRole('heading', { name: 'Мой аккаунт' });
	}

	/**
	 * Секция-карточка профиля: уникальна по подписи поля «ID пользователя»
	 * (в других секциях страницы такого текста нет).
	 */
	private get card(): Locator {
		return this.page.locator('section', { hasText: 'ID пользователя' }).first();
	}

	/** Полное имя пользователя в карточке профиля. */
	name(name: string): Locator {
		return this.card.getByText(name, { exact: true });
	}

	/** Значение «ID пользователя» в карточке. */
	userId(id: string): Locator {
		return this.card.getByText(id, { exact: true });
	}

	/** Аватар в карточке (показывается как <img>, если у юзера есть image). */
	get profileImage(): Locator {
		return this.card.locator('img');
	}

	/**
	 * Иконка-заглушка аватара в карточке (lucide UserRound svg) — единственный
	 * svg внутри карточки, когда image у юзера нет.
	 */
	get profileIcon(): Locator {
		return this.card.locator('svg');
	}

	/** Строка «Последний вход: <label>» в карточке. */
	lastLogin(label: string): Locator {
		return this.card.getByText(`Последний вход: ${label}`);
	}

	/** Любая строка «Последний вход: …» (для проверки её отсутствия). */
	get lastLoginAny(): Locator {
		return this.card.getByText(/Последний вход:/);
	}

	// ─── Строки способов входа ──────────────────────────────────────────────────

	/** Строка способа входа по data-provider (стабильный хук страницы). */
	row(providerId: string): Locator {
		return this.page.locator(`[data-provider="${providerId}"]`);
	}

	/** Название платформы в строке способа входа. */
	rowLabel(providerId: string, label: string): Locator {
		return this.row(providerId).getByText(label, { exact: true });
	}

	/** Аватар платформы как <img> внутри строки (для привязанного способа). */
	avatarImage(providerId: string): Locator {
		return this.row(providerId).locator('img');
	}

	/**
	 * Фирменная иконка способа (ProviderIcon) внутри строки: svg с role="img"
	 * (lucide-иконки кнопок role="img" не несут, поэтому пересечения нет).
	 */
	brandIcon(providerId: string): Locator {
		return this.row(providerId).locator('svg[role="img"]');
	}

	/** Кружок-инициал (фолбэк аватара, когда нет картинки, но есть username). */
	initial(providerId: string, char: string): Locator {
		return this.row(providerId).getByText(char, { exact: true });
	}

	/** Подпись строки (например «@user · ID 123» или description для непривязанного). */
	subtitle(providerId: string, text: string): Locator {
		return this.row(providerId).getByText(text);
	}

	/** Кнопка «Привязать» у строки способа. */
	linkButton(providerId: string): Locator {
		return this.row(providerId).getByRole('button', { name: 'Привязать' });
	}

	/** Кнопка «Отвязать» у строки способа. */
	unlinkButton(providerId: string): Locator {
		return this.row(providerId).getByRole('button', { name: 'Отвязать' });
	}

	/** Текст «Загрузка способов входа…» (пока list-accounts в полёте). */
	get providersLoading(): Locator {
		return this.page.getByText('Загрузка способов входа…');
	}

	// ─── Действия со строками ──────────────────────────────────────────────────

	/** Нажать «Привязать» у способа (для OAuth уходит на /link-social). */
	async link(providerId: string): Promise<void> {
		await this.linkButton(providerId).click();
	}

	/** Нажать «Отвязать» у способа → открывает модалку подтверждения. */
	async openUnlink(providerId: string): Promise<void> {
		await this.unlinkButton(providerId).click();
	}

	// ─── Модалки (общий доступ к активному dialog) ─────────────────────────────

	/** Активная модалка (role=dialog). */
	get dialog(): Locator {
		return this.page.getByRole('dialog');
	}

	/** Кнопка внутри активной модалки по имени. */
	dialogButton(name: string | RegExp): Locator {
		return this.dialog.getByRole('button', { name });
	}

	/** Оверлей-подложка модалки (data-slot хука из BaseModal/dialog). */
	get dialogOverlay(): Locator {
		return this.page.locator('[data-slot="dialog-overlay"]');
	}

	// ─── Привязка Boosty (модалка телефон+SMS) ─────────────────────────────────

	/** Открыть модалку «Привязать Boosty» (способ boosty, телефон+SMS). */
	async openBoostyLink(): Promise<Locator> {
		await this.link('boosty');
		const dialog = this.dialog;
		return dialog;
	}

	// ─── Подписка HEDGEHOG.INC в Boosty ────────────────────────────────────────

	/**
	 * Секция подписки (видна только при привязанном Boosty): уникальна по
	 * заголовку h2 «Подписка HEDGEHOG.INC».
	 */
	get subscription(): Locator {
		return this.page.locator('section', { hasText: 'Подписка HEDGEHOG.INC' }).first();
	}

	// ─── Опасная зона / удаление аккаунта ──────────────────────────────────────

	/** Кнопка «Удалить аккаунт» в опасной зоне. */
	get deleteButton(): Locator {
		return this.page.getByRole('button', { name: 'Удалить аккаунт' });
	}

	/** Открыть модалку удаления аккаунта. Возвращает её locator. */
	async openDeleteModal(): Promise<Locator> {
		await this.deleteButton.click();
		const dialog = this.dialog;
		return dialog;
	}

	/** Нажать кнопку-«отмену» в модалке удаления (пул текстов из delete-confirm). */
	async cancelDelete(): Promise<void> {
		await this.dialogButton(DELETE_CANCEL_PATTERN).first().click();
	}
}
