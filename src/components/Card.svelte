<script lang="ts">
    import type { Snippet } from 'svelte';
    import Icon from './Icon.svelte';

    // A tactical menu card: vector icon or team emblem, optional eyebrow/badge, title, summary, and optional footer content.
    let { icon = '', teamIcon = '', eyebrow = '', badge = '', title, text, class: className = '', style = '', pressed, onclick, children }: {
        icon?: string; teamIcon?: string; eyebrow?: string; badge?: string; title: string; text: string; class?: string; style?: string; pressed?: boolean; onclick: () => void; children?: Snippet;
    } = $props();
</script>

<button type="button" class="card {className}" {style} aria-pressed={pressed} {onclick}>
    {#if icon}<span class="card-icon" aria-hidden="true"><Icon name={icon} size={26} /></span>{/if}
    {#if teamIcon}<span class="team-symbol" aria-hidden="true"><Icon name={teamIcon} size={28} /></span>{/if}
    {#if eyebrow || badge}
        <span class="card-meta">
            {#if eyebrow}<span class="card-eyebrow">{eyebrow}</span>{/if}
            {#if badge}<span class="card-badge">{badge}</span>{/if}
        </span>
    {/if}
    <strong>{title}</strong>
    <p>{text}</p>
    {#if children}{@render children()}{/if}
</button>
