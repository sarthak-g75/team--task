import { useEditor, useEditorState, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Italic, Strikethrough, Heading2, List, ListOrdered, Code } from 'lucide-react';
import type { ComponentType } from 'react';
import { PROSE } from './prose';
import { cn } from '@/lib/utils';

function ToolbarButton({
  onClick,
  active,
  label,
  icon: Icon,
}: {
  onClick: () => void;
  active: boolean;
  label: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        'rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
        active && 'bg-primary/15 text-primary',
      )}
    >
      <Icon className="size-3.5" />
    </button>
  );
}

export function RichTextEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value,
    immediatelyRender: false,
    editorProps: { attributes: { class: cn(PROSE, 'min-h-28 px-3 py-2 outline-none') } },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e?.isActive('bold') ?? false,
      italic: e?.isActive('italic') ?? false,
      strike: e?.isActive('strike') ?? false,
      heading: e?.isActive('heading', { level: 2 }) ?? false,
      bulletList: e?.isActive('bulletList') ?? false,
      orderedList: e?.isActive('orderedList') ?? false,
      codeBlock: e?.isActive('codeBlock') ?? false,
    }),
  });

  if (!editor) return null;

  return (
    <div className="rounded-lg border bg-background">
      <div className="flex flex-wrap items-center gap-0.5 border-b px-1.5 py-1">
        <ToolbarButton icon={Bold} label="Bold" active={state?.bold ?? false} onClick={() => editor.chain().focus().toggleBold().run()} />
        <ToolbarButton icon={Italic} label="Italic" active={state?.italic ?? false} onClick={() => editor.chain().focus().toggleItalic().run()} />
        <ToolbarButton icon={Strikethrough} label="Strikethrough" active={state?.strike ?? false} onClick={() => editor.chain().focus().toggleStrike().run()} />
        <ToolbarButton icon={Heading2} label="Heading" active={state?.heading ?? false} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
        <ToolbarButton icon={List} label="Bullet list" active={state?.bulletList ?? false} onClick={() => editor.chain().focus().toggleBulletList().run()} />
        <ToolbarButton icon={ListOrdered} label="Numbered list" active={state?.orderedList ?? false} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
        <ToolbarButton icon={Code} label="Code block" active={state?.codeBlock ?? false} onClick={() => editor.chain().focus().toggleCodeBlock().run()} />
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
