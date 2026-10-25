/**
 * Typed API client for Syllabus Tracker backend endpoints.
 */

import type {
  HealthResponse,
  SyllabusResponse,
  SyllabusSummary,
} from '../types/syllabus';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';

export class ApiError extends Error {
  status: number;
  errorType?: string;
  detail: string;

  constructor(status: number, message: string, errorType?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errorType = errorType;
    this.detail = message;
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = `HTTP Error ${response.status}: ${response.statusText}`;
    let errorType = 'HttpError';

    try {
      const data = await response.json();
      if (data.detail) {
        errorMessage = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
      }
      if (data.error_type) {
        errorType = data.error_type;
      }
    } catch {
      // response wasn't JSON
    }

    throw new ApiError(response.status, errorMessage, errorType);
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

export async function fetchSyllabiList(): Promise<SyllabusSummary[]> {
  const res = await fetch(`${API_BASE}/syllabi`);
  return handleResponse<SyllabusSummary[]>(res);
}

export async function fetchSyllabus(id: string): Promise<SyllabusResponse> {
  const res = await fetch(`${API_BASE}/syllabus/${encodeURIComponent(id)}`);
  return handleResponse<SyllabusResponse>(res);
}

export async function uploadSyllabusFile(file: File): Promise<SyllabusResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    body: formData,
  });
  return handleResponse<SyllabusResponse>(res);
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
