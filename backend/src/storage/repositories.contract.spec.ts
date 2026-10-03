import * as os from 'node:os';

import { MongoClient, type Db } from 'mongodb';

import { MemoryAccountRepository, MemoryProgressRepository } from './memory.repositories';
import { MongoAccountRepository, MongoProgressRepository } from './mongo.repositories';
import type { AccountRepository, ProgressRepository } from './repositories';

/**
 * The storage contract, checked against every implementation. MongoDB runs
 * when TEST_MONGODB_URI points at a server (for example a local container):
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27017 npm test
 */
interface Storage {
  accounts: AccountRepository;
  progress: ProgressRepository;
}

const now = new Date('2026-10-03T10:00:00Z');
const account = (id: string, codeHash = `hash-${id}`) => ({ id, codeHash, createdAt: now });

function contract(name: string, setup: () => Promise<Storage>) {
  describe(`${name} storage`, () => {
    let storage: Storage;
    beforeEach(async () => {
      storage = await setup();
    });

    it('finds accounts by code hash and refuses a duplicate hash', async () => {
      await storage.accounts.create(account('a'));
      expect(await storage.accounts.findByCodeHash('hash-a')).toMatchObject({ id: 'a', codeHash: 'hash-a' });
      expect(await storage.accounts.findByCodeHash('missing')).toBeNull();
      await expect(storage.accounts.create(account('b', 'hash-a'))).rejects.toThrow();
    });

    it('accepts uploads in revision order only', async () => {
      expect(await storage.progress.get('a')).toBeNull();
      expect(await storage.progress.put('a', 0, { schemaVersion: 1, xp: 1 }, now)).toMatchObject({ ok: true, stored: { revision: 1 } });
      expect(await storage.progress.put('a', 0, { schemaVersion: 1, xp: 2 }, now)).toMatchObject({
        ok: false,
        current: { revision: 1, snapshot: { xp: 1 } },
      });
      expect(await storage.progress.put('a', 1, { schemaVersion: 1, xp: 3 }, now)).toMatchObject({
        ok: true,
        stored: { revision: 2, snapshot: { xp: 3 } },
      });
      expect(await storage.progress.put('a', 5, { schemaVersion: 1, xp: 4 }, now)).toMatchObject({ ok: false });
    });

    it('lets only one of two simultaneous first uploads win', async () => {
      const results = await Promise.all([
        storage.progress.put('a', 0, { schemaVersion: 1, device: 1 }, now),
        storage.progress.put('a', 0, { schemaVersion: 1, device: 2 }, now),
      ]);
      expect(results.filter((result) => result.ok)).toHaveLength(1);
      expect((await storage.progress.get('a'))!.revision).toBe(1);
    });

    it('deletes an account and its progress, and ignores what is already gone', async () => {
      await storage.accounts.create(account('a'));
      await storage.progress.put('a', 0, { schemaVersion: 1, xp: 1 }, now);
      await storage.accounts.create(account('b'));
      await storage.progress.put('b', 0, { schemaVersion: 1, xp: 2 }, now);

      await storage.progress.delete('a');
      await storage.accounts.delete('a');

      expect(await storage.accounts.findByCodeHash('hash-a')).toBeNull();
      expect(await storage.progress.get('a')).toBeNull();
      expect(await storage.accounts.findByCodeHash('hash-b')).toMatchObject({ id: 'b' });
      expect(await storage.progress.get('b')).toMatchObject({ revision: 1 });
      await expect(storage.progress.delete('a')).resolves.toBeUndefined();
      await expect(storage.accounts.delete('a')).resolves.toBeUndefined();
    });
  });
}

contract('memory', async () => ({ accounts: new MemoryAccountRepository(), progress: new MemoryProgressRepository() }));

const mongoUri = process.env.TEST_MONGODB_URI;
if (mongoUri) {
  describe('against MongoDB', () => {
    let client: MongoClient;
    let db: Db | undefined;
    let run = 0;
    beforeAll(async () => {
      // Jest can't run the driver's dynamic import('os'), so hand it the module.
      client = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 5_000, runtimeAdapters: { os } });
      await client.connect();
    }, 15_000);
    afterEach(async () => {
      await db?.dropDatabase();
    });
    afterAll(async () => client?.close());
    contract('MongoDB', async () => {
      db = client.db(`bgc_contract_${process.pid}_${run++}`);
      const accounts = new MongoAccountRepository(db);
      await accounts.init();
      return { accounts, progress: new MongoProgressRepository(db) };
    });
  });
} else {
  describe.skip('MongoDB storage (set TEST_MONGODB_URI to run)', () => {
    it('runs the storage contract', () => {});
  });
}
