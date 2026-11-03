<script lang="ts">
	import type { Action } from 'svelte/action';
	import { extractTelegramDiscussion } from '$lib/utils/telegram';
	import { mode } from 'mode-watcher';
	import { WifiOff, MessageSquare, ExternalLink } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';

	interface Props {
		discussion?: string | null;
		class?: string;
	}

	let { discussion, class: className = '' }: Props = $props();

	let isOnline = $state(typeof navigator !== 'undefined' ? navigator.onLine : true);

	const parsedDiscussion = $derived(extractTelegramDiscussion(discussion));
	const isDark = $derived(mode.current === 'dark');

	function handleOnline() {
		isOnline = true;
	}

	function handleOffline() {
		isOnline = false;
	}

	$effect(() => {
		if (typeof window === 'undefined') return;

		window.addEventListener('online', handleOnline);
		window.addEventListener('offline', handleOffline);

		return () => {
			window.removeEventListener('online', handleOnline);
			window.removeEventListener('offline', handleOffline);
		};
	});

	type WidgetParams = { discussion: string | null; dark: boolean };

	const telegramWidget: Action<HTMLElement, WidgetParams> = (node, params) => {
		function renderWidget(p: WidgetParams) {
			node.replaceChildren();
			if (!p.discussion) return;

			const script = document.createElement('script');
			script.async = true;
			script.src = 'https://telegram.org/js/telegram-widget.js?22';
			script.setAttribute('data-telegram-discussion', p.discussion);
			script.setAttribute('data-comments-limit', '10');
			script.setAttribute('data-color', 'e06437');
			script.setAttribute('data-colorful', '1');
			if (p.dark) {
				script.setAttribute('data-dark', '1');
			}
			node.appendChild(script);
		}

		renderWidget(params);

		return {
			update(newParams) {
				renderWidget(newParams);
			},
			destroy() {
				node.replaceChildren();
			}
		};
	};
</script>

<div class="w-full {className}">
	{#if !isOnline}
		<div
			class="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/20 p-8 text-center"
		>
			<WifiOff class="mb-3 h-8 w-8 text-muted-foreground/60" />
			<h3 class="font-semibold text-foreground">Вы находитесь в оффлайн-режиме</h3>
			<p class="mt-1 max-w-sm text-xs text-muted-foreground">
				Комментарии загружаются напрямую из Telegram и станут доступны при подключении к интернету.
			</p>
		</div>
	{:else if !parsedDiscussion}
		<div
			class="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/20 p-8 text-center"
		>
			<MessageSquare class="mb-3 h-8 w-8 text-muted-foreground/60" />
			<h3 class="font-semibold text-foreground">Обсуждение ещё не привязано</h3>
			<p class="mt-1 max-w-sm text-xs text-muted-foreground">
				Для этой главы или тома ещё нет ветки комментариев в Telegram. Вы можете обсудить аудиокнигу
				в нашем официальном канале!
			</p>
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<Button
				variant="outline"
				size="sm"
				class="mt-4 gap-2"
				href="https://t.me/hedgehogincoverlord"
				target="_blank"
				rel="noopener noreferrer"
			>
				<span>Перейти в Telegram-канал</span>
				<ExternalLink class="h-3.5 w-3.5" />
			</Button>
		</div>
	{:else}
		<!-- Контейнер для виджета Telegram через Svelte Action -->
		<div
			use:telegramWidget={{ discussion: parsedDiscussion, dark: isDark }}
			class="flex min-h-40 w-full justify-center overflow-hidden"
		></div>
	{/if}
</div>
