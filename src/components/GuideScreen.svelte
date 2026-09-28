<script lang="ts">
    import Screen from './Screen.svelte';
    import PageHead from './PageHead.svelte';
    import FreezeTimeline from './FreezeTimeline.svelte';
    import { DEFAULT_RULES } from '../lib/rules.ts';
    import { GUIDE, GUIDE_DEVICES, detectGuideDevice, guideSteps } from '../lib/guide.ts';
    import { useUI } from './context.ts';

    const DEVICE_KEY = 'swarm-guide-device';
    const ui = useUI();

    function initialDevice(): string {
        try {
            const saved = localStorage.getItem(DEVICE_KEY);
            if (saved && GUIDE_DEVICES[saved]) return saved;
        } catch { /* Optional. */ }
        return detectGuideDevice();
    }

    let device = $state(initialDevice());
    let index = $state(0);
    const steps = $derived(guideSteps(device, DEFAULT_RULES));
    const current = $derived(steps[Math.min(index, steps.length - 1)]);
    let swipeStart: { x: number; y: number } | null = null;

    /** Switches between the phone and computer guides, staying on the same topic. */
    function setDevice(next: string) {
        ui.click();
        const before = current;
        device = next;
        const fresh = guideSteps(next, DEFAULT_RULES);
        const same = fresh.findIndex(s => s.title === before.title);
        index = same >= 0 ? same : Math.max(0, fresh.findIndex(s => s.chapter === before.chapter));
        try { localStorage.setItem(DEVICE_KEY, next); } catch { /* Optional. */ }
    }

    function advance(delta: number) {
        const next = index + delta;
        if (next >= steps.length) ui.showScreen('mode-screen');
        else if (next >= 0) index = next;
    }

    function go(delta: number) { ui.click(); advance(delta); }

    function keydown(event: KeyboardEvent) {
        if (ui.screen !== 'guide-screen' || (event.target as HTMLElement | null)?.tagName === 'INPUT') return;
        if (event.key === 'ArrowRight') advance(1);
        else if (event.key === 'ArrowLeft') advance(-1);
    }

    // Warm the next picture so tapping Next feels instant.
    $effect(() => {
        const upcoming = steps[index + 1]?.image;
        if (upcoming && globalThis.Image) new Image().src = upcoming;
    });
</script>

<svelte:document onkeydown={keydown} />

<Screen id="guide-screen" labelledby="guide-title">
    <div class="page page-guide" data-device={device}>
        <PageHead eyebrow="Field guide" title="How it works" id="guide-title" />
        <nav id="guide-chapters" class="guide-chapters" aria-label="Chapters">
            {#each GUIDE as chapter (chapter.id)}
                {@const active = current.chapter.id === chapter.id}
                <button type="button" class="pill" class:active aria-current={active ? 'step' : undefined} onclick={() => { ui.click(); index = steps.findIndex(s => s.chapter === chapter); }}>
                    <span aria-hidden="true">{chapter.icon}</span>{chapter.title}
                </button>
            {/each}
        </nav>
        <div class="guide-progress" aria-hidden="true"><div id="guide-progress-fill" style="width:{(index + 1) / steps.length * 100}%"></div></div>
        <figure class="guide-card" aria-live="polite">
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div id="guide-media" class="guide-media"
                onpointerdown={event => { swipeStart = { x: event.clientX, y: event.clientY }; }}
                onpointerup={event => {
                    if (!swipeStart) return;
                    const dx = event.clientX - swipeStart.x, dy = event.clientY - swipeStart.y;
                    swipeStart = null;
                    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) advance(dx < 0 ? 1 : -1);
                }}>
                {#if current.timeline}
                    <FreezeTimeline rules={DEFAULT_RULES} />
                {:else}
                    <img src={current.image} alt={current.alt} decoding="async">
                {/if}
            </div>
            <figcaption>
                <span id="guide-count" class="eyebrow">{current.chapter.icon} {current.chapter.title} · Step {index + 1} of {steps.length}</span>
                <strong id="guide-step-title">{current.title}</strong>
                <p id="guide-step-text">{current.text}</p>
            </figcaption>
        </figure>
        <div class="guide-nav">
            <button type="button" id="btn-guide-prev" class="btn" disabled={index === 0} onclick={() => go(-1)}>← Back</button>
            <button type="button" id="btn-guide-next" class="btn btn-primary" onclick={() => go(1)}>{index === steps.length - 1 ? 'Start playing ▶' : 'Next →'}</button>
        </div>
        <div class="guide-device">
            <span class="note">Controls shown for</span>
            <div id="guide-device" class="segmented" role="group" aria-label="Show controls for">
                {#each Object.entries(GUIDE_DEVICES) as [id, info] (id)}
                    <button type="button" class="segment" aria-pressed={device === id} onclick={() => setDevice(id)}><span aria-hidden="true">{info.icon}</span>{info.label}</button>
                {/each}
            </div>
        </div>
    </div>
</Screen>
