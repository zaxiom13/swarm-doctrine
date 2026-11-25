<script lang="ts">
    import Screen from './Screen.svelte';
    import PageHead from './PageHead.svelte';
    import Card from './Card.svelte';
    import Icon from './Icon.svelte';
    import { useUI } from './context.ts';

    const ui = useUI();
    const groups = ui.modeGroups();
</script>

<Screen id="mode-screen" labelledby="mode-title">
    <div class="page">
        <PageHead eyebrow="Modes" title="Pick a mode" id="mode-title" />
        {#if ui.continueLabel}
            <button type="button" id="btn-continue" class="continue-banner" onclick={() => ui.continueLevels()}>
                <span class="continue-dot" aria-hidden="true"></span>
                <span class="continue-copy">
                    <span class="eyebrow">Resume campaign</span>
                    <strong>{ui.continueLabel}</strong>
                </span>
                <span class="continue-arrow" aria-hidden="true"><Icon name="play" size={18} /></span>
            </button>
        {:else}
            <button type="button" id="btn-continue" class="btn btn-primary hidden" onclick={() => ui.continueLevels()}>Continue</button>
        {/if}
        <div id="mode-groups" class="mode-groups">
            {#each groups as { group, modes } (group)}
                <section class="mode-group">
                    <h3 class="section-title">{group}</h3>
                    <div class="card-grid">
                        {#each modes as mode (mode.id)}
                            <Card icon={mode.icon} badge={ui.modeBest(mode.id)} title={mode.name} text={mode.summary} class="tinted" style="--tint:{mode.color}" onclick={() => ui.pickMode(mode)} />
                        {/each}
                    </div>
                </section>
            {/each}
        </div>
    </div>
</Screen>
