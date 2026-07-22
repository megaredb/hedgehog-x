<script lang="ts">
	import { Code, Award, ExternalLink, Heart } from '@lucide/svelte';
	import * as Avatar from '$lib/components/ui/avatar';
	import { Button } from '$lib/components/ui/button';

	interface Developer {
		name: string;
		fallback: string;
		github: string;
		role: string;
		description: string;
	}

	const developers: Developer[] = [
		{
			name: 'megared',
			fallback: 'MR',
			github: 'https://github.com/megaredb',
			role: 'Software Engineer',
			description:
				'Первоначальный разработчик сайта, который начал его развивать и продолжает это делать.'
		},
		{
			name: 'mk-rn',
			fallback: 'MK',
			github: 'https://github.com/mk-rn',
			role: 'Software Engineer',
			description:
				'Разработчик сайта, подсоединившийся к разработке спустя короткое время после релиза первой версии. Активно помогает в разработке и наполняет сайт контентом.'
		}
	];
</script>

<svelte:head>
	<title>О проекте & Авторы — Hedgehog X</title>
	<meta
		name="description"
		content="Информация о проекте Hedgehog X, авторах контента и разработчиках."
	/>
</svelte:head>

<div class="layout-content py-10 md:py-16 space-y-12">
	<!-- Заголовок страницы -->
	<div class="text-center space-y-4 max-w-2xl mx-auto">
		<h1
			class="text-4xl md:text-5xl font-extrabold tracking-tight text-balance bg-linear-to-r from-foreground to-foreground/75 bg-clip-text text-transparent"
		>
			О сайте
		</h1>
		<p class="text-muted-foreground text-md md:text-lg leading-relaxed text-balance">
			Добро пожаловать на сайт HEDGEHOG.INC! Здесь вы можете послушать различные аудиокниги:
			Реинкарнация безработного, Повелитель.
		</p>
	</div>

	<!-- Блок автора контента -->
	<div class="space-y-6">
		<div class="flex items-center gap-2 border-b border-border/40 pb-2">
			<Award class="h-5 w-5 text-primary" />
			<h2 class="text-xl font-bold tracking-tight text-foreground">Автор контента</h2>
		</div>

		<div
			class="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-6 md:p-8 shadow-xs transition-all duration-300 hover:shadow-md hover:border-primary/20 hover:-translate-y-1"
		>
			<!-- Декоративное свечение -->
			<div
				class="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-2xl"
			></div>

			<div
				class="flex flex-col md:flex-row gap-6 items-center md:items-start text-center md:text-left relative z-10"
			>
				<div
					class="h-20 w-20 rounded-2xl bg-secondary/80 border border-border flex items-center justify-center overflow-hidden shadow-inner shrink-0 group-hover:scale-105 transition-transform duration-300"
				>
					<img
						src="/logo-full.webp"
						alt="HEDGEHOG.INC Logo"
						class="h-16 w-16 rounded-xl object-cover"
					/>
				</div>
				<div class="space-y-3 flex-1">
					<div class="flex flex-col md:flex-row md:items-center justify-between gap-2">
						<h3 class="text-2xl font-extrabold text-foreground tracking-tight">HEDGEHOG.INC</h3>
						<span
							class="inline-flex self-center md:self-start items-center px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20"
						>
							Главный автор
						</span>
					</div>
					<p class="text-muted-foreground text-sm md:text-base leading-relaxed">
						Автор всех аудиокниг на сайте, проводящий колоссальную работу по их озвучке и
						редактированию.
					</p>
				</div>
			</div>
		</div>
	</div>

	<!-- Блок разработчиков -->
	<div class="space-y-6">
		<div class="flex items-center gap-2 border-b border-border/40 pb-2">
			<Code class="h-5 w-5 text-primary" />
			<h2 class="text-xl font-bold tracking-tight text-foreground">Разработчики</h2>
		</div>

		<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
			{#each developers as dev (dev.name)}
				<div
					class="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-6 shadow-xs transition-all duration-300 hover:shadow-md hover:border-primary/20 hover:-translate-y-1"
				>
					<div
						class="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-2xl"
					></div>

					<div class="flex items-start gap-4 relative z-10">
						<Avatar.Root
							class="h-16 w-16 border border-border/80 shadow-sm group-hover:scale-105 transition-transform duration-300"
						>
							<Avatar.Fallback class="bg-primary/10 text-primary text-lg font-extrabold"
								>{dev.fallback}</Avatar.Fallback
							>
						</Avatar.Root>

						<div class="space-y-3 flex-1 min-w-0">
							<div>
								<h3 class="text-lg font-extrabold text-foreground truncate">{dev.name}</h3>
								<p class="text-xs text-muted-foreground font-medium">{dev.role}</p>
							</div>

							<p class="text-muted-foreground text-sm leading-relaxed">
								{dev.description}
							</p>

							<div class="pt-2">
								<Button
									href={dev.github}
									target="_blank"
									rel="noopener noreferrer"
									variant="outline"
									size="sm"
									class="gap-2 h-9 border-border/60 hover:bg-muted"
								>
									<svg class="h-4 w-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
										<path
											fill-rule="evenodd"
											clip-rule="evenodd"
											d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.137 20.162 22 16.418 22 12c0-5.523-4.477-10-10-10z"
										/>
									</svg>
									<span>GitHub</span>
									<ExternalLink class="h-3.5 w-3.5 text-muted-foreground" />
								</Button>
							</div>
						</div>
					</div>
				</div>
			{/each}
		</div>
	</div>

	<!-- Копирайт и футер страницы -->
	<div
		class="border-t border-border/30 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground/80"
	>
		<div class="flex items-center gap-1.5">
			<Heart class="h-4 w-4 text-destructive animate-pulse" />
			<span>Сделано с любовью командой разработчиков</span>
		</div>
		<div class="font-medium">Copyright © 2025 HEDGEHOG.INC</div>
	</div>
</div>
