<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { orEmpty } from '$lib/i18n.js';
	import * as Card from '$lib/components/ui/card';
	import * as Select from '$lib/components/ui/select';
	import { Label } from '$lib/components/ui/label';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { TogglePill, ToggleSwitch } from '$lib/components/ui/toggle-pill';
	import CronEditor from '$lib/components/cron-editor.svelte';
	import TimezoneSelector from '$lib/components/TimezoneSelector.svelte';
	import { Eye, Bell, Database, Calendar, ShieldCheck, FileText, AlertTriangle, HelpCircle, Globe, Activity, Clock, Info, Save, RotateCcw, LayoutDashboard, Tags, Archive, ChevronRight, ChevronDown, Compass, Layers } from 'lucide-svelte';
	import { STACK_LOG_OPERATIONS, type StackLogOperation } from '$lib/utils/stack-log-operations';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import { appSettings, type DateFormat, type DownloadFormat, type EventCollectionMode, type LabelFilterMode } from '$lib/stores/settings';
	import { canAccess, authStore } from '$lib/stores/auth';
	import { toast } from 'svelte-sonner';
	import ThemeSelector from '$lib/components/ThemeSelector.svelte';
	import LanguageSelector from '$lib/components/LanguageSelector.svelte';
	import NavigationSelector from '$lib/components/NavigationSelector.svelte';
	import AnimateIconsToggle from '$lib/components/AnimateIconsToggle.svelte';
	import IndentGuidesToggle from '$lib/components/IndentGuidesToggle.svelte';
	import EditorThemeSelector from '$lib/components/EditorThemeSelector.svelte';
	import ColoredActionsToggle from '$lib/components/ColoredActionsToggle.svelte';
	import SemverCheckConfig from '$lib/components/SemverCheckConfig.svelte';
	import {
		DEFAULT_GRYPE_IMAGE,
		DEFAULT_TRIVY_IMAGE,
		DEFAULT_GRYPE_ARGS,
		DEFAULT_TRIVY_ARGS,
		imageRepo
	} from '$lib/utils/scanner-images';
	import { onMount } from 'svelte';
	import * as Tooltip from '$lib/components/ui/tooltip';

	// General settings state - these derive from the store
	let confirmDestructive = $derived($appSettings.confirmDestructive);
	let showStoppedContainers = $derived($appSettings.showStoppedContainers);
	let highlightUpdates = $derived($appSettings.highlightUpdates);
	let compactPorts = $derived($appSettings.compactPorts);
	let showExposedPorts = $derived($appSettings.showExposedPorts);
	let showGitCommitHash = $derived($appSettings.showGitCommitHash);
	let honorProxyLabels = $derived($appSettings.honorProxyLabels);
	let showImageChangelogLinks = $derived($appSettings.showImageChangelogLinks);
	let useSelfhstIcons = $derived($appSettings.useSelfhstIcons);
	let showWhatsNew = $derived($appSettings.showWhatsNew);
	let timeFormat = $derived($appSettings.timeFormat);
	let dateFormat = $derived($appSettings.dateFormat);
	let downloadFormat = $derived($appSettings.downloadFormat);
	let defaultGrypeArgs = $derived($appSettings.defaultGrypeArgs);
	let defaultTrivyArgs = $derived($appSettings.defaultTrivyArgs);
	let defaultGrypeImage = $derived($appSettings.defaultGrypeImage);
	let defaultTrivyImage = $derived($appSettings.defaultTrivyImage);
	let defaultScannerNetworkMode = $derived($appSettings.defaultScannerNetworkMode);
	let defaultScannerDns = $derived($appSettings.defaultScannerDns);
	let stackLogOperations = $derived($appSettings.stackLogOperations);

	function toggleStackLogOperation(op: StackLogOperation, show: boolean) {
		const next = show
			? [...stackLogOperations, op]
			: stackLogOperations.filter((o) => o !== op);
		appSettings.setStackLogOperations(next);
	}
	let showAdvancedScannerSettings = $state(false);
	let defaultComposeTemplate = $derived($appSettings.defaultComposeTemplate);
	let labelFilterMode = $derived($appSettings.labelFilterMode);
	let composeTemplateWIP = $state('');
	let composeTemplateInitialized = false;

	$effect(() => {
		if (!composeTemplateInitialized && defaultComposeTemplate !== undefined) {
			composeTemplateWIP = defaultComposeTemplate;
			composeTemplateInitialized = true;
		}
	});

	const builtinComposeTemplate = `version: "3.8"

services:
  app:
    image: nginx:alpine
    ports:
      - "8080:80"
    environment:
      - APP_ENV=\${APP_ENV:-production}
    volumes:
      - ./html:/usr/share/nginx/html:ro
    restart: unless-stopped

# Add more services as needed
# networks:
#   default:
#     driver: bridge
`;

	function saveComposeTemplate() {
		appSettings.setDefaultComposeTemplate(composeTemplateWIP);
		toast.success(m.compose_template_updated());
	}

	function revertComposeTemplate() {
		composeTemplateWIP = builtinComposeTemplate;
		toast.info(m.template_reverted_to_default());
	}
	let scheduleRetentionDays = $derived($appSettings.scheduleRetentionDays);
	let eventRetentionDays = $derived($appSettings.eventRetentionDays);
	let scheduleCleanupCron = $derived($appSettings.scheduleCleanupCron);
	let eventCleanupCron = $derived($appSettings.eventCleanupCron);
	let scheduleCleanupEnabled = $derived($appSettings.scheduleCleanupEnabled);
	let eventCleanupEnabled = $derived($appSettings.eventCleanupEnabled);
	let scanRetentionCron = $derived($appSettings.scanRetentionCron);
	let scanRetentionEnabled = $derived($appSettings.scanRetentionEnabled);
	let scanRetentionKeep = $derived($appSettings.scanRetentionKeep);
	let scanRetentionGraceDays = $derived($appSettings.scanRetentionGraceDays);
	let scannerCleanupCron = $derived($appSettings.scannerCleanupCron);
	let scannerCleanupEnabled = $derived($appSettings.scannerCleanupEnabled);
	let deployLogReconcileCron = $derived($appSettings.deployLogReconcileCron);
	let deployLogReconcileEnabled = $derived($appSettings.deployLogReconcileEnabled);
	let logMaxLines = $derived($appSettings.logMaxLines);
	let formatLogTimestamps = $derived($appSettings.formatLogTimestamps);
	let defaultTimezone = $derived($appSettings.defaultTimezone);
	let eventCollectionMode = $derived($appSettings.eventCollectionMode);
	let eventPollInterval = $derived($appSettings.eventPollInterval);
	let metricsCollectionInterval = $derived($appSettings.metricsCollectionInterval);
	let defaultBackupImage = $derived($appSettings.defaultBackupImage);

	let clearingCache = $state(false);

	async function clearScannerCache() {
		clearingCache = true;
		try {
			const res = await fetch('/api/settings/scanner/cache', { method: 'DELETE' });
			const data = await res.json();
			if (res.ok && data.success) {
				const total = (data.removedVolumes?.length || 0) + (data.removedDirs?.length || 0);
				if (total > 0) {
					toast.success(`Scanner cache cleared (${total} items removed)`);
				} else {
					toast.info(m.scanner_cache_was_already_empty());
				}
			} else {
				toast.error(data.error || 'Failed to clear scanner cache');
			}
		} catch {
			toast.error(m.failed_to_clear_scanner_cache());
		} finally {
			clearingCache = false;
		}
	}

	const dateFormatOptions: { value: DateFormat; label: string; example: string }[] = [
		{ value: 'DD.MM.YYYY', label: m.dd_mm_yyyy(), example: '31.12.2024' },
		{ value: 'DD/MM/YYYY', label: m.dd_mm_yyyy_5d95(), example: '31/12/2024' },
		{ value: 'MM/DD/YYYY', label: m.mm_dd_yyyy(), example: '12/31/2024' },
		{ value: 'YYYY-MM-DD', label: m.yyyy_mm_dd(), example: '2024-12-31' }
	];

	const downloadFormatOptions: { value: DownloadFormat; label: string; description: string }[] = [
		{ value: 'tar', label: m.tar(), description: m.uncompressed_archive() },
		{ value: 'tar.gz', label: m.tar_gz(), description: m.gzip_compressed_archive() },
		{ value: 'raw', label: m.no_archive(), description: m.single_file_raw_bytes() }
	];

	const downloadFormatLabel: Record<DownloadFormat, string> = {
		tar: 'tar',
		'tar.gz': 'tar.gz',
		raw: 'No archive'
	};

	function handleScheduleRetentionChange(e: Event) {
		const value = Math.max(1, Math.min(365, parseInt((e.target as HTMLInputElement).value) || 30));
		appSettings.setScheduleRetentionDays(value);
		toast.success(m.schedule_retention_updated());
	}

	function handleEventRetentionChange(e: Event) {
		const value = Math.max(1, Math.min(365, parseInt((e.target as HTMLInputElement).value) || 30));
		appSettings.setEventRetentionDays(value);
		toast.success(m.event_retention_updated());
	}

	function handleScheduleCleanupCronChange(cron: string) {
		appSettings.setScheduleCleanupCron(cron);
		toast.success(m.schedule_cleanup_cron_updated());
	}

	function handleEventCleanupCronChange(cron: string) {
		appSettings.setEventCleanupCron(cron);
		toast.success(m.event_cleanup_cron_updated());
	}

	function handleScheduleCleanupEnabledChange() {
		const newState = !scheduleCleanupEnabled;
		appSettings.setScheduleCleanupEnabled(newState);
		toast.success(newState ? 'Schedule cleanup enabled' : 'Schedule cleanup disabled');
	}

	function handleEventCleanupEnabledChange() {
		const newState = !eventCleanupEnabled;
		appSettings.setEventCleanupEnabled(newState);
		toast.success(newState ? 'Event cleanup enabled' : 'Event cleanup disabled');
	}

	function handleScanRetentionEnabledChange() {
		const newState = !scanRetentionEnabled;
		appSettings.setScanRetentionEnabled(newState);
		toast.success(newState ? 'Scan retention enabled' : 'Scan retention disabled');
	}

	function handleScanRetentionCronChange(cron: string) {
		appSettings.setScanRetentionCron(cron);
		toast.success(m.scan_retention_schedule_updated());
	}

	function handleScanRetentionKeepChange(event: Event) {
		const value = parseInt((event.target as HTMLInputElement).value, 10);
		if (!Number.isFinite(value) || value < 1) return;
		appSettings.setScanRetentionKeep(value);
		toast.success(m.scan_retention_updated());
	}

	function handleScanRetentionGraceChange(event: Event) {
		const value = parseInt((event.target as HTMLInputElement).value, 10);
		if (!Number.isFinite(value) || value < 0) return;
		appSettings.setScanRetentionGraceDays(value);
		toast.success(m.scan_retention_updated());
	}

	function handleScannerCleanupCronChange(cron: string) {
		appSettings.setScannerCleanupCron(cron);
		toast.success(m.scanner_cleanup_cron_updated());
	}

	function handleScannerCleanupEnabledChange() {
		const newState = !scannerCleanupEnabled;
		appSettings.setScannerCleanupEnabled(newState);
		toast.success(newState ? 'Scanner cleanup enabled' : 'Scanner cleanup disabled');
	}

	function handleDeployLogReconcileCronChange(cron: string) {
		appSettings.setDeployLogReconcileCron(cron);
		toast.success(m.deploy_log_reconcile_cron_updated());
	}

	function handleDeployLogReconcileEnabledChange() {
		const newState = !deployLogReconcileEnabled;
		appSettings.setDeployLogReconcileEnabled(newState);
		toast.success(newState ? 'Deploy log reconcile enabled' : 'Deploy log reconcile disabled');
	}

	function handleGrypeImageBlur(e: Event) {
		const value = (e.target as HTMLInputElement).value.trim();
		if (value && value !== defaultGrypeImage) {
			appSettings.setDefaultGrypeImage(value);
			toast.success(m.grype_image_updated());
		}
	}

	function handleTrivyImageBlur(e: Event) {
		const value = (e.target as HTMLInputElement).value.trim();
		if (value && value !== defaultTrivyImage) {
			appSettings.setDefaultTrivyImage(value);
			toast.success(m.trivy_image_updated());
		}
	}

	// Newer scanner releases, asked for on demand: the check reaches the registry,
	// and the image stays pinned until someone applies the suggestion.
	let checkingScannerVersions = $state(false);
	let newerScanners = $state<{ grype: string | null; trivy: string | null }>({ grype: null, trivy: null });
	// Per scanner: the check ran and found nothing newer. Applying a suggestion
	// does NOT set this - that image has not been re-checked.
	let scannerUpToDate = $state<{ grype: boolean; trivy: boolean }>({ grype: false, trivy: false });

	async function checkScannerVersions() {
		checkingScannerVersions = true;
		try {
			const res = await fetch('/api/settings/scanner?checkNewerVersions=true');
			const data = await res.json();
			newerScanners = {
				grype: data.newerVersions?.grype?.latest ?? null,
				trivy: data.newerVersions?.trivy?.latest ?? null
			};
			scannerUpToDate = { grype: !newerScanners.grype, trivy: !newerScanners.trivy };
		} catch {
			toast.error(m.could_not_reach_the_registry_to_check_scanner_ve());
		} finally {
			checkingScannerVersions = false;
		}
	}

	function applyScannerVersion(scanner: 'grype' | 'trivy') {
		const tag = scanner === 'grype' ? newerScanners.grype : newerScanners.trivy;
		if (!tag) return;
		const current = scanner === 'grype' ? defaultGrypeImage : defaultTrivyImage;
		const image = `${imageRepo(current)}:${tag}`;
		if (scanner === 'grype') {
			appSettings.setDefaultGrypeImage(image);
			newerScanners = { ...newerScanners, grype: null };
			scannerUpToDate = { ...scannerUpToDate, grype: false };
		} else {
			appSettings.setDefaultTrivyImage(image);
			newerScanners = { ...newerScanners, trivy: null };
			scannerUpToDate = { ...scannerUpToDate, trivy: false };
		}
		toast.success(`Scanner image set to ${image} - pull it to start using it`);
	}

	function handleGrypeArgsBlur(e: Event) {
		const value = (e.target as HTMLInputElement).value.trim();
		if (value !== defaultGrypeArgs) {
			appSettings.setDefaultGrypeArgs(value);
			toast.success(m.grype_default_arguments_updated());
		}
	}

	function handleTrivyArgsBlur(e: Event) {
		const value = (e.target as HTMLInputElement).value.trim();
		if (value !== defaultTrivyArgs) {
			appSettings.setDefaultTrivyArgs(value);
			toast.success(m.trivy_default_arguments_updated());
		}
	}

	function handleScannerNetworkModeChange(value: string) {
		const trimmed = (value ?? '').trim();
		if (trimmed !== defaultScannerNetworkMode) {
			appSettings.setDefaultScannerNetworkMode(trimmed);
			toast.success(trimmed ? `Scanner network mode set to ${trimmed}` : 'Scanner network mode cleared');
		}
	}

	function handleScannerDnsBlur(e: Event) {
		const raw = (e.target as HTMLInputElement).value.trim();
		const cleaned = raw
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);
		const sameAsCurrent =
			cleaned.length === defaultScannerDns.length &&
			cleaned.every((v, i) => v === defaultScannerDns[i]);
		if (!sameAsCurrent) {
			appSettings.setDefaultScannerDns(cleaned);
			toast.success(cleaned.length ? `Scanner DNS set to ${cleaned.join(', ')}` : 'Scanner DNS cleared');
		}
	}

	// Anything above 2K starts feeling laggy in browsers without virtualized rendering.
	const logMaxLinesOptions = [
		{ value: '500', label: m.t_500_lines() },
		{ value: '1000', label: m.t_1_000_lines() },
		{ value: '2000', label: m.t_2_000_lines() }
	];

	function handleLogMaxLinesChange(value: string | undefined) {
		const n = parseInt(value ?? '');
		if (!Number.isFinite(n) || n <= 0) return;
		appSettings.setLogMaxLines(Math.min(2000, Math.max(100, n)));
		toast.success(m.log_buffer_size_updated());
	}

	function handleEventCollectionModeChange(value: string | undefined) {
		if (value === 'stream' || value === 'poll') {
			appSettings.setEventCollectionMode(value);
			toast.success(`Event collection mode: ${value}`);
		}
	}

	function handleEventPollIntervalChange(selected: { value: number } | undefined) {
		if (selected?.value) {
			appSettings.setEventPollInterval(selected.value);
			toast.success(`Event poll interval: ${selected.value / 1000}s`);
		}
	}

	function handleMetricsIntervalChange(selected: { value: number } | undefined) {
		if (selected?.value) {
			appSettings.setMetricsCollectionInterval(selected.value);
			toast.success(`Metrics interval: ${selected.value / 1000}s`);
		}
	}

	function handleBackupImageBlur(e: Event) {
		const value = (e.target as HTMLInputElement).value.trim();
		if (value && value !== defaultBackupImage) {
			appSettings.setDefaultBackupImage(value);
			toast.success(m.backup_image_updated());
		}
	}

	let releaseAgeHours = $state(0);
	let releaseAgeOverridden = $state(false);
	let releaseAgeSaving = $state(false);

	async function saveReleaseAge() {
		releaseAgeSaving = true;
		try {
			const res = await fetch('/api/settings/minimum-release-age', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ hours: releaseAgeHours })
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Failed to save minimum image age');
			toast.success(m.minimum_image_age_updated());
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to save minimum image age');
		} finally { releaseAgeSaving = false; }
	}

	// Global newer-version-tag (semver) detection.
	let semverEnabled = $state(false);
	let semverMaxBump = $state<'patch' | 'minor' | 'major'>('major');
	let semverMatchFlavor = $state(true);
	let semverIncludePrerelease = $state(false);
	let semverRejectOlderImages = $state(true);
	let semverLoaded = $state(false);

	// The global theme defaults (what a new user starts with). With auth on the theme
	// toggles here edit these, not the admin's own profile. Rendering waits on
	// globalThemeLoaded: until the fetch fills these, a toggle handed globalValue=undefined
	// would fall back to the admin's personal store value and show it.
	let globalColoredActions = $state<boolean | undefined>(undefined);
	let globalAnimateIcons = $state<boolean | undefined>(undefined);
	let globalIndentGuides = $state<boolean | undefined>(undefined);
	let globalThemeLoaded = $state(false);

	onMount(async () => {
		try {
			const res = await fetch('/api/settings/minimum-release-age');
			if (res.ok) {
				const config = await res.json();
				releaseAgeHours = config.hours;
				releaseAgeOverridden = config.overridden;
			}
		} catch { /* keep default */ }
		try {
			const res = await fetch('/api/settings/semver');
			if (res.ok) {
				const c = await res.json();
				semverEnabled = c.enabled ?? false;
				semverMaxBump = c.maxBump ?? 'major';
				semverMatchFlavor = c.matchFlavor ?? true;
				semverIncludePrerelease = c.includePrerelease ?? false;
				semverRejectOlderImages = c.rejectOlderImages ?? true;
			}
			// A refusal means the values on screen are the built-in defaults, never the
			// configuration, so the save effect stays disarmed rather than writing a
			// guess over it. Any other failure still arms it: the controls are visible
			// and edits have to reach the server rather than vanish.
			semverLoaded = res.status !== 401 && res.status !== 403;
		} catch {
			// The request never landed, so nothing says this account may not save.
			semverLoaded = true;
		}

		try {
			const res = await fetch('/api/settings/general');
			if (res.ok) {
				const g = await res.json();
				globalColoredActions = !!g.coloredActionButtons;
				globalAnimateIcons = g.animateIcons ?? true;
				globalIndentGuides = !!g.editorIndentGuides;
			}
		} catch { /* toggles fall back to store when global value is unknown */ }
		globalThemeLoaded = true;
	});

	async function saveSemverConfig() {
		try {
			await fetch('/api/settings/semver', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					enabled: semverEnabled,
					maxBump: semverMaxBump,
					matchFlavor: semverMatchFlavor,
					includePrerelease: semverIncludePrerelease,
					rejectOlderImages: semverRejectOlderImages
				})
			});
		} catch {
			toast.error(m.failed_to_save_version_check_settings());
		}
	}

	// Persist on any change once the initial load is done (skip the load itself).
	$effect(() => {
		semverEnabled; semverMaxBump; semverMatchFlavor; semverIncludePrerelease;
		if (semverLoaded) saveSemverConfig();
	});
