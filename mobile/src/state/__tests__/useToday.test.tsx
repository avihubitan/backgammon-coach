import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AppState } from 'react-native';

import { setProgressClock } from '../progressStore';
import { TODAY_CHECK_MS, useToday, type Today } from '../useToday';

type Listener = Parameters<typeof AppState.addEventListener>[1];

let now = new Date(2026, 9, 3, 20, 0);
let seen: Today[] = [];
let toForeground: Listener | null = null;

function Probe() {
  seen.push(useToday());
  return null;
}

function mount(): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(<Probe />);
  });
  return renderer;
}

beforeEach(() => {
  jest.useFakeTimers();
  now = new Date(2026, 9, 3, 20, 0);
  seen = [];
  setProgressClock(() => now);
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    toForeground = listener;
    return { remove: () => (toForeground = null) } as ReturnType<typeof AppState.addEventListener>;
  });
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  setProgressClock(() => new Date());
});

// Home, Profile and the daily cards stay mounted while the app sits in memory:
// before, the next morning still showed yesterday's streak and "Daily goal done".
describe('today, on screens that stay open', () => {
  it('moves to the new day when the app comes back to the front', () => {
    const renderer = mount();
    expect(seen.at(-1)).toEqual({ day: '2026-10-03', hour: 20 });

    now = new Date(2026, 9, 5, 9, 0);
    act(() => (toForeground as (state: string) => void)('active'));
    expect(seen.at(-1)).toEqual({ day: '2026-10-05', hour: 9 });
    act(() => renderer.unmount());
    expect(toForeground).toBeNull();
  });

  it('turns over at midnight while the app is open, without re-rendering every minute', () => {
    const renderer = mount();
    const renders = seen.length;
    act(() => jest.advanceTimersByTime(TODAY_CHECK_MS * 5));
    expect(seen).toHaveLength(renders);

    now = new Date(2026, 9, 4, 0, 1);
    act(() => jest.advanceTimersByTime(TODAY_CHECK_MS));
    expect(seen.at(-1)).toEqual({ day: '2026-10-04', hour: 0 });
    act(() => renderer.unmount());
  });
});
