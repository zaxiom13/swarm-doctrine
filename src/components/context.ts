import { getContext, setContext } from 'svelte';
import type { UIManager } from '../lib/ui.svelte.ts';

const KEY = Symbol('ui');

export const provideUI = (ui: UIManager) => setContext(KEY, ui);
export const useUI = () => getContext<UIManager>(KEY);
