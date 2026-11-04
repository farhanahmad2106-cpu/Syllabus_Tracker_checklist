/**
 * Typed API client for Syllabus Tracker backend endpoints.
 */

import type {
  AddResourcePayload,
  AppConfigResponse,
  BackupRestorePayload,
  BackupRestoreResult,
  ExportOptions,
  HealthResponse,
  PacingMetrics,
  ParseReviewResponse,
  SetTargetDatePayload,
  StartUploadResponse,
  SyllabusPacingSummary,
  SyllabusResponse,
  SyllabusSummary,
  TopicNote,
  TopicResource,
  UploadProgress,
} from '../types/syllabus';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';

export class ApiError extends Error {
  status: number;
  errorType?: string;
  code?: string;
  detail: string;
  retryable?: boolean;

  constructor(
    status: number,
    message: string,
    errorType?: string,
    code?: string,
    retryable?: boolean
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errorType = errorType;
    this.code = code;
    this.detail = message;
    this.retryable = retryable;
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = `HTTP Error ${response.status}: ${response.statusText}`;
    let errorType = 'HttpError';
    let code: string | undefined = undefined;
    let retryable: boolean | undefined = undefined;

    try {
      const data = await response.json();
      if (data.detail) {
        errorMessage = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
      }
      if (data.error_type) {
        errorType = data.error_type;
      }
      if (data.code) {
        code = data.code;
      }
      if (typeof data.retryable === 'boolean') {
        retryable = data.retryable;
      }
    } catch {
      // response wasn't JSON
    }

    throw new ApiError(response.status, errorMessage, errorType, code, retryable);
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json();
}

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/health`);
  return handleResponse<HealthResponse>(res);
}

export async function fetchConfig(): Promise<AppConfigResponse> {
  const res = await fetch(`${API_BASE}/config`);
  return handleResponse<AppConfigResponse>(res);
}

export async function fetchSyllabiList(): Promise<SyllabusSummary[]> {
  const res = await fetch(`${API_BASE}/syllabi`);
  return handleResponse<SyllabusSummary[]>(res);
}

export async function fetchSyllabus(id: string): Promise<SyllabusResponse> {
  const res = await fetch(`${API_BASE}/syllabus/${encodeURIComponent(id)}`);
  return handleResponse<SyllabusResponse>(res);
}

export interface UploadOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  onProgress?: (progress: UploadProgress) => void;
}

export async function startUploadJob(
  file: File,
  options?: { signal?: AbortSignal }
): Promise<StartUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    body: formData,
    signal: options?.signal,
  });

  return handleResponse<StartUploadResponse>(res);
}

export async function cancelUploadJob(jobId: string): Promise<void> {
  try {
    await fetch(`${API_BASE}/upload/jobs/${encodeURIComponent(jobId)}/cancel`, {
      method: 'POST',
    });
  } catch (err) {
    console.warn(`Failed to cancel upload job '${jobId}':`, err);
  }
}

export async function pollJobStatus(jobId: string): Promise<UploadProgress> {
  const res = await fetch(`${API_BASE}/upload/jobs/${encodeURIComponent(jobId)}`);
  return handleResponse<UploadProgress>(res);
}

export interface ProgressSubscriptionHandlers {
  onProgress?: (progress: UploadProgress) => void;
  onComplete?: (result: SyllabusResponse) => void;
  onError?: (error: ApiError) => void;
}

export function subscribeUploadProgress(
  jobId: string,
  handlers: ProgressSubscriptionHandlers
): () => void {
  let isClosed = false;
  let pollingInterval: ReturnType<typeof setInterval> | null = null;
  let eventSource: EventSource | null = null;

  const cleanup = () => {
    isClosed = true;
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
  };

  const startPollingFallback = () => {
    if (isClosed || pollingInterval) return;
    pollingInterval = setInterval(async () => {
      try {
        const status = await pollJobStatus(jobId);
        if (isClosed) return;
        handlers.onProgress?.(status);

        if (status.stage === 'completed' && status.result) {
          cleanup();
          handlers.onComplete?.(status.result);
        } else if (status.stage === 'failed') {
          cleanup();
          handlers.onError?.(
            new ApiError(500, status.error || 'Ingestion failed.', 'IngestionFailed')
          );
        } else if (status.stage === 'cancelled') {
          cleanup();
          handlers.onError?.(
            new ApiError(499, 'Ingestion was cancelled.', 'IngestionCancelled')
          );
        }
      } catch (err) {
        if (!isClosed) {
          const msg = err instanceof Error ? err.message : 'Polling failed.';
          handlers.onError?.(new ApiError(500, msg, 'PollingError'));
          cleanup();
        }
      }
    }, 2000);
  };

  try {
    const sseUrl = `${API_BASE}/upload/progress/${encodeURIComponent(jobId)}`;
    eventSource = new EventSource(sseUrl);

    eventSource.addEventListener('progress', (e: MessageEvent) => {
      if (isClosed) return;
      try {
        const data: UploadProgress = JSON.parse(e.data);
        handlers.onProgress?.(data);

        if (data.stage === 'completed' && data.result) {
          cleanup();
          handlers.onComplete?.(data.result);
        } else if (data.stage === 'failed') {
          cleanup();
          handlers.onError?.(
            new ApiError(500, data.error || data.message || 'Ingestion failed.', 'IngestionFailed')
          );
        } else if (data.stage === 'cancelled') {
          cleanup();
          handlers.onError?.(
            new ApiError(499, 'Ingestion was cancelled by user.', 'IngestionCancelled')
          );
        }
      } catch (parseErr) {
        console.warn('Failed to parse SSE progress payload:', parseErr);
      }
    });

    eventSource.onerror = () => {
      if (isClosed) return;
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      startPollingFallback();
    };
  } catch {
    startPollingFallback();
  }

  return cleanup;
}

export async function uploadSyllabusFile(
  file: File,
  options?: UploadOptions
): Promise<SyllabusResponse> {
  const job = await startUploadJob(file, { signal: options?.signal });

  if (options?.onProgress) {
    options.onProgress({
      job_id: job.job_id,
      stage: job.stage,
      percent: job.percent,
      message: job.message,
      result: null,
      error: null,
    });
  }

  return new Promise<SyllabusResponse>((resolve, reject) => {
    let unsubscribe: (() => void) | null = null;

    const onAbort = () => {
      if (unsubscribe) unsubscribe();
      cancelUploadJob(job.job_id).catch(() => {});
      reject(
        new ApiError(499, 'Upload request was cancelled by user.', 'UploadCancelled', 'UPLOAD_CANCELLED', true)
      );
    };

    if (options?.signal) {
      if (options.signal.aborted) {
        cancelUploadJob(job.job_id).catch(() => {});
        reject(
          new ApiError(499, 'Upload request was cancelled by user.', 'UploadCancelled', 'UPLOAD_CANCELLED', true)
        );
        return;
      }
      options.signal.addEventListener('abort', onAbort);
    }

    unsubscribe = subscribeUploadProgress(job.job_id, {
      onProgress: (p) => {
        options?.onProgress?.(p);
      },
      onComplete: (res) => {
        if (options?.signal) {
          options.signal.removeEventListener('abort', onAbort);
        }
        resolve(res);
      },
      onError: (err) => {
        if (options?.signal) {
          options.signal.removeEventListener('abort', onAbort);
        }
        reject(err);
      },
    });
  });
}

export async function toggleLeaf(
  syllabusId: string,
  leafId: string,
  isCompleted: boolean
): Promise<SyllabusResponse> {
  const res = await fetch(`${API_BASE}/syllabus/${encodeURIComponent(syllabusId)}/toggle-leaf`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ leaf_id: leafId, is_completed: isCompleted }),
  });
  return handleResponse<SyllabusResponse>(res);
}

export async function toggleBranch(
  syllabusId: string,
  nodeId: string,
  isCompleted: boolean
): Promise<SyllabusResponse> {
  const res = await fetch(`${API_BASE}/syllabus/${encodeURIComponent(syllabusId)}/bulk-toggle`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ node_id: nodeId, is_completed: isCompleted }),
  });
  return handleResponse<SyllabusResponse>(res);
}

export async function renameSyllabus(
  syllabusId: string,
  title: string
): Promise<SyllabusResponse> {
  const res = await fetch(`${API_BASE}/syllabus/${encodeURIComponent(syllabusId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  return handleResponse<SyllabusResponse>(res);
}

export async function deleteSyllabus(syllabusId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/syllabus/${encodeURIComponent(syllabusId)}`, {
    method: 'DELETE',
  });
  return handleResponse<void>(res);
}

export async function fetchParseReview(syllabusId: string): Promise<ParseReviewResponse> {
  const res = await fetch(`${API_BASE}/syllabus/${encodeURIComponent(syllabusId)}/review`);
  return handleResponse<ParseReviewResponse>(res);
}

export async function finalizeEnrollment(
  syllabusId: string,
  enrolledSubjectIds: string[]
): Promise<SyllabusResponse> {
  const res = await fetch(`${API_BASE}/syllabus/${encodeURIComponent(syllabusId)}/finalize-enrollment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enrolled_subject_ids: enrolledSubjectIds }),
  });
  return handleResponse<SyllabusResponse>(res);
}

