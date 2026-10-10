<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { orEmpty } from '$lib/i18n.js';
	import { Button } from '$lib/components/ui/button';
	import { page } from '$app/stores'; // BETA GATE: backups feature flag
	import * as Dialog from '$lib/components/ui/dialog';
	import { Label } from '$lib/components/ui/label';
	import { Input } from '$lib/components/ui/input';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { TogglePill } from '$lib/components/ui/toggle-pill';
	import { Shield, Pencil, Plus, Check, RefreshCw, Box, Image, HardDrive, Cable, Layers, Globe, Download, Bell, Sliders, Settings, Users, Eye, SquarePlus, Play, Square, RotateCcw, Trash2, Terminal, ScrollText, Search, Upload, Plug, Unplug, Copy, GitBranch, KeyRound, Building2, Container, TriangleAlert, ClipboardList, Activity, Timer, Archive } from 'lucide-svelte';
	import EnvironmentIcon from '$lib/components/EnvironmentIcon.svelte';
	import * as Alert from '$lib/components/ui/alert';
	import { focusFirstInput } from '$lib/utils';

	export interface Role {
		id: number;
		name: string;
		description?: string;
		isSystem: boolean;
		permissions: any;
		environmentIds?: number[] | null;
		createdAt: string;
	}

	interface Environment {
		id: number;
		name: string;
		icon?: string;
	}

	interface Props {
		open: boolean;
		role?: Role | null;
		copyFrom?: Role | null;
		environments?: Environment[];
		onClose: () => void;
		onSaved: () => void;
	}

	let { open = $bindable(), role = null, copyFrom = null, environments = [], onClose, onSaved }: Props = $props();

	const isEditing = $derived(role !== null);
	const isCopying = $derived(copyFrom !== null);

	// Form state
	let formName = $state('');
	let formDescription = $state('');
	let formError = $state('');
	let formErrors = $state<{ name?: string }>({});
	let formSaving = $state(false);
	let formAllEnvironments = $state(false); // true = applies to all envs, false = specific envs
	let formEnvironmentIds = $state<number[]>([]); // selected env IDs when not all
	let formPermissions = $state<{
		containers: string[];
		images: string[];
		volumes: string[];
		networks: string[];
		stacks: string[];
		environments: string[];
		registries: string[];
		notifications: string[];
		configsets: string[];
		settings: string[];
		users: string[];
		git: string[];
		license: string[];
		audit_logs: string[];
		activity: string[];
		schedules: string[];
		secrets: string[];
		backups: string[];
	}>({
		containers: [],
		images: [],
		volumes: [],
		networks: [],
		stacks: [],
		environments: [],
		registries: [],
		notifications: [],
		configsets: [],
		settings: [],
		users: [],
		git: [],
		license: [],
		audit_logs: [],
		activity: [],
		schedules: [],
		secrets: [],
		backups: []
	});


	// Permission definitions - separated into system and environment categories
	const systemPermissions = {
		users: [
			{ key: 'view', label: m.view_users() },
			{ key: 'create', label: m.create_users() },
			{ key: 'edit', label: m.edit_users() },
			{ key: 'delete', label: m.delete_users() }
		],
		settings: [
			{ key: 'view', label: m.view_settings() },
			{ key: 'edit', label: m.edit_settings() }
		],
		environments: [
			{ key: 'view', label: m.view_environments() },
			{ key: 'create', label: m.create_environments() },
			{ key: 'edit', label: m.edit_environments() },
			{ key: 'delete', label: m.delete_environments() }
		],
		registries: [
			{ key: 'view', label: m.view_registries() },
			{ key: 'create', label: m.create_registries() },
			{ key: 'edit', label: m.edit_registries() },
			{ key: 'delete', label: m.delete_registries() }
		],
		notifications: [
			{ key: 'view', label: m.view_notifications() },
			{ key: 'create', label: m.create_notifications() },
			{ key: 'edit', label: m.edit_notifications() },
			{ key: 'delete', label: m.delete_notifications() },
			{ key: 'test', label: m.test_notifications() }
		],
		configsets: [
			{ key: 'view', label: m.view_config_sets() },
			{ key: 'create', label: m.create_config_sets() },
			{ key: 'edit', label: m.edit_config_sets() },
			{ key: 'delete', label: m.delete_config_sets() }
		],
		git: [
			{ key: 'view', label: m.view_credentials_repos() },
			{ key: 'create', label: m.create_credentials_repos() },
			{ key: 'edit', label: m.edit_credentials_repos() },
			{ key: 'delete', label: m.delete_credentials_repos() }
		],
		license: [
			{ key: 'manage', label: m.manage_license() }
		],
		audit_logs: [
			{ key: 'view', label: m.view_audit_logs() }
		],
		schedules: [
			{ key: 'view', label: m.view_schedules() },
			{ key: 'edit', label: m.edit_schedules() },
			{ key: 'run', label: m.run_schedules() }
		],
		secrets: [
			{ key: 'view', label: m.view_secrets() },
			{ key: 'create', label: m.create_secrets() },
			{ key: 'edit', label: m.edit_secrets() },
			{ key: 'delete', label: m.delete_secrets() }
		],
		backups: [
			{ key: 'view', label: m.view_backups() },
			{ key: 'run', label: m.run_backups() },
			{ key: 'restore', label: m.restore_from_backups() },
			{ key: 'manage', label: m.manage_destinations() }
		]
	};

	const environmentPermissions = {
		activity: [
			{ key: 'view', label: m.view_activity() }
		],
		containers: [
			{ key: 'view', label: m.view_containers() },
			{ key: 'create', label: m.create_containers() },
			{ key: 'start', label: m.start_containers() },
			{ key: 'stop', label: m.stop_containers() },
			{ key: 'restart', label: m.restart_containers() },
			{ key: 'remove', label: m.remove_containers() },
			{ key: 'exec', label: m.execute_terminal() },
			{ key: 'logs', label: m.view_logs() },
			{ key: 'inspect', label: m.inspect_containers() }
		],
		images: [
			{ key: 'view', label: m.view_images() },
			{ key: 'pull', label: m.pull_images() },
			{ key: 'load', label: m.load_images_from_tar() },
			{ key: 'push', label: m.push_images() },
			{ key: 'remove', label: m.remove_images() },
			{ key: 'build', label: m.build_images() },
			{ key: 'inspect', label: m.inspect_images() }
		],
		volumes: [
			{ key: 'view', label: m.view_volumes() },
			{ key: 'create', label: m.create_volumes() },
			{ key: 'remove', label: m.remove_volumes() },
			{ key: 'inspect', label: m.inspect_volumes() }
		],
		networks: [
			{ key: 'view', label: m.view_networks() },
			{ key: 'create', label: m.create_networks() },
			{ key: 'remove', label: m.remove_networks() },
			{ key: 'inspect', label: m.inspect_networks() },
			{ key: 'connect', label: m.connect_containers() },
			{ key: 'disconnect', label: m.disconnect_containers() }
		],
		stacks: [
			{ key: 'view', label: m.view_stacks() },
			{ key: 'create', label: m.create_stacks() },
			{ key: 'start', label: m.start_stacks() },
			{ key: 'stop', label: m.stop_stacks() },
			{ key: 'remove', label: m.remove_stacks() },
			{ key: 'edit', label: m.edit_stacks() }
		]
	};

	const categoryIcons: Record<string, typeof Box> = {
		containers: Container,
		images: Image,
		volumes: HardDrive,
		networks: Cable,
		stacks: Layers,
		environments: Globe,
		registries: Download,
		notifications: Bell,
		configsets: Sliders,
		settings: Settings,
		users: Users,
		git: GitBranch,
		license: KeyRound,
		audit_logs: ClipboardList,
		activity: Activity,
		schedules: Timer,
		secrets: KeyRound,
		backups: Archive
	};

	const categoryColorsSolid: Record<string, string> = {
		containers: 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-800',
		images: 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-400 border-purple-300 dark:border-purple-800',
		volumes: 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800',
		networks: 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400 border-green-300 dark:border-green-800',
		stacks: 'bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-400 border-cyan-300 dark:border-cyan-800',
		environments: 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 border-indigo-300 dark:border-indigo-800',
		registries: 'bg-pink-100 dark:bg-pink-950 text-pink-700 dark:text-pink-400 border-pink-300 dark:border-pink-800',
		notifications: 'bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-400 border-orange-300 dark:border-orange-800',
		configsets: 'bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-400 border-teal-300 dark:border-teal-800',
		settings: 'bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-400 border-slate-300 dark:border-slate-700',
		users: 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-800',
		git: 'bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-400 border-violet-300 dark:border-violet-800',
		license: 'bg-yellow-100 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-400 border-yellow-300 dark:border-yellow-800',
		audit_logs: 'bg-stone-100 dark:bg-stone-950 text-stone-700 dark:text-stone-400 border-stone-300 dark:border-stone-800',
		activity: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800',
		schedules: 'bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-400 border-sky-300 dark:border-sky-800',
		secrets: 'bg-fuchsia-100 dark:bg-fuchsia-950 text-fuchsia-700 dark:text-fuchsia-400 border-fuchsia-300 dark:border-fuchsia-800',
		backups: 'bg-lime-100 dark:bg-lime-950 text-lime-700 dark:text-lime-400 border-lime-300 dark:border-lime-800'
	};

	const permissionIcons: Record<string, typeof Eye> = {
		view: Eye,
		create: SquarePlus,
		start: Play,
		stop: Square,
		restart: RotateCcw,
		remove: Trash2,
		delete: Trash2,
		exec: Terminal,
		logs: ScrollText,
		inspect: Search,
		pull: Download,
		push: Upload,
		build: Box,
		connect: Plug,
		disconnect: Unplug,
		edit: Pencil,
		test: Play,
		run: Play,
		manage: Settings
	};

	function resetForm() {
		formName = '';
		formDescription = '';
		formError = '';
		formErrors = {};
		formSaving = false;
		formAllEnvironments = false;
		formEnvironmentIds = [];
		formPermissions = {
			containers: [],
			images: [],
			volumes: [],
			networks: [],
			stacks: [],
			environments: [],
			registries: [],
			notifications: [],
			configsets: [],
			settings: [],
			users: [],
			git: [],
			license: [],
			audit_logs: [],
			activity: [],
			schedules: [],
			secrets: [],
			backups: []
		};
	}

	// Initialize form when role changes or modal opens
	$effect(() => {
		if (open) {
			if (role) {
				// Editing existing role
				formName = role.name;
				formDescription = role.description || '';
				// Environment scope: null = all environments
				formAllEnvironments = role.environmentIds === null || role.environmentIds === undefined;
				formEnvironmentIds = role.environmentIds ? [...role.environmentIds] : [];
				formPermissions = {
					containers: [...(role.permissions.containers || [])],
					images: [...(role.permissions.images || [])],
					volumes: [...(role.permissions.volumes || [])],
					networks: [...(role.permissions.networks || [])],
					stacks: [...(role.permissions.stacks || [])],
					environments: [...(role.permissions.environments || [])],
					registries: [...(role.permissions.registries || [])],
					notifications: [...(role.permissions.notifications || [])],
					configsets: [...(role.permissions.configsets || [])],
					settings: [...(role.permissions.settings || [])],
					users: [...(role.permissions.users || [])],
					git: [...(role.permissions.git || [])],
					license: [...(role.permissions.license || [])],
					audit_logs: [...(role.permissions.audit_logs || [])],
					activity: [...(role.permissions.activity || [])],
					schedules: [...(role.permissions.schedules || [])],
					secrets: [...(role.permissions.secrets || [])],
					backups: [...(role.permissions.backups || [])]
				};
				formError = '';
				formErrors = {};
				formSaving = false;
			} else if (copyFrom) {
				// Copying from existing role - new role with pre-filled permissions
				formName = `${copyFrom.name} (copy)`;
				formDescription = copyFrom.description || '';
				// Copy environment scope from source role
				formAllEnvironments = copyFrom.environmentIds === null || copyFrom.environmentIds === undefined;
				formEnvironmentIds = copyFrom.environmentIds ? [...copyFrom.environmentIds] : [];
				formPermissions = {
					containers: [...(copyFrom.permissions.containers || [])],
					images: [...(copyFrom.permissions.images || [])],
					volumes: [...(copyFrom.permissions.volumes || [])],
					networks: [...(copyFrom.permissions.networks || [])],
					stacks: [...(copyFrom.permissions.stacks || [])],
					environments: [...(copyFrom.permissions.environments || [])],
					registries: [...(copyFrom.permissions.registries || [])],
					notifications: [...(copyFrom.permissions.notifications || [])],
					configsets: [...(copyFrom.permissions.configsets || [])],
					settings: [...(copyFrom.permissions.settings || [])],
					users: [...(copyFrom.permissions.users || [])],
					git: [...(copyFrom.permissions.git || [])],
					license: [...(copyFrom.permissions.license || [])],
					audit_logs: [...(copyFrom.permissions.audit_logs || [])],
					activity: [...(copyFrom.permissions.activity || [])],
					schedules: [...(copyFrom.permissions.schedules || [])],
					secrets: [...(copyFrom.permissions.secrets || [])],
					backups: [...(copyFrom.permissions.backups || [])]
				};
				formError = '';
				formErrors = {};
				formSaving = false;
			} else {
				resetForm();
			}
		}
	});

	function togglePermission(category: keyof typeof formPermissions, permission: string) {
		const current = formPermissions[category];
		if (current.includes(permission)) {
			formPermissions[category] = current.filter(p => p !== permission);
		} else {
			formPermissions[category] = [...current, permission];
		}
	}

	function toggleAllPermissions(category: keyof typeof formPermissions, enable: boolean, definitions: { key: string; label: string }[]) {
		if (enable) {
			formPermissions[category] = definitions.map(p => p.key);
		} else {
			formPermissions[category] = [];
		}
	}

	function toggleEnvironment(envId: number) {
		if (formEnvironmentIds.includes(envId)) {
			formEnvironmentIds = formEnvironmentIds.filter(id => id !== envId);
		} else {
			formEnvironmentIds = [...formEnvironmentIds, envId];
		}
	}

	async function save() {
		formErrors = {};
		if (!formName.trim()) {
			formErrors.name = 'Role name is required';
			return;
		}

		formSaving = true;
		formError = '';

		try {
			const url = isEditing ? `/api/roles/${role!.id}` : '/api/roles';
			const method = isEditing ? 'PUT' : 'POST';

			// null = all environments, array = specific environments
			const environmentIds = formAllEnvironments ? null : formEnvironmentIds;

			const response = await fetch(url, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: formName.trim(),
					description: formDescription.trim() || (isEditing ? null : undefined),
					permissions: formPermissions,
					environmentIds
				})
			});

			if (response.ok) {
				open = false;
				onSaved();
			} else {
				const data = await response.json();
				if (data.error?.includes('already exists')) {
					formErrors.name = 'Role name already exists';
				} else {
					formError = data.error || `Failed to ${isEditing ? 'update' : 'create'} role`;
				}
			}
		} catch {
			formError = `Failed to ${isEditing ? 'update' : 'create'} role`;
		} finally {
			formSaving = false;
		}
	}

	function handleClose() {
		open = false;
		onClose();
	}
