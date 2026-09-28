<script lang="ts">
    import { onMount } from 'svelte';
    import type { UIManager } from './lib/ui.svelte.ts';
    import { provideUI } from './components/context.ts';
    import Home from './components/Home.svelte';
    import ModeScreen from './components/ModeScreen.svelte';
    import LessonsScreen from './components/LessonsScreen.svelte';
    import GuideScreen from './components/GuideScreen.svelte';
    import OnlineScreen from './components/OnlineScreen.svelte';
    import HelpScreen from './components/HelpScreen.svelte';
    import TeamSelectScreen from './components/TeamSelectScreen.svelte';
    import RivalScreen from './components/RivalScreen.svelte';
    import SettingsScreen from './components/SettingsScreen.svelte';
    import GameScreen from './components/GameScreen.svelte';

    let { ui, ready }: { ui: UIManager; ready: (canvas: HTMLCanvasElement) => void } = $props();
    // The UI state object is created once in main.ts and never replaced.
    // svelte-ignore state_referenced_locally
    provideUI(ui);

    let canvas = $state<HTMLCanvasElement>();
    onMount(() => ready(canvas!));

    $effect(() => { document.body.classList.toggle('details-open', ui.detailsOpen); });
</script>

<svelte:document onkeydown={event => { if (event.key === 'Escape') ui.escape(); }} />
<svelte:window onpopstate={() => ui.popstate()} />

<Home />
<ModeScreen />
<LessonsScreen />
<GuideScreen />
<OnlineScreen />
<HelpScreen />
<TeamSelectScreen />
<RivalScreen />
<SettingsScreen />
<GameScreen bind:canvas />

<div id="toast" class="toast" class:hidden={!ui.toastVisible} role="status" aria-live="polite">{ui.toastText}</div>
<div id="busy" class="busy" class:hidden={!ui.busy} role="status">Connecting…</div>