export async function updateEnrollment(
  syllabusId: string,
  enrolledSubjectIds: string[]
): Promise<SyllabusResponse> {
  const res = await fetch(`${API_BASE}/syllabus/${encodeURIComponent(syllabusId)}/update-enrollment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enrolled_subject_ids: enrolledSubjectIds }),
  });
  return handleResponse<SyllabusResponse>(res);
}

export async function fetchSyllabusPacing(
  syllabusId: string,
  signal?: AbortSignal
): Promise<SyllabusPacingSummary> {
  const res = await fetch(`${API_BASE}/syllabus/${encodeURIComponent(syllabusId)}/pacing`, {
    signal,
  });
  return handleResponse<SyllabusPacingSummary>(res);
}

export async function setNodeDeadline(
  syllabusId: string,
  payload: SetTargetDatePayload,
  signal?: AbortSignal
): Promise<PacingMetrics> {
  const res = await fetch(`${API_BASE}/syllabus/${encodeURIComponent(syllabusId)}/deadline`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
  return handleResponse<PacingMetrics>(res);
}

export async function clearNodeDeadline(
  syllabusId: string,
  nodeId: string,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/syllabus/${encodeURIComponent(syllabusId)}/deadline/${encodeURIComponent(nodeId)}`,
    {
      method: 'DELETE',
      signal,
    }
  );
  return handleResponse<void>(res);
}

