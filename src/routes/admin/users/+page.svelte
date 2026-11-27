<!-- eslint-disable svelte/no-navigation-without-resolve -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import BaseModal from '$lib/components/overlay/BaseModal.svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import DiscordIcon from '$lib/components/icons/DiscordIcon.svelte';
	import TelegramIcon from '$lib/components/icons/TelegramIcon.svelte';
	import {
		Ban,
		Code,
		Crown,
		ExternalLink,
		Gift,
		History,
		Infinity as InfinityIcon,
		Languages,
		MoreHorizontal,
		RefreshCw,
		Search,
		Settings2,
		Users,
		Wallet
	} from '@lucide/svelte';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import { computeManualExpiry, daysFromAmount, pluralDays } from '$lib/subscriptions/domain';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	type UserRow = (typeof data.users)[number];
	type SubscriptionFilter = 'all' | 'active' | 'expiring' | 'lifetime' | 'none' | 'blocked';

	let grantOpen = $state(false);
	let grantUser = $state<UserRow | null>(null);
	let grantMode = $state<'days' | 'amount' | 'lifetime'>('days');
	let grantDays = $state(30);
	let grantAmount = $state(1000);
	let grantNote = $state('');
	let grantIdempotencyKey = $state('');
	let grantSubmitting = $state(false);
	// eslint-disable-next-line svelte/prefer-writable-derived -- modal needs a writable binding
	let detailsOpen = $state(false);
	let subscriptionFilter = $state<SubscriptionFilter>('all');
	let roleDrafts = $state<Record<string, string>>({});
	let roleModalOpen = $state(false);
	let roleTarget = $state<UserRow | null>(null);
	let roleValue = $state<'admin' | 'user'>('user');
	let authorTarget = $state<UserRow | null>(null);
	let authorModalOpen = $state(false);
	let authorSubmitting = $state(false);
	let roleSubmitting = $state(false);
	let priceOpen = $state(false);
	let priceValue = $state(0);
	let priceScope = $state<'all' | 'new'>('new');
	let priceSubmitting = $state(false);

	$effect(() => {
		detailsOpen = Boolean(data.selectedUser);
	});

	const roleLabels: Record<string, string> = {
		all: 'Все роли',
		user: 'Пользователи',
		admin: 'Администраторы',
		author: 'Автор'
	};

	const providerLabels: Record<string, string> = {
		'telegram-oidc': 'Telegram',
		discord: 'Discord'
	};

	const sortLabels: Record<string, string> = {
		newest: 'Сначала новые',
		oldest: 'Сначала старые',
		name: 'По имени',
		role: 'По роли'
	};

	const providerOptions = $derived([
		{ value: 'all', label: 'Все источники' },
		...data.providers.map((provider) => ({
			value: provider,
			label: providerLabels[provider] ?? provider
		}))
	]);
	const useProviderTabs = $derived(providerOptions.length < 3);

	const filteredUsers = $derived(
		data.users.filter((item) => {
			const summary = item.subscription;
			switch (subscriptionFilter) {
				case 'active':
					return Boolean(summary?.active);
				case 'expiring':
					return Boolean(
						summary &&
						!summary.blocked &&
						summary.daysLeft != null &&
						summary.daysLeft > 0 &&
						summary.daysLeft <= 7
					);
				case 'lifetime':
					return Boolean(summary?.isLifetime);
				case 'none':
					return !summary?.active;
				case 'blocked':
					return Boolean(summary?.blocked);
				default:
					return true;
			}
		})
	);

	const filterTabs = $derived<Array<{ value: SubscriptionFilter; label: string; count: number }>>([
		{ value: 'all', label: 'Все', count: data.users.length },
		{ value: 'active', label: 'Активные', count: data.subscriptionCounts.active },
		{ value: 'expiring', label: 'Истекают', count: data.subscriptionCounts.expiring },
		{ value: 'lifetime', label: 'Вечные', count: data.subscriptionCounts.lifetime },
		{
			value: 'none',
			label: 'Без подписки',
			count: data.users.length - data.subscriptionCounts.active
		},
		{ value: 'blocked', label: 'Заблокированы', count: data.subscriptionCounts.blocked }
	]);

	const price = $derived(data.subscriptionPrice || 7);
	const grantDaysValue = $derived(
		grantMode === 'amount' ? daysFromAmount(grantAmount, price) : Math.max(0, Math.floor(grantDays))
	);
	const grantCurrentDate = $derived(
		grantUser?.subscription?.expiresAt ? new Date(grantUser.subscription.expiresAt) : null
	);
	const grantNewDate = $derived(
		grantMode === 'lifetime'
			? null
			: computeManualExpiry(grantCurrentDate, grantDaysValue, new Date())
	);
	const grantBlocked = $derived(Boolean(grantUser?.subscription?.blocked));

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

	function formatMoney(value: number): string {
		return Number(value || 0).toLocaleString('ru-RU');
	}

	function formatDateTime(value: Date | string | null | undefined): string {
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

	function submitFilters(event: Event) {
		const target = event.currentTarget as HTMLInputElement | HTMLSelectElement;
		target.form?.requestSubmit();
	}

	function handleFiltersSubmit(event: SubmitEvent) {
		event.preventDefault();
		const formEl = event.currentTarget as HTMLFormElement;
		const parts: string[] = [];
		for (const [key, value] of new FormData(formEl).entries()) {
			if (typeof value === 'string' && value) {
				parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
			}
		}
		const query = parts.join('&');
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolved base + query string
		void goto(resolve('/admin/users') + (query ? '?' + query : ''), {
			noScroll: true,
			keepFocus: true
		});
	}

	function avatarFor(item: UserRow): string | null {
		return item.image || item.telegramAvatar || item.discordAvatar || null;
	}

	function identityFor(item: { identityId: string }): string {
		return item.identityId;
	}

	function openGrant(item: UserRow) {
		if (detailsOpen) closeDetails();
		grantUser = item;
		grantMode = 'days';
		grantDays = 30;
		grantAmount = 1000;
		grantNote = '';
		grantIdempotencyKey = crypto.randomUUID();
		grantOpen = true;
	}

	function openGrantForSelected() {
		if (data.selectedUser) openGrant(data.selectedUser);
	}

	function openDetails(userId: string) {
		const params = new SvelteURLSearchParams(window.location.search);
		params.set('user', userId);
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- query string is appended to a resolved route
		void goto(`${resolve('/admin/users')}?${params.toString()}`, {
			noScroll: true,
			keepFocus: true
		});
	}

	function closeDetails() {
		detailsOpen = false;
		const params = new SvelteURLSearchParams(window.location.search);
		params.delete('user');
		const query = params.toString();
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- query string is appended to a resolved route
		void goto(query ? `${resolve('/admin/users')}?${query}` : resolve('/admin/users'), {
			noScroll: true,
			keepFocus: true
		});
	}

	async function setProfile(item: UserRow, type: 'developer' | 'translator', remove: boolean) {
		const body = new FormData();
		body.set('userId', item.id);
		body.set('remove', String(remove));
		const response = await fetch(type === 'developer' ? '?/markDeveloper' : '?/markTranslator', {
			method: 'POST',
			body
		});
		if (response.ok) await invalidateAll();
	}

	function openAuthorConfirm(item: UserRow) {
		authorTarget = item;
		authorModalOpen = true;
	}

	function requestRoleChange(item: UserRow, role: 'admin' | 'user') {
		if (role === item.role) {
			delete roleDrafts[item.id];
			return;
		}
		roleDrafts[item.id] = role;
		roleTarget = item;
		roleValue = role;
		roleModalOpen = true;
	}

	function cancelRoleChange() {
		if (roleTarget) delete roleDrafts[roleTarget.id];
		roleTarget = null;
		roleModalOpen = false;
	}

	function openPriceModal() {
		priceValue = data.subscriptionPrice || 7;
		priceScope = 'new';
		priceOpen = true;
	}

	function statusLabel(item: UserRow): string {
		const summary = item.subscription;
		if (!summary) return 'Нет подписки';
		if (summary.blocked) return 'Заблокирована';
		if (summary.revoked) return 'Отозвана';
		if (summary.isLifetime) return 'Вечная';
		if (summary.active) {
			if (summary.daysLeft != null && summary.daysLeft > 0 && summary.daysLeft <= 7)
				return 'Истекает';
			return 'Активна';
		}
		return 'Нет подписки';
	}

	function statusClass(item: UserRow): string {
		const summary = item.subscription;
		if (summary?.blocked) return 'border-destructive/30 bg-destructive/10 text-destructive';
		if (summary?.revoked)
			return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
		if (summary?.isLifetime)
			return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
		if (summary?.active && summary.daysLeft != null && summary.daysLeft <= 7)
			return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
		if (summary?.active)
			return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
		return 'border-border bg-muted text-muted-foreground';
	}

	function currentSubscriptionLabel(item: UserRow): string {
		const summary = item.subscription;
		if (!summary) return 'Нет данных';
		if (summary.blocked) return 'Заблокирована';
		if (summary.revoked)
			return summary.revokedDaysLeft != null
				? 'Отозвана · осталось ' +
						summary.revokedDaysLeft +
						' ' +
						pluralDays(summary.revokedDaysLeft)
				: 'Отозвана';
		if (summary.isLifetime) return 'Вечная';
		const sources = [
			summary.telegramActive ? 'Telegram' : null,
			summary.discordActive ? 'Discord' : null
		].filter((source): source is string => Boolean(source));
		if (summary.expiresAt) {
			return (
				'до ' + formatDate(summary.expiresAt) + (sources.length ? ' + ' + sources.join(' + ') : '')
			);
		}
		if (sources.length) return 'Активна через ' + sources.join(' + ');
		return 'Нет активной подписки';
	}

	function expiryLabel(item: UserRow): string {
		const summary = item.subscription;
		if (!summary) return 'Подписка не выдана';
		if (summary.blocked) return 'Доступ закрыт администратором';
		if (summary.revoked)
			return summary.revokedDaysLeft != null
				? 'Отозвана · осталось ' +
						summary.revokedDaysLeft +
						' ' +
						pluralDays(summary.revokedDaysLeft)
				: 'Отозвана';
		if (summary.isLifetime) return 'Бессрочно';
		if (summary.expiresAt) {
			const days = summary.daysLeft;
			return days != null
				? 'до ' + formatDate(summary.expiresAt) + ' · ' + days + ' ' + pluralDays(days)
				: 'до ' + formatDate(summary.expiresAt);
		}
		if (summary.boostyActive) return 'Пока активна подписка Boosty';
		return 'Подписка не выдана';
	}

	function eventLabel(event: (typeof data.selectedEvents)[number]): string {
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
				return 'Подписка приостановлена';
			case 'restore':
				return 'Подписка восстановлена';
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

	function eventMeta(event: (typeof data.selectedEvents)[number]): string {
		if (event.amountRub) {
			const parts = [formatMoney(event.amountRub) + ' ₽'];
			if (event.pricePerDay != null) parts.push(event.pricePerDay + ' ₽/день');
			if (event.days != null) parts.push(event.days + ' ' + pluralDays(event.days));
			return parts.join(' · ');
		}
		if (event.note) return event.note;
		if (event.source === 'manual') return 'вручную';
		return event.source;
	}
</script>

<div class="space-y-6">
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

	<header class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
		<div>
			<h1 class="text-2xl font-bold tracking-tight">Пользователи</h1>
			<p class="mt-1 text-sm text-muted-foreground">
				Поиск, роли, вход и подписки. Найдено {data.users.length} из {data.totalUsers}.
			</p>
		</div>
		<div class="flex flex-wrap gap-2 self-start">
			<Button variant="outline" size="sm" class="gap-1" onclick={openPriceModal}>
				<Wallet class="h-3.5 w-3.5" />
				Цена дня: {data.subscriptionPrice} ₽
			</Button>
			<Button href={resolve('/admin/users/integrations')} variant="outline" size="sm" class="gap-1">
				<Settings2 class="h-3.5 w-3.5" />
				Настроить источники
			</Button>
			<Button
				variant="default"
				size="sm"
				class="gap-1"
				onclick={() => document.getElementById('user-search')?.focus()}
			>
				<Search class="h-3.5 w-3.5" />
				Найти и выдать
			</Button>
			<Badge variant="outline" class="gap-1 self-center font-mono text-[11px]">
				<Users class="h-3 w-3" />
				{data.users.length} / {data.totalUsers}
			</Badge>
		</div>
	</header>

	<Card
		class="border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-background to-amber-500/5"
	>
		<CardContent class="py-3">
			<div class="flex w-full flex-wrap items-center justify-between gap-3">
				<div class="flex flex-wrap items-center gap-x-5 gap-y-2">
					<div class="flex items-center gap-2 text-sm font-semibold">
						<Gift class="h-4 w-4 text-emerald-500" />
						Подписки
					</div>
					<span class="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
						<span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
						<strong class="text-foreground">{data.subscriptionCounts.active}</strong> активных
					</span>
					<span class="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
						<span class="h-1.5 w-1.5 rounded-full bg-orange-500"></span>
						<strong class="text-foreground">{data.subscriptionCounts.boosty}</strong> через Boosty
					</span>
					<span class="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
						<span class="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
						<strong class="text-foreground">{data.subscriptionCounts.expiring}</strong> истекают
					</span>
					<span class="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
						<span class="h-1.5 w-1.5 rounded-full bg-yellow-500"></span>
						<strong class="text-foreground">{data.subscriptionCounts.lifetime}</strong> вечных
					</span>
				</div>
				<div class="flex flex-wrap items-center gap-2 text-xs">
					<span class="text-muted-foreground">Источники:</span>
					<span
						class={data.subscriptionConfig.telegramConfigured
							? 'text-emerald-600 dark:text-emerald-400'
							: 'text-muted-foreground'}
					>
						Telegram
					</span>
					<span
						class={data.subscriptionConfig.discordConfigured
							? 'text-emerald-600 dark:text-emerald-400'
							: 'text-muted-foreground'}
					>
						Discord
					</span>
					<Button
						href={resolve('/admin/users/integrations')}
						variant="link"
						size="sm"
						class="h-auto px-1 text-xs"
					>
						Настроить
					</Button>
				</div>
			</div>
		</CardContent>
	</Card>

	<Card class="border-border/60">
		<CardHeader class="pb-3">
			<CardTitle class="flex items-center gap-2 text-base">
				<Search class="h-4 w-4 text-primary" />
				Поиск и фильтры
			</CardTitle>
		</CardHeader>
		<CardContent class="space-y-3">
			<form
				method="GET"
				onsubmit={handleFiltersSubmit}
				class="grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_150px_170px_180px_auto_auto]"
			>
				<div class="relative">
					<Search
						class="pointer-events-none absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground"
					/>
					<Input
						id="user-search"
						name="q"
						value={data.filters.q}
						placeholder="Имя, @username или Telegram ID"
						aria-label="Поиск пользователей"
						class="pl-8 text-sm"
					/>
				</div>

				<select
					name="role"
					value={data.filters.role}
					aria-label="Фильтр по роли"
					class="flex h-9 w-full rounded-md border border-input bg-background px-2 text-xs shadow-xs"
					onchange={submitFilters}
				>
					{#each Object.entries(roleLabels) as [value, label] (value)}
						<option {value}>{label}</option>
					{/each}
				</select>

				{#if useProviderTabs}
					<div
						class="flex items-center gap-1 rounded-md border border-input bg-muted/40 p-0.5"
						role="radiogroup"
						aria-label="Источник входа"
					>
						{#each providerOptions as option (option.value)}
							<label
								class="cursor-pointer rounded px-2 py-1 text-xs font-medium text-muted-foreground transition has-[:checked]:bg-background has-[:checked]:text-foreground has-[:checked]:shadow-xs"
							>
								<input
									type="radio"
									name="provider"
									value={option.value}
									checked={data.filters.provider === option.value}
									class="sr-only"
									onchange={submitFilters}
								/>
								{option.label}
							</label>
						{/each}
					</div>
				{:else}
					<select
						name="provider"
						value={data.filters.provider}
						aria-label="Фильтр по источнику входа"
						class="flex h-9 w-full rounded-md border border-input bg-background px-2 text-xs shadow-xs"
						onchange={submitFilters}
					>
						{#each providerOptions as option (option.value)}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				{/if}

				<select
					name="sort"
					value={data.filters.sort}
					aria-label="Сортировка"
					class="flex h-9 w-full rounded-md border border-input bg-background px-2 text-xs shadow-xs"
					onchange={submitFilters}
				>
					{#each Object.entries(sortLabels) as [value, label] (value)}
						<option {value}>{label}</option>
					{/each}
				</select>

				<Button type="submit" size="sm">Найти</Button>
				<Button href={resolve('/admin/users')} variant="ghost" size="sm">Сбросить</Button>
			</form>

			<div class="flex flex-wrap items-center gap-1.5 border-t border-border/50 pt-2">
				<span class="mr-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase"
					>Подписка:</span
				>
				{#each filterTabs as tab (tab.value)}
					<button
						type="button"
						class="rounded-md px-2 py-1 text-xs font-medium transition {subscriptionFilter ===
						tab.value
							? 'bg-foreground text-background'
							: 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
						onclick={() => (subscriptionFilter = tab.value)}
					>
						{tab.label}
						<span class="ml-1 opacity-70">{tab.count}</span>
					</button>
				{/each}
			</div>
		</CardContent>
	</Card>

	<Card class="border-border/60">
		<CardHeader class="pb-3">
			<CardTitle class="text-base">Пользователи ({filteredUsers.length})</CardTitle>
		</CardHeader>
		<CardContent class="space-y-2">
			{#if filteredUsers.length === 0}
				<div class="py-10 text-center text-sm text-muted-foreground">
					По выбранным фильтрам пользователи не найдены.
				</div>
			{:else}
				{#each filteredUsers as item (item.id)}
					<div class="space-y-3 rounded-lg border border-border/70 p-3">
						<div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
							<div class="flex min-w-0 items-start gap-3">
								{#if avatarFor(item)}
									<img
										src={avatarFor(item) ?? ''}
										alt={item.name}
										loading="lazy"
										decoding="async"
										class="h-10 w-10 shrink-0 rounded-full border border-border/50 object-cover"
									/>
								{:else}
									<div
										class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold uppercase"
									>
										{item.name?.charAt(0) ?? '?'}
									</div>
								{/if}
								<div class="min-w-0">
									<p class="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
										{item.name}
										{#if item.id === data.currentUserId}<span
												class="text-xs font-normal text-muted-foreground">(вы)</span
											>{/if}
										{#if item.role === 'admin'}
											<span
												class="rounded-full border border-violet-500/20 bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 dark:text-violet-300"
												>Админ</span
											>
										{/if}
										<span
											class="rounded-full border px-1.5 py-0.5 text-[10px] font-semibold {statusClass(
												item
											)}">{statusLabel(item)}</span
										>
									</p>
									<p class="truncate text-xs text-muted-foreground">
										{identityFor(item)}
										{#if item.providers.length}
											· вход: {item.providers
												.map((provider) => providerLabels[provider] ?? provider)
												.join(', ')}
										{/if}
									</p>
									{#if item.role !== 'author'}
										<p
											class="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground"
										>
											<Wallet class="h-3 w-3" />
											{#if item.donations.totalRub > 0}
												Доход: <strong class="text-foreground"
													>{formatMoney(item.donations.totalRub)} ₽</strong
												>
												{#if item.donations.lastDonationAt}· последний {formatDateTime(
														item.donations.lastDonationAt
													)}{/if}
											{:else}
												Донатов нет
											{/if}
										</p>
									{/if}
								</div>
							</div>

							{#if item.role === 'author'}
								<div class="flex flex-wrap items-center gap-2">
									<Badge variant="secondary">Автор</Badge>
									<form method="POST" action="?/authorStats" use:enhance>
										<input type="hidden" name="userId" value={item.id} />
										<Button type="submit" variant="outline" size="sm">
											{item.includeInStats ? 'Исключить из статистики' : 'Включить в статистику'}
										</Button>
									</form>
								</div>
							{/if}
						</div>

						{#if item.role !== 'author'}
							<div
								class="flex flex-col gap-2 border-t border-border/50 pt-2 sm:flex-row sm:items-center sm:justify-between"
							>
								<div class="flex flex-wrap items-center gap-1.5">
									{#if item.subscription?.telegramActive}
										<span
											class="inline-flex items-center gap-1 rounded border border-sky-500/25 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 dark:text-sky-300"
											><TelegramIcon class="h-3 w-3" />Boosty · Telegram</span
										>
									{/if}
									{#if item.subscription?.discordActive}
										<span
											class="inline-flex items-center gap-1 rounded border border-violet-500/25 bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 dark:text-violet-300"
											><DiscordIcon class="h-3 w-3" />Boosty · Discord</span
										>
									{/if}
									{#if item.subscription?.isLifetime}
										<span
											class="inline-flex items-center gap-1 rounded border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300"
											><InfinityIcon class="h-3 w-3" />Вечная</span
										>
									{:else if item.subscription?.expiresAt}
										<span
											class="inline-flex items-center gap-1 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground"
											><Gift class="h-3 w-3" />Вручную</span
										>
									{/if}
									{#if !item.subscription?.telegramActive && !item.subscription?.discordActive && !item.subscription?.active}
										<span class="text-[11px] text-muted-foreground">Нет источников</span>
									{/if}
									<span class="text-[11px] text-muted-foreground">{expiryLabel(item)}</span>
								</div>
								<div class="flex flex-wrap gap-1.5">
									<Button
										type="button"
										size="sm"
										variant={item.subscription?.active ? 'outline' : 'default'}
										class="gap-1"
										onclick={() => openGrant(item)}
									>
										<Gift class="h-3.5 w-3.5" />
										{item.subscription?.active ? 'Продлить' : 'Выдать'}
									</Button>
									<Button
										type="button"
										variant="outline"
										size="sm"
										class="gap-1"
										onclick={() => openDetails(item.id)}
									>
										<ExternalLink class="h-3.5 w-3.5" />
										Открыть
									</Button>
									<DropdownMenu.Root>
										<DropdownMenu.Trigger
											class="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
											aria-label="Дополнительные действия"
										>
											<MoreHorizontal class="h-4 w-4" />
										</DropdownMenu.Trigger>
										<DropdownMenu.Content align="end" class="w-56">
											<DropdownMenu.Item
												onSelect={() =>
													requestRoleChange(item, item.role === 'admin' ? 'user' : 'admin')}
											>
												<Users class="h-4 w-4" />
												{item.role === 'admin' ? 'Сделать пользователем' : 'Сделать админом'}
											</DropdownMenu.Item>
											{#if data.currentUserRole === 'admin'}
												<DropdownMenu.Item onSelect={() => openAuthorConfirm(item)}>
													<Crown class="h-4 w-4" />
													Сделать автором
												</DropdownMenu.Item>
											{/if}
											<DropdownMenu.Separator />
											<DropdownMenu.Item
												onSelect={() => setProfile(item, 'developer', Boolean(item.developerLink))}
											>
												<Code class="h-4 w-4" />
												{item.developerLink ? 'Убрать разработчика' : 'Указать разработчиком'}
											</DropdownMenu.Item>
											<DropdownMenu.Item
												onSelect={() =>
													setProfile(item, 'translator', Boolean(item.translatorLink))}
											>
												<Languages class="h-4 w-4" />
												{item.translatorLink ? 'Убрать переводчика' : 'Указать переводчиком'}
											</DropdownMenu.Item>
										</DropdownMenu.Content>
									</DropdownMenu.Root>
								</div>
							</div>
						{/if}
					</div>
				{/each}
			{/if}
		</CardContent>
	</Card>
</div>

<BaseModal
	bind:open={grantOpen}
	title="Выдать подписку"
	description="Цена дня: {price} ₽. Продление считается от текущей даты окончания."
	widthClass="sm:max-w-xl"
	onClose={() => (grantOpen = false)}
>
	{#if grantUser}
		<form
			method="POST"
			action="?/grant"
			use:enhance={() => {
				grantSubmitting = true;
				return async ({ result, update }) => {
					await update();
					grantSubmitting = false;
					if (result.type === 'success') grantOpen = false;
				};
			}}
			class="space-y-4"
		>
			<input type="hidden" name="userId" value={grantUser.id} />
			<input type="hidden" name="mode" value={grantMode} />
			<input type="hidden" name="idempotencyKey" value={grantIdempotencyKey} />
			<div class="flex items-center gap-3 rounded-lg border bg-muted/40 p-2.5">
				{#if avatarFor(grantUser)}
					<img
						src={avatarFor(grantUser) ?? ''}
						alt={grantUser.name}
						class="h-9 w-9 rounded-full object-cover"
					/>
				{:else}
					<div
						class="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-xs font-semibold"
					>
						{grantUser.name.charAt(0)}
					</div>
				{/if}
				<div class="min-w-0 flex-1">
					<p class="truncate text-sm font-semibold">{grantUser.name}</p>
					<p class="truncate text-xs text-muted-foreground">{identityFor(grantUser)}</p>
				</div>
				<div class="text-right text-xs">
					<p class="text-muted-foreground">Сейчас</p>
					<p class="font-medium">{statusLabel(grantUser)}</p>
				</div>
			</div>

			{#if grantBlocked}
				<div
					class="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-200"
				>
					<Ban class="mt-0.5 h-4 w-4 shrink-0" />
					Пользователь заблокирован. Подписка будет записана, но доступ останется закрытым до разблокировки.
				</div>
			{/if}

			<div class="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
				<button
					type="button"
					class="rounded-md px-3 py-1.5 text-xs font-medium {grantMode === 'days'
						? 'bg-background text-foreground shadow-xs'
						: 'text-muted-foreground'}"
					onclick={() => (grantMode = 'days')}>Дни</button
				>
				<button
					type="button"
					class="rounded-md px-3 py-1.5 text-xs font-medium {grantMode === 'amount'
						? 'bg-background text-foreground shadow-xs'
						: 'text-muted-foreground'}"
					onclick={() => (grantMode = 'amount')}>Сумма</button
				>
				<button
					type="button"
					class="rounded-md px-3 py-1.5 text-xs font-medium {grantMode === 'lifetime'
						? 'bg-background text-foreground shadow-xs'
						: 'text-muted-foreground'}"
					onclick={() => (grantMode = 'lifetime')}>Навсегда</button
				>
			</div>

			{#if grantMode === 'days'}
				<label class="block space-y-1.5 text-xs font-medium">
					Количество дней
					<Input name="days" type="number" min="1" max="36500" bind:value={grantDays} />
					<span class="block text-[11px] font-normal text-muted-foreground"
						>Например, 30 дней = {30 * price} ₽. Раннее продление не сгорает.</span
					>
				</label>
			{:else if grantMode === 'amount'}
				<label class="block space-y-1.5 text-xs font-medium">
					Сумма доната, ₽
					<Input
						name="amountRub"
						type="number"
						min={price}
						max="1000000"
						bind:value={grantAmount}
					/>
					<span class="block text-[11px] font-normal text-muted-foreground">
						{grantDaysValue}
						{pluralDays(grantDaysValue)} · остаток {Math.max(
							0,
							grantAmount - grantDaysValue * price
						)} ₽ не даёт дней
					</span>
				</label>
			{:else}
				<div
					class="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-200"
				>
					<InfinityIcon class="mt-0.5 h-4 w-4 shrink-0" />
					Подписка без срока. Отозвать или восстановить можно в карточке пользователя.
				</div>
			{/if}

			<div
				class="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs"
			>
				<div>
					<p class="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
						Сейчас
					</p>
					<p class="mt-0.5 font-semibold">{currentSubscriptionLabel(grantUser)}</p>
				</div>
				<span class="text-emerald-600">→</span>
				<div>
					<p class="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
						Станет
					</p>
					<p class="mt-0.5 font-semibold">
						{grantMode === 'lifetime'
							? 'Бессрочно'
							: grantNewDate
								? formatDate(grantNewDate) +
									' · ' +
									grantDaysValue +
									' ' +
									pluralDays(grantDaysValue)
								: 'Укажите количество'}
					</p>
				</div>
			</div>

			<label class="block space-y-1.5 text-xs font-medium">
				Комментарий <span class="font-normal text-muted-foreground">(необязательно)</span>
				<textarea
					name="note"
					bind:value={grantNote}
					class="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
					placeholder="Например: донат 1000 ₽, Сбер, 23.11.2026"></textarea>
				<span class="block text-[11px] font-normal text-muted-foreground"
					>Виден только администраторам. Попадёт в аудит.</span
				>
			</label>

			{#if form?.error}
				<div
					class="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive"
					role="alert"
				>
					{form.error}
				</div>
			{/if}

			<div class="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
				<p class="max-w-[280px] text-[11px] text-muted-foreground">
					Действие попадёт в аудит. Отменить можно через отзыв или изменение даты.
				</p>
				<div class="flex gap-2">
					<Button type="button" variant="outline" onclick={() => (grantOpen = false)}>Отмена</Button
					>
					<Button
						type="submit"
						disabled={grantSubmitting || (grantMode !== 'lifetime' && grantDaysValue < 1)}
					>
						{grantMode === 'lifetime'
							? 'Выдать навсегда'
							: grantMode === 'amount'
								? 'Начислить ' + grantDaysValue + ' ' + pluralDays(grantDaysValue)
								: 'Выдать ' + grantDaysValue + ' ' + pluralDays(grantDaysValue)}
					</Button>
				</div>
			</div>
		</form>
	{/if}
</BaseModal>

<BaseModal
	bind:open={detailsOpen}
	title="Карточка пользователя"
	description="Подписка, роль и история"
	widthClass="sm:max-w-xl"
	onClose={closeDetails}
>
	{#if data.selectedUser}
		{@const selected = data.selectedUser}
		<div class="space-y-4">
			<div class="flex items-center gap-3">
				{#if avatarFor(selected)}
					<img
						src={avatarFor(selected) ?? ''}
						alt={selected.name}
						class="h-12 w-12 rounded-full object-cover"
					/>
				{:else}
					<div
						class="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-lg font-semibold"
					>
						{selected.name.charAt(0)}
					</div>
				{/if}
				<div class="min-w-0 flex-1">
					<p class="flex flex-wrap items-center gap-2 text-base font-semibold">
						{selected.name}
						<span
							class="rounded-full border px-2 py-0.5 text-[10px] font-semibold {statusClass(
								selected
							)}">{statusLabel(selected)}</span
						>
					</p>
					<p class="truncate text-xs text-muted-foreground">{identityFor(selected)}</p>
					<p class="truncate font-mono text-[10px] text-muted-foreground">{selected.id}</p>
				</div>
			</div>

			<div class="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
				<div class="flex items-center justify-between gap-2">
					<div>
						<p class="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
							Подписка
						</p>
						<p class="mt-0.5 text-sm font-semibold">{expiryLabel(selected)}</p>
					</div>
					<Crown class="h-5 w-5 text-emerald-500" />
				</div>
				<div class="mt-2 flex flex-wrap gap-1.5">
					{#if selected.subscription?.telegramActive}<Badge
							variant="outline"
							class="gap-1 text-[10px]"><TelegramIcon class="h-3 w-3" />Telegram</Badge
						>{/if}
					{#if selected.subscription?.discordActive}<Badge
							variant="outline"
							class="gap-1 text-[10px]"><DiscordIcon class="h-3 w-3" />Discord</Badge
						>{/if}
					{#if selected.subscription?.isLifetime}<Badge variant="outline" class="gap-1 text-[10px]"
							><InfinityIcon class="h-3 w-3" />Вечная</Badge
						>{/if}
					{#if selected.subscription?.expiresAt}<Badge variant="outline" class="gap-1 text-[10px]"
							><Gift class="h-3 w-3" />Вручную</Badge
						>{/if}
				</div>
				<div class="mt-3 flex flex-wrap gap-2">
					<Button size="sm" onclick={openGrantForSelected} class="gap-1"
						><Gift class="h-3.5 w-3.5" />Выдать</Button
					>
					<form method="POST" action="?/check" use:enhance>
						<input type="hidden" name="userId" value={selected.id} />
						<Button type="submit" size="sm" variant="outline" class="gap-1"
							><RefreshCw class="h-3.5 w-3.5" />Проверить источники</Button
						>
					</form>
					{#if selected.subscription?.revoked}
						<form method="POST" action="?/restore" use:enhance>
							<input type="hidden" name="userId" value={selected.id} />
							<Button type="submit" size="sm" variant="default">Восстановить</Button>
						</form>
					{:else}
						<form method="POST" action="?/revoke" use:enhance>
							<input type="hidden" name="userId" value={selected.id} />
							<Button type="submit" size="sm" variant="ghost">Отозвать</Button>
						</form>
					{/if}
					{#if selected.subscription?.blocked}
						<form method="POST" action="?/block" use:enhance>
							<input type="hidden" name="userId" value={selected.id} />
							<input type="hidden" name="blocked" value="0" />
							<Button type="submit" size="sm" variant="outline">Разблокировать</Button>
						</form>
					{:else}
						<form method="POST" action="?/block" use:enhance>
							<input type="hidden" name="userId" value={selected.id} />
							<input type="hidden" name="blocked" value="1" />
							<Button type="submit" size="sm" variant="destructive">Заблокировать</Button>
						</form>
					{/if}
				</div>
			</div>

			<div class="grid grid-cols-3 gap-2 rounded-lg border border-border/60 p-3 text-xs">
				<div>
					<p class="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
						Доход
					</p>
					<p class="mt-0.5 text-sm font-semibold">{formatMoney(selected.donations.totalRub)} ₽</p>
				</div>
				<div>
					<p class="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
						Донатов
					</p>
					<p class="mt-0.5 text-sm font-semibold">{selected.donations.donationsCount}</p>
				</div>
				<div>
					<p class="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
						Последний
					</p>
					<p class="mt-0.5 text-sm font-semibold">
						{selected.donations.lastDonationAt
							? formatDateTime(selected.donations.lastDonationAt)
							: '—'}
					</p>
				</div>
			</div>

			<div>
				<h3 class="mb-2 flex items-center gap-1.5 text-sm font-semibold">
					<History class="h-4 w-4" />История
				</h3>
				{#if data.selectedEvents.length === 0}
					<div
						class="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground"
					>
						Пока нет событий
					</div>
				{:else}
					<div class="max-h-64 space-y-1 overflow-y-auto rounded-lg border p-2">
						{#each data.selectedEvents as event (event.id)}
							<div
								class="flex items-start justify-between gap-3 rounded-md px-2 py-1.5 text-xs hover:bg-muted/50"
							>
								<div class="min-w-0">
									<p class="font-medium">{eventLabel(event)}</p>
									<p class="truncate text-[10px] text-muted-foreground">{eventMeta(event)}</p>
								</div>
								<time
									class="shrink-0 text-[10px] text-muted-foreground"
									datetime={String(event.createdAt)}>{formatDateTime(event.createdAt)}</time
								>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<div class="flex justify-end">
				<Button variant="outline" onclick={closeDetails}>Закрыть</Button>
			</div>
		</div>
	{/if}
</BaseModal>

<BaseModal
	bind:open={roleModalOpen}
	title="Изменить роль?"
	description="Подтвердите изменение прав доступа."
	widthClass="sm:max-w-md"
	onClose={cancelRoleChange}
>
	{#if roleTarget}
		<form
			method="POST"
			action="?/setRole"
			use:enhance={() => {
				roleSubmitting = true;
				return async ({ result, update }) => {
					await update();
					roleSubmitting = false;
					if (result.type === 'success') {
						if (roleTarget) delete roleDrafts[roleTarget.id];
						roleTarget = null;
						roleModalOpen = false;
					}
				};
			}}
			class="space-y-4"
		>
			<input type="hidden" name="id" value={roleTarget.id} />
			<input type="hidden" name="role" value={roleValue} />
			<div class="rounded-lg border bg-muted/40 p-3 text-sm">
				<p class="font-semibold">{roleTarget.name}</p>
				<p class="truncate text-xs text-muted-foreground">{identityFor(roleTarget)}</p>
				<p class="mt-2 flex flex-wrap items-center gap-2 text-xs">
					<span class="text-muted-foreground">Сейчас:</span>
					<strong>{roleTarget.role === 'admin' ? 'Администратор' : 'Пользователь'}</strong>
					<span class="text-muted-foreground">→</span>
					<strong
						class={roleValue === 'admin'
							? 'text-emerald-600 dark:text-emerald-400'
							: 'text-amber-600 dark:text-amber-400'}
					>
						{roleValue === 'admin' ? 'Администратор' : 'Пользователь'}
					</strong>
				</p>
			</div>
			<div
				class="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-200"
			>
				{#if roleValue === 'admin'}
					Пользователь получит доступ к админке, пользователям, подпискам и контенту.
				{:else}
					Пользователь потеряет доступ к админке и управлению подписками.
				{/if}
			</div>
			{#if form?.error}
				<div
					class="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive"
					role="alert"
				>
					{form.error}
				</div>
			{/if}
			<div class="flex justify-end gap-2">
				<Button type="button" variant="outline" onclick={cancelRoleChange}>Отмена</Button>
				<Button type="submit" disabled={roleSubmitting}>
					{roleSubmitting ? 'Сохраняем…' : 'Подтвердить'}
				</Button>
			</div>
		</form>
	{/if}
</BaseModal>

<BaseModal
	bind:open={priceOpen}
	title="Стоимость дня подписки"
	description="Настройка цены для ручных донатов и подписок."
	widthClass="sm:max-w-lg"
	onClose={() => (priceOpen = false)}
>
	<form
		method="POST"
		action="?/setPrice"
		use:enhance={() => {
			priceSubmitting = true;
			return async ({ result, update }) => {
				await update();
				priceSubmitting = false;
				if (result.type === 'success') priceOpen = false;
			};
		}}
		class="space-y-4"
	>
		<input type="hidden" name="scope" value={priceScope} />
		<div class="flex items-center justify-between rounded-lg border bg-muted/40 p-3 text-sm">
			<span class="text-muted-foreground">Сейчас</span>
			<strong>{data.subscriptionPrice} ₽ / день</strong>
		</div>
		<label class="block space-y-1.5 text-xs font-medium">
			Новая цена дня, ₽
			<Input name="newPrice" type="number" min="1" max="100000" bind:value={priceValue} />
			<span class="block text-[11px] font-normal text-muted-foreground"
				>Например, 10 ₽/день. Сумма доната делится на цену и округляется вниз.</span
			>
		</label>
		<div class="space-y-2">
			<p class="text-xs font-medium">Применить</p>
			<label
				class="flex cursor-pointer gap-2 rounded-lg border p-2.5 text-xs has-[:checked]:border-primary has-[:checked]:bg-primary/5"
			>
				<input type="radio" name="scopeChoice" value="new" bind:group={priceScope} class="mt-0.5" />
				<span
					><strong>Только для новых</strong><br /><span class="text-muted-foreground"
						>Старые донаты и выданные дни сохраняют прежнюю цену. Новые донаты и выдачи — по новой.</span
					></span
				>
			</label>
			<label
				class="flex cursor-pointer gap-2 rounded-lg border p-2.5 text-xs has-[:checked]:border-primary has-[:checked]:bg-primary/5"
			>
				<input type="radio" name="scopeChoice" value="all" bind:group={priceScope} class="mt-0.5" />
				<span
					><strong>Для всех ранее выданных подписок</strong><br /><span
						class="text-muted-foreground"
						>Оставшиеся дни активных ручных подписок пересчитываются пропорционально. Lifetime не
						меняется.</span
					></span
				>
			</label>
		</div>
		<div
			class="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-200"
		>
			Пример: было 70 ₽ за 10 дней (7 ₽/день), цена стала 10 ₽/день. Только для новых: 70 ₽ остаются
			10 днями, новые 140 ₽ дадут 14 дней. Для всех: оставшийся срок пересчитывается
			пропорционально.
		</div>
		{#if form?.error}
			<div
				class="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive"
				role="alert"
			>
				{form.error}
			</div>
		{/if}
		<div class="flex justify-end gap-2">
			<Button type="button" variant="outline" onclick={() => (priceOpen = false)}>Отмена</Button>
			<Button type="submit" disabled={priceSubmitting || priceValue < 1}>
				{priceSubmitting ? 'Сохраняем…' : 'Изменить цену'}
			</Button>
		</div>
	</form>
</BaseModal>

<BaseModal
	bind:open={authorModalOpen}
	title="Назначить автора"
	description="Автор получает права администратора; в проекте может быть только один автор."
	widthClass="sm:max-w-lg"
	onClose={() => (authorModalOpen = false)}
>
	{#if authorTarget}
		<form
			method="POST"
			action="?/setAuthor"
			use:enhance={() => {
				authorSubmitting = true;
				return async ({ result, update }) => {
					await update();
					authorSubmitting = false;
					if (result.type === 'success') authorModalOpen = false;
				};
			}}
			class="space-y-4"
		>
			<input type="hidden" name="userId" value={authorTarget.id} />
			<div class="rounded-lg border bg-muted/30 p-3 text-sm">
				<p class="font-semibold">{authorTarget.name}</p>
				<p class="mt-1 text-xs text-muted-foreground">станет автором и администратором</p>
			</div>
			{#if data.authorUser && data.authorUser.id !== authorTarget.id}
				<div
					class="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200"
				>
					Текущий автор <strong>{data.authorUser.name}</strong> будет переведён в пользователи.
				</div>
			{/if}
			<p class="text-xs text-muted-foreground">
				Автор по умолчанию исключён из статистики. Включить или выключить учёт можно в его карточке.
			</p>
			<div class="flex justify-end gap-2">
				<Button type="button" variant="outline" onclick={() => (authorModalOpen = false)}
					>Отмена</Button
				>
				<Button type="submit" disabled={authorSubmitting}>
					{authorSubmitting ? 'Назначаем…' : 'Подтвердить'}
				</Button>
			</div>
		</form>
	{/if}
</BaseModal>
