import { buildVariant, versionLabel } from '../buildInfo';

describe('build info', () => {
  it('reads the variant EAS set, and falls back safely', () => {
    expect(buildVariant('preview', false)).toBe('preview');
    expect(buildVariant('production', true)).toBe('production');
    expect(buildVariant(undefined, true)).toBe('development');
    // A release build that lost its variant must not show test tools.
    expect(buildVariant(undefined, false)).toBe('production');
    expect(buildVariant('staging', false)).toBe('production');
  });

  it('labels the version with the build number when there is one', () => {
    expect(versionLabel({ version: '1.0.0', build: '14' })).toBe('1.0.0 (14)');
    expect(versionLabel({ version: '1.0.0', build: null })).toBe('1.0.0');
  });
});
