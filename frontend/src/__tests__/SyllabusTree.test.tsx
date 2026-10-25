import '../setupTests';
import { fireEvent, render, screen } from '@testing-library/react';
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
    // sub_1 is checked
    expect(leafInputs[0]).toBeChecked();
    // sub_2 is unchecked
    expect(leafInputs[1]).not.toBeChecked();

    // Toggle sub_2
    fireEvent.click(leafInputs[1]);
    expect(handleToggleLeaf).toHaveBeenCalledWith('sub_2', true);
  });
});
