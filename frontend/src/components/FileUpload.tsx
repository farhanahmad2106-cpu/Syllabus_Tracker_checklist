import React, { useRef, useState } from 'react';
import { Loader2, Upload, AlertTriangle } from 'lucide-react';

interface FileUploadProps {
  onUpload: (file: File) => Promise<unknown>;
  isUploading: boolean;
}

const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 MiB
const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.txt'];

export const FileUpload: React.FC<FileUploadProps> = ({ onUpload, isUploading }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAndUpload = (file: File) => {
    setLocalError(null);

    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      setLocalError(`Unsupported format '${ext}'. Please upload a PDF, DOCX, or TXT syllabus.`);
      return;
    }

    if (file.size > MAX_SIZE_BYTES) {
      setLocalError(`File size exceeds 20 MiB limit (${(file.size / (1024 * 1024)).toFixed(1)} MiB).`);
      return;
    }

    if (file.size === 0) {
      setLocalError('Selected file is empty (0 bytes).');
      return;
    }

    onUpload(file).catch(() => {
      // Parent handles detailed API error
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

  return (
    <div className="w-full space-y-2">
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
            ? 'border-gray-700 bg-gray-900/60 cursor-not-allowed'
            : 'border-gray-700 hover:border-gray-500 bg-gray-900/40 hover:bg-gray-800/40'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt"
          onChange={handleFileChange}
          disabled={isUploading}
          className="hidden"
          id="syllabus-file-input"
        />

        {isUploading ? (
          <div className="flex flex-col items-center gap-3 py-2 text-emerald-400">
            <Loader2 className="w-8 h-8 animate-spin" />
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-200">
                Extracting Syllabus Curriculum...
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Parsing layout and verifying source grounding via local Ollama LLM
              </p>
            </div>
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
                Supports PDF, DOCX, and TXT (Max 20 MiB)
              </p>
            </div>
          </div>
        )}
      </div>

      {localError && (
        <div className="flex items-center gap-2 p-2.5 text-xs text-amber-300 bg-amber-950/50 border border-amber-800/60 rounded-xl">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
          <span>{localError}</span>
        </div>
      )}
    </div>
  );
};
