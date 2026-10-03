import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { BackHandler } from 'react-native';

import { useBackPress } from '../useBackPress';

type Listener = Parameters<typeof BackHandler.addEventListener>[1];
let listeners: Listener[] = [];

beforeEach(() => {
  listeners = [];
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, listener) => {
    listeners.push(listener);
    return { remove: () => (listeners = listeners.filter((other) => other !== listener)) };
  });
});
afterEach(() => jest.restoreAllMocks());

/** What Android does: the newest listener first; true means it handled the press. */
const pressBack = () =>
  [...listeners].reverse().some((listener) => (listener as (event?: unknown) => boolean | null | undefined)() === true);

function Screen({ enabled, onBack }: { enabled: boolean; onBack: () => boolean | void }) {
  useBackPress(enabled, onBack);
  return null;
}

describe('Android back', () => {
  it('runs the screen’s handler instead of leaving while enabled', () => {
    const onBack = jest.fn();
    let renderer: ReactTestRenderer;
    act(() => {
      renderer = create(<Screen enabled onBack={onBack} />);
    });
    expect(pressBack()).toBe(true);
    expect(onBack).toHaveBeenCalledTimes(1);
    act(() => renderer.unmount());
    expect(listeners).toHaveLength(0);
  });

  it('lets the screen go when disabled, or when the handler says so', () => {
    const onBack = jest.fn();
    let renderer: ReactTestRenderer;
    act(() => {
      renderer = create(<Screen enabled={false} onBack={onBack} />);
    });
    expect(pressBack()).toBe(false);
    expect(onBack).not.toHaveBeenCalled();
    act(() => renderer.update(<Screen enabled onBack={() => false} />));
    expect(pressBack()).toBe(false);
    act(() => renderer.unmount());
  });

  it('always calls the latest handler', () => {
    const first = jest.fn();
    const second = jest.fn();
    let renderer: ReactTestRenderer;
    act(() => {
      renderer = create(<Screen enabled onBack={first} />);
    });
    act(() => renderer.update(<Screen enabled onBack={second} />));
    pressBack();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    act(() => renderer.unmount());
  });
});
