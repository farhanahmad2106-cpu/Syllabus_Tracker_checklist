import '../setupTests';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SyllabusTree } from '../components/SyllabusTree';
import type { HierarchicalSyllabus } from '../types/syllabus';

const mockSyllabus: HierarchicalSyllabus = {
  id: 'syl_1',
  title: 'Sample Curriculum',
  source_filename: 'sample.pdf',
  schema_version: 1,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  years: [
    {
      id: 'yr_1',
      title: 'Year 1',
      order_index: 0,
      semesters: [
        {
          id: 'sem_1',
          title: 'Semester 1',
          order_index: 0,
          topics: [
            {
              id: 'top_1',
              title: 'Topic 1',
              order_index: 0,
              subtopics: [
                {
                  id: 'sub_1',
                  title: 'Subtopic 1',
                  source_text: 'Evidence 1',
                  source_page: 1,
                  source_location: 'Sec 1',
                  order_index: 0,
                },
                {
                  id: 'sub_2',
                  title: 'Subtopic 2',
                  source_text: 'Evidence 2',
                  source_page: 2,
                  source_location: 'Sec 2',
                  order_index: 1,
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

const canonical5TierSyllabus: HierarchicalSyllabus = {
  id: 'syl_5tier',
  title: 'B.Tech AI & Data Science',
  source_filename: 'CSEAIML22.pdf',
  schema_version: 2,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  years: [
    {
      id: 'yr_1',
      title: 'First Year',
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
              title: 'Data Structures',
              order_index: 0,
              modules: [
                {
                  id: 'mod_1',
                  module_number: 'Module 1',
                  title: 'Linear Structures',
                  order_index: 0,
                  topics: [
                    {
                      id: 'top_1',
                      title: 'Arrays and Memory Representation',
                      source_text: 'Arrays are contiguous memory blocks in heap or stack.',
                      source_page: 3,
                      grounding_status: 'verified',
                      order_index: 0,
                    },
                    {
                      id: 'top_2',
                      title: 'Singly and Doubly Linked Lists',
                      source_text: 'Linked lists dynamic node allocation pointers.',
                      source_page: 5,
                      grounding_status: 'needs_review',
                      order_index: 1,
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

describe('SyllabusTree', () => {
  it('renders all 5 hierarchy levels and handles leaf toggle', () => {
    const handleToggleLeaf = vi.fn();
    const handleToggleBranch = vi.fn();

    const { container } = render(
      <SyllabusTree
        syllabus={mockSyllabus}
        completedLeafIds={['sub_1']}
        nodeProgress={{}}
        onToggleLeaf={handleToggleLeaf}
        onToggleBranch={handleToggleBranch}
      />
    );

    expect(screen.getByText('Year 1')).toBeInTheDocument();
    expect(screen.getByText('Semester 1')).toBeInTheDocument();
    expect(screen.getByText('Topic 1')).toBeInTheDocument();
    expect(screen.getByText('Subtopic 1')).toBeInTheDocument();
    expect(screen.getByText('Subtopic 2')).toBeInTheDocument();

    const leafInputs = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    expect(leafInputs.length).toBe(2);
    expect(leafInputs[0]).toBeChecked();
    expect(leafInputs[1]).not.toBeChecked();

    fireEvent.click(leafInputs[1]);
    expect(handleToggleLeaf).toHaveBeenCalledWith('sub_2', true);
  });

  it('renders canonical 5-tier hierarchy cards: Year -> Semester -> Subject -> Module -> Topic', () => {
    const handleToggleLeaf = vi.fn();
    const handleToggleBranch = vi.fn();

    render(
      <SyllabusTree
        syllabus={canonical5TierSyllabus}
        completedLeafIds={['top_1']}
        nodeProgress={{}}
        onToggleLeaf={handleToggleLeaf}
        onToggleBranch={handleToggleBranch}
      />
    );

    // 1. Year level card
    expect(screen.getByTestId('year-card-yr_1')).toBeInTheDocument();
    expect(screen.getByText('First Year')).toBeInTheDocument();

    // 2. Semester level card
    expect(screen.getByTestId('semester-card-sem_1')).toBeInTheDocument();
    expect(screen.getByText('Semester 1')).toBeInTheDocument();

    // 3. Subject level card with code badge
    expect(screen.getByTestId('subject-card-subj_cs101')).toBeInTheDocument();
    expect(screen.getByText('CS101')).toBeInTheDocument();
    expect(screen.getByText('Data Structures')).toBeInTheDocument();

    // 4. Module level card with unit label
    expect(screen.getByTestId('module-card-mod_1')).toBeInTheDocument();
    expect(screen.getByText('Module 1:')).toBeInTheDocument();
    expect(screen.getByText('Linear Structures')).toBeInTheDocument();

    // 5. Topic leaf rows
    expect(screen.getByTestId('topic-row-top_1')).toBeInTheDocument();
    expect(screen.getByText('Arrays and Memory Representation')).toBeInTheDocument();
    expect(screen.getByTestId('topic-row-top_2')).toBeInTheDocument();
    expect(screen.getByText('Singly and Doubly Linked Lists')).toBeInTheDocument();

    // Needs review badge for unverified/needs_review topic
    expect(screen.getByText('Needs Review')).toBeInTheDocument();
  });

  it('supports independent collapse state without modifying completion data', () => {
    const handleToggleLeaf = vi.fn();
    const handleToggleBranch = vi.fn();

    render(
      <SyllabusTree
        syllabus={canonical5TierSyllabus}
        completedLeafIds={['top_1']}
        nodeProgress={{}}
        onToggleLeaf={handleToggleLeaf}
        onToggleBranch={handleToggleBranch}
      />
    );

    const yearToggleBtn = screen.getByRole('button', { name: /Toggle First Year/i });
    expect(yearToggleBtn).toHaveAttribute('aria-expanded', 'true');

    // Collapse Year
    fireEvent.click(yearToggleBtn);
    expect(yearToggleBtn).toHaveAttribute('aria-expanded', 'false');

    // Confirm neither leaf nor branch toggle callback was triggered
    expect(handleToggleLeaf).not.toHaveBeenCalled();
    expect(handleToggleBranch).not.toHaveBeenCalled();

    // Expand Year again
    fireEvent.click(yearToggleBtn);
    expect(yearToggleBtn).toHaveAttribute('aria-expanded', 'true');
    expect(handleToggleLeaf).not.toHaveBeenCalled();
  });

  it('cascades branch selection to onToggleBranch when parent checkbox is activated', () => {
    const handleToggleLeaf = vi.fn();
    const handleToggleBranch = vi.fn();

    render(
      <SyllabusTree
        syllabus={canonical5TierSyllabus}
        completedLeafIds={['top_1']} // 1/2 complete -> indeterminate
        nodeProgress={{}}
        onToggleLeaf={handleToggleLeaf}
        onToggleBranch={handleToggleBranch}
      />
    );

    const yearCheckbox = screen.getByRole('checkbox', {
      name: /Select all topics in First Year/i,
    });
    expect(yearCheckbox).toBeInTheDocument();

    // Activating indeterminate parent selects all descendants (target = true)
    fireEvent.click(yearCheckbox);
    expect(handleToggleBranch).toHaveBeenCalledWith('yr_1', true);
  });

  it('opens and dismisses source evidence dialog displaying verbatim snippet and page', () => {
    render(
      <SyllabusTree
        syllabus={canonical5TierSyllabus}
        completedLeafIds={[]}
        nodeProgress={{}}
        onToggleLeaf={vi.fn()}
        onToggleBranch={vi.fn()}
      />
    );

    const evidenceBtn = screen.getByRole('button', {
      name: /Inspect source evidence for Arrays and Memory Representation/i,
    });
    expect(evidenceBtn).toBeInTheDocument();
    expect(evidenceBtn).toHaveTextContent('p.3');

    // Open evidence modal
    fireEvent.click(evidenceBtn);
    expect(screen.getByText('Source Evidence & Grounding')).toBeInTheDocument();
    expect(
      screen.getByText('Arrays are contiguous memory blocks in heap or stack.')
    ).toBeInTheDocument();
    expect(screen.getByText('Page: 3')).toBeInTheDocument();

    // Close modal
    const closeBtn = screen.getByRole('button', { name: /Close modal/i });
    fireEvent.click(closeBtn);
    expect(screen.queryByText('Source Evidence & Grounding')).not.toBeInTheDocument();
  });

  it('renders lab badge and keeps lab course collapsed by default', () => {
    const syllabusWithLab: HierarchicalSyllabus = {
      id: 'syl_lab_test',
      title: 'Lab & Theory Program',
      source_filename: 'labs.pdf',
      schema_version: 2,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
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
                  id: 'subj_theory',
                  code: 'CS101',
                  title: 'Theory of Computation',
                  is_lab: false,
                  is_enrolled: true,
                  modules: [
                    {
                      id: 'mod_th1',
                      title: 'Automata Theory',
                      contact_hours: 4,
                      topics: [
                        {
                          id: 'top_dfa',
                          title: 'Deterministic Finite Automata',
                          source_text: 'DFA definitions',
                        },
                      ],
                    },
                  ],
                },
                {
                  id: 'subj_lab',
                  code: 'CS101L',
                  title: 'Computing Systems Laboratory',
                  is_lab: true,
                  is_enrolled: true,
                  modules: [
                    {
                      id: 'mod_lab1',
                      title: 'Unix Command Line Lab',
                      contact_hours: 2,
                      topics: [
                        {
                          id: 'top_shell',
                          title: 'Shell Scripting Exercises',
                          source_text: 'Bash programming basics',
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

    render(
      <SyllabusTree
        syllabus={syllabusWithLab}
        completedLeafIds={[]}
        nodeProgress={{}}
        onToggleLeaf={vi.fn()}
        onToggleBranch={vi.fn()}
      />
    );

    // Theory course is open by default: its module and contact hours badge are visible
    expect(screen.getByText('Theory of Computation')).toBeInTheDocument();
    expect(screen.getByText('Automata Theory')).toBeInTheDocument();
    expect(screen.getByText('4 Contact Hrs')).toBeInTheDocument();
    const theoryToggle = screen.getByRole('button', {
      name: /Toggle Theory of Computation/i,
    });
    expect(theoryToggle).toHaveAttribute('aria-expanded', 'true');

    // Lab course displays Lab Course badge
    expect(screen.getByText('Computing Systems Laboratory')).toBeInTheDocument();
    expect(screen.getByText('Lab Course')).toBeInTheDocument();

    // Lab course is COLLAPSED by default (aria-expanded is false)
    const labToggle = screen.getByRole('button', {
      name: /Toggle Computing Systems Laboratory/i,
    });
    expect(labToggle).toHaveAttribute('aria-expanded', 'false');

    // Expanding lab course toggles aria-expanded to true
    fireEvent.click(labToggle);
    expect(labToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Unix Command Line Lab')).toBeInTheDocument();
    expect(screen.getByText('2 Contact Hrs')).toBeInTheDocument();
    expect(screen.getByText('Shell Scripting Exercises')).toBeInTheDocument();

    // Collapsing again sets aria-expanded back to false
    fireEvent.click(labToggle);
    expect(labToggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders PacingBadge on Semester and Subject containers and handles deadline interactions', async () => {
    const handleSet = vi.fn().mockResolvedValue(undefined);
    const handleClear = vi.fn().mockResolvedValue(undefined);

    const pacingData = {
      sem_1: {
        node_id: 'sem_1',
        target_date: '2026-12-15',
        days_remaining: 41,
        total_leaves: 2,
        completed_leaves: 0,
        remaining_leaves: 2,
        remaining_contact_hours: 8.0,
        topics_per_week: 0.3,
        hours_per_week: 1.4,
        status: 'on_track' as const,
      },
      subj_cs101: {
        node_id: 'subj_cs101',
        target_date: '2026-12-01',
        days_remaining: 27,
        total_leaves: 2,
        completed_leaves: 0,
        remaining_leaves: 2,
        remaining_contact_hours: 8.0,
        topics_per_week: 0.5,
        hours_per_week: 2.1,
        status: 'on_track' as const,
      },
    };

    render(
      <SyllabusTree
        syllabus={canonical5TierSyllabus}
        completedLeafIds={[]}
        nodeProgress={{}}
        pacingData={pacingData}
        onSetDeadline={handleSet}
        onClearDeadline={handleClear}
        onToggleLeaf={vi.fn()}
        onToggleBranch={vi.fn()}
      />
    );

    // Semester 1 renders its pacing badge
    expect(screen.getByTestId('pacing-badge-sem_1')).toBeInTheDocument();
    expect(screen.getByText('41d left')).toBeInTheDocument();

    // Subject cs101 renders its pacing badge
    expect(screen.getByTestId('pacing-badge-subj_cs101')).toBeInTheDocument();
    expect(screen.getByText('27d left')).toBeInTheDocument();

    // Clear deadline on Subject cs101
    const clearBtn = screen.getByTestId('pacing-badge-clear-btn-subj_cs101');
    await act(async () => {
      fireEvent.click(clearBtn);
    });

    const confirmBtn = screen.getByTestId('pacing-confirm-clear-btn-subj_cs101');
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    expect(handleClear).toHaveBeenCalledWith('subj_cs101');
  });
});

