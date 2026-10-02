import { SoundBank } from '../feedback/audio';

function fakePlayers() {
  const created: { play: jest.Mock; seekTo: jest.Mock; volume: number }[] = [];
  const create = jest.fn(() => {
    const player = { play: jest.fn(), seekTo: jest.fn(() => Promise.resolve()), volume: 1, remove: jest.fn(), loop: false };
    created.push(player);
    return player;
  });
  return { created, create };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('SoundBank', () => {
  it('plays from the start and respects category switches', async () => {
    const { created, create } = fakePlayers();
    let now = 0;
    const bank = new SoundBank(create as never, () => now);
    bank.play('success');
    await flush();
    expect(created).toHaveLength(1);
    expect(created[0].seekTo).toHaveBeenCalledWith(0);
    expect(created[0].play).toHaveBeenCalledTimes(1);

    bank.setEnabled({ reward: false });
    now += 1000;
    bank.play('success');
    await flush();
    expect(created[0].play).toHaveBeenCalledTimes(1);
    expect(bank.isEnabled('game')).toBe(true);
  });

  it('collapses repeats within a frame and rotates voices', async () => {
    const { created, create } = fakePlayers();
    let now = 0;
    const bank = new SoundBank(create as never, () => now);
    bank.play('xp');
    bank.play('xp');
    await flush();
    const plays = () => created.reduce((sum, player) => sum + player.play.mock.calls.length, 0);
    expect(plays()).toBe(1);
    now += 100;
    bank.play('xp');
    await flush();
    expect(plays()).toBe(2);
    // xp has several voices so overlapping ticks don't cut each other off.
    expect(created.filter((player) => player.play.mock.calls.length > 0)).toHaveLength(2);
  });

  it('never throws when the audio backend fails', () => {
    const bank = new SoundBank((() => {
      throw new Error('no audio');
    }) as never);
    expect(() => bank.play('hit')).not.toThrow();
  });
});

describe('menu music', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('plays only when enabled and on a music scene, and fades out otherwise', () => {
    const { created, create } = fakePlayers();
    const bank = new SoundBank(create as never, () => 0);
    bank.setMusicScene('menu');
    expect(created).toHaveLength(0); // music is off by default
    bank.setEnabled({ music: true });
    expect(created).toHaveLength(1);
    const player = created[0] as unknown as { play: jest.Mock; pause: jest.Mock; volume: number; loop: boolean };
    player.pause = jest.fn();
    expect(player.loop).toBe(true);
    expect(player.play).toHaveBeenCalled();
    jest.advanceTimersByTime(2000);
    expect(player.volume).toBeGreaterThan(0);
    expect(bank.isMusicPlaying()).toBe(true);

    bank.setMusicScene(null);
    jest.advanceTimersByTime(1000);
    expect(player.volume).toBe(0);
    expect(player.pause).toHaveBeenCalled();
    expect(bank.isMusicPlaying()).toBe(false);
  });
});
