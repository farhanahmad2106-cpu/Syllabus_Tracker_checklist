import React, { useState, useEffect, useRef } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Bot,
  CheckCircle2,
  ExternalLink,
  HelpCircle,
  Loader2,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import { askStudyAssistant } from '../lib/api';
import type { GroundedStudyAnswer, StudyCitation } from '../types/syllabus';

interface StudyAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  syllabusId: string;
  initialLeafId?: string | null;
  initialLeafTitle?: string | null;
  onNavigateToLeaf?: (leafId: string) => void;
}

export const StudyAssistantDrawer: React.FC<StudyAssistantDrawerProps> = ({
  isOpen,
  onClose,
  syllabusId,
  initialLeafId = null,
  initialLeafTitle = null,
  onNavigateToLeaf,
}) => {
  const [question, setQuestion] = useState('');
  const [scopedLeafId, setScopedLeafId] = useState<string | null>(initialLeafId);
  const [scopedLeafTitle, setScopedLeafTitle] = useState<string | null>(initialLeafTitle);
  const [isLoading, setIsLoading] = useState(false);
  const [answer, setAnswer] = useState<GroundedStudyAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setScopedLeafId(initialLeafId);
      setScopedLeafTitle(initialLeafTitle);
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, initialLeafId, initialLeafTitle]);

  // Handle ESC key to dismiss drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = async (overrideQuestion?: string) => {
    const q = (overrideQuestion ?? question).trim();
    if (!q || isLoading || !syllabusId) return;

    setIsLoading(true);
    setError(null);
    try {
      const resp = await askStudyAssistant(syllabusId, {
        question: q,
        leaf_id: scopedLeafId || undefined,
      });
      setAnswer(resp);
    } catch (err: any) {
      setError(err?.message || 'Failed to retrieve answer from Study Assistant.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCitationClick = (citation: StudyCitation) => {
    if (onNavigateToLeaf && citation.leaf_id) {
      onNavigateToLeaf(citation.leaf_id);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true" aria-label="AI Study Assistant">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <aside
          ref={drawerRef}
          className="w-screen max-w-md bg-[var(--bg-surface)] border-l border-[var(--border-subtle)] shadow-2xl flex flex-col justify-between transition-transform duration-200"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-1.5 truncate">
                  <span>AI Study Assistant</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    Local RAG
                  </span>
                </h3>
                <p className="text-[11px] text-[var(--text-muted)] truncate">Evidence-grounded syllabus tutoring</p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close Study Assistant"
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Scope Indicator Banner */}
          <div className="px-4 py-2 border-b border-[var(--border-subtle)] bg-[var(--bg-canvas)] flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[var(--text-muted)]">Scope:</span>
              {scopedLeafTitle ? (
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 truncate" title={scopedLeafTitle}>
                  {scopedLeafTitle}
                </span>
              ) : (
                <span className="font-medium text-[var(--text-secondary)]">All Enrolled Courses</span>
              )}
            </div>
            {scopedLeafId && (
              <button
                type="button"
                onClick={() => {
                  setScopedLeafId(null);
                  setScopedLeafTitle(null);
                }}
                className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] underline cursor-pointer ml-2 shrink-0"
              >
                Clear Scope
              </button>
            )}
          </div>

          {/* Main Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 custom-scrollbar">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-600 dark:text-red-400 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex-1">{error}</div>
              </div>
            )}

            {!answer && !isLoading && (
              <div className="py-6 text-center space-y-4">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20">
                  <Bot className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-[var(--text-primary)]">Ask any study question</h4>
                  <p className="text-xs text-[var(--text-muted)] max-w-xs mx-auto">
                    The assistant retrieves exact excerpts from your enrolled syllabus and student notes to provide verified, zero-hallucination answers.
                  </p>
                </div>

                <div className="pt-2 text-left space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Suggested Questions
                  </span>
                  <div className="space-y-1.5">
                    {[
                      'What are the core concepts and topics covered?',
                      'Explain the key requirements and prerequisites.',
                      'What practical skills or lab work are specified?',
                    ].map((sug, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setQuestion(sug);
                          handleSubmit(sug);
                        }}
                        className="w-full text-left text-xs p-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-hover)] hover:border-emerald-500/40 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer flex items-center justify-between"
                      >
                        <span className="truncate">{sug}</span>
                        <ArrowRight className="w-3 h-3 shrink-0 ml-1.5 text-emerald-500" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {isLoading && (
              <div className="py-12 flex flex-col items-center justify-center space-y-3 text-center">
                <Loader2 className="w-7 h-7 text-emerald-500 animate-spin" />
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-[var(--text-primary)]">Searching Grounded Evidence...</p>
                  <p className="text-[11px] text-[var(--text-muted)]">Querying SQLite FTS5 index and local model</p>
                </div>
              </div>
            )}

            {answer && !isLoading && (
              <div className="space-y-4">
                {/* Answer Status Badge */}
                <div className="flex items-center justify-between">
                  {answer.answer_state === 'supported' && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Supported by Syllabus</span>
                    </span>
                  )}
                  {answer.answer_state === 'partial' && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Partial Evidence</span>
                    </span>
                  )}
                  {answer.answer_state === 'insufficient_evidence' && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-500/10 text-[var(--text-muted)] border border-gray-500/30">
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>Insufficient Evidence — Abstained</span>
                    </span>
                  )}
                </div>

                {/* Answer Content */}
                <div className="p-4 rounded-2xl bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-xs sm:text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">
                  {answer.answer_markdown}
                </div>

                {/* Verified Citations Section */}
                {answer.citations && answer.citations.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)]">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        Verified Evidence ({answer.citations.length})
                      </span>
                    </div>

                    <div className="space-y-2">
                      {answer.citations.map((cite, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] space-y-1.5 text-xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1 font-semibold text-[11px] text-emerald-600 dark:text-emerald-400">
                              <BookOpen className="w-3 h-3" />
                              <span>{cite.citation_label}</span>
                            </span>

                            {onNavigateToLeaf && cite.leaf_id && (
                              <button
                                type="button"
                                onClick={() => handleCitationClick(cite)}
                                className="inline-flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                                title="Navigate to this topic in the curriculum tree"
                              >
                                <span>View in Tree</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>

                          <blockquote className="border-l-2 border-emerald-500/40 pl-2 italic text-[var(--text-secondary)] text-[11px] leading-relaxed">
                            "{cite.source_quote}"
                          </blockquote>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Input Form */}
          <div className="p-4 border-t border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] shrink-0 space-y-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit();
              }}
              className="relative flex items-center"
            >
              <textarea
                ref={inputRef}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder={
                  scopedLeafTitle
                    ? `Ask about ${scopedLeafTitle}...`
                    : 'Ask about any course concept or topic...'
                }
                rows={2}
                disabled={isLoading}
                className="w-full text-xs sm:text-sm p-3 pr-10 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-hidden focus:ring-2 focus:ring-emerald-500/50 resize-none"
              />
              <button
                type="submit"
                disabled={isLoading || !question.trim()}
                aria-label="Send question"
                className="absolute right-2.5 p-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white dark:text-gray-950 transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
            <p className="text-[10px] text-[var(--text-muted)] text-center">
              Press Enter to ask &bull; Grounded strictly in official curriculum evidence & student notes
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
};
