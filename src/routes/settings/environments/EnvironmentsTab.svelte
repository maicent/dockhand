<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { orEmpty } from '$lib/i18n.js';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { fade } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import * as Table from '$lib/components/ui/table';
	import { Badge } from '$lib/components/ui/badge';
	import {
		Plus,
		Trash2,
		Pencil,
		RefreshCw,
		Wifi,
		WifiOff,
		Check,
		XCircle,
		ShieldCheck,
		Activity,
		Cpu,
		Icon,
		Route,
		UndoDot,
		Unplug,
		CircleArrowUp,
		CircleFadingArrowUp,
		Clock,
		AlertTriangle,
		GripVertical,
		RotateCcw,
		ArrowUpDown,
		FileDown
	} from 'lucide-svelte';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { licenseStore } from '$lib/stores/license';
	import { broom, whale } from '@lucide/lab';
	import ConfirmPopover from '$lib/components/ConfirmPopover.svelte';
	import { canAccess } from '$lib/stores/auth';
	import EnvironmentIcon from '$lib/components/EnvironmentIcon.svelte';
	import { getLabelColors } from '$lib/utils/label-colors';
	import { labelColorOverrides } from '$lib/stores/label-colors';
	import EnvironmentModal from './EnvironmentModal.svelte';
	import { environments as environmentsStore } from '$lib/stores/environment';
	import { environmentOrder } from '$lib/stores/environment-order';
	import { applyOrder } from '$lib/utils/apply-order';
	import { dndzone, type DndEvent } from 'svelte-dnd-action';
	import { flip } from 'svelte/animate';
	import { cubicOut } from 'svelte/easing';
	import { dashboardData } from '$lib/stores/dashboard';
	import { fetchEnvironmentDeleteCounts } from '$lib/utils/environment-delete';

	interface Props {
		editEnvId?: string | null;
		newEnv?: boolean;
	}

	let { editEnvId = null, newEnv = false }: Props = $props();

	// Environment types
	interface Environment {
		id: number;
		name: string;
		host?: string;
		port?: number;
		protocol?: string;
		tlsCa?: string;
		tlsCert?: string;
		tlsKey?: string;
		icon?: string;
		socketPath?: string;
		collectActivity: boolean;
		collectMetrics: boolean;
		highlightChanges: boolean;
		connectionType?: 'socket' | 'direct' | 'hawser-standard' | 'hawser-edge';
		labels?: string[];
		createdAt: string;
		updatedAt: string;
		updateCheckEnabled?: boolean;
		updateCheckAutoUpdate?: boolean;
		imagePruneEnabled?: boolean;
		timezone?: string;
		hawserVersion?: string;
	}

	interface TestResult {
		success: boolean;
		error?: string;
		info?: {
			serverVersion: string;
			containers: number;
			images: number;
			name: string;
			engine?: 'docker' | 'podman';
		};
	}

	interface NotificationSetting {
		id: number;
		type: 'smtp' | 'apprise';
		name: string;
		enabled: boolean;
		config: any;
		eventTypes: string[];
		createdAt: string;
		updatedAt: string;
	}

	// Environment state
	let environments = $state<Environment[]>([]);

	// The state report is a paid feature of either tier, so the control only
	// appears once a license validates.
	const canExportReport = $derived($licenseStore.licenseType === 'smb' || $licenseStore.licenseType === 'enterprise');

	let exportingReport = $state(false);

	// Fetched rather than navigated to: a navigation would drop the user on raw
	// JSON if the licence lapsed or the permission is missing.
	async function downloadReport(format: 'json' | 'csv' | 'pdf', envId?: number) {
		const params = new URLSearchParams({ format });
		if (envId !== undefined) params.set('env', String(envId));
		exportingReport = true;
		try {
			const response = await fetch(`/api/environments/report?${params}`);
			if (!response.ok) {
				const message = await response
					.json()
					.then((b) => b?.error)
					.catch(() => null);
				toast.error(message || `Export failed (${response.status})`);
				return;
			}
			const blob = await response.blob();
			const name =
				response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] ??
				`dockhand-report.${format}`;
			const url = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = name;
			link.click();
			URL.revokeObjectURL(url);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Export failed');
		} finally {
			exportingReport = false;
		}
	}
	let envLoading = $state(true);
	let showEnvModal = $state(false);
	let editingEnv = $state<Environment | null>(null);
	let testResults = $state<{ [id: number]: TestResult }>({});
	let testingEnvs = $state<Set<number>>(new Set());
	let pruneStatus = $state<{ [id: number]: 'pruning' | 'success' | 'error' | null }>({});
	let confirmPruneEnvId = $state<number | null>(null);
	// Delete confirmation dialog state — shows the on-disk paths that will be
	// wiped + the stacks-tracked counts so the user knows what they're losing.
	let showDeleteConfirm = $state(false);
	let deleteEnvTarget = $state<Environment | null>(null);
	let deleteStackCount = $state(0);
	let deleteGitStackCount = $state(0);
	let deleteCountsUnknown = $state(false);
	let deleteCountsLoading = $state(false);

	// Track which environments have scanner enabled (for shield indicator)
	let envScannerStatus = $state<{ [id: number]: boolean }>({});

	// --- Reorder ---
	// dndzone owns the gesture (pointer + touch + keyboard); we own the order.
	let reorderMode = $state(false);
	// The list dndzone is currently showing: its own during a drag, ours otherwise.
	let dragList = $state<Environment[] | null>(null);

	const orderedEnvironments = $derived(
		dragList ?? applyOrder(environments, $environmentOrder, (env) => env.id)
	);

	/** While dragging, follow dndzone's list so the row tracks the pointer. */
	function handleConsider(e: CustomEvent<DndEvent<Environment>>) {
		dragList = e.detail.items;
	}

	/** On drop, keep the new order and persist it. */
	function handleFinalize(e: CustomEvent<DndEvent<Environment>>) {
		const items = e.detail.items;
		dragList = null;
		// An environment added or removed mid-gesture would make this a partial
		// list; saving it would drop whatever the drag never saw.
		if (items.length !== environments.length) return;
		environmentOrder.save(items.map((env) => env.id));
	}

	// Notification channels for modal
	let notifications = $state<NotificationSetting[]>([]);

	// Extract all unique labels from all environments for suggestions
	const allLabels = $derived(
		[...new Set(environments.flatMap(env => env.labels || []))].sort()
	);

	// Load custom label colors
	$effect(() => { labelColorOverrides.load(); });

	// === Environment Functions ===
	async function fetchEnvironments() {
		envLoading = true;
		try {
			const response = await fetch('/api/environments');
			environments = await response.json();
			// Fetch scanner status for all environments in background
			fetchAllEnvScannerStatus();
		} catch (error) {
			console.error('Failed to fetch environments:', error);
		} finally {
			envLoading = false;
		}
	}

	async function fetchNotifications() {
		try {
			const response = await fetch('/api/notifications');
			notifications = await response.json();
		} catch (error) {
			console.error('Failed to fetch notifications:', error);
		}
	}

	async function openAddEnvModal() {
		editingEnv = null;
		await fetchNotifications(); // Refresh notifications when opening modal
		showEnvModal = true;
	}

	async function openEditEnvModal(env: Environment) {
		editingEnv = env;
		await fetchNotifications(); // Refresh notifications when opening modal
		showEnvModal = true;
	}

	function closeModal() {
		showEnvModal = false;
		editingEnv = null;
	}

	async function handleSaved() {
		await fetchEnvironments();
		// Refresh the global environments store so dropdown updates
		environmentsStore.refresh();
		// Invalidate dashboard cache so it refreshes on next visit
		dashboardData.invalidate();
	}

	function handleScannerStatusChange(envId: number, enabled: boolean) {
		envScannerStatus[envId] = enabled;
		envScannerStatus = { ...envScannerStatus };
	}

	async function deleteEnvironment(id: number) {
		const env = environments.find(e => e.id === id);
		const name = env?.name || 'environment';
		try {
			const response = await fetch(`/api/environments/${id}`, {
				method: 'DELETE'
			});

			if (response.ok) {
				toast.success(`Deleted ${name}`);
				await fetchEnvironments();
				// Refresh the global environments store so dropdown updates
				environmentsStore.refresh();
			} else {
				const data = await response.json();
				toast.error(data.error || 'Failed to delete environment');
			}
		} catch (error) {
			toast.error(m.failed_to_delete_environment());
		}
	}

	// Two-step delete: fetch the stack counts first (fail-closed) and pop the
	// dialog that lists the on-disk paths being wiped. Only on explicit
	// confirmation do we actually call deleteEnvironment().
	async function requestDeleteEnvironment(id: number) {
		const env = environments.find(e => e.id === id);
		if (!env) return;

		deleteEnvTarget = env;
		deleteStackCount = 0;
		deleteGitStackCount = 0;
		deleteCountsUnknown = true;
		deleteCountsLoading = true;
		showDeleteConfirm = true;

		const counts = await fetchEnvironmentDeleteCounts(id);
		if (deleteEnvTarget?.id !== id || !showDeleteConfirm) return;

		deleteStackCount = counts.stackCount;
		deleteGitStackCount = counts.gitStackCount;
		deleteCountsUnknown = counts.unknown;
		deleteCountsLoading = false;
	}

	async function confirmAndDelete() {
		const target = deleteEnvTarget;
		showDeleteConfirm = false;
		deleteEnvTarget = null;
		deleteCountsLoading = false;
		if (target) {
			await deleteEnvironment(target.id);
		}
	}

	function cancelDelete() {
		showDeleteConfirm = false;
		deleteEnvTarget = null;
		deleteCountsLoading = false;
	}

	async function testConnection(id: number) {
		testingEnvs.add(id);
		testingEnvs = new Set(testingEnvs);

		try {
			const response = await fetch(`/api/environments/${id}/test`, {
				method: 'POST'
			});
			const result = await response.json();
			testResults[id] = result;
			testResults = { ...testResults };
		} catch (error) {
			testResults[id] = { success: false, error: 'Connection failed' };
			testResults = { ...testResults };
		}

		testingEnvs.delete(id);
		testingEnvs = new Set(testingEnvs);
	}

	let testingAll = $state(false);

	async function testAllConnections() {
		if (testingAll || environments.length === 0) return;

		testingAll = true;

		// Show all spinners immediately, then test all envs in parallel.
		// Sequential testing was wrong for edge envs: 30s timeout × N envs = N×30s total wait.
		// Parallel: all timeouts run concurrently, total wait is max(individual timeouts) = 30s.
		environments.forEach(env => testingEnvs.add(env.id));
		testingEnvs = new Set(testingEnvs);

		await Promise.all(
			environments.map(async (env) => {
				try {
					const response = await fetch(`/api/environments/${env.id}/test`, { method: 'POST' });
					testResults[env.id] = await response.json();
				} catch {
					testResults[env.id] = { success: false, error: 'Connection failed' };
				} finally {
					testingEnvs.delete(env.id);
					testingEnvs = new Set(testingEnvs);
				}
				testResults = { ...testResults };
			})
		);

		testingAll = false;
	}

	async function pruneSystem(id: number) {
		pruneStatus[id] = 'pruning';
		pruneStatus = { ...pruneStatus };

		try {
			const response = await fetch(`/api/prune/all?env=${id}`, {
				method: 'POST'
			});
			if (response.ok) {
				pruneStatus[id] = 'success';
				// Re-test connection to update container/image counts
				testConnection(id);
			} else {
				const errorData = await response.json().catch(() => ({}));
				if (errorData.details?.includes('already running')) {
					console.warn('Prune already in progress, please wait');
				} else {
					console.error('Prune failed:', response.status, errorData, errorData.details);
				}
				pruneStatus[id] = 'error';
			}
		} catch (error) {
			console.error('Prune error:', error);
			pruneStatus[id] = 'error';
		}
		pruneStatus = { ...pruneStatus };
		confirmPruneEnvId = null;
		// Clear status after 3 seconds
		setTimeout(() => {
			pruneStatus[id] = null;
			pruneStatus = { ...pruneStatus };
		}, 3000);
	}

	// Fetch scanner status for all environments (for shield indicators)
	async function fetchAllEnvScannerStatus() {
		for (const env of environments) {
			try {
				const response = await fetch(`/api/settings/scanner?settingsOnly=true&env=${env.id}`);
				const data = await response.json();
				envScannerStatus[env.id] = data.settings?.scanner !== 'none';
			} catch (error) {
				envScannerStatus[env.id] = false;
			}
		}
		envScannerStatus = { ...envScannerStatus }; // trigger reactivity
	}

	// Track if we've already handled the editEnvId to avoid re-opening
	let handledEditId = $state<string | null>(null);
	let handledNewEnv = $state(false);

	// Auto-open modal when editEnvId is provided and environments are loaded
	$effect(() => {
		if (editEnvId && environments.length > 0 && handledEditId !== editEnvId) {
			const envId = parseInt(editEnvId, 10);
			const env = environments.find(e => e.id === envId);
			if (env) {
				handledEditId = editEnvId;
				openEditEnvModal(env);
				// Clear the edit param from URL to avoid re-opening on navigation
				goto('/settings?tab=environments', { replaceState: true, noScroll: true });
			}
		}
	});

	// Auto-open modal for new environment when newEnv is true
	$effect(() => {
		if (newEnv && !handledNewEnv) {
			handledNewEnv = true;
			openAddEnvModal();
			// Clear the new param from URL to avoid re-opening on navigation
			goto('/settings?tab=environments', { replaceState: true, noScroll: true });
		}
	});

	// Initialize on mount
	onMount(async () => {
		await fetchEnvironments();
		fetchNotifications();
		// Auto-test all environments after loading
		testAllConnections();
	});
