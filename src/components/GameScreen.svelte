<script lang="ts">
    import Screen from './Screen.svelte';
    import Overlay from './Overlay.svelte';
    import Card from './Card.svelte';
    import Icon from './Icon.svelte';
    import { useUI } from './context.ts';

    let { canvas = $bindable() }: { canvas?: HTMLCanvasElement } = $props();
    const ui = useUI();
    const freeze = $derived(ui.freeze);

    const ringRadius = 46;
    const ringCircumference = 2 * Math.PI * ringRadius;
    const ringOffset = $derived(ringCircumference * (1 - freeze.cooldownPct / 100));
</script>

<Screen id="game-screen" kind="game">
    <canvas id="game-canvas" aria-label="Arena. Hold to Rally, release to recruit." bind:this={canvas}></canvas>
    <div class="hud-top">
        <button type="button" id="btn-pause" class="chip chip-icon" aria-label="Pause" onclick={() => ui.pausePressed()}>
            <Icon name="pause" size={18} />
        </button>
        <div class="hud-status">
            <span id="hud-timer">{ui.timer}</span>
            <span id="hud-score" class="hud-sub" class:hidden={ui.duel}>{ui.scoreText}</span>
            <span id="hud-matchup" class="hud-sub" class:hidden={!ui.duel}>You <b id="hud-you">{ui.youCount}</b> · <span id="hud-rival-name">{ui.rivalName}</span> <b id="hud-rival">{ui.rivalCount}</b></span>
            <div class="hud-dominance" aria-hidden="true">
                {#each ui.fleets as fleet (fleet.team)}
                    {#if fleet.pct > 0}
                        <span style="width:{fleet.pct}%;background:{fleet.color}"></span>
                    {/if}
                {/each}
            </div>
        </div>
        <div class="hud-chips">
            <button type="button" id="btn-guide" class="chip" aria-expanded={ui.coachOpen} aria-controls="coach" aria-label="Guide" onclick={() => ui.toggleCoach()}>
                <Icon name="guide" size={18} />
                <span class="chip-label">Guide</span>
            </button>
            <button type="button" id="btn-details" class="chip" aria-expanded={ui.detailsOpen} aria-controls="details-sheet" aria-label="Details" onclick={() => ui.toggleDetails()}>
                <Icon name="details" size={18} />
                <span class="chip-label">Details</span>
            </button>
        </div>
    </div>
    <div id="hud-combo" class="hud-combo" class:combo-mid={ui.combo >= 5 && ui.combo < 10} class:combo-high={ui.combo >= 10} class:hidden={ui.combo < 2}>{ui.combo}x</div>
    <p id="rival-status" class="rival-status" aria-live="polite">{ui.rivalStatus}</p>

    <aside id="coach" class="coach" class:hidden={!ui.coachOpen} role="status">
        <span id="coach-step" class="eyebrow">{ui.coach.step}</span>
        <strong id="coach-title">{ui.coach.title}</strong>
        <p id="coach-detail">{ui.coach.detail}</p>
        <ul id="coach-checklist" class="checklist">
            {#each ui.coach.checklist as item (item.label)}
                <li class:done={item.done}>
                    <span class="check-mark" aria-hidden="true">{item.done ? '✓' : '○'}</span>
                    <span>{item.label}</span>
                </li>
            {/each}
        </ul>
    </aside>

    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div id="details-scrim" class="scrim" class:hidden={!ui.detailsOpen} onclick={() => ui.setDetailsOpen(false)}></div>
    <aside id="details-sheet" class="sheet" class:hidden={!ui.detailsOpen} aria-label="Match details">
        <header class="sheet-head"><strong>Details</strong><button type="button" id="btn-close-details" class="chip" onclick={() => ui.setDetailsOpen(false)}>Hide</button></header>
        <section class="sheet-section"><h3 id="world-label">{ui.worldLabel}</h3><p id="world-detail" class="note">{ui.worldDetail}</p><p id="match-status" class="note">{ui.matchStatus}</p></section>
        <section class="sheet-section"><h3 id="share-label">{ui.shareLabel}</h3><strong id="share-value" class="big-number">{ui.shareValue}</strong><div class="meter"><div id="share-fill" style="width:{ui.sharePct}%"></div></div></section>
        <section class="sheet-section"><h3>Fleets</h3>
            <div id="fleet-bars" class="fleet-bars">
                {#each ui.fleets as fleet (fleet.team)}
                    <div class="fleet-bar" style="--team:{fleet.color}">
                        <span class="fleet-name">{fleet.name}</span><span class="fleet-count">{fleet.count}</span>
                        <div class="meter"><div style="width:{fleet.pct}%"></div></div>
                    </div>
                {/each}
            </div>
        </section>
    </aside>

    <div class="ability-bar">
        <button type="button" id="slot-freeze" class="ability" class:locked={freeze.locked} class:hidden={freeze.hidden} class:cooling={freeze.cooling} class:aiming={freeze.aiming}
            disabled={freeze.locked} aria-label={freeze.locked ? 'Freeze: introduced in a later lesson' : 'Freeze'} onclick={() => ui.toggleFreeze()}>
            <svg class="ability-ring" viewBox="0 0 100 100" aria-hidden="true">
                <circle class="ring-track" cx="50" cy="50" r={ringRadius} />
                <circle class="ring-fill" cx="50" cy="50" r={ringRadius} stroke-dasharray={ringCircumference} stroke-dashoffset={ringOffset} />
            </svg>
            <span class="ability-key">Space</span>
            <span class="ability-icon" aria-hidden="true"><Icon name="freeze" size={28} /></span>
            <span class="ability-label">Freeze</span>
            <span id="freeze-status" class="ability-status">{freeze.status}</span>
            <span id="freeze-cooldown" class="ability-cooldown" style="height:{freeze.cooldownPct}%"></span>
        </button>
    </div>

    <Overlay open={ui.overlays['pause-overlay']} id="pause-overlay" labelledby="pause-title">
        <div class="dialog">
            <span class="eyebrow">Match paused</span>
            <h2 tabindex="-1" id="pause-title">Paused</h2>
            <p id="pause-status" class="note" aria-live="polite">{ui.pauseStatus}</p>
            <a id="rival-reconnect" class="btn" class:hidden={!ui.reconnectVisible} href="connect.html" target="_blank" rel="noopener">Reconnect Jev</a>
            <button type="button" id="btn-resume" class="btn btn-primary" onclick={() => ui.resume()}>Resume</button>
            <button type="button" id="btn-restart" class="btn" onclick={() => ui.restart()}>Restart</button>
            <button type="button" id="btn-pause-settings" class="btn" onclick={() => ui.pauseSettings()}>Settings</button>
            <button type="button" id="btn-pause-lessons" class="btn" class:hidden={!ui.practice} onclick={() => ui.pauseLessons()}>All drills</button>
            <button type="button" id="btn-quit" class="btn btn-quiet" onclick={() => ui.quit()}>Quit</button>
        </div>
    </Overlay>

    <Overlay open={ui.overlays['result-overlay']} id="result-overlay" labelledby="result-title">
        <div class="dialog" class:result-victory={ui.result.won} class:result-defeat={!ui.result.won}>
            <span class="dialog-crest" aria-hidden="true">
                <Icon name={ui.result.won ? 'check' : 'duel'} size={28} />
            </span>
            <span class="eyebrow">{ui.result.won ? 'Victory' : 'Debrief'}</span>
            <h2 tabindex="-1" id="result-title">{ui.result.title}</h2>
            <p id="result-quote" class="note">{ui.result.quote}</p>
            <dl id="result-stats" class="stats">
                {#each ui.result.stats as [label, value] (label)}
                    <div class="stat"><dt>{label}</dt><dd>{value}</dd></div>
                {/each}
            </dl>
            <button type="button" id="btn-result-primary" class="btn btn-primary" onclick={() => ui.resultAction()}>{ui.result.primary}</button>
            <button type="button" id="btn-result-replay" class="btn" class:hidden={!ui.result.replay} onclick={() => ui.replayLesson()}>Replay</button>
            <button type="button" id="btn-result-quit" class="btn btn-quiet" onclick={() => ui.quit()}>Back to menu</button>
        </div>
    </Overlay>

    <Overlay open={ui.overlays['upgrade-overlay']} id="upgrade-overlay" labelledby="upgrade-title">
        <div class="dialog dialog-wide">
            <span class="eyebrow">Doctrine upgrade</span>
            <h2 tabindex="-1" id="upgrade-title">Pick one</h2>
            <div id="upgrade-cards" class="card-grid card-grid-3">
                {#each ui.upgrades as upgrade (upgrade.id)}
                    <Card icon={upgrade.icon} eyebrow={upgrade.category} title={upgrade.name} text={upgrade.description} class="upgrade-card tinted" onclick={() => ui.pickUpgrade(upgrade)} />
                {/each}
            </div>
            <button type="button" id="btn-upgrade-quit" class="btn btn-quiet" onclick={() => ui.quitFromUpgrade()}>Quit match</button>
        </div>
    </Overlay>

    <Overlay open={ui.overlays['intro-overlay']} id="intro-overlay" labelledby="intro-title">
        <div class="dialog">
            <span id="intro-eyebrow" class="eyebrow">{ui.intro.eyebrow}</span>
            <h2 tabindex="-1" id="intro-title">{ui.intro.title}</h2>
            <p id="intro-description">{ui.intro.description}</p>
            <p id="intro-instruction" class="callout">{ui.intro.instruction}</p>
            <button type="button" id="btn-intro-start" class="btn btn-primary" onclick={() => ui.startFromIntro()}>Start</button>
            <button type="button" id="btn-intro-secondary" class="btn btn-quiet" onclick={() => ui.introSecondary()}>{ui.intro.secondary}</button>
        </div>
    </Overlay>
</Screen>
