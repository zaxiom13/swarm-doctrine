<script lang="ts">
    // A menu card: optional leading glyph or eyebrow, a title and one line of text.
    let { icon = '', symbol = '', eyebrow = '', title, text, class: className = '', style = '', pressed, onclick }: {
        icon?: string; symbol?: string; eyebrow?: string; title: string; text: string; class?: string; style?: string; pressed?: boolean; onclick: () => void;
    } = $props();
</script>

<button type="button" class="card {className}" {style} aria-pressed={pressed} {onclick}>
    {#if icon}<span class="card-icon" aria-hidden="true">{icon}</span>{/if}
    {#if symbol}<span class="team-symbol" aria-hidden="true">{symbol}</span>{/if}
    {#if eyebrow}<span class="card-eyebrow">{eyebrow}</span>{/if}
    <strong>{title}</strong>
    <p>{text}</p>
</button>
