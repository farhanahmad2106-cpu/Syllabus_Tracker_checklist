import '../setupTests';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { StudyAssistantDrawer } from '../components/StudyAssistantDrawer';
import * as api from '../lib/api';
import type { GroundedStudyAnswer } from '../types/syllabus';

vi.mock('../lib/api', () => ({
  askStudyAssistant: vi.fn(),
}));

describe('StudyAssistantDrawer Component', () => {
  const mockSyllabusId = 'syl_test_1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders drawer when open with suggested questions and input form', () => {
    render(
      <StudyAssistantDrawer
        isOpen={true}
        onClose={vi.fn()}
        syllabusId={mockSyllabusId}
        initialLeafId={null}
        initialLeafTitle={null}
      />
    );

    expect(screen.getByText('Syllabus AI Assistant')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Ask anything about your syllabus/i)).toBeInTheDocument();
    expect(screen.getByText('What are the prerequisite topics?')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <StudyAssistantDrawer
        isOpen={false}
        onClose={vi.fn()}
        syllabusId={mockSyllabusId}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('submits a question and displays grounded answer with verified citations', async () => {
    const mockAnswer: GroundedStudyAnswer = {
      answer_markdown: 'Bankers Algorithm avoids deadlock by ensuring safe states.',
      answer_state: 'supported',
      citations: [
        {
          citation_index: 1,
          label: 'CS301 > Module 2 > Deadlocks',
          verbatim_quote: 'Bankers Algorithm is used for deadlock avoidance',
          source_type: 'official_syllabus',
          leaf_id: 'leaf_deadlocks_1',
          page_number: 14,
        },
      ],
      retrieval_count: 1,
      model_used: 'ollama:llama3.2',
    };

    vi.mocked(api.askStudyAssistant).mockResolvedValueOnce(mockAnswer);

    const onNavigate = vi.fn();

    render(
      <StudyAssistantDrawer
        isOpen={true}
        onClose={vi.fn()}
        syllabusId={mockSyllabusId}
        onNavigateToLeaf={onNavigate}
      />
    );

    const input = screen.getByPlaceholderText(/Ask anything about your syllabus/i);
    fireEvent.change(input, { target: { value: 'How does deadlock avoidance work?' } });

    const submitBtn = screen.getByRole('button', { name: /Ask AI/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.askStudyAssistant).toHaveBeenCalledWith(mockSyllabusId, {
        question: 'How does deadlock avoidance work?',
        leaf_id: undefined,
        subject_id: undefined,
      });
      expect(screen.getByText(/Bankers Algorithm avoids deadlock by ensuring safe states/i)).toBeInTheDocument();
      expect(screen.getByText('Fully Grounded')).toBeInTheDocument();
      expect(screen.getByText('CS301 > Module 2 > Deadlocks')).toBeInTheDocument();
    });

    // Clicking "View in Tree" triggers onNavigateToLeaf
    const viewInTreeBtn = screen.getByRole('button', { name: /View in Tree/i });
    fireEvent.click(viewInTreeBtn);
    expect(onNavigate).toHaveBeenCalledWith('leaf_deadlocks_1');
  });

  it('displays insufficient evidence status and abstains without hallucinating', async () => {
    const mockAbstention: GroundedStudyAnswer = {
      answer_markdown: 'I could not find any official syllabus content or notes discussing this topic.',
      answer_state: 'insufficient_evidence',
      citations: [],
      retrieval_count: 0,
      model_used: 'abstained_no_retrieval',
    };

    vi.mocked(api.askStudyAssistant).mockResolvedValueOnce(mockAbstention);

    render(
      <StudyAssistantDrawer
        isOpen={true}
        onClose={vi.fn()}
        syllabusId={mockSyllabusId}
      />
    );

    const input = screen.getByPlaceholderText(/Ask anything about your syllabus/i);
    fireEvent.change(input, { target: { value: 'What is alien warp drive physics?' } });

    const submitBtn = screen.getByRole('button', { name: /Ask AI/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Insufficient Evidence')).toBeInTheDocument();
      expect(screen.getByText(/could not find any official syllabus content/i)).toBeInTheDocument();
    });
  });

  it('displays active leaf scope and allows removing it', () => {
    render(
      <StudyAssistantDrawer
        isOpen={true}
        onClose={vi.fn()}
        syllabusId={mockSyllabusId}
        initialLeafId="leaf_1"
        initialLeafTitle="Paging Algorithms"
      />
    );

    expect(screen.getByText('Paging Algorithms')).toBeInTheDocument();
    const removeScopeBtn = screen.getByTitle('Clear topic focus');
    fireEvent.click(removeScopeBtn);

    expect(screen.queryByText('Paging Algorithms')).not.toBeInTheDocument();
  });
});
