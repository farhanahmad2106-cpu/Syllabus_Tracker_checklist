import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FileUpload } from '../components/FileUpload';
import * as api from '../lib/api';
import type { ScrapePreview } from '../types/syllabus';

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual('../lib/api');
  return {
    ...actual,
    previewScrapeUrl: vi.fn(),
  };
});

describe('Web URL Scraper Ingestion Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('switches between Upload File and Web URL Scraper tabs', () => {
    const onUpload = vi.fn().mockResolvedValue({});
    const onIngestUrl = vi.fn().mockResolvedValue({});
    render(<FileUpload onUpload={onUpload} onIngestUrl={onIngestUrl} isUploading={false} />);

    // Initial tab is Upload File
    expect(screen.getByText(/Click to upload/i)).toBeInTheDocument();

    // Click Web URL Scraper tab
    const urlTab = screen.getByRole('tab', { name: /Web URL Scraper/i });
    fireEvent.click(urlTab);

    // URL input and inspect button should be visible
    expect(screen.getByLabelText(/University or Course Webpage URL/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Inspect Page/i })).toBeInTheDocument();

    // Click back to Upload File tab
    const uploadTab = screen.getByRole('tab', { name: /Upload File/i });
    fireEvent.click(uploadTab);
    expect(screen.getByText(/Click to upload/i)).toBeInTheDocument();
  });

  it('validates empty and malformed URLs before requesting preview', async () => {
    const onUpload = vi.fn().mockResolvedValue({});
    const onIngestUrl = vi.fn().mockResolvedValue({});
    render(<FileUpload onUpload={onUpload} onIngestUrl={onIngestUrl} isUploading={false} />);

    // Switch to URL tab
    fireEvent.click(screen.getByRole('tab', { name: /Web URL Scraper/i }));

    const urlInput = screen.getByLabelText(/University or Course Webpage URL/i);
    const inspectBtn = screen.getByRole('button', { name: /Inspect Page/i });

    // Empty URL
    fireEvent.change(urlInput, { target: { value: '   ' } });
    fireEvent.click(inspectBtn);
    expect(api.previewScrapeUrl).not.toHaveBeenCalled();

    // Non-http/https URL
    fireEvent.change(urlInput, { target: { value: 'ftp://university.edu/syllabus' } });
    fireEvent.click(inspectBtn);
    expect(await screen.findByRole('alert')).toHaveTextContent(/Only http:\/\/ and https:\/\/ URLs are supported/i);
    expect(api.previewScrapeUrl).not.toHaveBeenCalled();
  });

  it('fetches and displays preview card with discovered downloadable documents', async () => {
    const mockPreview: ScrapePreview = {
      url: 'https://university.edu/academics/btech',
      final_url: 'https://university.edu/academics/btech',
      resolved_title: 'B.Tech CSE Academic Regulations & Syllabus',
      content_type: 'text/html',
      source_kind: 'html',
      detected_embedded_files: [
        {
          url: 'https://university.edu/docs/btech-cse-detailed-syllabus.pdf',
          filename: 'btech-cse-detailed-syllabus.pdf',
          document_type: 'pdf',
          relevance_score: 95.0,
          relevance_label: 'High',
          display_title: 'Detailed B.Tech CSE Syllabus PDF',
        },
        {
          url: 'https://university.edu/docs/academic-calendar.pdf',
          filename: 'academic-calendar.pdf',
          document_type: 'pdf',
          relevance_score: 25.0,
          relevance_label: 'Medium',
          display_title: 'Academic Calendar 2024',
        },
      ],
      content_preview: '# Computer Science Curriculum\nSemester 1 to Semester 8',
      warnings: [],
      requires_document_selection: false,
      preview_token: 'tok_abc123',
    };

    vi.mocked(api.previewScrapeUrl).mockResolvedValue(mockPreview);

    const onUpload = vi.fn().mockResolvedValue({});
    const onIngestUrl = vi.fn().mockResolvedValue({});
    render(<FileUpload onUpload={onUpload} onIngestUrl={onIngestUrl} isUploading={false} />);

    fireEvent.click(screen.getByRole('tab', { name: /Web URL Scraper/i }));

    const urlInput = screen.getByLabelText(/University or Course Webpage URL/i);
    fireEvent.change(urlInput, { target: { value: 'https://university.edu/academics/btech' } });

    fireEvent.click(screen.getByRole('button', { name: /Inspect Page/i }));

    // Verify preview card renders
    await waitFor(() => {
      expect(screen.getByText('B.Tech CSE Academic Regulations & Syllabus')).toBeInTheDocument();
    });

    expect(screen.getByText(/Detailed B\.Tech CSE Syllabus PDF/i)).toBeInTheDocument();
    expect(screen.getByText(/High Match/i)).toBeInTheDocument();
    expect(screen.getByText(/Academic Calendar 2024/i)).toBeInTheDocument();
    expect(screen.getByText(/Use HTML Webpage Content Directly/i)).toBeInTheDocument();

    // Verify external link attributes
    const externalLink = screen.getByRole('link', { name: /https:\/\/university\.edu\/academics\/btech/i });
    expect(externalLink).toHaveAttribute('target', '_blank');
    expect(externalLink).toHaveAttribute('rel', 'noopener noreferrer');

    // Click Start Curriculum Extraction
    const startBtn = screen.getByRole('button', { name: /Start Curriculum Extraction/i });
    fireEvent.click(startBtn);

    expect(onIngestUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://university.edu/academics/btech',
        follow_embedded_pdf: true,
        selected_document_url: 'https://university.edu/docs/btech-cse-detailed-syllabus.pdf',
        preview_token: 'tok_abc123',
      })
    );
  });

  it('handles preview inspection failure and displays actionable error banner', async () => {
    vi.mocked(api.previewScrapeUrl).mockRejectedValue(new Error('Connection to prohibited private IP address blocked.'));

    const onUpload = vi.fn().mockResolvedValue({});
    const onIngestUrl = vi.fn().mockResolvedValue({});
    render(<FileUpload onUpload={onUpload} onIngestUrl={onIngestUrl} isUploading={false} />);

    fireEvent.click(screen.getByRole('tab', { name: /Web URL Scraper/i }));

    const urlInput = screen.getByLabelText(/University or Course Webpage URL/i);
    fireEvent.change(urlInput, { target: { value: 'http://192.168.1.1' } });

    fireEvent.click(screen.getByRole('button', { name: /Inspect Page/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/prohibited private IP address blocked/i);
    expect(screen.queryByText(/Start Curriculum Extraction/i)).not.toBeInTheDocument();
  });
});

