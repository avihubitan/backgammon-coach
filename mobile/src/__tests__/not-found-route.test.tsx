import { act, create, type ReactTestRenderer } from 'react-test-renderer';

// Kept out of src/app: every file there becomes a route.
import NotFoundRoute from '@/app/+not-found';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  router: { replace: (href: string) => mockReplace(href) },
  Stack: { Screen: () => null },
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
// The button and icon animate natively; the screen only needs their props.
jest.mock('@/components/ui/Button', () => ({ Button: () => null }));
jest.mock('@/components/ui/Icon', () => ({ Icon: () => null }));

// expo-router shows its developer page (with a sitemap of every route) for a
// link the app doesn't have, unless the app defines this route.
describe('a link to a page that does not exist', () => {
  it('says so and goes Home', () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(<NotFoundRoute />);
    });
    const text = renderer.root
      .findAll((node) => typeof node.props.children === 'string')
      .map((node) => node.props.children as string);
    expect(text).toContain('Page not found');

    act(() => renderer.root.findByProps({ testID: 'not-found-home' }).props.onPress());
    expect(mockReplace).toHaveBeenCalledWith('/');
    act(() => renderer.unmount());
  });
});
