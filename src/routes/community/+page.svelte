<script lang="ts">
	import { Users, Bell, MessageCircle, Sparkles, ExternalLink } from '@lucide/svelte';
	import TelegramIcon from '$lib/components/ui/brand-icons/TelegramIcon.svelte';
	import DiscordIcon from '$lib/components/ui/brand-icons/DiscordIcon.svelte';
	import BoostyIcon from '$lib/components/ui/brand-icons/BoostyIcon.svelte';
	import LavaIcon from '$lib/components/ui/brand-icons/LavaIcon.svelte';

	const socialLinks = [
		{
			title: 'VKontakte',
			description: 'Официальная группа ВКонтакте',
			url: 'https://vk.com/hedgehoginc',
			badge: 'VK',
			colorClass: 'text-blue-500 bg-blue-500/10 border-blue-500/20'
		},
		{
			title: 'Telegram — Overlord',
			description: 'Канал по аудиокниге Overlord (Владыка)',
			url: 'https://t.me/hedgehogincoverlord',
			icon: TelegramIcon,
			colorClass: 'text-sky-500 bg-sky-500/10 border-sky-500/20'
		},
		{
			title: 'Telegram — Mushoku Tensei',
			description: 'Канал по аудиокниге Реинкарнация безработного',
			url: 'https://t.me/Mushoku_Tensei_AudioBook',
			icon: TelegramIcon,
			colorClass: 'text-sky-500 bg-sky-500/10 border-sky-500/20'
		},
		{
			title: 'Discord',
			description: 'Сервер для живого общения и обсуждений',
			url: 'https://discord.gg/5dwmqrEwx',
			icon: DiscordIcon,
			colorClass: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20'
		},
		{
			title: 'Boosty',
			description: 'Ранний доступ, эксклюзивы и поддержка автора',
			url: 'https://boosty.to/hedgehoginc',
			icon: BoostyIcon,
			colorClass: 'text-orange-500 bg-orange-500/10 border-orange-500/20'
		},
		{
			title: 'Lava.top',
			description: 'Подписка и донаты зарубежными картами',
			url: 'https://app.lava.top/hedgehoginc',
			icon: LavaIcon,
			colorClass: 'text-violet-500 bg-violet-500/10 border-violet-500/20'
		}
	];

	const benefits = [
		{
			title: 'Уведомления',
			description: 'Получайте уведомления о новых главах и обновлениях',
			icon: Bell,
			iconColor: 'text-amber-500 bg-amber-500/10'
		},
		{
			title: 'Общение',
			description: 'Общайтесь с другими слушателями и делитесь мнениями',
			icon: MessageCircle,
			iconColor: 'text-emerald-500 bg-emerald-500/10'
		},
		{
			title: 'Эксклюзивы',
			description: 'Доступ к эксклюзивному контенту и бонусам',
			icon: Sparkles,
			iconColor: 'text-purple-500 bg-purple-500/10'
		}
	];
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -->

<svelte:head>
	<title>Сообщество | Hedgehog X</title>
	<meta
		name="description"
		content="Хотите узнать больше об авторе? Подпишитесь на социальные сети и будьте в курсе всех новостей!"
	/>
</svelte:head>

<div class="layout-content mx-auto max-w-4xl space-y-10 py-6 md:py-10">
	<!-- Page Header -->
	<div class="text-center sm:text-left">
		<div
			class="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"
		>
			<Users class="h-3.5 w-3.5" />
			<span>Клуб слушателей</span>
		</div>
		<h1 class="text-3xl font-extrabold tracking-tight sm:text-4xl">Сообщество</h1>
		<p class="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
			Хотите узнать больше об авторе? Подпишитесь на социальные сети и будьте в курсе всех новостей!
		</p>
	</div>

	<!-- Social networks grid -->
	<div>
		<h2 class="mb-4 text-xl font-bold tracking-tight">Наши каналы и площадки</h2>
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each socialLinks as item (item.url)}
				<a
					href={item.url}
					target="_blank"
					rel="noopener noreferrer"
					class="group relative flex flex-col justify-between rounded-2xl border border-border/60 bg-card p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
				>
					<div class="mb-3 flex items-start justify-between gap-3">
						<div
							class="flex h-11 w-11 items-center justify-center rounded-xl border text-base font-bold shadow-sm {item.colorClass}"
						>
							{#if item.icon}
								<item.icon class="h-5 w-5 fill-current" />
							{:else}
								<span>{item.badge}</span>
							{/if}
						</div>
						<ExternalLink
							class="h-4 w-4 text-muted-foreground transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary"
						/>
					</div>
					<div>
						<h3
							class="text-base font-semibold text-foreground transition-colors group-hover:text-primary"
						>
							{item.title}
						</h3>
						<p class="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
							{item.description}
						</p>
					</div>
				</a>
			{/each}
		</div>
	</div>

	<!-- Why join section -->
	<div class="rounded-2xl border border-border/60 bg-muted/20 p-6 sm:p-8">
		<h2 class="mb-6 text-center text-xl font-bold tracking-tight sm:text-left">
			Почему стоит подписаться?
		</h2>
		<div class="grid grid-cols-1 gap-6 sm:grid-cols-3">
			{#each benefits as benefit (benefit.title)}
				{@const IconComponent = benefit.icon}
				<div class="flex flex-col items-center gap-3 text-center sm:items-start sm:text-left">
					<div
						class="flex h-12 w-12 items-center justify-center rounded-xl shadow-xs {benefit.iconColor}"
					>
						<IconComponent class="h-6 w-6" />
					</div>
					<div>
						<h3 class="text-base font-semibold text-foreground">{benefit.title}</h3>
						<p class="mt-1 text-xs leading-relaxed text-muted-foreground">
							{benefit.description}
						</p>
					</div>
				</div>
			{/each}
		</div>
	</div>
</div>
