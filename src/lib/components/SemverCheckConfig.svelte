<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { Label } from '$lib/components/ui/label';
	import { TogglePill } from '$lib/components/ui/toggle-pill';
	import { Tag, Info } from 'lucide-svelte';

	type Bump = 'patch' | 'minor' | 'major';

	interface Props {
		/** Master toggle: also detect newer version tags for pinned images. */
		enabled: boolean;
		/** Cap the surfaced bump. */
		maxBump: Bump;
		/** Require the same tag suffix (flavor) as the running tag. */
		matchFlavor: boolean;
		/** Consider -rc/-beta prerelease tags. */
		includePrerelease: boolean;
		/** Drop a candidate whose image was built before the running one. */
		rejectOlderImages: boolean;
		/**
		 * When set, the current tag is floating (latest/stable/sha) so there is no
		 * version to compare — the toggle is disabled and this tag is shown in the hint.
		 * Container scope passes it; env scope leaves it undefined.
		 */
		floatingTag?: string;
	}

	let {
		enabled = $bindable(),
		maxBump = $bindable(),
		matchFlavor = $bindable(),
		includePrerelease = $bindable(),
		rejectOlderImages = $bindable(),
		floatingTag
	}: Props = $props();

	const isFloating = $derived(!!floatingTag);
	const bumps: Bump[] = ['patch', 'minor', 'major'];
</script>

<div class="space-y-4">
	<div class="flex items-start gap-2" class:opacity-55={isFloating}>
		<Tag class="w-4 h-4 text-green-500 glow-green mt-0.5 shrink-0" />
		<div class="flex-1">
			<Label>{m.check_for_newer_version_tags()}</Label>
			<p class="text-xs text-muted-foreground mt-0.5">
				{m.for_a_container_pinned_to_a_version_tag_e_g()} <code>16.2</code>, <code>{m.v3_0()}</code>{m.also_detect_when_a_newer_version_is_published_ad()}
			</p>
		</div>
		<TogglePill bind:checked={enabled} disabled={isFloating} />
	</div>

	{#if isFloating}
		<div class="ml-6 flex items-start gap-2 rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
			<Info class="w-3.5 h-3.5 mt-0.5 shrink-0" />
			<span><code>{floatingTag}</code> {m.is_a_floating_tag_pin_a_version_tag_e_g()} <code>1.26</code>{m.to_enable_newer_version_detection()}</span>
		</div>
	{:else if enabled}
		<!-- Indented under the header so it reads as "all this belongs to the toggle
		     above"; the boxes inside are full-width of THIS container so they line up. -->
		<div class="ml-6 space-y-4">
			<!-- max bump -->
			<div class="space-y-2">
				<div class="flex items-center gap-4">
					<Label class="flex-1">{m.which_updates_to_show()}</Label>
					<div class="inline-flex shrink-0 gap-0.5 rounded-lg border border-border bg-muted/60 p-0.5">
						{#each bumps as bump}
							<button
								type="button"
								onclick={() => (maxBump = bump)}
								class="rounded-md px-3.5 py-1.5 text-xs font-semibold capitalize transition-colors
									{maxBump === bump
										? 'bg-green-500/15 text-green-500 shadow-[inset_0_0_0_1px_rgba(34,197,94,0.3)]'
										: 'text-muted-foreground hover:text-foreground'}"
							>
								{bump}
							</button>
						{/each}
					</div>
				</div>
				<div class="rounded-md border border-border bg-muted/40 p-2.5 text-[11.5px] leading-relaxed text-muted-foreground">
					{m.running()} <code>1.4.2</code>{m.youll_be_told_about()}<br />
					<span class="font-bold text-foreground">{m.patch()}</span> {m.bug_fix_only()} <code>1.4.3</code><br />
					<span class="font-bold text-foreground">{m.minor()}</span> {m.new_features_too()} <code>1.4.3</code>, <code>1.5.0</code><br />
					<span class="font-bold text-foreground">{m.major()}</span> {m.everything_incl_breaking()} <code>1.4.3</code>, <code>1.5.0</code>, <code>2.0.0</code>
				</div>
			</div>

			<!-- match flavor -->
			<div class="space-y-2 border-t border-border/60 pt-3">
				<div class="flex items-start gap-4">
					<div class="flex-1">
						<Label>{m.match_the_tag_flavor()}</Label>
						<p class="text-xs text-muted-foreground mt-0.5">
							{m.only_suggest_tags_with_the_same_suffix_as_the_on()}
							<code>{m.alpine()}</code> {m.or()} <code>{m.ls123()}</code>.
						</p>
					</div>
					<div class="shrink-0"><TogglePill bind:checked={matchFlavor} /></div>
				</div>
				<div class="rounded-md border border-border bg-muted/40 p-2.5 text-[11.5px] leading-relaxed text-muted-foreground">
					<span class="font-bold text-foreground">{m.on_e004()}</span> <code>{m.t_1_2_alpine()}</code> → <code>{m.t_1_5_alpine()}</code>{m.never_bare()} <code>1.5</code><br />
					<span class="font-bold text-foreground">{m.off()}</span> {m.any_newer_version_even_a_different_flavor_noisie()}
				</div>
			</div>

			<!-- include prereleases -->
			<div class="flex items-start gap-4 border-t border-border/60 pt-3">
				<div class="flex-1">
					<Label>{m.include_prereleases()}</Label>
					<p class="text-xs text-muted-foreground mt-0.5">
						{m.consider()} <code>{m.rc()}</code> / <code>{m.beta()}</code> {m.tags_off_keeps_a_stable_deployment_on_stable_rel()}
					</p>
				</div>
				<div class="shrink-0"><TogglePill bind:checked={includePrerelease} /></div>
			</div>

			<!-- ignore older images -->
			<div class="space-y-2 border-t border-border/60 pt-3">
				<div class="flex items-start gap-4">
					<div class="flex-1">
						<Label>{m.ignore_tags_older_than_what_you_run()}</Label>
						<p class="text-xs text-muted-foreground mt-0.5">
							{m.check_when_a_candidate_image_was_built_and_skip()}
						</p>
					</div>
					<div class="shrink-0"><TogglePill bind:checked={rejectOlderImages} /></div>
				</div>
				<div class="rounded-md border border-border bg-muted/40 p-2.5 text-[11.5px] leading-relaxed text-muted-foreground">
					{m.a_tag_is_a_name_not_a_date_some_repositories_sti()} <code>{m.lidarr_8_1_2135()}</code> {m.is_really()} <code>0.8.1.2135</code> {m.from_2021_above_a_current()} <code>3.1.0</code>.<br />
					<span class="font-bold text-foreground">{m.on_e004()}</span> {m.such_a_tag_is_skipped_and_the_next_real_version()}<br />
					<span class="font-bold text-foreground">{m.off()}</span> {m.names_alone_decide_as_before()}
				</div>
			</div>
		</div>
	{/if}

	{#if enabled && !isFloating}
		<div class="ml-6 flex items-start gap-2 rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
			<Info class="w-3.5 h-3.5 mt-0.5 shrink-0" />
			<span>{m.a_newer_version_shows_as_a_badge_on_the_containe()} <strong class="text-foreground font-semibold">{m.never_auto_applied()}</strong>.</span>
		</div>
	{/if}
</div>

<style>
	code {
		font-family: ui-monospace, 'SF Mono', Menlo, monospace;
		font-size: 0.9em;
		background: hsl(var(--muted));
		border: 1px solid hsl(var(--border));
		border-radius: 4px;
		padding: 0 4px;
	}
</style>
