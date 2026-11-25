<script lang="ts">
    import Screen from './Screen.svelte';
    import PageHead from './PageHead.svelte';
    import FreezeTimeline from './FreezeTimeline.svelte';
    import Icon from './Icon.svelte';
    import { DEFAULT_RULES, describeRules } from '../lib/rules.ts';
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

    let tab = $state<'walkthrough' | 'reference'>('walkthrough');
    let device = $state(initialDevice());
    let index = $state(0);
    const steps = $derived(guideSteps(device, DEFAULT_RULES));
    const current = $derived(steps[Math.min(index, steps.length - 1)]);
    const ruleText = describeRules(DEFAULT_RULES);
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
        if (ui.screen !== 'guide-screen' || tab !== 'walkthrough' || (event.target as HTMLElement | null)?.tagName === 'INPUT') return;
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

        <div class="guide-tabs" role="group" aria-label="Guide view">
            <button type="button" class="guide-tab" aria-pressed={tab === 'walkthrough'} onclick={() => { ui.click(); tab = 'walkthrough'; }}>
                <Icon name="book" size={16} />
                <span>Walkthrough</span>
            </button>
            <button type="button" class="guide-tab" aria-pressed={tab === 'reference'} onclick={() => { ui.click(); tab = 'reference'; }}>
                <Icon name="details" size={16} />
                <span>Quick reference</span>
            </button>
        </div>

        {#if tab === 'walkthrough'}
            <nav id="guide-chapters" class="guide-chapters" aria-label="Chapters">
                {#each GUIDE as chapter (chapter.id)}
                    {@const active = current.chapter.id === chapter.id}
                    <button type="button" class="pill" class:active aria-current={active ? 'step' : undefined} onclick={() => { ui.click(); index = steps.findIndex(s => s.chapter === chapter); }}>
                        <Icon name={chapter.icon} size={15} />
                        <span>{chapter.title}</span>
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
                    <span id="guide-count" class="eyebrow">{current.chapter.title} · Step {index + 1} of {steps.length}</span>
                    <strong id="guide-step-title">{current.title}</strong>
                    <p id="guide-step-text">{current.text}</p>
                </figcaption>
            </figure>
            <div class="guide-nav">
                <button type="button" id="btn-guide-prev" class="btn" disabled={index === 0} onclick={() => go(-1)}>← Back</button>
                <button type="button" id="btn-guide-next" class="btn btn-primary" onclick={() => go(1)}>{index === steps.length - 1 ? 'Start playing' : 'Next →'}</button>
            </div>
            <div class="guide-device">
                <span class="note">Controls shown for</span>
                <div id="guide-device" class="segmented" role="group" aria-label="Show controls for">
                    {#each Object.entries(GUIDE_DEVICES) as [id, info] (id)}
                        <button type="button" class="segment" aria-pressed={device === id} onclick={() => setDevice(id)}>
                            <Icon name={info.icon} size={15} />
                            <span>{info.label}</span>
                        </button>
                    {/each}
                </div>
            </div>
        {:else}
            <div class="ref-stack">
                <ol id="help-steps" class="steps">
                    <li><strong>Rally</strong><p>Hold and drag anywhere to pull your nearby fleet into formation.</p></li>
                    <li><strong>Release</strong><p>Let go beside a smaller group to spread out and recruit it.</p></li>
                    <li><strong>Freeze</strong><p>{ruleText.freeze}</p></li>
                </ol>
                <section class="ref-panel">
                    <h3 class="section-title">Controls</h3>
                    <dl class="controls">
                        <dt>Rally</dt><dd>Hold and drag anywhere in the arena. Let go to recruit.</dd>
                        <dt>Freeze</dt><dd>Space or right-click (Q, E, 1 and 2 also work). On touch, tap Freeze, then tap the arena.</dd>
                        <dt>Pause</dt><dd>Escape or P. R restarts the match.</dd>
                    </dl>
                </section>
                <section class="ref-panel">
                    <h3 class="section-title">Live rules</h3>
                    <ul id="help-rules" class="rule-list">
                        {#each Object.values(ruleText) as line}<li>{line}</li>{/each}
                    </ul>
                </section>
                <div class="ref-actions">
                    <button type="button" id="btn-guide-drills" class="btn btn-secondary" onclick={() => ui.openLessons()}>
                        <Icon name="drills" size={18} />
                        <span>Try interactive drills (15)</span>
                    </button>
                    <button type="button" class="btn btn-primary" onclick={() => ui.navigate('mode-screen')}>
                        <Icon name="play" size={18} />
                        <span>Pick a mode</span>
                    </button>
                </div>
            </div>
        {/if}
    </div>
</Screen>
