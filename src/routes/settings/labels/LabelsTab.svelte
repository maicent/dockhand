<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { orEmpty } from '$lib/i18n.js';
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import * as Popover from '$lib/components/ui/popover';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Badge } from '$lib/components/ui/badge';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import ConfirmPopover from '$lib/components/ConfirmPopover.svelte';
	import { Tags, Pencil, Trash2, Loader2, Globe, AlertTriangle, Plus, Palette, RotateCcw } from 'lucide-svelte';
	import { getLabelColors, COLOR_PALETTE, hexToRgba } from '$lib/utils/label-colors';
	import { canAccess } from '$lib/stores/auth';
	import { toast } from 'svelte-sonner';
	import TagsManager from './TagsManager.svelte';

	interface LabelInfo {
		label: string;
		count: number;
		color: string | null;
		environments: { envId: number; envName: string }[];
	}

	interface EnvOption {
		id: number;
		name: string;
	}

	let labels = $state<LabelInfo[]>([]);
	let customColors = $state<Record<string, string>>({});
	let loading = $state(true);

	// Rename dialog state
	let showRenameDialog = $state(false);
	let renameTarget = $state<LabelInfo | null>(null);
	let newLabelName = $state('');
	let renaming = $state(false);

	// Add dialog state
	let showAddDialog = $state(false);
	let addLabelName = $state('');
	let addEnvOptions = $state<EnvOption[]>([]);
	let addSelectedEnvIds = $state<number[]>([]);
	let adding = $state(false);

	// Delete confirm state
	let confirmDeleteLabel = $state<string | null>(null);

	// Color popover state
	let colorPopoverLabel = $state<string | null>(null);

	$effect(() => {
		fetchLabels();
	});

	async function fetchLabels() {
		loading = true;
		try {
			const res = await fetch('/api/labels');
			if (res.ok) {
				const data = await res.json();
				labels = data.labels;
				customColors = data.colors || {};
			}
		} catch (e) {
			console.error('Failed to fetch labels:', e);
		} finally {
			loading = false;
		}
	}

	async function fetchEnvironments() {
		try {
			const res = await fetch('/api/environments');
			if (res.ok) {
				const envs = await res.json();
				addEnvOptions = envs.map((e: any) => ({ id: e.id, name: e.name }));
			}
		} catch {
			// ignore
		}
	}

	function getColors(label: string) {
		return getLabelColors(label, customColors);
	}

	function openRenameDialog(info: LabelInfo) {
		renameTarget = info;
		newLabelName = info.label;
		showRenameDialog = true;
	}

	async function openAddDialog() {
		addLabelName = '';
		addSelectedEnvIds = [];
		await fetchEnvironments();
		showAddDialog = true;
	}

	async function handleRename() {
		if (!renameTarget || !newLabelName.trim()) return;
		if (newLabelName.trim() === renameTarget.label) {
			showRenameDialog = false;
			return;
		}

		renaming = true;
		try {
			const res = await fetch('/api/labels', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'rename',
					oldLabel: renameTarget.label,
					newLabel: newLabelName.trim()
				})
			});

			if (res.ok) {
				const data = await res.json();
				toast.success(`Renamed "${renameTarget.label}" to "${newLabelName.trim()}" across ${data.affected} environment${data.affected !== 1 ? 's' : ''}`);
				showRenameDialog = false;
				await fetchLabels();
			} else {
				const err = await res.json();
				toast.error(err.error || 'Failed to rename label');
			}
		} catch {
			toast.error(m.failed_to_rename_label());
		} finally {
			renaming = false;
		}
	}

	async function handleAdd() {
		if (!addLabelName.trim() || addSelectedEnvIds.length === 0) return;

		adding = true;
		try {
			const res = await fetch('/api/labels', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'add',
					label: addLabelName.trim(),
					environmentIds: addSelectedEnvIds
				})
			});

			if (res.ok) {
				const data = await res.json();
				toast.success(`Added "${addLabelName.trim()}" to ${data.affected} environment${data.affected !== 1 ? 's' : ''}`);
				showAddDialog = false;
				await fetchLabels();
			} else {
				const err = await res.json();
				toast.error(err.error || 'Failed to add label');
			}
		} catch {
			toast.error(m.failed_to_add_label());
		} finally {
			adding = false;
		}
	}

	async function handleDelete(info: LabelInfo) {
		try {
			const res = await fetch('/api/labels', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'delete', label: info.label })
			});

			if (res.ok) {
				const data = await res.json();
				toast.success(`Removed "${info.label}" from ${data.affected} environment${data.affected !== 1 ? 's' : ''}`);
				await fetchLabels();
			} else {
				const err = await res.json();
				toast.error(err.error || 'Failed to delete label');
			}
		} catch {
			toast.error(m.failed_to_delete_label());
		}
	}

	async function setColor(label: string, color: string | null) {
		try {
			const res = await fetch('/api/labels', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'set-color', label, color })
			});

			if (res.ok) {
				if (color) {
					customColors = { ...customColors, [label]: color };
				} else {
					const { [label]: _, ...rest } = customColors;
					customColors = rest;
				}
				colorPopoverLabel = null;
				toast.success(color ? `Color set for "${label}"` : `Color reset for "${label}"`);
			}
		} catch {
			toast.error(m.failed_to_set_color());
		}
	}

	function toggleEnvSelection(envId: number) {
		if (addSelectedEnvIds.includes(envId)) {
			addSelectedEnvIds = addSelectedEnvIds.filter(id => id !== envId);
		} else {
			addSelectedEnvIds = [...addSelectedEnvIds, envId];
		}
	}

	function selectAllEnvs() {
		addSelectedEnvIds = addEnvOptions.map(e => e.id);
	}

	function deselectAllEnvs() {
		addSelectedEnvIds = [];
	}
