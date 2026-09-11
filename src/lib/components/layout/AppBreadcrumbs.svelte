<script lang="ts">
	import * as Breadcrumb from '$lib/components/ui/breadcrumb/index.js';
	import { page } from '$app/state';
	import { db } from '$lib/client/db';
	import { useDexie } from '$lib/client/db/useLiveQuery.svelte';

	let segments = $derived(page.url.pathname.split('/').filter(Boolean));

	let bookId = $derived(segments[0] === 'books' && segments[1] ? segments[1] : null);
	let volumeId = $derived(segments[0] === 'books' && segments[2] ? segments[2] : null);

	const bookQuery = useDexie(
		async () => {
			if (!bookId) return undefined;
			return db.books.get(bookId);
		},
		() => undefined,
		() => [bookId]
	);

	const volumeQuery = useDexie(
		async () => {
			if (!volumeId) return undefined;
			return db.volumes.get(volumeId);
		},
		() => undefined,
		() => [volumeId]
	);

	let breadcrumbs = $derived(
		segments.map((segment, i) => {
			let title = segment.charAt(0).toUpperCase() + segment.slice(1);
			if (segment === 'books') title = 'Книги';
			else if (segment === bookId) title = bookQuery.data?.title || 'Загрузка...';
			else if (segment === volumeId) title = volumeQuery.data?.title || 'Загрузка...';

			return {
				segment,
				title,
				href: '/' + segments.slice(0, i + 1).join('/'),
				isLast: i === segments.length - 1
			};
		})
	);
</script>

{#if segments.length > 0}
	<div
		class="top-0 z-10 w-full overflow-hidden border-b bg-background/80 px-4 py-3 backdrop-blur-md"
	>
		<!-- Горизонтальный скролл контейнер (скрываем скроллбар) -->
		<div class="no-scrollbar flex min-h-[32px] w-full items-center overflow-x-auto">
			<Breadcrumb.Root>
				<Breadcrumb.List class="flex-nowrap whitespace-nowrap">
					<Breadcrumb.Item>
						<Breadcrumb.Link href="/">Главная</Breadcrumb.Link>
					</Breadcrumb.Item>

					{#each breadcrumbs as bc, i (bc.segment)}
						{#if breadcrumbs.length <= 3 || i === 0 || i >= breadcrumbs.length - 2}
							<Breadcrumb.Separator />
							<Breadcrumb.Item>
								{#if bc.isLast}
									<Breadcrumb.Page>{bc.title}</Breadcrumb.Page>
								{:else}
									<Breadcrumb.Link href={bc.href}>{bc.title}</Breadcrumb.Link>
								{/if}
							</Breadcrumb.Item>
						{:else if i === 1}
							<Breadcrumb.Separator />
							<Breadcrumb.Item>
								<Breadcrumb.Ellipsis />
							</Breadcrumb.Item>
						{/if}
					{/each}
				</Breadcrumb.List>
			</Breadcrumb.Root>
		</div>
	</div>
{/if}

<style>
	/* Скрываем scrollbar для Chrome, Safari, Opera */
	.no-scrollbar::-webkit-scrollbar {
		display: none;
	}

	/* Скрываем scrollbar для IE, Edge, Firefox */
	.no-scrollbar {
		-ms-overflow-style: none; /* IE and Edge */
		scrollbar-width: none; /* Firefox */
	}
</style>
