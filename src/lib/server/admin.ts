import { error } from '@sveltejs/kit';

export function isAdminRole(role: string | null | undefined): boolean {
	return role === 'admin' || role === 'author';
}

export function requireAdmin(locals: App.Locals) {
	if (!locals.user) {
		throw error(401, 'Требуется авторизация');
	}
	if (!isAdminRole(locals.user.role)) {
		throw error(403, 'Доступ запрещён: требуются права администратора');
	}
	return locals.user;
}

export function requireFullAdmin(locals: App.Locals) {
	if (!locals.user) {
		throw error(401, 'Требуется авторизация');
	}
	if (locals.user.role !== 'admin') {
		throw error(403, 'Доступно только администратору');
	}
	return locals.user;
}
