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
});
