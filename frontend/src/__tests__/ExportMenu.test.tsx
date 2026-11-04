import '../setupTests';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ExportMenu } from '../components/ExportMenu';
import * as api from '../lib/api';

vi.mock('../lib/api', () => ({
  downloadExportMarkdown: vi.fn(),
  downloadExportJson: vi.fn(),
  openPrintableHtml: vi.fn(),
  restoreSyllabusBackupFile: vi.fn(),
}));

describe('ExportMenu Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Export & Backup trigger button and toggles dropdown', () => {
    render(
      <ExportMenu
        syllabusId="syl_123"
        syllabusTitle="Computer Networks"
        onRestoreSuccess={vi.fn()}
      />
    );

    const trigger = screen.getByRole('button', { name: /Export & Backup options/i });
    expect(trigger).toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.getByText('Export Markdown (.md)')).toBeInTheDocument();
    expect(screen.getByText('Download Backup (.json)')).toBeInTheDocument();
    expect(screen.getByText('Print / Save PDF (HTML)')).toBeInTheDocument();
    expect(screen.getByText('Restore from Backup...')).toBeInTheDocument();
  });

  it('triggers downloadExportMarkdown when Markdown option is clicked', async () => {
    vi.mocked(api.downloadExportMarkdown).mockResolvedValue(undefined);

    render(
      <ExportMenu
        syllabusId="syl_123"
        syllabusTitle="Computer Networks"
        onRestoreSuccess={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Export & Backup options/i }));
    fireEvent.click(screen.getByText('Export Markdown (.md)'));

    await waitFor(() => {
      expect(api.downloadExportMarkdown).toHaveBeenCalledWith(
        'syl_123',
        expect.objectContaining({ include_notes: true })
      );
    });
  });

  it('triggers downloadExportJson when JSON option is clicked', async () => {
    vi.mocked(api.downloadExportJson).mockResolvedValue(undefined);

    render(
      <ExportMenu
        syllabusId="syl_123"
        syllabusTitle="Computer Networks"
        onRestoreSuccess={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Export & Backup options/i }));
    fireEvent.click(screen.getByText('Download Backup (.json)'));

    await waitFor(() => {
      expect(api.downloadExportJson).toHaveBeenCalledWith(
        'syl_123',
        expect.objectContaining({ include_notes: true })
      );
    });
  });

  it('opens printable HTML report in a new tab', () => {
    render(
      <ExportMenu
        syllabusId="syl_123"
        syllabusTitle="Computer Networks"
        onRestoreSuccess={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Export & Backup options/i }));
    fireEvent.click(screen.getByText('Print / Save PDF (HTML)'));

    expect(api.openPrintableHtml).toHaveBeenCalledWith(
      'syl_123',
      expect.objectContaining({ include_notes: true })
    );
  });

  it('opens restore modal and restores backup in clone mode', async () => {
    const handleRestoreSuccess = vi.fn();
    vi.mocked(api.restoreSyllabusBackupFile).mockResolvedValue({
      success: true,
      syllabus_id: 'syl_cloned_999',
      restored_completed_leaves: 5,
      restored_notes: 2,
      restored_resources: 3,
      restored_deadlines: 1,
      warnings: [],
    });

    render(
      <ExportMenu
        syllabusId="syl_123"
        syllabusTitle="Computer Networks"
        onRestoreSuccess={handleRestoreSuccess}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Export & Backup options/i }));
    fireEvent.click(screen.getByText('Restore from Backup...'));

    expect(screen.getByText('Restore Syllabus Backup')).toBeInTheDocument();

    // Select file
    const file = new File(['{"schema_version": "2.1"}'], 'backup.json', {
      type: 'application/json',
    });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Execute restore
    const executeBtn = screen.getByRole('button', { name: /Execute Restore/i });
    fireEvent.click(executeBtn);

    await waitFor(() => {
      expect(api.restoreSyllabusBackupFile).toHaveBeenCalledWith(file, 'clone', undefined);
      expect(screen.getByText('Restoration Successful!')).toBeInTheDocument();
    });
  });
});

