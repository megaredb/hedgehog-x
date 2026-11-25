<!-- eslint-disable svelte/no-navigation-without-resolve -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { onMount, untrack } from 'svelte';
	import type { DiscordStatus, TelegramStatus } from '$lib/server/integrations/status';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import DiscordIcon from '$lib/components/icons/DiscordIcon.svelte';
	import TelegramIcon from '$lib/components/icons/TelegramIcon.svelte';
	import {
		ArrowLeft,
		CheckCircle2,
		ExternalLink,
		RefreshCw,
		Settings2,
		ShieldCheck,
		TriangleAlert
	} from '@lucide/svelte';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let telegram = $state<TelegramStatus>(untrack(() => data.telegram));
	let discord = $state<DiscordStatus>(untrack(() => data.discord));
	let statusLoading = $state(true);
	let statusError = $state('');

	async function refreshStatus() {
		statusLoading = true;
		statusError = '';
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 8000);
		try {
			const response = await fetch('/api/admin/integrations', {
				headers: { accept: 'application/json' },
				signal: controller.signal
			});
			if (!response.ok) throw new Error('Не удалось проверить интеграции');
			const payload = (await response.json()) as {
				telegram: TelegramStatus;
				discord: DiscordStatus;
			};
			telegram = payload.telegram;
			discord = payload.discord;
		} catch (error) {
			statusError =
				error instanceof DOMException && error.name === 'AbortError'
					? 'Проверка заняла слишком много времени. Попробуйте ещё раз.'
					: error instanceof Error
						? error.message
						: 'Ошибка проверки интеграций';
		} finally {
			clearTimeout(timeout);
			statusLoading = false;
		}
	}

	onMount(refreshStatus);
</script>

