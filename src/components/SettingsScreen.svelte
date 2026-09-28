<script lang="ts">
    import Screen from './Screen.svelte';
    import PageHead from './PageHead.svelte';
    import SettingField from './SettingField.svelte';
    import { SETTINGS_SCHEMA, SETTINGS_GROUPS } from '../lib/settings.ts';
    import { useUI } from './context.ts';

    const ui = useUI();
    const fields = (group: string) => SETTINGS_SCHEMA.filter(field => field.group === group);
</script>

<Screen id="settings-screen" labelledby="settings-title">
    <div class="page page-narrow">
        <PageHead eyebrow="Preferences" title="Settings" id="settings-title" back="Done" />
        <!-- Re-created after a reset so every control shows the stored defaults. -->
        {#key ui.settingsVersion}
            <form id="settings-form" class="settings" novalidate onsubmit={event => event.preventDefault()}>
                {#each Object.entries(SETTINGS_GROUPS) as [group, title] (group)}
                    <fieldset class="settings-group">
                        <legend>{title}</legend>
                        {#each fields(group) as field (field.key)}
                            <SettingField {field} />
                        {/each}
                    </fieldset>
                {/each}
            </form>
        {/key}
        <div class="page-actions">
            <button type="button" id="btn-reset-settings" class="btn" onclick={() => ui.resetSettings()}>Reset settings</button>
            <button type="button" id="btn-reset-progress" class="btn btn-danger" onclick={() => ui.clearProgress()}>Clear progress and records</button>
        </div>
        <p id="jev-note" class="note" class:hidden={!ui.jevNote}>Jev duels need a local key: <a href="connect.html">connect Jev</a>.</p>
    </div>
</Screen>
