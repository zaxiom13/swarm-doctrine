<script lang="ts">
    import Screen from './Screen.svelte';
    import PageHead from './PageHead.svelte';
    import Card from './Card.svelte';
    import { LEVEL_ENEMIES } from '../lib/catalog.ts';
    import { useUI } from './context.ts';

    const ui = useUI();
    const teams = ui.teams();
</script>

<Screen id="team-select-screen" labelledby="team-title">
    <div class="page">
        <PageHead eyebrow="Fleet" title="Pick a team" id="team-title" />
        <div id="enemy-choice" class:hidden={!ui.showEnemyChoice}>
            <h3 class="section-title">Rivals</h3>
            <div id="enemy-grid" class="card-grid">
                {#each LEVEL_ENEMIES as option (option.id)}
                    <Card icon={option.icon} title={option.name} text={option.summary} class="choice tinted" style="--tint:{option.color}" pressed={ui.levelEnemies === option.id} onclick={() => ui.pickEnemies(option.id)} />
                {/each}
            </div>
            <h3 class="section-title">Your team</h3>
        </div>
        <div id="team-grid" class="card-grid card-grid-4">
            {#each teams as { team, perks } (team.id)}
                <Card symbol={team.symbol} title={team.name} text={perks} class="team-card tinted" style="--team:{team.color};--tint:{team.color}" onclick={() => ui.pickTeam(team.id)} />
            {/each}
        </div>
    </div>
</Screen>
