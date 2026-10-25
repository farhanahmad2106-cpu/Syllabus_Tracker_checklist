import React, { useRef, useState } from 'react';
import { Loader2, Upload, AlertTriangle, RotateCw, XCircle } from 'lucide-react';

interface FileUploadProps {
  onUpload: (file: File) => Promise<unknown>;
  isUploading: boolean;
  onCancel?: () => void;
}

const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50 MiB
const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.txt', '.doc'];

export const FileUpload: React.FC<FileUploadProps> = ({ onUpload, isUploading, onCancel }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [lastSelectedFile, setLastSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAndUpload = (file: File) => {
    setLocalError(null);
    setLastSelectedFile(file);

    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      setLocalError(`Unsupported format '${ext}'. Please upload a PDF, DOCX, DOC, or TXT syllabus.`);
      return;
    }

    if (file.size > MAX_SIZE_BYTES) {
      setLocalError(
        `File size exceeds 50 MiB limit (${(file.size / (1024 * 1024)).toFixed(1)} MiB).`
      );
      return;
    }

    if (file.size === 0) {
      setLocalError('Selected file is empty (0 bytes).');
      return;
    }

    onUpload(file).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Upload failed. Please check the file and try again.';
      setLocalError(msg);
    });
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (isUploading) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndUpload(e.target.files[0]);
    }
  };

  const handleRetry = () => {
    if (lastSelectedFile && !isUploading) {
      validateAndUpload(lastSelectedFile);
    }
  };

  return (
    <div className="w-full space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!isUploading) setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${
          isDragOver
            ? 'border-emerald-400 bg-emerald-950/20 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
            : isUploading
            ? 'border-emerald-500/50 bg-gray-900/80 cursor-wait'
            : 'border-gray-700 hover:border-gray-500 bg-gray-900/40 hover:bg-gray-800/40'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt,.doc"
          onChange={handleFileChange}
          disabled={isUploading}
          className="hidden"
          id="syllabus-file-input"
        />

        {isUploading ? (
          <div className="flex flex-col items-center gap-3 py-2 text-emerald-400 w-full text-center">
            <Loader2 className="w-8 h-8 animate-spin" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-gray-200">
                Extracting Syllabus Curriculum...
              </p>
              <p className="text-xs text-gray-400">
                Parsing layout and verifying source grounding via local Ollama LLM
              </p>
            </div>

            {onCancel && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCancel();
                }}
                className="mt-2 inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-rose-300 bg-rose-950/50 hover:bg-rose-900/50 border border-rose-800/60 rounded-lg transition-colors cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Cancel Upload</span>
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2.5 text-center">
            <div className="p-3 bg-gray-800/80 border border-gray-700/80 rounded-xl text-emerald-400 shadow-inner">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-200">
                <span className="text-emerald-400 font-semibold underline decoration-emerald-500/40 underline-offset-4">
                  Click to upload
                </span>{' '}
                or drag and drop your syllabus
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Supports digital PDF, DOCX, DOC, and TXT (Max 25 MiB)
              </p>
            </div>
          </div>
        )}
      </div>

      {localError && (
        <div
          role="alert"
          aria-live="assertive"
          className="flex items-start justify-between gap-2 p-3 text-xs text-amber-200 bg-amber-950/40 border border-amber-800/60 rounded-xl"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
            <span className="leading-relaxed">{localError}</span>
          </div>
          {lastSelectedFile && !isUploading && (
            <button
              type="button"
              onClick={handleRetry}
              className="inline-flex items-center gap-1 px-2.5 py-1 shrink-0 font-medium text-amber-300 bg-amber-900/50 hover:bg-amber-800/60 border border-amber-700/60 rounded-lg transition-colors cursor-pointer"
            >
              <RotateCw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
