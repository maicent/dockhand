<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { orEmpty } from '$lib/i18n.js';
	import { Label } from '$lib/components/ui/label';
	import { Input } from '$lib/components/ui/input';
	import * as Select from '$lib/components/ui/select';
	import { TogglePill } from '$lib/components/ui/toggle-pill';
	import CronEditor from '$lib/components/cron-editor.svelte';
	import TimezoneSelector from '$lib/components/TimezoneSelector.svelte';
	import VulnerabilityCriteriaSelector, { type VulnerabilityCriteria } from '$lib/components/VulnerabilityCriteriaSelector.svelte';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { CircleFadingArrowUp, CircleArrowUp, RefreshCw, Info, Trash2, HelpCircle } from 'lucide-svelte';
	import { formatDateTime } from '$lib/stores/settings';
	import { formatBytes } from '$lib/utils/format';

	interface Props {
		// Update check settings
		updateCheckLoading: boolean;
		updateCheckEnabled: boolean;
		updateCheckCron: string;
		updateCheckAutoUpdate: boolean;
		updateCheckVulnerabilityCriteria: VulnerabilityCriteria;
		minimumReleaseAgeHours: number;
		minimumReleaseAgeOverridden: boolean;
		minimumReleaseAgeOverride: boolean;
		scannerEnabled: boolean;
		// Image prune settings
		imagePruneLoading: boolean;
		imagePruneEnabled: boolean;
		imagePruneCron: string;
		imagePruneMode: 'dangling' | 'all';
		imagePruneLastPruned?: string;
		imagePruneLastResult?: { spaceReclaimed: number; imagesRemoved: number };
		// Timezone
		timezone: string;
	}

	let {
		updateCheckLoading,
		updateCheckEnabled = $bindable(),
		updateCheckCron = $bindable(),
		updateCheckAutoUpdate = $bindable(),
		updateCheckVulnerabilityCriteria = $bindable(),
		minimumReleaseAgeHours = $bindable(),
		minimumReleaseAgeOverridden,
		minimumReleaseAgeOverride = $bindable(),
		scannerEnabled,
		imagePruneLoading,
		imagePruneEnabled = $bindable(),
		imagePruneCron = $bindable(),
		imagePruneMode = $bindable(),
		imagePruneLastPruned,
		imagePruneLastResult,
		timezone = $bindable()
	}: Props = $props();

</script>

