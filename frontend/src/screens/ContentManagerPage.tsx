'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import { BackendContentBlock } from '../lib/types';
import { useContentAdmin } from '../context/ContentContext';
import { useToast } from '../context/ToastContext';

// Fixed display order for the group tabs — falls back to whatever else
// shows up (e.g. a future tab) appended at the end.
const TAB_ORDER = ['Dashboard', 'Tests', 'Scan Results', 'Automation', 'Settings', 'Global'];

// Every Phosphor icon name already used somewhere in this app — a real,
// working seed list for the picker rather than an invented/unverified one.
// Free-text entry (below) still covers any other "ph-*" name.
const KNOWN_ICONS = [
  'ph-alarm', 'ph-arrow-clockwise', 'ph-arrow-right', 'ph-bug', 'ph-calendar-check',
  'ph-caret-right-bold', 'ph-chart-line-up', 'ph-check', 'ph-check-circle', 'ph-device-mobile',
  'ph-devices', 'ph-download-simple', 'ph-file-doc', 'ph-file-pdf', 'ph-file-text', 'ph-fire',
  'ph-flag', 'ph-flask', 'ph-gauge', 'ph-gear', 'ph-git-branch', 'ph-github-logo', 'ph-globe',
  'ph-globe-hemisphere-west', 'ph-hourglass', 'ph-image', 'ph-info', 'ph-layout', 'ph-link',
  'ph-lock-key', 'ph-magnifying-glass', 'ph-paint-bucket', 'ph-pencil-simple-line', 'ph-play-circle',
  'ph-plugs', 'ph-plus-bold', 'ph-robot', 'ph-scan', 'ph-shield-check', 'ph-slack-logo',
  'ph-sparkle', 'ph-spinner-gap', 'ph-squares-four', 'ph-table', 'ph-trash', 'ph-tray',
  'ph-trend-down', 'ph-trend-up', 'ph-user-circle', 'ph-user-focus', 'ph-users-three',
  'ph-warning', 'ph-warning-circle', 'ph-x', 'ph-x-circle',
];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const ContentBlockCard: React.FC<{ block: BackendContentBlock; onSaved: () => void }> = ({ block, onSaved }) => {
  const { showToast } = useToast();
  const [text, setText] = useState(block.text);
  const [icon, setIcon] = useState(block.icon);
  const [iconQuery, setIconQuery] = useState('');
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const dirty = text !== block.text || icon !== block.icon;

  const filteredIcons = useMemo(() => {
    const term = iconQuery.trim().toLowerCase();
    return term ? KNOWN_ICONS.filter((i) => i.includes(term)) : KNOWN_ICONS;
  }, [iconQuery]);

  const save = async () => {
    setSaving(true);
    try {
      await api.content.update(block.key, { text, icon });
      showToast('Content updated', 'success');
      onSaved();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not save content', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    setUploadingImage(true);
    try {
      const base64 = await fileToBase64(file);
      await api.content.uploadImage(block.key, base64);
      showToast('Image updated', 'success');
      onSaved();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not upload image', 'error');
    } finally {
      setUploadingImage(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{block.label}</p>
        {block.updatedAt && (
          <p className="text-[10px] text-slate-400 dark:text-slate-500">Edited {new Date(block.updatedAt).toLocaleString()}</p>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Text</label>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500"
          />
        </div>

        <div className="relative space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Icon</label>
          <button
            type="button"
            onClick={() => setIconPickerOpen((v) => !v)}
            className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white cursor-pointer min-w-40"
          >
            <i className={`ph ${icon} text-indigo-500`}></i>
            <span className="truncate">{icon || 'Choose icon'}</span>
          </button>

          {iconPickerOpen && (
            <div className="absolute z-20 top-full mt-1 left-0 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-2">
              <input
                type="text"
                autoFocus
                placeholder="Search or type ph-icon-name..."
                value={iconQuery}
                onChange={(e) => setIconQuery(e.target.value)}
                className="w-full px-2.5 py-1.5 border rounded-lg text-xs bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white focus:outline-none mb-2"
              />
              <div className="grid grid-cols-5 gap-1 max-h-48 overflow-y-auto">
                {filteredIcons.map((i) => (
                  <button
                    key={i}
                    type="button"
                    title={i}
                    onClick={() => {
                      setIcon(i);
                      setIconPickerOpen(false);
                      setIconQuery('');
                    }}
                    className={`p-2 rounded-lg flex items-center justify-center cursor-pointer ${
                      icon === i ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900'
                    }`}
                  >
                    <i className={`ph ${i} text-lg`}></i>
                  </button>
                ))}
              </div>
              {iconQuery.trim() && !KNOWN_ICONS.includes(iconQuery.trim()) && (
                <button
                  type="button"
                  onClick={() => {
                    setIcon(iconQuery.trim());
                    setIconPickerOpen(false);
                    setIconQuery('');
                  }}
                  className="w-full mt-1.5 text-left px-2 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  Use &ldquo;{iconQuery.trim()}&rdquo; directly
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          {block.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`${api.screenshotUrl(block.imageUrl)}`} alt="" className="w-10 h-10 rounded-lg object-cover border border-slate-200 dark:border-slate-700" />
          ) : (
            <div className="w-10 h-10 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center text-slate-300 dark:text-slate-600">
              <i className="ph ph-image text-lg"></i>
            </div>
          )}
          <label className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer">
            {uploadingImage ? 'Uploading...' : block.imageUrl ? 'Replace image' : 'Add image'}
            <input
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              className="hidden"
              disabled={uploadingImage}
              onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
            />
          </label>
        </div>

        <button
          type="button"
          onClick={save}
          disabled={!dirty || saving}
          className="ml-auto px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 dark:disabled:bg-indigo-900/40 text-white text-xs font-bold cursor-pointer"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
};

export const ContentManagerPage: React.FC = () => {
  const { blocks, loading, refetch } = useContentAdmin();
  const [activeGroup, setActiveGroup] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const groups = new Map<string, BackendContentBlock[]>();
    for (const block of Object.values(blocks)) {
      if (!groups.has(block.tab)) groups.set(block.tab, []);
      groups.get(block.tab)!.push(block);
    }
    const entries = Array.from(groups.entries());
    entries.sort((a, b) => {
      const ai = TAB_ORDER.indexOf(a[0]);
      const bi = TAB_ORDER.indexOf(b[0]);
      return (ai === -1 ? TAB_ORDER.length : ai) - (bi === -1 ? TAB_ORDER.length : bi);
    });
    return entries;
  }, [blocks]);

  useEffect(() => {
    if (grouped.length === 0) return;
    if (!activeGroup || !grouped.some(([tab]) => tab === activeGroup)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- keeps the active tab valid once data loads, mirrors DeviceLabPage's brand-tab pattern
      setActiveGroup(grouped[0][0]);
    }
  }, [grouped, activeGroup]);

  const activeBlocks = grouped.find(([tab]) => tab === activeGroup)?.[1] ?? [];

  return (
    <div className="space-y-6 animate-fade-in w-full">
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Content Manager</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Edit the text, icons, and images shown across the Dashboard, Tests, Scan Results, Automation, and Settings tabs.
          This does not affect live scan data — only static labels and visuals.
        </p>
      </div>

      {loading && <p className="text-xs text-slate-400">Loading editable content...</p>}

      {!loading && grouped.length === 0 && (
        <p className="text-xs text-slate-400">No editable content blocks yet.</p>
      )}

      {grouped.length > 0 && (
        <div className="flex gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1.5 w-full sm:w-fit relative overflow-x-auto">
          {grouped.map(([tab, tabBlocks]) => {
            const isSelected = activeGroup === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveGroup(tab)}
                className={`relative px-4 py-2 rounded-lg text-sm font-semibold transition-colors shrink-0 whitespace-nowrap ${
                  isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                {isSelected && (
                  <motion.div
                    layoutId="activeContentGroupTabIndicator"
                    className="absolute inset-0 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg -z-10"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                {tab} <span className="text-slate-400 font-normal">({tabBlocks.length})</span>
              </button>
            );
          })}
        </div>
      )}

      {activeGroup && (
        <div key={activeGroup} className="space-y-3">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {activeBlocks.map((block) => (
              <ContentBlockCard key={block.key} block={block} onSaved={refetch} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
