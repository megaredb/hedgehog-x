<!-- eslint-disable svelte/no-navigation-without-resolve -->
<script lang="ts">
	import { onMount, onDestroy, tick, untrack } from 'svelte';
	import { fly } from 'svelte/transition';
	import { flip } from 'svelte/animate';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { audioStore } from '$lib/audio-store.svelte';
	import { useDownloads } from '$lib/client/downloads/downloadManager.svelte';
	import { audioVersionKey } from '$lib/audio-version';
	import { saveBroadcastChat } from '$lib/client/broadcast-chat';
	import { replayResumeOffset } from '$lib/client/broadcast-player';
	import BlurhashImage from '$lib/components/common/BlurhashImage.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Switch } from '$lib/components/ui/switch';
	import ImageLightbox from '$lib/components/ui/lightbox/ImageLightbox.svelte';
	import SupportCardModal from '$lib/components/support/SupportCardModal.svelte';
	import TelegramWalletCard from '$lib/components/support/TelegramWalletCard.svelte';
	import CryptoWalletCard from '$lib/components/support/CryptoWalletCard.svelte';
	import {
		Check,
		Clock,
		Coins,
		Heart,
		Image as ImageIcon,
		Info,
		Link as LinkIcon,
		Maximize2,
		MessageCircle,
		Minimize2,
		Paperclip,
		Reply,
		Play,
		Radio,
		Send,
		Users,
		X,
		ZoomIn
	} from '@lucide/svelte';
	import {
		CRYPTO_NETWORK_COLORS,
		CRYPTO_NETWORK_LABELS,
		DEFAULT_SUPPORT_SETTINGS,
		type CryptoCoin,
		type SiteSupportSettings
	} from '$lib/types/site';
	import type { PageData } from './$types';

	interface ChatMessage {
		id: string;
		userId: string | null;
		name: string;
		avatar: string | null;
		body: string;
		createdAt: Date | string;
		offsetSeconds: number;
		subscription: 'none' | 'active' | 'lifetime';
		reactions: Record<string, number>;
		myReaction: string | null;
		replyToId: string | null;
		replyToName: string | null;
		replyToBody: string | null;
		linkUrl: string | null;
		linkTitle: string | null;
		linkDescription: string | null;
		linkImage: string | null;
		taggedIllustrationIds: string[];
	}

	let { data }: { data: PageData } = $props();
	let broadcast = $state(untrack(() => data.broadcast));
	let kind = $state(untrack(() => data.kind));
	let messages = $state<ChatMessage[]>(untrack(() => data.messages as unknown as ChatMessage[]));
	let listeners = $state(0);
	type BroadcastParticipant = { id: string; name: string; image: string | null };
	let participants = $state<BroadcastParticipant[]>(untrack(() => data.participants ?? []));
	const support: SiteSupportSettings = untrack(
		() => (data.support as SiteSupportSettings | null) ?? DEFAULT_SUPPORT_SETTINGS
	);
	type SupportPayment = {
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
	let supportModalOpen = $state(false);
	let supportPayment = $state<SupportPayment>({
		qrValue: '',
		copyValue: '',
		copyLabel: 'Копировать',
		title: 'QR-код',
		hint: 'Скопируйте значение или сканируйте QR-код.',
		colorFrom: '#0b84ff',
		colorTo: '#087cf5',
		accent: '#55b7ff'
	});
	function openTelegramDonate() {
		if (!support.telegramWalletAddress) return;
		supportPayment = {
			qrValue: support.telegramWalletAddress,
			copyValue: support.telegramWalletAddress,
			copyLabel: 'Копировать адрес',
			title: 'Telegram',
			hint: 'Скопируйте этот адрес или сканируйте QR-код.',
			colorFrom: '#0b84ff',
			colorMid: '#2d9cff',
			colorEnd: '#087cf5',
			colorTo: '#2d9cff',
			accent: '#55b7ff',
			marqueeRepeat: 2,
			centerLogo: 'gram'
		};
		supportModalOpen = true;
	}
	function openCryptoDonate(wallet: (typeof support.wallets)[number]) {
		const palette = CRYPTO_NETWORK_COLORS[wallet.network];
		supportPayment = {
			qrValue: wallet.address,
			copyValue: wallet.address,
			copyLabel: 'Копировать адрес',
			title: CRYPTO_NETWORK_LABELS[wallet.network],
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
		supportModalOpen = true;
	}

	let serverNow = $state(untrack(() => new Date(data.serverNow).toISOString()));
	let clockSkew = 0;
	let pollTimer: ReturnType<typeof setInterval> | null = null;
	let portraitQuery: MediaQueryList | null = null;
	let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
	let chatText = $state('');
	let chatError = $state('');
	let showLinkHint = $state(false);
	let pendingLink = $state<string | null>(null);
	let attachMenuOpen = $state(false);
	let attachMenuEl = $state<HTMLDivElement | null>(null);
	let mentionMode = $state<'users' | 'illustrations' | 'donate' | null>(null);
	let mentionQuery = $state('');
	let mentionSource = $state<'typing' | 'button' | null>(null);
	let mentionTags = $state<string[]>([]);
	let inputMirrorEl = $state<HTMLDivElement | null>(null);
	let selectedIllustrationIds = $state<string[]>([]);
	let pendingIllustrations = $state<
		Array<{ id: string; imageUrl: string; caption: string | null; showAtSeconds: number }>
	>([]);
	function updateTabQuery(name: 'tab' | 'ltab', value: string) {
		if (typeof window === 'undefined') return;
		const url = new URL(page.url);
		url.searchParams.set(name, value);
		window.history.replaceState(window.history.state, '', url);
	}

	function closeChatOverlays() {
		attachMenuOpen = false;
		mentionMode = null;
		mentionSource = null;
		mentionQuery = '';
		selectedIllustrationIds = [];
	}

	function setMobileTab(tab: MobileTab) {
		closeChatOverlays();
		mobileTab = tab;
		updateTabQuery('tab', tab);
	}

	function collapseChat() {
		isChatCollapsed = true;
		document.body.classList.add('broadcast-chat-collapsed');
		closeChatOverlays();
		if (mobileTab === 'chat') setMobileTab('overview');
	}

	function showChat() {
		isChatCollapsed = false;
		document.body.classList.remove('broadcast-chat-collapsed');
		if (typeof window !== 'undefined' && window.innerWidth < 1024) {
			setMobileTab('chat');
			setLandscapeTab('chat');
		}
	}

	function handlePortraitOrientation(event: MediaQueryListEvent) {
		if (event.matches && isChatCollapsed) {
			isChatCollapsed = false;
			document.body.classList.remove('broadcast-chat-collapsed');
		}
	}

	function setLandscapeTab(tab: LandscapeTab) {
		closeChatOverlays();
		landscapeTab = tab;
		updateTabQuery('ltab', tab);
	}

	function openDonatePicker() {
		mentionMode = 'donate';
		mentionSource = 'button';
		mentionQuery = '';
		selectedIllustrationIds = [];
		attachMenuOpen = false;
	}

	let replyToMessage = $state<ChatMessage | null>(null);
	let pendingPreview = $state<{
		title: string | null;
		description: string | null;
		image: string | null;
	} | null>(null);
	let sending = $state(false);
	let timingIllustrations = $state(true);
	let chatByRecording = $state(false);
	let isLightboxOpen = $state(false);
	type MobileTab = 'overview' | 'illustrations' | 'chat' | 'info' | 'donate';
	type LandscapeTab = 'chat' | 'illustrations' | 'info' | 'donate';
	const MOBILE_TABS: MobileTab[] = ['overview', 'illustrations', 'chat', 'info', 'donate'];
	const LANDSCAPE_TABS: LandscapeTab[] = ['chat', 'illustrations', 'info', 'donate'];
	function normalizeMobileTab(value: string | null): MobileTab {
		return MOBILE_TABS.includes(value as MobileTab) ? (value as MobileTab) : 'overview';
	}
	function normalizeLandscapeTab(value: string | null): LandscapeTab {
		return LANDSCAPE_TABS.includes(value as LandscapeTab) ? (value as LandscapeTab) : 'chat';
	}
	const initialMobileTab = untrack(() => page.url.searchParams.get('tab'));
	const initialLandscapeTab = untrack(() => page.url.searchParams.get('ltab'));
	let mobileTab = $state<MobileTab>(normalizeMobileTab(initialMobileTab));
	let landscapeTab = $state<LandscapeTab>(
		initialLandscapeTab
			? normalizeLandscapeTab(initialLandscapeTab)
			: LANDSCAPE_TABS.includes(initialMobileTab as LandscapeTab)
				? (initialMobileTab as LandscapeTab)
				: 'chat'
	);
	let isExpanded = $state(false);
	const hasPlayer = $derived(audioStore.queue.length > 0);
	let isChatCollapsed = $state(false);
	let messagesEl = $state<HTMLDivElement | null>(null);
	let chatInputEl = $state<HTMLTextAreaElement | null>(null);
	let hasMoreMessages = $state(untrack(() => data.hasMoreMessages ?? false));
	let loadingOlder = $state(false);
	let highlightedMessageId = $state<string | null>(null);
	let savedChatForDownload = false;
	const downloads = useDownloads();
	const downloadKey = $derived(audioVersionKey(broadcast.chapterId, 'default'));

	const filteredParticipants = $derived(
		participants.filter((participant) =>
			participant.name.toLowerCase().includes(mentionQuery.trim().toLowerCase())
		)
	);
	const knownMentionNames = $derived([
		...new Set(
			[
				...participants.map((participant) => participant.name),
				...mentionTags,
				...messages.map((message) => message.name),
				data.user?.name
			].filter((name): name is string => Boolean(name))
		)
	]);
	const chatTextSegments = $derived(splitMentions(chatText, knownMentionNames));

	function splitMentions(text: string, names: string[]) {
		if (!text) return [{ text: '', mention: false }];
		const escaped = names
			.filter(Boolean)
			.sort((a, b) => b.length - a.length)
			.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
		if (!escaped.length) return [{ text, mention: false }];
		const pattern = new RegExp(`@(?:${escaped.join('|')})(?=\\s|$|[.,!?;:])`, 'gu');
		const parts: Array<{ text: string; mention: boolean }> = [];
		let last = 0;
		for (const match of text.matchAll(pattern)) {
			const index = match.index ?? 0;
			if (index > last) parts.push({ text: text.slice(last, index), mention: false });
			parts.push({ text: match[0], mention: true });
			last = index + match[0].length;
		}
		if (last < text.length) parts.push({ text: text.slice(last), mention: false });
		return parts;
	}

	function syncInputScroll() {
		if (chatInputEl && inputMirrorEl) inputMirrorEl.scrollTop = chatInputEl.scrollTop;
	}

	const currentTime = $derived(audioStore.currentTime);
	const isCurrentBroadcast = $derived(audioStore.currentTrack?.broadcastId === broadcast.id);
	const liveOffset = $derived.by(() => {
		void currentTime;
		void serverNow;
		if (!broadcast.startedAt) return 0;
		const expected = (Date.now() - clockSkew - new Date(broadcast.startedAt).getTime()) / 1000;
		return Math.max(0, Math.min(expected, broadcast.durationSeconds));
	});
	const pageTimelineTime = $derived.by(() => {
		if (kind === 'live') return liveOffset;
		if (isCurrentBroadcast) return currentTime;
		const requested = Number(page.url.searchParams.get('t') ?? 0);
		return Number.isFinite(requested) && requested > 0 ? requested : 0;
	});
	const canZoom = $derived(isCurrentBroadcast && audioStore.isPlaying);
	const currentImage = $derived(
		timingIllustrations
			? [...data.images].reverse().find((image) => image.showAtSeconds <= pageTimelineTime)
			: null
	);
	const visibleMessages = $derived(
		kind === 'live' || !chatByRecording
			? messages
			: messages.filter((message) => message.offsetSeconds <= pageTimelineTime)
	);
	let selectedImageId = $state<string | null>(null);
	const previewImage = $derived.by(() => {
		if (selectedImageId) {
			return data.images.find((image) => image.id === selectedImageId) ?? currentImage;
		}
		return currentImage ?? data.images[0] ?? null;
	});

	function isIllustrationRevealed(image: { showAtSeconds: number }) {
		return !timingIllustrations || image.showAtSeconds <= pageTimelineTime;
	}

	function selectImage(id: string) {
		selectedImageId = id;
	}

	let lastNewestMessageId: string | null = null;
	$effect(() => {
		const newestId = visibleMessages.at(-1)?.id ?? null;
		if (!messagesEl || newestId === lastNewestMessageId) return;
		lastNewestMessageId = newestId;
		requestAnimationFrame(() => {
			if (messagesEl) messagesEl.scrollTop = 0;
		});
	});

	$effect(() => {
		if (
			kind !== 'published' ||
			savedChatForDownload ||
			!downloads.isDownloaded(downloadKey) ||
			messages.length === 0
		)
			return;
		savedChatForDownload = true;
		void saveBroadcastChat({
			broadcastId: broadcast.id,
			chapterId: broadcast.chapterId,
			title: broadcast.title,
			bookTitle: broadcast.bookTitle,
			volumeTitle: broadcast.volumeTitle,
			coverUrl: broadcast.coverUrl,
			href: '/broadcasts/' + broadcast.id,
			messages
		});
	});

	$effect(() => {
		if (
			kind === 'published' &&
			isCurrentBroadcast &&
			(audioStore.currentTrack?.broadcastLive === true ||
				audioStore.currentTrack?.broadcastTitle !== broadcast.title ||
				audioStore.currentTrack?.id !== broadcast.chapterId)
		) {
			audioStore.updateTrackMetadata({
				id: broadcast.chapterId,
				broadcastLive: false,
				bookId: broadcast.bookId,
				volumeId: broadcast.volumeId,
				versionId: 'default',
				broadcastHref: '/broadcasts/' + broadcast.id,
				broadcastTitle: broadcast.title,
				broadcastBookTitle: broadcast.bookTitle,
				broadcastVolumeTitle: broadcast.volumeTitle,
				broadcastCoverUrl: broadcast.coverUrl
			});
		}
	});

	const newestMessages = $derived([...visibleMessages].reverse());

	async function loadOlderMessages() {
		if (!hasMoreMessages || loadingOlder || messages.length === 0) return;
		loadingOlder = true;
		try {
			const oldest = messages[0]?.createdAt;
			const before = oldest ? new Date(oldest).toISOString() : '';
			const res = await fetch(
				'/api/broadcasts/' + broadcast.id + '/messages?before=' + encodeURIComponent(before),
				{ cache: 'no-store' }
			);
			if (!res.ok) return;
			const payload = await res.json();
			const older = Array.isArray(payload.messages) ? payload.messages : [];
			hasMoreMessages = Boolean(payload.hasMore);
			if (older.length) messages = [...older, ...messages];
		} finally {
			loadingOlder = false;
		}
	}

	const currentUserId = $derived(data.user?.id ?? null);
	const MAX_CHAT = 500;
	const ALLOWED_LINK_HOSTS = [
		't.me',
		'telegram.me',
		'telegram.org',
		'boosty.to',
		'discord.gg',
		'discord.com',
		'hedgehog-inc.one',
		'hedgehog-inc.ru'
	];

	function linkFromText(text: string): string | null {
		return text.match(/https?:\/\/[^\s<>"']+/i)?.[0] ?? null;
	}

	function isAllowedLink(raw: string): boolean {
		try {
			const url = new URL(raw);
			const host = url.hostname.toLowerCase();
			const hosts =
				typeof window === 'undefined'
					? ALLOWED_LINK_HOSTS
					: [...ALLOWED_LINK_HOSTS, window.location.hostname.toLowerCase()];
			return hosts.some((allowed) => host === allowed || host.endsWith('.' + allowed));
		} catch {
			return false;
		}
	}

	function linkLabel(raw: string): { host: string; path: string } {
		try {
			const url = new URL(raw);
			return {
				host: url.hostname.replace(/^www\./, ''),
				path: url.pathname === '/' ? '' : url.pathname
			};
		} catch {
			return { host: raw, path: '' };
		}
	}

	function displayBody(body: string): string {
		const messageBody = body || 'Иллюстрации';
		const link = linkFromText(messageBody);
		return link ? body.replace(link, '').trim() : body;
	}

	function reactionOptions(message: ChatMessage): string[] {
		const order = ['👍', '❤️', '🔥', '😂'];
		return [...order].sort((a, b) => (message.reactions?.[b] ?? 0) - (message.reactions?.[a] ?? 0));
	}

	async function setReplyTo(message: ChatMessage) {
		replyToMessage = message;
		clearChatError();
		await tick();
		chatInputEl?.focus();
	}

	function clearReplyTo() {
		replyToMessage = null;
		clearChatError();
	}

	async function loadPendingPreview(link: string) {
		pendingPreview = null;
		try {
			const res = await fetch('/api/link-preview', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ url: link })
			});
			if (!res.ok || pendingLink !== link) return;
			const payload = await res.json();
			if (pendingLink === link && payload.preview) pendingPreview = payload.preview;
		} catch {
			// The preview is optional; the link itself still works.
		}
	}

	function handleChatScroll(event: Event) {
		const el = event.currentTarget as HTMLDivElement;
		if (!hasMoreMessages || loadingOlder) return;
		if (el.scrollTop < -(el.scrollHeight - el.clientHeight - 120)) {
			void loadOlderMessages();
		}
	}

	async function scrollToMessage(messageId: string | null) {
		if (!messageId) return;
		const find = () => document.getElementById('broadcast-message-' + messageId);
		let element = find();
		let attempts = 0;
		while (!element && hasMoreMessages && attempts < 5) {
			await loadOlderMessages();
			await tick();
			element = find();
			attempts++;
		}
		if (!element) return;
		highlightedMessageId = messageId;
		element.scrollIntoView({ behavior: 'smooth', block: 'center' });
		setTimeout(() => {
			if (highlightedMessageId === messageId) highlightedMessageId = null;
		}, 1800);
	}

	function clearChatError() {
		chatError = '';
		showLinkHint = false;
	}

	function attachPastedLink(event: ClipboardEvent) {
		const pasted = event.clipboardData?.getData('text') ?? '';
		const link = linkFromText(pasted);
		if (!link) return;
		event.preventDefault();
		if (!isAllowedLink(link)) {
			chatError = '';
			showLinkHint = true;
			return;
		}
		pendingLink = link;
		pendingPreview = null;
		chatText = pasted.replace(link, '').trim();
		clearChatError();
		void loadPendingPreview(link);
	}

	function removePendingLink() {
		pendingLink = null;
		pendingPreview = null;
		clearChatError();
	}

	function updateMentionState() {
		const input = chatInputEl;
		if (!input) return;
		const before = chatText.slice(0, input.selectionStart ?? chatText.length);
		const match = before.match(/(?:^|\s)@([^\s@]*)$/);
		if (match) {
			mentionMode = 'users';
			mentionSource = 'typing';
			mentionQuery = match[1] ?? '';
			attachMenuOpen = false;
		} else if (mentionSource === 'typing') {
			mentionMode = null;
			mentionSource = null;
			mentionQuery = '';
		}
	}

	async function insertUserMention(name: string) {
		const input = chatInputEl;
		const cursor = input?.selectionStart ?? chatText.length;
		const before = chatText.slice(0, cursor);
		const at = before.lastIndexOf('@');
		const next =
			at >= 0
				? before.slice(0, at) + '@' + name + ' ' + chatText.slice(cursor)
				: chatText + (chatText && !chatText.endsWith(' ') ? ' ' : '') + '@' + name + ' ';
		chatText = next.slice(0, MAX_CHAT);
		if (!mentionTags.includes(name)) mentionTags = [...mentionTags, name];
		mentionMode = null;
		mentionSource = null;
		mentionQuery = '';
		await tick();
		input?.focus();
		input?.setSelectionRange(chatText.length, chatText.length);
	}

	function removeMentionTag(direction: 'backspace' | 'delete'): boolean {
		const input = chatInputEl;
		if (!input || !mentionTags.length) return false;
		if (input.selectionStart !== input.selectionEnd) return false;
		const cursor = input.selectionStart ?? chatText.length;
		const before = chatText.slice(0, cursor);
		const after = chatText.slice(cursor);
		for (const name of [...mentionTags].sort((a, b) => b.length - a.length)) {
			const tag = '@' + name;
			if (direction === 'backspace') {
				const withSpace = before.endsWith(tag + ' ');
				if (!withSpace && !before.endsWith(tag)) continue;
				const removed = withSpace ? tag.length + 1 : tag.length;
				const start = cursor - removed;
				chatText = chatText.slice(0, start) + after;
				mentionTags = mentionTags.filter((item) => item !== name);
				void tick().then(() => {
					chatInputEl?.focus();
					chatInputEl?.setSelectionRange(start, start);
					updateMentionState();
				});
				return true;
			}
			const withSpace = after.startsWith(tag + ' ');
			if (!withSpace && !after.startsWith(tag)) continue;
			const removed = withSpace ? tag.length + 1 : tag.length;
			chatText = before + after.slice(removed);
			mentionTags = mentionTags.filter((item) => item !== name);
			void tick().then(() => {
				chatInputEl?.focus();
				chatInputEl?.setSelectionRange(cursor, cursor);
				updateMentionState();
			});
			return true;
		}
		return false;
	}

	async function openUserPicker(source: 'typing' | 'button') {
		mentionMode = 'users';
		mentionSource = source;
		mentionQuery = '';
		attachMenuOpen = false;
		await tick();
		chatInputEl?.focus();
	}

	function openIllustrationPicker() {
		mentionMode = 'illustrations';
		mentionSource = 'button';
		mentionQuery = '';
		selectedIllustrationIds = [];
		attachMenuOpen = false;
	}

	function toggleIllustrationTag(id: string) {
		selectedIllustrationIds = selectedIllustrationIds.includes(id)
			? selectedIllustrationIds.filter((item) => item !== id)
			: [...selectedIllustrationIds, id];
	}

	function cancelIllustrationPicker() {
		mentionMode = null;
		mentionSource = null;
		selectedIllustrationIds = [];
		void tick().then(() => chatInputEl?.focus());
	}

	function confirmIllustrationTags() {
		pendingIllustrations = data.images.filter((image) =>
			selectedIllustrationIds.includes(image.id)
		);
		mentionMode = null;
		mentionSource = null;
		selectedIllustrationIds = [];
		void tick().then(() => chatInputEl?.focus());
	}

	function removePendingIllustration(id: string) {
		pendingIllustrations = pendingIllustrations.filter((image) => image.id !== id);
	}

	function handleChatKeydown(event: KeyboardEvent) {
		if (event.key === 'Backspace' && removeMentionTag('backspace')) {
			event.preventDefault();
			return;
		}
		if (event.key === 'Delete' && removeMentionTag('delete')) {
			event.preventDefault();
			return;
		}
		if (mentionMode) {
			event.preventDefault();
			return;
		}
		if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
		event.preventDefault();
		(event.currentTarget as HTMLTextAreaElement).closest('form')?.requestSubmit();
	}

	function handleChatInput() {
		clearChatError();
		updateMentionState();
		if (pendingLink) return;
		const link = linkFromText(chatText);
		if (!link || link !== chatText.trim()) return;
		if (isAllowedLink(link)) {
			pendingLink = link;
			pendingPreview = null;
			chatText = '';
			void loadPendingPreview(link);
		} else {
			chatError = '';
			showLinkHint = true;
		}
	}

	function formatDuration(seconds: number): string {
		if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		const s = Math.floor(seconds % 60);
		return h > 0
			? h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0')
			: m + ':' + String(s).padStart(2, '0');
	}

	function updateClock(server: string) {
		serverNow = server;
		clockSkew = Date.now() - new Date(server).getTime();
	}

	function startListening() {
		const requested = Number(page.url.searchParams.get('t') ?? 0);
		const savedOffset = replayResumeOffset(data.savedProgress, broadcast.durationSeconds);
		const offset =
			kind === 'live'
				? liveOffset
				: Number.isFinite(requested) && requested > 0
					? Math.min(requested, broadcast.durationSeconds)
					: savedOffset;
		audioStore.setQueueAndPlay(
			[
				{
					id: broadcast.chapterId,
					url: broadcast.audioUrl,
					title: broadcast.title,
					album: broadcast.chapterTitle,
					artist: broadcast.bookTitle,
					bookId: broadcast.bookId,
					volumeId: broadcast.volumeId,
					versionId: 'default',
					duration: broadcast.durationSeconds,
					startTime: offset > 0 ? offset : kind === 'live' ? 0.001 : undefined,
					broadcastId: broadcast.id,
					broadcastHref: '/broadcasts/' + broadcast.id,
					broadcastTitle: broadcast.title,
					broadcastBookTitle: broadcast.bookTitle,
					broadcastVolumeTitle: broadcast.volumeTitle,
					broadcastCoverUrl: broadcast.coverUrl,
					broadcastLive: kind === 'live',
					broadcastStartedAt: broadcast.startedAt
						? new Date(broadcast.startedAt).getTime()
						: undefined,
					illustrationTimes: data.images.map((image) => image.showAtSeconds),
					illustrations: data.images.map((image) => ({
						id: image.id,
						imageUrl: image.imageUrl,
						showAtSeconds: image.showAtSeconds
					})),
					artwork: broadcast.coverUrl ?? data.images[0]?.imageUrl ?? '/logo.webp'
				}
			],
			0
		);
		void fetch('/api/broadcasts/' + broadcast.id + '/view', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ kind: kind === 'published' ? 'replay' : 'live' })
		});
	}

	async function poll() {
		try {
			const after = messages.length
				? '?after=' +
					encodeURIComponent(
						new Date(messages[messages.length - 1]?.createdAt ?? Date.now()).toISOString()
					)
				: '';
			const res = await fetch('/api/broadcasts/' + broadcast.id + '/state' + after, {
				cache: 'no-store'
			});
			if (!res.ok) return;
			const payload = await res.json();
			updateClock(payload.serverNow);
			broadcast = payload.broadcast;
			kind = payload.broadcast.kind;
			listeners = payload.listeners;
			participants = Array.isArray(payload.participants) ? payload.participants : participants;
			if (Array.isArray(payload.messages) && payload.messages.length) {
				const incoming = new Map<string, ChatMessage>(
					payload.messages.map((message: ChatMessage) => [message.id, message])
				);
				const known = new Set(messages.map((message) => message.id));
				messages = messages.map((message) => incoming.get(message.id) ?? message);
				messages = [
					...messages,
					...payload.messages.filter((message: ChatMessage) => !known.has(message.id))
				];
			}
			if (kind === 'live' && isCurrentBroadcast && audioStore.isPlaying) {
				const drift = currentTime - liveOffset;
				if (Math.abs(drift) > 5) audioStore.seek(liveOffset, false);
			}
		} catch {
			// Polling is best-effort.
		}
	}

	async function heartbeat() {
		try {
			const res = await fetch('/api/broadcasts/' + broadcast.id + '/heartbeat', { method: 'POST' });
			if (res.ok) {
				const payload = await res.json();
				listeners = payload.listeners;
				participants = Array.isArray(payload.participants) ? payload.participants : participants;
				updateClock(payload.serverNow);
			}
		} catch {
			// Ignore transient network errors.
		}
	}

	async function sendMessage(event: SubmitEvent) {
		event.preventDefault();
		clearChatError();
		const text = chatText.trim();
		const body = [text, pendingLink].filter(Boolean).join(' ').trim();
		if (!body && pendingIllustrations.length === 0) {
			chatError = 'Введите сообщение';
			return;
		}
		if ([...body].length > MAX_CHAT) {
			chatError = 'Сообщение слишком длинное: максимум 500 символов';
			return;
		}
		const messageBody = body || 'Иллюстрации';
		const link = linkFromText(messageBody);
		if (link && !isAllowedLink(link)) {
			chatError = '';
			showLinkHint = true;
			return;
		}
		if (sending) return;
		sending = true;
		try {
			const res = await fetch('/api/broadcasts/' + broadcast.id + '/messages', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					body: messageBody,
					replyToId: replyToMessage?.id ?? null,
					illustrationIds: pendingIllustrations.map((image) => image.id)
				})
			});
			const payload = await res.json().catch(() => ({}));
			if (!res.ok) {
				chatError = payload?.message ?? 'Не удалось отправить сообщение';
				showLinkHint = false;
				return;
			}
			messages = [...messages, payload.message];
			chatText = '';
			mentionTags = [];
			pendingIllustrations = [];
			mentionMode = null;
			mentionQuery = '';
			pendingLink = null;
			replyToMessage = null;
			pendingPreview = null;
		} catch {
			chatError = 'Не удалось отправить сообщение';
		} finally {
			sending = false;
		}
	}

	async function react(messageId: string, emoji: string) {
		try {
			const res = await fetch('/api/broadcasts/' + broadcast.id + '/reactions', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ messageId, emoji })
			});
			if (!res.ok) return;
			const payload = await res.json();
			messages = messages.map((message) =>
				message.id === messageId
					? {
							...message,
							reactions: payload.reactions ?? {},
							myReaction: payload.myReaction ?? null
						}
					: message
			);
		} catch {
			// The next poll restores reaction state.
		}
	}

	function handleExpandedKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && isExpanded) {
			isExpanded = false;
			document.body.classList.remove('broadcast-expanded');
			document.body.classList.remove('broadcast-page');
			document.body.classList.remove('broadcast-chat-collapsed');
		}
	}

	function toggleExpanded() {
		isExpanded = !isExpanded;
		document.body.classList.toggle('broadcast-expanded', isExpanded);
	}

	function handleAttachOutside(event: PointerEvent) {
		if (!attachMenuOpen) return;
		if (attachMenuEl && !attachMenuEl.contains(event.target as Node)) attachMenuOpen = false;
	}

	onMount(() => {
		const previousOverflow = document.body.style.overflow;
		document.addEventListener('pointerdown', handleAttachOutside);
		portraitQuery = window.matchMedia('(max-width: 1023px) and (orientation: portrait)');
		portraitQuery.addEventListener('change', handlePortraitOrientation);
		document.body.style.overflow = 'hidden';
		document.body.classList.add('broadcast-page');
		updateClock(serverNow);
		if (data.canWatch && (kind === 'live' || kind === 'published')) {
			void fetch('/api/broadcasts/' + broadcast.id + '/view', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ kind: kind === 'published' ? 'replay' : 'live' })
			});
		}
		if (data.canWatch) {
			pollTimer = setInterval(poll, 2000);
			heartbeatTimer = setInterval(() => {
				if (kind === 'live' && data.canWatch) void heartbeat();
			}, 10000);
			if (kind === 'live') void heartbeat();
		}
		return () => {
			document.removeEventListener('pointerdown', handleAttachOutside);
			window
				.matchMedia('(max-width: 1023px) and (orientation: portrait)')
				.removeEventListener('change', handlePortraitOrientation);
			document.body.style.overflow = previousOverflow;
			document.body.classList.remove('broadcast-expanded');
			document.body.classList.remove('broadcast-page');
			document.body.classList.remove('broadcast-chat-collapsed');
			if (pollTimer) clearInterval(pollTimer);
			if (heartbeatTimer) clearInterval(heartbeatTimer);
		};
	});

	onDestroy(() => {
		if (pollTimer) clearInterval(pollTimer);
		if (heartbeatTimer) clearInterval(heartbeatTimer);
	});
