import { error } from '@sveltejs/kit';

export function requireAdmin(locals: App.Locals) {
	if (!locals.user) {
		throw error(401, 'Требуется авторизация');
	}
	if (locals.user.role !== 'admin') {
		throw error(403, 'Доступ запрещён: требуются права администратора');
	}
	return locals.user;
}
