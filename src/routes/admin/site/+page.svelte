<!-- eslint-disable svelte/no-navigation-without-resolve -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Switch } from '$lib/components/ui/switch';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import SocialLinksEditor from '$lib/components/admin/site/SocialLinksEditor.svelte';
	import SocialIconSelect from '$lib/components/admin/site/SocialIconSelect.svelte';
	import BenefitIconSelect from '$lib/components/admin/site/BenefitIconSelect.svelte';
	import CryptoNetworkSelect from '$lib/components/admin/site/CryptoNetworkSelect.svelte';
	import CryptoCoinSelect from '$lib/components/admin/site/CryptoCoinSelect.svelte';
	import BoostyIcon from '$lib/components/ui/brand-icons/BoostyIcon.svelte';
	import TelegramIcon from '$lib/components/ui/brand-icons/TelegramIcon.svelte';
	import TelegramWalletCard from '$lib/components/support/TelegramWalletCard.svelte';
	import CryptoWalletCard from '$lib/components/support/CryptoWalletCard.svelte';
	import SupportCardModal from '$lib/components/support/SupportCardModal.svelte';
	import {
		Code,
		CreditCard,
		ExternalLink,
		Globe,
		Heart,
		Info,
		Radio,
		Languages,
		Link2,
		Plus,
		Save,
		Server,
		Settings,
		Sparkles,
		Trash2,
		UserRound,
		Users,
		Wallet
	} from '@lucide/svelte';
	import {
		CRYPTO_NETWORK_COINS,
		CRYPTO_NETWORK_COLORS,
		formatCardNumber,
		type CryptoCoin
	} from '$lib/types/site';
	import type {
		SiteBenefit,
		SiteLink,
		SitePerson,
		SiteMirror,
		SiteSocialLink,
		SiteSupportSettings
	} from '$lib/types/site';
	import type { ActionData, PageData } from './$types';

	type PageKey = 'about' | 'support' | 'community' | 'settings';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const pageTabs: Array<{ key: PageKey; label: string; icon: typeof Info }> = [
		{ key: 'about', label: 'О сайте', icon: Info },
		{ key: 'support', label: 'Поддержать', icon: Heart },
		{ key: 'community', label: 'Сообщество', icon: Users },
		{ key: 'settings', label: 'Настройки', icon: Settings }
	];
	const initialTab = page.url.searchParams.get('tab');
	let activePage = $state<PageKey>(
		initialTab === 'support' || initialTab === 'community' || initialTab === 'settings'
			? initialTab
			: 'about'
	);
	let mediaProxyEnabled = $state(untrack(() => data.mediaSettings.mediaProxyEnabled));
	let mirrors = $state<SiteMirror[]>(untrack(() => structuredClone(data.mirrors)));
	type PreviewData = {
		qrValue: string;
		copyValue: string;
		copyLabel: string;
		title: string;
		hint: string;
		colorFrom: string;
		colorTo: string;
		colorMid?: string;
		colorEnd?: string;
		accent: string;
		flat?: boolean;
		light?: boolean;
		marqueeRepeat?: number;
		coins?: CryptoCoin[];
		centerLogo?: 'gram' | 'network';
		network?: import('$lib/types/site').CryptoNetwork;
	};
	let previewOpen = $state(false);
	let preview = $state<PreviewData>({
		qrValue: '',
		copyValue: '',
		copyLabel: 'Копировать',
		title: 'QR-код',
		hint: 'Скопируйте значение или сканируйте QR-код.',
		colorFrom: '#0b84ff',
		colorTo: '#2d9cff',
		colorMid: '#2d9cff',
		colorEnd: '#087cf5',
		accent: '#55b7ff',
		marqueeRepeat: 2
	});
	let newTranslatorLinks = $state<SiteSocialLink[]>([]);
	let newTranslatorEnabled = $state(true);
	const translatorLinkMap = $state<Record<string, SiteSocialLink[]>>(
		untrack(() =>
			Object.fromEntries(
				data.translators.map((translator) => [translator.id, structuredClone(translator.links)])
			)
		)
	);
	const translatorEnabledMap = $state<Record<string, boolean>>(
		untrack(() =>
			Object.fromEntries(data.translators.map((translator) => [translator.id, translator.enabled]))
		)
	);

	$effect(() => {
		for (const translator of data.translators) {
			if (!(translator.id in translatorLinkMap)) {
				translatorLinkMap[translator.id] = structuredClone(translator.links);
				translatorEnabledMap[translator.id] = translator.enabled;
			}
		}
	});

	const emptySupport: SiteSupportSettings = {
		boostyEnabled: true,
		boostyUrl: '',
		boostyTitle: '',
		boostyDescription: '',
		cards: [],
		wallets: [],
		telegramWalletEnabled: false,
		telegramWalletAddress: ''
	};

	const initialPages = untrack(() => structuredClone(data.pages));

	let about = $state({
		title: initialPages.about.title,
		intro: initialPages.about.intro,
		content: initialPages.about.content,
		feedbackUrl: initialPages.about.data.feedbackUrl ?? '',
		authorEnabled: initialPages.about.data.authorEnabled !== false,
		authorName: initialPages.about.data.authorName ?? '',
		authorLogoUrl: initialPages.about.data.authorLogoUrl ?? '',
		developers: structuredClone(initialPages.about.data.developers ?? []) as SitePerson[]
	});
	let support = $state({
		title: initialPages.support.title,
		intro: initialPages.support.intro,
		content: initialPages.support.content,
		...(structuredClone(initialPages.support.data.support ?? emptySupport) as SiteSupportSettings)
	});
	let community = $state({
		title: initialPages.community.title,
		intro: initialPages.community.intro,
		content: initialPages.community.content,
		links: structuredClone(initialPages.community.data.communityLinks ?? []) as SiteLink[],
		benefits: structuredClone(initialPages.community.data.benefits ?? []) as SiteBenefit[]
	});

	const currentPage = $derived(
		activePage === 'about' ? about : activePage === 'support' ? support : community
	);

	$effect(() => {
		const tab = page.url.searchParams.get('tab');
		if (
			(tab === 'about' || tab === 'support' || tab === 'community' || tab === 'settings') &&
			tab !== activePage
		) {
			activePage = tab;
		}
	});

	function selectPage(tab: PageKey) {
		activePage = tab;
		const url = new URL(page.url);
		url.searchParams.set('tab', tab);
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		void goto(resolve('/admin/site') + '?' + url.searchParams.toString(), {
			replaceState: true,
			noScroll: true,
			keepFocus: true
		});
	}

	function openTelegramPreview() {
		preview = {
			qrValue: support.telegramWalletAddress,
			copyValue: support.telegramWalletAddress,
			copyLabel: 'Копировать адрес',
			title: 'Telegram',
			hint: 'Скопируйте этот адрес или сканируйте QR-код.',
			colorFrom: '#0b84ff',
			colorTo: '#2d9cff',
			colorMid: '#2d9cff',
			colorEnd: '#087cf5',
			accent: '#55b7ff',
			marqueeRepeat: 2,
			centerLogo: 'gram'
		};
		previewOpen = true;
	}

	function openCryptoPreview(wallet: (typeof support.wallets)[number]) {
		const palette = CRYPTO_NETWORK_COLORS[wallet.network];
		preview = {
			qrValue: wallet.address,
			copyValue: wallet.address,
			copyLabel: 'Копировать адрес',
			title: wallet.network,
			hint: 'Скопируйте адрес или сканируйте QR-код.',
			colorFrom: palette.card,
			colorTo: palette.card,
			accent: palette.accent,
			flat: true,
			light: true,
			marqueeRepeat: 2,
			coins: wallet.coins,
			centerLogo: 'network',
			network: wallet.network
		};
		previewOpen = true;
	}

	function openBankPreview(card: (typeof support.cards)[number]) {
		preview = {
			qrValue: card.payUrl || card.number,
			copyValue: card.number,
			copyLabel: 'Копировать номер карты',
			title: card.label || 'Банковская карта',
			hint: 'Скопируйте номер карты или сканируйте QR-код.',
			colorFrom: card.colorFrom || '#0f172a',
			colorTo: card.colorTo || '#312e81',
			accent: card.colorTo || '#312e81',
			marqueeRepeat: 3
		};
		previewOpen = true;
	}

	function addMirror() {
		const id = `mirror-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;
		mirrors = [
			...mirrors,
			{ id, label: 'Новое зеркало', description: '', host: '', enabled: true, autoRole: 'none' }
		];
	}

	function removeMirror(id: string) {
		mirrors = mirrors.filter((mirror) => mirror.id !== id);
	}

	function addDeveloper() {
		about.developers = [
			...about.developers,
			{ enabled: true, userId: '', name: '', role: '', description: '', links: [] }
		];
	}

	function addLink() {
		community.links = [
			...community.links,
			{ enabled: true, title: '', description: '', url: '', icon: 'website' }
		];
	}

	function addCard() {
		support.cards = [
			...support.cards,
			{
				enabled: true,
				brand: 'HEDGEHOG.INC',
				label: '',
				number: '',
				payUrl: '',
				qrUrl: '',
				colorFrom: '#0f172a',
				colorTo: '#312e81'
			}
		];
	}

	function updateWalletNetwork(
		wallet: {
			network: import('$lib/types/site').CryptoNetwork;
			coins: import('$lib/types/site').CryptoCoin[];
		},
		network: import('$lib/types/site').CryptoNetwork
	) {
		const allowed = CRYPTO_NETWORK_COINS[network];
		const coins = wallet.coins.filter((coin) => allowed.includes(coin));
		wallet.coins = coins.length > 0 ? coins : [allowed[0]];
	}

	function addWallet() {
		support.wallets = [
			...support.wallets,
			{ enabled: true, network: 'ton', coins: ['ton'], address: '', qrUrl: '' }
		];
	}

	function addBenefit() {
		community.benefits = [
			...community.benefits,
			{ enabled: true, title: '', description: '', icon: 'sparkles' }
		];
	}

	function pageDataJson(): string {
		if (activePage === 'about') {
			return JSON.stringify({
				feedbackUrl: about.feedbackUrl,
				authorEnabled: about.authorEnabled,
				authorName: about.authorName,
				authorLogoUrl: about.authorLogoUrl,
				developers: about.developers
			});
		}
		if (activePage === 'support') {
			return JSON.stringify({
				support: {
					boostyEnabled: support.boostyEnabled,
					boostyUrl: support.boostyUrl,
					boostyTitle: support.boostyTitle,
					boostyDescription: support.boostyDescription,
					cards: support.cards,
					wallets: support.wallets,
					telegramWalletEnabled: support.telegramWalletEnabled,
					telegramWalletAddress: support.telegramWalletAddress
				}
			});
		}
		return JSON.stringify({ communityLinks: community.links, benefits: community.benefits });
	}
</script>

<svelte:head>
	<title>Сайт | Hedgehog Admin</title>
</svelte:head>

<div class="space-y-6">
	<header>
		<div class="flex items-center gap-2">
			<Globe class="h-5 w-5 text-primary" />
			<h1 class="text-2xl font-bold tracking-tight">Сайт</h1>
		</div>
		<p class="mt-1 max-w-2xl text-sm text-muted-foreground">
			Информация и ссылки на публичных страницах. Изменения сразу отображаются на сайте.
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
			{form.message ?? 'Сохранено'}
		</div>
	{/if}

	<div class="flex gap-1 overflow-x-auto rounded-xl border bg-muted/30 p-1">
		{#each pageTabs as tab (tab.key)}
			{@const TabIcon = tab.icon}
			<button
				type="button"
				class="inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition {activePage ===
				tab.key
					? 'bg-background text-foreground shadow-sm'
					: 'text-muted-foreground hover:text-foreground'}"
				onclick={() => selectPage(tab.key)}
			>
				<TabIcon class="h-4 w-4" />
				{tab.label}
			</button>
		{/each}
		{#if activePage !== 'settings'}
			<a
				href={resolve(
					activePage === 'about' ? '/about' : activePage === 'support' ? '/support' : '/community'
				)}
				target="_blank"
				rel="noopener noreferrer"
				class="ml-auto inline-flex shrink-0 items-center gap-1 px-3 text-xs text-muted-foreground hover:text-foreground"
			>
				Открыть страницу
				<ExternalLink class="h-3 w-3" />
			</a>
		{/if}
	</div>

	{#if activePage === 'settings'}
		<Card class="border-border/60">
			<CardHeader class="pb-3">
				<CardTitle class="flex items-center gap-2 text-base">
					<Radio class="h-4 w-4 text-primary" /> Обратная связь
				</CardTitle>
				<CardDescription class="mt-1 text-xs">
					Куда перенаправлять пункт «Обратная связь» в меню сайта.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form
					method="POST"
					action="?/saveFeedbackSettings"
					use:enhance={() =>
						async ({ update }) => {
							await update({ reset: false });
						}}
					class="space-y-4"
				>
					<div class="space-y-1.5">
						<Label for="feedback-url">Адрес редиректа</Label>
						<Input
							id="feedback-url"
							name="feedbackUrl"
							bind:value={about.feedbackUrl}
							maxlength={1024}
							placeholder="https://t.me/..."
						/>
					</div>
					<Button type="submit" size="sm" class="gap-1.5">
						<Save class="h-4 w-4" /> Сохранить
					</Button>
				</form>
			</CardContent>
		</Card>

		<Card class="border-border/60">
			<CardHeader class="pb-3">
				<CardTitle class="flex items-center gap-2 text-base">
					<Server class="h-4 w-4 text-primary" /> Сеть и зеркала
				</CardTitle>
				<CardDescription class="mt-1 text-xs">
					Публичные зеркала CDN. «Автоматически» выбирает основное зеркало, а на RU-домене — зеркало
					с ролью «Для RU-доменов».
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form
					method="POST"
					action="?/saveMirrors"
					use:enhance={() =>
						async ({ update }) => {
							await update({ reset: false });
						}}
					class="space-y-4"
				>
					<input type="hidden" name="mirrors" value={JSON.stringify(mirrors)} />
					<input type="hidden" name="mediaProxyEnabled" value={String(mediaProxyEnabled)} />
					<div
						class="flex flex-col gap-3 rounded-xl border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between"
					>
						<div>
							<p class="text-sm font-semibold">Через сайт</p>
							<p class="text-xs text-muted-foreground">
								Проксировать медиа и аудио через сайт. Если выключено — файлы отдаются напрямую с
								основного включённого зеркала.
							</p>
						</div>
						<Switch bind:checked={mediaProxyEnabled} aria-label="Проксировать медиа через сайт" />
					</div>
					<div class="space-y-3">
						{#each mirrors as mirror (mirror.id)}
							<div class="rounded-xl border bg-card p-4">
								<div class="flex items-center gap-2">
									<Input
										bind:value={mirror.label}
										placeholder="Название"
										maxlength={120}
										class="min-w-0 flex-1"
									/>
									<label class="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
										Включено
										<Switch
											bind:checked={mirror.enabled}
											aria-label={`Показывать зеркало ${mirror.label}`}
										/>
									</label>
									<Button
										type="button"
										variant="ghost"
										size="icon"
										class="text-muted-foreground hover:text-destructive"
										onclick={() => removeMirror(mirror.id)}
										aria-label={`Удалить зеркало ${mirror.label}`}
									>
										<Trash2 class="h-4 w-4" />
									</Button>
								</div>
								<div class="mt-2 grid gap-2 sm:grid-cols-[1fr_190px]">
									<Input bind:value={mirror.host} placeholder="files.example.com" maxlength={255} />
									<select
										bind:value={mirror.autoRole}
										class="h-9 rounded-md border border-input bg-background px-2 text-xs outline-none focus:border-primary"
										aria-label={`Автовыбор зеркала ${mirror.label}`}
									>
										<option value="default">Основное</option>
										<option value="ru">Для RU-доменов</option>
										<option value="none">Не выбирать автоматически</option>
									</select>
								</div>
								<Textarea
									bind:value={mirror.description}
									placeholder="Описание для страницы настроек"
									rows={2}
									maxlength={500}
									class="mt-2"
								/>
							</div>
						{/each}
					</div>
					<div class="flex flex-wrap gap-2">
						<Button type="button" variant="outline" size="sm" class="gap-1.5" onclick={addMirror}>
							<Plus class="h-4 w-4" /> Добавить зеркало
						</Button>
						<Button type="submit" size="sm" class="gap-1.5">
							<Save class="h-4 w-4" /> Сохранить
						</Button>
					</div>
				</form>
			</CardContent>
		</Card>
	{:else}
		<Card class="border-border/60">
			<CardHeader class="pb-3">
				<CardTitle class="text-base"
					>{pageTabs.find((tab) => tab.key === activePage)?.label}</CardTitle
				>
				<CardDescription class="mt-1 text-xs">
					Заголовок, вступление и дополнительные блоки.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form
					id="site-page-form"
					method="POST"
					action="?/savePage"
					use:enhance={() =>
						async ({ update }) => {
							await update({ reset: false });
						}}
					class="space-y-4"
				>
					<input type="hidden" name="key" value={activePage} />
					<input type="hidden" name="data" value={pageDataJson()} />
					<div class="rounded-xl border bg-muted/20 p-4">
						<div class="mb-3 flex items-center gap-2">
							<Info class="h-4 w-4 text-primary" />
							<p class="text-sm font-semibold">Основное</p>
						</div>
						<div class="grid gap-4 md:grid-cols-2">
							<div class="space-y-1.5 md:col-span-2">
								<Label for="site-title">Заголовок</Label>
								<Input
									id="site-title"
									name="title"
									bind:value={currentPage.title}
									maxlength={255}
									required
								/>
							</div>
							<div class="space-y-1.5 md:col-span-2">
								<Label for="site-intro">Вступление</Label>
								<Textarea
									id="site-intro"
									name="intro"
									bind:value={currentPage.intro}
									rows={3}
									maxlength={4000}
								/>
							</div>
							{#if activePage !== 'about'}
								<div class="space-y-1.5 md:col-span-2">
									<Label for="site-content">Дополнительный текст</Label>
									<Textarea
										id="site-content"
										name="content"
										bind:value={currentPage.content}
										rows={4}
										maxlength={12000}
									/>
								</div>
							{/if}
						</div>
					</div>

					{#if activePage === 'about'}
						<div class="rounded-xl border bg-card p-4">
							<div class="mb-4 flex items-center gap-3">
								<div
									class="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-secondary/60"
								>
									{#if about.authorLogoUrl}
										<img
											src={about.authorLogoUrl}
											alt={about.authorName}
											class="h-11 w-11 rounded-xl object-cover"
										/>
									{:else}
										<UserRound class="h-6 w-6 text-muted-foreground" />
									{/if}
								</div>
								<div class="min-w-0 flex-1">
									<p class="flex items-center gap-1.5 text-sm font-semibold">
										<UserRound class="h-4 w-4 text-primary" /> Автор
									</p>
									<p class="text-xs text-muted-foreground">
										Карточка автора на странице «О сайте».
									</p>
								</div>
								<label class="flex items-center gap-2 text-xs text-muted-foreground">
									Показывать
									<Switch bind:checked={about.authorEnabled} aria-label="Показывать автора" />
								</label>
							</div>
							<div class="grid gap-4 md:grid-cols-2">
								<div class="space-y-1.5">
									<Label for="author-name">Имя автора</Label>
									<Input id="author-name" bind:value={about.authorName} maxlength={255} />
								</div>
								<div class="space-y-1.5">
									<Label for="author-logo">Логотип автора (URL)</Label>
									<Input id="author-logo" bind:value={about.authorLogoUrl} maxlength={1024} />
								</div>
								<div class="space-y-1.5 md:col-span-2">
									<Label for="site-content">Описание автора</Label>
									<Textarea
										id="site-content"
										name="content"
										bind:value={currentPage.content}
										rows={3}
										maxlength={12000}
									/>
								</div>
							</div>
						</div>

						<div class="space-y-3">
							<div class="flex items-center justify-between gap-3">
								<div>
									<p class="flex items-center gap-1.5 text-sm font-semibold">
										<Code class="h-4 w-4 text-primary" /> Разработчики
									</p>
									<p class="text-xs text-muted-foreground">Блок «Разработчики» на странице.</p>
								</div>
								<Button
									type="button"
									variant="outline"
									size="sm"
									class="gap-1.5"
									onclick={addDeveloper}
								>
									<Plus class="h-4 w-4" /> Добавить
								</Button>
							</div>
							{#each about.developers as developer, index (index)}
								<div class="rounded-xl border bg-card p-4">
									<div class="flex items-start gap-3">
										<div
											class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-extrabold text-primary"
										>
											{developer.name.charAt(0).toUpperCase() || '?'}
										</div>
										<div class="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
											<Input bind:value={developer.name} placeholder="Имя" maxlength={255} />
											<Input bind:value={developer.role} placeholder="Роль" maxlength={120} />
											<Input
												bind:value={developer.userId}
												placeholder="ID пользователя (необязательно)"
												maxlength={255}
												class="sm:col-span-2"
											/>
										</div>
										<Switch bind:checked={developer.enabled} aria-label="Показывать разработчика" />
										<Button
											type="button"
											variant="ghost"
											size="icon"
											class="text-muted-foreground hover:text-destructive"
											onclick={() =>
												(about.developers = about.developers.filter((_, i) => i !== index))}
											aria-label="Удалить разработчика"
										>
											<Trash2 class="h-4 w-4" />
										</Button>
									</div>
									<div class="mt-3 space-y-3">
										<div class="space-y-1.5">
											<Label>Соцсети</Label>
											<SocialLinksEditor bind:links={developer.links} includeGithub />
										</div>
										<Textarea
											bind:value={developer.description}
											placeholder="Описание"
											rows={2}
											maxlength={2000}
										/>
									</div>
								</div>
							{/each}
						</div>
					{:else if activePage === 'support'}
						<div class="space-y-4">
							<div class="rounded-xl border bg-muted/20 p-4">
								<div class="mb-3 flex items-center justify-between gap-3">
									<div class="flex items-center gap-2">
										<BoostyIcon size={18} class="text-orange-600" />
										<p class="text-sm font-semibold">Boosty</p>
									</div>
									<label class="flex items-center gap-2 text-xs text-muted-foreground">
										Показывать
										<Switch bind:checked={support.boostyEnabled} aria-label="Показывать Boosty" />
									</label>
								</div>
								<div class="grid gap-4 md:grid-cols-2">
									<div class="space-y-1.5 md:col-span-2">
										<Label for="boosty-url">Ссылка</Label>
										<Input
											id="boosty-url"
											type="url"
											bind:value={support.boostyUrl}
											maxlength={1024}
										/>
									</div>
									<div class="space-y-1.5">
										<Label for="boosty-title">Заголовок</Label>
										<Input id="boosty-title" bind:value={support.boostyTitle} maxlength={255} />
									</div>
									<div class="space-y-1.5">
										<Label for="boosty-desc">Описание</Label>
										<Input
											id="boosty-desc"
											bind:value={support.boostyDescription}
											maxlength={1000}
										/>
									</div>
								</div>
							</div>

							<div class="rounded-2xl border bg-card p-4">
								<div class="mb-4 flex items-start justify-between gap-3">
									<div class="flex min-w-0 items-start gap-2">
										<span
											class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-500"
											><TelegramIcon size={16} /></span
										>
										<div>
											<p class="text-sm font-semibold">Telegram</p>
											<p class="text-xs text-muted-foreground">
												Отдельный способ поддержки через Telegram Wallet.
											</p>
										</div>
									</div>
									<label class="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
										Показывать
										<Switch
											bind:checked={support.telegramWalletEnabled}
											aria-label="Показывать Telegram Wallet"
										/>
									</label>
								</div>
								<div class="grid gap-4 lg:grid-cols-[minmax(0,360px)_1fr]">
									<div>
										<button
											type="button"
											class="block w-full max-w-[20rem] text-left transition hover:brightness-105"
											onclick={openTelegramPreview}
											aria-label="Открыть предпросмотр Telegram"
										>
											<TelegramWalletCard />
										</button>
										<p class="mt-2 max-w-[20rem] text-center text-[11px] text-muted-foreground">
											Нажмите на карту, чтобы открыть предпросмотр
										</p>
									</div>
									<div class="space-y-3">
										<div class="space-y-1.5">
											<Label for="telegram-wallet-address">Адрес кошелька</Label>
											<Input
												id="telegram-wallet-address"
												bind:value={support.telegramWalletAddress}
												maxlength={255}
												placeholder="UQ..."
											/>
										</div>
									</div>
								</div>
							</div>

							<div class="space-y-3">
								<div class="flex items-center justify-between gap-3">
									<div class="flex items-center gap-2">
										<Wallet class="h-4 w-4 text-sky-500" />
										<div>
											<p class="text-sm font-semibold">Криптовалюта</p>
											<p class="text-xs text-muted-foreground">
												Можно добавить несколько кошельков и сетей.
											</p>
										</div>
									</div>
									<Button
										type="button"
										variant="outline"
										size="sm"
										class="gap-1.5"
										onclick={addWallet}
									>
										<Plus class="h-4 w-4" /> Добавить кошелёк
									</Button>
								</div>

								{#if support.wallets.length === 0}
									<p class="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
										Кошельки не добавлены.
									</p>
								{/if}

								{#each support.wallets as wallet, index (index)}
									<div class="rounded-2xl border bg-card p-4">
										<div class="mb-4 flex items-start justify-between gap-3">
											<div class="flex min-w-0 items-start gap-2">
												<span
													class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-500"
													><Wallet size={16} /></span
												>
												<div>
													<p class="text-sm font-semibold">Криптокошелёк</p>
													<p class="text-xs text-muted-foreground">Сеть, монеты и адрес.</p>
												</div>
											</div>
											<div class="flex shrink-0 items-center gap-2">
												<label class="flex items-center gap-2 text-xs text-muted-foreground">
													Показывать
													<Switch bind:checked={wallet.enabled} aria-label="Показывать кошелёк" />
												</label>
												<Button
													type="button"
													variant="ghost"
													size="icon"
													class="text-muted-foreground hover:text-destructive"
													onclick={() =>
														(support.wallets = support.wallets.filter((_, i) => i !== index))}
													aria-label="Удалить кошелёк"
												>
													<Trash2 class="h-4 w-4" />
												</Button>
											</div>
										</div>
										<div class="grid gap-4 lg:grid-cols-[minmax(0,320px)_1fr]">
											<div>
												<button
													type="button"
													class="block w-full max-w-[20rem] text-left transition hover:brightness-105"
													onclick={() => openCryptoPreview(wallet)}
													aria-label="Открыть предпросмотр кошелька"
												>
													<CryptoWalletCard {wallet} />
												</button>
											</div>
											<div class="space-y-3">
												<div class="space-y-1.5">
													<Label>Сеть</Label>
													<CryptoNetworkSelect
														bind:value={wallet.network}
														onchange={(network) => updateWalletNetwork(wallet, network)}
													/>
												</div>
												<div class="space-y-1.5">
													<Label>Криптовалюты</Label>
													<CryptoCoinSelect
														bind:coins={wallet.coins}
														allowed={CRYPTO_NETWORK_COINS[wallet.network]}
													/>
												</div>
												<div class="space-y-1.5">
													<Label for="wallet-address-{index}">Адрес</Label>
													<Input
														id="wallet-address-{index}"
														bind:value={wallet.address}
														maxlength={255}
													/>
												</div>
											</div>
										</div>
									</div>
								{/each}
							</div>
							<div class="space-y-3">
								<div class="flex items-center justify-between gap-3">
									<div class="flex items-center gap-2">
										<CreditCard class="h-4 w-4 text-primary" />
										<div>
											<p class="text-sm font-semibold">Перевод по карте</p>
											<p class="text-xs text-muted-foreground">Можно добавить несколько карт.</p>
										</div>
									</div>
									<Button
										type="button"
										variant="outline"
										size="sm"
										class="gap-1.5"
										onclick={addCard}
									>
										<Plus class="h-4 w-4" /> Добавить карту
									</Button>
								</div>

								{#if support.cards.length === 0}
									<p class="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
										Карты не добавлены.
									</p>
								{/if}

								{#each support.cards as card, index (index)}
									<div class="rounded-2xl border bg-card p-4">
										<div class="mb-4 flex items-start justify-between gap-3">
											<div class="flex min-w-0 items-start gap-2">
												<span
													class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
													><CreditCard size={16} /></span
												>
												<div>
													<p class="text-sm font-semibold">Банковская карта</p>
													<p class="text-xs text-muted-foreground">Реквизиты и внешний вид.</p>
												</div>
											</div>
											<div class="flex shrink-0 items-center gap-2">
												<label class="flex items-center gap-2 text-xs text-muted-foreground">
													Показывать
													<Switch bind:checked={card.enabled} aria-label="Показывать карту" />
												</label>
												<Button
													type="button"
													variant="ghost"
													size="icon"
													class="text-muted-foreground hover:text-destructive"
													onclick={() =>
														(support.cards = support.cards.filter((_, i) => i !== index))}
													aria-label="Удалить карту"
												>
													<Trash2 class="h-4 w-4" />
												</Button>
											</div>
										</div>
										<div class="grid gap-4 lg:grid-cols-[minmax(0,320px)_1fr]">
											<div>
												<div
													class="relative aspect-[1.586/1] w-full max-w-[20rem] cursor-pointer overflow-hidden rounded-2xl p-5 text-white shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
													style={`background: linear-gradient(135deg, ${card.colorFrom || '#0f172a'}, ${card.colorTo || '#312e81'})`}
													role="button"
													tabindex="0"
													onclick={(event) => {
														if ((event.target as HTMLElement).tagName !== 'INPUT')
															openBankPreview(card);
													}}
													onkeydown={(event) => {
														if (event.key === 'Enter' || event.key === ' ') {
															event.preventDefault();
															openBankPreview(card);
														}
													}}
												>
													<div class="relative flex items-start justify-between gap-3">
														<input
															bind:value={card.brand}
															aria-label="Надпись на карте"
															maxlength={120}
															placeholder="HEDGEHOG.INC"
															class="min-w-0 bg-transparent text-sm font-extrabold tracking-[0.12em] text-white outline-none placeholder:text-white/40"
														/>
														<CreditCard class="h-5 w-5 text-white/60" />
													</div>
													<div class="absolute inset-x-5 bottom-5">
														<input
															bind:value={card.label}
															placeholder="Название банка"
															aria-label="Название банка"
															maxlength={120}
															class="w-full bg-transparent text-[10px] font-semibold tracking-[0.16em] text-white/65 uppercase outline-none placeholder:text-white/40"
														/>
														<input
															value={card.number}
															oninput={(event) => {
																const formatted = formatCardNumber(event.currentTarget.value);
																event.currentTarget.value = formatted;
																card.number = formatted;
															}}
															placeholder="0000 0000 0000 0000"
															aria-label="Номер карты"
															maxlength={64}
															class="mt-1 w-full bg-transparent font-mono text-lg tracking-[0.12em] text-white outline-none placeholder:text-white/35 sm:text-xl"
														/>
													</div>
												</div>
											</div>
											<div class="space-y-3">
												<div class="space-y-1.5">
													<Label for="card-pay-{index}" class="flex items-center gap-1.5">
														<Link2 class="h-3.5 w-3.5" /> Ссылка на оплату
													</Label>
													<Input
														id="card-pay-{index}"
														type="url"
														bind:value={card.payUrl}
														maxlength={1024}
														placeholder="https://..."
													/>
												</div>
												<div class="grid grid-cols-2 gap-2">
													<label class="space-y-1 text-[11px] text-muted-foreground">
														<span>Цвет 1</span>
														<span class="flex items-center gap-1.5">
															<input
																type="color"
																bind:value={card.colorFrom}
																class="h-8 w-8 cursor-pointer rounded border border-border bg-transparent p-0.5"
																aria-label="Первый цвет градиента"
															/>
															<input
																bind:value={card.colorFrom}
																maxlength="7"
																class="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 font-mono text-xs"
															/>
														</span>
													</label>
													<label class="space-y-1 text-[11px] text-muted-foreground">
														<span>Цвет 2</span>
														<span class="flex items-center gap-1.5">
															<input
																type="color"
																bind:value={card.colorTo}
																class="h-8 w-8 cursor-pointer rounded border border-border bg-transparent p-0.5"
																aria-label="Второй цвет градиента"
															/>
															<input
																bind:value={card.colorTo}
																maxlength="7"
																class="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 font-mono text-xs"
															/>
														</span>
													</label>
												</div>
											</div>
										</div>
									</div>
								{/each}
							</div>
						</div>
						<SupportCardModal bind:open={previewOpen} {...preview} />
					{:else}
						<div class="space-y-3">
							<div class="flex items-center justify-between gap-3">
								<div>
									<p class="flex items-center gap-1.5 text-sm font-semibold">
										<Link2 class="h-4 w-4 text-primary" /> Ссылки сообщества
									</p>
									<p class="text-xs text-muted-foreground">Площадки и каналы.</p>
								</div>
								<Button type="button" variant="outline" size="sm" class="gap-1.5" onclick={addLink}>
									<Plus class="h-4 w-4" /> Добавить
								</Button>
							</div>
							{#each community.links as link, index (index)}
								<div class="rounded-xl border bg-card p-4">
									<div class="flex items-start gap-3">
										<div class="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
											<Input bind:value={link.title} placeholder="Название" maxlength={255} />
											<SocialIconSelect
												bind:value={link.icon}
												types={['vk', 'telegram', 'discord', 'boosty', 'website']}
											/>
										</div>
										<Switch bind:checked={link.enabled} aria-label="Показывать ссылку" />
										<Button
											type="button"
											variant="ghost"
											size="icon"
											class="text-muted-foreground hover:text-destructive"
											onclick={() =>
												(community.links = community.links.filter((_, i) => i !== index))}
											aria-label="Удалить ссылку"
										>
											<Trash2 class="h-4 w-4" />
										</Button>
									</div>
									<div class="mt-3 grid gap-3 md:grid-cols-2">
										<Input
											bind:value={link.url}
											placeholder="https://..."
											maxlength={1024}
											class="md:col-span-2"
										/>
										<Textarea
											bind:value={link.description}
											placeholder="Описание"
											rows={2}
											maxlength={1000}
											class="md:col-span-2"
										/>
									</div>
								</div>
							{/each}
						</div>

						<div class="space-y-3">
							<div class="flex items-center justify-between gap-3">
								<div>
									<p class="flex items-center gap-1.5 text-sm font-semibold">
										<Sparkles class="h-4 w-4 text-primary" /> Преимущества
									</p>
									<p class="text-xs text-muted-foreground">Блок «Почему стоит подписаться».</p>
								</div>
								<Button
									type="button"
									variant="outline"
									size="sm"
									class="gap-1.5"
									onclick={addBenefit}
								>
									<Plus class="h-4 w-4" /> Добавить
								</Button>
							</div>
							{#each community.benefits as benefit, index (index)}
								<div class="rounded-xl border bg-card p-4">
									<div class="flex items-start gap-3">
										<div class="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
											<Input bind:value={benefit.title} placeholder="Заголовок" maxlength={255} />
											<BenefitIconSelect bind:value={benefit.icon} />
										</div>
										<Switch bind:checked={benefit.enabled} aria-label="Показывать преимущество" />
										<Button
											type="button"
											variant="ghost"
											size="icon"
											class="text-muted-foreground hover:text-destructive"
											onclick={() =>
												(community.benefits = community.benefits.filter((_, i) => i !== index))}
											aria-label="Удалить преимущество"
										>
											<Trash2 class="h-4 w-4" />
										</Button>
									</div>
									<Textarea
										bind:value={benefit.description}
										placeholder="Описание"
										rows={2}
										maxlength={1000}
										class="mt-3"
									/>
								</div>
							{/each}
						</div>
					{/if}
				</form>
			</CardContent>
		</Card>

		<div class="sticky bottom-4 z-30 flex justify-end">
			<Button type="submit" form="site-page-form" size="sm" class="gap-1.5 shadow-lg">
				<Save class="h-4 w-4" /> Сохранить страницу
			</Button>
		</div>
	{/if}

	{#if activePage === 'about'}
		<Card class="border-border/60">
			<CardHeader class="pb-3">
				<CardTitle class="flex items-center gap-2 text-base"
					><Languages class="h-4 w-4 text-primary" /> Переводчики</CardTitle
				>
				<CardDescription class="mt-1 text-xs"
					>Список переводчиков на странице «О сайте».</CardDescription
				>
			</CardHeader>
			<CardContent class="space-y-5">
				<form
					method="POST"
					action="?/addTranslator"
					use:enhance
					class="grid gap-3 rounded-xl border bg-muted/20 p-4 md:grid-cols-2"
				>
					<div class="space-y-1.5">
						<Label for="translator-name">Имя</Label>
						<Input
							id="translator-name"
							name="name"
							placeholder="Имя переводчика"
							maxlength={255}
							required
						/>
					</div>
					<div class="space-y-1.5">
						<Label for="translator-role">Роль</Label>
						<Input
							id="translator-role"
							name="role"
							placeholder="Например, переводчик"
							maxlength={120}
						/>
					</div>
					<div class="space-y-1.5">
						<Label for="translator-user-id">ID пользователя</Label>
						<Input
							id="translator-user-id"
							name="userId"
							placeholder="Необязательно"
							maxlength={255}
						/>
					</div>
					<input type="hidden" name="links" value={JSON.stringify(newTranslatorLinks)} />
					<input type="hidden" name="enabled" value={String(newTranslatorEnabled)} />
					<label class="flex items-center gap-2 text-xs text-muted-foreground md:col-span-2">
						Показывать переводчика
						<Switch bind:checked={newTranslatorEnabled} aria-label="Показывать переводчика" />
					</label>
					<div class="space-y-1.5 md:col-span-2">
						<Label>Соцсети</Label>
						<SocialLinksEditor bind:links={newTranslatorLinks} />
					</div>
					<div class="space-y-1.5 md:col-span-2">
						<Label for="translator-description">Описание</Label>
						<Textarea id="translator-description" name="description" rows={2} maxlength={2000} />
					</div>
					<div class="md:col-span-2">
						<Button type="submit" size="sm" class="gap-1.5"
							><Plus class="h-4 w-4" /> Добавить переводчика</Button
						>
					</div>
				</form>

				{#if data.translators.length === 0}
					<p class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
						Переводчики пока не добавлены.
					</p>
				{:else}
					<div class="space-y-3">
						{#each data.translators as translator (translator.id)}
							<div class="rounded-xl border bg-card p-4">
								<div class="flex items-start gap-3">
									<div
										class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-extrabold text-primary"
									>
										{translator.name.charAt(0).toUpperCase()}
									</div>
									<div class="min-w-0 flex-1">
										<p class="truncate font-semibold">{translator.name}</p>
										{#if translator.role}<p class="text-xs text-muted-foreground">
												{translator.role}
											</p>{/if}
									</div>
									<form method="POST" action="?/deleteTranslator" use:enhance>
										<input type="hidden" name="id" value={translator.id} />
										<Button
											type="submit"
											variant="ghost"
											size="icon"
											class="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
											title="Удалить переводчика"
											aria-label="Удалить переводчика"
										>
											<Trash2 class="h-4 w-4" />
										</Button>
									</form>
								</div>
								<form
									method="POST"
									action="?/updateTranslator"
									use:enhance
									class="mt-3 grid gap-3 border-t pt-3 md:grid-cols-2"
								>
									<input type="hidden" name="id" value={translator.id} />
									<div class="space-y-1.5">
										<Label for="edit-name-{translator.id}">Имя</Label>
										<Input
											id="edit-name-{translator.id}"
											name="name"
											value={translator.name}
											maxlength={255}
											required
										/>
									</div>
									<div class="space-y-1.5">
										<Label for="edit-role-{translator.id}">Роль</Label>
										<Input
											id="edit-role-{translator.id}"
											name="role"
											value={translator.role ?? ''}
											maxlength={120}
										/>
									</div>
									<div class="space-y-1.5">
										<Label for="edit-user-{translator.id}">ID пользователя</Label>
										<Input
											id="edit-user-{translator.id}"
											name="userId"
											value={translator.userId ?? ''}
											placeholder="Необязательно"
											maxlength={255}
										/>
									</div>
									<input
										type="hidden"
										name="links"
										value={JSON.stringify(translatorLinkMap[translator.id] ?? [])}
									/>
									<input
										type="hidden"
										name="enabled"
										value={String(translatorEnabledMap[translator.id] ?? true)}
									/>
									<label
										class="flex items-center gap-2 text-xs text-muted-foreground md:col-span-2"
									>
										Показывать переводчика
										<Switch
											bind:checked={translatorEnabledMap[translator.id]}
											aria-label="Показывать переводчика"
										/>
									</label>
									<div class="space-y-1.5 md:col-span-2">
										<Label>Соцсети</Label>
										<SocialLinksEditor bind:links={translatorLinkMap[translator.id]} />
									</div>
									<div class="space-y-1.5 md:col-span-2">
										<Label for="edit-description-{translator.id}">Описание</Label>
										<Textarea
											id="edit-description-{translator.id}"
											name="description"
											value={translator.description ?? ''}
											rows={2}
											maxlength={2000}
										/>
									</div>
									<div class="md:col-span-2">
										<Button type="submit" size="sm" class="gap-1.5"
											><Save class="h-4 w-4" /> Сохранить</Button
										>
									</div>
								</form>
							</div>
						{/each}
					</div>
				{/if}
			</CardContent>
		</Card>
	{/if}
</div>
