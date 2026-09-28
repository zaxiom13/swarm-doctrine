<script lang="ts">
    import Screen from './Screen.svelte';
    import PageHead from './PageHead.svelte';
    import Card from './Card.svelte';
    import { useUI } from './context.ts';

    const ui = useUI();
    const all = $derived(ui.lessonsDone === ui.lessons.length);
</script>

<Screen id="lessons-screen" labelledby="lessons-title">
    <div class="page">
        <PageHead eyebrow="Lessons" title="Learn the controls" id="lessons-title" />
        <p id="lesson-progress" class="note">{ui.lessonsDone} of {ui.lessons.length} complete</p>
        <div id="lesson-grid" class="card-grid">
            {#each ui.lessons as lesson (lesson.index)}
                <Card eyebrow="{String(lesson.index + 1).padStart(2, '0')}{lesson.done ? ' · Done' : ''}" title={lesson.title} text={lesson.description} class={lesson.done ? 'done' : ''} onclick={() => ui.startLesson(lesson.index)} />
            {/each}
        </div>
        <div class="page-actions">
            <button type="button" id="btn-continue-lessons" class="btn btn-primary" onclick={() => { ui.click(); ui.game.tutorial.start(ui.game.tutorial.firstIncomplete()); }}>
                {all ? 'Start again' : ui.lessonsDone ? 'Continue learning →' : 'Start with movement →'}
            </button>
        </div>
    </div>
</Screen>
