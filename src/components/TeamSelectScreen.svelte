<script lang="ts">
    import Screen from './Screen.svelte';
    import PageHead from './PageHead.svelte';
    import Card from './Card.svelte';
    import Icon from './Icon.svelte';
    import { LEVEL_ENEMIES } from '../lib/catalog.ts';
    import { useUI } from './context.ts';

    const ui = useUI();
    const teams = ui.teams();

    // Scale 0.90..1.35 multipliers to clean 25..100% stat bars for quick fleet comparison.
    const statPct = (v: number) => Math.max(20, Math.min(100, Math.round((v - 0.85) / 0.52 * 100)));
</script>

<Screen id="team-select-screen" labelledby="team-title">
    <div class="page">
        <PageHead eyebrow="Fleet" title="Pick a team" id="team-title" />
        <div id="enemy-choice" class:hidden={!ui.showEnemyChoice}>
            <h3 class="section-title">Rivals</h3>
            <div id="enemy-grid" class="rival-toggle-grid">
                {#each LEVEL_ENEMIES as option (option.id)}
                    <button type="button" class="choice-pill" style="--tint:{option.color}" aria-pressed={ui.levelEnemies === option.id} onclick={() => ui.pickEnemies(option.id)}>
                        <span class="choice-pill-icon" aria-hidden="true"><Icon name={option.icon} size={20} /></span>
                        <span class="choice-pill-text">
                            <strong>{option.name}</strong>
                            <small>{option.summary}</small>
                        </span>
                    </button>
                {/each}
            </div>
            <h3 class="section-title">Your fleet</h3>
        </div>
        <div id="team-grid" class="card-grid card-grid-4">
            {#each teams as { team, perks } (team.id)}
                <Card teamIcon={team.id} title={team.name} text={perks} class="team-card tinted" style="--team:{team.color};--tint:{team.color}" onclick={() => ui.pickTeam(team.id)}>
                    <div class="fleet-stats" aria-hidden="true">
                        <div class="fleet-stat"><span>SPD</span><div class="stat-track"><i style="width:{statPct(team.speed)}%"></i></div></div>
                        <div class="fleet-stat"><span>DEF</span><div class="stat-track"><i style="width:{statPct(team.resist)}%"></i></div></div>
                        <div class="fleet-stat"><span>REC</span><div class="stat-track"><i style="width:{statPct(team.pressure)}%"></i></div></div>
                    </div>
                </Card>
            {/each}
        </div>
    </div>
</Screen>
