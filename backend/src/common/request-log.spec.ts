import { EventEmitter } from 'node:events';

import type { NextFunction, Request, Response } from 'express';

import { requestLog } from './request-log';
import { withTimeout } from './timeout';

function run(method: string, url: string, status: number) {
  const lines: { level: string; line: string }[] = [];
  const logger = {
    log: (line: string) => lines.push({ level: 'log', line }),
    warn: (line: string) => lines.push({ level: 'warn', line }),
    error: (line: string) => lines.push({ level: 'error', line }),
  };
  const response = Object.assign(new EventEmitter(), { statusCode: status });
  const next = jest.fn() as NextFunction;
  requestLog(logger)({ method, originalUrl: url, headers: { authorization: 'Bearer SECRET' } } as unknown as Request, response as unknown as Response, next);
  expect(next).toHaveBeenCalled();
  response.emit('finish');
  return lines;
}

describe('requestLog', () => {
  it('logs method, path, status and duration, without the query string or headers', () => {
    const [entry] = run('PUT', '/v1/progress?x=1', 200);
    expect(entry.level).toBe('log');
    expect(entry.line).toMatch(/^PUT \/v1\/progress 200 \d+ms$/);
    expect(entry.line).not.toContain('SECRET');
  });

  it('raises the level for client and server errors', () => {
    expect(run('GET', '/v1/progress', 401)[0].level).toBe('warn');
    expect(run('GET', '/v1/progress', 503)[0].level).toBe('error');
  });

  it('skips successful health checks but not failing ones', () => {
    expect(run('GET', '/v1/health', 200)).toEqual([]);
    expect(run('GET', '/v1/health', 503)[0].level).toBe('error');
  });
});

describe('withTimeout', () => {
  it('answers with the fallback when the promise is too slow', async () => {
    const slow = new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 200));
    await expect(withTimeout(slow, 10, false)).resolves.toBe(false);
  });

  it('answers with the result when the promise is quick enough', async () => {
    await expect(withTimeout(Promise.resolve(true), 50, false)).resolves.toBe(true);
  });
});
