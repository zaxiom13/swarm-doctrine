<script lang="ts">
    import type { Snippet } from 'svelte';

    // A modal dialog. When it opens, focus moves to its primary button; the owner restores it on close.
    let { open, id, labelledby, children }: { open: boolean; id: string; labelledby: string; children: Snippet } = $props();
    let root = $state<HTMLElement>();

    $effect(() => {
        if (open) root?.querySelector<HTMLElement>('.btn-primary, button')?.focus({ preventScroll: true });
    });
</script>

<div {id} class="overlay" class:hidden={!open} role="dialog" aria-modal="true" aria-labelledby={labelledby} bind:this={root}>
    {@render children()}
</div>
