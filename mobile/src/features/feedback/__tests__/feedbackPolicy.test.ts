import { shouldAskFeedback } from '../feedbackPolicy';

describe('quick feedback', () => {
  const base = { enabled: true, canSend: true, today: '2026-10-03', lastAskedDay: null };

  it('asks once a day at most', () => {
    expect(shouldAskFeedback(base)).toBe(true);
    expect(shouldAskFeedback({ ...base, lastAskedDay: '2026-10-03' })).toBe(false);
    expect(shouldAskFeedback({ ...base, lastAskedDay: '2026-10-02' })).toBe(true);
  });

  it('never asks when feedback can’t be sent, or when switched off', () => {
    expect(shouldAskFeedback({ ...base, canSend: false })).toBe(false);
    expect(shouldAskFeedback({ ...base, enabled: false })).toBe(false);
  });
});
