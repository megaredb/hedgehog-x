<script lang="ts">
	import { onMount } from 'svelte';
	import { replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { showcaseBooks } from '$lib/data/mockShowcase';

	import ShowcaseBackground from '$lib/components/showcase/ShowcaseBackground.svelte';
	import ShowcaseItem from '$lib/components/showcase/ShowcaseItem.svelte';
	import ShowcaseNav from '$lib/components/showcase/ShowcaseNav.svelte';
	import { resolve } from '$app/paths';
	import { ChevronUp, ChevronDown } from '@lucide/svelte';
	import { fade } from 'svelte/transition';

	// Initialize start index at declaration to avoid hydration mismatch
	let initialIndex = 0;
	const initialBookId = page.url.searchParams.get('book');
	if (initialBookId) {
		const foundIndex = showcaseBooks.findIndex((b) => b.id === initialBookId);
		if (foundIndex !== -1) {
			initialIndex = foundIndex;
		}
	}

	let currentIndex = $state(initialIndex);
	let isVideoPlaying = $state(true);
	let scrollContainer: HTMLDivElement | null = $state(null);
	let isProgrammaticScroll = $state(false);
	let scrollTimeoutId: number | undefined;

	onMount(() => {
		// Restore video preference from localStorage
		const storedVideoPref = localStorage.getItem('videoBackgroundPlaying');
		if (storedVideoPref !== null) {
			isVideoPlaying = storedVideoPref === 'true';
		}

		// Scroll to initial book if not the first one
		if (currentIndex !== 0) {
			scrollToIndex(currentIndex, 'instant');
		}

		const handlePopState = () => {
			const bookIdFromUrl = page.url.searchParams.get('book');
			if (bookIdFromUrl) {
				const index = showcaseBooks.findIndex((b) => b.id === bookIdFromUrl);
				if (index !== -1 && index !== currentIndex) {
					currentIndex = index;
					scrollToIndex(index, 'smooth');
				}
			}
		};

		window.addEventListener('popstate', handlePopState);
		return () => {
			window.removeEventListener('popstate', handlePopState);
			if (scrollTimeoutId) {
				clearTimeout(scrollTimeoutId);
			}
		};
	});

	function toggleVideo() {
		isVideoPlaying = !isVideoPlaying;
		localStorage.setItem('videoBackgroundPlaying', String(isVideoPlaying));
	}

	function scrollToIndex(index: number, behavior: ScrollBehavior = 'smooth') {
		if (!scrollContainer) return;
		const sections = scrollContainer.querySelectorAll('section');
		if (sections[index]) {
			isProgrammaticScroll = true;
			if (scrollTimeoutId) {
				clearTimeout(scrollTimeoutId);
			}
			sections[index].scrollIntoView({ behavior, block: 'start' });

			// Reset programmatic flag after scroll completes
			scrollTimeoutId = window.setTimeout(() => {
				isProgrammaticScroll = false;
				scrollTimeoutId = undefined;
			}, 800);
		}
	}

	function updateUrl(bookId: string) {
		const url = new URL(window.location.href);
		url.searchParams.set('book', bookId);
		// Shallow URL update without full page reload
		replaceState(resolve((url.pathname + url.search) as '/'), page.state);
	}

	function handleSectionVisible(index: number) {
		// Update current book only during manual user scroll
		if (!isProgrammaticScroll && currentIndex !== index) {
			currentIndex = index;
			updateUrl(showcaseBooks[index].id);
		}
	}
</script>

<svelte:head>
	<title>Hedgehog X - Главная</title>
</svelte:head>

<!-- Showcase container -->
<div class="relative isolate flex w-full flex-1 flex-col overflow-hidden">
	<ShowcaseBackground books={showcaseBooks} {currentIndex} {isVideoPlaying} />

	<!-- Showcase scroll viewport -->
	<div
		bind:this={scrollContainer}
		class="absolute inset-0 no-scrollbar w-full snap-y snap-mandatory overflow-y-scroll"
	>
		{#each showcaseBooks as book, index (book.id)}
			<ShowcaseItem {book} {index} onVisible={handleSectionVisible} />
		{/each}
	</div>

	<!-- Scroll up indicator -->
	{#if currentIndex > 0}
		<button
			transition:fade={{ duration: 300 }}
			onclick={() => {
				currentIndex = currentIndex - 1;
				updateUrl(showcaseBooks[currentIndex].id);
				scrollToIndex(currentIndex);
			}}
			class="pointer-events-auto absolute top-20 left-1/2 z-20 flex -translate-x-1/2 animate-bounce cursor-pointer flex-col items-center gap-1 text-foreground/60 transition-colors duration-300 select-none hover:text-foreground"
			title="Previous"
		>
			<ChevronUp class="h-8 w-8" />
		</button>
	{/if}

	<!-- Scroll down indicator -->
	{#if currentIndex < showcaseBooks.length - 1}
		<button
			transition:fade={{ duration: 300 }}
			onclick={() => {
				currentIndex = currentIndex + 1;
				updateUrl(showcaseBooks[currentIndex].id);
				scrollToIndex(currentIndex);
			}}
			class="pointer-events-auto absolute bottom-8 left-1/2 z-20 flex -translate-x-1/2 animate-bounce cursor-pointer flex-col items-center gap-1 text-foreground/60 transition-colors duration-300 select-none hover:text-foreground"
			title="Next"
		>
			<ChevronDown class="h-8 w-8" />
		</button>
	{/if}

	<!-- Navigation controls -->
	<ShowcaseNav
		books={showcaseBooks}
		{currentIndex}
		{isVideoPlaying}
		onToggleVideo={toggleVideo}
		onScrollTo={(idx) => {
			currentIndex = idx;
			updateUrl(showcaseBooks[idx].id);
			scrollToIndex(idx);
		}}
	/>
</div>

<style>
	/* Hide scrollbar for immersive experience */
	.no-scrollbar::-webkit-scrollbar {
		display: none;
	}
	.no-scrollbar {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}
</style>
