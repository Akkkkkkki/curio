/**
 * Lightweight error reporting service.
 *
 * In production, replace the console-based reporter with a real service
 * like Sentry or Firebase Crashlytics. This module provides a single
 * integration point so the rest of the codebase doesn't need to change.
 */

export interface ErrorReport {
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
  severity: 'error' | 'warning' | 'info';
  timestamp: string;
}

const MAX_BUFFERED_REPORTS = 50;
const reportBuffer: ErrorReport[] = [];

const createReport = (
  error: unknown,
  context?: Record<string, unknown>,
  severity: ErrorReport['severity'] = 'error',
): ErrorReport => {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  return { message, stack, context, severity, timestamp: new Date().toISOString() };
};

export const captureError = (error: unknown, context?: Record<string, unknown>): void => {
  const report = createReport(error, context);
  reportBuffer.push(report);
  if (reportBuffer.length > MAX_BUFFERED_REPORTS) reportBuffer.shift();

  if (import.meta.env.DEV) {
    console.error('[ErrorReporting]', report.message, context);
  }
};

export const captureWarning = (message: string, context?: Record<string, unknown>): void => {
  const report = createReport(message, context, 'warning');
  reportBuffer.push(report);
  if (reportBuffer.length > MAX_BUFFERED_REPORTS) reportBuffer.shift();
};

export const getBufferedReports = (): readonly ErrorReport[] => reportBuffer;
export const clearReports = (): void => {
  reportBuffer.length = 0;
};

if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    captureError(event.reason, { type: 'unhandledrejection' });
  });

  window.addEventListener('error', (event) => {
    captureError(event.error || event.message, {
      type: 'global_error',
      filename: event.filename,
      lineno: event.lineno,
    });
  });
}
