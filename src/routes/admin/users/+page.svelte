<!-- eslint-disable svelte/no-navigation-without-resolve -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { CalendarDays, Search, Users } from '@lucide/svelte';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const roleLabels: Record<string, string> = {
		all: 'Все роли',
		user: 'Пользователи',
		admin: 'Администраторы'
	};

	const providerLabels: Record<string, string> = {
		'telegram-oidc': 'Telegram',
		discord: 'Discord'
	};

	const sortLabels: Record<string, string> = {
		newest: 'Сначала новые',
		oldest: 'Сначала старые',
		name: 'По имени',
		email: 'По email',
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

	function formatDate(value: Date | string): string {
		const date = value instanceof Date ? value : new Date(value);
		return Number.isNaN(date.getTime())
			? '—'
			: date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
	}

	function submitFilters(event: Event) {
		const target = event.currentTarget as HTMLInputElement | HTMLSelectElement;
		target.form?.requestSubmit();
	}

	function avatarFor(item: (typeof data.users)[number]): string | null {
		return item.image || item.telegramAvatar || item.discordAvatar || null;
	}
</script>

<div class="space-y-6">
	<header class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
		<div>
			<h1 class="text-2xl font-bold tracking-tight">Пользователи</h1>
			<p class="mt-1 text-sm text-muted-foreground">
				Поиск, фильтры и роли пользователей. Найдено {data.users.length} из {data.totalUsers}.
			</p>
		</div>
		<Badge variant="outline" class="gap-1 self-start font-mono text-[11px]">
			<Users class="h-3 w-3" />
			{data.users.length} / {data.totalUsers}
		</Badge>
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
			class="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-400"
			role="status"
		>
			Роль обновлена.
		</div>
	{/if}

	<Card class="border-border/60">
		<CardHeader class="pb-3">
			<CardTitle class="flex items-center gap-2 text-base">
				<Search class="h-4 w-4 text-primary" />
				Поиск и фильтры
			</CardTitle>
		</CardHeader>
		<CardContent>
			<form
				method="GET"
				class="grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_150px_170px_180px_auto_auto]"
			>
				<div class="relative">
					<Search
						class="pointer-events-none absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground"
					/>
					<Input
						name="q"
						value={data.filters.q}
						placeholder="Имя, email или ID"
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
				<Button href="/admin/users" variant="ghost" size="sm">Сбросить</Button>
			</form>
		</CardContent>
	</Card>

	<Card class="border-border/60">
		<CardHeader class="pb-3">
			<CardTitle class="text-base">Список пользователей ({data.users.length})</CardTitle>
		</CardHeader>
		<CardContent class="space-y-2">
			{#if data.users.length === 0}
				<div class="py-10 text-center text-sm text-muted-foreground">
					По выбранным фильтрам пользователи не найдены.
				</div>
			{:else}
				{#each data.users as item (item.id)}
					<form
						method="POST"
						action="?/setRole"
						use:enhance
						class="flex flex-col gap-3 rounded-lg border p-3 lg:flex-row lg:items-center lg:justify-between"
					>
						<input type="hidden" name="id" value={item.id} />
						<div class="flex min-w-0 items-center gap-3">
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
								<p class="truncate text-sm font-medium">
									{item.name}
									{#if item.id === data.currentUserId}
										<span class="text-xs text-muted-foreground">(вы)</span>
									{/if}
								</p>
								<p class="truncate text-xs text-muted-foreground">{item.email || item.id}</p>
								<p class="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">{item.id}</p>
							</div>
						</div>

						<div class="flex flex-wrap items-center gap-2">
							<span class="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
								<CalendarDays class="h-3 w-3" />
								{formatDate(item.createdAt)}
							</span>
							{#each item.providers as provider (provider)}
								<Badge variant="outline" class="text-[10px]">
									{providerLabels[provider] ?? provider}
								</Badge>
							{/each}
							<div
								class="inline-flex items-center rounded-md border border-input bg-muted/40 p-0.5"
							>
								<label
									class="cursor-pointer rounded px-2 py-1 text-xs font-medium text-muted-foreground transition has-[:checked]:bg-background has-[:checked]:text-foreground has-[:checked]:shadow-xs"
								>
									<input
										type="radio"
										name="role"
										value="user"
										checked={item.role === 'user'}
										class="sr-only"
									/>
									Пользователь
								</label>
								<label
									class="cursor-pointer rounded px-2 py-1 text-xs font-medium text-muted-foreground transition has-[:checked]:bg-background has-[:checked]:text-foreground has-[:checked]:shadow-xs"
								>
									<input
										type="radio"
										name="role"
										value="admin"
										checked={item.role === 'admin'}
										class="sr-only"
									/>
									Админ
								</label>
							</div>
							<Button type="submit" size="sm" variant="outline">Сохранить</Button>
						</div>
					</form>
				{/each}
			{/if}
		</CardContent>
	</Card>
</div>
