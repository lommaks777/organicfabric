/**
 * Custom Error Types - Domain-specific error handling
 */

export class IntegrationError extends Error {
  code: string;
  service: string;
  originalError?: Error;

  constructor(message: string, code: string, service: string, originalError?: Error) {
    super(message);
    this.name = 'IntegrationError';
    this.code = code;
    this.service = service;
    this.originalError = originalError;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, IntegrationError);
    }
  }
}

export class PipelineError extends Error {
  stage: string;
  originalError?: Error;

  constructor(message: string, stage: string, originalError?: Error) {
    super(message);
    this.name = 'PipelineError';
    this.stage = stage;
    this.originalError = originalError;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PipelineError);
    }
  }
}
