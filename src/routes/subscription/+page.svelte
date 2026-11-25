<!-- eslint-disable svelte/no-navigation-without-resolve -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import BaseModal from '$lib/components/overlay/BaseModal.svelte';
	import ListFilterBar from '$lib/components/common/ListFilterBar.svelte';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import DiscordIcon from '$lib/components/icons/DiscordIcon.svelte';
	import TelegramIcon from '$lib/components/icons/TelegramIcon.svelte';
	import {
		ArrowUpRight,
		Bell,
		CheckCircle2,
		Crown,
		Gift,
		Heart,
		Infinity as InfinityIcon,
		Lock,
		MessageCircle,
		RefreshCw,
		ShieldCheck
	} from '@lucide/svelte';
	import { pluralDays } from '$lib/subscriptions/domain';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let checking = $state(false);

	function formatDate(value: Date | string | null | undefined): string {
		if (!value) return '—';
		const date = value instanceof Date ? value : new Date(value);
		if (Number.isNaN(date.getTime())) return '—';
		return date
			.toLocaleDateString('ru-RU', {
				day: 'numeric',
				month: 'long',
				year: 'numeric',
				timeZone: 'Europe/Moscow'
			})
			.replace(/\s*г\.$/, '');
	}

	function formatDateTime(value: Date | string | number | null | undefined): string {
		if (!value) return '—';
		const date = value instanceof Date ? value : new Date(value);
		if (Number.isNaN(date.getTime())) return '—';
		return date.toLocaleString('ru-RU', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			timeZone: 'Europe/Moscow'
		});
	}

	function eventLabel(event: (typeof data.events)[number]): string {
		switch (event.type) {
			case 'grant':
				return event.afterLifetime
					? 'Выдана вечная подписка'
					: 'Начислено ' + (event.days ?? 0) + ' ' + pluralDays(event.days ?? 0);
			case 'donation':
				return (
					'Донат' + (event.amountRub ? ' · ' + event.amountRub.toLocaleString('ru-RU') + ' ₽' : '')
				);
			case 'revoke':
				return 'Подписка приостановлена администратором';
			case 'restore':
				return 'Подписка восстановлена администратором';
			case 'set_expiry':
				return 'Изменена дата окончания';
			case 'block':
				return 'Подписка заблокирована';
			case 'unblock':
				return 'Подписка разблокирована';
			case 'source_activate':
				return event.source === 'telegram' ? 'Подтверждён Telegram' : 'Подтверждён Discord';
			case 'source_deactivate':
				return event.source === 'telegram' ? 'Снят Telegram' : 'Снят Discord';
			case 'price_recalc':
				return 'Пересчитана цена подписки';
			default:
				return event.type;
		}
	}

	const checkedAt = $derived(
		[data.summary.telegramCheckedAt, data.summary.discordCheckedAt]
			.filter(Boolean)
			.map((value) => new Date(value as Date | string).getTime())
			.sort((a, b) => b - a)[0] ?? null
	);
	const statusTitle = $derived(
		data.summary.blocked
			? 'Подписка заблокирована'
			: data.summary.revoked
				? 'Подписка приостановлена'
				: data.summary.isLifetime
					? 'Вечная подписка'
					: data.summary.active
						? 'Подписка активна'
						: 'Подписка не активна'
	);
	const donationEvents = $derived(data.events.filter((event) => (event.amountRub ?? 0) > 0));
	const recentDonations = $derived(donationEvents.slice(0, 10));
	const recentHistory = $derived(data.events.slice(0, 10));

	let donationsOpen = $state(false);
	let historyOpen = $state(false);
	let donationQuery = $state('');
	let donationSort = $state('new');
	let donationPeriod = $state('all');
	let donationSource = $state('all');
	let historyQuery = $state('');
	let historySort = $state('new');
	let historyPeriod = $state('all');
	let historySource = $state('all');

	const donationSortOptions = [
		{ value: 'new', label: 'Сначала новые' },
		{ value: 'old', label: 'Сначала старые' },
		{ value: 'amount_desc', label: 'Сумма: по убыванию' },
		{ value: 'amount_asc', label: 'Сумма: по возрастанию' }
	];
	const donationSourceOptions = [
		{ value: 'all', label: 'Все источники' },
		{ value: 'sber', label: 'Сбербанк' },
		{ value: 'manual', label: 'Администратор' }
	];
	const historySortOptions = [
		{ value: 'new', label: 'Сначала новые' },
		{ value: 'old', label: 'Сначала старые' }
	];
	const historySourceOptions = [
		{ value: 'all', label: 'Все источники' },
		{ value: 'sber', label: 'Сбербанк' },
		{ value: 'manual', label: 'Администратор' },
		{ value: 'telegram', label: 'Telegram' },
		{ value: 'discord', label: 'Discord' }
	];

	function sourceKey(event: (typeof data.events)[number]): string {
		return event.type === 'donation' ? 'sber' : event.source;
	}

	function inPeriod(value: Date | string, period: string): boolean {
		if (period === 'all') return true;
		return new Date(value).getTime() >= Date.now() - Number(period) * 86400000;
	}

	const filteredDonations = $derived.by(() => {
		const query = donationQuery.trim().toLowerCase();
		return donationEvents
			.filter((event) => {
				if (!inPeriod(event.createdAt, donationPeriod)) return false;
				if (donationSource !== 'all' && sourceKey(event) !== donationSource) return false;
				return (
					!query ||
					[event.note, String(event.amountRub)]
						.filter(Boolean)
						.some((value) => value!.toLowerCase().includes(query))
				);
			})
			.sort((a, b) => {
				if (donationSort === 'old')
					return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
				if (donationSort === 'amount_desc') return (b.amountRub ?? 0) - (a.amountRub ?? 0);
				if (donationSort === 'amount_asc') return (a.amountRub ?? 0) - (b.amountRub ?? 0);
				return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
			});
	});

	const filteredHistory = $derived.by(() => {
		const query = historyQuery.trim().toLowerCase();
		return data.events
			.filter((event) => {
				if (!inPeriod(event.createdAt, historyPeriod)) return false;
				if (historySource !== 'all' && sourceKey(event) !== historySource) return false;
				return (
					!query ||
					[eventLabel(event), event.note, event.source]
						.filter(Boolean)
						.some((value) => value!.toLowerCase().includes(query))
				);
			})
			.sort((a, b) =>
				historySort === 'old'
					? new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
					: new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
			);
	});
	const statusText = $derived(
		data.summary.blocked
			? data.summary.blockedReason || 'Доступ приостановлен администратором.'
			: data.summary.revoked
				? data.summary.revokedDaysLeft != null
					? 'Подписка приостановлена администратором. Осталось ' +
						data.summary.revokedDaysLeft +
						' ' +
						pluralDays(data.summary.revokedDaysLeft) +
						' — они сохранятся до восстановления.'
					: 'Подписка приостановлена администратором. Остаток дней сохранится до восстановления.'
				: data.summary.isLifetime
					? 'Выдана навсегда. Спасибо, что поддерживаете проект.'
					: data.summary.expiresAt
						? 'Подписка от администратора действует до ' +
							formatDate(data.summary.expiresAt) +
							(data.summary.daysLeft != null
								? ' · осталось ' + data.summary.daysLeft + ' ' + pluralDays(data.summary.daysLeft)
								: '')
						: data.summary.boostyActive
							? 'Доступ действует, пока активна подписка Boosty.'
							: 'Оформите Boosty или попросите администратора начислить дни.'
	);
