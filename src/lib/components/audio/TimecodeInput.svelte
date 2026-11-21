<script lang="ts">
	import { formatDuration } from '$lib/utils/time';
	import { Minus, Plus } from '@lucide/svelte';

	interface Props {
		value: number;
		onchange: (seconds: number) => void;
		min?: number;
		max?: number;
		step?: number;
		label?: string;
		id?: string;
	}

	let { value, onchange, min = 0, max = 86_400, step = 10, label, id }: Props = $props();

	function clamp(seconds: number): number {
		return Math.max(min, Math.min(max, Math.round(seconds)));
	}

	function parseTimecode(raw: string): number | null {
		const parts = raw
			.trim()
			.replace(',', '.')
			.split(':')
			.map((part) => Number(part));
		if (parts.some((part) => !Number.isFinite(part) || part < 0)) return null;
		if (parts.length === 1) return parts[0];
		if (parts.length === 2) return parts[0] * 60 + parts[1];
		if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
		return null;
	}

	function commit(raw: string, input?: HTMLInputElement) {
		const parsed = parseTimecode(raw);
		if (parsed === null) {
			if (input) input.value = formatDuration(value);
			return;
		}
		const next = clamp(parsed);
		if (input) input.value = formatDuration(next);
		onchange(next);
	}

	function nudge(delta: number) {
		onchange(clamp(value + delta));
	}
</script>

<div class="space-y-1.5">
	{#if label}
		<label for={id} class="text-xs font-medium text-muted-foreground">{label}</label>
	{/if}
	<div class="flex items-center gap-1.5">
		<button
			type="button"
			class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
			aria-label={`Уменьшить на ${step} секунд`}
			onclick={() => nudge(-step)}
		>
			<Minus class="h-3.5 w-3.5" />
		</button>
		<input
			{id}
			type="text"
			inputmode="numeric"
			class="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-center font-mono text-sm tabular-nums transition outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
			value={formatDuration(value)}
			onchange={(event) => commit(event.currentTarget.value, event.currentTarget)}
			onblur={(event) => commit(event.currentTarget.value, event.currentTarget)}
			onkeydown={(event) => {
				if (event.key === 'Enter') commit(event.currentTarget.value, event.currentTarget);
			}}
		/>
		<button
			type="button"
			class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
			aria-label={`Увеличить на ${step} секунд`}
			onclick={() => nudge(step)}
		>
			<Plus class="h-3.5 w-3.5" />
		</button>
	</div>
</div>
