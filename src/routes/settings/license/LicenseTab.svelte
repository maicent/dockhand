<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Label } from '$lib/components/ui/label';
	import { Input } from '$lib/components/ui/input';
	import { Crown, Building2, Key, RefreshCw, ShieldCheck, XCircle } from 'lucide-svelte';
	import { canAccess } from '$lib/stores/auth';
	import { licenseStore } from '$lib/stores/license';
	import ConfirmPopover from '$lib/components/ConfirmPopover.svelte';
	import { formatDate } from '$lib/stores/settings';

	// License state
	interface LicenseInfo {
		valid: boolean;
		active: boolean;
		hostname?: string;
		payload?: {
			name: string;
			host: string;
			issued: string;
			expires: string | null;
			type: string;
		};
		stored?: {
			name: string;
			key: string;
			activated_at: string;
		};
		error?: string;
	}

	let licenseInfo = $state<LicenseInfo | null>(null);
	let licenseLoading = $state(true);
	let licenseFormName = $state('');
	let licenseFormKey = $state('');
	let licenseFormError = $state('');
	let licenseFormSaving = $state(false);

	async function fetchLicenseInfo() {
		licenseLoading = true;
		try {
			const response = await fetch('/api/license');
			licenseInfo = await response.json();
		} catch (error) {
			console.error('Failed to fetch license info:', error);
			licenseInfo = { valid: false, active: false, error: 'Failed to fetch license info' };
		} finally {
			licenseLoading = false;
		}
	}

	async function activateLicense() {
		if (!licenseFormName.trim() || !licenseFormKey.trim()) {
			licenseFormError = 'Name and license key are required';
			return;
		}

		licenseFormSaving = true;
		licenseFormError = '';

		try {
			const response = await fetch('/api/license', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: licenseFormName.trim(),
					key: licenseFormKey.trim()
				})
			});

			const result = await response.json();

			if (!response.ok || result.error) {
				licenseFormError = result.error || 'Failed to activate license';
				return;
			}

			// Refresh license info and update global store
			await fetchLicenseInfo();
			await licenseStore.check();
			toast.success(m.license_activated_successfully());

			// Clear form
			licenseFormName = '';
			licenseFormKey = '';
		} catch (error) {
			licenseFormError = 'Failed to activate license';
			toast.error(m.failed_to_activate_license());
		} finally {
			licenseFormSaving = false;
		}
	}

	async function deactivateLicense() {
		try {
			await fetch('/api/license', { method: 'DELETE' });
			await fetchLicenseInfo();
			await licenseStore.check();
			toast.success(m.license_deactivated());
		} catch (error) {
			console.error('Failed to deactivate license:', error);
			toast.error(m.failed_to_deactivate_license());
		}
	}

	onMount(() => {
		fetchLicenseInfo();
	});
</script>

