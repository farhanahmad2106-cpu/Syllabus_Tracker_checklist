/**
 * Typed API client for Syllabus Tracker backend endpoints.
 */

import type {
  AppConfigResponse,
  HealthResponse,
  StartUploadResponse,
  SyllabusResponse,
  SyllabusSummary,
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