</script>

<div class="p-4 space-y-4">
	<Card.Root>
		<Card.Header class="pb-3">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					<Tags class="w-5 h-5 text-muted-foreground" />
					<div>
						<Card.Title class="text-base">{m.environment_labels()}</Card.Title>
						<Card.Description>{m.manage_labels_across_all_environments_renaming_o()}</Card.Description>
					</div>
				</div>
				<div class="flex items-center gap-2">
					{#if !loading}
						<Badge variant="secondary" class="text-xs">{m.length_label_arg2({ length: orEmpty(labels.length), arg2: orEmpty(labels.length !== 1 ? 's' : '') })}</Badge>
					{/if}
					<Button
						size="sm"
						variant="outline"
						onclick={openAddDialog}
						disabled={!$canAccess('environments', 'edit')}
						class="h-7 text-xs"
					>
						<Plus class="w-3.5 h-3.5" />
						{m.add_label_8076()}
					</Button>
				</div>
			</div>
		</Card.Header>
		<Card.Content>
			{#if loading}
				<div class="flex items-center justify-center py-8 text-muted-foreground">
					<Loader2 class="w-5 h-5 animate-spin mr-2" />
					{m.loading_labels()}
				</div>
			{:else if labels.length === 0}
				<div class="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
					<Tags class="w-8 h-8 opacity-50" />
					<p class="text-sm">{m.no_labels_found()}</p>
					<p class="text-xs">{m.click_add_label_to_create_one_and_assign_it_to_e()}</p>
				</div>
			{:else}
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head class="w-[200px]">{m.label()}</Table.Head>
							<Table.Head class="w-[60px] text-center">{m.color()}</Table.Head>
							<Table.Head class="w-[80px] text-center">{m.environments()}</Table.Head>
							<Table.Head>{m.used_by()}</Table.Head>
							<Table.Head class="w-[100px] text-right">{m.actions()}</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each labels as info}
							{@const colors = getColors(info.label)}
							<Table.Row>
								<Table.Cell>
									<span
										class="px-2 py-0.5 text-xs rounded font-medium"
										style="background-color: {colors.bgColor}; color: {colors.color}"
									>
										{info.label}
									</span>
								</Table.Cell>
								<Table.Cell class="text-center">
									<Popover.Root open={colorPopoverLabel === info.label} onOpenChange={(open) => colorPopoverLabel = open ? info.label : null}>
										<Popover.Trigger>
											<button
												type="button"
												class="w-5 h-5 rounded border border-border hover:ring-2 hover:ring-primary/30 transition-all"
												style="background-color: {colors.color}"
												title={m.change_color()}
											></button>
										</Popover.Trigger>
										<Popover.Content class="w-auto p-3" align="start">
											<div class="space-y-2">
												<p class="text-xs font-medium text-muted-foreground">{m.pick_a_color()}</p>
												<div class="grid grid-cols-6 gap-1">
													{#each COLOR_PALETTE as color}
														<button
															type="button"
															class="w-5 h-5 rounded border transition-all {color === customColors[info.label] ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : 'border-transparent hover:ring-2 hover:ring-muted-foreground/30'}"
															style="background-color: {color}"
															onclick={() => setColor(info.label, color)}
														></button>
													{/each}
												</div>
												{#if customColors[info.label]}
													<button
														type="button"
														class="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full justify-center pt-1"
														onclick={() => setColor(info.label, null)}
													>
														<RotateCcw class="w-3 h-3" />
														{m.reset_to_default()}
													</button>
												{/if}
											</div>
										</Popover.Content>
									</Popover.Root>
								</Table.Cell>
								<Table.Cell class="text-center">
									<Badge variant="outline" class="text-xs">{info.count}</Badge>
								</Table.Cell>
								<Table.Cell>
									<div class="flex flex-wrap gap-1">
										{#each info.environments as env}
											<span class="inline-flex items-center gap-0.5 text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
												<Globe class="w-3 h-3" />
												{env.envName}
											</span>
										{/each}
									</div>
								</Table.Cell>
								<Table.Cell class="text-right">
									<div class="flex items-center justify-end gap-1">
										<Tooltip.Root>
											<Tooltip.Trigger>
												<Button
													variant="ghost"
													size="icon"
													class="h-7 w-7"
													onclick={() => openRenameDialog(info)}
													disabled={!$canAccess('environments', 'edit')}
												>
													<Pencil class="w-3.5 h-3.5" />
												</Button>
											</Tooltip.Trigger>
											<Tooltip.Content>{m.rename_across_all_environments()}</Tooltip.Content>
										</Tooltip.Root>
										<ConfirmPopover
											open={confirmDeleteLabel === info.label}
											action="Remove"
											itemType="label"
											itemName={info.label}
											confirmText="Remove"
											position="left"
											onConfirm={() => handleDelete(info)}
											onOpenChange={(open) => confirmDeleteLabel = open ? info.label : null}
											disabled={!$canAccess('environments', 'edit')}
										>
											{#snippet children({ open })}
												<Trash2 class="w-3.5 h-3.5 {open ? 'text-destructive' : 'text-muted-foreground hover:text-destructive'}" />
											{/snippet}
										</ConfirmPopover>
									</div>
								</Table.Cell>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
			{/if}
		</Card.Content>
	</Card.Root>

	<TagsManager />
</div>

<!-- Rename Dialog -->
<Dialog.Root bind:open={showRenameDialog}>
	<Dialog.Content class="max-w-md">
		<Dialog.Header>
			<Dialog.Title>{m.rename_label()}</Dialog.Title>
			<Dialog.Description>
				{#if renameTarget}
					{m.this_will_rename_label_across_count_environment({ label: orEmpty(renameTarget.label), count: orEmpty(renameTarget.count), arg3: orEmpty(renameTarget.count !== 1 ? 's' : '') })}
				{/if}
			</Dialog.Description>
		</Dialog.Header>
		{#if renameTarget}
			{@const currentColors = getColors(renameTarget.label)}
			<div class="space-y-4 py-2">
				<div class="space-y-2">
					<Label>{m.current_name()}</Label>
					<span
						class="inline-block px-2 py-0.5 text-xs rounded font-medium"
						style="background-color: {currentColors.bgColor}; color: {currentColors.color}"
					>
						{renameTarget.label}
					</span>
				</div>
				<div class="space-y-2">
					<Label for="new-label-name">{m.new_name()}</Label>
					<Input
						id="new-label-name"
						bind:value={newLabelName}
						placeholder={m.enter_new_label_name()}
						onkeydown={(e) => { if (e.key === 'Enter' && newLabelName.trim()) handleRename(); }}
					/>
				</div>
				{#if newLabelName.trim() && newLabelName.trim() !== renameTarget.label}
					{@const newColors = getColors(newLabelName.trim())}
					<div class="flex items-center gap-2 text-xs text-muted-foreground">
						<span>{m.preview()}</span>
						<span
							class="px-2 py-0.5 rounded font-medium"
							style="background-color: {newColors.bgColor}; color: {newColors.color}"
						>
							{newLabelName.trim()}
						</span>
					</div>
				{/if}
				{#if labels.some(l => l.label === newLabelName.trim() && l.label !== renameTarget?.label)}
					<div class="flex items-center gap-1.5 text-xs text-amber-500">
						<AlertTriangle class="w-3.5 h-3.5" />
						<span>{m.label_arg1_already_exists_environments_with_both({ arg1: orEmpty(newLabelName.trim()) })}</span>
					</div>
				{/if}
			</div>
		{/if}
		<Dialog.Footer>
			<Button variant="outline" onclick={() => showRenameDialog = false}>{m.cancel()}</Button>
			<Button
				onclick={handleRename}
				disabled={renaming || !newLabelName.trim() || newLabelName.trim() === renameTarget?.label}
			>
				{#if renaming}
					<Loader2 class="w-4 h-4 mr-2 animate-spin" />
				{/if}
				{m.rename()}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Add Label Dialog -->
<Dialog.Root bind:open={showAddDialog}>
	<Dialog.Content class="max-w-md">
		<Dialog.Header>
			<Dialog.Title>{m.add_label_8076()}</Dialog.Title>
			<Dialog.Description>{m.create_a_new_label_and_assign_it_to_one_or_more()}</Dialog.Description>
		</Dialog.Header>
		<div class="space-y-4 py-2">
			<div class="space-y-2">
				<Label for="add-label-name">{m.label_name()}</Label>
				<Input
					id="add-label-name"
					bind:value={addLabelName}
					placeholder={m.e_g_production_staging_critical()}
					onkeydown={(e) => { if (e.key === 'Enter' && addLabelName.trim() && addSelectedEnvIds.length > 0) handleAdd(); }}
				/>
				{#if addLabelName.trim()}
					{@const previewColors = getColors(addLabelName.trim())}
					<div class="flex items-center gap-2 text-xs text-muted-foreground">
						<span>{m.preview()}</span>
						<span
							class="px-2 py-0.5 rounded font-medium"
							style="background-color: {previewColors.bgColor}; color: {previewColors.color}"
						>
							{addLabelName.trim()}
						</span>
					</div>
				{/if}
				{#if addLabelName.trim() && labels.some(l => l.label === addLabelName.trim())}
					<div class="flex items-center gap-1.5 text-xs text-amber-500">
						<AlertTriangle class="w-3.5 h-3.5" />
						<span>{m.this_label_already_exists_it_will_be_added_to_th()}</span>
					</div>
				{/if}
			</div>
			<div class="space-y-2">
				<div class="flex items-center justify-between">
					<Label>{m.environments()}</Label>
					<div class="flex gap-2">
						<button type="button" class="text-2xs text-primary hover:underline" onclick={selectAllEnvs}>{m.select_all()}</button>
						<button type="button" class="text-2xs text-muted-foreground hover:underline" onclick={deselectAllEnvs}>{m.clear()}</button>
					</div>
				</div>
				<div class="max-h-48 overflow-y-auto border rounded-md p-2 space-y-1">
					{#each addEnvOptions as env}
						<label class="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted cursor-pointer text-sm">
							<Checkbox
								checked={addSelectedEnvIds.includes(env.id)}
								onCheckedChange={() => toggleEnvSelection(env.id)}
							/>
							<Globe class="w-3.5 h-3.5 text-muted-foreground" />
							{env.name}
						</label>
					{/each}
					{#if addEnvOptions.length === 0}
						<p class="text-xs text-muted-foreground text-center py-2">{m.no_environments_available()}</p>
					{/if}
				</div>
				<p class="text-xs text-muted-foreground h-4">{addSelectedEnvIds.length > 0 ? `${addSelectedEnvIds.length} environment${addSelectedEnvIds.length !== 1 ? 's' : ''} selected` : '\u00A0'}</p>
			</div>
		</div>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => showAddDialog = false}>{m.cancel()}</Button>
			<Button
				onclick={handleAdd}
				disabled={adding || !addLabelName.trim() || addSelectedEnvIds.length === 0}
			>
				{#if adding}
					<Loader2 class="w-4 h-4 mr-2 animate-spin" />
				{/if}
				{m.add_label_8076()}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
