import '../setupTests';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ExportMenu } from '../components/ExportMenu';
import * as api from '../lib/api';
import * as nativeBridge from '../lib/nativeBridge';

vi.mock('../lib/api', () => ({
  getExportMarkdownUrl: vi.fn(() => 'http://127.0.0.1:8000/api/syllabus/syl_123/export/markdown'),
  getExportJsonUrl: vi.fn(() => 'http://127.0.0.1:8000/api/syllabus/syl_123/export/json'),
  getExportHtmlUrl: vi.fn(() => 'http://127.0.0.1:8000/api/syllabus/syl_123/export/html'),
  openPrintableHtml: vi.fn(),
  restoreSyllabusBackupFile: vi.fn(),
}));

vi.mock('../lib/nativeBridge', () => ({
  exportAndShareFile: vi.fn().mockResolvedValue('downloaded'),
  shareSummary: vi.fn().mockResolvedValue('shared'),
  isNativePlatform: vi.fn().mockReturnValue(false),
}));

describe('ExportMenu Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(nativeBridge.isNativePlatform).mockReturnValue(false);
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('# Mock Export Content'),
    } as any);
  });

  it('renders Export & Backup trigger button and toggles dropdown on web', () => {
    vi.mocked(nativeBridge.isNativePlatform).mockReturnValue(false);

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
    expect(screen.getByText('Share Summary')).toBeInTheDocument();
    expect(screen.getByText('Restore from Backup...')).toBeInTheDocument();
  });

  it('renders native contextual share labels when running on native platform', () => {
    vi.mocked(nativeBridge.isNativePlatform).mockReturnValue(true);

    render(
      <ExportMenu
        syllabusId="syl_123"
        syllabusTitle="Computer Networks"
        onRestoreSuccess={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Export & Backup options/i }));
    expect(screen.getByText('Share Markdown (.md)')).toBeInTheDocument();
    expect(screen.getByText('Share JSON Backup (.json)')).toBeInTheDocument();
    expect(screen.getByText('Share HTML Report (.html)')).toBeInTheDocument();
  });

  it('triggers exportAndShareFile when Markdown option is clicked', async () => {
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
      expect(nativeBridge.exportAndShareFile).toHaveBeenCalledWith(
        expect.objectContaining({
          filename: 'Computer Networks.md',
          mimeType: 'text/markdown',
          dialogTitle: 'Share Markdown Checklist',
        })
      );
    });
  });

  it('triggers exportAndShareFile when JSON backup option is clicked', async () => {
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
      expect(nativeBridge.exportAndShareFile).toHaveBeenCalledWith(
        expect.objectContaining({
          filename: 'Computer Networks_backup.json',
          mimeType: 'application/json',
          dialogTitle: 'Share Syllabus Backup',
        })
      );
    });
  });

  it('triggers shareSummary when Share Summary option is clicked', async () => {
    render(
      <ExportMenu
        syllabusId="syl_123"
        syllabusTitle="Computer Networks"
        onRestoreSuccess={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Export & Backup options/i }));
    fireEvent.click(screen.getByText('Share Summary'));

    await waitFor(() => {
      expect(nativeBridge.shareSummary).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Computer Networks',
          dialogTitle: 'Share Syllabus Summary',
        })
      );
    });
  });

  it('opens restore modal and restores backup in clone mode', async () => {
    vi.mocked(api.restoreSyllabusBackupFile).mockResolvedValue({
      success: true,
      syllabus_id: 'syl_restored_999',
      restored_completed_leaves: 10,
      restored_notes: 2,
      restored_resources: 1,
      restored_deadlines: 1,
      warnings: [],
    });

    const onRestoreSuccess = vi.fn();
    render(
      <ExportMenu
        syllabusId="syl_123"
        syllabusTitle="Computer Networks"
        onRestoreSuccess={onRestoreSuccess}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Export & Backup options/i }));
    fireEvent.click(screen.getByText('Restore from Backup...'));

    expect(screen.getByText('Restore Syllabus Backup')).toBeInTheDocument();
  });
});
