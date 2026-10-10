<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { orEmpty } from '$lib/i18n.js';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { AlertTriangle } from 'lucide-svelte';

	interface Props {
		open: boolean;
		/** Raw restic stderr for the failed batch (shown verbatim). */
		error: string;
		/** How many snapshots were still deleted before the failure. */
		deleted?: number;
	}
	let { open = $bindable(), error, deleted = 0 }: Props = $props();
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="max-w-2xl">
		<Dialog.Header>
			<Dialog.Title class="flex items-center gap-2 text-destructive">
				<AlertTriangle class="h-5 w-5" />
				{m.snapshots_could_not_be_deleted()}
			</Dialog.Title>
		</Dialog.Header>
		{#if deleted > 0}
			<p class="text-sm text-muted-foreground">
				{m.deleted_deleted_snapshot_arg2_but_the_rest_faile({ deleted: orEmpty(deleted), arg2: orEmpty(deleted === 1 ? '' : 's') })}
			</p>
		{:else}
			<p class="text-sm text-muted-foreground">{m.the_backup_tool_reported()}</p>
		{/if}
		<pre class="max-h-[50vh] overflow-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap break-words font-mono">{error}</pre>
		<Dialog.Footer>
			<Button onclick={() => (open = false)}>{m.ok()}</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
