import { fail, type Actions } from '@sveltejs/kit';
import { eq, inArray, max } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { sitePages, translators } from '$lib/server/db/schema';
import { user } from '$lib/server/db/auth.schema';
import type { SiteSocialLink } from '$lib/types/site';
import { requireAdmin } from '$lib/server/admin';
import {
	deriveMediaDirectBase,
	loadMediaSettings,
	loadMirrors,
	saveMediaSettings,
	saveMirrors
} from '$lib/server/site-settings';
import {
	isSitePageKey,
	loadSitePage,
	loadSitePages,
	loadTranslators,
	normalizeSitePageData,
	normalizeSocialLinks
} from '$lib/server/site-content';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requireAdmin(locals);
	const [pages, translatorRows, mediaSettings, mirrors] = await Promise.all([
		loadSitePages(),
		loadTranslators(),
		loadMediaSettings(true),
		loadMirrors()
	]);
	return { pages, translators: translatorRows, mediaSettings, mirrors };
};

function text(form: FormData, key: string, maxLength = 5000): string {
	return String(form.get(key) ?? '')
		.trim()
		.slice(0, maxLength);
}

function linksFromForm(form: FormData): SiteSocialLink[] {
	try {
		return normalizeSocialLinks(JSON.parse(String(form.get('links') ?? '[]')));
	} catch {
		return [];
	}
}

async function validUserId(value: string): Promise<boolean> {
	if (!value) return true;
	const [row] = await db.select({ id: user.id }).from(user).where(eq(user.id, value)).limit(1);
	return Boolean(row);
}

export const actions: Actions = {
	saveFeedbackSettings: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const feedbackUrl = text(form, 'feedbackUrl', 1024);
		const about = await loadSitePage('about');
		const data = { ...about.data, feedbackUrl };
		await db
			.insert(sitePages)
			.values({
				key: 'about',
				title: about.title,
				intro: about.intro,
				content: about.content,
				data
			})
			.onConflictDoUpdate({ target: sitePages.key, set: { data, updatedAt: new Date() } });
		return { success: true, message: 'Настройки обратной связи сохранены' };
	},
	saveMirrors: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		let mirrors: unknown;
		try {
			mirrors = JSON.parse(String(form.get('mirrors') ?? '[]'));
		} catch {
			return fail(400, { error: 'Некорректные данные зеркал' });
		}
		if (
			Array.isArray(mirrors) &&
			mirrors.some(
				(mirror) =>
					mirror &&
					typeof mirror === 'object' &&
					!String((mirror as { host?: unknown }).host ?? '').trim()
			)
		) {
			return fail(400, { error: 'У каждого зеркала должен быть указан хост' });
		}
		const mediaProxyEnabled = String(form.get('mediaProxyEnabled') ?? 'true') !== 'false';
		const savedMirrors = await saveMirrors(mirrors);
		await saveMediaSettings({
			mediaProxyEnabled,
			mediaDirectBaseUrl: deriveMediaDirectBase(savedMirrors)
		});
		return { success: true, message: 'Настройки сохранены' };
	},
	savePage: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const key = text(form, 'key', 32);
		if (!isSitePageKey(key)) return fail(400, { error: 'Неизвестная страница' });

		const title = text(form, 'title', 255);
		if (!title) return fail(400, { error: 'Укажите заголовок страницы' });
		const intro = text(form, 'intro', 4000);
		const content = text(form, 'content', 12000);
		let rawData: unknown;
		try {
			rawData = JSON.parse(String(form.get('data') ?? '{}'));
		} catch {
			return fail(400, { error: 'Некорректные данные страницы' });
		}
		const data = normalizeSitePageData(key, rawData);
		if (key === 'about') {
			const userIds = [
				...(data.developers ?? []).map((developer) => developer.userId).filter(Boolean)
			];
			if (userIds.length) {
				const found = await db
					.select({ id: user.id })
					.from(user)
					.where(inArray(user.id, [...new Set(userIds)]));
				const foundIds = new Set(found.map((row) => row.id));
				const missing = userIds.find((id) => !foundIds.has(id));
				if (missing) return fail(400, { error: `Пользователь с ID ${missing} не найден` });
			}
		}

		await db
			.insert(sitePages)
			.values({ key, title, intro, content, data })
			.onConflictDoUpdate({
				target: sitePages.key,
				set: { title, intro, content, data, updatedAt: new Date() }
			});

		return { success: true, message: 'Страница сохранена' };
	},

	addTranslator: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const name = text(form, 'name', 255);
		if (!name) return fail(400, { error: 'Укажите имя переводчика' });

		const [row] = await db.select({ value: max(translators.sortOrder) }).from(translators);
		const sortOrder = Number(row?.value ?? 0) + 1;

		const links = linksFromForm(form);
		const enabled = String(form.get('enabled') ?? 'true') !== 'false';
		const userId = text(form, 'userId', 255);
		if (!(await validUserId(userId)))
			return fail(400, { error: 'Пользователь с таким ID не найден' });
		await db.insert(translators).values({
			name,
			userId: userId || null,
			role: text(form, 'role', 120) || null,
			description: text(form, 'description', 2000) || null,
			url: links[0]?.url || null,
			links,
			enabled,
			sortOrder
		});

		return { success: true, message: 'Переводчик добавлен' };
	},

	updateTranslator: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const id = text(form, 'id', 36);
		const name = text(form, 'name', 255);
		if (!id || !name) return fail(400, { error: 'Укажите имя переводчика' });

		const links = linksFromForm(form);
		const enabled = String(form.get('enabled') ?? 'true') !== 'false';
		const userId = text(form, 'userId', 255);
		if (!(await validUserId(userId)))
			return fail(400, { error: 'Пользователь с таким ID не найден' });
		await db
			.update(translators)
			.set({
				name,
				userId: userId || null,
				role: text(form, 'role', 120) || null,
				description: text(form, 'description', 2000) || null,
				url: links[0]?.url || null,
				links,
				enabled,
				updatedAt: new Date()
			})
			.where(eq(translators.id, id));

		return { success: true, message: 'Переводчик обновлён' };
	},

	deleteTranslator: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const id = text(form, 'id', 36);
		if (!id) return fail(400, { error: 'Не найден переводчик' });
		await db.delete(translators).where(eq(translators.id, id));
		return { success: true, message: 'Переводчик удалён' };
	}
};
