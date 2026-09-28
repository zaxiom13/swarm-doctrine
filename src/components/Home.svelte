<script lang="ts">
    import { onMount } from 'svelte';
    import Screen from './Screen.svelte';
    import { startPreview } from './preview.ts';
    import { useUI } from './context.ts';

    const ui = useUI();
    let canvas = $state<HTMLCanvasElement>();
    let main = $state<HTMLElement>();

    onMount(() => startPreview(canvas!, main!, () => ui.screen === 'main-menu'));
</script>

<Screen id="main-menu" kind="home" bind:root={main}>
        <canvas id="swarm-preview" aria-hidden="true" bind:this={canvas}></canvas>
        <section class="home-hero">
            <svg class="home-mark" viewBox="0 0 64 60" aria-hidden="true"><path transform="translate(32 16) scale(1.35)" d="M0 -9 L6.5 7 L0 3.5 L-6.5 7 Z" fill="currentColor" opacity="1"/><path transform="translate(21 30) scale(1.05)" d="M0 -9 L6.5 7 L0 3.5 L-6.5 7 Z" fill="currentColor" opacity="0.85"/><path transform="translate(43 30) scale(1.05)" d="M0 -9 L6.5 7 L0 3.5 L-6.5 7 Z" fill="currentColor" opacity="0.85"/><path transform="translate(11 44) scale(0.8)" d="M0 -9 L6.5 7 L0 3.5 L-6.5 7 Z" fill="currentColor" opacity="0.55"/><path transform="translate(53 44) scale(0.8)" d="M0 -9 L6.5 7 L0 3.5 L-6.5 7 Z" fill="currentColor" opacity="0.55"/></svg>
            <h1 class="home-title"><span>Swarm</span><em>Doctrine</em></h1>
            <p class="home-tagline">Move together · Recruit everyone</p>
            <div class="home-actions">
                <button type="button" id="btn-play" class="btn btn-primary btn-big" onclick={() => ui.navigate('mode-screen')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12-7.5z" fill="currentColor"/></svg>Play</button>
                <button type="button" id="btn-field-guide" class="btn btn-secondary btn-big" onclick={() => ui.navigate('guide-screen')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5C7 4 9.5 4 12 6c2.5-2 5-2 8-.5v13c-3-1.5-5.5-1.5-8 .5-2.5-2-5-2-8-.5z M12 6v13" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>Field guide</button>
            </div>
            <nav class="home-links" aria-label="More">
                <button type="button" class="home-link" onclick={() => ui.navigate('help-screen')}>How to play</button>
                <span class="home-link-sep" aria-hidden="true"></span>
                <button type="button" class="home-link" onclick={() => ui.navigate('settings-screen')}>Settings</button>
            </nav>
            <p id="home-record" class="home-record">{ui.records}</p>
        </section>
</Screen>
