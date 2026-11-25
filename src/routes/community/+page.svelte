<script lang="ts">
	import { Users, Bell, MessageCircle, Sparkles, ExternalLink } from '@lucide/svelte';
	import SocialIcon from '$lib/components/common/SocialIcon.svelte';

	let { data } = $props();

	const socialLinks = $derived(
		(data.page.data.communityLinks ?? []).filter((link) => link.enabled)
	);
	const benefits = $derived((data.page.data.benefits ?? []).filter((benefit) => benefit.enabled));
	const benefitIcons = { bell: Bell, message: MessageCircle, sparkles: Sparkles };
	const benefitColors = {
		bell: 'text-amber-500 bg-amber-500/10',
		message: 'text-emerald-500 bg-emerald-500/10',
		sparkles: 'text-violet-500 bg-violet-500/10'
	};
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -->

<svelte:head>
	<title>{data.page.title} | Hedgehog X</title>
	<meta name="description" content={data.page.intro} />
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
		<h1 class="text-3xl font-extrabold tracking-tight sm:text-4xl">{data.page.title}</h1>
		<p class="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
			{data.page.intro}
		</p>
		{#if data.page.content}
			<p class="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
				{data.page.content}
			</p>
		{/if}
	</div>

	<!-- Social networks grid -->
	{#if socialLinks.length > 0}
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
								class="flex h-11 w-11 items-center justify-center rounded-xl border border-border/60 bg-background shadow-sm"
							>
								<SocialIcon type={item.icon} size={22} />
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
	{/if}

	<!-- Why join section -->
	{#if benefits.length > 0}
		<div class="rounded-2xl border border-border/60 bg-muted/20 p-6 sm:p-8">
			<h2 class="mb-6 text-center text-xl font-bold tracking-tight sm:text-left">
				Почему стоит подписаться?
			</h2>
			<div class="grid grid-cols-1 gap-6 sm:grid-cols-3">
				{#each benefits as benefit (benefit.title)}
					{@const IconComponent = benefitIcons[benefit.icon] ?? Sparkles}
					<div class="flex flex-col items-center gap-3 text-center sm:items-start sm:text-left">
						<div
							class="flex h-12 w-12 items-center justify-center rounded-xl shadow-xs {benefitColors[
								benefit.icon
							]}"
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
	{/if}
</div>
