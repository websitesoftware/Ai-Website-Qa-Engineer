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
 * Reads one static content block by key from content.json, falling back to
 * the given defaults if the key isn't present. Screens should call this for
 * editorial copy/icons/images only — never for live scan data, which stays
 * fully code-driven.
 */
export function useContent(key: string, defaults: { text: string; icon?: string; imageUrl?: string | null }) {
  const block = blocks[key];
  return {
    text: block?.text ?? defaults.text,
    icon: block?.icon ?? defaults.icon ?? '',
    imageUrl: block ? block.imageUrl : defaults.imageUrl ?? null,
  };
}
