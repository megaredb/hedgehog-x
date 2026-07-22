import { db } from './index';
import type { EntityTable } from 'dexie';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Извлекаем имена всех таблиц из инстанса Dexie
type TableNames = {
	[K in keyof typeof db]: (typeof db)[K] extends EntityTable<any, any> ? K : never;
}[keyof typeof db];

// Выводим тип сущности (Entity) для конкретной таблицы
type TableEntity<TName extends TableNames> =
	(typeof db)[TName] extends EntityTable<infer TEntity, any> ? TEntity : never;

/**
 * Гидрирует данные с сервера в локальную БД Dexie.
 *
 * @param tableName Имя таблицы (строго типизировано ключами db)
 * @param data Данные или массив данных для вставки
 * @param purgeScope Опциональное правило для удаления старых данных.
 *                   Если `'all'`, удалит из таблицы все записи, которых нет в `data`.
 *                   Если объект `{ index, values }`, удалит только те записи, которые подпадают под запрос,
 *                   но отсутствуют в `data`.
 */
export async function hydrate<TName extends TableNames>(
	tableName: TName,
	data: TableEntity<TName> | TableEntity<TName>[],
	purgeScope?: 'all' | { index: string; values: any[] }
) {
	if (!data) return;

	const items = Array.isArray(data) ? data : [data];
	const table = db[tableName] as any;
	const pk = table.schema.primKey.keyPath;

	await db.transaction('rw', table, async () => {
		if (purgeScope === 'all') {
			const existingItems = await table.toArray();
			const newIds = new Set(items.map((item: any) => item[pk]));
			const idsToDelete = existingItems
				.filter((item: any) => !newIds.has(item[pk]))
				.map((item: any) => item[pk]);

			if (idsToDelete.length > 0) {
				await table.bulkDelete(idsToDelete);
			}
		} else if (purgeScope && typeof purgeScope === 'object') {
			const { index, values } = purgeScope;
			if (values.length > 0) {
				const existingItems = await table.where(index).anyOf(values).toArray();
				const newIds = new Set(items.map((item: any) => item[pk]));
				const idsToDelete = existingItems
					.filter((item: any) => !newIds.has(item[pk]))
					.map((item: any) => item[pk]);

				if (idsToDelete.length > 0) {
					await table.bulkDelete(idsToDelete);
				}
			}
		}

		if (items.length > 0) {
			await table.bulkPut(items);
		}
	});
}
