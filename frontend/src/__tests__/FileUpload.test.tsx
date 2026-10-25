import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FileUpload } from '../components/FileUpload';

describe('FileUpload Component', () => {
  it('renders initial dropzone with instruction', () => {
    const onUpload = vi.fn().mockResolvedValue({});
    render(<FileUpload onUpload={onUpload} isUploading={false} />);

    expect(screen.getByText(/Click to upload/i)).toBeInTheDocument();
    expect(screen.getByText(/Supports digital PDF, DOCX, DOC, and TXT/i)).toBeInTheDocument();
  });

  it('rejects unsupported file extension immediately without triggering onUpload', () => {
    const onUpload = vi.fn().mockResolvedValue({});
    render(<FileUpload onUpload={onUpload} isUploading={false} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    const file = new File(['echo hello'], 'script.exe', { type: 'application/x-msdownload' });
    fireEvent.change(input, { target: { files: [file] } });

    expect(onUpload).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/Unsupported format '\.exe'/i);
  });

  it('rejects empty 0-byte file', () => {
    const onUpload = vi.fn().mockResolvedValue({});
    render(<FileUpload onUpload={onUpload} isUploading={false} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const emptyFile = new File([], 'empty.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [emptyFile] } });

    expect(onUpload).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/Selected file is empty/i);
  });

  it('rejects files exceeding 50 MiB limit client-side', () => {
    const onUpload = vi.fn().mockResolvedValue({});
    render(<FileUpload onUpload={onUpload} isUploading={false} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const oversizedFile = new File(['a'], 'huge.pdf', { type: 'application/pdf' });
    Object.defineProperty(oversizedFile, 'size', { value: 55 * 1024 * 1024 });

    fireEvent.change(input, { target: { files: [oversizedFile] } });

    expect(onUpload).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/exceeds 50 MiB limit/i);
  });

  it('shows loading state and Cancel button when isUploading is true', () => {
    const onUpload = vi.fn().mockResolvedValue({});
    const onCancel = vi.fn();
    render(<FileUpload onUpload={onUpload} isUploading={true} onCancel={onCancel} />);

    expect(screen.getByText(/Extracting Syllabus Curriculum\.\.\./i)).toBeInTheDocument();
    expect(screen.getByText(/Parsing layout and verifying source grounding/i)).toBeInTheDocument();

    const cancelBtn = screen.getByRole('button', { name: /Cancel Upload/i });
    expect(cancelBtn).toBeInTheDocument();
    fireEvent.click(cancelBtn);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('renders actionable error and Retry button on upload rejection', async () => {
    const onUpload = vi.fn().mockRejectedValue(new Error('Backend processing timeout'));
    render(<FileUpload onUpload={onUpload} isUploading={false} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['valid syllabus content'], 'syllabus.txt', { type: 'text/plain' });
    fireEvent.change(input, { target: { files: [file] } });

    expect(onUpload).toHaveBeenCalledWith(file);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Backend processing timeout/i);
    });

    const retryBtn = screen.getByRole('button', { name: /Retry/i });
    expect(retryBtn).toBeInTheDocument();

    onUpload.mockResolvedValueOnce({});
    fireEvent.click(retryBtn);
    expect(onUpload).toHaveBeenCalledTimes(2);
  });

  it('renders real-time progress percentage, stage indicator, and aria attributes', () => {
    const onUpload = vi.fn().mockResolvedValue({});
    const progress = {
      job_id: 'test-job-123',
      stage: 'extracting' as const,
      percent: 54,
      message: 'Extracting Semester 2 curriculum: chunk 3 of 7.',
      result: null,
      error: null,
    };

    render(
      <FileUpload
        onUpload={onUpload}
        isUploading={true}
        uploadProgress={progress}
      />
    );

    expect(screen.getByText('54%')).toBeInTheDocument();
    expect(screen.getByText(/Stage: extracting/i)).toBeInTheDocument();
    expect(screen.getByText(/Extracting Semester 2 curriculum: chunk 3 of 7\./i)).toBeInTheDocument();

    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '54');
    expect(progressbar).toHaveAttribute('aria-valuemin', '0');
    expect(progressbar).toHaveAttribute('aria-valuemax', '100');
  });

  it('ensures percentage is monotonic and does not decrease', () => {
    const onUpload = vi.fn().mockResolvedValue({});
    const progressHigh = {
      job_id: 'test-job-123',
      stage: 'extracting' as const,
      percent: 65,
      message: 'Chunk 4 of 6',
      result: null,
      error: null,
    };

    const { rerender } = render(
      <FileUpload
        onUpload={onUpload}
        isUploading={true}
        uploadProgress={progressHigh}
      />
    );

    expect(screen.getByText('65%')).toBeInTheDocument();

    // Rerender with lower percentage
    const progressLow = {
      ...progressHigh,
      percent: 40,
    };

    rerender(
      <FileUpload
        onUpload={onUpload}
        isUploading={true}
        uploadProgress={progressLow}
      />
    );

    // Still displays 65% because of monotonic protection
    expect(screen.getByText('65%')).toBeInTheDocument();
    expect(screen.queryByText('40%')).not.toBeInTheDocument();
  });
});
