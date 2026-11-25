<script lang="ts">
    import Screen from './Screen.svelte';
    import PageHead from './PageHead.svelte';
    import Card from './Card.svelte';
    import Icon from './Icon.svelte';
    import { useUI } from './context.ts';

    const ui = useUI();
    const all = $derived(ui.lessons.length > 0 && ui.lessonsDone === ui.lessons.length);
    const pct = $derived(ui.lessons.length ? Math.round(ui.lessonsDone / ui.lessons.length * 100) : 0);
</script>

<Screen id="lessons-screen" labelledby="lessons-title">
    <div class="page">
        <PageHead eyebrow="Training" title="Interactive drills" id="lessons-title" />
        <div class="lesson-summary">
            <span id="lesson-progress" class="note">{ui.lessonsDone} of {ui.lessons.length} complete</span>
            <div class="meter" aria-hidden="true"><div style="width:{pct}%"></div></div>
        </div>
        <div id="lesson-grid" class="card-grid">
            {#each ui.lessons as lesson (lesson.index)}
                <Card eyebrow="{String(lesson.index + 1).padStart(2, '0')}{lesson.done ? ' · Done' : ''}" title={lesson.title} text={lesson.description} class={lesson.done ? 'done' : ''} onclick={() => ui.startLesson(lesson.index)} />
            {/each}
        </div>
        <div class="page-actions">
            <button type="button" id="btn-continue-lessons" class="btn btn-primary" onclick={() => { ui.click(); ui.game.tutorial.start(ui.game.tutorial.firstIncomplete()); }}>
                <Icon name="play" size={18} />
                <span>{all ? 'Start again' : ui.lessonsDone ? 'Continue drills' : 'Start with movement'}</span>
            </button>
        </div>
    </div>
</Screen>
