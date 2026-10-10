<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import {
		ShieldCheck,
		Activity,
		WifiOff,
		CircleArrowUp,
		CircleFadingArrowUp
	} from 'lucide-svelte';

	interface Props {
		online: boolean;
		scannerEnabled: boolean;
		collectActivity: boolean;
		updateCheckEnabled?: boolean;
		updateCheckAutoUpdate?: boolean;
		compact?: boolean;
	}

	let { online, scannerEnabled, collectActivity, updateCheckEnabled = false, updateCheckAutoUpdate = false, compact = false }: Props = $props();
</script>

<div class="{compact ? 'flex items-center gap-1 shrink-0' : 'flex items-center gap-1.5 shrink-0'}">
	{#if updateCheckEnabled}
		<span title={updateCheckAutoUpdate ? "Auto-update enabled" : "Update check enabled (notify only)"}>
			{#if updateCheckAutoUpdate}
				<CircleArrowUp class="{compact ? 'w-3.5 h-3.5 glow-green-sm' : 'w-4 h-4 glow-green'} text-green-500" />
			{:else}
				<CircleFadingArrowUp class="{compact ? 'w-3.5 h-3.5 glow-green-sm' : 'w-4 h-4 glow-green'} text-green-500" />
			{/if}
		</span>
	{/if}
	{#if scannerEnabled}
		<span title={m.vulnerability_scanning_enabled()}>
			<ShieldCheck class="{compact ? 'w-3.5 h-3.5 glow-green-sm' : 'w-4 h-4 glow-green'} text-green-500" />
		</span>
	{/if}
	{#if collectActivity}
		<span title={m.activity_collection_enabled()}>
			<Activity class="{compact ? 'w-3.5 h-3.5 glow-amber-sm' : 'w-4 h-4 glow-amber'} text-amber-500" />
		</span>
	{/if}
	{#if !online && compact}
		<span title={m.offline()}>
			<WifiOff class="w-3.5 h-3.5 text-red-500 shrink-0" />
		</span>
	{/if}
</div>
