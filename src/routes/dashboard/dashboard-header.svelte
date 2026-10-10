<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import {
		ShieldCheck,
		Activity,
		Cpu,
		Wifi,
		WifiOff,
		Settings,
		Route,
		UndoDot,
		Unplug,
		Icon,
		CircleArrowUp,
		CircleFadingArrowUp,
		Loader2
	} from 'lucide-svelte';
	import { whale } from '@lucide/lab';
	import EnvironmentIcon from '$lib/components/EnvironmentIcon.svelte';
	import { goto } from '$app/navigation';
	import { canAccess } from '$lib/stores/auth';

	type ConnectionType = 'socket' | 'direct' | 'hawser-standard' | 'hawser-edge';

	interface Props {
		name: string;
		host?: string;
		port?: number | null;
		icon: string;
		socketPath?: string;
		online?: boolean; // undefined = connecting, false = offline, true = online
		scannerEnabled: boolean;
		collectActivity: boolean;
		collectMetrics: boolean;
		updateCheckEnabled?: boolean;
		updateCheckAutoUpdate?: boolean;
		connectionType?: ConnectionType;
		environmentId: number;
		width?: number;
		height?: number;
		compact?: boolean;
	}

	// Derived states for connecting/offline
	const showConnecting = $derived(online === undefined);
	const showOffline = $derived(online === false);

	let {
		name,
		host,
		port = null,
		icon,
		socketPath,
		online,
		scannerEnabled,
		collectActivity,
		collectMetrics,
		updateCheckEnabled = false,
		updateCheckAutoUpdate = false,
		connectionType = 'socket',
		environmentId,
		width = 1,
		height = 1,
		compact = false
	}: Props = $props();

	// Format host with port for display
	const hostDisplay = $derived(
		connectionType === 'socket' ? (socketPath || '/var/run/docker.sock') :
		connectionType === 'hawser-edge' ? 'Edge connection' :
		(port ? `${host}:${port}` : host || 'Unknown host')
	);

	const canEdit = $derived($canAccess('environments', 'edit'));

	function openSettings(e: MouseEvent) {
		e.stopPropagation();
		goto(`/settings?tab=environments&edit=${environmentId}`);
	}

	function stopPointerPropagation(e: PointerEvent) {
		e.stopPropagation();
	}
</script>

{#if compact}
	<!-- Compact header for mini tiles -->
	<div class="flex items-center gap-2 min-w-0 flex-1">
		<div class="p-1.5 rounded-lg {online ? 'bg-primary/10' : 'bg-muted'}">
			<EnvironmentIcon {icon} envId={environmentId} class="w-4 h-4 {online ? 'text-primary' : 'text-muted-foreground'}" />
		</div>
		<div class="min-w-0 flex-1">
			<div class="flex items-center gap-1.5">
				<span class="font-medium text-sm truncate">{name}</span>
				{#if showConnecting}
					<Loader2 class="w-3 h-3 text-muted-foreground animate-spin shrink-0" />
				{:else if showOffline}
					<WifiOff class="w-3 h-3 text-red-500 shrink-0" />
				{:else}
					<Wifi class="w-3 h-3 text-green-500 shrink-0" />
				{/if}
			</div>
			<span class="text-xs text-muted-foreground truncate block">{hostDisplay}</span>
		</div>
	</div>
{:else}
	<!-- Full header for standard tiles -->
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-2 min-w-0 flex-1">
			<div class="p-1.5 rounded-lg {online ? 'bg-primary/10' : 'bg-muted'}">
				<EnvironmentIcon {icon} envId={environmentId} class="w-4 h-4 {online ? 'text-primary' : 'text-muted-foreground'}" />
			</div>
			{#if connectionType === 'socket' || !connectionType}
				<span title={m.unix_socket_connection()}>
					<Unplug class="w-4 h-4 text-cyan-500 glow-cyan" />
				</span>
			{:else if connectionType === 'direct'}
				<span title={m.direct_docker_connection()}>
					<Icon iconNode={whale} class="w-4 h-4 text-blue-500 glow-blue" />
				</span>
			{:else if connectionType === 'hawser-standard'}
				<span title={m.hawser_agent_standard_mode()}>
					<Route class="w-4 h-4 text-purple-500 glow-purple" />
				</span>
			{:else if connectionType === 'hawser-edge'}
				<span title={m.hawser_agent_edge_mode()}>
					<UndoDot class="w-4 h-4 text-green-500 glow-green" />
				</span>
			{/if}
			<div class="min-w-0 flex-1">
				<div class="flex items-center gap-1.5">
					<span class="font-medium text-sm truncate">{name}</span>
					{#if showConnecting}
						<Loader2 class="w-3 h-3 text-muted-foreground animate-spin shrink-0" />
					{:else if showOffline}
						<WifiOff class="w-3 h-3 text-red-500 shrink-0" />
					{:else}
						<Wifi class="w-3 h-3 text-green-500 shrink-0" />
					{/if}
				</div>
				<span class="text-xs text-muted-foreground truncate block">{hostDisplay}</span>
			</div>
		</div>

		<div class="flex items-center gap-1.5">
			{#if updateCheckEnabled}
				<span title={updateCheckAutoUpdate ? "Auto-update enabled" : "Update check enabled (notify only)"}>
					{#if updateCheckAutoUpdate}
						<CircleArrowUp class="w-4 h-4 text-green-500 glow-green" />
					{:else}
						<CircleFadingArrowUp class="w-4 h-4 text-green-500 glow-green" />
					{/if}
				</span>
			{/if}
			{#if scannerEnabled}
				<span title={m.vulnerability_scanning_enabled()}>
					<ShieldCheck class="w-4 h-4 text-green-500 glow-green" />
				</span>
			{/if}
			{#if collectActivity}
				<span title={m.activity_collection_enabled()}>
					<Activity class="w-4 h-4 text-amber-500 glow-amber" />
				</span>
			{/if}
			{#if collectMetrics}
				<span title={m.metrics_collection_enabled()}>
					<Cpu class="w-4 h-4 text-sky-400 glow-sky" />
				</span>
			{/if}
			{#if canEdit}
				<button
					onpointerdown={stopPointerPropagation}
					onclick={openSettings}
					class="p-0.5 rounded hover:bg-muted transition-colors"
					title={m.edit_environment_settings()}
				>
					<Settings class="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
				</button>
			{/if}
		</div>
	</div>
{/if}
