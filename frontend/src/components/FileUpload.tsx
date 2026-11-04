import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Upload,
  Globe,
  Search,
  AlertTriangle,
  RotateCw,
  XCircle,
  FileText,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';
import { previewScrapeUrl } from '../lib/api';
import type {
  EmbeddedDocumentPreview,
  IngestUrlPayload,
  ScrapePreview,
  UploadProgress,
} from '../types/syllabus';

interface FileUploadProps {
  onUpload: (file: File) => Promise<unknown>;
  onIngestUrl?: (payload: IngestUrlPayload) => Promise<unknown>;
  isUploading: boolean;
  uploadProgress?: UploadProgress | null;
  onCancel?: () => void;
}

const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50 MiB
const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.txt', '.doc'];

export const FileUpload: React.FC<FileUploadProps> = ({
  onUpload,
  onIngestUrl,
  isUploading,
  uploadProgress,
  onCancel,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'url'>('upload');

  // File Upload State
  const [isDragOver, setIsDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [lastSelectedFile, setLastSelectedFile] = useState<File | null>(null);
  const [maxObservedPercent, setMaxObservedPercent] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Web URL Scraper State
  const [targetUrl, setTargetUrl] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [followEmbeddedPdf, setFollowEmbeddedPdf] = useState(true);
  const [selectedDocUrl, setSelectedDocUrl] = useState<string | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [previewData, setPreviewData] = useState<ScrapePreview | null>(null);
  const [inspectError, setInspectError] = useState<string | null>(null);
  const inspectAbortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (uploadProgress && uploadProgress.percent > maxObservedPercent) {
      setMaxObservedPercent(uploadProgress.percent);
    }
    if (!isUploading) {
      setMaxObservedPercent(0);
    }
  }, [uploadProgress, isUploading, maxObservedPercent]);

  const currentPercent = useMemo(() => {
    if (!uploadProgress) return maxObservedPercent;
    const raw = Math.max(0, Math.min(100, uploadProgress.percent));
    return Math.max(maxObservedPercent, raw);
  }, [uploadProgress, maxObservedPercent]);

  const currentStage = uploadProgress?.stage || 'processing';
  const stageDisplay = currentStage.replace(/_/g, ' ');

  // File Upload Handlers
  const validateAndUpload = (file: File) => {
    setLocalError(null);
    setLastSelectedFile(file);
    setMaxObservedPercent(0);

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

  // URL Scraper Handlers
  const handleInspectUrl = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = targetUrl.trim();
    if (!trimmed) {
      setInspectError('Please enter a valid HTTP or HTTPS webpage URL.');
      return;
    }

    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        setInspectError('Only http:// and https:// URLs are supported.');
        return;
      }
    } catch {
      setInspectError('Please enter a valid URL syntax (e.g. https://university.edu/syllabus).');
      return;
    }

    if (inspectAbortControllerRef.current) {
      inspectAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    inspectAbortControllerRef.current = controller;

    setIsInspecting(true);
    setInspectError(null);
    setPreviewData(null);
    setSelectedDocUrl(null);

    try {
      const preview = await previewScrapeUrl(
        {
          url: trimmed,
          follow_embedded_pdf: followEmbeddedPdf,
          custom_title: customTitle.trim() || undefined,
        },
        controller.signal
      );
      setPreviewData(preview);

      // Pre-select the highest confidence discovered document if available
      if (preview.detected_embedded_files && preview.detected_embedded_files.length > 0) {
        const topDoc = preview.detected_embedded_files[0];
        if (topDoc.relevance_score >= 50) {
          setSelectedDocUrl(topDoc.url);
        }
      }
    } catch (err: unknown) {
      if (controller.signal.aborted) return;
      const msg = err instanceof Error ? err.message : 'Failed to inspect webpage URL.';
      setInspectError(msg);
    } finally {
      setIsInspecting(false);
    }
  };

  const handleStartIngestUrl = () => {
    if (!onIngestUrl || !targetUrl.trim()) return;

    setInspectError(null);
    setMaxObservedPercent(0);

    onIngestUrl({
      url: targetUrl.trim(),
      follow_embedded_pdf: followEmbeddedPdf,
      custom_title: customTitle.trim() || undefined,
      selected_document_url: selectedDocUrl || undefined,
      preview_token: previewData?.preview_token || undefined,
    }).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Web ingestion failed.';
      setInspectError(msg);
    });
  };

  // Shared Progress View (active whenever job is processing)
  if (isUploading) {
    return (
      <div className="w-full max-w-md py-4 px-2 space-y-3.5 mx-auto">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-emerald-400 text-sm">
            {currentPercent}%
          </span>
          <span className="capitalize px-2.5 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 font-mono text-[10px] tracking-wide border border-emerald-800/50 shadow-sm">
            Stage: {stageDisplay}
          </span>
        </div>

        <div
          className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-800 border border-zinc-700/60"
          role="progressbar"
          aria-label="Syllabus ingestion progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={currentPercent}
          aria-valuetext={`${currentPercent}%: ${uploadProgress?.message || 'Processing syllabus'}`}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-[width] duration-300 ease-out shadow-[0_0_12px_rgba(16,185,129,0.4)]"
            style={{ width: `${currentPercent}%` }}
          />
        </div>

        <div className="space-y-1 text-center">
          <p className="text-sm font-semibold text-gray-200">
            {uploadProgress?.stage === 'completed'
              ? 'Syllabus Extracted Successfully!'
              : 'Extracting Syllabus Curriculum...'}
          </p>
          <p
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="text-xs text-zinc-300 leading-relaxed font-medium min-h-[1.25rem]"
          >
            {uploadProgress?.message ||
              'Parsing layout and verifying source grounding via local Ollama LLM'}
          </p>
        </div>

        {onCancel && (
          <div className="flex justify-center pt-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCancel();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-rose-300 bg-rose-950/50 hover:bg-rose-900/50 border border-rose-800/60 rounded-lg transition-colors cursor-pointer"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Cancel Upload</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-800" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'upload'}
          onClick={() => {
            setActiveTab('upload');
            setLocalError(null);
          }}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'upload'
              ? 'border-emerald-500 text-emerald-400 bg-emerald-950/10'
              : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-700'
          }`}
        >
          <Upload className="w-4 h-4" />
          <span>Upload File</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'url'}
          onClick={() => {
            setActiveTab('url');
            setInspectError(null);
          }}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'url'
              ? 'border-emerald-500 text-emerald-400 bg-emerald-950/10'
              : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-700'
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>Web URL Scraper</span>
        </button>
      </div>

      {/* Tab 1: Upload File */}
      {activeTab === 'upload' && (
        <div className="space-y-3">
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
                  Supports digital PDF, DOCX, DOC, and TXT (Max 50 MiB)
                </p>
              </div>
            </div>
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
      )}

      {/* Tab 2: Web URL Scraper */}
      {activeTab === 'url' && (
        <div className="space-y-4">
          <form onSubmit={handleInspectUrl} className="space-y-3">
            <div>
              <label
                htmlFor="web-scraper-url-input"
                className="block text-xs font-semibold text-gray-300 mb-1"
              >
                University or Course Webpage URL
              </label>
              <div className="relative flex items-center">
                <input
                  id="web-scraper-url-input"
                  type="url"
                  value={targetUrl}
                  onChange={(e) => {
                    setTargetUrl(e.target.value);
                    if (inspectError) setInspectError(null);
                  }}
                  placeholder="https://university.edu/academics/btech-cse-curriculum"
                  disabled={isInspecting}
                  className="w-full px-3.5 py-2 pl-9 bg-gray-900 border border-gray-700 rounded-xl text-sm text-gray-100 placeholder-gray-500 focus:outline-hidden focus:border-emerald-500"
                />
                <Globe className="w-4 h-4 text-gray-400 absolute left-3 pointer-events-none" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="web-scraper-custom-title"
                  className="block text-xs font-medium text-gray-400 mb-1"
                >
                  Custom Title (Optional)
                </label>
                <input
                  id="web-scraper-custom-title"
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="e.g. B.Tech Computer Science 2024"
                  disabled={isInspecting}
                  className="w-full px-3 py-1.5 bg-gray-900 border border-gray-700 rounded-xl text-xs text-gray-100 placeholder-gray-500 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center pt-4">
                <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={followEmbeddedPdf}
                    onChange={(e) => setFollowEmbeddedPdf(e.target.checked)}
                    disabled={isInspecting}
                    className="w-4 h-4 rounded-sm border-gray-700 bg-gray-900 text-emerald-500 focus:ring-emerald-400"
                  />
                  <span>Auto-discover & prefer linked syllabus PDF/DOCX</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-gray-500">
                Safe SSRF sandbox. Downloads direct webpages or discovered syllabi up to 10 MiB.
              </span>
              <button
                type="submit"
                disabled={isInspecting || !targetUrl.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isInspecting ? (
                  <>
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Inspecting...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-3.5 h-3.5" />
                    <span>Inspect Page</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Inspection Error Banner */}
          {inspectError && (
            <div
              role="alert"
              className="flex items-start gap-2 p-3 text-xs text-rose-200 bg-rose-950/40 border border-rose-800/60 rounded-xl"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span className="leading-relaxed">{inspectError}</span>
            </div>
          )}

          {/* Inspection Preview Card */}
          {previewData && (
            <div className="p-4 bg-gray-900/90 border border-gray-700/80 rounded-2xl space-y-3.5 shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs px-2 py-0.5 rounded-full font-mono uppercase bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                      {previewData.source_kind.toUpperCase()}
                    </span>
                    <h3 className="text-sm font-semibold text-gray-100 truncate">
                      {previewData.resolved_title}
                    </h3>
                  </div>
                  <p className="text-xs text-gray-400 truncate mt-1 flex items-center gap-1">
                    <span>Source:</span>
                    <a
                      href={previewData.final_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-400 hover:underline inline-flex items-center gap-0.5"
                    >
                      {previewData.final_url}
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </p>
                </div>
              </div>

              {/* Warnings from preview */}
              {previewData.warnings && previewData.warnings.length > 0 && (
                <div className="p-2.5 bg-amber-950/40 border border-amber-800/50 rounded-xl text-xs text-amber-200 flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400 mt-0.5" />
                  <div className="space-y-0.5">
                    {previewData.warnings.map((w, idx) => (
                      <p key={idx}>{w}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* Discovered Downloadable Documents */}
              {previewData.detected_embedded_files &&
                previewData.detected_embedded_files.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-300">
                      Discovered Syllabus Documents ({previewData.detected_embedded_files.length})
                    </p>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                      {previewData.detected_embedded_files.map((doc: EmbeddedDocumentPreview) => (
                        <label
                          key={doc.url}
                          className={`flex items-center justify-between p-2 rounded-xl border text-xs cursor-pointer transition-colors ${
                            selectedDocUrl === doc.url
                              ? 'border-emerald-500 bg-emerald-950/30 text-emerald-200'
                              : 'border-gray-800 bg-gray-800/40 hover:bg-gray-800/70 text-gray-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <input
                              type="radio"
                              name="selected_document"
                              checked={selectedDocUrl === doc.url}
                              onChange={() => setSelectedDocUrl(doc.url)}
                              className="text-emerald-500 focus:ring-emerald-400"
                            />
                            <FileText className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span className="truncate font-medium">{doc.display_title}</span>
                          </div>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0 ml-2 ${
                              doc.relevance_label === 'High'
                                ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700/60'
                                : 'bg-gray-700/60 text-gray-400'
                            }`}
                          >
                            {doc.relevance_label} Match
                          </span>
                        </label>
                      ))}

                      <label
                        className={`flex items-center gap-2 p-2 rounded-xl border text-xs cursor-pointer transition-colors ${
                          selectedDocUrl === null
                            ? 'border-emerald-500 bg-emerald-950/30 text-emerald-200'
                            : 'border-gray-800 bg-gray-800/40 hover:bg-gray-800/70 text-gray-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="selected_document"
                          checked={selectedDocUrl === null}
                          onChange={() => setSelectedDocUrl(null)}
                          className="text-emerald-500 focus:ring-emerald-400"
                        />
                        <Globe className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span>Use HTML Webpage Content Directly</span>
                      </label>
                    </div>
                  </div>
                )}

              {/* Text Snippet Preview */}
              {previewData.content_preview && (
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Content Preview
                  </p>
                  <pre className="text-xs bg-gray-950/80 p-2.5 rounded-xl border border-gray-800 text-gray-300 max-h-28 overflow-y-auto font-mono whitespace-pre-wrap">
                    {previewData.content_preview}
                  </pre>
                </div>
              )}

              {/* Confirmation Action */}
              <div className="flex items-center justify-end gap-2 pt-1 border-t border-gray-800">
                <button
                  type="button"
                  onClick={handleStartIngestUrl}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl shadow-md transition-all cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Start Curriculum Extraction</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
