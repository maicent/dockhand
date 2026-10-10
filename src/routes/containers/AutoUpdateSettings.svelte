<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { Label } from '$lib/components/ui/label';
	import { TogglePill } from '$lib/components/ui/toggle-pill';
	import CronEditor from '$lib/components/cron-editor.svelte';
	import VulnerabilityCriteriaSelector, { type VulnerabilityCriteria } from '$lib/components/VulnerabilityCriteriaSelector.svelte';
	import { currentEnvironment } from '$lib/stores/environment';
	import { Ship, Cable, ExternalLink, AlertTriangle, Info } from 'lucide-svelte';
	import type { SystemContainerType } from '$lib/types';

	interface Props {
		enabled: boolean;
		cronExpression: string;
		vulnerabilityCriteria: VulnerabilityCriteria;
		systemContainer?: SystemContainerType | null;
		onenablechange?: (enabled: boolean) => void;
		oncronchange?: (cron: string) => void;
		oncriteriachange?: (criteria: VulnerabilityCriteria) => void;
	}

	let {
		enabled = $bindable(),
		cronExpression = $bindable(),
		vulnerabilityCriteria = $bindable(),
		systemContainer = null,
		onenablechange,
		oncronchange,
		oncriteriachange
	}: Props = $props();

	let envHasScanning = $state(false);

	// Check if environment has scanning enabled
	$effect(() => {
		if (enabled) {
			checkScannerSettings();
		}
	});

	async function checkScannerSettings() {
		try {
			const envParam = $currentEnvironment ? `env=${$currentEnvironment.id}&` : '';
			const response = await fetch(`/api/settings/scanner?${envParam}settingsOnly=true`);
			if (response.ok) {
				const data = await response.json();
				envHasScanning = data.settings.scanner !== 'none';
			}
		} catch (err) {
			console.error('Failed to fetch scanner settings:', err);
			envHasScanning = false;
		}
	}
</script>

{#if systemContainer}
	<!-- System container - show informational message instead of settings -->
	<div class="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
		<div class="flex items-start gap-2">
			<AlertTriangle class="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
			<div class="space-y-2 text-xs">
				{#if systemContainer === 'dockhand'}
					<p class="font-medium text-blue-600 dark:text-blue-400">{m.scheduled_auto_updates_not_available()}</p>
					<p class="text-muted-foreground">
						{m.dockhand_does_not_auto_update_on_a_schedule_when()} <a href="/settings?tab=about" class="text-primary hover:underline">{m.settings_about()}</a>.
					</p>
				{:else}
					<p class="font-medium text-blue-600 dark:text-blue-400">{m.auto_updates_not_available()}</p>
					<p class="text-muted-foreground">
						{m.hawser_agents_must_be_updated_on_their_remote_ho()}
					</p>
					<a
						href="https://github.com/Finsys/hawser"
						target="_blank"
						rel="noopener noreferrer"
						class="text-primary hover:underline flex items-center gap-1"
					>
						<ExternalLink class="w-3 h-3" />
						{m.view_update_instructions_on_github()}
					</a>
				{/if}
			</div>
		</div>
	</div>
{:else}
	<div class="space-y-3">
		<div class="flex items-center gap-3">
			<Label class="text-xs font-normal">{m.enable_automatic_image_updates()}</Label>
			<TogglePill
				bind:checked={enabled}
				onchange={(value) => onenablechange?.(value)}
			/>
		</div>

		{#if enabled}
			<CronEditor
				value={cronExpression}
				onchange={(cron) => {
					cronExpression = cron;
					oncronchange?.(cron);
				}}
			/>

			{#if envHasScanning}
				<div class="space-y-1.5">
					<Label class="text-xs font-medium">{m.vulnerability_criteria()}</Label>
					<VulnerabilityCriteriaSelector
						bind:value={vulnerabilityCriteria}
						onchange={(v) => oncriteriachange?.(v)}
					/>
					<p class="text-xs text-muted-foreground">
						{m.block_auto_updates_if_new_image_has_vulnerabilit()}
					</p>
				</div>
			{/if}
		{/if}
	</div>
{/if}