</script>

<svelte:window onkeydown={handleExpandedKeydown} />

<svelte:head>
	<title>{broadcast.title} — Трансляция — Hedgehog X</title>
	<meta name="description" content={broadcast.description ?? 'Прямая трансляция HEDGEHOG.INC'} />
	<meta property="og:type" content="website" />
	<meta property="og:title" content={broadcast.title + ' — Hedgehog X'} />
	<meta
		property="og:description"
		content={broadcast.description ?? 'Прямая трансляция HEDGEHOG.INC'}
	/>
	<meta
		property="og:image"
		content={new URL(broadcast.coverUrl ?? '/logo.webp', page.url.origin).href}
	/>
	<meta property="og:url" content={page.url.href} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={broadcast.title + ' — Hedgehog X'} />
	<meta
		name="twitter:image"
		content={new URL(broadcast.coverUrl ?? '/logo.webp', page.url.origin).href}
	/>
</svelte:head>

<div
	class="relative overflow-hidden bg-black {isExpanded
		? 'h-[calc(100dvh-3.625rem)] max-lg:landscape:h-dvh'
		: hasPlayer
			? 'h-[calc(100dvh-7.125rem)] lg:h-[calc(100dvh-3.625rem)] max-lg:landscape:h-[calc(100dvh-4rem)]'
			: 'h-[calc(100dvh-3.625rem)] lg:h-dvh max-lg:landscape:h-dvh'}"
