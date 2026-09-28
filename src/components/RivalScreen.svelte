<script lang="ts">
    import Screen from './Screen.svelte';
    import PageHead from './PageHead.svelte';
    import Card from './Card.svelte';
    import { AVAILABLE_RIVALS } from '../lib/catalog.ts';
    import { useUI } from './context.ts';

    const ui = useUI();
</script>

<Screen id="rival-screen" labelledby="rival-title">
    <div class="page">
        <PageHead eyebrow="Duel" title="Pick a rival" id="rival-title" />
        <div id="rival-grid" class="card-grid">
            {#each AVAILABLE_RIVALS as rival (rival.id)}
                <Card icon={rival.icon} title={rival.name} text={rival.summary} class="tinted" style="--tint:{rival.color}" onclick={() => ui.pickRival(rival.id)} />
            {/each}
        </div>
    </div>
</Screen>
