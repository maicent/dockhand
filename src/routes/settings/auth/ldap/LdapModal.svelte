<script lang="ts">
	import { m as m_i18n } from '$lib/paraglide/messages.js';
	import { orEmpty } from '$lib/i18n.js';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Tabs from '$lib/components/ui/tabs';
	import { Label } from '$lib/components/ui/label';
	import { Input } from '$lib/components/ui/input';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import * as Select from '$lib/components/ui/select';
	import { Network, Pencil, Plus, Check, RefreshCw, TriangleAlert, Trash2, Star } from 'lucide-svelte';
	import * as Alert from '$lib/components/ui/alert';
	import { focusFirstInput } from '$lib/utils';

	export interface LdapRoleMapping {
		groupDn: string;
		roleId: number;
	}

	export interface LdapConfig {
		id: number;
		name: string;
		enabled: boolean;
		serverUrl: string;
		bindDn?: string;
		bindPassword?: string;
		baseDn: string;
		userFilter: string;
		usernameAttribute: string;
		emailAttribute: string;
		displayNameAttribute: string;
		groupBaseDn?: string;
		groupFilter?: string;
		adminGroup?: string;
		roleMappings?: LdapRoleMapping[];
		tlsEnabled: boolean;
		tlsCa?: string;
	}

	interface Role {
		id: number;
		name: string;
		isSystem: boolean;
	}

	interface Props {
		open: boolean;
		ldap?: LdapConfig | null;
		roles?: Role[];
		isEnterprise?: boolean;
		onClose: () => void;
		onSaved: () => void;
	}

	let { open = $bindable(), ldap = null, roles = [], isEnterprise = false, onClose, onSaved }: Props = $props();

	const isEditing = $derived(ldap !== null);

	// Form state
	let formName = $state('');
	let formEnabled = $state(false);
	let formServerUrl = $state('');
	let formBindDn = $state('');
	let formBindPassword = $state('');
	let formBaseDn = $state('');
	let formUserFilter = $state('(uid={{username}})');
	let formUsernameAttr = $state('uid');
	let formEmailAttr = $state('mail');
	let formDisplayNameAttr = $state('cn');
	let formGroupBaseDn = $state('');
	let formGroupFilter = $state('');
	let formAdminGroup = $state('');
	let formRoleMappings = $state<LdapRoleMapping[]>([]);
	let formTlsEnabled = $state(false);
	let formTlsCa = $state('');
	let formError = $state('');
	let formErrors = $state<{ name?: string; serverUrl?: string; baseDn?: string }>({});
	let formSaving = $state(false);
	let formModalTab = $state<'connection' | 'groups'>('connection');

	// Role mapping helpers
	function addRoleMapping() {
		formRoleMappings = [...formRoleMappings, { groupDn: '', roleId: 0 }];
	}

	function removeRoleMapping(index: number) {
		formRoleMappings = formRoleMappings.filter((_, i) => i !== index);
	}

	function updateRoleMappingRole(index: number, roleId: number) {
		formRoleMappings = formRoleMappings.map((mapping, i) =>
			i === index ? { ...mapping, roleId } : mapping
		);
	}

	function updateRoleMappingGroupDn(index: number, groupDn: string) {
		formRoleMappings = formRoleMappings.map((mapping, i) =>
			i === index ? { ...mapping, groupDn } : mapping
		);
	}

	function resetForm() {
		formName = '';
		formEnabled = false;
		formServerUrl = '';
		formBindDn = '';
		formBindPassword = '';
		formBaseDn = '';
		formUserFilter = '(uid={{username}})';
		formUsernameAttr = 'uid';
		formEmailAttr = 'mail';
		formDisplayNameAttr = 'cn';
		formGroupBaseDn = '';
		formGroupFilter = '';
		formAdminGroup = '';
		formRoleMappings = [];
		formTlsEnabled = false;
		formTlsCa = '';
		formError = '';
		formErrors = {};
		formSaving = false;
		formModalTab = 'connection';
	}

	// Initialize form when ldap changes or modal opens
	$effect(() => {
		if (open) {
			if (ldap) {
				formName = ldap.name;
				formEnabled = ldap.enabled;
				formServerUrl = ldap.serverUrl;
				formBindDn = ldap.bindDn || '';
				formBindPassword = ldap.bindPassword || '';
				formBaseDn = ldap.baseDn;
				formUserFilter = ldap.userFilter || '(uid={{username}})';
				formUsernameAttr = ldap.usernameAttribute || 'uid';
				formEmailAttr = ldap.emailAttribute || 'mail';
				formDisplayNameAttr = ldap.displayNameAttribute || 'cn';
				formGroupBaseDn = ldap.groupBaseDn || '';
				formGroupFilter = ldap.groupFilter || '';
				formAdminGroup = ldap.adminGroup || '';
				formRoleMappings = ldap.roleMappings || [];
				formTlsEnabled = ldap.tlsEnabled || false;
				formTlsCa = ldap.tlsCa || '';
				formError = '';
				formErrors = {};
				formSaving = false;
				formModalTab = 'connection';
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
		if (!formServerUrl.trim()) {
			formErrors.serverUrl = 'Server URL is required';
			hasErrors = true;
		}
		if (!formBaseDn.trim()) {
			formErrors.baseDn = 'Base DN is required';
			hasErrors = true;
		}

		if (hasErrors) return;

		formSaving = true;
		formError = '';

		try {
			const url = isEditing ? `/api/auth/ldap/${ldap!.id}` : '/api/auth/ldap';
			const method = isEditing ? 'PUT' : 'POST';

			// Filter valid role mappings (both groupDn and roleId must be set)
			const validRoleMappings = formRoleMappings.filter(m => m.groupDn.trim() && m.roleId);

			const response = await fetch(url, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: formName.trim(),
					enabled: formEnabled,
					serverUrl: formServerUrl.trim(),
					bindDn: formBindDn.trim() || undefined,
					bindPassword: formBindPassword || undefined,
					baseDn: formBaseDn.trim(),
					userFilter: formUserFilter.trim() || '(uid={{username}})',
					usernameAttribute: formUsernameAttr.trim() || 'uid',
					emailAttribute: formEmailAttr.trim() || 'mail',
					displayNameAttribute: formDisplayNameAttr.trim() || 'cn',
					groupBaseDn: formGroupBaseDn.trim() || undefined,
					groupFilter: formGroupFilter.trim() || undefined,
					adminGroup: formAdminGroup.trim() || undefined,
					roleMappings: validRoleMappings.length > 0 ? validRoleMappings : undefined,
					tlsEnabled: formTlsEnabled,
					tlsCa: formTlsCa.trim() || undefined
				})
			});

			if (response.ok) {
				open = false;
				onSaved();
			} else {
				const data = await response.json();
				formError = data.error || `Failed to ${isEditing ? 'update' : 'create'} LDAP configuration`;
			}
		} catch {
			formError = `Failed to ${isEditing ? 'update' : 'create'} LDAP configuration`;
		} finally {
			formSaving = false;
		}
	}

	function handleClose() {
		open = false;
		onClose();
	}
