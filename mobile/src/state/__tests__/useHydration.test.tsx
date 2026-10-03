import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { crashReporter } from '@/services/crash';

import { useProgressStore } from '../progressStore';
import { HYDRATION_TIMEOUT_MS, useHydration } from '../useHydration';

let seen: boolean[] = [];
function Probe() {
  seen.push(useHydration());
  return null;
}

beforeEach(() => {
  seen = [];
  jest.useFakeTimers();
  jest.spyOn(crashReporter, 'captureException').mockImplementation(() => {});
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('start-up', () => {
  it('waits for every store to load', () => {
    let renderer: ReactTestRenderer;
    act(() => {
      renderer = create(<Probe />);
    });
    expect(seen.at(-1)).toBe(true);
    act(() => renderer.unmount());
  });

  it('starts anyway, and reports it, when a store never finishes loading', () => {
    jest.spyOn(useProgressStore.persist, 'hasHydrated').mockReturnValue(false);
    let renderer: ReactTestRenderer;
    act(() => {
      renderer = create(<Probe />);
    });
    expect(seen.at(-1)).toBe(false);
    act(() => {
      jest.advanceTimersByTime(HYDRATION_TIMEOUT_MS);
    });
    expect(seen.at(-1)).toBe(true);
    expect(crashReporter.captureException).toHaveBeenCalledWith(expect.any(Error), { stores: 'bg-coach/progress' });
    act(() => renderer.unmount());
  });
});
