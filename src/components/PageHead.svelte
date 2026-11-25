<script lang="ts">
    import { useUI } from './context.ts';

    let { eyebrow, title, id, back = 'Back' }: { eyebrow: string; title: string; id: string; back?: string } = $props();
    const ui = useUI();
</script>

<header class="page-head">
    <button type="button" class="btn-back" aria-label={back} onclick={() => ui.goBack()}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6"/>
        </svg>
    </button>
    <span class="eyebrow">{eyebrow}</span>
    <h2 tabindex="-1" {id}>{title}</h2>
</header>
