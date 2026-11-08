<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Link2Off, Plus, Trash2, UserRound, ShieldAlert, WifiOff } from '@lucide/svelte';
	import { online } from 'svelte/reactivity/window';
	import { Button } from '$lib/components/ui/button';
	import { useSession } from '$lib/client/session.svelte';
	import { useAccounts } from '$lib/client/accounts.svelte';
	import {
		AUTH_PROVIDERS,
		providerAvatar,
		providerUsername,
		providerDisplayName,
		providerLabel
	} from '$lib/client/providers';
	import ConfirmModal from '$lib/components/overlay/ConfirmModal.svelte';
	import BaseModal from '$lib/components/overlay/BaseModal.svelte';
	import {
		DELETE_CONFIRM_TEXTS,
		computeDeleteButtons,
		nextDeleteConfirmPos
	} from '$lib/delete-confirm';

	const session = useSession();
	const accounts = useAccounts();
	const isOnline = $derived(online.current ?? true);

	// Load linked accounts upon session readiness
	let loadedForUser: string | null = null;

	$effect(() => {
		const userId = session.user?.id;
		if (userId && loadedForUser !== userId) {
			loadedForUser = userId;
			accounts.load();
		}
	});

	// Redirect unauthenticated visitors to auth page
	$effect(() => {
		if (!session.isPending && !session.user) {
			void goto(
				resolve(`${resolve('/auth')}?from=${encodeURIComponent(resolve('/profile'))}` as '/')
			);
		}
	});

	async function linkProvider(providerId: string) {
		const url = await accounts.link(providerId, '/profile');
		if (url) {
			window.location.href = url;
		}
	}

	const isLinked = (providerId: string) =>
		accounts.accounts.some((a) => a.providerId === providerId);
	const linkedAccountId = (providerId: string) =>
		accounts.accounts.find((a) => a.providerId === providerId)?.accountId ?? null;
	function isLastOne(providerId: string): boolean {
		return accounts.accounts.length <= 1 && isLinked(providerId);
	}

	// Determines last login provider matching user avatar
	function lastLoginProvider(): string | null {
		const user = session.user;
		if (!user?.image) return null;
		for (const p of AUTH_PROVIDERS) {
			if (providerAvatar(p.id, user) === user.image) return p.id;
		}
		return null;
	}

	const lastProvider = $derived(lastLoginProvider());

	// --- Unlink provider dialog state ---
	let unlinkProviderId = $state<string | null>(null);
	let unlinkModalOpen = $state(false);
	let unlinking = $state(false);
	let unlinkError = $state<string | null>(null);

	function openUnlinkModal(providerId: string) {
		unlinkProviderId = providerId;
		unlinkError = null;
		unlinkModalOpen = true;
	}

	function closeUnlinkModal() {
		unlinkProviderId = null;
		unlinkError = null;
		unlinkModalOpen = false;
	}

	async function confirmUnlink() {
		const providerId = unlinkProviderId;
		if (!providerId || unlinking) return;
		unlinking = true;
		unlinkError = null;
		const ok = await accounts.unlink(providerId);
		unlinking = false;
		if (ok) {
			closeUnlinkModal();
		} else {
			unlinkError = accounts.error ?? 'Не удалось отвязать аккаунт';
		}
	}

	// --- Multi-step account deletion ---
	let deleteConfirmStep = $state(0);
	let deleteConfirmPos = $state(0);
	let deleteModalOpen = $state(false);
	let deleting = $state(false);
	let deleteError = $state<string | null>(null);

	const deleteConfirmLabel = $derived(DELETE_CONFIRM_TEXTS[deleteConfirmStep]);
	const deleteButtons = $derived(computeDeleteButtons(deleteConfirmLabel, deleteConfirmPos));

	function openDeleteModal() {
		deleteConfirmStep = 0;
		deleteConfirmPos = Math.floor(Math.random() * 4);
		deleteError = null;
		deleteModalOpen = true;
	}

	function advanceDeleteStep() {
		deleteConfirmPos = nextDeleteConfirmPos(deleteConfirmPos);
		if (deleteConfirmStep < DELETE_CONFIRM_TEXTS.length - 1) {
			deleteConfirmStep += 1;
			return;
		}
		void performDelete();
	}

	function cancelDelete() {
		deleteModalOpen = false;
	}

	async function performDelete() {
		deleting = true;
		deleteError = null;
		const ok = await accounts.deleteAccount();
		if (!ok) {
			deleting = false;
			deleteError = accounts.error ?? 'Не удалось удалить аккаунт';
			return;
		}
		deleteModalOpen = false;
		deleting = false;
		await session.signOut();
		window.location.href = resolve('/');
	}
