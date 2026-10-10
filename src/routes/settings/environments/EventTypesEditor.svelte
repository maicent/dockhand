<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { TogglePill } from '$lib/components/ui/toggle-pill';
	import {
		Box,
		RefreshCw,
		GitBranch,
		Layers,
		Shield,
		HardDrive,
		Archive,
		ChevronDown,
		ChevronRight
	} from 'lucide-svelte';
	import { page } from '$app/stores'; // BETA GATE: backups feature flag

	interface EventType {
		id: string;
		label: string;
		description: string;
	}

	interface EventGroup {
		id: string;
		label: string;
		icon: typeof Box;
		events: EventType[];
	}

	interface Props {
		selectedEventTypes: string[];
		onchange: (eventTypes: string[]) => void;
		disabled?: boolean;
	}

	let { selectedEventTypes, onchange, disabled = false }: Props = $props();

	// Track collapsed state for groups
	let collapsedGroups = $state<Set<string>>(new Set());

	function toggleGroup(groupId: string) {
		if (collapsedGroups.has(groupId)) {
			collapsedGroups = new Set([...collapsedGroups].filter(id => id !== groupId));
		} else {
			collapsedGroups = new Set([...collapsedGroups, groupId]);
		}
	}

	// Notification event types - grouped by category with icons
	const NOTIFICATION_EVENT_GROUPS: EventGroup[] = [
		{
			id: 'container',
			label: m.container_events(),
			icon: Box,
			events: [
				{ id: 'container_started', label: m.container_started(), description: m.when_a_container_starts_running() },
				{ id: 'container_stopped', label: m.container_stopped(), description: m.when_a_container_is_stopped() },
				{ id: 'container_restarted', label: m.container_restarted(), description: m.when_a_container_restarts() },
				{ id: 'container_exited', label: m.container_exited(), description: m.when_a_container_exits_unexpectedly() },
				{ id: 'container_unhealthy', label: m.container_unhealthy(), description: m.when_a_container_health_check_fails() },
				{ id: 'container_healthy', label: m.container_healthy(), description: m.when_a_container_health_check_recovers() },
				{ id: 'container_oom', label: m.container_oom_killed(), description: m.when_a_container_is_killed_due_to_out_of_memory() },
				{ id: 'container_updated', label: m.container_updated(), description: m.when_a_container_image_is_updated() }
			]
		},
		{
			id: 'auto_update',
			label: m.auto_update_events(),
			icon: RefreshCw,
			events: [
				{ id: 'auto_update_success', label: m.update_succeeded(), description: m.container_successfully_updated_to_new_image() },
				{ id: 'auto_update_failed', label: m.update_failed(), description: m.container_auto_update_failed() },
				{ id: 'auto_update_blocked', label: m.update_blocked(), description: m.update_blocked_due_to_vulnerability_criteria() },
				{ id: 'updates_detected', label: m.updates_detected(), description: m.container_image_updates_are_available() },
				{ id: 'newer_version_available', label: m.newer_version_tag(), description: m.a_newer_version_tag_is_published_for_a_pinned_im() },
				{ id: 'batch_update_success', label: m.batch_update_completed(), description: m.scheduled_container_updates_completed() }
			]
		},
		{
			id: 'git_stack',
			label: m.git_stack_events(),
			icon: GitBranch,
			events: [
				{ id: 'git_sync_success', label: m.git_sync_succeeded(), description: m.git_stack_synced_and_deployed_successfully() },
				{ id: 'git_sync_failed', label: m.git_sync_failed(), description: m.git_stack_sync_or_deploy_failed() },
				{ id: 'git_sync_skipped', label: m.git_sync_skipped(), description: m.git_stack_sync_skipped_no_changes() }
			]
		},
		{
			id: 'stack',
			label: m.stack_events(),
			icon: Layers,
			events: [
				{ id: 'stack_started', label: m.stack_started(), description: m.when_a_compose_stack_starts() },
				{ id: 'stack_stopped', label: m.stack_stopped(), description: m.when_a_compose_stack_stops() },
				{ id: 'stack_deployed', label: m.stack_deployed(), description: m.stack_deployed_new_or_update() },
				{ id: 'stack_deploy_failed', label: m.stack_deploy_failed(), description: m.stack_deployment_failed() }
			]
		},
		{
			id: 'security',
			label: m.security_events(),
			icon: Shield,
			events: [
				{ id: 'vulnerability_critical', label: m.critical_vulns_found(), description: m.critical_vulnerabilities_found_in_image_scan() },
				{ id: 'vulnerability_high', label: m.high_vulns_found(), description: m.high_severity_vulnerabilities_found() },
				{ id: 'vulnerability_any', label: m.any_vulns_found(), description: m.any_vulnerabilities_found_medium_low() }
			]
		},
		{
			id: 'backup',
			label: m.backup_events(),
			icon: Archive,
			events: [
				{ id: 'backup_success', label: m.backup_succeeded(), description: m.backup_completed_successfully() },
				{ id: 'backup_failed', label: m.backup_failed(), description: m.backup_failed() },
				{ id: 'restore_success', label: m.restore_succeeded(), description: m.restore_completed_successfully() },
				{ id: 'restore_failed', label: m.restore_failed(), description: m.restore_failed() }
			]
		},
		{
			id: 'system',
			label: m.system_events(),
			icon: HardDrive,
			events: [
				{ id: 'image_pulled', label: m.image_pulled(), description: m.when_a_new_image_is_pulled() },
				{ id: 'image_prune_success', label: m.image_prune_completed(), description: m.scheduled_image_prune_completed_successfully() },
				{ id: 'image_prune_failed', label: m.image_prune_failed(), description: m.scheduled_image_prune_failed() },
				{ id: 'environment_offline', label: m.environment_offline(), description: m.environment_became_unreachable() },
				{ id: 'environment_online', label: m.environment_online(), description: m.environment_came_back_online() },
				{ id: 'disk_space_warning', label: m.disk_space_warning(), description: m.docker_disk_usage_exceeds_threshold() }
			]
		}
	];

	function toggleEvent(eventId: string) {
		if (disabled) return;

		const newTypes = selectedEventTypes.includes(eventId)
			? selectedEventTypes.filter(t => t !== eventId)
			: [...selectedEventTypes, eventId];
		onchange(newTypes);
	}

	function toggleGroupAll(group: EventGroup) {
		if (disabled) return;

		const groupEventIds = group.events.map(e => e.id);
		const allSelected = groupEventIds.every(id => selectedEventTypes.includes(id));

		let newTypes: string[];
		if (allSelected) {
			// Deselect all from this group
			newTypes = selectedEventTypes.filter(id => !groupEventIds.includes(id));
		} else {
			// Select all from this group
			const toAdd = groupEventIds.filter(id => !selectedEventTypes.includes(id));
			newTypes = [...selectedEventTypes, ...toAdd];
		}
		onchange(newTypes);
	}

	function getGroupSelectedCount(group: EventGroup): number {
		return group.events.filter(e => selectedEventTypes.includes(e.id)).length;
	}
