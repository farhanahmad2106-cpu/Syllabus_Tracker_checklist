import '../setupTests';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TopicResourcesModal } from '../components/TopicResourcesModal';
import * as api from '../lib/api';

vi.mock('../lib/api', () => ({
  fetchSyllabusResources: vi.fn(),
  addTopicResource: vi.fn(),
  deleteTopicResource: vi.fn(),
}));

describe('TopicResourcesModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders existing resources for a topic', async () => {
    vi.mocked(api.fetchSyllabusResources).mockResolvedValue([
      {
        id: 1,
        node_id: 'top_1',
        node_type: 'subtopic',
        title: 'MIT Video Lecture',
        url: 'https://youtube.com/watch?v=123',
        resource_type: 'youtube',
        created_at: '2026-11-04T00:00:00Z',
      },
    ]);

    render(
      <TopicResourcesModal
        isOpen={true}
        onClose={vi.fn()}
        syllabusId="syl_1"
        nodeId="top_1"
        nodeType="subtopic"
        nodeTitle="Binary Trees"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('MIT Video Lecture')).toBeInTheDocument();
      expect(screen.getByText('youtube')).toBeInTheDocument();
    });
  });

  it('auto-detects YouTube URL category', async () => {
    vi.mocked(api.fetchSyllabusResources).mockResolvedValue([]);

    render(
      <TopicResourcesModal
        isOpen={true}
        onClose={vi.fn()}
        syllabusId="syl_1"
        nodeId="top_1"
        nodeType="subtopic"
        nodeTitle="Binary Trees"
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/URL/i)).toBeInTheDocument();
    });

    const urlInput = screen.getByLabelText(/URL/i);
    fireEvent.change(urlInput, { target: { value: 'https://youtu.be/abcdef' } });

    const select = screen.getByLabelText(/Category/i) as HTMLSelectElement;
    expect(select.value).toBe('youtube');
  });

  it('submits new resource and updates the list', async () => {
    vi.mocked(api.fetchSyllabusResources).mockResolvedValue([]);
    vi.mocked(api.addTopicResource).mockResolvedValue({
      id: 2,
      node_id: 'top_1',
      node_type: 'subtopic',
      title: 'Stanford Slides',
      url: 'https://stanford.edu/slides.pdf',
      resource_type: 'slides',
      created_at: '2026-11-04T00:00:00Z',
    });

    const handleCountChange = vi.fn();

    render(
      <TopicResourcesModal
        isOpen={true}
        onClose={vi.fn()}
        syllabusId="syl_1"
        nodeId="top_1"
        nodeType="subtopic"
        nodeTitle="Binary Trees"
        onResourceCountChange={handleCountChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/Resource Title/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Resource Title/i), {
      target: { value: 'Stanford Slides' },
    });
    fireEvent.change(screen.getByLabelText(/URL/i), {
      target: { value: 'https://stanford.edu/slides.pdf' },
    });
    fireEvent.change(screen.getByLabelText(/Category/i), {
      target: { value: 'slides' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Save Resource/i }));

    await waitFor(() => {
      expect(api.addTopicResource).toHaveBeenCalledWith('syl_1', {
        node_id: 'top_1',
        node_type: 'subtopic',
        title: 'Stanford Slides',
        url: 'https://stanford.edu/slides.pdf',
        resource_type: 'slides',
      });
      expect(handleCountChange).toHaveBeenCalledWith('top_1', 1);
      expect(screen.getByText('Stanford Slides')).toBeInTheDocument();
    });
  });

  it('handles resource deletion', async () => {
    vi.mocked(api.fetchSyllabusResources).mockResolvedValue([
      {
        id: 10,
        node_id: 'top_1',
        node_type: 'subtopic',
        title: 'Delete Me Link',
        url: 'https://example.com/del',
        resource_type: 'link',
        created_at: '2026-11-04T00:00:00Z',
      },
    ]);
    vi.mocked(api.deleteTopicResource).mockResolvedValue(undefined);

    const handleCountChange = vi.fn();

    render(
      <TopicResourcesModal
        isOpen={true}
        onClose={vi.fn()}
        syllabusId="syl_1"
        nodeId="top_1"
        nodeType="subtopic"
        nodeTitle="Binary Trees"
        onResourceCountChange={handleCountChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Delete Me Link')).toBeInTheDocument();
    });

    const deleteBtn = screen.getByLabelText('Delete resource Delete Me Link');
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(api.deleteTopicResource).toHaveBeenCalledWith('syl_1', 10);
      expect(handleCountChange).toHaveBeenCalledWith('top_1', 0);
    });
  });
});

