<script lang="ts">
	import { m as m_i18n } from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Tabs from '$lib/components/ui/tabs';
	import * as Select from '$lib/components/ui/select';
	import { Label } from '$lib/components/ui/label';
	import { Input } from '$lib/components/ui/input';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { LogIn, Pencil, Plus, Check, RefreshCw, Crown, Key, Shield, Trash2, TriangleAlert } from 'lucide-svelte';
	import * as Alert from '$lib/components/ui/alert';
	import { focusFirstInput } from '$lib/utils';

	export interface OidcConfig {
		id: number;
		name: string;
		enabled: boolean;
		issuerUrl: string;
		clientId: string;
		clientSecret: string;
		redirectUri: string;
		scopes: string;
		usernameClaim: string;
		emailClaim: string;
		displayNameClaim: string;
		adminClaim?: string;
		adminValue?: string;
		roleMappingsClaim?: string;
		roleMappings?: { claimValue: string; roleId: number }[];
	}

	export interface Role {
		id: number;
		name: string;
		description?: string;
		isSystem: boolean;
		permissions: any;
		createdAt: string;
	}

	interface Props {
		open: boolean;
		oidc?: OidcConfig | null;
		roles: Role[];
		isEnterprise: boolean;
		onClose: () => void;
		onSaved: () => void;
		onNavigateToLicense?: () => void;
	}

	let { open = $bindable(), oidc = null, roles, isEnterprise, onClose, onSaved, onNavigateToLicense }: Props = $props();

	const isEditing = $derived(oidc !== null);

	// Form state
	let formName = $state('');
	let formEnabled = $state(false);
	let formIssuerUrl = $state('');
	let formClientId = $state('');
	let formClientSecret = $state('');
	let formRedirectUri = $state('');
	let formScopes = $state('openid profile email');
	let formUsernameClaim = $state('preferred_username');
	let formEmailClaim = $state('email');
	let formDisplayNameClaim = $state('name');
	let formAdminClaim = $state('');
	let formAdminValue = $state('');
	let formRoleMappingsClaim = $state('groups');
	let formRoleMappings = $state<{ claim_value: string; role_id: number }[]>([]);
	let formActiveTab = $state('general');
	let formError = $state('');
	let formErrors = $state<{ name?: string; issuerUrl?: string; clientId?: string; clientSecret?: string; redirectUri?: string }>({});
	let formSaving = $state(false);

	function resetForm() {
		formName = '';
		formEnabled = false;
		formIssuerUrl = '';
		formClientId = '';
		formClientSecret = '';
		formRedirectUri = typeof window !== 'undefined' ? `${window.location.origin}/api/auth/oidc/callback` : '';
		formScopes = 'openid profile email';
		formUsernameClaim = 'preferred_username';
		formEmailClaim = 'email';
		formDisplayNameClaim = 'name';
		formAdminClaim = '';
		formAdminValue = '';
		formRoleMappingsClaim = 'groups';
		formRoleMappings = [];
		formActiveTab = 'general';
		formError = '';
		formErrors = {};
		formSaving = false;
	}

	// Initialize form when oidc changes or modal opens
	$effect(() => {
		if (open) {
			if (oidc) {
				formName = oidc.name;
				formEnabled = oidc.enabled;
				formIssuerUrl = oidc.issuerUrl;
				formClientId = oidc.clientId;
				formClientSecret = oidc.clientSecret;
				formRedirectUri = oidc.redirectUri;
				formScopes = oidc.scopes || 'openid profile email';
				formUsernameClaim = oidc.usernameClaim || 'preferred_username';
				formEmailClaim = oidc.emailClaim || 'email';
				formDisplayNameClaim = oidc.displayNameClaim || 'name';
				formAdminClaim = oidc.adminClaim || '';
				formAdminValue = oidc.adminValue || '';
				formRoleMappingsClaim = oidc.roleMappingsClaim || 'groups';
				formRoleMappings = oidc.roleMappings ? oidc.roleMappings.map(m => ({ claim_value: m.claimValue, role_id: m.roleId })) : [];
				formActiveTab = 'general';
				formError = '';
				formErrors = {};
				formSaving = false;
			} else {
				resetForm();
			}
		}
	});

	async function save() {
		formErrors = {};
		let hasErrors = false;

		if (!formName.trim()) {
			formErrors.name = 'Name is required';
			hasErrors = true;
		}
		if (!formIssuerUrl.trim()) {
			formErrors.issuerUrl = 'Issuer URL is required';
			hasErrors = true;
		}
		if (!formClientId.trim()) {
			formErrors.clientId = 'Client ID is required';
			hasErrors = true;
		}
		if (!isEditing && !formClientSecret.trim()) {
			formErrors.clientSecret = 'Client secret is required';
			hasErrors = true;
		}
		if (!formRedirectUri.trim()) {
			formErrors.redirectUri = 'Redirect URI is required';
			hasErrors = true;
		}

		if (hasErrors) return;

		formSaving = true;
		formError = '';

		try {
			const url = isEditing ? `/api/auth/oidc/${oidc!.id}` : '/api/auth/oidc';
			const method = isEditing ? 'PUT' : 'POST';

			const response = await fetch(url, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: formName.trim(),
					enabled: formEnabled,
					issuerUrl: formIssuerUrl.trim(),
					clientId: formClientId.trim(),
					clientSecret: formClientSecret.trim(),
					redirectUri: formRedirectUri.trim(),
					scopes: formScopes.trim() || 'openid profile email',
					usernameClaim: formUsernameClaim.trim() || 'preferred_username',
					emailClaim: formEmailClaim.trim() || 'email',
					displayNameClaim: formDisplayNameClaim.trim() || 'name',
					adminClaim: formAdminClaim.trim() || undefined,
					adminValue: formAdminValue.trim() || undefined,
					roleMappings: formRoleMappings.length > 0 ? formRoleMappings.map(m => ({ claimValue: m.claim_value, roleId: m.role_id })) : undefined
				})
			});

			if (response.ok) {
				open = false;
				onSaved();
			} else {
				const data = await response.json();
				formError = data.error || `Failed to ${isEditing ? 'update' : 'create'} OIDC configuration`;
			}
		} catch {
			formError = `Failed to ${isEditing ? 'update' : 'create'} OIDC configuration`;
		} finally {
			formSaving = false;
		}
	}

	function handleClose() {
		open = false;
		onClose();
	}

	function addRoleMapping() {
		formRoleMappings = [...formRoleMappings, { claim_value: '', role_id: 0 }];
	}

	function removeRoleMapping(index: number) {
		formRoleMappings = formRoleMappings.filter((_, i) => i !== index);
	}

	function updateRoleMappingRole(index: number, roleId: number) {
		formRoleMappings[index].role_id = roleId;
		formRoleMappings = [...formRoleMappings];
	}
