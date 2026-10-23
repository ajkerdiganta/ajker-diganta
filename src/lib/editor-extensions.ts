import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { mergeAttributes } from "@tiptap/core";

export const FigureImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      mediaId: { default: null, parseHTML: (element) => element.getAttribute("data-media-id"), renderHTML: (attrs) => attrs.mediaId ? { "data-media-id": attrs.mediaId } : {} },
      caption: { default: null, parseHTML: (element) => element.querySelector("figcaption")?.textContent ?? null, renderHTML: () => ({}) },
    };
  },
  renderHTML({ HTMLAttributes }) {
    const { caption, ...attributes } = HTMLAttributes;
    const image = ["img", mergeAttributes(this.options.HTMLAttributes, attributes)];
    return caption
      ? ["figure", { class: "article-figure" }, image, ["figcaption", {}, String(caption)]]
      : ["figure", { class: "article-figure" }, image];
  },
}).configure({ inline: false, allowBase64: false, HTMLAttributes: { loading: "lazy" } });

export function createEditorExtensions() {
  return [StarterKit.configure({ heading: { levels: [2, 3] } }), FigureImage];
}
