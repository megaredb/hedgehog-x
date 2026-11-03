import { db } from './index';
import type { EntityTable } from 'dexie';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Extract all table names from Dexie instance
type TableNames = {
	[K in keyof typeof db]: (typeof db)[K] extends EntityTable<any, any> ? K : never;
}[keyof typeof db];

// Infer entity type for a given table
type TableEntity<TName extends TableNames> =
	(typeof db)[TName] extends EntityTable<infer TEntity, any> ? TEntity : never;

/**
 * Hydrates server data into local Dexie database.
 *
 * @param tableName Table name key from db instance
 * @param data Data or array of data to insert
 * @param purgeScope Optional purge rule to remove obsolete records
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