<div class="space-y-6">
	<a
		class="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
		href={resolve('/admin/users')}
	>
		<ArrowLeft class="h-3.5 w-3.5" />
		К пользователям
	</a>

	<header>
		<h1 class="text-2xl font-bold tracking-tight">Интеграции</h1>
		<p class="mt-1 max-w-2xl text-sm text-muted-foreground">
			Источники подписок для страницы «Пользователи». Boosty настраивается отдельно; приложение не
			хранит токены Boosty.
		</p>
	</header>

	{#if statusLoading}
		<div
			class="flex items-center gap-2 rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground"
			role="status"
		>
			<RefreshCw class="h-4 w-4 animate-spin" /> Проверяем Telegram и Discord…
		</div>
	{:else if statusError}
		<div
			class="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
			role="alert"
		>
			{statusError}
		</div>
	{/if}

	{#if form?.error}
		<div
			class="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
			role="alert"
		>
			{form.error}
		</div>
	{:else if form?.success}
		<div
			class="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300"
			role="status"
		>
			{form.message ?? 'Готово'}
		</div>
	{/if}

	<div class="grid gap-4 lg:grid-cols-2">
		<Card class="border-border/60">
			<CardHeader class="pb-3">
				<CardTitle class="flex items-center gap-2 text-base">
					<span
						class="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400"
						><TelegramIcon class="h-4 w-4" /></span
					>
					Telegram
					<Badge
						variant={data.config.telegramConfigured ? 'default' : 'outline'}
						class="ml-auto text-[10px]"
					>
						{statusLoading
							? 'Проверяем…'
							: data.config.telegramConfigured
								? telegram.error
									? 'Настроено · ошибка'
									: 'Настроено'
								: 'Не настроено'}
					</Badge>
				</CardTitle>
			</CardHeader>
			<CardContent class="space-y-3 text-sm">
				<dl class="space-y-2">
					<div class="flex items-start justify-between gap-4">
						<dt class="text-muted-foreground">Бот</dt>
						<dd class="text-right">{telegram.bot ? '@' + telegram.bot.username : '—'}</dd>
					</div>
					<div class="flex items-start justify-between gap-4">
						<dt class="text-muted-foreground">Группа</dt>
						<dd class="text-right">{telegram.chat?.title ?? '—'}</dd>
					</div>
					<div class="flex items-start justify-between gap-4">
						<dt class="text-muted-foreground">Chat ID</dt>
						<dd class="text-right font-mono text-xs">{telegram.chat?.id ?? '—'}</dd>
					</div>
					<div class="flex items-start justify-between gap-4">
						<dt class="text-muted-foreground">Webhook</dt>
						<dd class="text-right">{telegram.webhook?.url ? 'Настроен' : 'Не настроен'}</dd>
					</div>
					<div class="flex items-start justify-between gap-4">
						<dt class="text-muted-foreground">Очередь обновлений</dt>
						<dd class="text-right">{telegram.webhook?.pending ?? 0}</dd>
					</div>
				</dl>
				{#if telegram.webhook?.lastError}
					<div
						class="flex gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-800 dark:text-amber-200"
					>
						<TriangleAlert class="mt-0.5 h-4 w-4 shrink-0" />{telegram.webhook.lastError}
					</div>
				{/if}
				{#if telegram.error}
					<div
						class="flex gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-800 dark:text-amber-200"
					>
						<TriangleAlert class="mt-0.5 h-4 w-4 shrink-0" />{telegram.error}
					</div>
				{/if}
				<div class="flex flex-wrap gap-2 border-t pt-3">
					<Button
						type="button"
						size="sm"
						variant="outline"
						class="gap-1"
						disabled={statusLoading}
						onclick={refreshStatus}
						><RefreshCw
							class="h-3.5 w-3.5 {statusLoading ? 'animate-spin' : ''}"
						/>Проверить</Button
					>
					<form method="POST" action="?/setWebhook" use:enhance>
						<Button type="submit" size="sm" variant="outline" class="gap-1"
							><Settings2 class="h-3.5 w-3.5" />Настроить webhook</Button
						>
					</form>
				</div>
			</CardContent>
		</Card>

		<Card class="border-border/60">
			<CardHeader class="pb-3">
				<CardTitle class="flex items-center gap-2 text-base">
					<span
						class="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400"
						><DiscordIcon class="h-4 w-4" /></span
					>
					Discord
					<Badge variant={discord.configured ? 'default' : 'outline'} class="ml-auto text-[10px]">
						{statusLoading
							? 'Проверяем…'
							: discord.configured
								? discord.mode === 'bot'
									? 'Бот'
									: 'OAuth'
								: 'Не настроено'}
					</Badge>
				</CardTitle>
			</CardHeader>
			<CardContent class="space-y-3 text-sm">
				<dl class="space-y-2">
					<div class="flex items-start justify-between gap-4">
						<dt class="text-muted-foreground">Режим</dt>
						<dd class="text-right">
							{discord.mode === 'bot'
								? 'Бот'
								: discord.mode === 'oauth'
									? 'OAuth пользователя'
									: '—'}
						</dd>
					</div>
					<div class="flex items-start justify-between gap-4">
						<dt class="text-muted-foreground">Сервер</dt>
						<dd class="text-right">
							{discord.guild?.name ?? (data.config.discordGuildConfigured ? 'настроен' : '—')}
						</dd>
					</div>
					<div class="flex items-start justify-between gap-4">
						<dt class="text-muted-foreground">Роли</dt>
						<dd class="text-right">
							{discord.roles.length
								? discord.roles.map((role) => role.name).join(', ')
								: data.config.discordGuildConfigured
									? 'настроены (OAuth)'
									: '—'}
						</dd>
					</div>
					<div class="flex items-start justify-between gap-4">
						<dt class="text-muted-foreground">Бот</dt>
						<dd class="text-right">{discord.bot?.username ?? '—'}</dd>
					</div>
				</dl>
				{#if discord.oauthCheck}
					<div class="rounded-md border bg-muted/40 p-2 text-xs text-muted-foreground">
						{discord.oauthCheck}
					</div>
				{/if}
				{#if discord.error}
					<div
						class="flex gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-800 dark:text-amber-200"
					>
						<TriangleAlert class="mt-0.5 h-4 w-4 shrink-0" />{discord.error}
					</div>
				{/if}
				<div class="flex flex-wrap gap-2 border-t pt-3">
					<Button
						type="button"
						size="sm"
						variant="outline"
						class="gap-1"
						disabled={statusLoading}
						onclick={refreshStatus}
						><RefreshCw
							class="h-3.5 w-3.5 {statusLoading ? 'animate-spin' : ''}"
						/>Проверить</Button
					>
				</div>
			</CardContent>
		</Card>
	</div>
	<Card class="border-border/60">
		<CardHeader class="pb-3"
			><CardTitle class="flex items-center gap-2 text-base"
				><ShieldCheck class="h-4 w-4 text-orange-500" />Boosty</CardTitle
			></CardHeader
		>
		<CardContent class="space-y-3 text-sm">
			<div
				class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-orange-500/20 bg-orange-500/5 p-3"
			>
				<div>
					<p class="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
						Аккаунт автора
					</p>
					<p class="mt-0.5 font-semibold">{data.config.boostyBlogName}</p>
					<button
						type="button"
						class="text-left text-xs text-muted-foreground hover:text-foreground"
						onclick={() => window.open(data.config.boostyBlogUrl, '_blank', 'noopener,noreferrer')}
						>{data.config.boostyBlogUrl}</button
					>
				</div>
				<Badge variant={data.config.boostyConfigured ? 'default' : 'outline'} class="text-[10px]">
					{data.config.boostyConfigured ? 'Настроен' : 'Не настроен'}
				</Badge>
			</div>
			<p class="max-w-3xl text-muted-foreground">
				Boosty-бот @boosty_to_bot добавляет платных подписчиков в Telegram-группу и выдаёт роль в
				Discord. Приложение не хранит токены Boosty и не вызывает его API — проверяет результат
				через Telegram и Discord.
			</p>
			<ul class="space-y-1.5">
				<li class="flex items-center gap-2 text-xs">
					<CheckCircle2 class="h-3.5 w-3.5 text-emerald-500" />Аккаунт Boosty: {data.config
						.boostyBlogName}
				</li>
				<li class="flex items-center gap-2 text-xs">
					<CheckCircle2 class="h-3.5 w-3.5 text-emerald-500" />Telegram-группа: {telegram.chat
						?.title ?? 'настроена'}
				</li>
				<li class="flex items-center gap-2 text-xs">
					<CheckCircle2 class="h-3.5 w-3.5 text-emerald-500" />Discord-сервер: {discord.guild
						?.name ?? 'настроен'}
				</li>
				<li class="flex items-center gap-2 text-xs">
					<CheckCircle2 class="h-3.5 w-3.5 text-emerald-500" />Платёж/подписка Boosty →
					Telegram/Discord → источник приложения
				</li>
			</ul>
			<div class="flex flex-wrap gap-2">
				<Button
					href={data.config.boostyBlogUrl}
					target="_blank"
					rel="noreferrer"
					variant="outline"
					size="sm"
					class="gap-1">Открыть Boosty<ExternalLink class="h-3.5 w-3.5" /></Button
				>
				<Button
					href="https://boosty.to/boosty/posts/9b7e8eab-2a04-4fd9-a261-7e33f995f0ab"
					target="_blank"
					rel="noreferrer"
					size="sm"
					class="gap-1">Инструкция Boosty<ExternalLink class="h-3.5 w-3.5" /></Button
				>
			</div>
		</CardContent>
	</Card>
</div>
