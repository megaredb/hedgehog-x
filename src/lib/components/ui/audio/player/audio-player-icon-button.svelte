<script lang="ts">
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { Button, type ButtonSize, type ButtonVariant } from '$lib/components/ui/button';
	import { cn } from '$lib/utils.js';
	import type { Snippet } from 'svelte';

	interface Props {
		/** Иконка (snippet), рендерится внутри кнопки. */
		icon: Snippet;
		/** Текст тултипа и aria-label. */
		label: string;
		disabled?: boolean;
		onclick?: (e: MouseEvent) => void;
		class?: string;
		size?: ButtonSize;
		variant?: ButtonVariant;
		/** Значение атрибута data-slot (для тестов/семантики). */
		dataSlot?: string;
	}

	let {
		icon,
		label,
		disabled = false,
		onclick,
		class: className = '',
		size = 'icon',
		variant = 'ghost',
		dataSlot = undefined
	}: Props = $props();
</script>

<Tooltip.Root>
	<Tooltip.Trigger>
		{#snippet child({ props })}
			<Button
				aria-label={label}
				class={cn(className)}
				data-slot={dataSlot}
				{disabled}
				{size}
				{variant}
				{...props}
				onclick={(e) => {
					// @ts-expect-error -- child snippet props type omits onclick
					props.onclick?.(e);
					onclick?.(e);
				}}
			>
				{@render icon()}
			</Button>
		{/snippet}
	</Tooltip.Trigger>
	<Tooltip.Content sideOffset={4}>{label}</Tooltip.Content>
</Tooltip.Root>
