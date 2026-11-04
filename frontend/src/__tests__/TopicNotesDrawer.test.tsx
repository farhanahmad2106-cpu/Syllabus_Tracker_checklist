import '../setupTests';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TopicNotesDrawer } from '../components/TopicNotesDrawer';
import * as api from '../lib/api';

vi.mock('../lib/api', () => ({
  fetchTopicNote: vi.fn(),
  saveTopicNote: vi.fn(),
  deleteTopicNote: vi.fn(),
}));

describe('TopicNotesDrawer Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads and renders existing note content', async () => {
    vi.mocked(api.fetchTopicNote).mockResolvedValue({
      leaf_id: 'top_1',
      content: '# Binary Search\nMidpoint formula: m = l + (r-l)/2',
      updated_at: '2026-11-04T00:00:00Z',
    });

    render(
      <TopicNotesDrawer
        isOpen={true}
        onClose={vi.fn()}
        syllabusId="syl_1"
        leafId="top_1"
        leafTitle="Binary Search Algorithm"
      />
    );

    await waitFor(() => {
      const textarea = screen.getByLabelText('Markdown Note Editor') as HTMLTextAreaElement;
      expect(textarea.value).toContain('Binary Search');
    });
  });

  it('inserts quick templates into the note editor', async () => {
    vi.mocked(api.fetchTopicNote).mockResolvedValue({
      leaf_id: 'top_1',
      content: '',
      updated_at: null,
    });

    render(
      <TopicNotesDrawer
        isOpen={true}
        onClose={vi.fn()}
        syllabusId="syl_1"
        leafId="top_1"
        leafTitle="Binary Search Algorithm"
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Markdown Note Editor')).toBeInTheDocument();
    });

    const formulaBtn = screen.getByTitle('Insert Math/Formula Block');
    fireEvent.click(formulaBtn);

    const textarea = screen.getByLabelText('Markdown Note Editor') as HTMLTextAreaElement;
    expect(textarea.value).toContain('$$');
  });

  it('triggers debounced auto-save when editing note content', async () => {
    vi.mocked(api.fetchTopicNote).mockResolvedValue({
      leaf_id: 'top_1',
      content: 'Initial text',
      updated_at: null,
    });
    vi.mocked(api.saveTopicNote).mockResolvedValue({
      leaf_id: 'top_1',
      content: 'Updated note text',
      updated_at: '2026-11-04T00:01:00Z',
    });

    const handleNoteChange = vi.fn();

    render(
      <TopicNotesDrawer
        isOpen={true}
        onClose={vi.fn()}
        syllabusId="syl_1"
        leafId="top_1"
        leafTitle="Binary Search Algorithm"
        onNoteChange={handleNoteChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Markdown Note Editor')).toBeInTheDocument();
    });

    const textarea = screen.getByLabelText('Markdown Note Editor');
    fireEvent.change(textarea, { target: { value: 'Updated note text' } });

    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();

    await waitFor(
      () => {
        expect(api.saveTopicNote).toHaveBeenCalledWith('syl_1', 'top_1', 'Updated note text');
      },
      { timeout: 1500 }
    );
  });

  it('allows toggling between edit, preview, and split views', async () => {
    vi.mocked(api.fetchTopicNote).mockResolvedValue({
      leaf_id: 'top_1',
      content: '# Binary Search Notes',
      updated_at: null,
    });

    render(
      <TopicNotesDrawer
        isOpen={true}
        onClose={vi.fn()}
        syllabusId="syl_1"
        leafId="top_1"
        leafTitle="Binary Search Algorithm"
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Markdown Note Editor')).toBeInTheDocument();
    });

    // Toggle Preview
    const previewBtn = screen.getByRole('button', { name: /Preview/i });
    fireEvent.click(previewBtn);

    expect(screen.getByLabelText('Markdown Preview')).toBeInTheDocument();
  });
});

