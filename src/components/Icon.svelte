<script lang="ts">
    // Uniform vector icon set replacing mixed OS emojis across menus, cards, and HUD.
    let { name, size = 22, class: className = '' }: { name: string; size?: number; class?: string } = $props();
</script>

<svg class="icon {className}" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    {#if name === 'levels'}
        <circle cx="6" cy="17" r="2.2" fill="currentColor" stroke="none"/>
        <circle cx="12" cy="7" r="2.2" fill="currentColor" stroke="none"/>
        <circle cx="18" cy="15" r="2.2" fill="currentColor" stroke="none"/>
        <path d="M7.6 15.1 10.6 9M13.5 8.8l3.2 4.3M8.2 16.7l7.6-1.3"/>
    {:else if name === 'zen'}
        <circle cx="12" cy="12" r="8.5" stroke-opacity="0.45"/>
        <path d="M4.5 13.5c2.5-2.5 5 2.5 7.5 0s5-2.5 7.5 0"/>
        <path d="M6.5 9.5c2-1.8 3.5 1.8 5.5 0s3.5-1.8 5.5 0" stroke-opacity="0.7"/>
        <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/>
    {:else if name === 'survival'}
        <path d="M12 3 19.5 6.2v5.4c0 4.8-3.2 8.2-7.5 9.4-4.3-1.2-7.5-4.6-7.5-9.4V6.2Z"/>
        <path d="M12 7.5v8M8.5 11.5h7"/>
    {:else if name === 'duel'}
        <path d="m14.5 4.5 5 5-9.5 9.5-4 1 1-4Z"/>
        <path d="m9.5 4.5-5 5 3 3m6.5 6.5 3.5 3.5 1-4-2.5-2.5"/>
    {:else if name === 'online'}
        <circle cx="12" cy="12" r="8.5"/>
        <ellipse cx="12" cy="12" rx="4" ry="8.5"/>
        <path d="M3.8 12h16.4"/>
    {:else if name === 'duel-hard'}
        <rect x="6" y="6" width="12" height="12" rx="2.5"/>
        <path d="M9.5 9.5h5v5h-5z" fill="currentColor" stroke="none"/>
        <path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3"/>
    {:else if name === 'duel-tactician'}
        <path d="M12 3.5 20 8v8l-8 4.5L4 16V8Z"/>
        <circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none"/>
        <path d="M12 3.5v5.8M20 8l-5.7 2.7M4 8l5.7 2.7M12 20.5v-5.8"/>
    {:else if name === 'duel-local'}
        <circle cx="12" cy="12" r="8"/>
        <circle cx="12" cy="12" r="4" stroke-opacity="0.7"/>
        <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/>
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
    {:else if name === 'duel-jev' || name === 'chain-reaction'}
        <path d="M13.5 2.5 5.5 13h6l-1 8.5 8-10.5h-6Z" fill="currentColor" fill-opacity="0.22"/>
    {:else if name === 'ai'}
        <path d="M12 3c2.5 3.5 5.5 5.5 5.5 10a5.5 5.5 0 1 1-11 0c0-2.5 1.3-4.7 3-6.5.3 2 1.5 3 2.5 3 0-2.5-.5-4.3 0-6.5Z" fill="currentColor" fill-opacity="0.2"/>
    {:else if name === 'passive'}
        <path d="M18.5 14.5A7 7 0 0 1 9.5 5.5a7.5 7.5 0 1 0 9 9Z" fill="currentColor" fill-opacity="0.2"/>
    {:else if name === 'faster-recruitment'}
        <path d="m7 17 5-5 5 5M7 11l5-5 5 5"/>
    {:else if name === 'stronger-rally'}
        <circle cx="12" cy="12" r="8.5" stroke-dasharray="3 3"/>
        <circle cx="12" cy="12" r="4.5"/>
        <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/>
    {:else if name === 'fleet-defense'}
        <path d="M12 3 19.5 6.8v5.7c0 4.5-3.2 7.6-7.5 8.8-4.3-1.2-7.5-4.3-7.5-8.8V6.8Z"/>
        <path d="m9 12 2.1 2.1L15.5 9.8"/>
    {:else if name === 'reinforcements'}
        <path d="M12 4 15.5 11 12 9.2 8.5 11Z" fill="currentColor" stroke="none"/>
        <path d="M6.5 13 9.5 19.5 6.5 18 3.5 19.5Z" fill="currentColor" fill-opacity="0.78" stroke="none"/>
        <path d="M17.5 13 20.5 19.5 17.5 18 14.5 19.5Z" fill="currentColor" fill-opacity="0.78" stroke="none"/>
    {:else if name === 'wider-freeze' || name === 'freeze'}
        <path d="M12 2.5v19M3.8 7.2l16.4 9.6M20.2 7.2 3.8 16.8"/>
        <path d="m9.5 4.8 2.5 2 2.5-2M9.5 19.2 12 17.2l2.5 2M4.5 10.2l2.6-1-1-2.6M19.5 13.8l-2.6 1 1 2.6"/>
    {:else if name === 'dragon'}
        <path d="M12 3.2 19.5 12 12 20.8 4.5 12Z" fill="currentColor" fill-opacity="0.22"/>
        <path d="M12 7.5 15.8 12 12 16.5 8.2 12Z" fill="currentColor" stroke="none"/>
    {:else if name === 'salamander'}
        <path d="M12 3.2 19.5 7.5v9L12 20.8 4.5 16.5v-9Z" fill="currentColor" fill-opacity="0.22"/>
        <path d="M12 8.2 15.4 10.2v3.6L12 15.8l-3.4-2v-3.6Z" fill="currentColor" stroke="none"/>
    {:else if name === 'phoenix'}
        <path d="M12 3.5 14.8 9.2 21 9.8 16.4 14l1.3 6.2L12 17l-5.7 3.2 1.3-6.2L3 9.8l6.2-.6Z" fill="currentColor" fill-opacity="0.22"/>
    {:else if name === 'rat'}
        <path d="M13 3.5 6.5 13h5l-1 7.5 7-9.5h-5Z" fill="currentColor" fill-opacity="0.24"/>
    {:else if name === 'play'}
        <path d="M7.5 5v14l11-7Z" fill="currentColor" stroke="none"/>
    {:else if name === 'book'}
        <path d="M4 5.5C7 4 9.5 4 12 6c2.5-2 5-2 8-.5v13c-3-1.5-5.5-1.5-8 .5-2.5-2-5-2-8-.5Z"/>
        <path d="M12 6v13"/>
    {:else if name === 'settings'}
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h.1a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1Z"/>
    {:else if name === 'pause'}
        <rect x="6.5" y="5" width="3.8" height="14" rx="1.2" fill="currentColor" stroke="none"/>
        <rect x="13.7" y="5" width="3.8" height="14" rx="1.2" fill="currentColor" stroke="none"/>
    {:else if name === 'guide'}
        <circle cx="12" cy="12" r="8.5"/>
        <polygon points="15.5,8.5 13.4,13.4 8.5,15.5 10.6,10.6" fill="currentColor" stroke="none"/>
    {:else if name === 'details'}
        <path d="M5 18v-5M10 18V9M15 18v-7M20 18V6"/>
    {:else if name === 'phone'}
        <rect x="7" y="2.8" width="10" height="18.4" rx="2.2"/>
        <path d="M10.8 18h2.4"/>
    {:else if name === 'desktop'}
        <rect x="3" y="4.5" width="18" height="12" rx="2"/>
        <path d="M8.5 20h7M12 16.5V20"/>
    {:else if name === 'basics'}
        <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/>
        <circle cx="12" cy="12" r="2.8"/>
    {:else if name === 'move'}
        <circle cx="12" cy="12" r="8" stroke-dasharray="3 3"/>
        <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>
    {:else if name === 'recruit'}
        <circle cx="8" cy="12" r="3"/>
        <circle cx="16" cy="12" r="3"/>
        <path d="M11 12h2"/>
    {:else if name === 'terrain'}
        <circle cx="12" cy="12" r="3.5" fill="currentColor" fill-opacity="0.3"/>
        <ellipse cx="12" cy="12" rx="9.5" ry="3.8" transform="rotate(-22 12 12)"/>
    {:else if name === 'modes'}
        <rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/>
        <rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/>
        <rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/>
        <rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>
    {:else if name === 'chevron-down'}
        <path d="m6 9 6 6 6-6"/>
    {:else if name === 'check'}
        <path d="m5 12.5 4.2 4.2L19 7"/>
    {:else if name === 'drills'}
        <path d="M12 3 18.5 19 12 15.5 5.5 19Z" fill="currentColor" fill-opacity="0.2"/>
    {:else}
        <circle cx="12" cy="12" r="5"/>
    {/if}
</svg>
