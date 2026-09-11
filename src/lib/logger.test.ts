import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createLogger, getMinLogLevel } from './logger';

describe('standardized logger', () => {
	it('создает объект логгера со всеми методами', () => {
		const log = createLogger('Test');
		assert.equal(typeof log.debug, 'function');
		assert.equal(typeof log.info, 'function');
		assert.equal(typeof log.warn, 'function');
		assert.equal(typeof log.error, 'function');
	});

	it('возвращает валидный уровень логирования', () => {
		const level = getMinLogLevel();
		assert.ok(['debug', 'info', 'warn', 'error'].includes(level));
	});

	it('безопасно вызывает логирование без выброса ошибок в Node.js', () => {
		const log = createLogger('TestNode');
		assert.doesNotThrow(() => {
			log.debug('тестовое сообщение debug', { foo: 'bar' });
			log.info('тестовое сообщение info');
			log.warn('тестовое сообщение warn');
			log.error('тестовое сообщение error', new Error('тестовая ошибка'));
		});
	});
});
