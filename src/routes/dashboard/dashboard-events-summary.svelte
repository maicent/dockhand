<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { orEmpty } from '$lib/i18n.js';
	import { Activity } from 'lucide-svelte';

	interface Props {
		today: number;
		total: number;
	}

	let { today, total }: Props = $props();
</script>

{#if total > 0}
	<div class="flex items-center justify-between text-xs pt-1 border-t border-border/50">
		<span class="flex items-center gap-1 text-muted-foreground">
			<Activity class="w-3 h-3" /> {m.events()}
		</span>
		<span class="font-medium">
			{m.today_today({ today: orEmpty(today) })} <span class="text-muted-foreground">{m.total_total({ total: orEmpty(total) })}</span>
		</span>
	</div>
{/if}
