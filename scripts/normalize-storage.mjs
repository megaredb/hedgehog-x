#!/usr/bin/env node
/**
 * Normalizes the development R2 bucket to the canonical production layout and
 * imports archived chapter dubs (OLD VERSION) into the audio-version tables.
 *
 * Usage:
 *   DATABASE_URL=... R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... \
 *   node scripts/normalize-storage.mjs --apply --delete-old
 *
 * Without --apply it only prints the planned changes.
 */
import postgres from 'postgres';
import {
	CopyObjectCommand,
	DeleteObjectsCommand,
	HeadObjectCommand,
	ListObjectsV2Command,
	S3Client
} from '@aws-sdk/client-s3';

const apply = process.argv.includes('--apply');
const deleteOld = process.argv.includes('--delete-old');
const allowProdBucket = process.argv.includes('--allow-prod-bucket');
const sourceBucket = process.env.SOURCE_R2_BUCKET ?? 'hedgehog-files';
const targetBucket = process.env.R2_BUCKET_NAME ?? 'dev-hedgehog-files';

if (targetBucket === sourceBucket) {
	throw new Error(
		`Refusing to run: targetBucket (${targetBucket}) must not equal sourceBucket (${sourceBucket})`
	);
}
if (targetBucket === 'hedgehog-files' && !allowProdBucket) {
	throw new Error(
		'Refusing to run against production bucket "hedgehog-files" without explicit --allow-prod-bucket flag'
	);
}

const client = new S3Client({
	region: 'auto',
	endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
	credentials: {
		accessKeyId: process.env.R2_ACCESS_KEY_ID,
		secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
	}
});

async function list(bucket) {
	const all = [];
	let token;
	do {
		const page = await client.send(
			new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token, MaxKeys: 1000 })
		);
		for (const item of page.Contents ?? []) {
			all.push({ key: item.Key, size: item.Size, etag: item.ETag?.replaceAll('"', '') });
		}
		token = page.IsTruncated ? page.NextContinuationToken : undefined;
	} while (token);
	return all;
}

function isFile(key) {
	return /\.(mp3|jpe?g|png|webp)$/i.test(key);
}

function mediaUrl(key) {
	return '/api/media/' + key.split('/').map(encodeURIComponent).join('/');
}

function dbKeyFromUrl(url) {
	if (!url?.startsWith('/api/media/')) return null;
	return decodeURIComponent(url.slice('/api/media/'.length));
}

function oldStem(key) {
	const file = key.split('/').at(-1);
	return file
		.replace(/\.mp3$/i, '')
		.replace(/^\d+\.\s*/, '')
		.replace(/^Реинкарнация безработного\.\s*/, '')
		.replace(/^Том\s+\d+\.\s*/, '')
		.trim();
}

function oldVolumeNumber(key) {
	const folder = key.split('/')[1] ?? '';
	return Number((folder.match(/^(\d+)\./) ?? [])[1]);
}

function titleNumber(title) {
	const match = title.match(/^Глава\s+(\d+(?:[.,]\d+)?)/i);
	return match ? Number(match[1].replace(',', '.')) : null;
}

const source = (await list(sourceBucket)).filter((item) => isFile(item.key));
const target = (await list(targetBucket)).filter((item) => isFile(item.key));
const targetByEtag = new Map();
for (const item of target) {
	if (!item.etag) continue;
	const current = targetByEtag.get(item.etag);
	// Prefer canonical-looking folders over the old hash-only folders.
	if (!current || (!item.key.startsWith('chapters/') && !item.key.startsWith('legacy/'))) {
		targetByEtag.set(item.etag, item);
	}
}

const copies = [];
const missing = [];
for (const item of source) {
	const match = targetByEtag.get(item.etag);
	if (!match) missing.push(item.key);
	else copies.push({ from: match.key, to: item.key });
}

console.log(
	JSON.stringify(
		{
			apply,
			sourceBucket,
			targetBucket,
			sourceFiles: source.length,
			targetFiles: target.length,
			copies: copies.length,
			missing: missing.length,
			missingKeys: missing.slice(0, 20)
		},
		null,
		2
	)
);

if (!apply) {
	console.log('Dry run: pass --apply to copy objects and update the database.');
	process.exit(0);
}

if (missing.length) {
	throw new Error(`Cannot normalize: ${missing.length} source files have no target object by ETag`);
}

const sql = postgres(process.env.DATABASE_URL, { max: 4 });

// 1. Copy server-side. Existing canonical objects are kept as-is.
let copied = 0;
const CONCURRENCY = 40;
for (let offset = 0; offset < copies.length; offset += CONCURRENCY) {
	const chunk = copies.slice(offset, offset + CONCURRENCY);
	const results = await Promise.allSettled(
		chunk.map(async (copy) => {
			try {
				await client.send(new HeadObjectCommand({ Bucket: targetBucket, Key: copy.to }));
				return false;
			} catch {
				// Object does not exist yet.
			}
			await client.send(
				new CopyObjectCommand({
					Bucket: targetBucket,
					Key: copy.to,
					CopySource: `${targetBucket}/${copy.from.split('/').map(encodeURIComponent).join('/')}`,
					MetadataDirective: 'COPY'
				})
			);
			return true;
		})
	);
	for (const result of results) {
		if (result.status === 'rejected') throw result.reason;
		if (result.value) copied++;
	}
	console.log(
		`copy progress ${Math.min(offset + CONCURRENCY, copies.length)}/${copies.length} (${copied} new)`
	);
}

