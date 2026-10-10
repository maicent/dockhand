<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { orEmpty } from '$lib/i18n.js';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { AlertTriangle, Loader2, Trash2 } from 'lucide-svelte';

	interface Props {
		open: boolean;
		/** How many snapshots the confirm will delete. */
		count: number;
		/** Deletion in progress (disables the button, shows a spinner). */
		busy?: boolean;
		onConfirm: () => void;
	}
	let { open = $bindable(), count, busy = false, onConfirm }: Props = $props();
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="max-w-md">
		<Dialog.Header>
			<Dialog.Title class="flex items-center gap-2 text-destructive">
				<AlertTriangle class="h-5 w-5" />
				{m.delete_count_snapshot_arg2({ count: orEmpty(count), arg2: orEmpty(count === 1 ? '' : 's') })}
			</Dialog.Title>
		</Dialog.Header>
		<p class="text-sm text-muted-foreground">
			{m.this_permanently_forgets_and_prunes_the_selected({ arg1: orEmpty(count === 1 ? '' : 's'), arg2: orEmpty(count === 1 ? 'its' : 'their') })}
		</p>
		<Dialog.Footer class="gap-2 sm:justify-end">
			<Button variant="outline" onclick={() => (open = false)} disabled={busy}>{m.cancel()}</Button>
			<Button variant="destructive" onclick={onConfirm} disabled={busy}>
				{#if busy}<Loader2 class="mr-1 h-4 w-4 animate-spin" />{:else}<Trash2 class="mr-1 h-4 w-4" />{/if}
				{m.delete()}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