</script>

<div class="flex-1 min-h-0 overflow-y-auto">
	<div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
		<!-- Left column -->
		<div class="space-y-4">
			<Card.Root>
				<Card.Header>
					<Card.Title class="text-sm font-medium flex items-center gap-2">
						<Eye class="w-4 h-4" />
						{m.appearance()}
						<Tooltip.Provider delayDuration={100}>
							<Tooltip.Root>
								<Tooltip.Trigger>
									<HelpCircle class="w-4 h-4 text-muted-foreground cursor-help" />
								</Tooltip.Trigger>
								<Tooltip.Portal>
									<Tooltip.Content side="right" sideOffset={8} class="!w-80">
										{#if $authStore.authEnabled}
											{m.these_settings_apply_to_the_login_page_and_as_de()}
										{:else}
											{m.theme_and_font_settings_are_global_when_authenti()}
										{/if}
									</Tooltip.Content>
								</Tooltip.Portal>
							</Tooltip.Root>
						</Tooltip.Provider>
					</Card.Title>
				</Card.Header>
				<Card.Content>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
						<!-- Left column -->
						<div class="space-y-4">
							<div class="space-y-1">
								<div class="flex items-center gap-3">
									<Label>{m.show_stopped_containers()}</Label>
									<TogglePill
										checked={showStoppedContainers}
										onchange={(checked) => {
											appSettings.setShowStoppedContainers(checked);
											toast.success(checked ? 'Stopped containers shown' : 'Stopped containers hidden');
										}}
										disabled={!$canAccess('settings', 'edit')}
									/>
								</div>
								<p class="text-xs text-muted-foreground">{m.display_stopped_and_exited_containers_in_lists()}</p>
							</div>
							<div class="space-y-1">
								<div class="flex items-center gap-3">
									<Label>{m.highlight_available_updates()}</Label>
									<TogglePill
										checked={highlightUpdates}
										onchange={(checked) => {
											appSettings.setHighlightUpdates(checked);
											toast.success(checked ? 'Update highlighting enabled' : 'Update highlighting disabled');
										}}
										disabled={!$canAccess('settings', 'edit')}
									/>
								</div>
								<p class="text-xs text-muted-foreground">{m.highlight_container_rows_in_amber_when_updates_a()}</p>
							</div>
							<div class="space-y-1">
								<div class="flex items-center gap-3">
									<Label>{m.show_changelog_links()}</Label>
									<Tooltip.Root>
										<Tooltip.Trigger>
											<HelpCircle class="w-3.5 h-3.5 text-muted-foreground" />
										</Tooltip.Trigger>
										<Tooltip.Content side="top" class="w-96 max-w-[90vw]">
											<p>{m.surface_a_release_notes_link_next_to_the_image_n()} <code>{m.org_opencontainers_image_source()}</code> {m.label_from_the()} <code>{m.ghcr_io()}</code> {m.registry_path_or_from_an_explicit()} <code>{m.dockhand_changelog_url()}</code> {m.label_override()}</p>
										</Tooltip.Content>
									</Tooltip.Root>
									<TogglePill
										checked={showImageChangelogLinks}
										onchange={(checked) => {
											appSettings.setShowImageChangelogLinks(checked);
											toast.success(checked ? 'Changelog links shown' : 'Changelog links hidden');
										}}
										disabled={!$canAccess('settings', 'edit')}
									/>
								</div>
								<p class="text-xs text-muted-foreground">{m.show_a_release_notes_icon_next_to_images_with_up()}</p>
							</div>
							<div class="space-y-1">
								<div class="flex items-center gap-3">
									<Label>{m.use_selfh_st_icons()}</Label>
									<Tooltip.Root>
										<Tooltip.Trigger>
											<HelpCircle class="w-3.5 h-3.5 text-muted-foreground" />
										</Tooltip.Trigger>
										<Tooltip.Content side="top" class="w-96 max-w-[90vw]">
											<p>{m.show_app_logos_from()} <a href="https://selfh.st" target="_blank" rel="noopener" class="underline">{m.selfh_st()}</a> {m.as_container_icons_matched_automatically_from_th()}</p>
										</Tooltip.Content>
									</Tooltip.Root>
									<TogglePill
										checked={useSelfhstIcons}
										onchange={(checked) => {
											appSettings.setUseSelfhstIcons(checked);
											toast.success(checked ? 'selfh.st icons enabled' : 'selfh.st icons disabled');
										}}
										disabled={!$canAccess('settings', 'edit')}
									/>
								</div>
								<p class="text-xs text-muted-foreground">{m.auto_app_logos_on_containers_fetched_from_selfh()}</p>
							</div>
							<div class="space-y-1">
								<div class="flex items-center gap-3">
									<Label>{m.show_whats_new()}</Label>
									<TogglePill
										checked={showWhatsNew}
										onchange={(checked) => {
											appSettings.setShowWhatsNew(checked);
											toast.success(checked ? "What's New popup enabled" : "What's New popup disabled");
										}}
										disabled={!$canAccess('settings', 'edit')}
									/>
								</div>
								<p class="text-xs text-muted-foreground">{m.show_the_whats_new_popup_after_upgrading_to_a_ne()}</p>
							</div>
							<div class="space-y-1">
								<div class="flex items-center gap-3">
									<Label>{m.compact_port_display()}</Label>
									<TogglePill
										checked={compactPorts}
										onchange={(checked) => {
											appSettings.setCompactPorts(checked);
											toast.success(checked ? 'Compact port display enabled' : 'Showing all ports');
										}}
										disabled={!$canAccess('settings', 'edit')}
									/>
								</div>
								<p class="text-xs text-muted-foreground">{m.show_first_port_with_n_count_instead_of_all_port()}</p>
							</div>
							<div class="space-y-1">
								<div class="flex items-center gap-3">
									<Label>{m.show_exposed_ports()}</Label>
									<Tooltip.Root>
										<Tooltip.Trigger>
											<HelpCircle class="w-3.5 h-3.5 text-muted-foreground" />
										</Tooltip.Trigger>
										<Tooltip.Content side="top" class="w-96 max-w-[90vw]">
											<p>{m.shows_internal_container_ports_from_expose_direc()}</p>
										</Tooltip.Content>
									</Tooltip.Root>
									<TogglePill
										checked={showExposedPorts}
										onchange={(checked) => {
											appSettings.setShowExposedPorts(checked);
											toast.success(checked ? 'Showing exposed ports in container list' : 'Exposed ports hidden from container list');
										}}
										disabled={!$canAccess('settings', 'edit')}
									/>
								</div>
								<p class="text-xs text-muted-foreground">{m.display_internal_container_ports_in_the_containe()}</p>
							</div>
							<div class="space-y-1">
								<div class="flex items-center gap-3">
									<Label>{m.show_git_commit_hash()}</Label>
									<Tooltip.Root>
										<Tooltip.Trigger>
											<HelpCircle class="w-3.5 h-3.5 text-muted-foreground" />
										</Tooltip.Trigger>
										<Tooltip.Content side="top" class="w-96 max-w-[90vw]">
											<p>{m.shows_the_deployed_short_commit_hash_on_the_git()}</p>
										</Tooltip.Content>
									</Tooltip.Root>
									<TogglePill
										checked={showGitCommitHash}
										onchange={(checked) => {
											appSettings.setShowGitCommitHash(checked);
											toast.success(checked ? 'Showing git commit hash on stack badges' : 'Git commit hash hidden');
										}}
										disabled={!$canAccess('settings', 'edit')}
									/>
								</div>
								<p class="text-xs text-muted-foreground">{m.display_the_deployed_commit_hash_on_the_git_sour()}</p>
							</div>
							<div class="space-y-1">
								<div class="flex items-center gap-3">
									<Label>{m.honor_traefik_pangolin_caddy_labels()}</Label>
									<Tooltip.Root>
										<Tooltip.Trigger>
											<HelpCircle class="w-3.5 h-3.5 text-muted-foreground" />
										</Tooltip.Trigger>
										<Tooltip.Content side="top" class="w-96 max-w-[90vw]">
											<p>{m.parse()} <code>{m.traefik_http_routers_name_rule()}</code>, <code>{m.pangolin_public_resources_name_full_domain()}</code>, <code>{m.pangolin_private_resources_name_full_domain()}</code>{m.and_caddy_docker_proxy()} <code>{m.caddy()}</code>/<code>{m.caddy_n()}</code> {m.site_address_labels_and_surface_the_resulting_ur()} <code>{m.dockhand_url()}</code> {m.labels_are_shown()}</p>
										</Tooltip.Content>
									</Tooltip.Root>
									<TogglePill
										checked={honorProxyLabels}
										onchange={(checked) => {
											appSettings.setHonorProxyLabels(checked);
											toast.success(checked ? 'Proxy labels honored' : 'Proxy labels ignored');
										}}
										disabled={!$canAccess('settings', 'edit')}
									/>
								</div>
								<p class="text-xs text-muted-foreground">{m.show_urls_inferred_from_traefik_and_pangolin_lab()}</p>
							</div>
						</div>
						<!-- Right column: Theme settings (always shown, with hint when auth enabled) -->
						<div class="space-y-4">
							<ThemeSelector />
							<LanguageSelector />
							<!-- With auth on the toggles edit the GLOBAL defaults, so they wait for
							     those to load; binding globalValue=undefined first would show the
							     admin's own profile value. With auth off the store IS the global
							     value, so they render immediately. -->
							{#if !$authStore.authEnabled || globalThemeLoaded}
								<ColoredActionsToggle globalValue={$authStore.authEnabled ? globalColoredActions : undefined} />
								<AnimateIconsToggle globalValue={$authStore.authEnabled ? globalAnimateIcons : undefined} />
								<IndentGuidesToggle globalValue={$authStore.authEnabled ? globalIndentGuides : undefined} />
							{/if}
							{#if $authStore.authEnabled}
								<div class="text-xs text-muted-foreground flex items-start gap-1.5 mt-2 p-2 bg-muted/50 rounded-md">
									<HelpCircle class="w-3.5 h-3.5 shrink-0 mt-0.5" />
									<div>
										<p>{m.these_are_the()} <strong>{m.defaults_for_new_users()}</strong> {m.they_dont_change_your_own_view_to_customise_how()} <em>{m.you()}</em> {m.see_the_app_use_the_theme_settings_in_your()} <a href="/profile" class="text-primary hover:underline">{m.profile_5d45()}</a>.</p>
									</div>
								</div>
							{/if}
						</div>
					</div>
				<!-- Time + date format span the full card width, two columns, so they get
				     room instead of crowding inside the narrow settings column. -->
				<div class="mt-4 border-t pt-4">
					<div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
						<div class="space-y-1">
							<div class="flex items-center gap-3">
								<Label>{m.time_format()}</Label>
								<ToggleSwitch
									value={timeFormat}
									leftValue="24h"
									rightValue="12h"
									onchange={(newFormat) => {
										appSettings.setTimeFormat(newFormat as '12h' | '24h');
										toast.success(`Time format set to ${newFormat === '12h' ? '12-hour (AM/PM)' : '24-hour'}`);
									}}
									disabled={!$canAccess('settings', 'edit')}
								/>
							</div>
							<p class="text-xs text-muted-foreground">{m.clock_display_used_throughout_the_app()}</p>
						</div>
						<div class="space-y-1">
							<div class="flex items-center gap-3">
								<Label>{m.date_format()}</Label>
								<Select.Root
									type="single"
									value={dateFormat}
									onValueChange={(value) => {
										if (value) {
											appSettings.setDateFormat(value as DateFormat);
											toast.success(`Date format set to ${value}`);
										}
									}}
									disabled={!$canAccess('settings', 'edit')}
								>
									<Select.Trigger class="w-[180px]">
										<Calendar class="w-4 h-4 mr-2" />
										<span>{dateFormat}</span>
									</Select.Trigger>
									<Select.Content>
										{#each dateFormatOptions as option}
											<Select.Item value={option.value}>
												<div class="flex items-center justify-between w-full gap-4">
													<span>{option.label}</span>
													<span class="text-xs text-muted-foreground">{option.example}</span>
												</div>
											</Select.Item>
										{/each}
									</Select.Content>
								</Select.Root>
							</div>
							<p class="text-xs text-muted-foreground">{m.date_display_used_throughout_the_app()}</p>
						</div>
					</div>
				</div>
				<!-- Editor theme spans the full card width so the live preview isn't cramped. -->
				{#if !$authStore.authEnabled || globalThemeLoaded}
					<div class="mt-4 border-t pt-4">
						<EditorThemeSelector />
					</div>
				{/if}
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header>
					<Card.Title class="text-sm font-medium flex items-center gap-2">
						<Compass class="w-4 h-4" />
						{m.navigation()}
					</Card.Title>
				</Card.Header>
				<Card.Content>
					<NavigationSelector />
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header>
					<Card.Title class="text-sm font-medium flex items-center gap-2">
						<Globe class="w-4 h-4" />
						{m.scheduling()}
					</Card.Title>
				</Card.Header>
				<Card.Content class="space-y-4">
					<div class="space-y-2">
						<Label>{m.default_timezone()}</Label>
						<TimezoneSelector
							value={defaultTimezone}
							onchange={(value) => {
								appSettings.setDefaultTimezone(value);
								toast.success(`Default timezone set to ${value}`);
							}}
							class="w-[320px]"
						/>
						<p class="text-xs text-muted-foreground">{m.default_timezone_for_new_environments_used_for_s()}</p>
					</div>
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header>
					<Card.Title class="text-sm font-medium flex items-center gap-2">
						<Bell class="w-4 h-4" />
						{m.confirmations()}
					</Card.Title>
				</Card.Header>
				<Card.Content class="space-y-4">
					<div class="space-y-1">
						<div class="flex items-center gap-3">
							<Label>{m.confirm_destructive_actions()}</Label>
							<TogglePill
								checked={confirmDestructive}
								onchange={(checked) => {
									appSettings.setConfirmDestructive(checked);
									toast.success(checked ? 'Confirmations enabled' : 'Confirmations disabled');
								}}
								disabled={!$canAccess('settings', 'edit')}
							/>
						</div>
						<p class="text-xs text-muted-foreground">{m.show_confirmation_dialogs_before_deleting_resour()}</p>
					</div>
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header>
					<Card.Title class="text-sm font-medium flex items-center gap-2">
						<FileText class="w-4 h-4" />
						{m.logs_files()}
					</Card.Title>
				</Card.Header>
				<Card.Content>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
						<div class="space-y-4">
							<div class="space-y-2">
								<Label for="log-max-lines">{m.log_buffer_size()}</Label>
								<Select.Root
									type="single"
									value={String(logMaxLines)}
									onValueChange={handleLogMaxLinesChange}
									disabled={!$canAccess('settings', 'edit')}
								>
									<Select.Trigger id="log-max-lines" class="w-48">
										{m.arg1_lines({ arg1: orEmpty(logMaxLines.toLocaleString()) })}
									</Select.Trigger>
									<Select.Content>
										{#each logMaxLinesOptions as opt}
											<Select.Item value={opt.value}>{opt.label}</Select.Item>
										{/each}
									</Select.Content>
								</Select.Root>
								<p class="text-xs text-muted-foreground">{m.maximum_number_of_log_lines_kept_per_container_p()}</p>
							</div>
							<div class="space-y-1">
								<div class="flex items-center gap-3">
									<Label>{m.download_format()}</Label>
									<Select.Root
										type="single"
										value={downloadFormat}
										onValueChange={(value) => {
											if (value) {
												appSettings.setDownloadFormat(value as DownloadFormat);
												toast.success(`Download format set to ${downloadFormatLabel[value as DownloadFormat]}`);
											}
										}}
										disabled={!$canAccess('settings', 'edit')}
									>
										<Select.Trigger class="w-[180px]">
											<FileText class="w-4 h-4 mr-2" />
											<span>{downloadFormatLabel[downloadFormat]}</span>
										</Select.Trigger>
										<Select.Content>
											{#each downloadFormatOptions as option}
												<Select.Item value={option.value}>
													<div class="flex items-center justify-between w-full gap-4">
														<span>{option.label}</span>
														<span class="text-xs text-muted-foreground">{option.description}</span>
													</div>
												</Select.Item>
											{/each}
										</Select.Content>
									</Select.Root>
								</div>
								<p class="text-xs text-muted-foreground">{m.format_when_downloading_files_from_containers_or()}</p>
							</div>
						</div>
						<div class="space-y-4">
							<div class="space-y-1">
								<div class="flex items-center gap-3">
									<Label>{m.format_log_timestamps()}</Label>
									<TogglePill
										checked={formatLogTimestamps}
										onchange={(checked) => {
											appSettings.setFormatLogTimestamps(checked);
											toast.success(checked ? 'Log timestamp formatting enabled' : 'Log timestamp formatting disabled');
										}}
										disabled={!$canAccess('settings', 'edit')}
									/>
								</div>
								<p class="text-xs text-muted-foreground">{m.convert_iso_timestamps_in_logs_to_your_configure()}</p>
								<div class="flex items-start gap-1.5 mt-1">
									<Info class="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
									<p class="text-xs text-muted-foreground">{m.docker_logs_use_utc_timestamps_by_default_when_e()} <code class="bg-muted px-1 rounded">{m.t_2026_01_12t07_47_44z()}</code> {m.are_converted_to_local_time_using_your_date_time()}</p>
								</div>
							</div>
						</div>
					</div>
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header>
					<Card.Title class="text-sm font-medium flex items-center gap-2">
						<Layers class="w-4 h-4" />
						{m.stack_operation_logs()}
					</Card.Title>
					<p class="text-xs text-muted-foreground">{m.choose_which_stack_operations_open_the_full_comp()}</p>
				</Card.Header>
				<Card.Content>
					<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3">
						{#each STACK_LOG_OPERATIONS as op}
							<div class="flex items-center gap-3">
								<TogglePill
									checked={stackLogOperations.includes(op.key)}
									onchange={(checked) => toggleStackLogOperation(op.key, checked)}
									disabled={!$canAccess('settings', 'edit')}
								/>
								<Label>{op.label}</Label>
							</div>
						{/each}
					</div>
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header>
					<Card.Title class="text-sm font-medium flex items-center gap-2">
						<FileText class="w-4 h-4" />
						{m.compose_template()}
					</Card.Title>
					<p class="text-xs text-muted-foreground">{m.default_yaml_content_when_creating_a_new_stack()}</p>
				</Card.Header>
				<Card.Content class="space-y-3">
					<div class="h-64">
						<CodeEditor
							value={composeTemplateWIP}
							onchange={(v) => { composeTemplateWIP = v; }}
							language="yaml"
							readonly={!$canAccess('settings', 'edit')}
							class="h-full rounded-md overflow-hidden border border-zinc-200 dark:border-zinc-700"
						/>
					</div>
					{#if $canAccess('settings', 'edit')}
						<div class="flex gap-2">
							<Button size="sm" variant="outline" onclick={saveComposeTemplate}>
								<Save class="w-3.5 h-3.5" />
								{m.save_template()}
							</Button>
							<Button size="sm" variant="ghost" onclick={revertComposeTemplate}>
								<RotateCcw class="w-3.5 h-3.5" />
								{m.revert_to_default()}
							</Button>
						</div>
					{/if}
				</Card.Content>
			</Card.Root>

		</div>

		<!-- Right column -->
		<div class="space-y-4">
			<!-- Held to settings:view: these describe how this installation is built
			     and run, and showing the built-in defaults to somebody who may not read
			     them would present a guess as the configuration. -->
			{#if $canAccess('settings', 'view')}
			<Card.Root>
				<Card.Header>
					<Card.Title class="text-sm font-medium flex items-center gap-2">
						<ShieldCheck class="w-4 h-4" />
						{m.vulnerability_scanners()}
					</Card.Title>
				</Card.Header>
				<Card.Content class="space-y-4">
					<div class="space-y-2">
						<Label for="grype-image">{m.grype_image()}</Label>
						<Input
							id="grype-image"
							value={defaultGrypeImage}
							onblur={handleGrypeImageBlur}
							disabled={!$canAccess('settings', 'edit')}
							placeholder={DEFAULT_GRYPE_IMAGE}
						/>
						<div class="flex items-center gap-2 flex-wrap">
							<p class="text-xs text-muted-foreground">{m.docker_image_for_grype_scanner_pin_to_a_specific()}</p>
							{#if newerScanners.grype}
								<button
									type="button"
									class="inline-flex items-center gap-1 text-2xs px-1.5 py-0.5 rounded-full border border-green-500/30 bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors"
									onclick={() => applyScannerVersion('grype')}
									disabled={!$canAccess('settings', 'edit')}
								>
									{m.use_grype({ grype: orEmpty(newerScanners.grype) })}
								</button>
							{:else if scannerUpToDate.grype}
								<span class="text-2xs text-muted-foreground">{m.up_to_date_82fb()}</span>
							{/if}
						</div>
					</div>
					<div class="space-y-2">
						<Label for="trivy-image">{m.trivy_image()}</Label>
						<Input
							id="trivy-image"
							value={defaultTrivyImage}
							onblur={handleTrivyImageBlur}
							disabled={!$canAccess('settings', 'edit')}
							placeholder={DEFAULT_TRIVY_IMAGE}
						/>
						<div class="flex items-center gap-2 flex-wrap">
							<p class="text-xs text-muted-foreground">{m.docker_image_for_trivy_scanner_pin_to_a_specific()}</p>
							{#if newerScanners.trivy}
								<button
									type="button"
									class="inline-flex items-center gap-1 text-2xs px-1.5 py-0.5 rounded-full border border-green-500/30 bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors"
									onclick={() => applyScannerVersion('trivy')}
									disabled={!$canAccess('settings', 'edit')}
								>
									{m.use_trivy({ trivy: orEmpty(newerScanners.trivy) })}
								</button>
							{:else if scannerUpToDate.trivy}
								<span class="text-2xs text-muted-foreground">{m.up_to_date_82fb()}</span>
							{/if}
						</div>
						<div class="pt-1">
							<Button variant="outline" size="sm" onclick={checkScannerVersions} disabled={checkingScannerVersions}>
								{checkingScannerVersions ? 'Checking...' : 'Check for newer scanner versions'}
							</Button>
						</div>
					</div>
					<div class="space-y-2">
						<Label for="grype-args">{m.default_grype_arguments()}</Label>
						<Input
							id="grype-args"
							value={defaultGrypeArgs}
							onblur={handleGrypeArgsBlur}
							disabled={!$canAccess('settings', 'edit')}
							placeholder={DEFAULT_GRYPE_ARGS}
						/>
						<p class="text-xs text-muted-foreground">{m.use()} <code class="bg-muted px-1 rounded">{'{image}'}</code> {m.as_placeholder_for_the_image_name()}</p>
					</div>
					<div class="space-y-2">
						<Label for="trivy-args">{m.default_trivy_arguments()}</Label>
						<Input
							id="trivy-args"
							value={defaultTrivyArgs}
							onblur={handleTrivyArgsBlur}
							disabled={!$canAccess('settings', 'edit')}
							placeholder={DEFAULT_TRIVY_ARGS}
						/>
						<p class="text-xs text-muted-foreground">{m.use()} <code class="bg-muted px-1 rounded">{'{image}'}</code> {m.as_placeholder_for_the_image_name()}</p>
					</div>
					<div class="pt-2">
						<button
							type="button"
							class="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 select-none"
							onclick={() => (showAdvancedScannerSettings = !showAdvancedScannerSettings)}
						>
							{#if showAdvancedScannerSettings}
								<ChevronDown class="w-3.5 h-3.5" />
							{:else}
								<ChevronRight class="w-3.5 h-3.5" />
							{/if}
							{m.advanced_settings()}
						</button>
					</div>
					{#if showAdvancedScannerSettings}
						<div class="space-y-2">
							<Label for="scanner-network-mode">{m.network_mode()}</Label>
							<Select.Root
								type="single"
								value={defaultScannerNetworkMode}
								onValueChange={handleScannerNetworkModeChange}
							>
								<Select.Trigger id="scanner-network-mode" class="w-full" disabled={!$canAccess('settings', 'edit')}>
									<span>{defaultScannerNetworkMode || 'Default (auto-detect)'}</span>
								</Select.Trigger>
								<Select.Content>
									<Select.Item value="">{m.default_auto_detect()}</Select.Item>
									<Select.Item value="host">{m.host_86dd()}</Select.Item>
									<Select.Item value="bridge">{m.bridge_2fa1()}</Select.Item>
									<Select.Item value="none">{m.none_71f8()}</Select.Item>
								</Select.Content>
							</Select.Root>
							<p class="text-xs text-muted-foreground">{m.override_the_docker_network_mode_for_vulnerabili()} <code class="bg-muted px-1 rounded">{m.host_86dd()}</code> {m.on_hosts_where_the_default_bridge_cant_reach_the()}</p>
						</div>
						<div class="space-y-2">
							<Label for="scanner-dns">{m.dns_servers_9143()}</Label>
							<Input
								id="scanner-dns"
								value={defaultScannerDns.join(', ')}
								onblur={handleScannerDnsBlur}
								disabled={!$canAccess('settings', 'edit')}
							/>
							<p class="text-xs text-muted-foreground">{m.comma_separated_dns_ips_for_scanner_containers_e()}</p>
						</div>
					{/if}
					<div class="pt-2 border-t">
						<div class="flex items-center justify-between">
							<div>
								<p class="text-sm font-medium">{m.scanner_cache()}</p>
								<p class="text-xs text-muted-foreground">{m.remove_cached_vulnerability_databases_to_free_di()}</p>
							</div>
							<Button
								variant="outline"
								size="sm"
								disabled={clearingCache || !$canAccess('settings', 'edit')}
								onclick={clearScannerCache}
							>
								{#if clearingCache}
									{m.clearing()}
								{:else}
									{m.clear_cache()}
								{/if}
							</Button>
						</div>
					</div>
				</Card.Content>
			</Card.Root>
			{/if}

			<!-- Held to settings:view with the rest: it decides how every update check
			     compares versions, and the defaults shown to somebody who may not read
			     it would be saved over the real configuration on the first change. -->
			{#if $canAccess('settings', 'view')}
			<Card.Root>
				<Card.Header>
					<Card.Title class="text-sm font-medium flex items-center gap-2">
						<Clock class="w-4 h-4" />
						{m.minimum_image_age()}
						<Tooltip.Provider delayDuration={100}>
							<Tooltip.Root>
								<Tooltip.Trigger>
									<HelpCircle class="w-4 h-4 text-muted-foreground cursor-help" />
								</Tooltip.Trigger>
								<Tooltip.Portal>
									<Tooltip.Content side="right" sideOffset={8} class="!w-96 space-y-2">
										<p>{m.the_age_comes_from_the_images_creation_time_in_t()}</p>
										<p>{m.an_environment_can_override_this_value_manual_pu()}</p>
										<p>{m.a_newer_image_restarts_the_wait_on_itself_so_a_p()}</p>
									</Tooltip.Content>
								</Tooltip.Portal>
							</Tooltip.Root>
						</Tooltip.Provider>
					</Card.Title>
					<Card.Description>
						{m.hold_automatic_container_updates_until_a_new_ima()}
					</Card.Description>
				</Card.Header>
				<Card.Content class="flex items-end gap-3">
					<div class="space-y-2 flex-1">
						<Label for="minimum-release-age">{m.hours_0_720()}</Label>
						<Input id="minimum-release-age" type="number" min="0" max="720" step="1" bind:value={releaseAgeHours} disabled={releaseAgeOverridden || !$canAccess('settings', 'edit')} />
					</div>
					<Button onclick={saveReleaseAge} disabled={releaseAgeSaving || releaseAgeOverridden || !$canAccess('settings', 'edit')}>{m.save()}</Button>
				</Card.Content>
				{#if releaseAgeOverridden}
					<p class="px-6 pb-4 text-xs text-muted-foreground">{m.set_by_minimum_release_age_hours()}</p>
				{/if}
			</Card.Root>

			<Card.Root>
				<Card.Header>
					<Card.Title class="text-sm font-medium flex items-center gap-2">
						<Tags class="w-4 h-4" />
						{m.newer_version_tags()}
					</Card.Title>
					<Card.Description>
						{m.how_the_update_check_looks_for_newer_version_tag()}
					</Card.Description>
				</Card.Header>
				<Card.Content>
					<SemverCheckConfig
						bind:enabled={semverEnabled}
						bind:maxBump={semverMaxBump}
						bind:matchFlavor={semverMatchFlavor}
						bind:includePrerelease={semverIncludePrerelease}
						bind:rejectOlderImages={semverRejectOlderImages}
					/>
				</Card.Content>
			</Card.Root>
			{/if}

			<!-- Held to settings:view: these describe how this installation is built
			     and run, and showing the built-in defaults to somebody who may not read
			     them would present a guess as the configuration. -->
			{#if $canAccess('settings', 'view')}
			<Card.Root>
				<Card.Header>
					<Card.Title class="text-sm font-medium flex items-center gap-2">
						<Database class="w-4 h-4" />
						{m.system_jobs()}
					</Card.Title>
				</Card.Header>
				<Card.Content class="space-y-4">
					<div class="space-y-3">
						<div>
							<div class="flex items-center gap-2">
								<Label>{m.activity_event_collection_mode()}</Label>
								<Tooltip.Root>
									<Tooltip.Trigger>
										<HelpCircle class="w-3.5 h-3.5 text-muted-foreground" />
									</Tooltip.Trigger>
									<Tooltip.Content class="w-80">
										<p class="text-xs">
											<strong>{m.stream_e2b5()}</strong> {m.continuous_event_stream_from_docker_instant_noti()}<br />
											<strong>{m.poll_46d0()}</strong> {m.periodic_checks_for_new_events_slight_notificati()}
										</p>
									</Tooltip.Content>
								</Tooltip.Root>
							</div>
							<div class="flex items-center gap-4 mt-2">
								<label class="flex items-center gap-2 cursor-pointer">
									<input
										type="radio"
										name="eventCollectionMode"
										value="stream"
										checked={(eventCollectionMode || 'stream') === 'stream'}
										onchange={() => handleEventCollectionModeChange('stream')}
										disabled={!$canAccess('settings', 'edit')}
										class="accent-primary w-4 h-4"
									/>
									<Activity class="w-3.5 h-3.5" />
									<span class="text-sm">{m.stream()}</span>
								</label>
								<label class="flex items-center gap-2 cursor-pointer">
									<input
										type="radio"
										name="eventCollectionMode"
										value="poll"
										checked={(eventCollectionMode || 'stream') === 'poll'}
										onchange={() => handleEventCollectionModeChange('poll')}
										disabled={!$canAccess('settings', 'edit')}
										class="accent-primary w-4 h-4"
									/>
									<Clock class="w-3.5 h-3.5" />
									<span class="text-sm">{m.poll()}</span>
								</label>

								<span class="text-xs text-muted-foreground {(eventCollectionMode || 'stream') === 'poll' ? '' : 'invisible'}">{m.every()}</span>
								<Select.Root
									type="single"
									value={String(eventPollInterval || 60000)}
									onValueChange={(v) => v && handleEventPollIntervalChange({ value: parseInt(v) })}
									disabled={!$canAccess('settings', 'edit') || (eventCollectionMode || 'stream') !== 'poll'}
								>
									<Select.Trigger class="w-24 h-8 {(eventCollectionMode || 'stream') === 'poll' ? '' : 'invisible'}">
										{(eventPollInterval || 60000) === 30000 ? '30s' : (eventPollInterval || 60000) === 60000 ? '60s' : (eventPollInterval || 60000) === 120000 ? '120s' : '300s'}
									</Select.Trigger>
									<Select.Content>
										<Select.Item value="30000">{m.t_30s()}</Select.Item>
										<Select.Item value="60000">{m.t_60s()}</Select.Item>
										<Select.Item value="120000">{m.t_120s()}</Select.Item>
										<Select.Item value="300000">{m.t_300s()}</Select.Item>
									</Select.Content>
								</Select.Root>
							</div>
						</div>
					</div>

					<div class="space-y-1 pt-2 border-t">
						<div class="flex items-center gap-2">
							<Label for="metrics-interval">{m.metrics_collection_interval()}</Label>
							<Tooltip.Root>
								<Tooltip.Trigger>
									<HelpCircle class="w-3.5 h-3.5 text-muted-foreground" />
								</Tooltip.Trigger>
								<Tooltip.Content class="w-80">
									<p class="text-xs">
										{m.how_often_to_collect_cpu_memory_metrics_from_run()}
									</p>
								</Tooltip.Content>
							</Tooltip.Root>
						</div>
						<div class="flex items-center gap-2 mt-2">
							<Select.Root
								type="single"
								value={String(metricsCollectionInterval || 30000)}
								onValueChange={(v) => v && handleMetricsIntervalChange({ value: parseInt(v) })}
								disabled={!$canAccess('settings', 'edit')}
							>
								<Select.Trigger class="w-24 h-8">
									{(metricsCollectionInterval || 30000) === 10000 ? '10s' : (metricsCollectionInterval || 30000) === 30000 ? '30s' : (metricsCollectionInterval || 30000) === 60000 ? '60s' : '120s'}
								</Select.Trigger>
								<Select.Content>
									<Select.Item value="10000">{m.t_10s()}</Select.Item>
									<Select.Item value="30000">{m.t_30s()}</Select.Item>
									<Select.Item value="60000">{m.t_60s()}</Select.Item>
									<Select.Item value="120000">{m.t_120s()}</Select.Item>
								</Select.Content>
							</Select.Root>
						</div>
					</div>

					<div class="space-y-1 pt-2 border-t">
						<div class="flex items-center gap-3">
							<Label for="schedule-retention">{m.schedule_execution_cleanup()}</Label>
							<TogglePill
								checked={scheduleCleanupEnabled}
								onchange={handleScheduleCleanupEnabledChange}
								disabled={!$canAccess('settings', 'edit')}
							/>
						</div>
						<p class="text-xs text-muted-foreground">{m.delete_executions_older_than_specified_days()}</p>
						<div class="flex items-center gap-2 mt-2">
							<Input
								id="schedule-retention"
								type="number"
								min="1"
								max="365"
								value={scheduleRetentionDays}
								onchange={handleScheduleRetentionChange}
								disabled={!$canAccess('settings', 'edit') || !scheduleCleanupEnabled}
								class="w-20"
							/>
							<span class="text-sm text-muted-foreground">{m.days()}</span>
							<div class="ml-auto">
								<CronEditor
									value={scheduleCleanupCron}
									onchange={handleScheduleCleanupCronChange}
									disabled={!$canAccess('settings', 'edit') || !scheduleCleanupEnabled}
								/>
							</div>
						</div>
					</div>
					<div class="space-y-1">
						<div class="flex items-center gap-3">
							<Label for="event-retention">{m.container_event_cleanup()}</Label>
							<TogglePill
								checked={eventCleanupEnabled}
								onchange={handleEventCleanupEnabledChange}
								disabled={!$canAccess('settings', 'edit')}
							/>
						</div>
						<p class="text-xs text-muted-foreground">{m.delete_events_older_than_specified_days()}</p>
						<div class="flex items-center gap-2 mt-2">
							<Input
								id="event-retention"
								type="number"
								min="1"
								max="365"
								value={eventRetentionDays}
								onchange={handleEventRetentionChange}
								disabled={!$canAccess('settings', 'edit') || !eventCleanupEnabled}
								class="w-20"
							/>
							<span class="text-sm text-muted-foreground">{m.days()}</span>
							<div class="ml-auto">
								<CronEditor
									value={eventCleanupCron}
									onchange={handleEventCleanupCronChange}
									disabled={!$canAccess('settings', 'edit') || !eventCleanupEnabled}
								/>
							</div>
						</div>
					</div>
					<div class="space-y-1">
						<div class="flex items-center gap-3">
							<Label for="scan-retention-keep">{m.vulnerability_scan_retention()}</Label>
							<TogglePill
								checked={scanRetentionEnabled}
								onchange={handleScanRetentionEnabledChange}
								disabled={!$canAccess('settings', 'edit')}
							/>
						</div>
						<p class="text-xs text-muted-foreground">
							{m.keep_the_newest_scans_per_image_and_drop_scans_f()}
						</p>
						<div class="flex items-center gap-2 mt-2">
							<Input
								id="scan-retention-keep"
								type="number"
								min="1"
								max="100"
								value={scanRetentionKeep}
								onchange={handleScanRetentionKeepChange}
								disabled={!$canAccess('settings', 'edit') || !scanRetentionEnabled}
								class="w-20"
							/>
							<span class="text-sm text-muted-foreground">{m.newest_per_image()}</span>
							<Input
								id="scan-retention-grace"
								type="number"
								min="0"
								max="365"
								value={scanRetentionGraceDays}
								onchange={handleScanRetentionGraceChange}
								disabled={!$canAccess('settings', 'edit') || !scanRetentionEnabled}
								class="w-20 ml-3"
							/>
							<span class="text-sm text-muted-foreground">{m.days_grace()}</span>
							<div class="ml-auto">
								<CronEditor
									value={scanRetentionCron}
									onchange={handleScanRetentionCronChange}
									disabled={!$canAccess('settings', 'edit') || !scanRetentionEnabled}
								/>
							</div>
						</div>
					</div>
					<div class="space-y-1 pt-2 border-t">
						<div class="flex items-center gap-3">
							<Label>{m.volume_helper_cleanup()}</Label>
							<Badge variant="secondary" class="text-xs">{m.always_enabled()}</Badge>
						</div>
						<p class="text-xs text-muted-foreground">
							{m.automatically_removes_temporary_containers_used()}
						</p>
					</div>
					<div class="space-y-1 pt-2 border-t">
						<div class="flex items-center gap-3">
							<Label>{m.scanner_cache_cleanup()}</Label>
							<TogglePill
								checked={scannerCleanupEnabled}
								onchange={handleScannerCleanupEnabledChange}
								disabled={!$canAccess('settings', 'edit')}
							/>
						</div>
						<p class="text-xs text-muted-foreground">{m.remove_cached_vulnerability_databases_to_reclaim()}</p>
						{#if scannerCleanupEnabled}
							<div class="mt-2">
								<CronEditor
									value={scannerCleanupCron}
									onchange={handleScannerCleanupCronChange}
									disabled={!$canAccess('settings', 'edit')}
								/>
							</div>
						{/if}
					</div>
					<div class="space-y-1 pt-2 border-t">
						<div class="flex items-center gap-3">
							<Label>{m.deploy_log_reconcile()}</Label>
							<Tooltip.Provider delayDuration={100}>
								<Tooltip.Root>
									<Tooltip.Trigger>
										<HelpCircle class="w-4 h-4 text-muted-foreground cursor-help" />
									</Tooltip.Trigger>
									<Tooltip.Portal>
										<Tooltip.Content side="right" sideOffset={8} class="!w-80">
											{m.every_deploy_from_dockhand_keeps_a_log_file_on_d()}
										</Tooltip.Content>
									</Tooltip.Portal>
								</Tooltip.Root>
							</Tooltip.Provider>
							<TogglePill
								checked={deployLogReconcileEnabled}
								onchange={handleDeployLogReconcileEnabledChange}
								disabled={!$canAccess('settings', 'edit')}
							/>
						</div>
						<p class="text-xs text-muted-foreground">{m.keeps_deploy_log_files_in_sync_with_their_deploy()}</p>
						{#if deployLogReconcileEnabled}
							<div class="mt-2">
								<CronEditor
									value={deployLogReconcileCron}
									onchange={handleDeployLogReconcileCronChange}
									disabled={!$canAccess('settings', 'edit')}
								/>
							</div>
						{/if}
					</div>
					<div class="space-y-1 pt-2 border-t">
						<div class="flex items-center gap-3">
							<Label>{m.protect_helper_images_from_prune()}</Label>
							<Tooltip.Root>
								<Tooltip.Trigger>
									<HelpCircle class="w-3.5 h-3.5 text-muted-foreground" />
								</Tooltip.Trigger>
								<Tooltip.Content side="top" class="w-96 max-w-[90vw]">
									<p>{m.when_on_prune_all_unused_skips_the_images_dockha()}</p>
								</Tooltip.Content>
							</Tooltip.Root>
							<TogglePill
								checked={$appSettings.protectScannerImages}
								onchange={(checked) => {
									appSettings.setProtectScannerImages(checked);
									toast.success(checked ? 'Helper images will be skipped during prune' : 'Helper images will be pruned with everything else');
								}}
								disabled={!$canAccess('settings', 'edit')}
							/>
						</div>
						<p class="text-xs text-muted-foreground">{m.skip_the_grype_trivy_and_backup_helper_images_du()}</p>
					</div>
				</Card.Content>
			</Card.Root>
			{/if}

			<Card.Root>
				<Card.Header>
					<Card.Title class="text-sm font-medium flex items-center gap-2">
						<LayoutDashboard class="w-4 h-4" />
						{m.dashboard()}
					</Card.Title>
				</Card.Header>
				<Card.Content class="space-y-4">
					<div class="space-y-3">
						<div class="space-y-1">
							<div class="flex items-center gap-3">
								<Label>{m.environment_label_filter_matching()}</Label>
								<Tooltip.Root>
									<Tooltip.Trigger>
										<HelpCircle class="w-3.5 h-3.5 text-muted-foreground" />
									</Tooltip.Trigger>
									<Tooltip.Content class="w-80">
										<p class="text-xs">
											{m.controls_how_multiple_selected_environment_label()}
											<strong>{m.any()}</strong>{m.shows_environments_that_have_at_least_one_of_the()}
											<strong>{m.all_9a98()}</strong>{m.shows_only_environments_that_have_every_selected()}
										</p>
									</Tooltip.Content>
								</Tooltip.Root>
								<ToggleSwitch
									value={labelFilterMode}
									leftValue="any"
									rightValue="all"
									onchange={(mode) => appSettings.setLabelFilterMode(mode as LabelFilterMode)}
									disabled={!$canAccess('settings', 'edit')}
								/>
							</div>
						</div>
					</div>
				</Card.Content>
			</Card.Root>
		</div>
	</div>
</div>