<!-- Scheduled Update Check Section -->
<div class="space-y-4">
	<div class="text-sm font-medium">
		{m.scheduled_update_check()}
	</div>
	<p class="text-xs text-muted-foreground">
		{m.periodically_check_all_containers_in_this_enviro()}
	</p>

	{#if updateCheckLoading}
		<div class="flex items-center justify-center py-4">
			<RefreshCw class="w-5 h-5 animate-spin text-muted-foreground" />
		</div>
	{:else}
		<div class="flex items-start gap-2">
			<CircleFadingArrowUp class="w-4 h-4 text-green-500 glow-green mt-0.5 shrink-0" />
			<div class="flex-1">
				<Label>{m.enable_scheduled_update_check()}</Label>
				<p class="text-xs text-muted-foreground">{m.automatically_check_for_container_updates_on_a_s()}</p>
			</div>
			<TogglePill bind:checked={updateCheckEnabled} />
		</div>

		{#if updateCheckEnabled}
			<div class="flex items-start gap-2">
				<div class="w-4 shrink-0"></div>
				<div class="flex-1 space-y-2">
					<Label>{m.schedule()}</Label>
					<CronEditor value={updateCheckCron} onchange={(cron) => updateCheckCron = cron} />
				</div>
			</div>

			<div class="flex items-start gap-2">
				<CircleArrowUp class="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
				<div class="flex-1">
					<Label>{m.automatically_update_containers()}</Label>
					<p class="text-xs text-muted-foreground">
						{m.when_enabled_containers_will_be_updated_automati()}
					</p>
				</div>
				<TogglePill bind:checked={updateCheckAutoUpdate} />
			</div>

			{#if updateCheckAutoUpdate && scannerEnabled}
				<div class="flex items-start gap-2">
					<div class="w-4 shrink-0"></div>
					<div class="flex-1">
						<Label>{m.block_updates_with_vulnerabilities()}</Label>
						<p class="text-xs text-muted-foreground">
							{m.block_auto_updates_if_the_new_image_has_vulnerab()}
						</p>
					</div>
					<VulnerabilityCriteriaSelector
						bind:value={updateCheckVulnerabilityCriteria}
						class="w-[200px]"
					/>
				</div>
			{/if}

			<div class="text-xs text-muted-foreground bg-muted/50 rounded-md p-2 flex items-start gap-2">
				<Info class="w-3 h-3 mt-0.5 shrink-0" />
				{#if updateCheckAutoUpdate}
					{#if scannerEnabled && updateCheckVulnerabilityCriteria !== 'never'}
						<span>{m.new_images_are_pulled_to_a_temporary_tag_scanned()}</span>
					{:else}
						<span>{m.containers_will_be_updated_automatically_when_ne()}</span>
					{/if}
				{:else}
					<span>{m.youll_receive_notifications_when_updates_are_ava()}</span>
				{/if}
			</div>
		{/if}
	{/if}
</div>

<!-- Minimum image age -->
<div class="space-y-3 pt-4 border-t">
	<div class="text-sm font-medium flex items-center gap-2">
		{m.minimum_image_age()}
		<Tooltip.Provider delayDuration={100}>
			<Tooltip.Root>
				<Tooltip.Trigger>
					<HelpCircle class="w-3.5 h-3.5 text-muted-foreground cursor-help" />
				</Tooltip.Trigger>
				<Tooltip.Portal>
					<Tooltip.Content side="right" sideOffset={8} class="!w-96 space-y-2">
						<p>{m.the_age_comes_from_the_images_creation_time_in_t()}</p>
						<p>{m.manual_pulls_warn_and_proceed_stack_deployments()}</p>
						<p>{m.a_newer_image_restarts_the_wait_on_itself_so_a_p()}</p>
					</Tooltip.Content>
				</Tooltip.Portal>
			</Tooltip.Root>
		</Tooltip.Provider>
	</div>
	<p class="text-xs text-muted-foreground">{m.hold_automatic_container_updates_until_a_new_ima()}</p>
	<div class="flex items-center justify-between gap-3">
		<div>
			<Label>{m.override_global_cooldown()}</Label>
			<p class="text-xs text-muted-foreground">{m.when_off_this_environment_uses_the_global_settin()}</p>
		</div>
		<TogglePill bind:checked={minimumReleaseAgeOverride} disabled={minimumReleaseAgeOverridden} />
	</div>
	{#if minimumReleaseAgeOverride}
		<div class="flex items-center gap-3">
			<Label for="env-minimum-release-age" class="shrink-0">{m.hours()}</Label>
			<Input id="env-minimum-release-age" type="number" min="0" max="720" step="1" class="w-28" bind:value={minimumReleaseAgeHours} disabled={minimumReleaseAgeOverridden} />
			<span class="text-xs text-muted-foreground">{m.t_0_disables_the_cooldown()}</span>
		</div>
	{/if}
	{#if minimumReleaseAgeOverridden}
		<p class="text-xs text-muted-foreground">{m.set_by_minimum_release_age_hours_on_the_dockhand()}</p>
	{/if}
</div>

<!-- Image Pruning Section -->
<div class="space-y-4 pt-4 border-t">
	<div class="text-sm font-medium">
		{m.automatic_image_pruning()}
	</div>
	<p class="text-xs text-muted-foreground">
		{m.automatically_remove_unused_docker_images_on_a_s()}
	</p>

	{#if imagePruneLoading}
		<div class="flex items-center justify-center py-4">
			<RefreshCw class="w-5 h-5 animate-spin text-muted-foreground" />
		</div>
	{:else}
		<div class="flex items-start gap-2">
			<Trash2 class="w-4 h-4 text-amber-500 glow-amber mt-0.5 shrink-0" />
			<div class="flex-1">
				<Label>{m.enable_automatic_image_pruning()}</Label>
				<p class="text-xs text-muted-foreground">{m.automatically_remove_unused_images_on_a_schedule()}</p>
			</div>
			<TogglePill bind:checked={imagePruneEnabled} />
		</div>

		{#if imagePruneEnabled}
			<div class="flex items-start gap-2">
				<div class="w-4 shrink-0"></div>
				<div class="flex-1 space-y-2">
					<Label>{m.schedule()}</Label>
					<CronEditor value={imagePruneCron} onchange={(cron) => imagePruneCron = cron} />
				</div>
			</div>

			<div class="flex items-start gap-2">
				<div class="w-4 shrink-0"></div>
				<div class="flex-1 space-y-2">
					<Label>{m.prune_mode()}</Label>
					<Select.Root type="single" bind:value={imagePruneMode}>
						<Select.Trigger class="w-full">
							{imagePruneMode === 'dangling' ? 'Dangling images only' : 'All unused images'}
						</Select.Trigger>
						<Select.Content>
							<Select.Item value="dangling">{m.dangling_images_only()}</Select.Item>
							<Select.Item value="all">{m.all_unused_images()}</Select.Item>
						</Select.Content>
					</Select.Root>
					<p class="text-xs text-muted-foreground">
						{#if imagePruneMode === 'dangling'}
							{m.only_removes_untagged_image_layers_safest_option()}
						{:else}
							{m.removes_all_images_not_used_by_any_container_mor()}
						{/if}
					</p>
				</div>
			</div>

			{#if imagePruneLastPruned}
				<div class="flex items-start gap-2">
					<div class="w-4 shrink-0"></div>
					<div class="flex-1">
						<p class="text-xs text-muted-foreground">
							{m.last_pruned_arg1({ arg1: orEmpty(formatDateTime(imagePruneLastPruned)) })}
							{#if imagePruneLastResult}
								{m.imagesremoved_images_removed_arg2_reclaimed({ imagesRemoved: orEmpty(imagePruneLastResult.imagesRemoved), arg2: orEmpty(formatBytes(imagePruneLastResult.spaceReclaimed)) })}
							{/if}
						</p>
					</div>
				</div>
			{/if}

			<div class="text-xs text-muted-foreground bg-muted/50 rounded-md p-2 flex items-start gap-2">
				<Info class="w-3 h-3 mt-0.5 shrink-0" />
				<span>{m.images_in_use_by_running_or_stopped_containers_w()}</span>
			</div>
		{/if}
	{/if}
</div>

<!-- Timezone selector -->
<div class="space-y-2">
	<Label>{m.timezone()}</Label>
	<TimezoneSelector
		bind:value={timezone}
		id="edit-env-timezone"
	/>
	<p class="text-xs text-muted-foreground">
		{m.used_for_scheduling_auto_updates_git_syncs_and_i()}
	</p>
</div>
