<script lang="ts">
    import Screen from './Screen.svelte';
    import PageHead from './PageHead.svelte';
    import { DEFAULT_RULES, describeRules } from '../lib/rules.ts';
    import { useUI } from './context.ts';

    const ui = useUI();
    const text = describeRules(DEFAULT_RULES);
</script>

<Screen id="help-screen" labelledby="help-title">
    <div class="page page-narrow">
        <PageHead eyebrow="Guide" title="How to play" id="help-title" />
        <ol id="help-steps" class="steps">
            <li><strong>Rally</strong><p>Hold to move your ships together.</p></li>
            <li><strong>Release</strong><p>Let go beside a smaller group to recruit it.</p></li>
            <li><strong>Freeze</strong><p>{text.freeze}</p></li>
        </ol>
        <h3 class="section-title">Controls</h3>
        <dl class="controls">
            <dt>Rally</dt><dd>Hold and drag anywhere in the arena. Let go to recruit.</dd>
            <dt>Freeze</dt><dd>Space or right-click (Q, E, 1 and 2 also work). On touch, tap Freeze, then tap the arena.</dd>
            <dt>Pause</dt><dd>Escape or P. R restarts the match.</dd>
        </dl>
        <h3 class="section-title">Rules</h3>
        <ul id="help-rules" class="rule-list">
            {#each Object.values(text) as line}<li>{line}</li>{/each}
        </ul>
        <div class="page-actions"><button type="button" id="btn-help-guide" class="btn btn-primary" onclick={() => ui.navigate('guide-screen')}>Open the field guide</button></div>
    </div>
</Screen>
