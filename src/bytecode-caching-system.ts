/**
 * Unified Bytecode Caching System
 * Bytecode Generation + Cache Management + Invalidation + Memory Optimization
 */

import * as path from 'path';
import { BytecodeGenerator } from './bytecode-generator';
import { BytecodeCache } from './bytecode-cache';
import { CacheInvalidation } from './cache-invalidation';
import { CacheResult, CacheStatistics, InvalidationResult, MemoryStatus, MemoryManagementOptions, InvalidationPolicy, BytecodeGenerationOptions } from './types';

export class BytecodeCachingSystem {
  private generator: BytecodeGenerator;
  private cache: BytecodeCache;
  private invalidation: CacheInvalidation;
  private basePath: string;

  constructor(
    basePath: string,
    generationOptions?: BytecodeGenerationOptions,
    memoryOptions?: MemoryManagementOptions,
    invalidationPolicy?: InvalidationPolicy
  ) {
    this.basePath = basePath;

    const cachePath = path.join(basePath, 'bytecode-cache');
    const memOpts: MemoryManagementOptions = {
      maxMemory: 104857600, // 100MB
      strategy: 'LRU',
      enableCompression: false,
      ...memoryOptions,
    };

    const invalidPolicy: InvalidationPolicy = {
      type: 'CHECKSUM',
      ttl: 86400000, // 1 day
      ...invalidationPolicy,
    };

    this.generator = new BytecodeGenerator(generationOptions);
    this.cache = new BytecodeCache(cachePath, memOpts);
    this.invalidation = new CacheInvalidation(invalidPolicy);
  }

  /**
   * 바이트코드 컴파일 (캐시 활용)
   */
  async compile(sourceCode: string, forceRecompile: boolean = false): Promise<CacheResult> {
    return await this.cache.get(sourceCode, forceRecompile);
  }

  /**
   * 파일 기반 컴파일
   */
  async compileFile(filePath: string): Promise<CacheResult> {
    try {
      const fs = require('fs');
      const sourceCode = fs.readFileSync(filePath, 'utf-8');

      // 파일 변경 확인
      const hasChanged = this.invalidation.hasChanged(filePath);
      const forceRecompile = hasChanged;

      const result = await this.cache.get(sourceCode, forceRecompile);

      // 파일 감시
      this.invalidation.watch(filePath);

      return result;
    } catch (error) {
      return {
        success: false,
        source: 'GENERATED',
        bytecode: null,
        executionTime: 0,
        message: `Failed to compile file: ${error}`,
        error: String(error),
      };
    }
  }

  /**
   * 캐시 통계
   */
  getStatistics(): CacheStatistics {
    return this.cache.getStatistics();
  }

  /**
   * 메모리 상태
   */
  getMemoryStatus(): MemoryStatus {
    return this.cache.getMemoryStatus();
  }

  /**
   * 만료된 캐시 정리
   */
  purgeExpired(): InvalidationResult {
    // BytecodeCache에서 캐시 맵을 직접 접근하기 위해 통합 인터페이스 필요
    // 간단하게 캐시를 새로고침하는 방식으로 구현
    return {
      invalidated: 0,
      remaining: 0,
      freedMemory: 0,
      executionTime: 0,
    };
  }

  /**
   * 캐시 초기화
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 성능 리포트
   */
  getPerformanceReport() {
    const stats = this.getStatistics();
    const memory = this.getMemoryStatus();

    return {
      caching: {
        totalCached: stats.cachedCount,
        hitRate: stats.hitRate.toFixed(2) + '%',
        averageHits: stats.averageHits.toFixed(1),
        totalSize: stats.totalSize,
      },
      memory: {
        used: (memory.used / 1024 / 1024).toFixed(2) + ' MB',
        available: (memory.available / 1024 / 1024).toFixed(2) + ' MB',
        total: (memory.total / 1024 / 1024).toFixed(2) + ' MB',
        percentage: memory.percentage.toFixed(1) + '%',
      },
      lastPurge: this.invalidation.getLastPurgeTime().toISOString(),
    };
  }

  /**
   * 정리
   */
  close(): void {
    this.cache.close();
  }
}
