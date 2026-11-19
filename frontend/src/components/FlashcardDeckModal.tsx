import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertCircle,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  RefreshCw,
  RotateCw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  deleteStudyFlashcard,
  fetchStudyFlashcards,
  generateTopicFlashcards,
  submitRevisionReview,
} from '../lib/api';
import type { StudyFlashcard } from '../types/syllabus';

interface FlashcardDeckModalProps {
  isOpen: boolean;
  onClose: () => void;
  syllabusId: string;
  leafId?: string | null;
  leafTitle?: string | null;
  onRatingSubmitted?: () => void;
}

export const FlashcardDeckModal: React.FC<FlashcardDeckModalProps> = ({
  isOpen,
  onClose,
  syllabusId,
  leafId,
  leafTitle,
  onRatingSubmitted,
}) => {
  const [cards, setCards] = useState<StudyFlashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const loadCards = useCallback(async () => {
    if (!syllabusId) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchStudyFlashcards(syllabusId, leafId || undefined);
      setCards(result);
      setCurrentIndex(0);
      setIsFlipped(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to load flashcards.');
    } finally {
      setIsLoading(false);
    }
  }, [syllabusId, leafId]);

  useEffect(() => {
    if (isOpen) {
      loadCards();
    }
  }, [isOpen, loadCards]);

  const handleGenerate = async () => {
    if (!syllabusId || !leafId || isGenerating) return;
    setIsGenerating(true);
    setError(null);
    try {
      const resp = await generateTopicFlashcards(syllabusId, leafId);
      setCards(resp.cards);
      setCurrentIndex(0);
      setIsFlipped(false);
      if (resp.count > 0) {
        setNotification(`Generated ${resp.count} flashcards (${resp.generation_mode.replace('_', ' ')}).`);
      } else if (resp.warnings && resp.warnings.length > 0) {
        setError(resp.warnings[0]);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to generate flashcards.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDelete = async (cardId: number) => {
    if (!syllabusId) return;
    try {
      await deleteStudyFlashcard(syllabusId, cardId);
      const updated = cards.filter((c) => c.id !== cardId);
      setCards(updated);
      if (currentIndex >= updated.length) {
        setCurrentIndex(Math.max(0, updated.length - 1));
      }
      setIsFlipped(false);
      setNotification('Flashcard deleted.');
    } catch (err: any) {
      setError(err?.message || 'Failed to delete flashcard.');
    }
  };

  const handleRate = async (quality: number) => {
    if (!leafId || !syllabusId) return;
    try {
      await submitRevisionReview(syllabusId, leafId, quality);
      if (onRatingSubmitted) onRatingSubmitted();
      setNotification(`Review rating recorded (Quality ${quality}/4).`);
      // Advance to next card or wrap
      if (currentIndex < cards.length - 1) {
        setCurrentIndex((prev) => prev + 1);
        setIsFlipped(false);
      }
    } catch {
      // Still allow review even if revision schedule hasn't been initialized
      if (currentIndex < cards.length - 1) {
        setCurrentIndex((prev) => prev + 1);
        setIsFlipped(false);
      }
    }
  };

  // Keyboard navigation: Space to flip, Arrows to navigate, 1-4 to rate when flipped
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        setIsFlipped((prev) => !prev);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (cards.length > 0) {
          setCurrentIndex((prev) => (prev + 1) % cards.length);
          setIsFlipped(false);
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (cards.length > 0) {
          setCurrentIndex((prev) => (prev - 1 + cards.length) % cards.length);
          setIsFlipped(false);
        }
      } else if (isFlipped && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        handleRate(parseInt(e.key, 10));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isFlipped, cards.length, onClose]);

  // Auto-clear notification after 3 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  if (!isOpen) return null;

  const currentCard = cards[currentIndex];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Active Recall Flashcard Deck"
    >
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden transition-colors">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)] truncate">
                {leafTitle ? `Flashcards: ${leafTitle}` : 'Study Flashcards'}
              </h3>
              <p className="text-[11px] text-[var(--text-muted)] truncate">
                {cards.length > 0
                  ? `Card ${currentIndex + 1} of ${cards.length} &bull; Click card or Space to flip`
                  : 'Zero-hallucination active recall'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {leafId && (
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="p-1.5 text-xs text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                title="Generate flashcards from syllabus"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Regenerate</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close flashcard modal"
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Notifications and Errors */}
        {notification && (
          <div className="px-4 py-2 bg-emerald-500/10 border-b border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400">
            {notification}
          </div>
        )}
        {error && (
          <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20 text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col justify-center items-center custom-scrollbar">
          {isLoading || isGenerating ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3 text-center">
              <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
              <div className="space-y-1">
                <p className="text-xs sm:text-sm font-semibold text-[var(--text-primary)]">
                  {isGenerating ? 'Extracting Grounded Questions...' : 'Loading Flashcards...'}
                </p>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Validating verbatim citations from official syllabus
                </p>
              </div>
            </div>
          ) : cards.length === 0 ? (
            <div className="py-10 text-center space-y-4 max-w-sm">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center border border-indigo-500/20">
                <BookOpen className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-[var(--text-primary)]">No flashcards yet</h4>
                <p className="text-xs text-[var(--text-muted)]">
                  Generate active-recall flashcards automatically grounded in this topic's official syllabus text and your personal notes.
                </p>
              </div>
              {leafId && (
                <button
                  type="button"
                  data-testid="generate-flashcards-btn"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white dark:text-gray-950 transition-colors shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Grounded Flashcards</span>
                </button>
              )}
            </div>
          ) : (
            currentCard && (
              <div className="w-full flex flex-col items-center space-y-4">
                {/* 3D Flippable Flashcard Surface */}
                <div
                  data-testid="flashcard-surface"
                  tabIndex={0}
                  onClick={() => setIsFlipped((prev) => !prev)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setIsFlipped((prev) => !prev);
                    }
                  }}
                  className={`w-full min-h-[220px] p-5 sm:p-6 rounded-2xl border cursor-pointer select-none transition-all duration-200 flex flex-col justify-between shadow-md focus:outline-hidden focus:ring-2 focus:ring-emerald-500/50 ${
                    isFlipped
                      ? 'bg-emerald-500/5 border-emerald-500/40 shadow-emerald-500/5'
                      : 'bg-[var(--bg-surface-elevated)] border-[var(--border-subtle)] hover:border-emerald-500/30'
                  }`}
                  aria-label={isFlipped ? 'Flashcard answer revealed' : 'Flashcard question'}
                >
                  {/* Top Provenance Badge */}
                  <div className="flex items-center justify-between text-xs pb-3 border-b border-[var(--border-hairline)]">
                    <span className="font-semibold uppercase tracking-wider text-[10px] text-[var(--text-muted)]">
                      {isFlipped ? 'Answer' : 'Question'}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      <BookOpen className="w-3 h-3" />
                      <span>{currentCard.citation_label}</span>
                    </span>
                  </div>

                  {/* Main Card Text */}
                  <div className="py-4 text-center my-auto">
                    <p className="text-sm sm:text-base font-medium text-[var(--text-primary)] leading-relaxed">
                      {isFlipped ? currentCard.back_answer : currentCard.front_question}
                    </p>
                  </div>

                  {/* Bottom Quotation / Prompt */}
                  <div className="pt-3 border-t border-[var(--border-hairline)] text-center">
                    {isFlipped ? (
                      <blockquote className="text-[11px] italic text-[var(--text-secondary)] line-clamp-2">
                        "{currentCard.source_quote}"
                      </blockquote>
                    ) : (
                      <span className="text-[11px] text-[var(--text-muted)] flex items-center justify-center gap-1">
                        <RotateCw className="w-3 h-3" />
                        <span>Click or press Space to reveal answer</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* SM-2 Recall Rating Shortcuts (Rendered when flipped) */}
                {isFlipped && (
                  <div className="w-full p-3 rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] space-y-2">
                    <p className="text-[11px] font-semibold text-center text-[var(--text-secondary)]">
                      Rate Recall Difficulty (Updates Topic Revision Schedule):
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                      <button
                        type="button"
                        onClick={() => handleRate(1)}
                        className="py-1.5 px-2 rounded-xl text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 transition-colors cursor-pointer"
                        title="Complete blackout / failure"
                      >
                        [1] Again
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRate(2)}
                        className="py-1.5 px-2 rounded-xl text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 transition-colors cursor-pointer"
                        title="Recalled with serious hesitation"
                      >
                        [2] Hard
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRate(3)}
                        className="py-1.5 px-2 rounded-xl text-xs font-semibold bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 transition-colors cursor-pointer"
                        title="Good recall with normal effort"
                      >
                        [3] Good
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRate(4)}
                        className="py-1.5 px-2 rounded-xl text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 transition-colors cursor-pointer"
                        title="Effortless instant recall"
                      >
                        [4] Easy
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          )}
        </div>

        {/* Modal Footer Controls */}
        {cards.length > 0 && (
          <div className="p-4 border-t border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] shrink-0 flex items-center justify-between">
            <button
              type="button"
              disabled={cards.length <= 1}
              onClick={() => {
                setCurrentIndex((prev) => (prev - 1 + cards.length) % cards.length);
                setIsFlipped(false);
              }}
              className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-40 rounded-xl transition-colors cursor-pointer flex items-center gap-1 text-xs"
              aria-label="Previous card"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Previous</span>
            </button>

            <div className="flex items-center gap-2">
              {currentCard && (
                <button
                  type="button"
                  onClick={() => handleDelete(currentCard.id)}
                  className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-colors cursor-pointer"
                  title="Delete this flashcard"
                  aria-label="Delete this flashcard"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              type="button"
              disabled={cards.length <= 1}
              onClick={() => {
                setCurrentIndex((prev) => (prev + 1) % cards.length);
                setIsFlipped(false);
              }}
              className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-40 rounded-xl transition-colors cursor-pointer flex items-center gap-1 text-xs"
              aria-label="Next card"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
