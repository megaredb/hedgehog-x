<script lang="ts">
	import { onMount } from 'svelte';
	import { Gift, Sparkles, PartyPopper } from '@lucide/svelte';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';

	const STORAGE_KEY = 'hedgehog-welcome-modal-dismissed';

	interface Props {
		openDelay?: number;
	}

	let { openDelay = 400 }: Props = $props();

	let isOpen = $state(false);
	let dontShowAgain = $state(false);

	onMount(() => {
		if (localStorage.getItem(STORAGE_KEY) === 'true') return;

		const timer = setTimeout(() => {
			isOpen = true;
		}, openDelay);

		return () => clearTimeout(timer);
	});

	function handleClose() {
		isOpen = false;
		if (dontShowAgain) {
			localStorage.setItem(STORAGE_KEY, 'true');
		}
	}
</script>

<Dialog.Root bind:open={isOpen}>
	<Dialog.Content data-slot="welcome-modal" class="sm:max-w-md">
		<Dialog.Header class="text-center">
			<div
				class="mx-auto mb-2 flex size-14 items-center justify-center rounded-full bg-primary/15 text-primary"
			>
				<Gift class="size-7" />
			</div>
			<Dialog.Title class="flex items-center justify-center gap-2 text-xl">
				<Sparkles class="size-5 text-primary" />
				Добро пожаловать в HEDGEHOG.INC!
			</Dialog.Title>
			<Dialog.Description class="mx-auto max-w-sm">
				Приветствуем вас! Это тестовое модальное окно — оно показывается при открытии сайта.
			</Dialog.Description>
		</Dialog.Header>

		<div class="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/30 p-3">
			<PartyPopper class="mt-0.5 size-5 shrink-0 text-primary" />
			<p class="text-sm text-muted-foreground">
				Слушайте аудиокниги, следите за прогрессом и возвращайтесь к любимым историям в любой
				момент.
			</p>
		</div>

		<label class="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
			<input
				type="checkbox"
				bind:checked={dontShowAgain}
				class="size-4 accent-primary rounded border-border"
			/>
			Не показывать больше
		</label>

		<Dialog.Footer class="gap-2">
			<Button data-slot="welcome-close" size="lg" class="w-full" onclick={handleClose}>
				Начать прослушивание
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
