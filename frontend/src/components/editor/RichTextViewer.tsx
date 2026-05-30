import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { PROSE } from './prose';

export function RichTextViewer({ html }: { html: string }) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: html,
    editable: false,
    immediatelyRender: false,
  });

  if (!editor) return null;

  return <EditorContent editor={editor} className={PROSE} />;
}
