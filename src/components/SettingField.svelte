<script lang="ts">
    import { untrack } from 'svelte';
    import { settings, type SettingSpec } from '../lib/settings.ts';
    import { useUI } from './context.ts';

    let { field }: { field: SettingSpec } = $props();
    const ui = useUI();
    const id = $derived(`setting-${field.key}`);
    // A toggle with no stored choice follows the system preference (reduce motion).
    const systemDefault = () => Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    // The form is re-created on reset, so the starting value is read once.
    let current = $state<string | number | boolean>(untrack(() => settings[field.key] ?? (field.type === 'toggle' ? systemDefault() : '')));

    function save(value: string | number | boolean) {
        current = value;
        ui.applySetting(field.key, value);
    }
</script>

<div class="setting-row">
    <label for={id}>{field.label}{#if field.note}<small> · {field.note}</small>{/if}</label>
    {#if field.type === 'toggle'}
        <input type="checkbox" {id} class="switch" checked={Boolean(current)} onchange={event => save(event.currentTarget.checked)}>
    {:else if field.type === 'select'}
        <select {id} value={current} onchange={event => save(event.currentTarget.value)}>
            {#each field.options ?? [] as [optionValue, label] (optionValue)}
                <option value={optionValue}>{label}</option>
            {/each}
        </select>
    {:else}
        <input type="range" {id} min={field.min} max={field.max} step={field.step} value={current} oninput={event => save(Number(event.currentTarget.value))}>
        <output for={id}>{current}</output>
    {/if}
</div>
