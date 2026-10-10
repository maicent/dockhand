<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { Label } from '$lib/components/ui/label';
	import { TogglePill } from '$lib/components/ui/toggle-pill';
	import { themeStore } from '$lib/stores/theme';
	import { authStore } from '$lib/stores/auth';
	import { resolveToggleValue, shouldSkipApply } from '$lib/utils/theme-preference';
	import { toast } from 'svelte-sonner';

	interface Props {
		userId?: number; // omit for global default (login page / auth-disabled)
		// When set, the toggle reflects and saves this global default (the General settings
		// editor) instead of the current user's profile preference. Omit elsewhere.
		globalValue?: boolean;
	}

	let { userId, globalValue }: Props = $props();

	const skipApply = $derived(shouldSkipApply($authStore.loading, $authStore.authEnabled, userId));

	let checked = $state(false);
	$effect(() => {
		checked = resolveToggleValue(globalValue, $themeStore.coloredActionButtons);
	});

	function onToggle(value: boolean) {
		checked = value;
		themeStore.setPreference('coloredActionButtons', value, userId, skipApply);
		toast.success(value ? 'Action buttons colored' : 'Action buttons reset to default');
	}
</script>

<div class="space-y-1">
	<div class="flex items-center gap-3">
		<Label>{m.colored_grid_buttons()}</Label>
		<TogglePill {checked} onchange={onToggle} />
	</div>
	<p class="text-xs text-muted-foreground">{m.use_semantic_colors_instead_of_muted_gray()}</p>
</div>
