/**
 * Safe error extraction and normalization utilities for Syllabus Tracker.
 */

export interface AppErrorDetails {
  message: string;
  code?: string;
  details?: unknown;
}

/**
 * Safely extract a user-facing error message from any error value,
 * without exposing internal stack traces or sensitive filesystem paths.
 */
export function extractErrorMessage(error: unknown): string {
  if (!error) {
    return 'An unexpected error occurred.';
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      return 'The request timed out or was cancelled.';
    }
    return error.message;
  }

  if (typeof error === 'object' && error !== null) {
    const errObj = error as Record<string, unknown>;

    // FastAPI HTTPException details
    if (typeof errObj.detail === 'string') {
      return errObj.detail;
    }

    // FastAPI Validation error list
    if (Array.isArray(errObj.detail)) {
      const messages = errObj.detail.map((item) => {
        if (typeof item === 'object' && item !== null && 'msg' in item) {
          const loc = Array.isArray(item.loc) ? item.loc.join('.') : '';
          return loc ? `${loc}: ${item.msg}` : String(item.msg);
        }
        return JSON.stringify(item);
      });
      return messages.join('; ');
    }

    if (typeof errObj.message === 'string') {
      return errObj.message;
    }
  }

  return 'An unexpected error occurred.';
}
