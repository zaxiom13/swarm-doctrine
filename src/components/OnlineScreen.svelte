<script lang="ts">
    import Screen from './Screen.svelte';
    import PageHead from './PageHead.svelte';
    import Overlay from './Overlay.svelte';
    import { REGIONS } from '../lib/net/config.ts';
    import { useUI } from './context.ts';

    const ui = useUI();
    const lobby = $derived(ui.lobbyView);
    let nameInput = $state<HTMLInputElement>();
    // Typing is never overwritten by a lobby refresh; the field syncs when it is not focused.
    let typed = $state<string | null>(null);
    const shownName = $derived(typed ?? lobby.name);
</script>

<Screen id="online-screen" labelledby="online-title">
    <div class="page page-narrow">
        <PageHead eyebrow="Online" title="Online duel" id="online-title" />
        <div id="online-setup" class="online-setup" class:hidden={!lobby.available}>
            <label class="online-field"><span>Your name</span>
                <input id="online-name" class="field" maxlength="16" autocomplete="nickname" spellcheck="false" bind:this={nameInput}
                    value={shownName} oninput={event => { typed = event.currentTarget.value; }}
                    onchange={() => { ui.setOnlineName(typed ?? lobby.name); typed = null; }}>
            </label>
            <div class="online-field"><span>Lobby</span>
                <div id="online-regions" class="segmented segmented-wrap" role="group" aria-label="Region">
                    {#each REGIONS as region (region.id)}
                        <button type="button" class="segment" aria-pressed={region.id === lobby.region} onclick={() => ui.setOnlineRegion(region.id)}>{region.name}</button>
                    {/each}
                </div>
            </div>
        </div>
        <p id="online-status" class="online-status" data-state={lobby.state} aria-live="polite">{lobby.text}</p>
        <ul id="online-players" class="online-players" aria-label="Players in this lobby">
            {#each lobby.peers as peer (peer.id)}
                <li class="online-player" class:busy={peer.busy}>
                    <span class="online-dot" aria-hidden="true"></span>
                    <strong>{peer.name}</strong>
                    <button type="button" class="btn" class:btn-primary={!peer.waiting} disabled={peer.disabled} onclick={() => ui.challenge(peer)}>
                        {peer.waiting ? 'Cancel' : peer.busy ? 'In a match' : 'Challenge'}
                    </button>
                </li>
            {/each}
        </ul>
        <p class="note">Tap <b>Challenge</b> on an idle player. Whoever challenges hosts the match. Games connect directly between your browsers, so a strict office or school network can block them.</p>
    </div>
    <Overlay open={ui.invite !== null} id="invite-overlay" labelledby="invite-title">
        <div class="dialog">
            <span class="eyebrow">Challenge</span>
            <h2 tabindex="-1" id="invite-title">{ui.invite?.name ?? ''}</h2>
            <p>wants to duel you.</p>
            <button type="button" id="btn-invite-accept" class="btn btn-primary" onclick={() => ui.answerInvite(true)}>Accept</button>
            <button type="button" id="btn-invite-decline" class="btn" onclick={() => ui.answerInvite(false)}>Decline</button>
        </div>
    </Overlay>
</Screen>
