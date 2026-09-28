<script lang="ts">
    import Screen from './Screen.svelte';
    import PageHead from './PageHead.svelte';
    import Card from './Card.svelte';
    import { useUI } from './context.ts';

    const ui = useUI();
    const groups = ui.modeGroups();
</script>

<Screen id="mode-screen" labelledby="mode-title">
    <div class="page">
        <PageHead eyebrow="Modes" title="Pick a mode" id="mode-title" />
        <button type="button" id="btn-continue" class="btn btn-primary" class:hidden={!ui.continueLabel} onclick={() => ui.continueLevels()}>{ui.continueLabel ?? 'Continue'}</button>
        <div id="mode-groups">
            {#each groups as { group, modes } (group)}
                <h3 class="section-title">{group}</h3>
                <div class="card-grid">
                    {#each modes as mode (mode.id)}
                        <Card icon={mode.icon} title={mode.name} text={mode.summary} class="tinted" style="--tint:{mode.color}" onclick={() => ui.pickMode(mode)} />
                    {/each}
                </div>
            {/each}
        </div>
        <p id="mode-note" class="note">Progress saves on this device.</p>
    </div>
</Screen>
