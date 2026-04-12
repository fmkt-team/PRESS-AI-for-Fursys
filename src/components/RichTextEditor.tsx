"use client";

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import { LinkIcon, UnlinkIcon, Bold, Italic } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEffect } from 'react';

interface RichTextEditorProps {
    value: string;
    onChange: (value: string) => void;
    className?: string;
}

const MenuBar = ({ editor }: { editor: any }) => {
    if (!editor) {
        return null
    }

    const setLink = () => {
        const previousUrl = editor.getAttributes('link').href
        const url = window.prompt('URL을 입력하세요:', previousUrl)

        // cancelled
        if (url === null) {
            return
        }

        // empty
        if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run()
            return
        }

        // update link
        let formattedUrl = url;
        if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://') && !formattedUrl.startsWith('mailto:')) {
            formattedUrl = 'https://' + formattedUrl;
        }

        editor.chain().focus().extendMarkRange('link').setLink({ href: formattedUrl }).run()
    }

    return (
        <div className="flex flex-wrap items-center gap-1 p-2 border-b bg-slate-50 border-gray-200">
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleBold().run()}
                disabled={!editor.can().chain().focus().toggleBold().run()}
                className={cn("px-2 py-1 rounded transition-colors", editor.isActive('bold') ? 'bg-slate-300 text-slate-900 border border-slate-400' : 'hover:bg-slate-200 text-slate-700')}
                title="굵게 (Ctrl+B)"
            >
                <Bold className="w-4 h-4" />
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                disabled={!editor.can().chain().focus().toggleItalic().run()}
                className={cn("px-2 py-1 rounded transition-colors", editor.isActive('italic') ? 'bg-slate-300 text-slate-900 border border-slate-400' : 'hover:bg-slate-200 text-slate-700')}
                title="기울임 (Ctrl+I)"
            >
                <Italic className="w-4 h-4" />
            </button>
            <div className="w-px h-5 bg-gray-300 mx-1" />
            <button
                type="button"
                onClick={setLink}
                className={cn("px-3 py-1 flex items-center gap-1.5 rounded text-sm font-medium transition-colors", editor.isActive('link') ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'hover:bg-slate-200 text-slate-700')}
                title="링크 삽입 (드래그 후 클릭)"
            >
                <LinkIcon className="w-4 h-4" /> 링크 추가
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().unsetLink().run()}
                disabled={!editor.isActive('link')}
                className="px-3 py-1 flex items-center gap-1.5 rounded text-sm font-medium hover:bg-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="링크 제거"
            >
                <UnlinkIcon className="w-4 h-4" /> 링크 제거
            </button>

            <span className="ml-auto text-xs text-muted-foreground mr-2">
                원하는 텍스트를 드래그한 후 링크를 추가해보세요.
            </span>
        </div>
    )
}

export default function RichTextEditor({ value, onChange, className }: RichTextEditorProps) {
    const editor = useEditor({
        extensions: [
            StarterKit,
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: 'text-blue-600 underline cursor-pointer decoration-blue-400 decoration-1 underline-offset-2 hover:text-blue-800',
                },
            }),
        ],
        content: value,
        immediatelyRender: false,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
        editorProps: {
            attributes: {
                class: 'prose prose-sm sm:prose-base max-w-none focus:outline-none min-h-[500px] p-8 leading-loose text-[15px] bg-white [&_p]:!mb-6 [&_p]:!leading-relaxed',
            },
        },
    })

    // 외부(부모)에서 value가 크게 바뀌었을 때 에디터 내용 동기화 (주로 최초 생성 시 1회 반영 목적)
    useEffect(() => {
        if (editor && value && editor.getHTML() === '<p></p>' && value !== '<p></p>') {
            // 본문이 아직 비어있고, 넘겨받은 value가 존재할 때만 덮어씀
            // LLM이 텍스트로 보낸 \\n 등의 리터럴 문자를 실제 줄바꿈으로 변환
            let formattedValue = value.replace(/\\n/g, '\n');
            if (!formattedValue.includes('<p>')) {
                // GPT가 평문으로 줬을 경우 HTML로 감싸줌
                formattedValue = formattedValue.split('\n').filter(Boolean).map(line => `<p>${line}</p>`).join('');
            } else {
                // HTML 안의 남은 줄바꿈 문자들을 <br> 태그로 변환
                formattedValue = formattedValue.replace(/\n/g, '<br/>');
            }
            editor.commands.setContent(formattedValue);
            onChange(formattedValue); // 초기 포맷팅 결과를 상위로 다시 전달
        }
    }, [editor, value, onChange]);

    return (
        <div className={cn("border-t flex flex-col group/editor", className)}>
            <MenuBar editor={editor} />
            <EditorContent editor={editor} className="flex-1 w-full bg-white [&>div]:min-h-[600px] cursor-text" />
        </div>
    )
}
