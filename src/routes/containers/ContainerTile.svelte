<script lang="ts">
	import { Box } from 'lucide-svelte';
	import * as m from '$lib/paraglide/messages';

	interface Props {
		containerId: string;
		containerName: string;
		ipv4Address?: string;
		ipv6Address?: string;
		macAddress?: string;
		onclick?: () => void;
	}

	let { containerId, containerName, ipv4Address, ipv6Address, macAddress, onclick }: Props = $props();
</script>

<button
	type="button"
	class="w-full p-3 bg-muted rounded-lg space-y-2 text-left hover:bg-muted/80 hover:ring-1 hover:ring-border transition-all cursor-pointer"
	onclick={onclick}
>
	<div class="flex items-center gap-2">
		<Box class="w-4 h-4 text-muted-foreground shrink-0" />
		<span class="font-medium text-sm truncate" title={containerName}>{containerName}</span>
	</div>
	<div class="text-xs space-y-1">
		{#if ipv4Address}
			<div>
				<span class="text-muted-foreground">{m.container_tile_ipv4()}</span>
				<code class="text-foreground">{ipv4Address}</code>
			</div>
		{/if}
		{#if ipv6Address}
			<div>
				<span class="text-muted-foreground">{m.container_tile_ipv6()}</span>
				<code class="text-foreground">{ipv6Address}</code>
			</div>
		{/if}
		{#if macAddress}
			<div>
				<span class="text-muted-foreground">{m.container_tile_mac()}</span>
				<code class="text-foreground">{macAddress}</code>
			</div>
		{/if}
	</div>
	<code class="text-2xs text-muted-foreground">{containerId.slice(0, 12)}</code>
</button>
