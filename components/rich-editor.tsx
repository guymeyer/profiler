"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createRoot, type Root } from "react-dom/client";
import { useEditor, EditorContent, ReactRenderer } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Typography from "@tiptap/extension-typography";
import Mention from "@tiptap/extension-mention";
import { Markdown } from "tiptap-markdown";

import {
  MentionList,
  hrefForEntity,
  type EntityChoice,
  type MentionListRef,
} from "@/components/rich-editor/mention-list";
import { cn } from "@/lib/utils";

// Notion-style rich editor. Reads markdown in, emits markdown out on every
// change. Always editable unless `readOnly` is true.

export type { EntityChoice } from "@/components/rich-editor/mention-list";

interface Props {
  initialMarkdown: string;
  onChangeMarkdown?: (md: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  entities?: EntityChoice[];
  className?: string;
}

export function RichEditor({
  initialMarkdown,
  onChangeMarkdown,
  readOnly = false,
  placeholder = "Start writing… @ to mention",
  entities = [],
  className,
}: Props) {
  const entitiesRef = useRef(entities);
  useEffect(() => {
    entitiesRef.current = entities;
  }, [entities]);

  const router = useRouter();
  const wrapperRef = useRef<HTMLDivElement>(null);

  // ProseMirror swallows plain clicks for caret placement, so a mention
  // chip rendered as <a> won't navigate by default in edit mode. Catch
  // clicks on chips here and route through Next.js. Mod-click (cmd/ctrl)
  // and middle-click still fall through to native open-in-new-tab.
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    function onClick(e: MouseEvent) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      const target = e.target as HTMLElement | null;
      const link = target?.closest<HTMLAnchorElement>("a[data-mention-id]");
      if (!link) return;
      const href = link.getAttribute("href");
      if (!href) return;
      e.preventDefault();
      e.stopPropagation();
      router.push(href);
    }
    el.addEventListener("click", onClick);
    return () => el.removeEventListener("click", onClick);
  }, [router]);

  const editor = useEditor({
    immediatelyRender: false,
    editable: !readOnly,
    extensions: [
      StarterKit.configure({ link: false }),
      Markdown.configure({
        html: false,
        tightLists: true,
        bulletListMarker: "-",
        linkify: true,
        breaks: false,
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: "is-editor-empty",
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { class: "rich-link", rel: "noopener noreferrer" },
      }),
      Typography,
      Mention.configure({
        HTMLAttributes: { class: "mention-chip" },
        renderHTML({ options, node }) {
          const id = (node.attrs as { id?: string }).id ?? "";
          const label = (node.attrs as { label?: string }).label ?? id;
          // Look up the entity's kind from the live picker corpus so a
          // mention chip becomes a real clickable link to the right detail
          // page. If the entity is gone (deleted, renamed) we render an
          // un-linked span so the chip still styles correctly.
          const found = entitiesRef.current.find((e) => e.id === id);
          const baseAttrs = {
            ...options.HTMLAttributes,
            "data-mention-id": id,
            "data-mention-label": label,
            "data-mention-kind": found?.kind ?? "",
          };
          if (!found) {
            return ["span", baseAttrs, `@${label}`];
          }
          return [
            "a",
            {
              ...baseAttrs,
              href: hrefForEntity(found.kind, id),
              // The editor consumes pointer events for caret placement —
              // mod-click (cmd/ctrl) opens the link in a new tab without
              // fighting the editor. Plain click stays editable.
              target: "_self",
              rel: "noopener",
            },
            `@${label}`,
          ];
        },
        renderText({ node }) {
          const a = node.attrs as { id?: string; label?: string };
          return `@[${a.label ?? a.id}](${a.id ?? ""})`;
        },
        suggestion: buildMentionSuggestion(() => entitiesRef.current),
      }),
    ],
    content: initialMarkdown ?? "",
    onUpdate: ({ editor }) => {
      if (!onChangeMarkdown) return;
      const storage = editor.storage as { markdown?: { getMarkdown(): string } };
      const md = storage.markdown?.getMarkdown() ?? "";
      onChangeMarkdown(md);
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!readOnly);
  }, [editor, readOnly]);

  const lastInitial = useRef(initialMarkdown);
  useEffect(() => {
    if (!editor) return;
    if (lastInitial.current === initialMarkdown) return;
    lastInitial.current = initialMarkdown;
    editor.commands.setContent(initialMarkdown ?? "");
  }, [editor, initialMarkdown]);

  return (
    <div ref={wrapperRef} className={cn("rich-editor", className)}>
      <EditorContent editor={editor} />
    </div>
  );
}

// Minimal floating-popover suggestion config — no tippy dependency. Uses
// a portal mounted at the body that positions itself against the caret's
// clientRect.
function buildMentionSuggestion(getEntities: () => EntityChoice[]) {
  return {
    items: ({ query }: { query: string }) => {
      const q = query.toLowerCase();
      const ents = getEntities();
      const matches = !q
        ? ents
        : ents.filter(
            (e) =>
              e.label.toLowerCase().includes(q) ||
              e.id.toLowerCase().includes(q) ||
              (e.sub?.toLowerCase().includes(q) ?? false),
          );
      return matches.slice(0, 8);
    },
    render: () => {
      let component: ReactRenderer<MentionListRef> | null = null;
      let portal: { root: Root; container: HTMLElement } | null = null;
      let positioner: HTMLElement | null = null;

      function ensurePortal() {
        if (portal) return portal;
        const container = document.createElement("div");
        container.style.position = "fixed";
        container.style.zIndex = "9999";
        container.style.top = "0";
        container.style.left = "0";
        container.style.pointerEvents = "none";
        document.body.appendChild(container);
        const root = createRoot(container);
        portal = { root, container };
        positioner = document.createElement("div");
        positioner.style.position = "absolute";
        positioner.style.pointerEvents = "auto";
        container.appendChild(positioner);
        return portal;
      }

      function position(rect: DOMRect) {
        if (!positioner) return;
        positioner.style.top = `${rect.bottom + 4}px`;
        positioner.style.left = `${rect.left}px`;
      }

      function render(component: ReactRenderer<MentionListRef>) {
        const p = ensurePortal();
        const el = component.element as HTMLElement;
        if (positioner && el.parentNode !== positioner) {
          positioner.innerHTML = "";
          positioner.appendChild(el);
        }
        void p;
      }

      return {
        onStart: (props: SuggestionProps) => {
          component = new ReactRenderer(MentionList, {
            props,
            editor: props.editor,
          });
          render(component);
          const rect = props.clientRect?.();
          if (rect) position(rect);
        },
        onUpdate(props: SuggestionProps) {
          component?.updateProps(props);
          const rect = props.clientRect?.();
          if (rect) position(rect);
        },
        onKeyDown(props: { event: KeyboardEvent }) {
          if (props.event.key === "Escape") {
            cleanup();
            return true;
          }
          return component?.ref?.onKeyDown?.(props) ?? false;
        },
        onExit() {
          cleanup();
        },
      };

      function cleanup() {
        if (positioner) {
          positioner.innerHTML = "";
        }
        if (portal) {
          portal.root.unmount();
          portal.container.remove();
          portal = null;
          positioner = null;
        }
        component?.destroy();
        component = null;
      }
    },
  };
}

interface SuggestionProps {
  editor: import("@tiptap/core").Editor;
  clientRect?: (() => DOMRect | null) | null;
  command: (props: { id: string; label: string }) => void;
  items: EntityChoice[];
  query: string;
}
