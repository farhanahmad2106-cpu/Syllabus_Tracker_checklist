import '../setupTests';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { FlashcardDeckModal } from '../components/FlashcardDeckModal';
import * as api from '../lib/api';
import type { StudyFlashcard, FlashcardGenerationResponse } from '../types/syllabus';

vi.mock('../lib/api', () => ({
  fetchStudyFlashcards: vi.fn(),
  generateTopicFlashcards: vi.fn(),
  deleteStudyFlashcard: vi.fn(),
  submitRevisionReview: vi.fn(),
}));

describe('FlashcardDeckModal Component', () => {
  const mockSyllabusId = 'syl_test_1';
  const mockLeafId = 'leaf_paging_1';
  const mockLeafTitle = 'Virtual Memory and Paging';

  const sampleCards: StudyFlashcard[] = [
    {
      id: 'card_1',
      syllabus_id: mockSyllabusId,
      leaf_id: mockLeafId,
      front_question: 'What is the purpose of Paging in memory management?',
      back_answer: 'Paging eliminates contiguous allocation by mapping logical addresses to physical frames.',
      citation_label: 'CS301 > Memory Management',
      source_quote: 'Paging is a memory management scheme that eliminates contiguous allocation.',
      source_type: 'official_syllabus',
      source_page: 22,
      created_by: 'ai_ollama',
      fingerprint: 'fp_123',
      created_at: '2026-11-19T10:00:00Z',
    },
    {
      id: 'card_2',
      syllabus_id: mockSyllabusId,
      leaf_id: mockLeafId,
      front_question: 'What is the function of the Translation Lookaside Buffer (TLB)?',
      back_answer: 'The TLB acts as a high-speed hardware cache for page table mappings.',
      citation_label: 'CS301 > Memory Management',
      source_quote: 'Translation Lookaside Buffer (TLB) acts as a high-speed hardware cache.',
      source_type: 'official_syllabus',
      source_page: 23,
      created_by: 'ai_ollama',
      fingerprint: 'fp_456',
      created_at: '2026-11-19T10:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal, loads flashcards, and displays front question', async () => {
    vi.mocked(api.fetchStudyFlashcards).mockResolvedValueOnce(sampleCards);

    render(
      <FlashcardDeckModal
        isOpen={true}
        onClose={vi.fn()}
        syllabusId={mockSyllabusId}
        leafId={mockLeafId}
        leafTitle={mockLeafTitle}
      />
    );

    expect(screen.getByText('Virtual Memory and Paging')).toBeInTheDocument();

    await waitFor(() => {
      expect(api.fetchStudyFlashcards).toHaveBeenCalledWith(mockSyllabusId, mockLeafId);
      expect(screen.getByText('Card 1 of 2')).toBeInTheDocument();
      expect(
        screen.getByText('What is the purpose of Paging in memory management?')
      ).toBeInTheDocument();
      expect(screen.getByText('Click or press Space to reveal answer')).toBeInTheDocument();
    });
  });

  it('flips card to reveal answer and source quote upon click', async () => {
    vi.mocked(api.fetchStudyFlashcards).mockResolvedValueOnce(sampleCards);

    render(
      <FlashcardDeckModal
        isOpen={true}
        onClose={vi.fn()}
        syllabusId={mockSyllabusId}
        leafId={mockLeafId}
        leafTitle={mockLeafTitle}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Card 1 of 2')).toBeInTheDocument();
    });

    const cardContainer = screen.getByRole('button', {
      name: /Flip card/i,
    });
    fireEvent.click(cardContainer);

    expect(
      screen.getByText(/Paging eliminates contiguous allocation by mapping logical addresses/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Paging is a memory management scheme that eliminates contiguous allocation/i)
    ).toBeInTheDocument();
    expect(screen.getByText('official_syllabus')).toBeInTheDocument();
  });

  it('allows rating recall with SM-2 shortcuts and submits review', async () => {
    vi.mocked(api.fetchStudyFlashcards).mockResolvedValueOnce(sampleCards);
    vi.mocked(api.submitRevisionReview).mockResolvedValueOnce({
      id: 'rev_1',
      syllabus_id: mockSyllabusId,
      leaf_id: mockLeafId,
      repetition_number: 1,
      easiness_factor: 2.6,
      interval_days: 1,
      next_review_date: '2026-11-20T10:00:00Z',
      last_reviewed_at: '2026-11-19T10:00:00Z',
      last_quality_rating: 4,
      is_due: false,
    });

    const onRatingSubmitted = vi.fn();

    render(
      <FlashcardDeckModal
        isOpen={true}
        onClose={vi.fn()}
        syllabusId={mockSyllabusId}
        leafId={mockLeafId}
        leafTitle={mockLeafTitle}
        onRatingSubmitted={onRatingSubmitted}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Card 1 of 2')).toBeInTheDocument();
    });

    // Flip first
    const cardContainer = screen.getByRole('button', { name: /Flip card/i });
    fireEvent.click(cardContainer);

    // Rating buttons are now visible: Again (1), Hard (2), Good (3), Easy (4)
    const easyBtn = screen.getByRole('button', { name: /Easy/i });
    fireEvent.click(easyBtn);

    await waitFor(() => {
      expect(api.submitRevisionReview).toHaveBeenCalledWith(mockSyllabusId, mockLeafId, 4);
      expect(onRatingSubmitted).toHaveBeenCalled();
      // Should now advance to Card 2 of 2
      expect(screen.getByText('Card 2 of 2')).toBeInTheDocument();
    });
  });

  it('allows generating flashcards when deck is empty', async () => {
    vi.mocked(api.fetchStudyFlashcards).mockResolvedValueOnce([]);

    const genResponse: FlashcardGenerationResponse = {
      syllabus_id: mockSyllabusId,
      leaf_id: mockLeafId,
      count: 2,
      generated_by: 'ai_ollama',
      cards: sampleCards,
    };
    vi.mocked(api.generateTopicFlashcards).mockResolvedValueOnce(genResponse);

    render(
      <FlashcardDeckModal
        isOpen={true}
        onClose={vi.fn()}
        syllabusId={mockSyllabusId}
        leafId={mockLeafId}
        leafTitle={mockLeafTitle}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('No Flashcards for this Topic')).toBeInTheDocument();
    });

    const generateBtn = screen.getByRole('button', { name: /Generate Grounded Flashcards/i });
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(api.generateTopicFlashcards).toHaveBeenCalledWith(mockSyllabusId, mockLeafId);
      expect(screen.getByText('Card 1 of 2')).toBeInTheDocument();
    });
  });

  it('deletes a flashcard when delete button is confirmed', async () => {
    vi.mocked(api.fetchStudyFlashcards).mockResolvedValueOnce(sampleCards);
    vi.mocked(api.deleteStudyFlashcard).mockResolvedValueOnce({ deleted: true });

    render(
      <FlashcardDeckModal
        isOpen={true}
        onClose={vi.fn()}
        syllabusId={mockSyllabusId}
        leafId={mockLeafId}
        leafTitle={mockLeafTitle}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Card 1 of 2')).toBeInTheDocument();
    });

    const deleteBtn = screen.getByTitle('Delete flashcard');
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(api.deleteStudyFlashcard).toHaveBeenCalledWith(mockSyllabusId, 'card_1');
      expect(screen.getByText('Card 1 of 1')).toBeInTheDocument();
    });
  });
});
