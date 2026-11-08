export interface FieldError {
  path: string;
  message: string;
}

/** Error thrown for any non-2xx API response, carrying the server's structured error body. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fieldErrors: FieldError[] = [],
    /** Raw `details` from the error body, for errors that carry context rather than field errors. */
    public readonly details: unknown = undefined,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Field errors keyed by field name, for showing messages next to form inputs. */
  get byField(): Record<string, string> {
    const map: Record<string, string> = {};
    for (const error of this.fieldErrors) if (!map[error.path]) map[error.path] = error.message;
    return map;
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export async function apiRequest<T>(method: Method, path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Could not reach the server. Check your connection and try again.');
  }

  if (response.status === 204) return undefined as T;

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = data?.error;
    throw new ApiError(
      response.status,
      error?.code ?? 'UNKNOWN',
      error?.message ?? `Request failed (${response.status})`,
      Array.isArray(error?.details) ? error.details : [],
      error?.details,
    );
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => apiRequest<T>('GET', path),
  post: <T>(path: string, body?: unknown) => apiRequest<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => apiRequest<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => apiRequest<T>('PATCH', path, body),
  delete: <T = void>(path: string) => apiRequest<T>('DELETE', path),
};

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Something went wrong';
}
