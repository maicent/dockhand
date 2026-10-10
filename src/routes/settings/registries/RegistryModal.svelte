<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { orEmpty } from '$lib/i18n.js';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Label } from '$lib/components/ui/label';
	import { Input } from '$lib/components/ui/input';
	import { Plus, Check, RefreshCw, Wifi, CircleCheck, CircleX } from 'lucide-svelte';
	import { focusFirstInput } from '$lib/utils';

	export interface Registry {
		id: number;
		name: string;
		url: string;
		username?: string;
		createdAt: string;
	}

	interface Props {
		open: boolean;
		registry?: Registry | null;
		onClose: () => void;
		onSaved: () => void;
	}

	let { open = $bindable(), registry = null, onClose, onSaved }: Props = $props();

	const isEditing = $derived(registry !== null);

	// Form state
	let formName = $state('');
	let formUrl = $state('');
	let formUsername = $state('');
	let formPassword = $state('');
	let formError = $state('');
	let formSaving = $state(false);
	let testResult = $state<{ success: boolean; message: string } | null>(null);
	let testLoading = $state(false);

	function resetForm() {
		formName = '';
		formUrl = '';
		formUsername = '';
		formPassword = '';
		formError = '';
		formSaving = false;
		testResult = null;
		testLoading = false;
	}

	// Initialize form when registry changes or modal opens
	$effect(() => {
		if (open) {
			if (registry) {
				formName = registry.name;
				formUrl = registry.url;
				formUsername = registry.username || '';
				formPassword = '';
				formError = '';
			testResult = null;
			} else {
				resetForm();
			}
		}
	});

	async function testConnection() {
		if (!formUrl.trim()) {
			formError = 'URL is required to test';
			return;
		}

		testLoading = true;
		testResult = null;
		formError = '';

		try {
			const body: Record<string, any> = { url: formUrl.trim() };

			// For edit mode with no new password, use the saved registry's credentials
			if (isEditing && !formPassword && registry?.id) {
				// If username present but no new password, test via registry ID to use stored creds
				if (formUsername.trim()) {
					body.registryId = registry.id;
					delete body.url;
				}
			} else {
				if (formUsername.trim()) body.username = formUsername.trim();
				if (formPassword) body.password = formPassword;
			}

			const response = await fetch('/api/registries/test', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});

			testResult = await response.json();
		} catch {
			testResult = { success: false, message: 'Failed to test connection' };
		} finally {
			testLoading = false;
		}
	}

	async function save() {
		if (!formName.trim() || !formUrl.trim()) {
			formError = 'Name and URL are required';
			return;
		}

		formSaving = true;
		formError = '';

		try {
			const body: Record<string, string | undefined> = {
				name: formName.trim(),
				url: formUrl.trim(),
				username: formUsername.trim() || undefined
			};

			// Only include password if provided (for edit, empty means keep existing)
			if (formPassword || !isEditing) {
				body.password = formPassword || undefined;
			}

			const url = isEditing ? `/api/registries/${registry!.id}` : '/api/registries';
			const method = isEditing ? 'PUT' : 'POST';

			const response = await fetch(url, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});

			if (response.ok) {
				open = false;
				onSaved();
			} else {
				const data = await response.json();
				formError = data.error || `Failed to ${isEditing ? 'update' : 'create'} registry`;
			}
		} catch {
			formError = `Failed to ${isEditing ? 'update' : 'create'} registry`;
		} finally {
			formSaving = false;
		}
	}

	function handleClose() {
		open = false;
		onClose();
	}
</script>

<Dialog.Root bind:open onOpenChange={(o) => { if (o) { formError = ''; focusFirstInput(); } }}>
	<Dialog.Content class="max-w-md">
		<Dialog.Header>
			<Dialog.Title>{m.arg1_registry({ arg1: orEmpty(isEditing ? 'Edit' : 'Add') })}</Dialog.Title>
		</Dialog.Header>
		<div class="space-y-4">
			{#if formError}
				<div class="text-sm text-red-600 dark:text-red-400">{formError}</div>
			{/if}
			<div class="space-y-2">
				<Label for="reg-name">{m.name()}</Label>
				<Input id="reg-name" bind:value={formName} placeholder={m.my_private_registry()} />
			</div>
			<div class="space-y-2">
				<Label for="reg-url">{m.url()}</Label>
				<Input id="reg-url" bind:value={formUrl} placeholder={m.https_registry_example_com()} />
			</div>
			<div class="space-y-4 pt-2 border-t">
				<p class="text-xs text-muted-foreground">{m.credentials_arg1({ arg1: orEmpty(isEditing ? '(leave password blank to keep existing)' : '(optional)') })}</p>
				<div class="space-y-2">
					<Label for="reg-username">{m.username()}</Label>
					<Input id="reg-username" bind:value={formUsername} placeholder={m.username_249b()} />
				</div>
				<div class="space-y-2">
					<Label for="reg-password">{m.password_token_7cec()}</Label>
					<Input id="reg-password" type="password" bind:value={formPassword} placeholder={isEditing ? 'leave blank to keep existing' : 'password or access token'} />
				</div>
			</div>
		</div>
		{#if testResult}
			<div class="flex items-center gap-2 text-sm {testResult.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}">
				{#if testResult.success}
					<CircleCheck class="w-4 h-4 shrink-0" />
				{:else}
					<CircleX class="w-4 h-4 shrink-0" />
				{/if}
				<span>{testResult.message}</span>
			</div>
		{/if}
		<Dialog.Footer>
			<Button variant="outline" onclick={testConnection} disabled={testLoading}>
				{#if testLoading}
					<RefreshCw class="w-4 h-4 animate-spin" />
				{:else}
					<Wifi class="w-4 h-4" />
				{/if}
				{m.test()}
			</Button>
			<div class="flex-1"></div>
			<Button variant="outline" onclick={handleClose}>{m.cancel()}</Button>
			<Button onclick={save} disabled={formSaving}>
				{#if formSaving}
					<RefreshCw class="w-4 h-4 mr-1 animate-spin" />
				{:else if isEditing}
					<Check class="w-4 h-4" />
				{:else}
					<Plus class="w-4 h-4" />
				{/if}
				{isEditing ? 'Save' : 'Add'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
