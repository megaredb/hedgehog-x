<script lang="ts">
	import * as Drawer from '$lib/components/ui/drawer';
	import type { OfflineChapter } from '$lib/client/db';
	import TelegramComments from './TelegramComments.svelte';
	import { MessageSquare } from '@lucide/svelte';

	interface Props {
		open: boolean;
		chapter: OfflineChapter | null;
		volumeTitle?: string;
	}

	let { open = $bindable(false), chapter, volumeTitle = 'Том' }: Props = $props();
</script>

<Drawer.Root bind:open>
	<Drawer.Content class="max-h-[85vh]">
		<div class="mx-auto w-full max-w-2xl px-4 py-4 sm:px-6">
			<Drawer.Header class="px-0 pt-0 text-left">
				<div class="flex items-center gap-2 text-xs font-medium text-muted-foreground">
					<MessageSquare class="h-3.5 w-3.5" />
					<span>Обсуждение главы • {volumeTitle}</span>
				</div>
				<Drawer.Title class="text-lg font-bold">
					{chapter ? `Глава ${chapter.chapterNumber}: ${chapter.title}` : 'Комментарии к главе'}
				</Drawer.Title>
				<Drawer.Description class="text-xs">
					Комментарии синхронизируются с Telegram-каналом проекта.
				</Drawer.Description>
			</Drawer.Header>

			<div class="mt-4 max-h-[60vh] overflow-y-auto pb-6">
				{#if chapter}
					<TelegramComments discussion={chapter.telegramPostUrl} />
				{/if}
			</div>
		</div>
	</Drawer.Content>
</Drawer.Root>
