<script lang="ts">
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
		AlertTriangle
	} from 'lucide-svelte';
	import * as Dialog from '$lib/components/ui/dialog';
	import { broom, whale } from '@lucide/lab';
	import ConfirmPopover from '$lib/components/ConfirmPopover.svelte';
	import { canAccess } from '$lib/stores/auth';
	import EnvironmentIcon from '$lib/components/EnvironmentIcon.svelte';
	import { getLabelColors } from '$lib/utils/label-colors';
	import { labelColorOverrides } from '$lib/stores/label-colors';
	import EnvironmentModal from './EnvironmentModal.svelte';
	import { environments as environmentsStore } from '$lib/stores/environment';
	import { dashboardData } from '$lib/stores/dashboard';
	import * as m from '$lib/paraglide/messages';

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

	// Track which environments have scanner enabled (for shield indicator)
	let envScannerStatus = $state<{ [id: number]: boolean }>({});

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
				toast.success(m.settings_env_deleted({ name }));
				await fetchEnvironments();
				// Refresh the global environments store so dropdown updates
				environmentsStore.refresh();
			} else {
				const data = await response.json();
				toast.error(data.error || m.settings_env_delete_failed());
			}
		} catch (error) {
			toast.error(m.settings_env_delete_failed());
		}
	}

	// Two-step delete: fetch the stack counts first (fail-closed) and pop the
	// dialog that lists the on-disk paths being wiped. Only on explicit
	// confirmation do we actually call deleteEnvironment().
	async function requestDeleteEnvironment(id: number) {
		const env = environments.find(e => e.id === id);
		if (!env) return;

		const [stacksRes, gitRes] = await Promise.all([
			fetch(`/api/stacks?env=${id}`).catch(() => null),
			fetch(`/api/git/stacks?env=${id}`).catch(() => null)
		]);

		let unknown = false;
		let stacks: unknown[] = [];
		let gitStacks: unknown[] = [];
		if (stacksRes?.ok) {
			try { stacks = await stacksRes.json(); } catch { unknown = true; }
		} else {
			unknown = true;
		}
		if (gitRes?.ok) {
			try { gitStacks = await gitRes.json(); } catch { unknown = true; }
		} else {
			unknown = true;
		}
		deleteStackCount = Array.isArray(stacks) ? stacks.length : 0;
		deleteGitStackCount = Array.isArray(gitStacks) ? gitStacks.length : 0;
		deleteCountsUnknown = unknown;
		deleteEnvTarget = env;
		showDeleteConfirm = true;
	}

	async function confirmAndDelete() {
		const target = deleteEnvTarget;
		showDeleteConfirm = false;
		deleteEnvTarget = null;
		if (target) {
			await deleteEnvironment(target.id);
		}
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
			testResults[id] = { success: false, error: m.settings_env_connection_failed() };
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
					testResults[env.id] = { success: false, error: m.settings_env_connection_failed() };
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
			<Badge variant="secondary" class="text-xs">{m.settings_env_total({ count: environments.length })}</Badge>
		</div>
		<div class="flex gap-2">
			{#if $canAccess('environments', 'create')}
				<Button size="sm" onclick={openAddEnvModal}>
					<Plus class="w-4 h-4 mr-1" />
					{m.settings_env_add()}
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
				<span class="w-14">{m.settings_env_test_all()}</span>
			</Button>
			<Button size="sm" variant="outline" onclick={fetchEnvironments}>{m.common_refresh()}</Button>
		</div>
	</div>

	{#if envLoading && environments.length === 0}
		<p class="text-muted-foreground text-sm">{m.settings_env_loading()}</p>
	{:else if environments.length === 0}
		<p class="text-muted-foreground text-sm">{m.settings_env_none()}</p>
	{:else}
		<div class="border rounded-lg overflow-hidden">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head class="w-[200px]">{m.settings_env_col_name()}</Table.Head>
						<Table.Head>{m.settings_env_col_connection()}</Table.Head>
						<Table.Head class="w-[120px]">{m.settings_env_col_labels()}</Table.Head>
						<Table.Head class="w-[140px]">{m.settings_env_col_timezone()}</Table.Head>
						<Table.Head class="w-[100px]">{m.settings_env_col_features()}</Table.Head>
						<Table.Head class="w-[120px]">{m.settings_env_col_status()}</Table.Head>
						<Table.Head class="w-[100px]">Docker</Table.Head>
						<Table.Head class="w-[100px]">Hawser</Table.Head>
						<Table.Head class="w-[180px] text-right">{m.common_actions()}</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each environments as env (env.id)}
						{@const testResult = testResults[env.id]}
						{@const isTesting = testingEnvs.has(env.id)}
						{@const hasScannerEnabled = envScannerStatus[env.id]}
						<Table.Row>
							<!-- Name Column -->
							<Table.Cell>
								<div class="flex items-center gap-2">
									<EnvironmentIcon icon={env.icon || 'globe'} envId={env.id} class="w-4 h-4 text-muted-foreground shrink-0" />
									{#if env.connectionType === 'socket' || !env.connectionType}
										<span title={m.settings_env_tip_socket()} class="shrink-0">
											<Unplug class="w-3.5 h-3.5 text-cyan-500 glow-cyan" />
										</span>
									{:else if env.connectionType === 'direct'}
										<span title={m.settings_env_tip_direct()} class="shrink-0">
											<Icon iconNode={whale} class="w-3.5 h-3.5 text-blue-500 glow-blue" />
										</span>
									{:else if env.connectionType === 'hawser-standard'}
										<span title={m.settings_env_tip_hawser_standard()} class="shrink-0">
											<Route class="w-3.5 h-3.5 text-purple-500 glow-purple" />
										</span>
									{:else if env.connectionType === 'hawser-edge'}
										<span title={m.settings_env_tip_hawser_edge()} class="shrink-0">
											<UndoDot class="w-3.5 h-3.5 text-green-500 glow-green" />
										</span>
									{/if}
									<span class="font-medium truncate">{env.name}</span>
								</div>
							</Table.Cell>

							<!-- Connection Column -->
							<Table.Cell>
								<span class="text-sm text-muted-foreground">
									{#if env.connectionType === 'socket' || !env.connectionType}
										{env.socketPath || '/var/run/docker.sock'}
									{:else if env.connectionType === 'hawser-edge'}
										{m.settings_env_edge_connection()}
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
										<span title={env.updateCheckAutoUpdate ? m.settings_env_tip_auto_update() : m.settings_env_tip_update_check()}>
											{#if env.updateCheckAutoUpdate}
												<CircleArrowUp class="w-4 h-4 text-green-500 glow-green" />
											{:else}
												<CircleFadingArrowUp class="w-4 h-4 text-green-500 glow-green" />
											{/if}
										</span>
									{/if}
									{#if hasScannerEnabled}
										<span title={m.settings_env_tip_scanning()}>
											<ShieldCheck class="w-4 h-4 text-green-500 glow-green" />
										</span>
									{/if}
									{#if env.collectActivity}
										<span title={m.settings_env_tip_activity()}>
											<Activity class="w-4 h-4 text-amber-500 glow-amber" />
										</span>
									{/if}
									{#if env.collectMetrics}
										<span title={m.settings_env_tip_metrics()}>
											<Cpu class="w-4 h-4 text-sky-400 glow-sky" />
										</span>
									{/if}
									{#if env.imagePruneEnabled}
										<span title={m.settings_env_tip_prune()}>
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
											<span>{m.settings_env_status_connected()}</span>
										</div>
									{:else}
										<div class="flex items-center gap-1.5 text-red-600 dark:text-red-400 text-sm" title={testResult.error}>
											{#if isTesting}
												<RefreshCw class="w-3.5 h-3.5 animate-spin" />
											{:else}
												<WifiOff class="w-3.5 h-3.5" />
											{/if}
											<span>{m.settings_env_status_failed()}</span>
										</div>
									{/if}
								{:else if isTesting}
									<div class="flex items-center gap-1.5 text-muted-foreground text-sm">
										<RefreshCw class="w-3.5 h-3.5 animate-spin" />
										<span>{m.settings_env_status_testing()}</span>
									</div>
								{:else}
									<span class="text-muted-foreground text-xs">{m.settings_env_status_not_tested()}</span>
								{/if}
							</Table.Cell>

							<!-- Docker Version Column -->
							<Table.Cell>
								{#if testResult?.info?.serverVersion}
									<div class="flex items-center gap-1.5">
										<span class="text-sm text-muted-foreground">{testResult.info.serverVersion}</span>
										{#if testResult.info.engine === 'podman'}
											<Badge variant="secondary" class="text-[10px] px-1.5 py-0 leading-tight">Podman</Badge>
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
										title={m.settings_env_tip_test()}
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
											title={m.settings_env_tip_edit()}
										>
											<Pencil class="w-3.5 h-3.5" />
										</Button>
									{/if}
									{#if $canAccess('containers', 'remove') && $canAccess('images', 'remove') && $canAccess('volumes', 'remove') && $canAccess('networks', 'remove')}
										<ConfirmPopover
											open={confirmPruneEnvId === env.id}
											action={m.settings_env_prune_action()}
											itemType={m.settings_env_prune_item()}
											itemName={env.name}
											title={m.settings_env_prune_title()}
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
													title={m.settings_env_tip_prune_system()}
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
											title={m.settings_env_tip_delete()}
											onclick={() => requestDeleteEnvironment(env.id)}
										>
											<Trash2 class="w-3.5 h-3.5" />
										</Button>
									{/if}
								</div>
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
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
				{m.settings_env_delete_title()}
			</Dialog.Title>
			<Dialog.Description class="pt-2 space-y-3 text-sm">
				{#if deleteEnvTarget}
					<p>
						{m.settings_env_delete_intro_pre()}
						<code class="text-xs bg-muted px-1 py-0.5 rounded">{deleteEnvTarget.name}</code>
						{m.settings_env_delete_intro_post()}
					</p>
					<div class="space-y-1 text-xs font-mono bg-muted/40 rounded-md p-3 border overflow-x-auto">
						<div class="flex items-center gap-2 whitespace-nowrap">
							<Trash2 class="w-3.5 h-3.5 shrink-0 text-destructive" />
							<code class="whitespace-nowrap">$DATA_DIR/stacks/{deleteEnvTarget.name}/</code>
						</div>
						<div class="flex items-center gap-2 whitespace-nowrap">
							<Trash2 class="w-3.5 h-3.5 shrink-0 text-destructive" />
							<code class="whitespace-nowrap">$DATA_DIR/git-repos/{deleteEnvTarget.name}/</code>
						</div>
					</div>
					{#if deleteCountsUnknown}
						<p>
							{m.settings_env_delete_unknown()}
						</p>
					{:else if deleteStackCount === 0 && deleteGitStackCount === 0}
						<p>{m.settings_env_delete_no_stacks()}</p>
					{:else}
						<p>
							{#if deleteStackCount > 0 && deleteGitStackCount > 0}
								<strong>{deleteStackCount} {deleteStackCount === 1 ? m.settings_env_delete_stack_one() : m.settings_env_delete_stack_many()}</strong>
								{m.settings_env_delete_and()} <strong>{deleteGitStackCount} {deleteGitStackCount === 1 ? m.settings_env_delete_gitstack_one() : m.settings_env_delete_gitstack_many()}</strong>
								{m.settings_env_delete_removed_suffix()}
							{:else if deleteStackCount > 0}
								<strong>{deleteStackCount} {deleteStackCount === 1 ? m.settings_env_delete_stack_one() : m.settings_env_delete_stack_many()}</strong>
								{m.settings_env_delete_removed_suffix()}
							{:else}
								<strong>{deleteGitStackCount} {deleteGitStackCount === 1 ? m.settings_env_delete_gitstack_one() : m.settings_env_delete_gitstack_many()}</strong>
								{m.settings_env_delete_removed_suffix()}
							{/if}
						</p>
					{/if}
					<p class="text-muted-foreground">
						{m.settings_env_delete_running_pre()} <strong>{m.settings_env_delete_running_not()}</strong>
						{m.settings_env_delete_running_post()}
					</p>
				{/if}
			</Dialog.Description>
		</Dialog.Header>
		<div class="flex justify-end gap-2 mt-4">
			<Button variant="outline" onclick={() => (showDeleteConfirm = false)}>
				{m.common_cancel()}
			</Button>
			<Button variant="destructive" onclick={confirmAndDelete}>
				<Trash2 class="w-4 h-4 mr-2" />
				{m.settings_env_tip_delete()}
			</Button>
		</div>
	</Dialog.Content>
</Dialog.Root>
