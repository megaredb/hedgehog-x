<script lang="ts">
	import { audioStore } from '$lib/audio-store.svelte';
	import * as AudioPlayer from '$lib/components/ui/audio/player/index.js';
	// Импортируем Drawer из shadcn-svelte
	import * as Drawer from '$lib/components/ui/drawer/index.js';
</script>

{#snippet controls()}
	<AudioPlayer.ControlGroup class="flex items-center justify-center gap-4">
		<AudioPlayer.SkipBack />
		<AudioPlayer.Rewind />
		<AudioPlayer.Play />
		<AudioPlayer.FastForward />
		<AudioPlayer.SkipForward />
	</AudioPlayer.ControlGroup>
{/snippet}

{#snippet scrubber()}
	<div class="flex w-full items-center gap-2">
		<AudioPlayer.TimeDisplay />
		<AudioPlayer.SeekBar />
		<AudioPlayer.TimeDisplay remaining />
	</div>
{/snippet}

{#if audioStore.queue.length > 0}
	<AudioPlayer.Root
		class="sticky bottom-0 z-50 w-full bg-background shadow-[0_0px_6px_0px] shadow-muted/40 rounded-none"
	>
		<div class="hidden md:block px-4 py-2">
			<AudioPlayer.ControlBar class="flex items-center justify-between">
				<div class="w-1/4">
					<AudioPlayer.Volume />
				</div>

				<div class="flex-1 flex flex-col items-center gap-2 max-w-2xl">
					{@render controls()}
					{@render scrubber()}
				</div>

				<div class="w-1/4 flex justify-end"></div>
			</AudioPlayer.ControlBar>
		</div>

		<div class="block md:hidden">
			<Drawer.Root>
				<Drawer.Trigger class="w-full">
					<div class="flex items-center justify-between p-3 active:bg-muted/50 transition-colors">
						<div class="text-sm font-medium">{audioStore.currentTrack?.title}</div>
						<AudioPlayer.Play />
					</div>
				</Drawer.Trigger>

				<Drawer.Content>
					<div class="mx-auto w-full max-w-sm flex flex-col gap-6 p-6 pb-12">
						<Drawer.Header>
							<Drawer.Title>Название аудиокниги</Drawer.Title>
							<Drawer.Description>Название главы</Drawer.Description>
						</Drawer.Header>

						<div class="flex flex-col gap-4">
							{@render scrubber()}
							{@render controls()}
						</div>

						<div class="flex items-center justify-between pt-4">
							<AudioPlayer.Volume />
						</div>
					</div>
				</Drawer.Content>
			</Drawer.Root>
		</div>
	</AudioPlayer.Root>
{/if}
