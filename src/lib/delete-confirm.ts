/**
 * Логика многоступенчатого подтверждения удаления аккаунта.
 *
 * На каждом шаге показываются 4 кнопки: три «отмены» и одна «подтверждение».
 * Позиция кнопки подтверждения гарантированно меняется от шага к шагу
 * (никогда не остаётся на месте), а её текст тоже меняется — чтобы
 * пользователь не «привыкал» к одному месту и не подтвердил удаление
 * случайно.
 */

export const DELETE_CANCEL_TEXTS = [
	'Не надо',
	'Передумал',
	'Оставить аккаунт',
	'Вернуться',
	'Отмена'
] as const;

export const DELETE_CONFIRM_TEXTS = [
	'Удалить аккаунт',
	'Точно удалить?',
	'Да, удалить навсегда',
	'Удалить безвозвратно'
] as const;

export interface DeleteButton {
	key: string;
	label: string;
	confirm: boolean;
}

/** Приводит позицию подтверждения к корректному целому 0..3. */
function normalizeConfirmPos(value: number): number {
	if (!Number.isFinite(value)) return 0;
	return Math.min(3, Math.max(0, Math.floor(value)));
}

/**
 * Строит 4 кнопки: 3 «отмены» + 1 «подтверждение» на позиции confirmPos.
 * Тексты «отмен» идут по кругу из пула со сдвигом от шага к шагу.
 */
export function computeDeleteButtons(confirmText: string, confirmPos: number): DeleteButton[] {
	const pool = DELETE_CANCEL_TEXTS;
	const buttons: DeleteButton[] = [];
	const pos = normalizeConfirmPos(confirmPos);
	const start = pos;
	let cancelIdx = 0;
	for (let i = 0; i < 4; i++) {
		if (i === pos) {
			buttons.push({ key: 'ok', label: confirmText, confirm: true });
		} else {
			const label = pool[(start + cancelIdx) % pool.length];
			buttons.push({ key: 'c-' + start + '-' + cancelIdx, label, confirm: false });
			cancelIdx++;
		}
	}
	return buttons;
}

/**
 * Следующая позиция подтверждения: гарантированно отличается от текущей
 * (сдвиг 1..3, не 0). Возвращает 0..3.
 */
export function nextDeleteConfirmPos(currentPos: number): number {
	const pos = normalizeConfirmPos(currentPos);
	const shift = 1 + Math.floor(Math.random() * 3); // 1..3
	return (pos + shift) % 4;
}
