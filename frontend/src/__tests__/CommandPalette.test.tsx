import '../setupTests';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CommandPalette } from '../components/CommandPalette';
import type {
  HierarchicalSyllabus,
  PacingMetrics,
  TopicNote,
  TopicResource,
} from '../types/syllabus';

const mockSyllabus: HierarchicalSyllabus = {
  id: 'syl_ai',
  title: 'B.Tech Artificial Intelligence',
  source_filename: 'AI_Curriculum.pdf',
  schema_version: 2,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  years: [
    {
      id: 'yr_1',
      title: 'First Academic Year',
      order_index: 0,
      semesters: [
        {
          id: 'sem_1',
          title: 'Semester 1',
          order_index: 0,
          subjects: [
            {
              id: 'subj_cs101',
              code: 'CS101',
              title: 'Data Structures and Algorithms',
              is_lab: false,
              is_enrolled: true,
              enrollment_status: 'mandatory',
              order_index: 0,
              modules: [
                {
                  id: 'mod_1',
                  module_number: 'Module 1',
                  title: 'Linear Data Structures',
                  contact_hours: 4,
                  order_index: 0,
                  topics: [
                    {
                      id: 'top_arrays',
                      title: 'Dynamic Arrays & Vectors',
                      source_text: 'Dynamic contiguous memory expansion',
                      evidence_status: 'verified',
                      order_index: 0,
                    },
                    {
                      id: 'top_linked_lists',
                      title: 'Singly and Doubly Linked Lists',
                      source_text: 'Pointer chains and node allocation',
                      evidence_status: 'needs_review',
                      order_index: 1,
                    },
                  ],
                },
              ],
            },
            {
              id: 'subj_cs102_lab',
              code: 'CS102L',
              title: 'Data Structures Laboratory',
              is_lab: true,
              is_enrolled: true,
              enrollment_status: 'mandatory',
              order_index: 1,
              modules: [
                {
                  id: 'mod_lab_1',
                  module_number: 'Lab 1',
                  title: 'Hands-on Pointer Exercises',
                  contact_hours: 2,
                  order_index: 0,
                  topics: [
                    {
                      id: 'top_lab_trees',
                      title: 'Binary Search Tree Implementation in C',
                      source_text: 'Lab manual page 12',
                      evidence_status: 'verified',
                      order_index: 0,
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
};

const mockPacingData: Record<string, PacingMetrics> = {
  subj_cs101: {
    node_id: 'subj_cs101',
    status: 'at_risk',
    target_date: '2026-12-15',
    days_remaining: 10,
    total_leaves: 2,
    completed_leaves: 0,
    remaining_leaves: 2,
    remaining_contact_hours: 4,
    topics_per_week: 1.4,
    hours_per_week: 2.8,
  },
};

const mockNotes: TopicNote[] = [
  {
    leaf_id: 'top_arrays',
    content: 'Important: Amortized complexity of dynamic array push_back is O(1).',
  },
];

const mockResources: TopicResource[] = [
  {
    id: 1,
    node_id: 'top_linked_lists',
    node_type: 'subtopic',
    title: 'Visualgo Linked Lists Animation',
    url: 'https://visualgo.net/en/list',
    resource_type: 'link',
    created_at: new Date().toISOString(),
  },
];

describe('CommandPalette Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    const handleClose = vi.fn();
    render(
      <CommandPalette
        isOpen={false}
        onClose={handleClose}
        syllabus={mockSyllabus}
      />
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders accessible dialog with focus on input when isOpen is true', () => {
    const handleClose = vi.fn();
    render(
      <CommandPalette
        isOpen={true}
        onClose={handleClose}
        syllabus={mockSyllabus}
      />
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');

    const searchInput = screen.getByPlaceholderText(/Type a course code/i);
    expect(searchInput).toBeInTheDocument();
  });

  it('closes dialog when Escape key is pressed', () => {
    const handleClose = vi.fn();
    render(
      <CommandPalette
        isOpen={true}
        onClose={handleClose}
        syllabus={mockSyllabus}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('finds exact course code matches with highest priority', () => {
    render(
      <CommandPalette
        isOpen={true}
        onClose={vi.fn()}
        syllabus={mockSyllabus}
      />
    );

    const searchInput = screen.getByPlaceholderText(/Type a course code/i);
    fireEvent.change(searchInput, { target: { value: 'CS101' } });

    expect(screen.getByText('Data Structures and Algorithms')).toBeInTheDocument();
    expect(screen.getByText('CS101')).toBeInTheDocument();
  });

  it('finds topics by title and matches case-insensitively', () => {
    render(
      <CommandPalette
        isOpen={true}
        onClose={vi.fn()}
        syllabus={mockSyllabus}
      />
    );

    const searchInput = screen.getByPlaceholderText(/Type a course code/i);
    fireEvent.change(searchInput, { target: { value: 'dynamic arrays' } });

    expect(screen.getByText('Dynamic Arrays & Vectors')).toBeInTheDocument();
  });

  it('finds personal notes content in search', () => {
    render(
      <CommandPalette
        isOpen={true}
        onClose={vi.fn()}
        syllabus={mockSyllabus}
        notes={mockNotes}
      />
    );

    const searchInput = screen.getByPlaceholderText(/Type a course code/i);
    fireEvent.change(searchInput, { target: { value: 'amortized' } });

    expect(screen.getByText(/Amortized complexity/i)).toBeInTheDocument();
  });

  it('finds resource bookmark titles and URLs', () => {
    render(
      <CommandPalette
        isOpen={true}
        onClose={vi.fn()}
        syllabus={mockSyllabus}
        resources={mockResources}
      />
    );

    const searchInput = screen.getByPlaceholderText(/Type a course code/i);
    fireEvent.change(searchInput, { target: { value: 'visualgo' } });

    expect(screen.getByText('Visualgo Linked Lists Animation')).toBeInTheDocument();
  });

  it('supports quick filters: Incomplete vs Completed Topics', () => {
    render(
      <CommandPalette
        isOpen={true}
        onClose={vi.fn()}
        syllabus={mockSyllabus}
        completedLeafIds={['top_arrays']}
      />
    );

    // Filter Incomplete
    const incompleteChip = screen.getByRole('button', { name: /Incomplete/i });
    fireEvent.click(incompleteChip);

    expect(screen.getByText('Singly and Doubly Linked Lists')).toBeInTheDocument();
    expect(screen.queryByText('Dynamic Arrays & Vectors')).not.toBeInTheDocument();

    // Filter Completed
    const completedChip = screen.getByRole('button', { name: /Completed/i });
    fireEvent.click(completedChip);

    expect(screen.getByText('Dynamic Arrays & Vectors')).toBeInTheDocument();
    expect(screen.queryByText('Singly and Doubly Linked Lists')).not.toBeInTheDocument();
  });

  it('supports quick filters: Lab Courses', () => {
    render(
      <CommandPalette
        isOpen={true}
        onClose={vi.fn()}
        syllabus={mockSyllabus}
      />
    );

    const labChip = screen.getByRole('button', { name: /Lab Courses/i });
    fireEvent.click(labChip);

    expect(screen.getByText('Data Structures Laboratory')).toBeInTheDocument();
    expect(screen.queryByText('Data Structures and Algorithms')).not.toBeInTheDocument();
  });

  it('supports quick filters: Needs Review', () => {
    render(
      <CommandPalette
        isOpen={true}
        onClose={vi.fn()}
        syllabus={mockSyllabus}
      />
    );

    const reviewChip = screen.getByRole('button', { name: /Needs Review/i });
    fireEvent.click(reviewChip);

    expect(screen.getByText('Singly and Doubly Linked Lists')).toBeInTheDocument();
    expect(screen.queryByText('Dynamic Arrays & Vectors')).not.toBeInTheDocument();
  });

  it('supports quick filters: At-Risk Deadlines', () => {
    render(
      <CommandPalette
        isOpen={true}
        onClose={vi.fn()}
        syllabus={mockSyllabus}
        pacingData={mockPacingData}
      />
    );

    const atRiskChip = screen.getByRole('button', { name: /At-Risk/i });
    fireEvent.click(atRiskChip);

    expect(screen.getByText('Data Structures and Algorithms')).toBeInTheDocument();
  });

  it('supports keyboard navigation with ArrowUp, ArrowDown, and Enter', () => {
    const handleNavigate = vi.fn();
    const handleClose = vi.fn();

    render(
      <CommandPalette
        isOpen={true}
        onClose={handleClose}
        syllabus={mockSyllabus}
        onNavigateToNode={handleNavigate}
      />
    );

    const searchInput = screen.getByPlaceholderText(/Type a course code/i);
    fireEvent.change(searchInput, { target: { value: 'CS101' } });

    // Arrow down to highlight second result if multiple, or enter on first
    fireEvent.keyDown(searchInput, { key: 'Enter' });

    expect(handleNavigate).toHaveBeenCalledWith('subj_cs101');
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('executes Quick Action: Import Syllabus', () => {
    const handleUpload = vi.fn();
    const handleClose = vi.fn();

    render(
      <CommandPalette
        isOpen={true}
        onClose={handleClose}
        syllabus={mockSyllabus}
        onOpenUpload={handleUpload}
      />
    );

    const searchInput = screen.getByPlaceholderText(/Type a course code/i);
    fireEvent.change(searchInput, { target: { value: 'import syllabus' } });

    const importItem = screen.getByText('Import Syllabus Document');
    fireEvent.click(importItem);

    expect(handleUpload).toHaveBeenCalledTimes(1);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('executes Quick Action: Switch Theme', () => {
    const handleSetTheme = vi.fn();
    const handleClose = vi.fn();

    render(
      <CommandPalette
        isOpen={true}
        onClose={handleClose}
        syllabus={mockSyllabus}
        onSetTheme={handleSetTheme}
      />
    );

    const searchInput = screen.getByPlaceholderText(/Type a course code/i);
    fireEvent.change(searchInput, { target: { value: 'theme: light' } });

    const lightThemeItem = screen.getByText('Switch Theme: Light');
    fireEvent.click(lightThemeItem);

    expect(handleSetTheme).toHaveBeenCalledWith('light');
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('displays empty state when query matches nothing', () => {
    render(
      <CommandPalette
        isOpen={true}
        onClose={vi.fn()}
        syllabus={mockSyllabus}
      />
    );

    const searchInput = screen.getByPlaceholderText(/Type a course code/i);
    fireEvent.change(searchInput, { target: { value: 'nonexistent_xyz_query' } });

    expect(screen.getByText('No matching results found')).toBeInTheDocument();
  });
});
