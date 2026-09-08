/**
 * Application-level errors. Anything thrown that is an ApiError is translated by the
 * error middleware into a predictable JSON body; anything else becomes a 500 and is
 * logged, so internal details never leak to the client.
 */
export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL_ERROR';

export interface FieldIssue {
  field: string;
  message: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details?: FieldIssue[];

  constructor(status: number, code: ApiErrorCode, message: string, details?: FieldIssue[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: FieldIssue[]): ApiError {
    return new ApiError(400, 'BAD_REQUEST', message, details);
  }

  static validation(message: string, details: FieldIssue[]): ApiError {
    return new ApiError(422, 'VALIDATION_ERROR', message, details);
  }

  static unauthorized(message = 'Authentication required'): ApiError {
    return new ApiError(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message = 'Not allowed'): ApiError {
    return new ApiError(403, 'FORBIDDEN', message);
  }

  static notFound(message = 'Resource not found'): ApiError {
    return new ApiError(404, 'NOT_FOUND', message);
  }

  static conflict(message: string): ApiError {
    return new ApiError(409, 'CONFLICT', message);
  }
}
