/**
 * Typed API client for Syllabus Tracker backend endpoints.
 */

import type {
  AppConfigResponse,
  HealthResponse,
  SyllabusResponse,
  SyllabusSummary,
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
}

export async function uploadSyllabusFile(
  file: File,
  options?: UploadOptions
): Promise<SyllabusResponse> {
  const timeoutMs = options?.timeoutMs ?? 90_000;
  const controller = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort('DOCUMENT_PROCESSING_TIMEOUT');
  }, timeoutMs);

  if (options?.signal) {
    if (options.signal.aborted) {
      clearTimeout(timer);
      controller.abort(options.signal.reason);
    } else {
      options.signal.addEventListener('abort', () => {
        clearTimeout(timer);
        controller.abort(options.signal?.reason);
      });
    }
  }

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });
    return await handleResponse<SyllabusResponse>(res);
  } catch (err: unknown) {
    if (timedOut) {
      throw new ApiError(
        504,
        `Upload processing for '${file.name}' timed out after ${Math.round(timeoutMs / 1000)} seconds. The document may be complex or system resources are busy.`,
        'DocumentProcessingTimeout',
        'DOCUMENT_PROCESSING_TIMEOUT',
        true
      );
    }
    if (options?.signal?.aborted) {
      throw new ApiError(
        499,
        'Upload request was cancelled by user.',
        'UploadCancelled',
        'UPLOAD_CANCELLED',
        true
      );
    }
    if (err instanceof ApiError) {
      throw err;
    }
    const message = err instanceof Error ? err.message : 'Network error or backend unreachable.';
    throw new ApiError(500, message, 'NetworkError', 'NETWORK_ERROR', true);
  } finally {
    clearTimeout(timer);
  }
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