<div class="space-y-4">
	<Card.Root class="border-dashed">
		<Card.Content class="pt-4">
			<div class="flex items-start gap-3">
				<Crown class="w-5 h-5 text-amber-500 mt-0.5" />
				<div>
					<p class="text-sm font-medium">{m.license_management()}</p>
					<p class="text-xs text-muted-foreground">
						{m.activate_your_license_to_validate_commercial_use()} <span class="font-medium">{m.enterprise()}</span> {m.licenses_unlock_premium_features_including_rbac()}
					</p>
				</div>
			</div>
		</Card.Content>
	</Card.Root>

	{#if licenseLoading}
		<Card.Root>
			<Card.Content class="py-8 text-center">
				<RefreshCw class="w-6 h-6 mx-auto mb-2 animate-spin text-muted-foreground" />
				<p class="text-sm text-muted-foreground">{m.loading_license_information()}</p>
			</Card.Content>
		</Card.Root>
	{:else if licenseInfo?.valid && licenseInfo?.active}
		<!-- Active License Display -->
		{@const isEnterprise = licenseInfo.payload?.type === 'enterprise'}
		<Card.Root class={isEnterprise ? 'border-amber-500/50 bg-amber-500/5' : 'border-blue-500/50 bg-blue-500/5'}>
			<Card.Header>
				<Card.Title class="text-sm font-medium flex items-center gap-2">
					{#if isEnterprise}
						<Crown class="w-4 h-4 text-amber-500" />
						{m.active_enterprise_license()}
					{:else}
						<Building2 class="w-4 h-4 text-blue-500" />
						{m.active_smb_license()}
					{/if}
				</Card.Title>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="grid grid-cols-2 gap-4 text-sm">
					<div>
						<p class="text-muted-foreground">{m.licensed_to()}</p>
						<p class="font-medium">{licenseInfo.payload?.name}</p>
					</div>
					<div>
						<p class="text-muted-foreground">{m.license_type()}</p>
						<p class="font-medium flex items-center gap-1">
							{#if isEnterprise}
								<Crown class="w-3.5 h-3.5 text-amber-500" />
								<span class="text-amber-600 dark:text-amber-400">{m.enterprise()}</span>
							{:else}
								<Building2 class="w-3.5 h-3.5 text-blue-500" />
								<span class="text-blue-600 dark:text-blue-400">{m.smb()}</span>
							{/if}
						</p>
					</div>
					<div>
						<p class="text-muted-foreground">{m.licensed_host()}</p>
						<p class="font-medium font-mono text-xs">{licenseInfo.payload?.host}</p>
					</div>
					<div>
						<p class="text-muted-foreground">{m.issued()}</p>
						<p class="font-medium">{formatDate(licenseInfo.payload?.issued || '')}</p>
					</div>
					<div>
						<p class="text-muted-foreground">{m.expires()}</p>
						<p class="font-medium">{licenseInfo.payload?.expires ? formatDate(licenseInfo.payload.expires) : 'Never (Perpetual)'}</p>
					</div>
				</div>
				<div class="pt-2 border-t">
					<p class="text-xs text-muted-foreground mb-2">{m.current_hostname()}</p>
					<code class="text-xs bg-muted px-2 py-1 rounded">{licenseInfo.hostname}</code>
				</div>
				{#if $canAccess('settings', 'edit')}
				<div class="flex justify-end">
					<ConfirmPopover
						action="Deactivate"
						itemType="license"
						itemName={licenseInfo.payload?.name || 'this license'}
						title={m.deactivate()}
						position="left"
						confirmText="Deactivate license"
						onConfirm={deactivateLicense}
					>
						{#snippet children({ open })}
							<span class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border transition-colors {open ? 'border-destructive text-destructive' : 'hover:bg-muted'}">
								<XCircle class="w-4 h-4" />
								{m.deactivate_license()}
							</span>
						{/snippet}
						{#snippet extraContent()}
							<p class="text-xs text-muted-foreground">
								{m.roles_stop_being_enforced_so_everyone_who_can_si()}
							</p>
						{/snippet}
					</ConfirmPopover>
				</div>
				{/if}
			</Card.Content>
		</Card.Root>
	{:else}
		<!-- License Activation Form -->
		<Card.Root>
			<Card.Header>
				<Card.Title class="text-sm font-medium flex items-center gap-2">
					<Key class="w-4 h-4" />
					{m.activate_license()}
				</Card.Title>
			</Card.Header>
			<Card.Content class="space-y-4">
				{#if licenseFormError}
					<div class="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 rounded p-2">
						{licenseFormError}
					</div>
				{/if}

				{#if licenseInfo?.error && !licenseFormError}
					<div class="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 rounded p-2">
						{licenseInfo.error}
					</div>
				{/if}

				<div class="space-y-2">
					<Label for="license-name">{m.license_name()}</Label>
					<Input
						id="license-name"
						bind:value={licenseFormName}
						placeholder={m.your_company_name()}
						disabled={!$canAccess('settings', 'edit')}
					/>
					<p class="text-xs text-muted-foreground">{m.enter_the_name_exactly_as_provided_with_your_lic()}</p>
				</div>

				<div class="space-y-2">
					<Label for="license-key">{m.license_key()}</Label>
					<textarea
						id="license-key"
						bind:value={licenseFormKey}
						placeholder={m.paste_your_license_key_here()}
						class="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono"
						disabled={!$canAccess('settings', 'edit')}
					></textarea>
				</div>

				<div class="pt-2 border-t">
					<p class="text-xs text-muted-foreground mb-2">{m.current_hostname_for_license_validation()}</p>
					<code class="text-xs bg-muted px-2 py-1 rounded">{licenseInfo?.hostname || 'Unknown'}</code>
				</div>

				{#if $canAccess('settings', 'edit')}
				<div class="flex justify-end">
					<Button onclick={activateLicense} disabled={licenseFormSaving}>
						{#if licenseFormSaving}
							<RefreshCw class="w-4 h-4 mr-1 animate-spin" />
						{:else}
							<ShieldCheck class="w-4 h-4" />
						{/if}
						{m.activate_license()}
					</Button>
				</div>
				{/if}
			</Card.Content>
		</Card.Root>
	{/if}
</div>
