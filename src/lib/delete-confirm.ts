/**
 * Multi-step account deletion confirmation logic.
 * On each step, 4 buttons are displayed (3 cancellations and 1 confirmation).
 * The confirmation button position randomly shifts each step to prevent accidental clicks.
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

/**
 * Builds 4 buttons: 3 cancel variants and 1 confirm at confirmPos.
 */
export function computeDeleteButtons(confirmText: string, confirmPos: number): DeleteButton[] {
	const pool = DELETE_CANCEL_TEXTS;
	const buttons: DeleteButton[] = [];
	const start = confirmPos;
	let cancelIdx = 0;
	for (let pos = 0; pos < 4; pos++) {
		if (pos === confirmPos) {
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
 * Returns next confirmation button position guaranteed to differ from current (shift 1..3).
 */
export function nextDeleteConfirmPos(currentPos: number): number {
	const shift = 1 + Math.floor(Math.random() * 3); // 1..3
	return (currentPos + shift) % 4;
}