// 2. Update chapter audio URLs and volume/book covers.
const chapterRows = await sql`
	select c.id, c.audio_url, c.duration_seconds, c.chapter_number, c.title,
	       v.id as volume_id, v.volume_number, v.cover_url, b.id as book_id
	from chapters c
	join volumes v on v.id = c.volume_id
	join books b on b.id = v.book_id
`;
const targetByKey = new Map(target.map((item) => [item.key, item]));
const sourceKeyByEtag = new Map(source.map((item) => [item.etag, item.key]));
const legacyCoverByHash = new Map(
	target
		.filter((item) => item.key.startsWith('legacy/') && /\.(?:jpe?g|png|webp)$/i.test(item.key))
		.map((item) => [item.key.split('/')[1].replace(/\.[^.]+$/, ''), sourceKeyByEtag.get(item.etag)])
		.filter((entry) => entry[1])
);

let updatedChapters = 0;
await sql.begin(async (tx) => {
	for (const row of chapterRows) {
		const currentKey = dbKeyFromUrl(row.audio_url);
		const dev = currentKey ? targetByKey.get(currentKey) : undefined;
		const canonical = dev?.etag ? sourceKeyByEtag.get(dev.etag) : undefined;
		if (!canonical) {
			throw new Error(`No canonical source for chapter ${row.id} (${row.audio_url})`);
		}
		const nextUrl = mediaUrl(canonical);
		if (nextUrl !== row.audio_url) {
			await tx`update chapters set audio_url = ${nextUrl} where id = ${row.id}`;
			updatedChapters++;
		}
	}

	const volumes = await tx`select id, book_id, cover_url from volumes order by volume_number asc`;
	const bookCovers = new Map();
	for (const volume of volumes) {
		const currentKey = dbKeyFromUrl(volume.cover_url);
		const dev = currentKey ? targetByKey.get(currentKey) : undefined;
		const coverHash = currentKey?.match(/^volumes\/(.+)\.webp$/)?.[1];
		const canonical =
			(dev?.etag ? sourceKeyByEtag.get(dev.etag) : undefined) ??
			(coverHash ? legacyCoverByHash.get(coverHash) : undefined);
		if (!canonical) continue;
		const nextUrl = mediaUrl(canonical);
		if (nextUrl !== volume.cover_url) {
			await tx`update volumes set cover_url = ${nextUrl} where id = ${volume.id}`;
		}
		if (!bookCovers.has(volume.book_id)) bookCovers.set(volume.book_id, nextUrl);
	}
	for (const [bookId, coverUrl] of bookCovers) {
		await tx`update books set cover_url = ${coverUrl} where id = ${bookId} and (cover_url is null or cover_url = '')`;
	}
});

// 3. Import OLD VERSION tracks. Combined files are anchored to the first chapter
//    in their range; the remaining chapters are marked unavailable in the UI.
const dbChapters = await sql`
	select c.id, c.volume_id, c.chapter_number, c.title, c.duration_seconds,
	       v.volume_number, b.id as book_id
	from chapters c
	join volumes v on v.id = c.volume_id
	join books b on b.id = v.book_id
	order by b.id, v.volume_number, c.chapter_number
`;
const dbBookRows = await sql`select id from books`;
const validBookIds = new Set(dbBookRows.map((row) => row.id));
const oldRows = source.filter((item) => item.key.includes('/OLD VERSION/'));

