import '../setupTests';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import * as useSyllabusModule from '../hooks/useSyllabus';
import type { SyllabusResponse, SyllabusSummary } from '../types/syllabus';

describe('App Component Layout, Sidebar Deduplication, and Drawer Interactions', () => {
  const mockRefreshList = vi.fn().mockResolvedValue(undefined);
  const mockRefreshHealth = vi.fn().mockResolvedValue(undefined);
  const mockSelectSyllabus = vi.fn().mockResolvedValue(undefined);
  const mockHandleDelete = vi.fn().mockResolvedValue(undefined);

  const mockSyllabiList: SyllabusSummary[] = [
    {
      id: 'syl_1',
      title: 'Computer Science Syllabus',
      source_filename: 'CSEAIML22.pdf',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      leaf_count: 20,
      progress: {
        total_leaves: 20,
        completed_leaves: 8,
        progress_percent: 40.0,
      },
    },
    // Duplicate entry with same ID to test deduplication
    {
      id: 'syl_1',
      title: 'Computer Science Syllabus (Duplicate)',
      source_filename: 'CSEAIML22.pdf',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      leaf_count: 20,
      progress: {
        total_leaves: 20,
        completed_leaves: 8,
        progress_percent: 40.0,
      },
    },
    {
      id: 'syl_2',
      title: 'Mechanical Engineering',
      source_filename: 'Mech2024.pdf',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      leaf_count: 10,
      progress: {
        total_leaves: 10,
        completed_leaves: 0,
        progress_percent: 0.0,
      },
    },
  ];

  const mockActiveSyllabus: SyllabusResponse = {
    syllabus: {
      id: 'syl_1',
      title: 'Computer Science Syllabus',
      source_filename: 'CSEAIML22.pdf',
      schema_version: 2,
      years: [
        {
          id: 'yr_1',
          title: 'Year 1',
          semesters: [
            {
              id: 'sem_1',
              title: 'Semester 1',
              subjects: [
                {
                  id: 'sub_1',
                  code: 'CS101',
                  title: 'Programming in C',
                  modules: [
                    {
                      id: 'mod_1',
                      module_number: 'Module 1',
                      title: 'Basics of C',
                      topics: [
                        {
                          id: 'top_1',
                          title: 'Variables and Data Types',
                          source_text: 'Variables and basic types int float char.',
                          source_page: 2,
                          grounding_status: 'verified',
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    completed_leaf_ids: [],
    progress: {
      total_leaves: 1,
      completed_leaves: 0,
      progress_percent: 0.0,
    },
    node_progress: {},
    warnings: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(useSyllabusModule, 'useSyllabus').mockReturnValue({
      syllabi: mockSyllabiList,
      activeSyllabus: mockActiveSyllabus,
      health: {
        status: 'healthy',
        database: 'connected',
        ollama: {
          is_reachable: true,
          message: 'Connected',
          configured_model: 'llama3:8b',
          configured_fallback: 'rule_based',
          resolved_model: 'llama3:8b',
          available_models: ['llama3:8b'],
        },
      },
      isLoading: false,
      isUploading: false,
      uploadProgress: null,
      isMutating: false,
      error: null,
      clearError: vi.fn(),
      refreshList: mockRefreshList,
      refreshHealth: mockRefreshHealth,
      selectSyllabus: mockSelectSyllabus,
      uploadFile: vi.fn(),
      cancelUpload: vi.fn(),
      handleToggleLeaf: vi.fn(),
      handleToggleBranch: vi.fn(),
      handleRename: vi.fn(),
      handleDelete: mockHandleDelete,
      clearActive: vi.fn(),
    });
  });

  it('deduplicates documents in sidebar and displays source_filename as primary label', () => {
    render(<App />);

    // Total unique documents is 2 (syl_1 deduplicated, syl_2)
    expect(screen.getByText(/Documents \(2\)/i)).toBeInTheDocument();

    // Check display filename
    const doc1Titles = screen.getAllByText('CSEAIML22.pdf');
    expect(doc1Titles.length).toBeGreaterThan(0);
    expect(screen.getByText('Mech2024.pdf')).toBeInTheDocument();

    // Progress details in sidebar item
    expect(screen.getByText(/8 \/ 20 topics/i)).toBeInTheDocument();
    expect(screen.getByText('40%')).toBeInTheDocument();
  });

  it('prominently displays document filename above academic hierarchy outside checkboxes', () => {
    render(<App />);

    // Main heading card displays the source filename
    const heading = screen.getAllByRole('heading', { level: 2 });
    expect(heading[0]).toHaveTextContent('CSEAIML22.pdf');
  });

  it('toggles sidebar drawer open and closed with menu button', () => {
    render(<App />);

    const toggleBtn = screen.getByTestId('sidebar-toggle-btn');
    expect(toggleBtn).toBeInTheDocument();
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');

    // Click toggle to close
    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: /Expand sidebar drawer/i })).toBeInTheDocument();

    // Click toggle to reopen
    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
  });

  it('reloads health and document data when refresh button is activated', async () => {
    render(<App />);

    const refreshBtn = screen.getByRole('button', { name: /Refresh data/i });
    expect(refreshBtn).toBeInTheDocument();

    fireEvent.click(refreshBtn);

    await waitFor(() => {
      expect(mockRefreshList).toHaveBeenCalled();
      expect(mockRefreshHealth).toHaveBeenCalled();
    });
  });

  it('selects document when clicking sidebar entry', () => {
    render(<App />);

    const doc2Entry = screen.getByTestId('sidebar-item-syl_2');
    fireEvent.click(doc2Entry);

    expect(mockSelectSyllabus).toHaveBeenCalledWith('syl_2');
  });

  it('opens application native confirm delete modal when delete action is clicked', async () => {
    render(<App />);

    const deleteBtn = screen.getByRole('button', { name: /Delete CSEAIML22.pdf/i });
    fireEvent.click(deleteBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Delete Syllabus\?/i)).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /Confirm Delete/i });
    fireEvent.click(confirmBtn);

    expect(mockHandleDelete).toHaveBeenCalledWith('syl_1');
  });
});
