"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import type { JSONContent } from "@tiptap/core";
import { Bold, Heading2, Heading3, ImagePlus, Italic, Link2, List, ListOrdered, Quote, Redo2, Strikethrough, Undo2 } from "lucide-react";
import { createEditorExtensions } from "@/lib/editor-extensions";

type Props = { value: JSONContent; onChange: (value: JSONContent) => void; disabled?: boolean; onSelectImage: (insert: (image: { mediaId: string; src: string; alt: string; caption: string }) => void) => void };

function Tool({ label, onClick, active, children, disabled }: { label: string; onClick: () => void; active?: boolean; disabled?: boolean; children: React.ReactNode }) {
  return <button type="button" title={label} aria-label={label} onClick={onClick} disabled={disabled} className={`grid size-9 place-items-center rounded-lg transition-colors disabled:opacity-40 ${active ? "bg-forest text-white" : "text-ink-muted hover:bg-paper-100 hover:text-forest"}`}>{children}</button>;
}

export function RichTextEditor({ value, onChange, disabled = false, onSelectImage }: Props) {
  const editor = useEditor({
    extensions: createEditorExtensions(),
    content: value,
    immediatelyRender: false,
    editable: !disabled,
    onUpdate: ({ editor: updated }) => onChange(updated.getJSON()),
    editorProps: { attributes: { class: "cms-prose min-h-[320px] px-4 py-5 text-base leading-8 text-ink focus:outline-none", dir: "ltr", lang: "bn-BD", "aria-label": "বাংলা সংবাদ মূল লেখা" } },
  });
  if (!editor) return <div className="min-h-80 animate-pulse rounded-xl bg-paper-100" aria-label="এডিটর লোড হচ্ছে" />;
  const insertImage = (image: { mediaId: string; src: string; alt: string; caption: string }) => editor.chain().focus().insertContent({ type: "image", attrs: { src: image.src, alt: image.alt, title: image.caption, caption: image.caption, mediaId: image.mediaId } }).run();
  return <section className="overflow-hidden rounded-2xl border border-line bg-white">
    <div className="flex flex-wrap items-center gap-1 border-b border-line bg-paper-50 p-2">
      <Tool label="গাঢ়" active={editor.isActive("bold")} disabled={disabled} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={16} /></Tool>
      <Tool label="তির্যক" active={editor.isActive("italic")} disabled={disabled} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={16} /></Tool>
      <Tool label="কাটা দাগ" active={editor.isActive("strike")} disabled={disabled} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough size={16} /></Tool>
      <span className="mx-1 h-6 w-px bg-line" />
      <Tool label="উপশিরোনাম" active={editor.isActive("heading", { level: 2 })} disabled={disabled} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={17} /></Tool>
      <Tool label="ছোট উপশিরোনাম" active={editor.isActive("heading", { level: 3 })} disabled={disabled} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 size={16} /></Tool>
      <Tool label="বুলেট তালিকা" active={editor.isActive("bulletList")} disabled={disabled} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={16} /></Tool>
      <Tool label="ক্রমিক তালিকা" active={editor.isActive("orderedList")} disabled={disabled} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={16} /></Tool>
      <Tool label="উদ্ধৃতি" active={editor.isActive("blockquote")} disabled={disabled} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote size={16} /></Tool>
      <span className="mx-1 h-6 w-px bg-line" />
      <Tool label="লিংক যোগ করুন" active={editor.isActive("link")} disabled={disabled} onClick={() => {
        const previous = editor.getAttributes("link").href as string | undefined;
        const url = window.prompt("HTTPS লিংক দিন", previous);
        if (url === null) return;
        if (!/^https:\/\//i.test(url)) { window.alert("নিরাপদ HTTPS লিংক দিন"); return; }
        editor.chain().focus().extendMarkRange("link").setLink({ href: url, target: "_blank", rel: "nofollow noopener noreferrer" }).run();
      }}><Link2 size={16} /></Tool>
      <Tool label="মিডিয়া লাইব্রেরি থেকে ছবি" disabled={disabled} onClick={() => onSelectImage(insertImage)}><ImagePlus size={16} /></Tool>
      <span className="mx-1 h-6 w-px bg-line" />
      <Tool label="পূর্বাবস্থা" disabled={disabled || !editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}><Undo2 size={16} /></Tool>
      <Tool label="পুনরায়" disabled={disabled || !editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}><Redo2 size={16} /></Tool>
    </div>
    <EditorContent editor={editor} />
    <div className="border-t border-line bg-paper-50 px-4 py-2 text-xs text-ink-muted">বাংলা ও ইংরেজি একসঙ্গে লিখুন · Enter: নতুন অনুচ্ছেদ · ছবির জন্য মিডিয়া লাইব্রেরি ব্যবহার করুন</div>
  </section>;
}
