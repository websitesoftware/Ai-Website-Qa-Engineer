'use client';
import React, { useMemo, useState } from 'react';
import { CaretRight } from '@phosphor-icons/react';

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

function attrsOf(el: Element): { name: string; value: string }[] {
  return Array.from(el.attributes).map((a) => ({ name: a.name, value: a.value }));
}

function onlyTextChild(el: Element): string | null {
  if (el.childNodes.length === 0) return '';
  const nonEmpty = Array.from(el.childNodes).filter(
    (n) => !(n.nodeType === Node.TEXT_NODE && !n.textContent?.trim())
  );
  if (nonEmpty.length === 1 && nonEmpty[0].nodeType === Node.TEXT_NODE) {
    return nonEmpty[0].textContent || '';
  }
  if (nonEmpty.length === 0) return '';
  return null;
}

function elementChildren(el: Element): Element[] {
  return Array.from(el.children);
}

const Tag: React.FC<{ name: string; attrs: { name: string; value: string }[] }> = ({ name, attrs }) => (
  <>
    <span className="text-slate-400">&lt;</span>
    <span className="text-[#881280] dark:text-[#e8a3d6]">{name}</span>
    {attrs.map((a) => (
      <span key={a.name}>
        {' '}
        <span className="text-[#994500] dark:text-[#dcae6c]">{a.name}</span>
        <span className="text-slate-400">=&quot;</span>
        <span className="text-[#1a1aa6] dark:text-[#9cdcfe] break-all">{a.value}</span>
        <span className="text-slate-400">&quot;</span>
      </span>
    ))}
    <span className="text-slate-400">&gt;</span>
  </>
);

const NodeRow: React.FC<{
  el: Element;
  path: string;
  depth: number;
  expanded: Set<string>;
  toggle: (path: string) => void;
  selected: string | null;
  onSelect: (path: string) => void;
}> = ({ el, path, depth, expanded, toggle, selected, onSelect }) => {
  const name = el.tagName.toLowerCase();
  const attrs = attrsOf(el);
  const isVoid = VOID_ELEMENTS.has(name);
  const children = elementChildren(el);
  const textOnly = onlyTextChild(el);
  const isOpen = expanded.has(path);
  const isSelected = selected === path;

  // Leaf case: void element, or an element whose only content is plain
  // text (or nothing) — render fully on one line, no expand arrow, just
  // like DevTools collapses simple leaves.
  if (isVoid || (children.length === 0 && textOnly !== null)) {
    return (
      <div
        onClick={(e) => {
          e.stopPropagation();
          onSelect(path);
        }}
        className={`pl-4 py-0.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 ${isSelected ? 'bg-indigo-50 dark:bg-indigo-950/40 outline outline-1 outline-indigo-300 dark:outline-indigo-700' : ''}`}
        style={{ paddingLeft: depth * 14 + 16 }}
      >
        <Tag name={name} attrs={attrs} />
        {!isVoid && textOnly && <span className="text-slate-700 dark:text-slate-300">{textOnly.trim().slice(0, 120)}</span>}
        {!isVoid && (
          <>
            <span className="text-slate-400">&lt;/</span>
            <span className="text-[#881280] dark:text-[#e8a3d6]">{name}</span>
            <span className="text-slate-400">&gt;</span>
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      <div
        onClick={(e) => {
          e.stopPropagation();
          onSelect(path);
          toggle(path);
        }}
        className={`flex items-start gap-0.5 py-0.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 ${isSelected ? 'bg-indigo-50 dark:bg-indigo-950/40 outline outline-1 outline-indigo-300 dark:outline-indigo-700' : ''}`}
        style={{ paddingLeft: depth * 14 }}
      >
        <CaretRight className={`w-3 h-3 mt-0.5 shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
        <div>
          <Tag name={name} attrs={attrs} />
          {!isOpen && <span className="text-slate-400">…</span>}
          {!isOpen && (
            <>
              <span className="text-slate-400">&lt;/</span>
              <span className="text-[#881280] dark:text-[#e8a3d6]">{name}</span>
              <span className="text-slate-400">&gt;</span>
            </>
          )}
        </div>
      </div>

      {isOpen && (
        <>
          {children.map((child, i) => (
            <NodeRow
              key={i}
              el={child}
              path={`${path}-${i}`}
              depth={depth + 1}
              expanded={expanded}
              toggle={toggle}
              selected={selected}
              onSelect={onSelect}
            />
          ))}
          <div className="text-slate-400" style={{ paddingLeft: depth * 14 }}>
            &lt;/<span className="text-[#881280] dark:text-[#e8a3d6]">{name}</span>&gt;
          </div>
        </>
      )}
    </div>
  );
};

export const DomTreeView: React.FC<{ html: string }> = ({ html }) => {
  const root = useMemo(() => {
    if (!html) return null;
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      return doc.documentElement;
    } catch {
      return null;
    }
  }, [html]);

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(['0', '0-0', '0-1']));
  const [selected, setSelected] = useState<string | null>(null);

  const toggle = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  if (!html) return <p className="text-slate-400 font-sans p-3">Loading DOM…</p>;
  if (!root) return <p className="text-slate-400 font-sans p-3">Could not parse this page&apos;s HTML.</p>;

  return (
    <div className="py-1 select-text">
      <div className="text-slate-400" style={{ paddingLeft: 0 }}>&lt;!DOCTYPE html&gt;</div>
      <NodeRow el={root} path="0" depth={0} expanded={expanded} toggle={toggle} selected={selected} onSelect={setSelected} />
    </div>
  );
};
