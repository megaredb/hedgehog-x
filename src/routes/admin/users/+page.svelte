<script lang="ts">
	import { enhance } from '$app/forms';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-bold tracking-tight">Пользователи</h1>
		<p class="text-sm text-muted-foreground">Роли и доступ к административной панели.</p>
	</div>

	{#if form?.error}
		<div
			class="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
		>
			{form.error}
		</div>
	{/if}

	<Card class="border-border/60">
		<CardHeader
			><CardTitle class="text-base">Все пользователи ({data.users.length})</CardTitle></CardHeader
		>
		<CardContent class="space-y-2">
			{#each data.users as item (item.id)}
				<form
					method="POST"
					action="?/setRole"
					use:enhance
					class="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
				>
					<input type="hidden" name="id" value={item.id} />
					<div class="min-w-0">
						<p class="truncate text-sm font-medium">
							{item.name}
							{#if item.id === data.currentUserId}<span class="text-xs text-muted-foreground"
									>(вы)</span
								>{/if}
						</p>
						<p class="truncate text-xs text-muted-foreground">{item.email || item.id}</p>
					</div>
					<div class="flex items-center gap-2">
						<Badge variant={item.role === 'admin' ? 'default' : 'secondary'}>{item.role}</Badge>
						<select
							name="role"
							class="h-8 rounded-md border border-input bg-background px-2 text-xs"
							value={item.role}
						>
							<option value="user">user</option>
							<option value="admin">admin</option>
						</select>
						<Button type="submit" size="sm" variant="outline">Сохранить</Button>
					</div>
				</form>
			{/each}
		</CardContent>
	</Card>
</div>