</script>

<Dialog.Root bind:open onOpenChange={(o) => { if (o) { formError = ''; formErrors = {}; focusFirstInput(); } }}>
	<Dialog.Content class="max-w-2xl h-[80vh] flex flex-col overflow-hidden">
		<Dialog.Header class="flex-shrink-0">
			<Dialog.Title class="flex items-center gap-2">
				{#if isEditing}
					<Pencil class="w-5 h-5" />
					{m_i18n.edit_oidc_provider()}
				{:else}
					<LogIn class="w-5 h-5" />
					{m_i18n.add_oidc_provider()}
				{/if}
			</Dialog.Title>
		</Dialog.Header>

		<Tabs.Root bind:value={formActiveTab} class="flex-1 flex flex-col overflow-hidden">
			<Tabs.List class="flex-shrink-0 grid w-full grid-cols-2">
				<Tabs.Trigger value="general">{m_i18n.general()}</Tabs.Trigger>
				<Tabs.Trigger value="role-mapping" class="flex items-center gap-1.5">
					<Crown class="w-3.5 h-3.5 text-amber-500" />
					{m_i18n.role_mapping()}
				</Tabs.Trigger>
			</Tabs.List>

			<Tabs.Content value="general" class="flex-1 overflow-y-auto space-y-4 py-2 mt-0">
				{#if formError}
					<Alert.Root variant="destructive">
						<TriangleAlert class="h-4 w-4" />
						<Alert.Description>{formError}</Alert.Description>
					</Alert.Root>
				{/if}

				<!-- Basic Settings -->
				<div class="space-y-4">
					<h4 class="text-sm font-medium text-muted-foreground">{m_i18n.basic_settings()}</h4>
					<div class="grid grid-cols-2 gap-4">
						<div class="space-y-2">
							<Label>{m_i18n.name()} <span class="text-destructive">*</span></Label>
							<Input
								bind:value={formName}
								placeholder={m_i18n.okta_auth0_azure_ad()}
								class={formErrors.name ? 'border-destructive focus-visible:ring-destructive' : ''}
								oninput={() => formErrors.name = undefined}
							/>
							{#if formErrors.name}
								<p class="text-xs text-destructive">{formErrors.name}</p>
							{/if}
						</div>
						<div class="space-y-2">
							<Label>{m_i18n.issuer_url()} <span class="text-destructive">*</span></Label>
							<Input
								bind:value={formIssuerUrl}
								placeholder={m_i18n.https_example_okta_com()}
								class={formErrors.issuerUrl ? 'border-destructive focus-visible:ring-destructive' : ''}
								oninput={() => formErrors.issuerUrl = undefined}
							/>
							{#if formErrors.issuerUrl}
								<p class="text-xs text-destructive">{formErrors.issuerUrl}</p>
							{/if}
						</div>
					</div>
					<div class="flex items-center gap-2">
						<Checkbox
							checked={formEnabled}
							onCheckedChange={(checked) => formEnabled = checked === true}
						/>
						<Label class="text-sm font-normal cursor-pointer" onclick={() => formEnabled = !formEnabled}>
							{m_i18n.enable_this_oidc_provider()}
						</Label>
					</div>
				</div>

				<!-- Client Credentials -->
				<div class="space-y-4">
					<h4 class="text-sm font-medium text-muted-foreground">{m_i18n.client_credentials()}</h4>
					<p class="text-xs text-muted-foreground">{m_i18n.get_these_from_your_identity_providers_applicati()}</p>
					<div class="grid grid-cols-2 gap-4">
						<div class="space-y-2">
							<Label>{m_i18n.client_id()} <span class="text-destructive">*</span></Label>
							<Input
								bind:value={formClientId}
								placeholder={m_i18n.your_client_id()}
								class={formErrors.clientId ? 'border-destructive focus-visible:ring-destructive' : ''}
								oninput={() => formErrors.clientId = undefined}
							/>
							{#if formErrors.clientId}
								<p class="text-xs text-destructive">{formErrors.clientId}</p>
							{/if}
						</div>
						<div class="space-y-2">
							<Label>{m_i18n.client_secret()} {#if !isEditing}<span class="text-destructive">*</span>{/if}</Label>
							<Input
								type="password"
								bind:value={formClientSecret}
								placeholder={isEditing ? 'Leave blank to keep existing' : 'your-client-secret'}
								class={formErrors.clientSecret ? 'border-destructive focus-visible:ring-destructive' : ''}
								oninput={() => formErrors.clientSecret = undefined}
							/>
							{#if formErrors.clientSecret}
								<p class="text-xs text-destructive">{formErrors.clientSecret}</p>
							{/if}
						</div>
					</div>
				</div>

				<!-- Redirect & Scopes -->
				<div class="space-y-4">
					<h4 class="text-sm font-medium text-muted-foreground">{m_i18n.redirect_settings()}</h4>
					<div class="space-y-2">
						<Label>{m_i18n.redirect_uri()} <span class="text-destructive">*</span></Label>
						<Input
							bind:value={formRedirectUri}
							placeholder={m_i18n.https_dockhand_example_com_api_auth_oidc_callbac()}
							class={formErrors.redirectUri ? 'border-destructive focus-visible:ring-destructive' : ''}
							oninput={() => formErrors.redirectUri = undefined}
						/>
						{#if formErrors.redirectUri}
							<p class="text-xs text-destructive">{formErrors.redirectUri}</p>
						{:else}
							<p class="text-xs text-muted-foreground">{m_i18n.add_this_uri_to_your_identity_providers_allowed()}</p>
						{/if}
					</div>
					<div class="space-y-2">
						<Label>{m_i18n.scopes()}</Label>
						<Input
							bind:value={formScopes}
							placeholder={m_i18n.openid_profile_email()}
						/>
					</div>
				</div>

				<!-- Claim Mapping -->
				<div class="space-y-4">
					<h4 class="text-sm font-medium text-muted-foreground">{m_i18n.claim_mapping()}</h4>
					<p class="text-xs text-muted-foreground">{m_i18n.map_oidc_claims_to_user_attributes()}</p>
					<div class="grid grid-cols-3 gap-4">
						<div class="space-y-2">
							<Label>{m_i18n.username_claim()}</Label>
							<Input
								bind:value={formUsernameClaim}
								placeholder={m_i18n.preferred_username()}
							/>
						</div>
						<div class="space-y-2">
							<Label>{m_i18n.email_claim()}</Label>
							<Input
								bind:value={formEmailClaim}
								placeholder={m_i18n.email_a88b()}
							/>
						</div>
						<div class="space-y-2">
							<Label>{m_i18n.display_name_claim()}</Label>
							<Input
								bind:value={formDisplayNameClaim}
								placeholder={m_i18n.name_6ae9()}
							/>
						</div>
					</div>
				</div>
			</Tabs.Content>

			<Tabs.Content value="role-mapping" class="flex-1 overflow-y-auto space-y-4 py-2 mt-0">
				{#if !isEnterprise}
					<!-- Enterprise Feature Notice (no license) -->
					<div class="flex-1 flex items-center justify-center py-8">
						<div class="text-center">
							<h3 class="text-lg font-medium mb-2 flex items-center justify-center gap-2">
								<Crown class="w-5 h-5 text-amber-500" />
								{m_i18n.enterprise_feature()}
							</h3>
							<p class="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
								{m_i18n.role_mapping_allows_you_to_automatically_assign()}
							</p>
							{#if onNavigateToLicense}
								<Button onclick={() => { open = false; onNavigateToLicense?.(); }}>
									<Key class="w-4 h-4" />
									{m_i18n.activate_license()}
								</Button>
							{/if}
						</div>
					</div>
				{:else}
					<!-- Admin Mapping (Simple) -->
					<div class="space-y-4">
						<h4 class="text-sm font-medium text-muted-foreground">{m_i18n.groups_roles_claim()}</h4>
						<p class="text-xs text-muted-foreground">{m_i18n.grant_admin_access_based_on_claim_values_from_yo()}</p>
						<div class="grid grid-cols-2 gap-4">
							<div class="space-y-2">
								<Label>{m_i18n.claim_name()}</Label>
								<Input
									bind:value={formAdminClaim}
									placeholder={m_i18n.groups_roles_etc()}
								/>
								<p class="text-xs text-muted-foreground">{m_i18n.name_of_the_claim_containing_roles_groups()}</p>
							</div>
							<div class="space-y-2">
								<Label>{m_i18n.admin_value_s()}</Label>
								<Input
									bind:value={formAdminValue}
									placeholder={m_i18n.admin_administrators()}
								/>
								<p class="text-xs text-muted-foreground">{m_i18n.comma_separated_values_that_grant_admin_role()}</p>
							</div>
						</div>
					</div>

					<!-- Role Mappings Grid -->
					<div class="space-y-4">
						<div class="flex items-center justify-between">
							<div>
								<h4 class="text-sm font-medium text-muted-foreground">{m_i18n.claim_to_role_mappings()}</h4>
								<p class="text-xs text-muted-foreground mt-0.5">{m_i18n.map_claim_values_from_your_identity_provider_to()}</p>
							</div>
							<Button
								size="sm"
								variant="outline"
								onclick={addRoleMapping}
							>
								<Plus class="w-4 h-4" />
								{m_i18n.add_mapping()}
							</Button>
						</div>

						{#if formRoleMappings.length === 0}
							<div class="text-center py-6 text-muted-foreground text-sm border border-dashed rounded-lg">
								{m_i18n.no_role_mappings_configured_click_add_mapping_to()}
							</div>
						{:else}
							<div class="space-y-2">
								{#each formRoleMappings as mapping, index}
									<div class="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
										<div class="flex-1 grid grid-cols-2 gap-3">
											<div class="space-y-1">
												<Label class="text-xs">{m_i18n.claim_value()}</Label>
												<Input
													bind:value={mapping.claim_value}
													placeholder={m_i18n.e_g_developers_admins()}
													class="h-8"
												/>
											</div>
											<div class="space-y-1">
												<Label class="text-xs">{m_i18n.dockhand_role()}</Label>
												<Select.Root
													type="single"
													value={mapping.role_id ? String(mapping.role_id) : undefined}
													onValueChange={(value) => {
														if (value) {
															updateRoleMappingRole(index, parseInt(value));
														}
													}}
												>
													<Select.Trigger class="h-8">
														{#if mapping.role_id}
															{roles.find(r => r.id === mapping.role_id)?.name || 'Select role...'}
														{:else}
															{m_i18n.select_role_ef3e()}
														{/if}
													</Select.Trigger>
													<Select.Content>
														{#each roles as role}
															<Select.Item value={String(role.id)}>
																<div class="flex items-center gap-2">
																	<Shield class="w-3.5 h-3.5 text-muted-foreground" />
																	{role.name}
																</div>
															</Select.Item>
														{/each}
													</Select.Content>
												</Select.Root>
											</div>
										</div>
										<Button
											size="sm"
											variant="ghost"
											class="text-destructive hover:text-destructive h-8 w-8 p-0"
											onclick={() => removeRoleMapping(index)}
										>
											<Trash2 class="w-4 h-4" />
										</Button>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/if}
			</Tabs.Content>
		</Tabs.Root>

		<Dialog.Footer class="flex-shrink-0 border-t pt-4">
			<Button variant="outline" onclick={handleClose}>{m_i18n.cancel()}</Button>
			<Button onclick={save} disabled={formSaving}>
				{#if formSaving}
					<RefreshCw class="w-4 h-4 mr-1 animate-spin" />
				{:else if isEditing}
					<Check class="w-4 h-4" />
				{:else}
					<Plus class="w-4 h-4" />
				{/if}
				{isEditing ? 'Save' : 'Add provider'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
