import type { NextFunction, Request, Response } from 'express';

export interface LineLogger {
  log(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

/**
 * One line per request: method, path, status and duration. No IP addresses,
 * headers, query strings or bodies (backup codes travel in a header).
 * Successful health checks are skipped: platforms call them every few seconds.
 */
export function requestLog(logger: LineLogger) {
  return (request: Request, response: Response, next: NextFunction) => {
    const started = process.hrtime.bigint();
    response.on('finish', () => {
      const path = request.originalUrl.split('?')[0];
      const status = response.statusCode;
      if (status < 400 && path.endsWith('/health')) return;
      const ms = Number(process.hrtime.bigint() - started) / 1e6;
      const line = `${request.method} ${path} ${status} ${Math.round(ms)}ms`;
      if (status >= 500) logger.error(line);
      else if (status >= 400) logger.warn(line);
      else logger.log(line);
    });
    next();
  };
}
