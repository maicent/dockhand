<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { orEmpty } from '$lib/i18n.js';
	import {
		AlertTriangle,
		RefreshCw,
		CircleCheck
	} from 'lucide-svelte';

	interface Props {
		unhealthy: number;
		restarting: number;
	}

	let { unhealthy, restarting }: Props = $props();
</script>

<div class="flex items-center gap-2 px-2 py-1.5 rounded-md {unhealthy > 0 ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : restarting > 0 ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'}">
	{#if unhealthy > 0}
		<AlertTriangle class="w-3.5 h-3.5" />
		<span class="text-xs font-medium truncate">{m.unhealthy_unhealthy({ unhealthy: orEmpty(unhealthy) })}</span>
	{:else if restarting > 0}
		<RefreshCw class="w-3.5 h-3.5 animate-spin" />
		<span class="text-xs font-medium truncate">{m.restarting_restarting({ restarting: orEmpty(restarting) })}</span>
	{:else}
		<CircleCheck class="w-3.5 h-3.5" />
		<span class="text-xs font-medium truncate">{m.all_containers_healthy()}</span>
	{/if}
</div>
