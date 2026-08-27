'use client';
import contentData from '../lib/content.json';

interface ContentBlock {
  tab: string;
  label: string;
  text: string;
  icon: string;
  imageUrl: string | null;
}

const blocks = contentData as Record<string, ContentBlock>;

/**
 * Reads one content block by key from content.json, falling back to the
 * given defaults if the key isn't present. The block's `text` may contain
 * `{placeholder}` tokens; when `vars` is passed, each token is substituted
 * with the matching value (left untouched if `vars` doesn't have that key)
 * so live/computed values (counts, percentages, names) still flow through a
 * single editable template instead of a hardcoded string.
 *
 * Plain data lookup, not a stateful hook — safe to call unconditionally OR
 * inside loops/callbacks (e.g. `.map()`, event handlers) where a real hook
 * couldn't be. `useContent` below is a thin wrapper kept for call sites at
 * component top level, where the `use`-prefixed name reads naturally.
 */
export function getContent(
  key: string,
  defaults: { text: string; icon?: string; imageUrl?: string | null },
  vars?: Record<string, string | number>
) {
  const block = blocks[key];
  let text = block?.text ?? defaults.text;
  if (vars) {
    text = text.replace(/\{(\w+)\}/g, (match, token) => (token in vars ? String(vars[token]) : match));
  }
  return {
    text,
    icon: block?.icon ?? defaults.icon ?? '',
    imageUrl: block ? block.imageUrl : defaults.imageUrl ?? null,
  };
}

export function useContent(
  key: string,
  defaults: { text: string; icon?: string; imageUrl?: string | null },
  vars?: Record<string, string | number>
) {
  return getContent(key, defaults, vars);
}
