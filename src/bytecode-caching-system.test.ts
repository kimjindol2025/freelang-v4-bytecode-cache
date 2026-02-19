/**
 * Bytecode Caching System Tests
 */

import * as fs from 'fs';
import * as path from 'path';
import { BytecodeCachingSystem } from './bytecode-caching-system';
import { rimraf } from 'rimraf';

describe('BytecodeCachingSystem', () => {
  let testDir = path.join('/tmp', `bytecode-test-${Date.now()}`);

  beforeEach(() => {
    testDir = path.join('/tmp', `bytecode-test-${Date.now()}-${Math.random()}`);
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    try {
      rimraf.sync(testDir);
    } catch {
      // ignore
    }
  });

  it('should initialize bytecode caching system', () => {
    const system = new BytecodeCachingSystem(testDir);
    expect(system).toBeDefined();
    system.close();
  });

  it('should compile simple migration', async () => {
    const system = new BytecodeCachingSystem(testDir);

    const sql = `
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL
      );
    `;

    const result = await system.compile(sql);

    expect(result.success).toBe(true);
    expect(result.bytecode).toBeDefined();
    expect(result.bytecode?.instructions.length).toBeGreaterThan(0);
    expect(result.source).toBe('GENERATED');

    system.close();
  });

  it('should use cache on subsequent calls', async () => {
    const system = new BytecodeCachingSystem(testDir);

    const sql = `CREATE TABLE products (id INTEGER);`;

    // 첫 번째 호출 (생성)
    const result1 = await system.compile(sql);
    expect(result1.source).toBe('GENERATED');
    expect(result1.executionTime).toBeGreaterThanOrEqual(0);

    // 두 번째 호출 (캐시)
    const result2 = await system.compile(sql);
    expect(result2.source).toBe('CACHE');
    expect(result2.executionTime).toBeLessThanOrEqual(result1.executionTime);

    system.close();
  });

  it('should track cache statistics', async () => {
    const system = new BytecodeCachingSystem(testDir);

    const sql1 = `CREATE TABLE table1 (id INTEGER);`;
    const sql2 = `CREATE TABLE table2 (id INTEGER);`;

    await system.compile(sql1);
    await system.compile(sql2);
    await system.compile(sql1); // Cache hit

    const stats = system.getStatistics();

    expect(stats.cachedCount).toBe(2);
    expect(stats.hitRate).toBeGreaterThan(0);

    system.close();
  });

  it('should manage memory usage', async () => {
    const system = new BytecodeCachingSystem(testDir, {}, { maxMemory: 1048576, strategy: 'LRU' }); // 1MB

    for (let i = 0; i < 5; i++) {
      const sql = `CREATE TABLE table_${i} (id INTEGER PRIMARY KEY, data TEXT);`;
      await system.compile(sql);
    }

    const memory = system.getMemoryStatus();

    expect(memory.used).toBeLessThanOrEqual(memory.total);
    expect(memory.percentage).toBeLessThanOrEqual(100);

    system.close();
  });

  it('should compile file-based migrations', async () => {
    const system = new BytecodeCachingSystem(testDir);

    const migrationFile = path.join(testDir, 'migration.sql');
    const sql = `CREATE TABLE logs (id INTEGER, message TEXT);`;

    fs.writeFileSync(migrationFile, sql);

    const result = await system.compileFile(migrationFile);

    expect(result.success).toBe(true);
    expect(result.bytecode).toBeDefined();

    system.close();
  });

  it('should generate performance report', async () => {
    const system = new BytecodeCachingSystem(testDir);

    const sql1 = `CREATE TABLE table_a (id INTEGER);`;
    const sql2 = `CREATE TABLE table_b (id INTEGER);`;

    await system.compile(sql1);
    await system.compile(sql2);
    await system.compile(sql1);

    const report = system.getPerformanceReport();

    expect(report.caching).toBeDefined();
    expect(report.memory).toBeDefined();
    expect(report.lastPurge).toBeDefined();
    expect(report.caching.totalCached).toBe(2);

    system.close();
  });

  it('should handle complex migration', async () => {
    const system = new BytecodeCachingSystem(testDir);

    const complexSql = `
      BEGIN;
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX idx_users_email ON users(email);
      ALTER TABLE users ADD COLUMN updated_at DATETIME;
      COMMIT;
    `;

    const result = await system.compile(complexSql);

    expect(result.success).toBe(true);
    expect(result.bytecode?.instructions.length).toBeGreaterThanOrEqual(5);

    system.close();
  });

  it('should clear cache', async () => {
    const system = new BytecodeCachingSystem(testDir);

    const sql = `CREATE TABLE table_x (id INTEGER);`;
    await system.compile(sql);

    let stats = system.getStatistics();
    expect(stats.cachedCount).toBe(1);

    system.clearCache();

    stats = system.getStatistics();
    expect(stats.cachedCount).toBe(0);

    system.close();
  });
});
