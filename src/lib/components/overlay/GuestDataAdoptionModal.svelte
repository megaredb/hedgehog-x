<script lang="ts">
	import BaseModal from '$lib/components/overlay/BaseModal.svelte';
	import { Button } from '$lib/components/ui/button';
	import { guestAdoption } from '$lib/client/services/guestAdoption.svelte';

	const counts = $derived(guestAdoption.request?.counts);
	const accountName = $derived(guestAdoption.accountName);
</script>

<BaseModal
	open={guestAdoption.open}
	title="Перенести локальные данные?"
	description="В этом браузере есть данные, которые не привязаны к аккаунту."
	onClose={() => guestAdoption.choose('discard')}
>
	<div class="space-y-4 text-sm">
		<p>
			Перенести их в <strong>{accountName}</strong>? Если отказаться, локальные данные будут
			удалены, а в аккаунте останутся только серверные.
		</p>

		{#if counts}
			<ul class="space-y-2 rounded-lg border border-border/60 bg-muted/30 p-3">
				{#if counts.bookmarks > 0}
					<li class="flex justify-between gap-3">
						<span class="text-muted-foreground">Закладки</span>
						<span class="font-semibold">{counts.bookmarks}</span>
					</li>
				{/if}
				{#if counts.progress > 0}
					<li class="flex justify-between gap-3">
						<span class="text-muted-foreground">Главы с прогрессом</span>
						<span class="font-semibold">{counts.progress}</span>
					</li>
				{/if}
				{#if counts.volumeLikes + counts.chapterLikes > 0}
					<li class="flex justify-between gap-3">
						<span class="text-muted-foreground">Лайки</span>
						<span class="font-semibold">{counts.volumeLikes + counts.chapterLikes}</span>
					</li>
				{/if}
			</ul>
		{/if}

		<p class="text-xs text-muted-foreground">
			Данные будут объединены с серверными. Это действие выполняется один раз.
		</p>
	</div>

	{#snippet footer()}
		<Button variant="outline" onclick={() => guestAdoption.choose('discard')}>Не переносить</Button>
		<Button onclick={() => guestAdoption.choose('import')}>Перенести в аккаунт</Button>
	{/snippet}
</BaseModal>