</script>

<svelte:head>
	<meta name="robots" content="noindex" />
	<title>{data.isGuest ? 'Подписка' : 'Моя подписка'} · HEDGEHOG.INC</title>
</svelte:head>

<div class="layout-content space-y-6 py-6">
	{#if data.isGuest}
		<header>
			<Badge variant="outline" class="mb-2">HEDGEHOG.INC</Badge>
			<h1 class="text-3xl font-bold tracking-tight">Подписка</h1>
			<p class="mt-2 max-w-2xl text-sm text-muted-foreground">
				Подписка открывает закрытое сообщество и помогает нам продолжать озвучку книг.
			</p>
		</header>

		<div class="grid gap-4 sm:grid-cols-3">
			<Card class="border-border/60">
				<CardHeader class="pb-2">
					<div
						class="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-500"
					>
						<TelegramIcon class="h-5 w-5" />
					</div>
					<CardTitle class="text-base">Закрытая Telegram-группа</CardTitle>
				</CardHeader>
				<CardContent class="text-sm text-muted-foreground">
					Инвайт приходит от @boosty_to_bot после привязки Telegram к Boosty.
				</CardContent>
			</Card>
			<Card class="border-border/60">
				<CardHeader class="pb-2">
					<div
						class="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500"
					>
						<DiscordIcon class="h-5 w-5" />
					</div>
					<CardTitle class="text-base">Роль в Discord</CardTitle>
				</CardHeader>
				<CardContent class="text-sm text-muted-foreground">
					Роль «Boosty · Подписчик» на сервере HEDGEHOG.INC выдаётся автоматически.
				</CardContent>
			</Card>
			<Card class="border-border/60">
				<CardHeader class="pb-2">
					<div
						class="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500"
					>
						<Crown class="h-5 w-5" />
					</div>
					<CardTitle class="text-base">Бейдж подписчика</CardTitle>
				</CardHeader>
				<CardContent class="text-sm text-muted-foreground">
					Отображается в профиле и рядом с именем. Виден другим пользователям.
				</CardContent>
			</Card>
		</div>

		<Card
			class="border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-card to-amber-500/5"
		>
			<CardContent class="space-y-4 p-6">
				<div class="flex items-start gap-3">
					<Heart class="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
					<div>
						<h2 class="text-lg font-semibold">Поддержите проект</h2>
						<p class="mt-1 max-w-2xl text-sm text-muted-foreground">
							Ваша подписка помогает оплачивать озвучку, монтаж и новые главы. Спасибо, что слушаете
							и поддерживаете HEDGEHOG.INC.
						</p>
					</div>
				</div>
				<div class="flex flex-col gap-2 sm:flex-row">
					<Button
						size="lg"
						class="gap-2"
						href={`${resolve('/auth')}?from=${encodeURIComponent('/subscription')}`}
					>
						Оформить подписку
						<ArrowUpRight class="h-4 w-4" />
					</Button>
					<Button
						variant="outline"
						size="lg"
						href={data.config.boostyBlogUrl}
						target="_blank"
						rel="noreferrer"
					>
						Узнать о Boosty
					</Button>
				</div>
			</CardContent>
		</Card>

		<p class="text-xs text-muted-foreground">
			Подписка привязана к аккаунту, а не к способу входа. После входа Telegram и Discord можно
			привязать в профиле.
		</p>
	{:else}
		<header>
			<h1 class="text-2xl font-bold tracking-tight">Моя подписка</h1>
			<p class="mt-1 text-sm text-muted-foreground">
				Статус, источники и история. Проверка занимает пару секунд.
			</p>
		</header>

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

		{#if data.priceNotices.length > 0}
			<div class="space-y-2">
				{#each data.priceNotices as notice (notice.id)}
					<div
						class="flex flex-col gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between dark:text-amber-100"
					>
						<div class="flex gap-2">
							<Bell class="mt-0.5 h-4 w-4 shrink-0" />
							<div>
								<p class="font-semibold">
									Цена дня изменилась: {notice.oldPrice} → {notice.newPrice} ₽
								</p>
								<p class="mt-1 text-xs opacity-90">
									{notice.scope === 'all'
										? 'Оставшийся срок подписки от администратора пересчитан по новой цене. Lifetime не меняется.'
										: 'Ранее выданные дни и донаты сохранены по прежней цене. Новые донаты считаются по новой.'}
								</p>
							</div>
						</div>
						<form method="POST" action="?/dismissNotice" use:enhance>
							<input type="hidden" name="noticeId" value={notice.id} />
							<Button
								type="submit"
								variant="ghost"
								size="sm"
								class="shrink-0 text-amber-900 hover:bg-amber-500/10 dark:text-amber-100"
								>Закрыть</Button
							>
						</form>
					</div>
				{/each}
			</div>
		{/if}

		{#if data.summary.blocked}
			<div
				class="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
			>
				<Lock class="mt-0.5 h-4 w-4 shrink-0" />
				{data.summary.blockedReason || 'Доступ к подписке приостановлен администратором.'}
			</div>
		{/if}

		<Card
			class="overflow-hidden border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-background to-amber-500/10"
		>
			<CardContent class="p-5 sm:p-6">
				<div class="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
					<div class="min-w-0">
						<div
							class="flex items-center gap-2 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase"
						>
							<span
								class="h-1.5 w-1.5 rounded-full {data.summary.active
									? 'bg-emerald-500'
									: 'bg-muted-foreground'}"
							></span>
							Статус подписки
						</div>
						<h2
							class="mt-2 flex flex-wrap items-center gap-2 text-2xl font-extrabold tracking-tight sm:text-3xl"
						>
							{statusTitle}
							{#if data.summary.isLifetime}<InfinityIcon class="h-6 w-6 text-amber-500" />{/if}
						</h2>
						<p class="mt-1 max-w-xl text-sm text-muted-foreground">{statusText}</p>
						<div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
							<span
								>Пожертвовано: <strong class="text-foreground"
									>{data.donations.totalRub.toLocaleString('ru-RU')} ₽</strong
								></span
							>
							<span
								>Донатов: <strong class="text-foreground">{data.donations.donationsCount}</strong
								></span
							>
							{#if data.donations.lastDonationAt}<span
									>Последний: <strong class="text-foreground"
										>{formatDateTime(data.donations.lastDonationAt)}</strong
									></span
								>{/if}
						</div>
						<div class="mt-3 flex flex-wrap gap-1.5">
							{#if data.summary.telegramActive}<Badge variant="outline" class="gap-1 text-[10px]"
									><TelegramIcon class="h-3 w-3" />Boosty · Telegram</Badge
								>{/if}
							{#if data.summary.discordActive}<Badge variant="outline" class="gap-1 text-[10px]"
									><DiscordIcon class="h-3 w-3" />Boosty · Discord</Badge
								>{/if}
							{#if data.summary.expiresAt}<Badge variant="outline" class="gap-1 text-[10px]"
									><Gift class="h-3 w-3" />Администратором</Badge
								>{/if}
							{#if data.summary.isLifetime}<Badge variant="outline" class="gap-1 text-[10px]"
									><InfinityIcon class="h-3 w-3" />Вечная</Badge
								>{/if}
							{#if !data.summary.boostyActive && !data.summary.expiresAt && !data.summary.isLifetime}<Badge
									variant="outline"
									class="gap-1 text-[10px]">Нет активных источников</Badge
								>{/if}
						</div>
					</div>
					<div class="flex shrink-0 flex-col items-start gap-2 sm:items-end">
						<div
							class="flex h-20 w-20 items-center justify-center rounded-full border bg-background/70 shadow-xs"
						>
							{#if data.summary.isLifetime}<InfinityIcon class="h-8 w-8 text-amber-500" />
							{:else if data.summary.active}<CheckCircle2 class="h-8 w-8 text-emerald-500" />
							{:else}<Lock class="h-8 w-8 text-muted-foreground" />{/if}
						</div>
						{#if data.summary.daysLeft != null}<span class="text-xs font-semibold"
								>{data.summary.daysLeft} {pluralDays(data.summary.daysLeft)}</span
							>{/if}
					</div>
				</div>

				<div class="mt-4 flex flex-wrap items-center gap-2 border-t border-border/50 pt-4">
					<form
						method="POST"
						action="?/check"
						use:enhance={() => {
							checking = true;
							return async ({ update }) => {
								await update();
								checking = false;
							};
						}}
					>
						<Button type="submit" variant="outline" size="sm" disabled={checking} class="gap-1">
							<RefreshCw class="h-3.5 w-3.5 {checking ? 'animate-spin' : ''}" />
							{checking ? 'Проверяем…' : 'Проверить статус'}
						</Button>
					</form>
					<Button
						href={data.config.boostyBlogUrl}
						target="_blank"
						rel="noreferrer"
						size="sm"
						class="gap-1"
					>
						Оформить на Boosty<ArrowUpRight class="h-3.5 w-3.5" />
					</Button>
					<Button href={resolve('/support')} variant="ghost" size="sm" class="gap-1"
						>Поддержать проект<Heart class="h-3.5 w-3.5" /></Button
					>
					<span class="ml-auto text-[10px] text-muted-foreground">
						{checkedAt ? 'Проверено ' + formatDateTime(checkedAt) : 'Проверка ещё не выполнялась'}
					</span>
				</div>
			</CardContent>
		</Card>

		<div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
			<div class="space-y-4">
				<Card class="border-border/60">
					<CardHeader class="pb-3"
						><CardTitle class="text-base">Что даёт подписка</CardTitle></CardHeader
					>
					<CardContent class="grid gap-3 sm:grid-cols-3">
						<div class="rounded-lg border bg-background p-3">
							<div
								class="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400"
							>
								<TelegramIcon class="h-4 w-4" />
							</div>
							<p class="mt-2 text-xs font-semibold">Закрытая Telegram-группа</p>
							<p class="mt-1 text-[11px] leading-relaxed text-muted-foreground">
								Инвайт приходит от @boosty_to_bot после привязки Telegram к Boosty.
							</p>
							<p
								class="mt-2 text-[10px] font-semibold {data.summary.telegramActive
									? 'text-emerald-600 dark:text-emerald-400'
									: 'text-muted-foreground'}"
							>
								{data.summary.telegramActive
									? 'Подключено'
									: data.telegram
										? 'Ожидает проверки'
										: 'Telegram не привязан'}
							</p>
						</div>
						<div class="rounded-lg border bg-background p-3">
							<div
								class="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400"
							>
								<DiscordIcon class="h-4 w-4" />
							</div>
							<p class="mt-2 text-xs font-semibold">Роль в Discord</p>
							<p class="mt-1 text-[11px] leading-relaxed text-muted-foreground">
								Роль «Boosty · Подписчик» на сервере HEDGEHOG.INC выдаётся автоматически.
							</p>
							<p
								class="mt-2 text-[10px] font-semibold {data.summary.discordActive
									? 'text-emerald-600 dark:text-emerald-400'
									: 'text-muted-foreground'}"
							>
								{data.summary.discordActive
									? 'Подключено'
									: data.discord
										? 'Ожидает проверки'
										: 'Discord не привязан'}
							</p>
						</div>
						<div class="rounded-lg border bg-background p-3">
							<div
								class="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400"
							>
								<Crown class="h-4 w-4" />
							</div>
							<p class="mt-2 text-xs font-semibold">Бейдж подписчика</p>
							<p class="mt-1 text-[11px] leading-relaxed text-muted-foreground">
								Отображается в профиле и рядом с именем. Виден другим пользователям.
							</p>
							<p
								class="mt-2 text-[10px] font-semibold {data.summary.active
									? 'text-amber-600 dark:text-amber-400'
									: 'text-muted-foreground'}"
							>
								{data.summary.isLifetime
									? 'Навсегда'
									: data.summary.active
										? 'Активен'
										: 'Недоступен'}
							</p>
						</div>
					</CardContent>
				</Card>

				<Card class="border-border/60">
					<CardHeader class="pb-3"
						><CardTitle class="text-base"
							>Как {data.summary.active ? 'продлить' : 'получить'}</CardTitle
						></CardHeader
					>
					<CardContent class="grid gap-3 sm:grid-cols-2">
						<div class="rounded-lg border bg-background p-3">
							<p class="text-xs font-semibold">Boosty</p>
							<p class="mt-1 text-[11px] text-muted-foreground">
								От 100 ₽/мес. Доступ действует, пока активна подписка.
							</p>
							<Button
								href={data.config.boostyBlogUrl}
								target="_blank"
								rel="noreferrer"
								size="sm"
								class="mt-3 gap-1">Открыть Boosty<ArrowUpRight class="h-3.5 w-3.5" /></Button
							>
						</div>
						<div class="rounded-lg border bg-background p-3">
							<p class="text-xs font-semibold">Разовый донат</p>
							<p class="mt-1 text-[11px] text-muted-foreground">
								{data.price} ₽ = 1 день. После перевода администратор начислит дни.
							</p>
							<Button href={resolve('/support')} variant="outline" size="sm" class="mt-3 gap-1"
								>Поддержать проект<Heart class="h-3.5 w-3.5" /></Button
							>
						</div>
					</CardContent>
				</Card>

				<Card class="border-border/60">
					<CardHeader class="flex flex-row items-center justify-between pb-3">
						<CardTitle class="text-base">Донаты</CardTitle>
						<div class="flex items-center gap-2">
							<Badge variant="outline">{data.donations.totalRub.toLocaleString('ru-RU')} ₽</Badge>
							<Button variant="ghost" size="sm" onclick={() => (donationsOpen = true)}>Все</Button>
						</div>
					</CardHeader>
					<CardContent>
						{#if donationEvents.length === 0}
							<div
								class="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground"
							>
								Пока нет донатов. После перевода администратор начислит дни — здесь появится сумма и
								цена дня.
							</div>
						{:else}
							<div class="space-y-1">
								{#each recentDonations as event (event.id)}
									<div
										class="flex items-start justify-between gap-3 border-b border-border/40 py-2 text-xs last:border-0"
									>
										<div class="min-w-0">
											<p class="font-medium">
												{event.amountRub?.toLocaleString('ru-RU')} ₽
												{#if event.type === 'donation'}
													<span class="font-normal text-muted-foreground">· исторический донат</span
													>
												{:else}
													<span class="font-normal text-muted-foreground"
														>· {event.days ?? 0}
														{pluralDays(event.days ?? 0)} · {event.pricePerDay != null
															? event.pricePerDay + ' ₽/день'
															: 'цена не указана'}</span
													>
												{/if}
											</p>
											<p class="truncate text-[10px] text-muted-foreground">
												{event.note || 'Донат от администратора'}
											</p>
										</div>
										<time
											class="shrink-0 text-[10px] text-muted-foreground"
											datetime={String(event.createdAt)}>{formatDateTime(event.createdAt)}</time
										>
									</div>
								{/each}
							</div>
							<p class="mt-2 text-[10px] text-muted-foreground">
								Цена дня указана на момент доната. История хранится для старых и новых цен.
							</p>
						{/if}
					</CardContent>
				</Card>

				<Card class="border-border/60">
					<CardHeader class="flex flex-row items-center justify-between pb-3">
						<CardTitle class="text-base">История</CardTitle>
						<Button variant="ghost" size="sm" onclick={() => (historyOpen = true)}>Все</Button>
					</CardHeader>
					<CardContent>
						{#if data.events.length === 0}
							<div
								class="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground"
							>
								Пока нет событий. Как только появится подписка, здесь будет история.
							</div>
						{:else}
							<div class="space-y-1">
								{#each recentHistory as event (event.id)}
									<div
										class="flex items-start justify-between gap-3 border-b border-border/40 py-2 text-xs last:border-0"
									>
										<div class="min-w-0">
											<p class="font-medium">{eventLabel(event)}</p>
											<p class="truncate text-[10px] text-muted-foreground">
												{event.note ||
													(event.source === 'manual' ? 'Администратором' : event.source)}
											</p>
										</div>
										<time
											class="shrink-0 text-[10px] text-muted-foreground"
											datetime={String(event.createdAt)}>{formatDateTime(event.createdAt)}</time
										>
									</div>
								{/each}
							</div>
						{/if}
					</CardContent>
				</Card>
			</div>

			<aside class="space-y-4">
				<Card class="border-border/60">
					<CardHeader class="pb-3"
						><CardTitle class="flex items-center gap-2 text-sm"
							><ShieldCheck class="h-4 w-4 text-emerald-500" />Ваши аккаунты</CardTitle
						></CardHeader
					>
					<CardContent class="space-y-2 text-xs">
						<div class="flex items-center justify-between gap-2">
							<span class="flex items-center gap-1.5"
								><TelegramIcon class="h-3.5 w-3.5 text-sky-500" />Telegram</span
							>
							<span class="text-muted-foreground"
								>{data.telegram
									? '@' + (data.telegram.username ?? data.telegram.accountId)
									: 'не привязан'}</span
							>
						</div>
						<div class="flex items-center justify-between gap-2">
							<span class="flex items-center gap-1.5"
								><DiscordIcon class="h-3.5 w-3.5 text-violet-500" />Discord</span
							>
							<span class="text-muted-foreground"
								>{data.discord
									? (data.discord.username ?? data.discord.accountId)
									: 'не привязан'}</span
							>
						</div>
						<Button href={resolve('/profile')} variant="outline" size="sm" class="mt-1 w-full"
							>Профиль и привязка</Button
						>
					</CardContent>
				</Card>

				<Card class="border-border/60">
					<CardHeader class="pb-3"><CardTitle class="text-sm">Наши каналы</CardTitle></CardHeader>
					<CardContent class="space-y-2 text-xs">
						<a
							class="flex items-center justify-between gap-2 rounded-md px-1 py-1 hover:bg-muted"
							href="https://t.me/hedgehogincoverlord"
							target="_blank"
							rel="noreferrer"
							><span class="flex items-center gap-1.5"
								><TelegramIcon class="h-3.5 w-3.5 text-sky-500" />HEDGEHOG.INC</span
							><ArrowUpRight class="h-3 w-3 text-muted-foreground" /></a
						>
						<a
							class="flex items-center justify-between gap-2 rounded-md px-1 py-1 hover:bg-muted"
							href="https://t.me/Mushoku_Tensei_AudioBook"
							target="_blank"
							rel="noreferrer"
							><span class="flex items-center gap-1.5"
								><TelegramIcon class="h-3.5 w-3.5 text-sky-500" />Mushoku Tensei</span
							><ArrowUpRight class="h-3 w-3 text-muted-foreground" /></a
						>
						<button
							type="button"
							class="flex w-full items-center justify-between gap-2 rounded-md px-1 py-1 hover:bg-muted"
							onclick={() =>
								window.open(data.config.boostyBlogUrl, '_blank', 'noopener,noreferrer')}
							><span class="flex items-center gap-1.5"
								><Gift class="h-3.5 w-3.5 text-orange-500" />Boosty</span
							><ArrowUpRight class="h-3 w-3 text-muted-foreground" /></button
						>
					</CardContent>
				</Card>

				<Card class="border-border/60 bg-gradient-to-br from-emerald-500/5 to-background">
					<CardContent class="space-y-2 p-4 text-xs">
						<p class="flex items-center gap-1.5 font-semibold">
							<MessageCircle class="h-4 w-4 text-emerald-500" />Нужна помощь?
						</p>
						<p class="text-muted-foreground">
							Если подписка не появилась после оплаты или вступления — напишите нам, проверим.
						</p>
						<Button
							href="https://t.me/hedgehogincoverlord"
							target="_blank"
							rel="noreferrer"
							size="sm"
							class="w-full gap-1">Написать в Telegram<ArrowUpRight class="h-3.5 w-3.5" /></Button
						>
					</CardContent>
				</Card>

				<p class="text-[10px] leading-relaxed text-muted-foreground">
					Подписка привязана к аккаунту, а не к способу входа. Telegram и Discord можно привязать в
					профиле.
				</p>
			</aside>
		</div>

		<BaseModal
			bind:open={donationsOpen}
			title="Все донаты"
			description="Полная история донатов с фильтрами и сортировкой."
			widthClass="sm:max-w-2xl"
		>
			<div class="space-y-4">
				<ListFilterBar
					bind:search={donationQuery}
					bind:period={donationPeriod}
					bind:source={donationSource}
					bind:sort={donationSort}
					searchPlaceholder="Примечание или сумма"
					sourceOptions={donationSourceOptions}
					sortOptions={donationSortOptions}
					resultCount={filteredDonations.length}
					totalCount={donationEvents.length}
				/>
				<div class="max-h-[55vh] space-y-1 overflow-y-auto">
					{#each filteredDonations as event (event.id)}
						<div
							class="flex items-start justify-between gap-3 border-b border-border/40 py-2 text-xs last:border-0"
						>
							<div class="min-w-0">
								<p class="font-medium">{event.amountRub?.toLocaleString('ru-RU')} ₽</p>
								<p class="truncate text-[10px] text-muted-foreground">{event.note || 'Донат'}</p>
							</div>
							<time
								class="shrink-0 text-[10px] text-muted-foreground"
								datetime={String(event.createdAt)}>{formatDateTime(event.createdAt)}</time
							>
						</div>
					{:else}
						<p class="p-6 text-center text-sm text-muted-foreground">Ничего не найдено</p>
					{/each}
				</div>
			</div>
			{#snippet footer()}
				<Button variant="outline" onclick={() => (donationsOpen = false)}>Закрыть</Button>
			{/snippet}
		</BaseModal>

		<BaseModal
			bind:open={historyOpen}
			title="Вся история"
			description="Все события подписки с фильтрами и сортировкой."
			widthClass="sm:max-w-2xl"
		>
			<div class="space-y-4">
				<ListFilterBar
					bind:search={historyQuery}
					bind:period={historyPeriod}
					bind:source={historySource}
					bind:sort={historySort}
					searchPlaceholder="Событие или источник"
					sourceOptions={historySourceOptions}
					sortOptions={historySortOptions}
					resultCount={filteredHistory.length}
					totalCount={data.events.length}
				/>
				<div class="max-h-[55vh] space-y-1 overflow-y-auto">
					{#each filteredHistory as event (event.id)}
						<div
							class="flex items-start justify-between gap-3 border-b border-border/40 py-2 text-xs last:border-0"
						>
							<div class="min-w-0">
								<p class="font-medium">{eventLabel(event)}</p>
								<p class="truncate text-[10px] text-muted-foreground">
									{event.note || (event.source === 'manual' ? 'Администратором' : event.source)}
								</p>
							</div>
							<time
								class="shrink-0 text-[10px] text-muted-foreground"
								datetime={String(event.createdAt)}>{formatDateTime(event.createdAt)}</time
							>
						</div>
					{:else}
						<p class="p-6 text-center text-sm text-muted-foreground">Ничего не найдено</p>
					{/each}
				</div>
			</div>
			{#snippet footer()}
				<Button variant="outline" onclick={() => (historyOpen = false)}>Закрыть</Button>
			{/snippet}
		</BaseModal>
	{/if}
</div>
