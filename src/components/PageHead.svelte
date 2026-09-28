<script lang="ts">
    import { useUI } from './context.ts';

    let { eyebrow, title, id, back = 'Back' }: { eyebrow: string; title: string; id: string; back?: string } = $props();
    const ui = useUI();
</script>

<header class="page-head">
    <button type="button" class="btn-back" onclick={() => ui.goBack()}>{back}</button>
    <span class="eyebrow">{eyebrow}</span>
    <h2 tabindex="-1" {id}>{title}</h2>
</header>
