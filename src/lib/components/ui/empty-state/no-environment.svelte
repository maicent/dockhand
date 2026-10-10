<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/ui/button';
	import { EmptyState } from '$lib/components/ui/empty-state';
	import { Server, Settings } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { environments } from '$lib/stores/environment';

	const hasEnvironments = $derived($environments.length > 0);
</script>

{#if hasEnvironments}
	<EmptyState
		icon={Server}
		title={m.no_environment_selected()}
		description={m.select_a_docker_environment_from_the_dropdown_to()}
	/>
{:else}
	<EmptyState
		icon={Server}
		title={m.no_environment_configured()}
		description={m.add_a_docker_environment_in_settings_to_get_star()}
	>
		<Button variant="secondary" onclick={() => goto('/settings?tab=environments')}>
			<Settings class="w-4 h-4" />
			{m.go_to_settings()}
		</Button>
	</EmptyState>
{/if}