// --- Option-B: Topic Notes API ---

export async function fetchSyllabusNotes(
  syllabusId: string,
  signal?: AbortSignal
): Promise<TopicNote[]> {
  const res = await fetch(`${API_BASE}/syllabus/${encodeURIComponent(syllabusId)}/notes`, {
    signal,
  });
  return handleResponse<TopicNote[]>(res);
}

export async function fetchTopicNote(
  syllabusId: string,
  leafId: string,
  signal?: AbortSignal
): Promise<TopicNote | null> {
  const res = await fetch(
    `${API_BASE}/syllabus/${encodeURIComponent(syllabusId)}/notes/${encodeURIComponent(leafId)}`,
    { signal }
  );
  if (res.status === 404) {
    return null;
  }
  return handleResponse<TopicNote>(res);
}

export async function saveTopicNote(
  syllabusId: string,
  leafId: string,
  content: string,
  signal?: AbortSignal
): Promise<TopicNote> {
  const res = await fetch(
    `${API_BASE}/syllabus/${encodeURIComponent(syllabusId)}/notes/${encodeURIComponent(leafId)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
      signal,
    }
  );
  return handleResponse<TopicNote>(res);
}

export async function deleteTopicNote(
  syllabusId: string,
  leafId: string,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/syllabus/${encodeURIComponent(syllabusId)}/notes/${encodeURIComponent(leafId)}`,
    {
      method: 'DELETE',
      signal,
    }
  );
  return handleResponse<void>(res);
}

// --- Option-B: Learning Resources API ---

