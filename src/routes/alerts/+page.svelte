<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { Bell } from 'lucide-svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
</script>

<div class="flex flex-col gap-6 p-6">
	<PageHeader icon={Bell} title={m.alerts()} />

	<div class="flex flex-col items-center justify-center py-12 text-muted-foreground">
		<Bell class="h-12 w-12 mb-4 opacity-50" />
		<p class="text-lg">{m.no_alerts_configured()}</p>
		<p class="text-sm">{m.alert_configuration_coming_soon()}</p>
	</div>
</div>
