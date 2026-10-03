import { MemoryProgressRepository } from './memory.repositories';

describe('memory progress repository', () => {
  const now = new Date('2026-10-03T10:00:00Z');

  it('accepts uploads in revision order only', async () => {
    const repository = new MemoryProgressRepository();
    expect(await repository.get('a')).toBeNull();
    const first = await repository.put('a', 0, { schemaVersion: 1, xp: 1 }, now);
    expect(first).toMatchObject({ ok: true, stored: { revision: 1 } });
    const stale = await repository.put('a', 0, { schemaVersion: 1, xp: 2 }, now);
    expect(stale).toMatchObject({ ok: false, current: { revision: 1, snapshot: { xp: 1 } } });
    const next = await repository.put('a', 1, { schemaVersion: 1, xp: 3 }, now);
    expect(next).toMatchObject({ ok: true, stored: { revision: 2, snapshot: { xp: 3 } } });
  });

  it('hands out copies, so callers cannot change what is stored', async () => {
    const repository = new MemoryProgressRepository();
    const snapshot = { schemaVersion: 1, nested: { xp: 1 } };
    await repository.put('a', 0, snapshot, now);
    snapshot.nested.xp = 99;
    const stored = await repository.get('a');
    (stored!.snapshot.nested as { xp: number }).xp = 42;
    expect((await repository.get('a'))!.snapshot).toEqual({ schemaVersion: 1, nested: { xp: 1 } });
  });
});