</script>

<Dialog.Root bind:open onOpenChange={(o) => { if (o) { formError = ''; formErrors = {}; focusFirstInput(); } }}>
	<Dialog.Content class="max-w-6xl max-h-[85vh] flex flex-col overflow-hidden">
		<Dialog.Header class="flex-shrink-0">
			<Dialog.Title class="flex items-center gap-2">
				{#if isEditing}
					<Pencil class="w-5 h-5" />
					{m.edit_role()}
				{:else if isCopying}
					<Copy class="w-5 h-5" />
					{m.copy_role()}
				{:else}
					<Shield class="w-5 h-5" />
					{m.create_role()}
				{/if}
			</Dialog.Title>
			<Dialog.Description>
				{#if isEditing}
					{m.update_role_permissions()}
				{:else if isCopying}
					{m.create_a_new_role_based_on_arg1({ arg1: orEmpty(copyFrom?.name) })}
				{:else}
					{m.define_a_new_role_with_specific_permissions()}
				{/if}
			</Dialog.Description>
		</Dialog.Header>
		{#if formError}
			<Alert.Root variant="destructive" class="flex-shrink-0">
				<TriangleAlert class="h-4 w-4" />
				<Alert.Description>{formError}</Alert.Description>
			</Alert.Root>
		{/if}
		<div class="flex-shrink-0 grid grid-cols-2 gap-4 py-4">
			<div class="space-y-2">
				<Label>{m.role_name()}</Label>
				<Input
					bind:value={formName}
					placeholder={m.developer()}
					class={formErrors.name ? 'border-destructive focus-visible:ring-destructive' : ''}
					oninput={() => formErrors.name = undefined}
				/>
				{#if formErrors.name}
					<p class="text-xs text-destructive">{formErrors.name}</p>
				{/if}
			</div>
			<div class="space-y-2">
				<Label>{m.description_optional()}</Label>
				<Input
					bind:value={formDescription}
					placeholder={m.access_to_development_resources()}
				/>
			</div>
		</div>

		<!-- Vertically stacked permissions layout -->
		<div class="flex-1 flex flex-col gap-4 min-h-0 overflow-y-auto pr-1">
			<!-- System Permissions Section -->
			<div class="flex-shrink-0 border rounded-lg">
				<div class="px-4 py-3 border-b bg-muted/30">
					<div class="flex items-center gap-2">
						<Building2 class="w-4 h-4" />
						<span class="font-medium text-sm">{m.system_permissions()}</span>
						<span class="text-xs text-muted-foreground">{m.always_global()}</span>
					</div>
				</div>
				<div class="p-3 grid grid-cols-2 lg:grid-cols-4 gap-3">
					<!-- BETA GATE: drop the backups permission group unless FEAT_BACKUPS_ENABLED (see features.ts) -->
					{#each Object.entries(systemPermissions).filter(([c]) => c !== 'backups' || $page.data.backupsEnabled) as [category, permissions]}
						{@const IconComponent = categoryIcons[category]}
						<div class="relative border rounded-md pt-5 pb-3 px-3">
							<!-- Category pill on border -->
							<div class="absolute -top-2.5 left-3 inline-flex items-center gap-1.5 px-2 py-0.5 rounded border {categoryColorsSolid[category] || 'bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-400 border-gray-300 dark:border-gray-700'}">
								<IconComponent class="w-3.5 h-3.5" />
								<span class="text-xs font-medium capitalize">{category}</span>
							</div>
							<!-- Select all / Clear links -->
							<div class="absolute -top-2 right-3 flex gap-2 bg-background px-1">
								<button
									type="button"
									class="text-xs text-primary hover:underline"
									onclick={() => toggleAllPermissions(category as keyof typeof formPermissions, true, permissions)}
								>
									{m.all()}
								</button>
								<span class="text-muted-foreground">|</span>
								<button
									type="button"
									class="text-xs text-muted-foreground hover:underline"
									onclick={() => toggleAllPermissions(category as keyof typeof formPermissions, false, permissions)}
								>
									{m.clear()}
								</button>
							</div>
							<div class="flex flex-col gap-1.5">
								{#each permissions as permission}
									{@const PermIcon = permissionIcons[permission.key]}
									<label class="flex items-center gap-1.5 cursor-pointer">
										<Checkbox
											checked={formPermissions[category as keyof typeof formPermissions].includes(permission.key)}
											onCheckedChange={() => togglePermission(category as keyof typeof formPermissions, permission.key)}
										/>
										{#if PermIcon}
											<PermIcon class="w-3 h-3 text-muted-foreground" />
										{/if}
										<span class="text-xs truncate">{permission.label}</span>
									</label>
								{/each}
							</div>
						</div>
					{/each}
				</div>
			</div>

			<!-- Environment Permissions Section -->
			<div class="flex-shrink-0 border rounded-lg">
				<div class="px-4 py-3 border-b bg-muted/30">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<Globe class="w-4 h-4" />
							<span class="font-medium text-sm">{m.environment_permissions()}</span>
						</div>
						{#if environments.length > 0}
							<div class="flex items-center gap-2">
								<span class="text-xs text-muted-foreground">{m.all_environments_incl_new()}</span>
								<TogglePill bind:checked={formAllEnvironments} />
							</div>
						{/if}
					</div>
					<!-- Environment selector -->
					{#if environments.length > 0}
						{#if !formAllEnvironments}
							<div class="mt-3 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
								{#each environments as env}
									<label class="flex items-center gap-2 p-2 border rounded-md cursor-pointer hover:bg-muted/50 transition-colors text-xs {formEnvironmentIds.includes(env.id) ? 'border-primary bg-primary/5' : ''}">
										<Checkbox
											checked={formEnvironmentIds.includes(env.id)}
											onCheckedChange={() => toggleEnvironment(env.id)}
										/>
										<EnvironmentIcon icon={env.icon || 'globe'} envId={env.id} class="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
										<span class="truncate">{env.name}</span>
									</label>
								{/each}
							</div>
							{#if formEnvironmentIds.length === 0}
								<p class="text-xs text-amber-600 mt-2">{m.select_at_least_one_environment_for_these_permis()}</p>
							{/if}
						{:else}
							<p class="text-xs text-muted-foreground mt-1">{m.permissions_apply_to_all_environments_including()}</p>
						{/if}
					{:else}
						<p class="text-xs text-muted-foreground mt-1">{m.permissions_apply_to_all_environments()}</p>
					{/if}
				</div>
				<div class="p-3 grid grid-cols-2 lg:grid-cols-5 gap-3">
					{#each Object.entries(environmentPermissions) as [category, permissions]}
						{@const IconComponent = categoryIcons[category]}
						<div class="relative border rounded-md pt-5 pb-3 px-3">
							<!-- Category pill on border -->
							<div class="absolute -top-2.5 left-3 inline-flex items-center gap-1.5 px-2 py-0.5 rounded border {categoryColorsSolid[category] || 'bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-400 border-gray-300 dark:border-gray-700'}">
								<IconComponent class="w-3.5 h-3.5" />
								<span class="text-xs font-medium capitalize">{category}</span>
							</div>
							<!-- Select all / Clear links -->
							<div class="absolute -top-2 right-3 flex gap-2 bg-background px-1">
								<button
									type="button"
									class="text-xs text-primary hover:underline"
									onclick={() => toggleAllPermissions(category as keyof typeof formPermissions, true, permissions)}
								>
									{m.all()}
								</button>
								<span class="text-muted-foreground">|</span>
								<button
									type="button"
									class="text-xs text-muted-foreground hover:underline"
									onclick={() => toggleAllPermissions(category as keyof typeof formPermissions, false, permissions)}
								>
									{m.clear()}
								</button>
							</div>
							<div class="flex flex-col gap-1.5">
								{#each permissions as permission}
									{@const PermIcon = permissionIcons[permission.key]}
									<label class="flex items-center gap-1.5 cursor-pointer">
										<Checkbox
											checked={formPermissions[category as keyof typeof formPermissions].includes(permission.key)}
											onCheckedChange={() => togglePermission(category as keyof typeof formPermissions, permission.key)}
										/>
										{#if PermIcon}
											<PermIcon class="w-3 h-3 text-muted-foreground" />
										{/if}
										<span class="text-xs truncate">{permission.label}</span>
									</label>
								{/each}
							</div>
						</div>
					{/each}
				</div>
			</div>
		</div>

		<Dialog.Footer class="flex-shrink-0 pt-4">
			<Button variant="outline" onclick={handleClose}>{m.cancel()}</Button>
			<Button onclick={save} disabled={formSaving}>
				{#if formSaving}
					<RefreshCw class="w-4 h-4 mr-1 animate-spin" />
				{:else if isEditing}
					<Check class="w-4 h-4" />
				{:else}
					<Plus class="w-4 h-4" />
				{/if}
				{isEditing ? 'Save' : 'Create role'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
