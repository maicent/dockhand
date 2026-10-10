<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { WifiOff } from 'lucide-svelte';

	interface Props {
		error?: string;
		compact?: boolean;
	}

	let { error, compact = false }: Props = $props();
</script>

{#if compact}
	<div class="flex items-center gap-2 text-muted-foreground py-1">
		<WifiOff class="w-4 h-4 opacity-50" />
		<span class="text-xs">{m.offline()}</span>
	</div>
{:else}
	<div class="flex flex-col items-center justify-center py-8 text-muted-foreground">
		<WifiOff class="w-8 h-8 mb-2 opacity-50" />
		<span class="text-sm">{m.environment_offline()}</span>
		{#if error}
			<span class="text-xs mt-1 text-red-500/70">{error}</span>
		{/if}
	</div>
{/if}
