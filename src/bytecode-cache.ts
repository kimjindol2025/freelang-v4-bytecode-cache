/**
 * Bytecode Cache - Manage cached bytecode with file persistence
 */

import * as fs from 'fs';
import * as path from 'path';
import { Bytecode, CachedBytecode, CacheStatistics, CacheResult, MemoryManagementOptions, MemoryStatus } from './types';
import { BytecodeGenerator } from './bytecode-generator';

export class BytecodeCache {
  private generator: BytecodeGenerator;
  private cachePath: string;
  private cache: Map<string, CachedBytecode> = new Map();
  private indexPath: string;
  private memoryOptions: MemoryManagementOptions;

  constructor(
    cachePath: string,
    memoryOptions: MemoryManagementOptions = {
      maxMemory: 104857600, // 100MB
      strategy: 'LRU',
      enableCompression: false,
    }
  ) {
    this.cachePath = cachePath;
    this.memoryOptions = memoryOptions;
    this.indexPath = path.join(cachePath, 'cache-index.json');
    this.generator = new BytecodeGenerator();

    this._ensureDirectory();
    this._loadCache();
  }

  /**
   * 바이트코드 가져오기 (캐시 또는 생성)
   */
  async get(sourceCode: string, forceRecompile: boolean = false): Promise<CacheResult> {
    const startTime = Date.now();
    const cacheKey = this._generateCacheKey(sourceCode);

    try {
      // 캐시 확인
      if (!forceRecompile && this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey)!;
        cached.hits++;
        cached.lastAccessed = new Date();
        this._saveCache();

        return {
          success: true,
          source: 'CACHE',
          bytecode: cached,
          executionTime: Date.now() - startTime,
          message: 'Loaded from cache',
        };
      }

      // 새로 생성
      const bytecode = this.generator.compile(sourceCode);
      const cachedBytecode: CachedBytecode = {
        ...bytecode,
        cacheId: cacheKey,
        cachedAt: new Date(),
        hits: 1,
        lastAccessed: new Date(),
        memoryUsage: this._estimateMemoryUsage(bytecode),
      };

      // 메모리 관리
      if (this._getTotalMemory() + cachedBytecode.memoryUsage > this.memoryOptions.maxMemory) {
        this._evict();
      }

      this.cache.set(cacheKey, cachedBytecode);
      this._saveCache();

      return {
        success: true,
        source: 'GENERATED',
        bytecode: cachedBytecode,
        executionTime: Date.now() - startTime,
        message: 'Generated new bytecode',
      };
    } catch (error) {
      return {
        success: false,
        source: 'GENERATED',
        bytecode: null,
        executionTime: Date.now() - startTime,
        message: `Failed to get bytecode: ${error}`,
        error: String(error),
      };
    }
  }

  /**
   * 캐시 통계
   */
  getStatistics(): CacheStatistics {
    let totalHits = 0;
    let totalMisses = 0;
    let totalMemory = 0;

    for (const cached of this.cache.values()) {
      totalHits += cached.hits;
      totalMemory += cached.memoryUsage;
    }

    const hitRate = totalHits / (totalHits + totalMisses) || 0;

    return {
      totalSize: this.cache.size,
      cachedCount: this.cache.size,
      hitRate: hitRate * 100,
      missRate: (1 - hitRate) * 100,
      averageHits: totalHits / this.cache.size || 0,
      memoryUsage: totalMemory,
    };
  }

  /**
   * 메모리 상태
   */
  getMemoryStatus(): MemoryStatus {
    const used = this._getTotalMemory();
    const available = this.memoryOptions.maxMemory - used;
    const total = this.memoryOptions.maxMemory;

    return {
      used,
      available: Math.max(available, 0),
      total,
      percentage: (used / total) * 100,
      itemCount: this.cache.size,
      evictionThreshold: (available / total) * 100,
    };
  }

  /**
   * 캐시 정리 (수동)
   */
  clear(): void {
    this.cache.clear();
    this._saveCache();
  }

  /**
   * 정리
   */
  close(): void {
    this._saveCache();
  }

  // ============ PRIVATE METHODS ============

  private _ensureDirectory(): void {
    if (!fs.existsSync(this.cachePath)) {
      fs.mkdirSync(this.cachePath, { recursive: true });
    }
  }

  private _generateCacheKey(sourceCode: string): string {
    const hash = require('crypto').createHash('sha256').update(sourceCode).digest('hex');
    return hash.substring(0, 16);
  }

  private _loadCache(): void {
    try {
      if (fs.existsSync(this.indexPath)) {
        const data = fs.readFileSync(this.indexPath, 'utf-8');
        const parsed = JSON.parse(data);

        for (const [key, cached] of Object.entries(parsed.cache || {})) {
          const item = cached as any;
          this.cache.set(key, {
            ...item,
            cachedAt: new Date(item.cachedAt),
            lastAccessed: new Date(item.lastAccessed),
            metadata: {
              ...item.metadata,
              compiledAt: new Date(item.metadata.compiledAt),
            },
          });
        }
      }
    } catch (error) {
      console.error(`Failed to load cache: ${error}`);
      this.cache.clear();
    }
  }

  private _saveCache(): void {
    try {
      const cacheObj: Record<string, unknown> = {};

      for (const [key, cached] of this.cache.entries()) {
        cacheObj[key] = cached;
      }

      fs.writeFileSync(
        this.indexPath,
        JSON.stringify(
          {
            cache: cacheObj,
            savedAt: new Date().toISOString(),
          },
          null,
          2
        )
      );
    } catch (error) {
      console.error(`Failed to save cache: ${error}`);
    }
  }

  private _getTotalMemory(): number {
    let total = 0;
    for (const cached of this.cache.values()) {
      total += cached.memoryUsage;
    }
    return total;
  }

  private _estimateMemoryUsage(bytecode: Bytecode): number {
    // 대략적인 메모리 사용량 계산
    return JSON.stringify(bytecode).length + 1024; // 1KB 오버헤드
  }

  private _evict(): void {
    const strategy = this.memoryOptions.strategy;

    if (strategy === 'LRU') {
      // 가장 최근에 사용하지 않은 항목 제거
      let lruKey = '';
      let lruTime = new Date();

      for (const [key, cached] of this.cache.entries()) {
        if (cached.lastAccessed < lruTime) {
          lruTime = cached.lastAccessed;
          lruKey = key;
        }
      }

      if (lruKey) {
        this.cache.delete(lruKey);
      }
    } else if (strategy === 'LFU') {
      // 가장 적게 사용된 항목 제거
      let lfuKey = '';
      let lfuHits = Infinity;

      for (const [key, cached] of this.cache.entries()) {
        if (cached.hits < lfuHits) {
          lfuHits = cached.hits;
          lfuKey = key;
        }
      }

      if (lfuKey) {
        this.cache.delete(lfuKey);
      }
    } else if (strategy === 'FIFO') {
      // 가장 오래된 항목 제거
      let fifoKey = '';
      let fifoTime = new Date();

      for (const [key, cached] of this.cache.entries()) {
        if (cached.cachedAt < fifoTime) {
          fifoTime = cached.cachedAt;
          fifoKey = key;
        }
      }

      if (fifoKey) {
        this.cache.delete(fifoKey);
      }
    }
  }
}