export async function fetchSyllabusResources(
  syllabusId: string,
  nodeId?: string,
  nodeType?: string,
  signal?: AbortSignal
): Promise<TopicResource[]> {
  const params = new URLSearchParams();
  if (nodeId) params.append('node_id', nodeId);
  if (nodeType) params.append('node_type', nodeType);
  const q = params.toString() ? `?${params.toString()}` : '';

  const res = await fetch(`${API_BASE}/syllabus/${encodeURIComponent(syllabusId)}/resources${q}`, {
    signal,
  });
  return handleResponse<TopicResource[]>(res);
}

export async function addTopicResource(
  syllabusId: string,
  payload: AddResourcePayload,
  signal?: AbortSignal
): Promise<TopicResource> {
  const res = await fetch(`${API_BASE}/syllabus/${encodeURIComponent(syllabusId)}/resources`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
  return handleResponse<TopicResource>(res);
}

export async function deleteTopicResource(
  syllabusId: string,
  resourceId: number,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/syllabus/${encodeURIComponent(syllabusId)}/resources/${encodeURIComponent(resourceId)}`,
    {
      method: 'DELETE',
      signal,
    }
  );
  return handleResponse<void>(res);
}

// --- Option-B: Export & Restore API ---

function buildExportQueryParams(options: ExportOptions): string {
  const params = new URLSearchParams();
  params.append('include_notes', String(options.include_notes));
  params.append('include_resources', String(options.include_resources));
  params.append('include_pacing', String(options.include_pacing));
  params.append('enrolled_only', String(options.enrolled_only));
  return params.toString();
}

export function getExportMarkdownUrl(syllabusId: string, options: ExportOptions): string {
  return `${API_BASE}/syllabus/${encodeURIComponent(syllabusId)}/export/markdown?${buildExportQueryParams(options)}`;
}

export function getExportJsonUrl(syllabusId: string, options: ExportOptions): string {
  return `${API_BASE}/syllabus/${encodeURIComponent(syllabusId)}/export/json?${buildExportQueryParams(options)}`;
}

export function getExportHtmlUrl(syllabusId: string, options: ExportOptions): string {
  return `${API_BASE}/syllabus/${encodeURIComponent(syllabusId)}/export/html?${buildExportQueryParams(options)}`;
}

export async function downloadFileFromUrl(url: string, defaultFilename: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new ApiError(res.status, `Failed to download: ${res.statusText}`);
  }
  const blob = await res.blob();
  const disposition = res.headers.get('content-disposition');
  let filename = defaultFilename;
  if (disposition && disposition.includes('filename=')) {
    const match = disposition.match(/filename="?([^";]+)"?/);
    if (match && match[1]) {
      filename = match[1];
    }
  }

  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}

export async function downloadExportMarkdown(syllabusId: string, options: ExportOptions): Promise<void> {
  const url = getExportMarkdownUrl(syllabusId, options);
  await downloadFileFromUrl(url, `${syllabusId}.md`);
}

export async function downloadExportJson(syllabusId: string, options: ExportOptions): Promise<void> {
  const url = getExportJsonUrl(syllabusId, options);
  await downloadFileFromUrl(url, `${syllabusId}_backup.json`);
}

export function openPrintableHtml(syllabusId: string, options: ExportOptions): void {
  const url = getExportHtmlUrl(syllabusId, options);
  window.open(url, '_blank', 'noopener,noreferrer');
}

export async function restoreSyllabusBackup(
  payload: BackupRestorePayload,
  signal?: AbortSignal
): Promise<BackupRestoreResult> {
  const res = await fetch(`${API_BASE}/syllabus/restore-backup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
  return handleResponse<BackupRestoreResult>(res);
}

export async function restoreSyllabusBackupFile(
  file: File,
  mode: 'clone' | 'replace',
  targetSyllabusId?: string,
  signal?: AbortSignal
): Promise<BackupRestoreResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('mode', mode);
  if (targetSyllabusId) {
    formData.append('target_syllabus_id', targetSyllabusId);
  }

  const res = await fetch(`${API_BASE}/syllabus/restore-backup`, {
    method: 'POST',
    body: formData,
    signal,
  });
  return handleResponse<BackupRestoreResult>(res);
}


