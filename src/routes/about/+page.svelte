<!-- eslint-disable svelte/no-navigation-without-resolve -->
<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { Code, Award, Heart, Languages } from '@lucide/svelte';
	import * as Avatar from '$lib/components/ui/avatar';
	import SocialIcon from '$lib/components/common/SocialIcon.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>{data.page.title} & Авторы — Hedgehog X</title>
	<meta name="description" content={data.page.intro} />
</svelte:head>

<div class="layout-content space-y-12 py-10 md:py-16">
	<!-- Page Header -->
	<div class="mx-auto max-w-2xl space-y-4 text-center">
		<h1
			class="bg-linear-to-r from-foreground to-foreground/75 bg-clip-text text-4xl font-extrabold tracking-tight text-balance text-transparent md:text-5xl"
		>
			{data.page.title}
		</h1>
		<p class="text-md leading-relaxed text-balance text-muted-foreground md:text-lg">
			{data.page.intro}
		</p>
	</div>

	<!-- Content Creator Section -->
	{#if data.page.data.authorEnabled !== false}
		<div class="space-y-6">
			<div class="flex items-center gap-2 border-b border-border/40 pb-2">
				<Award class="h-5 w-5 text-primary" />
				<h2 class="text-xl font-bold tracking-tight text-foreground">Автор контента</h2>
			</div>

			<div
				class="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-6 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-primary/20 hover:shadow-md md:p-8"
			>
				<!-- Decorative glow -->
				<div
					class="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-primary/5 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
				></div>

				<div
					class="relative z-10 flex flex-col items-center gap-6 text-center md:flex-row md:items-start md:text-left"
				>
					<div
						class="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-secondary/80 shadow-inner transition-transform duration-300 group-hover:scale-105"
					>
						<img
							src={data.page.data.authorLogoUrl}
							alt={data.page.data.authorName}
							class="h-16 w-16 rounded-xl object-cover"
						/>
					</div>
					<div class="flex-1 space-y-3">
						<div class="flex flex-col justify-between gap-2 md:flex-row md:items-center">
							<h3 class="text-2xl font-extrabold tracking-tight text-foreground">
								{data.page.data.authorName}
							</h3>
						</div>
						<p class="text-sm leading-relaxed text-muted-foreground md:text-base">
							{data.page.content}
						</p>
					</div>
				</div>
			</div>
		</div>
	{/if}

	{#if data.translators.some((translator) => translator.enabled)}
		<div class="space-y-6">
			<div class="flex items-center gap-2 border-b border-border/40 pb-2">
				<Languages class="h-5 w-5 text-primary" />
				<h2 class="text-xl font-bold tracking-tight text-foreground">Переводчики</h2>
			</div>

			<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
				{#each data.translators.filter((translator) => translator.enabled) as translator (translator.id)}
					<div
						class="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-6 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-primary/20 hover:shadow-md"
					>
						<div class="relative z-10 flex items-start gap-4">
							<Avatar.Root class="h-14 w-14 overflow-hidden border border-border/80 shadow-sm">
								{#if translator.userId && data.avatars[translator.userId]}
									<Avatar.Image
										src={data.avatars[translator.userId]}
										alt={translator.name}
										class="h-full w-full object-cover"
									/>
								{/if}
								<Avatar.Fallback class="bg-primary/10 text-base font-extrabold text-primary">
									{translator.name.charAt(0).toUpperCase()}
								</Avatar.Fallback>
							</Avatar.Root>
							<div class="min-w-0 flex-1 space-y-2">
								<div>
									<h3 class="truncate text-lg font-extrabold text-foreground">{translator.name}</h3>
									{#if translator.role}
										<p class="text-xs font-medium text-muted-foreground">{translator.role}</p>
									{/if}
								</div>
								{#if translator.description}
									<p class="text-sm leading-relaxed text-muted-foreground">
										{translator.description}
									</p>
								{/if}
								{#if translator.links.some((link) => link.enabled !== false)}
									<div class="flex flex-wrap items-center gap-2">
										{#each translator.links.filter((link) => link.enabled !== false) as link, linkIndex (`${link.type}-${link.url}-${linkIndex}`)}
											<a
												href={link.url}
												target="_blank"
												rel="noopener noreferrer"
												title={link.type}
												class="flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-background transition hover:-translate-y-0.5 hover:bg-muted"
											>
												<SocialIcon type={link.type} size={16} />
											</a>
										{/each}
									</div>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Developers Section -->
	{#if (data.page.data.developers ?? []).some((dev) => dev.enabled)}
		<div class="space-y-6">
			<div class="flex items-center gap-2 border-b border-border/40 pb-2">
				<Code class="h-5 w-5 text-primary" />
				<h2 class="text-xl font-bold tracking-tight text-foreground">Разработчики</h2>
			</div>

			<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
				{#each (data.page.data.developers ?? []).filter((dev) => dev.enabled) as dev, devIndex (`${dev.name}-${devIndex}`)}
					<div
						class="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-6 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-primary/20 hover:shadow-md"
					>
						<div
							class="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-primary/5 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
						></div>

						<div class="relative z-10 flex items-start gap-4">
							<Avatar.Root
								class="h-16 w-16 overflow-hidden border border-border/80 shadow-sm transition-transform duration-300 group-hover:scale-105"
							>
								{#if dev.userId && data.avatars[dev.userId]}
									<Avatar.Image
										src={data.avatars[dev.userId]}
										alt={dev.name}
										class="h-full w-full object-cover"
									/>
								{/if}
								<Avatar.Fallback class="bg-primary/10 text-lg font-extrabold text-primary"
									>{dev.name.charAt(0).toUpperCase()}</Avatar.Fallback
								>
							</Avatar.Root>

							<div class="min-w-0 flex-1 space-y-3">
								<div>
									<h3 class="truncate text-lg font-extrabold text-foreground">{dev.name}</h3>
									<p class="text-xs font-medium text-muted-foreground">{dev.role}</p>
								</div>

								<p class="text-sm leading-relaxed text-muted-foreground">
									{dev.description}
								</p>

								{#if dev.links.some((link) => link.enabled !== false)}
									<div class="flex flex-wrap items-center gap-2 pt-2">
										{#each dev.links.filter((link) => link.enabled !== false) as link, linkIndex (`${link.type}-${link.url}-${linkIndex}`)}
											<a
												href={link.url}
												target="_blank"
												rel="noopener noreferrer"
												title={link.type}
												class="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-background transition hover:-translate-y-0.5 hover:bg-muted"
											>
												<SocialIcon type={link.type} size={18} />
											</a>
										{/each}
									</div>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Copyright and page footer -->
	<div
		class="flex flex-col items-center justify-between gap-4 border-t border-border/30 pt-8 text-xs text-muted-foreground/80 sm:flex-row"
	>
		<div class="flex items-center gap-1.5">
			<Heart class="h-4 w-4 animate-pulse text-destructive" />
			<span>Сделано с любовью командой разработчиков</span>
		</div>
		<div class="font-medium">Copyright © 2026 HEDGEHOG.INC</div>
	</div>
</div>
