<script lang="ts">
    import type { Rules } from '../lib/rules.ts';

    // Freeze timing drawn to scale from the rules.
    let { rules }: { rules: Rules } = $props();
    const total = $derived(rules.freezeLockout + rules.freezeCooldown * 2 + 2);
    const first = $derived(rules.freezeLockout);
    const second = $derived(first + rules.freezeCooldown);
    const pct = (value: number) => `${value / total * 100}%`;
</script>

{#snippet bar(label: string, start: number, length: number, kind: string)}
    <div class="timeline-bar {kind}" style="left:{pct(start)};width:{pct(length)}" title={label}><span>{label}</span></div>
{/snippet}
{#snippet cast(at: number, label: string)}
    <div class="timeline-cast" style="left:{pct(at)}"><span>{label}</span></div>
{/snippet}

<div class="timeline" role="img" aria-label="Freeze is locked for the first {rules.freezeLockout} seconds, freezes rivals for {rules.freezeDuration} seconds and recharges in {rules.freezeCooldown} seconds.">
    <div class="timeline-row"><b>Charge</b><div class="timeline-track">
        {@render bar(`Locked ${rules.freezeLockout}s`, 0, rules.freezeLockout, 'locked')}
        {@render bar(`Recharging ${rules.freezeCooldown}s`, first, rules.freezeCooldown, 'charging')}
        {@render bar(`Recharging ${rules.freezeCooldown}s`, second, rules.freezeCooldown, 'charging')}
    </div></div>
    <div class="timeline-row"><b>Rivals</b><div class="timeline-track">
        {@render bar(`Frozen ${rules.freezeDuration}s`, first, rules.freezeDuration, 'frozen')}
        {@render bar(`Frozen ${rules.freezeDuration}s`, second, rules.freezeDuration, 'frozen')}
        {@render cast(first, '❄ cast')}
        {@render cast(second, '❄ cast')}
    </div></div>
    <div class="timeline-axis"><span>0s</span><span>{Math.round(total)}s</span></div>
</div>