</script>

<div class="mx-auto max-w-2xl p-6">
	<h1 class="text-3xl font-bold tracking-tight">Мой аккаунт</h1>
	<p class="mt-2 text-muted-foreground">Профиль, идентификатор и способы входа.</p>

	{#if !isOnline}
		<div
			class="mt-4 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400"
		>
			<WifiOff class="size-4 shrink-0" />
			<span
				>Вы находитесь в оффлайн-режиме. Привязка, отвязка и удаление аккаунта требуют подключения к
				сети.</span
			>
		</div>
	{/if}

	{#if session.isPending}
		<div class="mt-8 text-sm text-muted-foreground">Загрузка…</div>
	{:else}
		{#if session.user}
			<!-- Profile card -->
			<section class="mt-8 rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
				<div class="flex items-center gap-5">
					<div
						class="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary ring-2 ring-border/60"
					>
						{#if session.user.image}
							<img
								src={session.user.image}
								alt={session.user.name}
								class="h-20 w-20 object-cover"
							/>
						{:else}
							<UserRound class="h-9 w-9" />
						{/if}
					</div>
					<div class="min-w-0">
						<p class="truncate text-xl font-semibold">{session.user.name}</p>
						{#if lastProvider}
							<p class="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
								<span class="inline-block size-2 rounded-full bg-emerald-500"></span>
								Последний вход: {providerLabel(lastProvider)}
							</p>
						{/if}
					</div>
				</div>

				<dl class="mt-6 grid gap-3 text-sm sm:grid-cols-2">
					<div class="rounded-lg bg-muted/40 p-3">
						<dt class="text-xs tracking-wide text-muted-foreground uppercase">ID пользователя</dt>
						<dd class="mt-1 font-mono text-xs break-all text-foreground">{session.user.id}</dd>
					</div>
				</dl>
			</section>

			<!-- Authentication methods -->
			<section class="mt-8">
				<h2 class="text-xl font-bold tracking-tight">Способы входа</h2>
				<p class="mt-1 text-sm text-muted-foreground">
					Привяжите несколько аккаунтов (Telegram, Discord), чтобы входить с любого из них.
					Последний способ входа отвязать нельзя.
				</p>

				{#if accounts.error}
					<p class="mt-3 text-sm text-destructive">{accounts.error}</p>
				{/if}

				{#if accounts.isLoading}
					<p class="mt-4 text-sm text-muted-foreground">Загрузка способов входа…</p>
				{:else}
					<div class="mt-4 space-y-3">
						{#each AUTH_PROVIDERS as provider (provider.id)}
							{@const Icon = provider.icon}
							{@const linked = isLinked(provider.id)}
							{@const accId = linkedAccountId(provider.id)}
							{@const lastOne = isLastOne(provider.id)}
							{@const avatar = providerAvatar(provider.id, session.user)}
							{@const username = providerUsername(provider.id, session.user)}
							{@const displayName = providerDisplayName(provider.id, session.user)}
							<div
								class="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-card p-4"
							>
								<div class="flex min-w-0 items-center gap-3">
									<!-- Platform avatar if linked, otherwise brand icon -->
									{#if linked && avatar}
										<div
											class="h-11 w-11 shrink-0 overflow-hidden rounded-full border border-border/60"
										>
											<img src={avatar} alt={provider.label} class="h-11 w-11 object-cover" />
										</div>
									{:else if linked && username}
										<!-- Fallback: first letter of username -->
										<div
											class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted/60 font-semibold text-muted-foreground"
										>
											{username.charAt(0).toUpperCase()}
										</div>
									{:else}
										<div
											class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted/60 text-muted-foreground"
										>
											<Icon class="size-5" style="color: {provider.brandColor};" />
										</div>
									{/if}
									<div class="min-w-0">
										<p class="font-medium">{provider.label}</p>
										<p class="text-xs text-muted-foreground">
											{#if linked}
												{#if username}
													<span class="block sm:inline">@{username}</span>
													{#if accId}
														<span class="mx-1 hidden sm:inline">·</span>
														<span class="block sm:inline">ID {accId}</span>
													{/if}
												{:else if displayName}
													<span class="block sm:inline">{displayName}</span>
													{#if accId}
														<span class="mx-1 hidden sm:inline">·</span>
														<span class="block sm:inline">ID {accId}</span>
													{/if}
												{:else if accId}
													<span>ID {accId}</span>
												{/if}
											{:else}
												{provider.description}
											{/if}
										</p>
									</div>
								</div>

								{#if linked}
									<Button
										variant="outline"
										disabled={accounts.isPending !== null || lastOne || !isOnline}
										title={!isOnline
											? 'Недоступно в оффлайн-режиме'
											: lastOne
												? 'Нельзя отвязать последний способ входа'
												: 'Отвязать'}
										onclick={() => openUnlinkModal(provider.id)}
									>
										<Link2Off class="size-4" />
										Отвязать
									</Button>
								{:else}
									<Button
										disabled={accounts.isPending !== null || !isOnline}
										title={!isOnline ? 'Недоступно в оффлайн-режиме' : 'Привязать'}
										onclick={() => linkProvider(provider.id)}
									>
										<Plus class="size-4" />
										Привязать
									</Button>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</section>

			<!-- Danger zone: account deletion -->
			<section class="mt-10 rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
				<div class="flex items-center gap-2 text-destructive">
					<ShieldAlert class="size-5" />
					<h2 class="text-lg font-bold tracking-tight">Опасная зона</h2>
				</div>
				<p class="mt-1 text-sm text-muted-foreground">
					Удаление аккаунта навсегда стирает профиль, способы входа, закладки, прогресс
					прослушивания и лайки. Действие необратимо.
				</p>
				<div class="mt-4">
					<Button
						variant="outline"
						class="text-destructive hover:text-destructive"
						disabled={accounts.isPending !== null || !isOnline}
						title={!isOnline ? 'Недоступно в оффлайн-режиме' : 'Удалить аккаунт'}
						onclick={openDeleteModal}
					>
						<Trash2 class="size-4" />
						Удалить аккаунт
					</Button>
				</div>
			</section>

			<!-- Account deletion confirmation modal -->
			<BaseModal
				bind:open={deleteModalOpen}
				title={DELETE_CONFIRM_TEXTS[deleteConfirmStep]}
				description="Это действие нельзя отменить. Удаление сотрёт ваш профиль и все данные."
				showCloseButton={false}
			>
				{#if deleteError}
					<p class="mt-3 text-center text-sm text-destructive">{deleteError}</p>
				{/if}

				{#snippet footer()}
					<div class="flex w-full flex-col gap-2">
						{#each deleteButtons as btn (btn.key)}
							{#if btn.confirm}
								<Button
									variant="outline"
									class="w-full text-destructive hover:text-destructive"
									disabled={deleting}
									onclick={advanceDeleteStep}
								>
									{#if deleting}
										Удаление…
									{:else}
										{btn.label}
									{/if}
								</Button>
							{:else}
								<Button variant="outline" class="w-full" disabled={deleting} onclick={cancelDelete}>
									{btn.label}
								</Button>
							{/if}
						{/each}
					</div>
				{/snippet}
			</BaseModal>

			<!-- Provider unlink confirmation modal -->
			<ConfirmModal
				bind:open={unlinkModalOpen}
				title={unlinkProviderId
					? `Отвязать ${providerLabel(unlinkProviderId)}?`
					: 'Отвязать провайдера?'}
				description="Вы сможете снова привязать этот способ входа позже. Последний способ входа отвязать нельзя."
				confirmLabel="Отвязать"
				cancelLabel="Отмена"
				confirming={unlinking}
				onCancel={closeUnlinkModal}
				onConfirm={confirmUnlink}
			>
				{#if unlinkError}
					<p class="mt-3 text-center text-sm text-destructive">{unlinkError}</p>
				{/if}
			</ConfirmModal>
		{/if}
	{/if}
</div>
