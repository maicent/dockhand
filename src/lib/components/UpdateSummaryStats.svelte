<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { orEmpty } from '$lib/i18n.js';
	import { CheckCircle2, ShieldAlert, XCircle, Search } from 'lucide-svelte';

	interface Props {
		checked?: number;
		updated: number;
		blocked: number;
		failed: number;
		compact?: boolean;
	}

	let { checked, updated, blocked, failed, compact = false }: Props = $props();
</script>

{#if compact}
	<!-- Inline compact layout -->
	<div class="flex items-center gap-4 text-sm">
		{#if checked !== undefined}
			<div class="flex items-center gap-1.5">
				<span class="font-bold">{checked}</span>
				<span class="text-muted-foreground">{m.checked()}</span>
			</div>
		{/if}
		{#if updated > 0}
			<div class="flex items-center gap-1.5 text-green-600">
				<CheckCircle2 class="w-4 h-4" />
				<span>{m.updated_updated({ updated: orEmpty(updated) })}</span>
			</div>
		{/if}
		{#if blocked > 0}
			<div class="flex items-center gap-1.5 text-amber-600">
				<ShieldAlert class="w-4 h-4" />
				<span>{m.blocked_blocked({ blocked: orEmpty(blocked) })}</span>
			</div>
		{/if}
		{#if failed > 0}
			<div class="flex items-center gap-1.5 text-red-600">
				<XCircle class="w-4 h-4" />
				<span>{m.failed_failed({ failed: orEmpty(failed) })}</span>
			</div>
		{/if}
	</div>
{:else}
	<!-- Grid layout -->
	<div class="flex items-center gap-4 text-sm pb-3 border-b">
		{#if checked !== undefined}
			<div class="flex items-center gap-1.5">
				<Search class="w-4 h-4 text-muted-foreground" />
				<span class="font-bold">{checked}</span>
				<span class="text-muted-foreground">{m.checked()}</span>
			</div>
		{/if}
		<div class="flex items-center gap-1.5">
			<CheckCircle2 class="w-4 h-4 text-green-500" />
			<span class="font-bold text-green-500">{updated}</span>
			<span class="text-muted-foreground">{m.updated()}</span>
		</div>
		<div class="flex items-center gap-1.5">
			<ShieldAlert class="w-4 h-4 text-amber-500" />
			<span class="font-bold text-amber-500">{blocked}</span>
			<span class="text-muted-foreground">{m.blocked()}</span>
		</div>
		<div class="flex items-center gap-1.5">
			<XCircle class="w-4 h-4 text-red-500" />
			<span class="font-bold text-red-500">{failed}</span>
			<span class="text-muted-foreground">{m.failed()}</span>
		</div>
	</div>
{/if}