</script>

<!-- Environments Tab Content -->
<div class="space-y-4">
	<div class="flex justify-between items-center">
		<div class="flex items-center gap-3">
			<Badge variant="secondary" class="text-xs">{m.length_total({ length: orEmpty(environments.length) })}</Badge>
		</div>
		<div class="flex gap-2">
			{#if $canAccess('environments', 'create')}
				<Button size="sm" onclick={openAddEnvModal}>
					<Plus class="w-4 h-4 mr-1" />
					{m.add_environment()}
				</Button>
			{/if}
			<Button
				size="sm"
				variant="outline"
				class="min-w-[100px]"
				onclick={testAllConnections}
				disabled={testingAll || environments.length === 0}
			>
				{#if testingAll}
					<RefreshCw class="w-4 h-4 mr-1 animate-spin" />
				{:else}
					<Wifi class="w-4 h-4 mr-1" />
				{/if}
				<span class="w-14">{m.test_all()}</span>
			</Button>
			{#if canExportReport}
				<DropdownMenu.Root>
					<DropdownMenu.Trigger>
						{#snippet child({ props })}
							<Button {...props} size="sm" variant="outline" disabled={environments.length === 0 || exportingReport}>
								<FileDown class="w-4 h-4 mr-1" />
								{m.export_report()}
							</Button>
						{/snippet}
					</DropdownMenu.Trigger>
					<DropdownMenu.Content align="end" class="w-56">
						<DropdownMenu.Label>{m.all_environments()}</DropdownMenu.Label>
						<DropdownMenu.Item onclick={() => downloadReport('pdf')}>{m.as_pdf()}</DropdownMenu.Item>
						<DropdownMenu.Item onclick={() => downloadReport('csv')}>{m.as_csv()}</DropdownMenu.Item>
						<DropdownMenu.Item onclick={() => downloadReport('json')}>{m.as_json()}</DropdownMenu.Item>
						{#if environments.length > 1}
							<DropdownMenu.Separator />
							<DropdownMenu.Label>{m.one_environment()}</DropdownMenu.Label>
							{#each environments as env (env.id)}
								<DropdownMenu.Sub>
									<DropdownMenu.SubTrigger>{env.name}</DropdownMenu.SubTrigger>
									<DropdownMenu.SubContent>
										<DropdownMenu.Item onclick={() => downloadReport('pdf', env.id)}>{m.as_pdf()}</DropdownMenu.Item>
										<DropdownMenu.Item onclick={() => downloadReport('csv', env.id)}>{m.as_csv()}</DropdownMenu.Item>
										<DropdownMenu.Item onclick={() => downloadReport('json', env.id)}>{m.as_json()}</DropdownMenu.Item>
									</DropdownMenu.SubContent>
								</DropdownMenu.Sub>
							{/each}
						{/if}
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			{/if}
			<Button size="sm" variant="outline" onclick={fetchEnvironments}>{m.refresh()}</Button>
		</div>
	</div>

	{#if envLoading && environments.length === 0}
		<p class="text-muted-foreground text-sm">{m.loading_environments()}</p>
	{:else if environments.length === 0}
		<p class="text-muted-foreground text-sm">{m.no_environments_found()}</p>
	{:else}
		<div class="border rounded-lg overflow-hidden">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head class="w-[200px]">{m.name()}</Table.Head>
						<Table.Head>{m.connection()}</Table.Head>
						<Table.Head class="w-[120px]">{m.labels()}</Table.Head>
						<Table.Head class="w-[140px]">{m.timezone()}</Table.Head>
						<Table.Head class="w-[100px]">{m.features()}</Table.Head>
						<Table.Head class="w-[120px]">{m.status()}</Table.Head>
						<Table.Head class="w-[100px]">{m.docker()}</Table.Head>
						<Table.Head class="w-[100px]">{m.hawser()}</Table.Head>
						<Table.Head class="w-[180px] text-right">{m.actions()}</Table.Head>
					</Table.Row>
				</Table.Header>
				<!-- A plain <tbody>, not Table.Body: dndzone is an action and needs the
				     element. The class is Table.Body's own. -->
				<tbody
					class="[&_tr:last-child]:border-0"
					use:dndzone={{
						items: orderedEnvironments,
						dragDisabled: !reorderMode,
						flipDurationMs: 180,
						dropTargetStyle: {}
					}}
					onconsider={handleConsider}
					onfinalize={handleFinalize}
				>
					{#each orderedEnvironments as env (env.id)}
						{@const testResult = testResults[env.id]}
						{@const isTesting = testingEnvs.has(env.id)}
						{@const hasScannerEnabled = envScannerStatus[env.id]}
						<!-- A plain <tr>, not Table.Row: dndzone needs the real element.
						     The class is Table.Row's own, so the styling is unchanged. -->
						<tr
							animate:flip={{ duration: 180, easing: cubicOut }}
							class="hover:[&,&>svelte-css-wrapper]:[&>th,td]:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors {reorderMode
								? 'cursor-grab active:cursor-grabbing'
								: ''}"
						>
							<!-- Name Column -->
							<Table.Cell>
								<div class="flex items-center gap-2">
									{#if reorderMode}
										<!-- Visual affordance only: dndzone handles the whole row,
										     pointer and keyboard alike. -->
										<GripVertical
											class="w-4 h-4 shrink-0 text-muted-foreground"
											aria-hidden="true"
										/>
									{/if}
									<EnvironmentIcon icon={env.icon || 'globe'} envId={env.id} class="w-4 h-4 text-muted-foreground shrink-0" />
									{#if env.connectionType === 'socket' || !env.connectionType}
										<span title={m.unix_socket_connection()} class="shrink-0">
											<Unplug class="w-3.5 h-3.5 text-cyan-500 glow-cyan" />
										</span>
									{:else if env.connectionType === 'direct'}
										<span title={m.direct_docker_connection()} class="shrink-0">
											<Icon iconNode={whale} class="w-3.5 h-3.5 text-blue-500 glow-blue" />
										</span>
									{:else if env.connectionType === 'hawser-standard'}
										<span title={m.hawser_agent_standard_mode()} class="shrink-0">
											<Route class="w-3.5 h-3.5 text-purple-500 glow-purple" />
										</span>
									{:else if env.connectionType === 'hawser-edge'}
										<span title={m.hawser_agent_edge_mode()} class="shrink-0">
											<UndoDot class="w-3.5 h-3.5 text-green-500 glow-green" />
										</span>
									{/if}
									{#if $canAccess('environments', 'edit')}
										<button
											type="button"
											class="font-medium truncate text-left hover:underline cursor-pointer"
											title={m.edit_environment()}
											onclick={() => openEditEnvModal(env)}
										>{env.name}</button>
									{:else}
										<span class="font-medium truncate">{env.name}</span>
									{/if}
								</div>
							</Table.Cell>

							<!-- Connection Column -->
							<Table.Cell>
								<span class="text-sm text-muted-foreground">
									{#if env.connectionType === 'socket' || !env.connectionType}
										{env.socketPath || '/var/run/docker.sock'}
									{:else if env.connectionType === 'hawser-edge'}
										{m.edge_connection_outbound()}
									{:else}
										{env.protocol || 'http'}://{env.host}:{env.port || 2375}
									{/if}
								</span>
							</Table.Cell>

							<!-- Labels Column -->
							<Table.Cell>
								{#if env.labels && env.labels.length > 0}
									<div class="flex flex-wrap gap-1">
										{#each env.labels as label}
											{@const colors = getLabelColors(label, $labelColorOverrides)}
											<span
												class="px-1.5 py-0.5 text-2xs rounded font-medium"
												style="background-color: {colors.bgColor}; color: {colors.color}"
											>
												{label}
											</span>
										{/each}
									</div>
								{:else}
									<span class="text-muted-foreground text-xs">—</span>
								{/if}
							</Table.Cell>

							<!-- Timezone Column -->
							<Table.Cell>
								{#if env.timezone}
									<div class="flex items-center gap-1.5">
										<Clock class="w-3.5 h-3.5 text-muted-foreground" />
										<span class="text-sm text-muted-foreground">{env.timezone}</span>
									</div>
								{:else}
									<span class="text-muted-foreground text-xs">—</span>
								{/if}
							</Table.Cell>

							<!-- Features Column -->
							<Table.Cell>
								<div class="flex items-center gap-1.5">
									{#if env.updateCheckEnabled}
										<span title={env.updateCheckAutoUpdate ? "Auto-update enabled" : "Update check enabled (notify only)"}>
											{#if env.updateCheckAutoUpdate}
												<CircleArrowUp class="w-4 h-4 text-green-500 glow-green" />
											{:else}
												<CircleFadingArrowUp class="w-4 h-4 text-green-500 glow-green" />
											{/if}
										</span>
									{/if}
									{#if hasScannerEnabled}
										<span title={m.vulnerability_scanning_enabled()}>
											<ShieldCheck class="w-4 h-4 text-green-500 glow-green" />
										</span>
									{/if}
									{#if env.collectActivity}
										<span title={m.activity_collection_enabled()}>
											<Activity class="w-4 h-4 text-amber-500 glow-amber" />
										</span>
									{/if}
									{#if env.collectMetrics}
										<span title={m.metrics_collection_enabled()}>
											<Cpu class="w-4 h-4 text-sky-400 glow-sky" />
										</span>
									{/if}
									{#if env.imagePruneEnabled}
										<span title={m.automatic_image_pruning_enabled()}>
											<Trash2 class="w-4 h-4 text-amber-500 glow-amber" />
										</span>
									{/if}
									{#if !env.updateCheckEnabled && !hasScannerEnabled && !env.collectActivity && !env.collectMetrics && !env.imagePruneEnabled}
										<span class="text-muted-foreground text-xs">—</span>
									{/if}
								</div>
							</Table.Cell>

							<!-- Status Column -->
							<Table.Cell>
								{#if testResult}
									{#if testResult.success}
										<div class="flex items-center gap-1.5 text-green-600 dark:text-green-400 text-sm">
											{#if isTesting}
												<RefreshCw class="w-3.5 h-3.5 animate-spin" />
											{:else}
												<Wifi class="w-3.5 h-3.5" />
											{/if}
											<span>{m.connected()}</span>
										</div>
									{:else}
										<div class="flex items-center gap-1.5 text-red-600 dark:text-red-400 text-sm" title={testResult.error}>
											{#if isTesting}
												<RefreshCw class="w-3.5 h-3.5 animate-spin" />
											{:else}
												<WifiOff class="w-3.5 h-3.5" />
											{/if}
											<span>{m.failed()}</span>
										</div>
									{/if}
								{:else if isTesting}
									<div class="flex items-center gap-1.5 text-muted-foreground text-sm">
										<RefreshCw class="w-3.5 h-3.5 animate-spin" />
										<span>{m.testing()}</span>
									</div>
								{:else}
									<span class="text-muted-foreground text-xs">{m.not_tested()}</span>
								{/if}
							</Table.Cell>

							<!-- Docker Version Column -->
							<Table.Cell>
								{#if testResult?.info?.serverVersion}
									<div class="flex items-center gap-1.5">
										<span class="text-sm text-muted-foreground">{testResult.info.serverVersion}</span>
										{#if testResult.info.engine === 'podman'}
											<Badge variant="secondary" class="text-[10px] px-1.5 py-0 leading-tight">{m.podman()}</Badge>
										{/if}
									</div>
								{:else}
									<span class="text-muted-foreground text-sm">—</span>
								{/if}
							</Table.Cell>

							<!-- Hawser Version Column -->
							<Table.Cell>
								{#if testResult?.hawser?.hawserVersion}
									<span class="text-sm text-muted-foreground">{testResult.hawser.hawserVersion}</span>
								{:else if env.hawserVersion}
									<span class="text-sm text-muted-foreground">{env.hawserVersion}</span>
								{:else}
									<span class="text-muted-foreground text-sm">—</span>
								{/if}
							</Table.Cell>

							<!-- Actions Column -->
							<Table.Cell class="text-right">
								<div class="flex items-center justify-end gap-1">
									<Button
										variant="ghost"
										size="sm"
										class="h-7 px-2"
										onclick={() => testConnection(env.id)}
										disabled={isTesting}
										title={m.test_connection()}
									>
										{#if isTesting}
											<RefreshCw class="w-3.5 h-3.5 animate-spin" />
										{:else}
											<Wifi class="w-3.5 h-3.5" />
										{/if}
									</Button>
									{#if $canAccess('environments', 'edit')}
										<Button
											variant="ghost"
											size="sm"
											class="h-7 px-2"
											onclick={() => openEditEnvModal(env)}
											title={m.edit_environment()}
										>
											<Pencil class="w-3.5 h-3.5" />
										</Button>
									{/if}
									{#if $canAccess('containers', 'remove') && $canAccess('images', 'remove') && $canAccess('volumes', 'remove') && $canAccess('networks', 'remove')}
										<ConfirmPopover
											open={confirmPruneEnvId === env.id}
											action="Prune"
											itemType="system on "
											itemName={env.name}
											title={m.system_prune()}
											position="left"
											onConfirm={() => pruneSystem(env.id)}
											onOpenChange={(open) => confirmPruneEnvId = open ? env.id : null}
										>
											{#snippet children({ open })}
												<Button
													variant="ghost"
													size="sm"
													class="h-7 px-2"
													disabled={pruneStatus[env.id] === 'pruning'}
													title={m.prune_system()}
												>
													{#if pruneStatus[env.id] === 'pruning'}
														<RefreshCw class="w-3.5 h-3.5 animate-spin" />
													{:else if pruneStatus[env.id] === 'success'}
														<Check class="w-3.5 h-3.5 text-green-600" />
													{:else if pruneStatus[env.id] === 'error'}
														<XCircle class="w-3.5 h-3.5 text-destructive" />
													{:else}
														<Icon iconNode={broom} class="w-3.5 h-3.5" />
													{/if}
												</Button>
											{/snippet}
										</ConfirmPopover>
									{/if}
									{#if $canAccess('environments', 'delete')}
										<Button
											variant="ghost"
											size="sm"
											class="h-7 px-2 text-muted-foreground hover:text-destructive"
											title={m.delete_environment_8d9c()}
											onclick={() => requestDeleteEnvironment(env.id)}
										>
											<Trash2 class="w-3.5 h-3.5" />
										</Button>
									{/if}
								</div>
							</Table.Cell>
						</tr>
					{/each}
				</tbody>
			</Table.Root>

			<div class="flex items-center gap-3 px-2 py-1 mt-1 text-xs leading-none">
				{#if reorderMode}
					<button
						type="button"
						class="flex items-center gap-1 whitespace-nowrap font-medium text-muted-foreground hover:text-foreground transition-colors"
						title={m.list_environments_by_name_again()}
						onclick={() => {
							environmentOrder.reset();
							dragList = null;
							reorderMode = false;
						}}
					>
						<RotateCcw class="w-3 h-3 shrink-0 text-red-400" />
						{m.reset()}
					</button>
					<button
						type="button"
						class="flex items-center gap-1 whitespace-nowrap font-medium text-muted-foreground hover:text-foreground transition-colors"
						onclick={() => (reorderMode = false)}
					>
						<Check class="w-3 h-3 shrink-0 text-emerald-500" />
						{m.apply()}
					</button>
				{:else}
					<button
						type="button"
						class="flex items-center gap-1 whitespace-nowrap font-medium text-muted-foreground hover:text-foreground transition-colors"
						title={m.drag_environments_into_the_order_you_want_them_l()}
						onclick={() => (reorderMode = true)}
					>
						<ArrowUpDown class="w-3 h-3 shrink-0" />
						{m.reorder()}
					</button>
				{/if}
			</div>
		</div>
	{/if}
</div>

<EnvironmentModal
	bind:open={showEnvModal}
	environment={editingEnv}
	{notifications}
	existingLabels={allLabels}
	onClose={closeModal}
	onSaved={handleSaved}
	onScannerStatusChange={handleScannerStatusChange}
/>

<!-- Delete environment confirmation. Lists the on-disk paths that will be
     wiped + the count of stacks tracked under this env. Fail-closed:
     if the stack-count fetch fails, the dialog still shows but the body
     warns that the count couldn't be enumerated. -->
<Dialog.Root bind:open={showDeleteConfirm}>
	<Dialog.Content class="max-w-2xl">
		<Dialog.Header>
			<Dialog.Title class="flex items-center gap-2">
				<AlertTriangle class="w-5 h-5 text-destructive" />
				{m.delete_environment()}
			</Dialog.Title>
			<Dialog.Description class="pt-2 space-y-3 text-sm">
				{#if deleteEnvTarget}
					<p>
						{m.the_environment()}
						<code class="text-xs bg-muted px-1 py-0.5 rounded">{deleteEnvTarget.name}</code>
						{m.and_the_following_directories_will_be_permanentl()}
					</p>
					<div class="space-y-1 text-xs font-mono bg-muted/40 rounded-md p-3 border overflow-x-auto">
						<div class="flex items-center gap-2 whitespace-nowrap">
							<Trash2 class="w-3.5 h-3.5 shrink-0 text-destructive" />
							<code class="whitespace-nowrap">{m.data_dir_stacks_name({ name: orEmpty(deleteEnvTarget.name) })}</code>
						</div>
						<div class="flex items-center gap-2 whitespace-nowrap">
							<Trash2 class="w-3.5 h-3.5 shrink-0 text-destructive" />
							<code class="whitespace-nowrap">{m.data_dir_git_repos_name({ name: orEmpty(deleteEnvTarget.name) })}</code>
						</div>
					</div>
					{#if deleteCountsLoading}
						<p class="flex items-center gap-2">
							<RefreshCw class="w-3.5 h-3.5 animate-spin" />
							{m.checking_tracked_stacks()}
						</p>
					{:else if deleteCountsUnknown}
						<p>
							{m.couldnt_list_the_stacks_on_this_environment_proc()}
						</p>
					{:else if deleteStackCount === 0 && deleteGitStackCount === 0}
						<p>{m.no_stacks_are_currently_tracked_on_this_environm()}</p>
					{:else}
						<p>
							{#if deleteStackCount > 0 && deleteGitStackCount > 0}
								<strong>{m.deletestackcount_stack_arg2({ deleteStackCount: orEmpty(deleteStackCount), arg2: orEmpty(deleteStackCount === 1 ? '' : 's') })}</strong>
								{m.and()} <strong>{m.deletegitstackcount_git_stack_arg2({ deleteGitStackCount: orEmpty(deleteGitStackCount), arg2: orEmpty(deleteGitStackCount === 1 ? '' : 's') })}</strong>
								{m.tracked_here_will_be_removed_from_dockhands_data()}
							{:else if deleteStackCount > 0}
								<strong>{m.deletestackcount_stack_arg2({ deleteStackCount: orEmpty(deleteStackCount), arg2: orEmpty(deleteStackCount === 1 ? '' : 's') })}</strong>
								{m.tracked_here_will_be_removed_from_dockhands_data()}
							{:else}
								<strong>{m.deletegitstackcount_git_stack_arg2({ deleteGitStackCount: orEmpty(deleteGitStackCount), arg2: orEmpty(deleteGitStackCount === 1 ? '' : 's') })}</strong>
								{m.tracked_here_will_be_removed_from_dockhands_data()}
							{/if}
						</p>
					{/if}
					<p class="text-muted-foreground">
						{m.running_containers_on_the_docker_hawser_host_are()} <strong>{m.not()}</strong> {m.stopped_you_can_stop_or_remove_them_separately()}
					</p>
				{/if}
			</Dialog.Description>
		</Dialog.Header>
		<div class="flex justify-end gap-2 mt-4">
			<Button variant="outline" onclick={cancelDelete}>
				{m.cancel()}
			</Button>
			<Button variant="destructive" onclick={confirmAndDelete}>
				<Trash2 class="w-4 h-4 mr-2" />
				{m.delete_environment_8d9c()}
			</Button>
		</div>
	</Dialog.Content>
</Dialog.Root>
