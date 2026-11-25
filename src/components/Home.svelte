<script lang="ts">
    import { onMount } from 'svelte';
    import Screen from './Screen.svelte';
    import Icon from './Icon.svelte';
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
        <svg class="home-mark" viewBox="0 0 64 60" aria-hidden="true">
            <path transform="translate(32 16) scale(1.35)" d="M0 -9 L6.5 7 L0 3.5 L-6.5 7 Z" fill="currentColor" opacity="1"/>
            <path transform="translate(21 30) scale(1.05)" d="M0 -9 L6.5 7 L0 3.5 L-6.5 7 Z" fill="currentColor" opacity="0.88"/>
            <path transform="translate(43 30) scale(1.05)" d="M0 -9 L6.5 7 L0 3.5 L-6.5 7 Z" fill="currentColor" opacity="0.88"/>
            <path transform="translate(11 44) scale(0.8)" d="M0 -9 L6.5 7 L0 3.5 L-6.5 7 Z" fill="#8f7bff" opacity="0.72"/>
            <path transform="translate(53 44) scale(0.8)" d="M0 -9 L6.5 7 L0 3.5 L-6.5 7 Z" fill="#8f7bff" opacity="0.72"/>
        </svg>
        <h1 class="home-title"><span>Swarm</span><em>Doctrine</em></h1>
        <p class="home-tagline">Move together · Recruit everyone</p>
        <div class="home-actions">
            <button type="button" id="btn-play" class="btn btn-primary btn-big" onclick={() => ui.navigate('mode-screen')}>
                <Icon name="play" size={20} />
                <span>Play</span>
            </button>
            <button type="button" id="btn-field-guide" class="btn btn-secondary btn-big" onclick={() => ui.navigate('guide-screen')}>
                <Icon name="book" size={20} />
                <span>Field guide</span>
            </button>
        </div>
        <nav class="home-links" aria-label="More">
            <button type="button" class="home-link" onclick={() => ui.navigate('settings-screen')}>
                <Icon name="settings" size={15} />
                <span>Settings</span>
            </button>
        </nav>
        {#if ui.records}
            <p id="home-record" class="home-record">{ui.records}</p>
        {:else}
            <p id="home-record" class="home-record" aria-hidden="true"></p>
        {/if}
    </section>
</Screen>