>
	<BlurhashImage
		src={null}
		alt=""
		blurhash={broadcast.coverBlurhash ?? broadcast.volumeBlurhash}
		class="pointer-events-none absolute inset-0 h-full w-full scale-110 opacity-55 blur-2xl"
	/>
	<div class="pointer-events-none absolute inset-0 bg-black/35"></div>

	{#if !data.isAuthenticated}
		<div class="relative z-10 flex h-full items-center justify-center p-6">
			<div
				class="w-full max-w-md rounded-2xl border border-primary/20 bg-card/95 p-8 text-center shadow-xl"
			>
				<Radio class="mx-auto h-10 w-10 text-primary" />
				<h1 class="mt-3 text-xl font-bold">Трансляция доступна после входа</h1>
				<p class="mt-2 text-sm text-muted-foreground">
					Войдите в аккаунт и оформите подписку, чтобы слушать эфир и писать в чат.
				</p>
				<Button
					class="mt-4"
					href={resolve('/auth') + '?from=' + encodeURIComponent('/broadcasts/' + broadcast.id)}
					>Войти</Button
				>
			</div>
		</div>
	{:else if !data.canWatch}
		<div class="relative z-10 flex h-full items-center justify-center p-6">
			<div
				class="w-full max-w-md rounded-2xl border border-primary/20 bg-card/95 p-8 text-center shadow-xl"
			>
				<Heart class="mx-auto h-10 w-10 text-primary" />
				<h1 class="mt-3 text-xl font-bold">Нужна активная подписка</h1>
				<p class="mt-2 text-sm text-muted-foreground">
					Трансляции и записи доступны подписчикам HEDGEHOG.INC.
				</p>
				<Button class="mt-4" href={resolve('/subscription')}>Оформить подписку</Button>
			</div>
		</div>
	{:else if kind === 'scheduled'}
		<div class="relative z-10 flex h-full items-center justify-center p-6">
			<div
				class="w-full max-w-md rounded-2xl border border-sky-500/30 bg-card/95 p-8 text-center shadow-xl"
			>
				<Clock class="mx-auto h-10 w-10 text-sky-500" />
				<h1 class="mt-3 text-xl font-bold">{broadcast.title}</h1>
				<p class="mt-2 text-sm text-muted-foreground">
					{new Date(broadcast.scheduledStartAt).toLocaleString('ru-RU')}
				</p>
			</div>
		</div>
	{:else}
		{#snippet donationMethods()}
			<div class="space-y-3">
				{#if support.telegramWalletEnabled && support.telegramWalletAddress}
					<button
						type="button"
						class="block w-full text-left transition hover:brightness-105"
						onclick={openTelegramDonate}
						aria-label="Открыть Telegram"
					>
						<TelegramWalletCard />
					</button>
				{/if}
				{#each support.wallets.filter((wallet) => wallet.enabled && wallet.address) as wallet (wallet.network + wallet.address)}
					<button
						type="button"
						class="block w-full text-left transition hover:brightness-105"
						onclick={() => openCryptoDonate(wallet)}
						aria-label="Открыть QR-код кошелька"
					>
						<CryptoWalletCard {wallet} />
					</button>
				{/each}
				{#if !(support.telegramWalletEnabled && support.telegramWalletAddress) && support.wallets.filter((wallet) => wallet.enabled && wallet.address).length === 0}
					<p class="py-6 text-center text-xs text-muted-foreground">Реквизиты скоро появятся.</p>
				{/if}
			</div>
		{/snippet}
		{#if isChatCollapsed}
			<button
				type="button"
				class="absolute top-14 right-2 z-50 hidden h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-card/95 text-foreground shadow-xl backdrop-blur-md transition hover:bg-muted lg:top-16 lg:right-3 lg:flex landscape:flex"
				onclick={showChat}
				aria-label="Открыть чат"><MessageCircle class="h-5 w-5" /></button
			>
		{/if}
		<div
			class="absolute inset-x-2 top-2 z-40 hidden items-center gap-0.5 rounded-xl border border-white/15 bg-black/55 p-1 text-white backdrop-blur-md lg:hidden portrait:flex landscape:hidden"
		>
			{#each [['overview', 'Обзор', ImageIcon], ['illustrations', 'Иллюстрации', ImageIcon], ['chat', 'Чат', MessageCircle], ['info', 'Инфо', Info], ['donate', 'Донат', Coins]] as const as [key, label, Icon] (key)}
				<button
					type="button"
					class="flex flex-1 items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-[8px] font-semibold transition {mobileTab ===
					key
						? 'bg-white/20'
						: 'text-white/70 hover:bg-white/10'}"
					onclick={() => setMobileTab(key)}
					aria-label={label}><Icon class="h-3 w-3 shrink-0" /> {label}</button
				>
			{/each}
			<button
				type="button"
				class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/80 transition hover:bg-white/15"
				onclick={toggleExpanded}
				aria-label={isExpanded ? 'Выйти из полноэкранного режима' : 'На весь экран'}
				>{#if isExpanded}<Minimize2 class="h-4 w-4" />{:else}<Maximize2
						class="h-4 w-4"
					/>{/if}</button
			>
		</div>
		<div
			class="relative z-10 flex h-full min-h-0 flex-col gap-2 p-2 pt-14 sm:gap-3 sm:p-3 lg:flex-row lg:pr-3 landscape:flex-row landscape:pt-2"
		>
			<div
				class="relative flex min-h-0 w-full shrink-0 basis-[38%] flex-col lg:block lg:flex-1 lg:basis-auto landscape:flex-1 landscape:basis-auto {mobileTab !==
				'overview'
					? 'max-lg:portrait:hidden'
					: 'max-lg:portrait:flex-1 max-lg:portrait:basis-auto'}"
			>
				<div
					class="absolute top-3 left-3 z-30 hidden items-center gap-1 rounded-full border border-white/20 bg-black/45 px-2 py-1 text-[10px] text-white backdrop-blur-md lg:flex"
				>
					<ImageIcon class="h-3 w-3" /> Тайминг
					<Switch
						checked={timingIllustrations}
						onCheckedChange={(checked) => {
							timingIllustrations = checked;
							if (checked) selectedImageId = null;
						}}
						aria-label="Иллюстрации по таймингу"
					/>
				</div>
				<button
					type="button"
					class="absolute top-3 right-3 z-30 hidden h-8 w-8 items-center justify-center rounded-lg border border-white/20 bg-black/45 text-white backdrop-blur-md transition hover:bg-black/65 lg:flex"
					onclick={toggleExpanded}
					aria-label={isExpanded ? 'Выйти из полноэкранного режима' : 'На весь экран'}
					>{#if isExpanded}<Minimize2 class="h-4 w-4" />{:else}<Maximize2
							class="h-4 w-4"
						/>{/if}</button
				>
				<div
					class="absolute inset-0 flex items-center justify-center p-2 {audioStore.queue.length > 0
						? 'max-lg:landscape:pb-20'
						: ''} {timingIllustrations ? 'pb-2 lg:pb-8' : 'pb-2 lg:pb-32'}"
				>
					<div class="relative flex h-full w-full items-center justify-center">
						{#if previewImage}
							<button
								type="button"
								class="group relative flex h-full w-full items-center justify-center overflow-hidden rounded-2xl shadow-[0_20px_80px_rgba(0,0,0,0.55)] {canZoom
									? 'cursor-zoom-in'
									: 'cursor-default'}"
								onclick={() => {
									if (canZoom && isIllustrationRevealed(previewImage)) isLightboxOpen = true;
								}}
								aria-disabled={!canZoom}
								aria-label="Открыть изображение"
							>
								<img
									src={previewImage.imageUrl}
									alt={previewImage.caption ?? broadcast.title}
									class="h-auto max-h-full w-auto max-w-full rounded-2xl object-contain {timingIllustrations &&
									previewImage.showAtSeconds > pageTimelineTime
										? 'scale-105 blur-2xl'
										: ''}"
								/>
								{#if canZoom}<span
										class="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/0 opacity-0 transition group-hover:bg-black/25 group-hover:opacity-100"
										><span
											class="flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-md"
											><ZoomIn class="h-3.5 w-3.5" /> Увеличить</span
										></span
									>{/if}
							</button>
						{/if}
						{#if !isCurrentBroadcast || !audioStore.isPlaying}
							<button
								type="button"
								class="absolute top-1/2 left-1/2 z-20 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/45 text-white shadow-2xl backdrop-blur-md transition hover:scale-105 hover:bg-black/60 sm:h-20 sm:w-20"
								onclick={startListening}
								aria-label="Слушать эфир"
							>
								<Play class="ml-1 h-6 w-6 fill-current sm:h-8 sm:w-8" />
							</button>
						{/if}
					</div>
				</div>
				{#if !timingIllustrations && data.images.length > 0}
					<div class="absolute inset-x-4 bottom-2 z-20 max-lg:hidden">
						<div class="no-scrollbar flex gap-2 overflow-x-auto pb-1">
							{#each data.images as image (image.id)}
								<button
									type="button"
									class="shrink-0 overflow-hidden rounded-lg border-2 transition {previewImage?.id ===
									image.id
										? 'border-primary'
										: 'border-white/20 hover:border-white/50'}"
									onclick={() => selectImage(image.id)}
									aria-label={image.caption ?? 'Иллюстрация'}
								>
									<img
										src={image.imageUrl}
										alt={image.caption ?? ''}
										class="h-16 w-24 object-cover sm:h-20 sm:w-32"
										loading="lazy"
									/>
								</button>
							{/each}
						</div>
					</div>
				{/if}
			</div>

			{#if mobileTab === 'illustrations'}
				<div
					class="flex min-h-0 w-full flex-1 flex-col overflow-y-auto rounded-2xl border border-border/50 bg-card/90 p-3 shadow-xl backdrop-blur-xl lg:hidden landscape:hidden"
				>
					<label
						class="mb-3 flex items-center justify-between gap-2 rounded-xl border border-border/50 bg-muted/30 px-3 py-2 text-xs"
					>
						<span class="flex items-center gap-1"><ImageIcon class="h-3 w-3" /> Тайминг</span>
						<Switch
							checked={timingIllustrations}
							onCheckedChange={(checked) => {
								timingIllustrations = checked;
								if (checked) selectedImageId = null;
							}}
							aria-label="Иллюстрации по таймингу"
						/>
					</label>
					<div class="grid grid-cols-2 gap-2">
						{#each data.images as image (image.id)}
							<button
								type="button"
								class="overflow-hidden rounded-xl border border-border/50 bg-muted/30 text-left transition hover:border-primary/50 disabled:cursor-default"
								disabled={!isIllustrationRevealed(image)}
								onclick={() => {
									if (!isIllustrationRevealed(image)) return;
									selectImage(image.id);
									isLightboxOpen = true;
								}}
							>
								<img
									src={image.imageUrl}
									alt={image.caption ?? ''}
									class="aspect-[4/3] w-full object-cover transition {timingIllustrations &&
									image.showAtSeconds > pageTimelineTime
										? 'scale-105 blur-xl'
										: ''}"
									loading="lazy"
								/>
								{#if image.caption}<span
										class="block truncate px-2 py-1 text-[9px] text-muted-foreground {timingIllustrations &&
										image.showAtSeconds > pageTimelineTime
											? 'blur-[5px]'
											: ''}">{image.caption}</span
									>{/if}
							</button>
						{/each}
					</div>
				</div>
			{/if}

			{#if mobileTab === 'donate'}
				<div
					class="flex min-h-0 w-full flex-1 flex-col overflow-y-auto rounded-2xl border border-border/50 bg-card/90 p-4 shadow-xl backdrop-blur-xl lg:hidden landscape:hidden"
				></div>
			{/if}

			<aside
				class="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-2xl border border-border/50 bg-card/90 {isChatCollapsed
					? 'hidden'
					: ''} shadow-[0_18px_70px_rgba(0,0,0,0.45)] backdrop-blur-xl lg:w-[420px] lg:flex-none max-lg:landscape:w-[48%] max-lg:landscape:flex-none {mobileTab ===
					'overview' ||
				mobileTab === 'illustrations' ||
				mobileTab === 'donate'
					? 'max-lg:portrait:hidden'
					: ''}"
			>
				<div
					class="hidden shrink-0 items-center gap-0.5 border-b border-border/40 bg-card/95 p-1 max-lg:landscape:flex"
				>
					<button
						type="button"
						class="flex flex-1 items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-[8px] font-semibold transition {landscapeTab ===
						'chat'
							? 'bg-muted text-foreground'
							: 'text-muted-foreground hover:bg-muted/50'}"
						onclick={() => setLandscapeTab('chat')}
						><MessageCircle class="h-3.5 w-3.5" /> Чат</button
					>
					<button
						type="button"
						class="flex flex-1 items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-[8px] font-semibold transition {landscapeTab ===
						'info'
							? 'bg-muted text-foreground'
							: 'text-muted-foreground hover:bg-muted/50'}"
						onclick={() => setLandscapeTab('info')}><Info class="h-3.5 w-3.5" /> Инфо</button
					>
					<button
						type="button"
						class="flex flex-1 items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-[8px] font-semibold transition {landscapeTab ===
						'illustrations'
							? 'bg-muted text-foreground'
							: 'text-muted-foreground hover:bg-muted/50'}"
						onclick={() => setLandscapeTab('illustrations')}
						><ImageIcon class="h-3 w-3" /> Иллюстр.</button
					>
					<button
						type="button"
						class="flex flex-1 items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-[8px] font-semibold transition {landscapeTab ===
						'donate'
							? 'bg-muted text-foreground'
							: 'text-muted-foreground hover:bg-muted/50'}"
						onclick={() => setLandscapeTab('donate')}><Coins class="h-3 w-3" /> Донат</button
					>
					<button
						type="button"
						class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
						onclick={toggleExpanded}
						aria-label={isExpanded ? 'Выйти из полноэкранного режима' : 'На весь экран'}
						>{#if isExpanded}<Minimize2 class="h-3.5 w-3.5" />{:else}<Maximize2
								class="h-3.5 w-3.5"
							/>{/if}</button
					>
					<button
						type="button"
						class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
						onclick={collapseChat}
						aria-label="Закрыть чат"><X class="h-3.5 w-3.5" /></button
					>
				</div>
				{#if landscapeTab === 'illustrations'}
					<div class="hidden min-h-0 flex-1 flex-col overflow-y-auto p-3 max-lg:landscape:flex">
						<label
							class="mb-3 flex items-center justify-between gap-2 rounded-xl border border-border/50 bg-muted/30 px-3 py-2 text-xs"
						>
							<span class="flex items-center gap-1"><ImageIcon class="h-3 w-3" /> Тайминг</span>
							<Switch
								checked={timingIllustrations}
								onCheckedChange={(checked) => {
									timingIllustrations = checked;
									if (checked) selectedImageId = null;
								}}
								aria-label="Иллюстрации по таймингу"
							/>
						</label>

						<div class="grid grid-cols-2 gap-2">
							{#each data.images as image (image.id)}
								<button
									type="button"
									class="overflow-hidden rounded-lg border border-border/50 bg-muted/30 text-left transition hover:border-primary/50 disabled:cursor-default"
									disabled={!isIllustrationRevealed(image)}
									onclick={() => {
										if (!isIllustrationRevealed(image)) return;
										selectImage(image.id);
										isLightboxOpen = true;
									}}
									><img
										src={image.imageUrl}
										alt={image.caption ?? ''}
										class="aspect-[4/3] w-full object-cover transition {timingIllustrations &&
										image.showAtSeconds > pageTimelineTime
											? 'scale-105 blur-xl'
											: ''}"
										loading="lazy"
									/></button
								>
							{/each}
						</div>
					</div>
				{:else if landscapeTab === 'donate'}
					<div
						class="hidden min-h-0 flex-1 flex-col overflow-y-auto p-3 max-lg:landscape:flex"
					></div>
				{/if}
				<div
					class="hidden min-h-0 flex-1 flex-col overflow-y-auto p-4 lg:hidden {mobileTab === 'info'
						? 'max-lg:portrait:flex'
						: 'max-lg:portrait:hidden'} {landscapeTab === 'info'
						? 'max-lg:landscape:flex'
						: 'max-lg:landscape:hidden'}"
				>
					<h2 class="text-sm font-bold">Информация</h2>
					<div class="mt-3 grid grid-cols-2 gap-2">
						<div class="rounded-xl border border-border/50 bg-muted/30 p-3">
							<p class="text-[9px] font-semibold tracking-wide text-muted-foreground uppercase">
								Статус
							</p>
							<p class="mt-1 flex items-center gap-1 text-sm font-bold">
								{#if kind === 'live'}<span class="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500"
									></span> LIVE{:else}ЗАПИСЬ{/if}
							</p>
						</div>
						<div class="rounded-xl border border-border/50 bg-muted/30 p-3">
							<p class="text-[9px] font-semibold tracking-wide text-muted-foreground uppercase">
								{kind === 'live' ? 'Сейчас слушают' : 'Слушало'}
							</p>
							<p class="mt-1 text-sm font-bold">
								{kind === 'live' ? listeners : data.viewersCount}
							</p>
						</div>
					</div>
					{#if kind === 'published'}
						<label
							class="mt-3 flex items-center justify-between gap-2 rounded-xl border border-border/50 bg-muted/30 px-3 py-2 text-xs"
						>
							<span>Чат по записи</span>
							<Switch bind:checked={chatByRecording} aria-label="Чат по записи" />
						</label>
					{/if}
					<div class="mt-4 flex items-center justify-between gap-2">
						<h3 class="text-xs font-bold">{kind === 'live' ? 'На трансляции' : 'Слушали'}</h3>
						<span
							class="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground"
							>{participants.length}</span
						>
					</div>
					<div class="mt-2 space-y-1">
						{#each participants as participant (participant.id)}
							<div class="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/40">
								<span
									class="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-bold"
									>{participant.name.charAt(0).toUpperCase()}{#if participant.image}<img
											src={participant.image}
											alt=""
											class="absolute inset-0 h-full w-full object-cover"
											loading="lazy"
											onerror={(event) => event.currentTarget.remove()}
										/>{/if}</span
								>
								<span class="truncate text-xs">{participant.name}</span>
							</div>
						{:else}
							<p class="py-6 text-center text-xs text-muted-foreground">Пока никого нет.</p>
						{/each}
					</div>
				</div>
				<header
					class="border-b border-border/40 p-3 max-lg:hidden max-lg:landscape:p-2 {mobileTab !==
					'info'
						? 'max-lg:portrait:hidden'
						: ''} {landscapeTab !== 'info' ? 'max-lg:landscape:hidden' : ''}"
				>
					<div class="flex flex-wrap items-center gap-2">
						{#if kind === 'live'}<span
								class="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-1 text-[9px] font-bold tracking-wide text-red-600 uppercase"
								><span class="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500"></span> Live</span
							>{:else}<span
								class="rounded-full bg-muted px-2 py-1 text-[9px] font-bold tracking-wide text-muted-foreground uppercase"
								>Запись</span
							>{/if}
						<span
							class="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-1 text-[10px] font-semibold"
							><Users class="h-3 w-3" /> {listeners}</span
						>

						{#if kind === 'published'}<label
								class="flex items-center gap-1 text-[9px] text-muted-foreground"
								>Чат по записи<Switch
									bind:checked={chatByRecording}
									aria-label="Чат по записи"
								/></label
							>{/if}
						{#if kind === 'published'}<span
								class="rounded-full bg-muted px-2 py-1 text-[9px] font-semibold text-muted-foreground"
								>Слушало: {data.viewersCount}</span
							>{/if}
						<button
							type="button"
							class="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
							onclick={collapseChat}
							aria-label="Закрыть чат"><X class="h-4 w-4" /></button
						>
					</div>
				</header>
				{#if mentionMode === 'users'}
					<div
						class="flex min-h-0 flex-1 flex-col-reverse gap-1 overflow-y-auto p-3 {mobileTab !==
						'chat'
							? 'max-lg:portrait:hidden'
							: ''} {landscapeTab !== 'chat' ? 'max-lg:landscape:hidden' : ''}"
					>
						{#each filteredParticipants as participant (participant.id)}
							<button
								type="button"
								class="flex items-center gap-2 rounded-xl px-2 py-2 text-left transition hover:bg-muted/60"
								onclick={() => insertUserMention(participant.name)}
							>
								<span
									class="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-bold"
									>{participant.name.charAt(0).toUpperCase()}{#if participant.image}<img
											src={participant.image}
											alt=""
											class="absolute inset-0 h-full w-full object-cover"
											loading="lazy"
											onerror={(event) => event.currentTarget.remove()}
										/>{/if}</span
								>
								<span class="truncate text-sm">{participant.name}</span>
							</button>
						{:else}
							<p class="py-8 text-center text-xs text-muted-foreground">Пользователи не найдены</p>
						{/each}
					</div>
				{:else if mentionMode === 'illustrations'}
					<div
						class="flex min-h-0 flex-1 flex-col overflow-y-auto p-3 {mobileTab !== 'chat'
							? 'max-lg:portrait:hidden'
							: ''} {landscapeTab !== 'chat' ? 'max-lg:landscape:hidden' : ''}"
					>
						<div class="mb-2 flex items-center justify-between gap-2">
							<button
								type="button"
								class="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
								onclick={cancelIllustrationPicker}
								aria-label="Отменить выбор иллюстраций"><X class="h-4 w-4" /></button
							>
							<button
								type="button"
								class="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-[10px] font-semibold text-primary-foreground disabled:opacity-40"
								disabled={selectedIllustrationIds.length === 0}
								onclick={confirmIllustrationTags}
								><Check class="h-3 w-3" /> Готово ({selectedIllustrationIds.length})</button
							>
						</div>
						<div class="grid grid-cols-3 gap-2">
							{#each data.images as image (image.id)}
								<button
									type="button"
									class="relative overflow-hidden rounded-lg border-2 transition {selectedIllustrationIds.includes(
										image.id
									)
										? 'border-primary'
										: 'border-transparent hover:border-border'}"
									onclick={() => toggleIllustrationTag(image.id)}
									aria-pressed={selectedIllustrationIds.includes(image.id)}
								>
									<img
										src={image.imageUrl}
										alt={image.caption ?? ''}
										class="aspect-square w-full object-cover {timingIllustrations &&
										image.showAtSeconds > pageTimelineTime
											? 'blur-xl'
											: ''}"
										loading="lazy"
									/>
									<span
										class="absolute inset-x-0 bottom-0 bg-black/60 px-1 py-0.5 text-[8px] text-white"
										>{formatDuration(image.showAtSeconds)}</span
									>
									{#if selectedIllustrationIds.includes(image.id)}<span
											class="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground"
											><Check class="h-2.5 w-2.5" /></span
										>{/if}
								</button>
							{/each}
						</div>
					</div>
				{:else if mentionMode === 'donate'}
					<div
						class="flex min-h-0 flex-1 flex-col overflow-y-auto p-3 {mobileTab !== 'chat'
							? 'max-lg:portrait:hidden'
							: ''} {landscapeTab !== 'chat' ? 'max-lg:landscape:hidden' : ''}"
					>
						<div class="mb-2 flex items-center justify-between gap-2">
							<button
								type="button"
								class="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
								onclick={() => (mentionMode = null)}
								aria-label="Закрыть способы доната"><X class="h-4 w-4" /></button
							>
							<span class="text-xs font-semibold">Поддержать</span>
						</div>
						{@render donationMethods()}
					</div>
				{:else}
					<div
						bind:this={messagesEl}
						onscroll={handleChatScroll}
						class="chat-scroll flex min-h-0 flex-1 flex-col-reverse gap-3 overflow-y-auto p-4 {mobileTab !==
						'chat'
							? 'max-lg:portrait:hidden'
							: ''} {landscapeTab !== 'chat' ? 'max-lg:landscape:hidden' : ''}"
					>
						<div class="contents">
							<div class="contents">
								{#if visibleMessages.length === 0}<p
										class="py-10 text-center text-xs text-muted-foreground"
									>
										Сообщений пока нет. Будьте первым.
									</p>{/if}
								{#each newestMessages as message (message.id)}
									{@const lifetime = message.subscription === 'lifetime'}
									{@const subscribed = lifetime || message.subscription === 'active'}
									{@const link = message.linkUrl ?? linkFromText(message.body)}
									{@const bodyText = displayBody(message.body)}
									{@const taggedImages = data.images.filter((image) =>
										(message.taggedIllustrationIds ?? []).includes(image.id)
									)}
									{@const taggedSpoiler =
										timingIllustrations &&
										message.userId !== currentUserId &&
										taggedImages.some((image) => image.showAtSeconds > pageTimelineTime)}
									{@const bodySegments = splitMentions(bodyText ?? '', knownMentionNames)}
									<div
										id={'broadcast-message-' + message.id}
										in:fly={{ y: 8, duration: 180 }}
										class="flex items-start gap-2.5"
									>
										<div class="relative shrink-0 pt-0.5">
											<div
												class="rounded-full p-0.5 {lifetime
													? 'bg-amber-400/20 ring-2 ring-amber-400'
													: subscribed
														? 'bg-emerald-400/15 ring-2 ring-emerald-400'
														: 'ring-1 ring-border'}"
											>
												{#if message.avatar}<img
														src={message.avatar}
														alt=""
														class="h-8 w-8 rounded-full object-cover"
														loading="lazy"
													/>{:else}<div
														class="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary"
													>
														{message.name.charAt(0).toUpperCase()}
													</div>{/if}
											</div>
											{#if subscribed}<span
													class="absolute -right-1 -bottom-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full text-[10px] font-bold ring-2 ring-card {lifetime
														? 'bg-amber-400 text-amber-950'
														: 'bg-emerald-500 text-white'}"
													title={lifetime ? 'Вечная подписка' : 'Активная подписка'}
													>{lifetime ? '∞' : '♛'}</span
												>{/if}
										</div>
										<div class="min-w-0 flex-1">
											<div class="flex items-center gap-1.5">
												<span class="truncate text-[11px] font-semibold">{message.name}</span>

												{#if kind === 'published'}<span
														class="ml-auto shrink-0 font-mono text-[9px] text-muted-foreground"
														>{formatDuration(message.offsetSeconds)}</span
													>{/if}
											</div>
											<div
												class="mt-1 rounded-2xl rounded-tl-sm border px-2.5 py-2 transition-colors duration-500 {lifetime
													? 'border-amber-400/25 bg-amber-500/10'
													: subscribed
														? 'border-emerald-400/20 bg-emerald-500/8'
														: 'border-border/50 bg-muted/50'}"
												class:blurred={taggedSpoiler}
												style={highlightedMessageId === message.id
													? 'background-color: color-mix(in oklch, var(--color-primary) 16%, transparent);'
													: ''}
											>
												{#if message.replyToId}
													<button
														type="button"
														class="mb-1.5 w-full rounded-lg border-l-2 border-primary/60 bg-background/30 px-2 py-1 text-left transition hover:bg-muted/40"
														onclick={() => scrollToMessage(message.replyToId)}
													>
														<p class="text-[9px] font-semibold text-primary">
															{message.replyToName ?? 'Сообщение'}
														</p>
														<p
															class="line-clamp-2 text-[9px] whitespace-pre-wrap text-muted-foreground"
														>
															{message.replyToBody ?? ''}
														</p>
													</button>
												{/if}
												{#if bodyText}<p
														class="text-xs leading-relaxed break-words whitespace-pre-wrap"
													>
														{#each bodySegments as segment, index (index)}{#if segment.mention}<span
																	class="font-semibold text-sky-400">{segment.text}</span
																>{:else}{segment.text}{/if}{/each}
													</p>{/if}
												{#if taggedImages.length}
													<div class="mt-1.5 flex flex-wrap gap-1">
														{#each taggedImages as tagged (tagged.id)}
															<img
																src={tagged.imageUrl}
																alt={tagged.caption ?? 'Иллюстрация'}
																class="h-14 w-20 rounded-lg border border-border/40 object-cover"
																loading="lazy"
															/>
														{/each}
													</div>
												{/if}
												{#if link}
													{@const label = linkLabel(link)}
													<button
														type="button"
														onclick={() => window.open(link, '_blank', 'noopener,noreferrer')}
														class="mt-1.5 flex w-full flex-col gap-2 overflow-hidden rounded-xl border border-border/50 bg-background/60 p-2 text-left transition hover:bg-muted/60"
													>
														{#if message.linkImage}<img
																src={message.linkImage}
																alt=""
																class="max-h-36 w-full rounded-lg object-cover"
																loading="lazy"
															/>{/if}
														<span class="flex w-full items-center gap-2">
															{#if pendingPreview?.image}<img
																	src={pendingPreview.image}
																	alt=""
																	class="h-10 w-10 shrink-0 rounded-lg object-cover"
																	loading="lazy"
																/>{:else}<span
																	class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
																	><LinkIcon class="h-4 w-4" /></span
																>{/if}
															<span class="min-w-0 flex-1">
																<span class="block truncate text-[10px] font-semibold"
																	>{message.linkTitle ?? label.host}</span
																>
																<span class="line-clamp-2 text-[9px] text-muted-foreground"
																	>{message.linkDescription ?? label.host + label.path}</span
																>
															</span>
														</span>
													</button>
												{/if}
												{#if kind === 'live'}
													<div class="mt-1.5 flex items-end gap-1">
														<div class="flex min-w-0 flex-1 flex-wrap items-center gap-1">
															{#if currentUserId && currentUserId === message.userId}
																{#each Object.entries(message.reactions ?? {}).sort((a, b) => b[1] - a[1]) as [emoji, count] (emoji)}
																	<span
																		class="rounded-full border border-border/40 bg-background/70 px-1.5 py-0.5 text-[10px] leading-none text-muted-foreground"
																		>{emoji} {count}</span
																	>
																{/each}
															{:else}
																{#each reactionOptions(message) as emoji (emoji)}
																	<button
																		type="button"
																		class="rounded-full border px-1.5 py-0.5 text-[10px] leading-none transition {message.myReaction ===
																		emoji
																			? 'border-transparent bg-primary/20 text-primary'
																			: 'border-border/40 bg-background/70 hover:bg-muted'}"
																		animate:flip={{ duration: 220 }}
																		onclick={() => react(message.id, emoji)}
																		aria-label={'Реакция ' + emoji}
																		aria-pressed={message.myReaction === emoji}
																		>{emoji}{#if message.reactions?.[emoji]}<span
																				class="ml-0.5 text-[9px]">{message.reactions[emoji]}</span
																			>{/if}</button
																	>
																{/each}
															{/if}
														</div>
														<button
															type="button"
															class="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] text-muted-foreground transition hover:bg-muted hover:text-foreground"
															onclick={() => setReplyTo(message)}
															aria-label="Ответить"><Reply class="h-3 w-3" /> Ответить</button
														>
													</div>
												{/if}
											</div>
										</div>
									</div>
								{/each}
								{#if hasMoreMessages}
									<button
										type="button"
										class="mx-auto rounded-full border border-border/40 bg-background/70 px-3 py-1 text-[10px] text-muted-foreground transition hover:bg-muted"
										onclick={loadOlderMessages}
										disabled={loadingOlder}
									>
										{loadingOlder ? 'Загрузка…' : 'Загрузить ранее'}
									</button>
								{/if}
							</div>
						</div>
					</div>
				{/if}
				{#if kind === 'live' && data.chatEnabled}
					<form
						class="border-t border-border/40 p-3 max-lg:landscape:p-2 {mobileTab !== 'chat'
							? 'max-lg:portrait:hidden'
							: ''} {landscapeTab !== 'chat' ? 'max-lg:landscape:hidden' : ''}"
						onsubmit={sendMessage}
					>
						{#if replyToMessage}
							<div
								class="mb-2 flex items-center gap-2 rounded-xl border border-primary/25 bg-muted/40 p-2"
							>
								<Reply class="h-4 w-4 shrink-0 text-primary" />
								<div class="min-w-0 flex-1">
									<p class="text-[10px] font-semibold text-primary">
										Ответ {replyToMessage.name}
									</p>
									<p class="truncate text-[9px] text-muted-foreground">{replyToMessage.body}</p>
								</div>
								<button
									type="button"
									class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
									onclick={clearReplyTo}
									aria-label="Отменить ответ"><X class="h-3.5 w-3.5" /></button
								>
							</div>
						{/if}
						{#if pendingLink}
							{@const preview = linkLabel(pendingLink)}
							<div
								class="mb-2 flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/5 p-2"
							>
								{#if pendingPreview?.image}
									<img
										src={pendingPreview.image}
										alt=""
										class="h-10 w-10 shrink-0 rounded-lg object-cover"
										loading="lazy"
									/>
								{:else}
									<span
										class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
										><LinkIcon class="h-4 w-4" /></span
									>
								{/if}
								<div class="min-w-0 flex-1">
									<p class="text-[10px] font-semibold">{preview.host}</p>
									<p class="truncate text-[9px] text-muted-foreground">{pendingLink}</p>
								</div>
								<button
									type="button"
									class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
									onclick={removePendingLink}
									aria-label="Удалить ссылку"><X class="h-3.5 w-3.5" /></button
								>
							</div>
						{/if}
						{#if pendingIllustrations.length > 0}
							<div class="mb-2 flex gap-2 overflow-x-auto">
								{#each pendingIllustrations as image (image.id)}
									<div class="relative shrink-0">
										<img
											src={image.imageUrl}
											alt={image.caption ?? ''}
											class="h-14 w-20 rounded-lg object-cover {timingIllustrations &&
											image.showAtSeconds > pageTimelineTime
												? 'blur-md'
												: ''}"
											loading="lazy"
										/>
										<button
											type="button"
											class="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-background text-foreground shadow"
											onclick={() => removePendingIllustration(image.id)}
											aria-label="Убрать иллюстрацию"><X class="h-2.5 w-2.5" /></button
										>
									</div>
								{/each}
							</div>
						{/if}
						<div class="flex gap-2">
							<div bind:this={attachMenuEl} class="relative shrink-0">
								<button
									type="button"
									class="flex h-9 w-9 items-center justify-center rounded-md border border-input bg-transparent text-muted-foreground transition hover:bg-muted hover:text-foreground"
									onclick={() => (attachMenuOpen = !attachMenuOpen)}
									aria-label="Вложения"><Paperclip class="h-4 w-4" /></button
								>
								{#if attachMenuOpen}
									<div
										class="absolute bottom-full left-0 z-50 mb-2 w-44 overflow-hidden rounded-xl border border-border/60 bg-popover p-1 text-popover-foreground shadow-xl"
									>
										<button
											type="button"
											class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-muted"
											onclick={() => openUserPicker('button')}
											><Users class="h-3.5 w-3.5" /> Пользователь</button
										>
										<button
											type="button"
											class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-muted"
											onclick={openIllustrationPicker}
											><ImageIcon class="h-3.5 w-3.5" /> Иллюстрация</button
										>
									</div>
								{/if}
							</div>
							<button
								type="button"
								class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-input bg-transparent text-amber-500 transition hover:bg-amber-500/10"
								onclick={openDonatePicker}
								aria-label="Донат"><Coins class="h-4 w-4" /></button
							>
							<div class="relative min-w-0 flex-1">
								<div
									bind:this={inputMirrorEl}
									aria-hidden="true"
									class="pointer-events-none absolute inset-0 overflow-hidden px-2.5 py-2 text-base leading-5 break-words whitespace-pre-wrap md:text-sm"
								>
									{#each chatTextSegments as segment, index (index)}{#if segment.mention}<span
												class="font-semibold text-sky-400">{segment.text}</span
											>{:else}{segment.text}{/if}{/each}
								</div>
								<Textarea
									bind:ref={chatInputEl}
									bind:value={chatText}
									rows={1}
									maxlength={MAX_CHAT}
									placeholder={pendingLink ? 'Добавьте текст…' : 'Сообщение…'}
									aria-label="Сообщение в чат"
									class="relative max-h-36 min-h-9 resize-none bg-transparent py-2 leading-5 text-transparent caret-foreground landscape:max-h-24 dark:bg-transparent"
									oninput={handleChatInput}
									onpaste={attachPastedLink}
									onkeydown={handleChatKeydown}
									onscroll={syncInputScroll}
								/>
							</div>
							<Button
								type="submit"
								size="icon"
								disabled={sending ||
									(!chatText.trim() && !pendingLink && pendingIllustrations.length === 0)}
								aria-label="Отправить"><Send class="h-4 w-4" /></Button
							>
						</div>
						<div
							class="mt-1 flex items-center justify-between gap-2 text-[10px] text-muted-foreground"
						>
							<span
								>{chatText.length} / {MAX_CHAT} символов · осталось {MAX_CHAT -
									chatText.length}</span
							>
							{#if chatError}<span class="text-destructive">{chatError}</span>{/if}
						</div>
						{#if showLinkHint}<p class="mt-1 text-[10px] text-destructive">
								Ссылки разрешены только на Telegram, Boosty, Discord или HEDGEHOG.INC.
							</p>{/if}
					</form>
				{:else if kind === 'published'}
					<div
						class="border-t border-border/40 p-3 text-center text-[11px] text-muted-foreground {mobileTab !==
						'chat'
							? 'max-lg:portrait:hidden'
							: ''} {landscapeTab !== 'chat' ? 'max-lg:landscape:hidden' : ''}"
					>
						Это запись эфира. Чат доступен в режиме replay.
					</div>
				{/if}
			</aside>
		</div>
	{/if}
	{#if previewImage}<ImageLightbox
			bind:open={isLightboxOpen}
			src={previewImage.imageUrl}
			alt={previewImage.caption ?? broadcast.title}
			caption={previewImage.caption ?? broadcast.title}
		/>{/if}
	<SupportCardModal bind:open={supportModalOpen} {...supportPayment} />
</div>

<style>
	.chat-scroll {
		scrollbar-width: none;
		-ms-overflow-style: none;
	}

	.blurred {
		filter: blur(5px);
		user-select: none;
	}

	.chat-scroll::-webkit-scrollbar {
		display: none;
	}

	@media (orientation: landscape) and (max-width: 1023px) {
		:global(body.broadcast-page) :global(.global-audio-player) {
			position: fixed;
			left: 0.5rem;
			bottom: 0.5rem;
			width: calc(52% - 1rem);
			z-index: 70;
			border: 1px solid var(--border);
			border-radius: 0.75rem;
			overflow: hidden;
		}
	}

	@media (max-width: 1023px) {
		:global(body.broadcast-page) :global(.global-audio-player .player-desktop) {
			display: none !important;
		}
		:global(body.broadcast-page) :global(.global-audio-player .player-mobile) {
			display: block !important;
		}
	}

	@media (orientation: landscape) and (max-width: 1023px) {
		:global(body.broadcast-page.broadcast-chat-collapsed) :global(.global-audio-player) {
			width: calc(100% - 1rem);
		}
	}
</style>