await sql.begin(async (tx) => {
	await tx`
		insert into audio_versions (id, label, description, sort_order)
		values
			('default', 'Новая версия', 'Текущая озвучка', 0),
			('old', 'Старая версия', 'OLD VERSION', 1)
		on conflict (id) do update set
			label = excluded.label,
			description = excluded.description,
			sort_order = excluded.sort_order
	`;

	for (const old of oldRows) {
		const bookId = old.key.split('/')[0];
		if (!bookId || !validBookIds.has(bookId)) {
			console.warn('Skipping OLD VERSION file with unknown bookId', old.key);
			continue;
		}
		const volumeNumber = oldVolumeNumber(old.key);
		const candidates = dbChapters.filter(
			(chapter) => chapter.book_id === bookId && chapter.volume_number === volumeNumber
		);
		if (candidates.length === 0) continue;
		const stem = oldStem(old.key);
		let matches = [];

		const range = stem.match(/^Главы?\s+(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)/i);
		if (range) {
			const start = Number(range[1].replace(',', '.'));
			const end = Number(range[2].replace(',', '.'));
			matches = candidates.filter((chapter) => {
				const number = titleNumber(chapter.title);
				return number !== null && number >= start && number <= end;
			});
		} else {
			const single = stem.match(/^Глава\s+(\d+(?:[.,]\d+)?)/i);
			if (single) {
				const number = Number(single[1].replace(',', '.'));
				matches = candidates.filter((chapter) => titleNumber(chapter.title) === number);
			} else if (/^Пролог/i.test(stem)) {
				matches = candidates.filter((chapter) => titleNumber(chapter.title) === 0);
			} else if (/побочн/i.test(stem)) {
				matches = candidates.filter((chapter) => /побочн|дополнительн/i.test(chapter.title));
			} else if (/дополнительн/i.test(stem)) {
				matches = candidates.filter((chapter) => /дополнительн/i.test(chapter.title));
			} else if (/Эрис/i.test(stem)) {
				matches = candidates.filter((chapter) => /Эрис|Побочная история/i.test(chapter.title));
			}
		}

		// Two archive files need explicit anchors because their names do not
		// contain the chapter number used by the current release.
		if (matches.length === 0 && volumeNumber === 13 && /Побочная глава/i.test(stem)) {
			matches = candidates.filter((chapter) => /Дополнительная история/i.test(chapter.title));
		}
		if (matches.length === 0 && volumeNumber === 8 && /Эрис/i.test(stem)) {
			matches = candidates.filter((chapter) => /Побочная история/i.test(chapter.title));
		}
		if (matches.length === 0) {
			console.warn('Skipping unmatched OLD VERSION file', old.key);
			continue;
		}

		const anchor = matches[0];
		const duration =
			matches.length > 1
				? matches.reduce((sum, chapter) => sum + chapter.duration_seconds, 0)
				: anchor.duration_seconds;
		const id = `${anchor.id}:old`;
		await tx`
			insert into chapter_audio_versions
				(id, chapter_id, version_id, title, audio_url, duration_seconds, chapter_start, chapter_end)
			values (
				${id}, ${anchor.id}, 'old', ${matches.length > 1 ? stem : anchor.title},
				${mediaUrl(old.key)}, ${duration},
				${matches[0].chapter_number}, ${matches[matches.length - 1].chapter_number}
			)
			on conflict (chapter_id, version_id) do update set
				title = excluded.title,
				audio_url = excluded.audio_url,
				duration_seconds = excluded.duration_seconds,
				chapter_start = excluded.chapter_start,
				chapter_end = excluded.chapter_end
		`;
	}
});

// 4. Delete stale hash-based objects only after copies and DB updates succeed.
if (deleteOld) {
	const [bookUrls, volumeUrls, chapterUrls, versionUrls, illustrationUrls, broadcastUrls] =
		await Promise.all([
			sql`select cover_url, home_image_url, video_url from books`,
			sql`select cover_url from volumes`,
			sql`select audio_url from chapters`,
			sql`select audio_url from chapter_audio_versions`,
			sql`select image_url from illustrations`,
			sql`select cover_url from broadcasts`
		]);
	const referencedKeys = new Set();
	const addReferencedUrl = (url) => {
		const key = dbKeyFromUrl(url);
		if (key) referencedKeys.add(key);
	};
	for (const row of bookUrls) {
		addReferencedUrl(row.cover_url);
		addReferencedUrl(row.home_image_url);
		addReferencedUrl(row.video_url);
	}
	for (const row of volumeUrls) addReferencedUrl(row.cover_url);
	for (const row of chapterUrls) addReferencedUrl(row.audio_url);
	for (const row of versionUrls) addReferencedUrl(row.audio_url);
	for (const row of illustrationUrls) addReferencedUrl(row.image_url);
	for (const row of broadcastUrls) addReferencedUrl(row.cover_url);

	const stale = target
		.filter(
			(item) =>
				(item.key.startsWith('chapters/') ||
					item.key.startsWith('volumes/') ||
					item.key.startsWith('legacy/')) &&
				!referencedKeys.has(item.key)
		)
		.map((item) => ({ Key: item.key }));
	let deletedCount = 0;
	let deleteErrors = 0;
	for (let index = 0; index < stale.length; index += 1000) {
		const batch = stale.slice(index, index + 1000);
		const response = await client.send(
			new DeleteObjectsCommand({
				Bucket: targetBucket,
				Delete: { Objects: batch, Quiet: true }
			})
		);
		const errors = response.Errors ?? [];
		if (errors.length > 0) {
			deleteErrors += errors.length;
			console.error('DeleteObjectsCommand returned errors:', errors);
		}
		deletedCount += batch.length - errors.length;
	}
	console.log(
		`Deleted ${deletedCount} unused legacy hash-based objects${deleteErrors ? ` (${deleteErrors} errors)` : ''}.`
	);
}

await sql.end();
console.log(
	JSON.stringify(
		{
			copied,
			updatedChapters,
			oldTracks: oldRows.length,
			sourceFiles: source.length
		},
		null,
		2
	)
);
