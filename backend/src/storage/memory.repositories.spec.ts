import { MemoryProgressRepository } from './memory.repositories';

describe('memory progress repository', () => {
  const now = new Date('2026-10-03T10:00:00Z');

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
