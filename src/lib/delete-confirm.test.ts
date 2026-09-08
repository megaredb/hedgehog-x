import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
	DELETE_CONFIRM_TEXTS,
	computeDeleteButtons,
	nextDeleteConfirmPos
} from './delete-confirm.ts';

test('computeDeleteButtons: ровно 4 кнопки, из них одна подтверждение', () => {
	for (let pos = 0; pos < 4; pos++) {
		const buttons = computeDeleteButtons('Удалить аккаунт', pos);
		assert.equal(buttons.length, 4);
		assert.equal(buttons.filter((b) => b.confirm).length, 1);
	}
});

test('computeDeleteButtons: подтверждение стоит на запрошенной позиции', () => {
	for (let pos = 0; pos < 4; pos++) {
		const buttons = computeDeleteButtons('Удалить аккаунт', pos);
		assert.equal(buttons[pos].confirm, true);
		// вне позиции подтверждения — только «отмены»
		for (let i = 0; i < 4; i++) {
			if (i !== pos) assert.equal(buttons[i].confirm, false);
		}
	}
});

test('computeDeleteButtons: все тексты «отмен» из пула, без дубликатов', () => {
	const buttons = computeDeleteButtons('Удалить аккаунт', 1);
	const cancels = buttons.filter((b) => !b.confirm).map((b) => b.label);
	assert.equal(cancels.length, 3);
	assert.equal(new Set(cancels).size, 3);
	for (const label of cancels) {
		assert.ok(
			['Не надо', 'Передумал', 'Оставить аккаунт', 'Вернуться', 'Отмена'].includes(label),
			'неожиданный текст отмены: ' + label
		);
	}
});

test('nextDeleteConfirmPos: новое место всегда отличается от текущего', () => {
	// Прогоняем много раз от каждой стартовой позиции:
	// результат никогда не равен текущей позиции.
	for (let pos = 0; pos < 4; pos++) {
		for (let attempt = 0; attempt < 200; attempt++) {
			const next = nextDeleteConfirmPos(pos);
			assert.ok(next >= 0 && next <= 3, 'вне диапазона: ' + next);
			assert.notEqual(next, pos, 'позиция подтверждения не должна оставаться на месте');
		}
	}
});

test('nextDeleteConfirmPos: сдвиг всегда 1..3, результат != текущему (детерминированно)', () => {
	// nextDeleteConfirmPos выбирает сдвиг 1..3 через Math.random. Фиксируем
	// random так, чтобы проверить точную арифметику для всех комбинаций
	// (pos, shift) — без зависимости от случайности.
	try {
		for (let pos = 0; pos < 4; pos++) {
			for (let shift = 1; shift <= 3; shift++) {
				// Math.random()=(shift-1)/3 → floor(random*3)=shift-1 → сдвиг = shift.
				mock.method(Math, 'random', () => (shift - 1) / 3);
				const next = nextDeleteConfirmPos(pos);
				assert.equal(next, (pos + shift) % 4, `pos=${pos}, shift=${shift}`);
				assert.notEqual(next, pos);
			}
		}
	} finally {
		mock.restoreAll();
	}
});

test('DELETE_CONFIRM_TEXTS: 4 шага подтверждения', () => {
	assert.equal(DELETE_CONFIRM_TEXTS.length, 4);
	assert.deepEqual(DELETE_CONFIRM_TEXTS, [
		'Удалить аккаунт',
		'Точно удалить?',
		'Да, удалить навсегда',
		'Удалить безвозвратно'
	]);
});