</script>

<Dialog.Root bind:open onOpenChange={(o) => { if (o) { formError = ''; formErrors = {}; formModalTab = 'connection'; focusFirstInput(); } }}>
	<Dialog.Content class="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
		<Dialog.Header class="flex-shrink-0">
			<Dialog.Title class="flex items-center gap-2">
				{#if isEditing}
					<Pencil class="w-5 h-5" />
					{m_i18n.edit_ldap_configuration()}
				{:else}
					<Network class="w-5 h-5" />
					{m_i18n.add_ldap_configuration()}
				{/if}
			</Dialog.Title>
		</Dialog.Header>
		<div class="flex-1 overflow-y-auto py-2">
			{#if formError}
				<Alert.Root variant="destructive" class="mb-4">
					<TriangleAlert class="h-4 w-4" />
					<Alert.Description>{formError}</Alert.Description>
				</Alert.Root>
			{/if}

			<Tabs.Root bind:value={formModalTab}>
				<Tabs.List class="grid w-full grid-cols-2 mb-4">
					<Tabs.Trigger value="connection">{m_i18n.connection()}</Tabs.Trigger>
					<Tabs.Trigger value="groups">{m_i18n.group_settings()}</Tabs.Trigger>
				</Tabs.List>

				<Tabs.Content value="connection" class="space-y-4">
					<!-- Basic Settings -->
					<div class="space-y-4">
						<h4 class="text-sm font-medium text-muted-foreground">{m_i18n.basic_settings()}</h4>
						<div class="grid grid-cols-2 gap-4">
							<div class="space-y-2">
								<Label>{m_i18n.name()} <span class="text-destructive">*</span></Label>
								<Input
									bind:value={formName}
									placeholder={m_i18n.corporate_ldap()}
									class={formErrors.name ? 'border-destructive focus-visible:ring-destructive' : ''}
									oninput={() => formErrors.name = undefined}
								/>
								{#if formErrors.name}
									<p class="text-xs text-destructive">{formErrors.name}</p>
								{/if}
							</div>
							<div class="space-y-2">
								<Label>{m_i18n.server_url()} <span class="text-destructive">*</span></Label>
								<Input
									bind:value={formServerUrl}
									placeholder={m_i18n.ldap_ldap_example_com_389()}
									class={formErrors.serverUrl ? 'border-destructive focus-visible:ring-destructive' : ''}
									oninput={() => formErrors.serverUrl = undefined}
								/>
								{#if formErrors.serverUrl}
									<p class="text-xs text-destructive">{formErrors.serverUrl}</p>
								{/if}
							</div>
						</div>
						<div class="flex items-center gap-2">
							<Checkbox
								checked={formEnabled}
								onCheckedChange={(checked) => formEnabled = checked === true}
							/>
							<Label class="text-sm font-normal cursor-pointer" onclick={() => formEnabled = !formEnabled}>
								{m_i18n.enable_this_ldap_configuration()}
							</Label>
						</div>
					</div>

					<!-- Bind Credentials -->
					<div class="space-y-4">
						<h4 class="text-sm font-medium text-muted-foreground">{m_i18n.bind_credentials_optional()}</h4>
						<p class="text-xs text-muted-foreground">{m_i18n.service_account_used_to_search_for_users_leave_e()}</p>
						<div class="grid grid-cols-2 gap-4">
							<div class="space-y-2">
								<Label>{m_i18n.bind_dn()}</Label>
								<Input
									bind:value={formBindDn}
									placeholder={m_i18n.cn_admin_dc_example_dc_com()}
								/>
							</div>
							<div class="space-y-2">
								<Label>{m_i18n.bind_password()}</Label>
								<Input
									type="password"
									bind:value={formBindPassword}
									placeholder={isEditing ? 'Leave blank to keep existing' : 'Enter password'}
								/>
							</div>
						</div>
					</div>

					<!-- Search Settings -->
					<div class="space-y-4">
						<h4 class="text-sm font-medium text-muted-foreground">{m_i18n.user_search_settings()}</h4>
						<div class="space-y-2">
							<Label>{m_i18n.base_dn()} <span class="text-destructive">*</span></Label>
							<Input
								bind:value={formBaseDn}
								placeholder={m_i18n.dc_example_dc_com()}
								class={formErrors.baseDn ? 'border-destructive focus-visible:ring-destructive' : ''}
								oninput={() => formErrors.baseDn = undefined}
							/>
							{#if formErrors.baseDn}
								<p class="text-xs text-destructive">{formErrors.baseDn}</p>
							{:else}
								<p class="text-xs text-muted-foreground">{m_i18n.the_base_dn_to_search_for_users()}</p>
							{/if}
						</div>
						<div class="space-y-2">
							<Label>{m_i18n.user_filter()}</Label>
							<Input
								bind:value={formUserFilter}
								placeholder={`(uid={{username}})`}
							/>
							<p class="text-xs text-muted-foreground">
								{m_i18n.ldap_filter_to_find_users_use()} <code class="text-xs bg-muted px-1 rounded">{`{{username}}`}</code> {m_i18n.as_placeholder()}<br />
								<span class="text-muted-foreground/70">{m_i18n.openldap()} <code class="text-xs bg-muted px-1 rounded">{m_i18n.uid_arg1({ arg1: orEmpty(`{{username}}`) })}</code> {m_i18n.ad()} <code class="text-xs bg-muted px-1 rounded">{m_i18n.samaccountname_arg1({ arg1: orEmpty(`{{username}}`) })}</code></span>
							</p>
						</div>
					</div>

					<!-- Attribute Mapping -->
					<div class="space-y-4">
						<h4 class="text-sm font-medium text-muted-foreground">{m_i18n.attribute_mapping()}</h4>
						<div class="grid grid-cols-3 gap-4">
							<div class="space-y-2">
								<Label>{m_i18n.username_attribute()}</Label>
								<Input
									bind:value={formUsernameAttr}
									placeholder={m_i18n.uid()}
								/>
							</div>
							<div class="space-y-2">
								<Label>{m_i18n.email_attribute()}</Label>
								<Input
									bind:value={formEmailAttr}
									placeholder={m_i18n.mail()}
								/>
							</div>
							<div class="space-y-2">
								<Label>{m_i18n.display_name_attribute()}</Label>
								<Input
									bind:value={formDisplayNameAttr}
									placeholder={m_i18n.cn()}
								/>
							</div>
						</div>
					</div>

					<!-- TLS Settings -->
					<div class="space-y-4">
						<h4 class="text-sm font-medium text-muted-foreground">{m_i18n.tls_settings()}</h4>
						<div class="flex items-center gap-2">
							<Checkbox
								checked={formTlsEnabled}
								onCheckedChange={(checked) => formTlsEnabled = checked === true}
							/>
							<Label class="text-sm font-normal cursor-pointer" onclick={() => formTlsEnabled = !formTlsEnabled}>
								{m_i18n.enable_tls_ldaps_or_starttls()}
							</Label>
						</div>
						{#if formTlsEnabled}
							<div class="space-y-2">
								<Label>{m_i18n.ca_certificate_optional()}</Label>
								<textarea
									bind:value={formTlsCa}
									class="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
									placeholder={m_i18n.begin_certificate_end_certificate()}
								></textarea>
							</div>
						{/if}
					</div>
				</Tabs.Content>

				<Tabs.Content value="groups" class="space-y-4">
					<!-- Group Settings -->
					<div class="space-y-4">
						<h4 class="text-sm font-medium text-muted-foreground">{m_i18n.group_settings()}</h4>
						<p class="text-xs text-muted-foreground">{m_i18n.configure_group_based_access_control_these_setti()}</p>
						<div class="grid grid-cols-2 gap-4">
							<div class="space-y-2">
								<Label>{m_i18n.group_base_dn()}</Label>
								<Input
									bind:value={formGroupBaseDn}
									placeholder={m_i18n.ou_groups_dc_example_dc_com()}
								/>
								<p class="text-xs text-muted-foreground">{m_i18n.the_base_dn_to_search_for_groups()}</p>
							</div>
							<div class="space-y-2">
								<Label>{m_i18n.admin_group()}</Label>
								<Input
									bind:value={formAdminGroup}
									placeholder={m_i18n.cn_admins_ou_groups_dc_example_dc_com()}
								/>
								<p class="text-xs text-muted-foreground">{m_i18n.members_of_this_group_will_be_admins()}</p>
							</div>
						</div>
						<div class="space-y-2">
							<Label>{m_i18n.member_filter()}</Label>
							<Input
								bind:value={formGroupFilter}
								placeholder={'(&(objectClass=groupOfNames)(member={{user_dn}}))'}
							/>
							<p class="text-xs text-muted-foreground">
								{m_i18n.filter_to_find_groups_the_user_belongs_to_use()} <code class="text-xs bg-muted px-1 rounded">{'{{user_dn}}'}</code> {m_i18n.as_placeholder()}
							</p>
						</div>
					</div>

					<!-- Role Mappings (Enterprise) -->
					{#if isEnterprise}
						<div class="space-y-4">
							<div class="flex items-center gap-2">
								<h4 class="text-sm font-medium text-muted-foreground">{m_i18n.group_to_role_mappings()}</h4>
								<Star class="w-3.5 h-3.5 text-amber-500" />
							</div>
							<p class="text-xs text-muted-foreground">{m_i18n.map_ldap_groups_to_dockhand_roles_users_in_these()}</p>

							{#if formRoleMappings.length > 0}
								<div class="space-y-2">
									{#each formRoleMappings as mapping, index}
										<div class="flex items-center gap-2">
											<Input
												value={mapping.groupDn}
												placeholder={m_i18n.cn_developers_ou_groups_dc_example_dc_com()}
												class="flex-1"
												oninput={(e) => updateRoleMappingGroupDn(index, e.currentTarget.value)}
											/>
											<Select.Root
												type="single"
												value={mapping.roleId ? String(mapping.roleId) : undefined}
												onValueChange={(value) => updateRoleMappingRole(index, parseInt(value))}
											>
												<Select.Trigger class="w-40">
													{#if mapping.roleId}
														{@const role = roles.find(r => r.id === mapping.roleId)}
														{role?.name || 'Select role'}
													{:else}
														{m_i18n.select_role()}
													{/if}
												</Select.Trigger>
												<Select.Content>
													{#each roles.filter(r => !r.isSystem || r.name !== 'Admin') as role}
														<Select.Item value={String(role.id)}>{role.name}</Select.Item>
													{/each}
												</Select.Content>
											</Select.Root>
											<Button
												variant="ghost"
												size="icon"
												class="h-9 w-9 text-muted-foreground hover:text-destructive"
												onclick={() => removeRoleMapping(index)}
											>
												<Trash2 class="w-4 h-4" />
											</Button>
										</div>
									{/each}
								</div>
							{/if}

							<Button variant="outline" size="sm" onclick={addRoleMapping}>
								<Plus class="w-4 h-4" />
								{m_i18n.add_mapping()}
							</Button>
						</div>
					{/if}
				</Tabs.Content>
			</Tabs.Root>
		</div>
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
				{isEditing ? 'Save' : 'Add configuration'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