</script>

<div class="space-y-2 max-h-[300px] overflow-y-auto pr-1">
	<!-- BETA GATE: drop the Backup events group unless FEAT_BACKUPS_ENABLED (see features.ts) -->
	{#each NOTIFICATION_EVENT_GROUPS.filter((g) => g.id !== 'backup' || $page.data.backupsEnabled) as group (group.id)}
		{@const isCollapsed = collapsedGroups.has(group.id)}
		{@const selectedCount = getGroupSelectedCount(group)}
		{@const allSelected = selectedCount === group.events.length}
		{@const someSelected = selectedCount > 0 && selectedCount < group.events.length}
		{@const GroupIcon = group.icon}

		<div class="rounded-lg border bg-card">
			<!-- Group Header -->
			<div
				class="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/50 transition-colors rounded-t-lg cursor-pointer"
				role="button"
				tabindex="0"
				onclick={() => toggleGroup(group.id)}
				onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleGroup(group.id); } }}
			>
				<div class="flex items-center gap-2">
					{#if isCollapsed}
						<ChevronRight class="w-4 h-4 text-muted-foreground" />
					{:else}
						<ChevronDown class="w-4 h-4 text-muted-foreground" />
					{/if}
					<GroupIcon class="w-4 h-4 text-muted-foreground" />
					<span class="text-sm font-medium">{group.label}</span>
					<span class="text-xs text-muted-foreground">
						({selectedCount}/{group.events.length})
					</span>
				</div>
				<button
					type="button"
					class="text-xs px-2 py-0.5 rounded border transition-colors {allSelected ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'}"
					onclick={(e) => { e.stopPropagation(); toggleGroupAll(group); }}
					{disabled}
				>
					{allSelected ? 'All' : someSelected ? 'Some' : 'None'}
				</button>
			</div>

			<!-- Group Events -->
			{#if !isCollapsed}
				<div class="ml-4 mb-2 border-l-2 border-muted bg-muted/20 rounded-bl">
					{#each group.events as event (event.id)}
						{@const isSelected = selectedEventTypes.includes(event.id)}
						<div class="flex items-center justify-between pl-3 pr-1 py-1.5 hover:bg-muted/40 transition-colors border-b border-border/30 last:border-b-0">
							<div class="flex-1 min-w-0 pr-2">
								<div class="text-xs font-medium">{event.label}</div>
								<div class="text-2xs text-muted-foreground truncate">{event.description}</div>
							</div>
							<TogglePill
								checked={isSelected}
								onchange={() => toggleEvent(event.id)}
								{disabled}
							/>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/each}
</div>
