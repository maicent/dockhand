<script lang="ts">
	import * as Select from '$lib/components/ui/select';
	import { m } from '$lib/paraglide/messages.js';
	import { getLocale, setLocale, locales, type Locale } from '$lib/paraglide/runtime.js';

	// Native endonyms so the list stays readable in any locale.
	const localeNames: Record<Locale, string> = {
		en: 'English',
		'zh-CN': '简体中文'
	};

	let current = $state<Locale>(getLocale());

	function handleChange(value: string) {
		if (value === current) return;
		setLocale(value as Locale);
		// Messages are compiled per-locale; a full reload guarantees every
		// component and server-rendered bit switches consistently.
		location.reload();
	}
</script>

<div class="flex items-center justify-between">
	<div class="space-y-0.5">
		<p class="text-sm font-medium">{m.settings_language()}</p>
		<p class="text-sm text-muted-foreground">{m.settings_language_description()}</p>
	</div>
	<Select.Root type="single" value={current} onValueChange={handleChange}>
		<Select.Trigger class="w-[180px]">
			{localeNames[current] ?? current}
		</Select.Trigger>
		<Select.Content>
			{#each locales as locale (locale)}
				<Select.Item value={locale}>{localeNames[locale] ?? locale}</Select.Item>
			{/each}
		</Select.Content>
	</Select.Root>
</div>
