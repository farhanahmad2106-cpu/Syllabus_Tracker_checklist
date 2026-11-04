import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Save,
  CheckCircle2,
  Clock,
  AlertCircle,
  Trash2,
  FileText,
  Code,
  ListTodo,
  Sigma,
  BookOpen,
  Eye,
  Edit3,
} from 'lucide-react';
import { fetchTopicNote, saveTopicNote, deleteTopicNote } from '../lib/api';

interface TopicNotesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  syllabusId: string;
  leafId: string | null;
  leafTitle: string;
  onNoteChange?: (leafId: string, hasContent: boolean) => void;
}

type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

export const TopicNotesDrawer: React.FC<TopicNotesDrawerProps> = ({
  isOpen,
  onClose,
  syllabusId,
  leafId,
  leafTitle,
  onNoteChange,
}) => {
  const [content, setContent] = useState<string>('');
  const [initialLoading, setInitialLoading] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [viewMode, setViewMode] = useState<'edit' | 'preview' | 'split'>('edit');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const lastSavedContentRef = useRef<string>('');

  // Fetch note when drawer opens or leafId changes
  useEffect(() => {
    if (!isOpen || !leafId || !syllabusId) {
      return;
    }

    let isMounted = true;
    setInitialLoading(true);
    setSaveStatus('saved');
    setErrorMessage(null);

    fetchTopicNote(syllabusId, leafId)
      .then((note) => {
        if (isMounted) {
          const loadedContent = note?.content || '';
          setContent(loadedContent);
          lastSavedContentRef.current = loadedContent;
          setInitialLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Failed to load note:', err);
          setContent('');
          lastSavedContentRef.current = '';
          setInitialLoading(false);
        }
      });

    return () => {
      isMounted = false;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [isOpen, syllabusId, leafId]);

  // Persist note to server
  const performSave = useCallback(
    async (textToSave: string) => {
      if (!leafId || !syllabusId) return;
      if (textToSave === lastSavedContentRef.current) {
        setSaveStatus('saved');
        return;
      }

      setSaveStatus('saving');
      setErrorMessage(null);
      try {
        await saveTopicNote(syllabusId, leafId, textToSave);
        lastSavedContentRef.current = textToSave;
        setSaveStatus('saved');
        onNoteChange?.(leafId, textToSave.trim().length > 0);
      } catch (err: unknown) {
        console.error('Failed to auto-save note:', err);
        setSaveStatus('error');
        setErrorMessage(err instanceof Error ? err.message : 'Failed to save note');
      }
    },
    [leafId, syllabusId, onNoteChange]
  );

  // Handle textarea change with 800ms debounce
  const handleContentChange = (newVal: string) => {
    if (newVal.length > 50000) return;
    setContent(newVal);
    setSaveStatus('unsaved');

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      performSave(newVal);
    }, 800);
  };

  // Quick insertion helpers
  const insertTemplate = (template: string) => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const textBefore = content.substring(0, start);
    const textAfter = content.substring(end);

    const updated = textBefore + template + textAfter;
    handleContentChange(updated);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + template.length, start + template.length);
    }, 50);
  };

  // Delete / Clear note
  const handleDeleteNote = async () => {
    if (!leafId || !syllabusId) return;
    if (!window.confirm('Are you sure you want to clear this note? This action cannot be undone.')) {
      return;
    }

    try {
      await deleteTopicNote(syllabusId, leafId);
      setContent('');
      lastSavedContentRef.current = '';
      setSaveStatus('saved');
      onNoteChange?.(leafId, false);
    } catch (err: unknown) {
      console.error('Failed to delete note:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to delete note');
    }
  };

  // Safe markdown preview renderer
  const renderMarkdown = (text: string) => {
    if (!text.trim()) {
      return <div className="text-gray-400 italic">No notes written yet. Start typing or use quick templates above.</div>;
    }

    // Split text into lines for block rendering
    const lines = text.split('\n');
    return (
      <div className="space-y-2 text-sm text-gray-800 leading-relaxed font-sans">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (trimmed.startsWith('# ')) {
            return (
              <h1 key={idx} className="text-xl font-bold text-gray-900 border-b pb-1 mt-3 mb-1">
                {trimmed.substring(2)}
              </h1>
            );
          }
          if (trimmed.startsWith('## ')) {
            return (
              <h2 key={idx} className="text-lg font-bold text-gray-900 border-b pb-1 mt-2 mb-1">
                {trimmed.substring(3)}
              </h2>
            );
          }
          if (trimmed.startsWith('### ')) {
            return (
              <h3 key={idx} className="text-base font-semibold text-gray-900 mt-2 mb-1">
                {trimmed.substring(4)}
              </h3>
            );
          }
          if (trimmed.startsWith('> [!NOTE]') || trimmed.startsWith('>')) {
            return (
              <blockquote
                key={idx}
                className="border-l-4 border-blue-500 bg-blue-50/60 px-3 py-1.5 my-1 text-blue-900 rounded-r text-sm"
              >
                {trimmed.replace(/^>\s*(\[!NOTE\])?/, '').trim()}
              </blockquote>
            );
          }
          if (trimmed.startsWith('- [x] ') || trimmed.startsWith('- [ ] ')) {
            const isChecked = trimmed.startsWith('- [x] ');
            return (
              <div key={idx} className="flex items-center gap-2 pl-2">
                <input
                  type="checkbox"
                  checked={isChecked}
                  readOnly
                  className="rounded text-blue-600 focus:ring-0"
                />
                <span className={isChecked ? 'line-through text-gray-400' : 'text-gray-700'}>
                  {trimmed.substring(6)}
                </span>
              </div>
            );
          }
          if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            return (
              <div key={idx} className="flex items-start gap-2 pl-3">
                <span className="text-gray-400 font-bold">•</span>
                <span className="text-gray-700">{trimmed.substring(2)}</span>
              </div>
            );
          }
          if (trimmed.startsWith('$$') && trimmed.endsWith('$$') && trimmed.length > 3) {
            return (
              <div
                key={idx}
                className="bg-purple-50 border border-purple-200 text-purple-950 font-mono text-center p-2 rounded my-1"
              >
                {trimmed.substring(2, trimmed.length - 2).trim()}
              </div>
            );
          }
          if (trimmed.startsWith('```')) {
            return (
              <pre
                key={idx}
                className="bg-gray-900 text-gray-100 p-2.5 rounded font-mono text-xs overflow-x-auto my-1"
              >
                {trimmed}
              </pre>
            );
          }
          if (!trimmed) {
            return <div key={idx} className="h-2" />;
          }

          return <p key={idx}>{line}</p>;
        })}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end">
      <div
        className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out border-l border-gray-200"
        role="dialog"
        aria-modal="true"
        aria-label="Topic Notes Drawer"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/80">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-gray-900 truncate">
                Study Notes &amp; Cheat Sheet
              </h2>
              <p className="text-xs text-gray-500 truncate" title={leafTitle}>
                {leafTitle}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Close notes drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-2.5 border-b border-gray-100 bg-white flex flex-wrap items-center justify-between gap-2 text-xs">
          {/* Quick Insert Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-gray-400 font-medium mr-1 text-[11px]">Insert:</span>
            <button
              type="button"
              onClick={() => insertTemplate('\n> [!NOTE]\n> ')}
              className="px-2 py-1 bg-gray-100 hover:bg-blue-50 hover:text-blue-700 text-gray-700 rounded flex items-center gap-1 transition-colors"
              title="Insert Note Block"
            >
              <BookOpen className="w-3.5 h-3.5" /> Note
            </button>
            <button
              type="button"
              onClick={() => insertTemplate('\n$$ \n$$\n')}
              className="px-2 py-1 bg-gray-100 hover:bg-purple-50 hover:text-purple-700 text-gray-700 rounded flex items-center gap-1 transition-colors"
              title="Insert Math/Formula Block"
            >
              <Sigma className="w-3.5 h-3.5" /> Formula
            </button>
            <button
              type="button"
              onClick={() => insertTemplate('\n- [ ] ')}
              className="px-2 py-1 bg-gray-100 hover:bg-emerald-50 hover:text-emerald-700 text-gray-700 rounded flex items-center gap-1 transition-colors"
              title="Insert Action Item"
            >
              <ListTodo className="w-3.5 h-3.5" /> Checklist
            </button>
            <button
              type="button"
              onClick={() => insertTemplate('\n```python\n\n```\n')}
              className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded flex items-center gap-1 transition-colors"
              title="Insert Code Block"
            >
              <Code className="w-3.5 h-3.5" /> Code
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200">
            <button
              type="button"
              onClick={() => setViewMode('edit')}
              className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 transition-colors ${
                viewMode === 'edit'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" /> Edit
            </button>
            <button
              type="button"
              onClick={() => setViewMode('preview')}
              className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 transition-colors ${
                viewMode === 'preview'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Eye className="w-3.5 h-3.5" /> Preview
            </button>
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 transition-colors ${
                viewMode === 'split'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Split
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden p-6 flex flex-col">
          {initialLoading ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              <Clock className="w-5 h-5 animate-spin mr-2" /> Loading notes...
            </div>
          ) : (
            <div className="flex-1 flex gap-4 overflow-hidden">
              {/* Editor Pane */}
              {(viewMode === 'edit' || viewMode === 'split') && (
                <div className={`flex flex-col h-full ${viewMode === 'split' ? 'w-1/2' : 'w-full'}`}>
                  <textarea
                    ref={textareaRef}
                    value={content}
                    onChange={(e) => handleContentChange(e.target.value)}
                    placeholder="Write Markdown study notes, lecture summaries, key equations, or cheat sheet concepts..."
                    className="flex-1 w-full p-4 border border-gray-200 rounded-lg font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent leading-relaxed bg-gray-50/40"
                    maxLength={50000}
                    aria-label="Markdown Note Editor"
                  />
                </div>
              )}

              {/* Preview Pane */}
              {(viewMode === 'preview' || viewMode === 'split') && (
                <div
                  className={`flex flex-col h-full overflow-y-auto p-4 border border-gray-100 rounded-lg bg-gray-50/60 ${
                    viewMode === 'split' ? 'w-1/2' : 'w-full'
                  }`}
                  aria-label="Markdown Preview"
                >
                  {renderMarkdown(content)}
                </div>
              )}
            </div>
          )}

          {errorMessage && (
            <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded flex items-center gap-1.5 border border-red-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Footer / Status Bar */}
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-4">
            {/* Auto-save Status Indicator */}
            <div className="flex items-center gap-1.5 font-medium">
              {saveStatus === 'saved' && (
                <span className="flex items-center gap-1 text-emerald-600">
                  <CheckCircle2 className="w-4 h-4" /> All changes saved
                </span>
              )}
              {saveStatus === 'saving' && (
                <span className="flex items-center gap-1 text-blue-600">
                  <Clock className="w-4 h-4 animate-spin" /> Saving...
                </span>
              )}
              {saveStatus === 'unsaved' && (
                <span className="flex items-center gap-1 text-amber-600">
                  <Save className="w-4 h-4" /> Unsaved changes
                </span>
              )}
              {saveStatus === 'error' && (
                <span className="flex items-center gap-1 text-red-600">
                  <AlertCircle className="w-4 h-4" /> Save failed
                </span>
              )}
            </div>

            {/* Character Count */}
            <span className="text-gray-400 border-l border-gray-200 pl-4">
              {content.length.toLocaleString()} / 50,000 characters
            </span>
          </div>

          <div className="flex items-center gap-2">
            {content.length > 0 && (
              <button
                type="button"
                onClick={handleDeleteNote}
                className="px-2.5 py-1 text-red-600 hover:bg-red-50 rounded flex items-center gap-1 transition-colors"
                title="Clear entire note"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear Note
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded font-medium transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
