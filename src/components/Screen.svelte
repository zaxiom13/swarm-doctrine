<script lang="ts">
    import type { Snippet } from 'svelte';
    import type { ScreenId } from '../lib/ui.svelte.ts';
    import { useUI } from './context.ts';

    let { id, labelledby, kind = 'page', root = $bindable(), children }: { id: ScreenId; labelledby?: string; kind?: 'page' | 'game' | 'home'; root?: HTMLElement; children: Snippet } = $props();
    const ui = useUI();
    const visible = $derived(ui.screen === id);

    // Moving to a menu puts keyboard focus on its heading; the match keeps focus on the arena.
    $effect(() => {
        if (visible && id !== 'game-screen') root?.querySelector<HTMLElement>('h2, h1')?.focus({ preventScroll: true });
    });
</script>

{#if kind === 'home'}
    <main {id} class="screen screen-home" class:hidden={!visible} bind:this={root}>{@render children()}</main>
{:else}
    <section {id} class="screen {kind === 'game' ? 'screen-game' : 'screen-page'}" class:hidden={!visible} aria-labelledby={labelledby} bind:this={root}>{@render children()}</section>
{/if}
