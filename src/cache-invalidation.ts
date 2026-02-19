/**
 * Cache Invalidation - Manage cache lifecycle and invalidation
 */

import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { InvalidationPolicy, InvalidationResult, CachedBytecode } from './types';

export class CacheInvalidation {
  private policy: InvalidationPolicy;
  private watchMap: Map<string, string> = new Map(); // path -> hash
  private lastPurge: Date = new Date();

  constructor(policy: InvalidationPolicy = { type: 'CHECKSUM', ttl: 86400000 }) {
    this.policy = policy;
  }

  /**
   * 캐시 항목 유효 여부 확인
   */
  isValid(cached: CachedBytecode, sourceCode: string): boolean {
    switch (this.policy.type) {
      case 'CHECKSUM':
        return this._validateChecksum(cached, sourceCode);

      case 'TIMESTAMP':
        return this._validateTimestamp(cached);

      case 'VERSION':
        return this._validateVersion(cached);

      case 'MANUAL':
        return true; // 수동으로만 무효화

      default:
        return false;
    }
  }

  /**
   * 파일 변경 감시
   */
  watch(filePath: string): void {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const hash = this._calculateHash(content);
      this.watchMap.set(filePath, hash);
    } catch (error) {
      console.error(`Failed to watch file: ${error}`);
    }
  }

  /**
   * 파일 변경 감지
   */
  hasChanged(filePath: string): boolean {
    try {
      if (!fs.existsSync(filePath)) {
        return true; // 파일이 없으면 변경된 것으로 간주
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const currentHash = this._calculateHash(content);
      const previousHash = this.watchMap.get(filePath);

      return currentHash !== previousHash;
    } catch {
      return true;
    }
  }

  /**
   * 만료된 캐시 정리
   */
  purgeExpired(cachedItems: Map<string, CachedBytecode>): InvalidationResult {
    const startTime = Date.now();
    const before = cachedItems.size;
    let freedMemory = 0;

    for (const [key, cached] of cachedItems.entries()) {
      if (!this.isValid(cached, cached.sourceCode)) {
        freedMemory += cached.memoryUsage;
        cachedItems.delete(key);
      }
    }

    const after = cachedItems.size;
    this.lastPurge = new Date();

    return {
      invalidated: before - after,
      remaining: after,
      freedMemory,
      executionTime: Date.now() - startTime,
    };
  }

  /**
   * 마지막 정리 시간
   */
  getLastPurgeTime(): Date {
    return this.lastPurge;
  }

  /**
   * 정책 변경
   */
  setPolicy(policy: InvalidationPolicy): void {
    this.policy = policy;
  }

  // ============ PRIVATE METHODS ============

  private _validateChecksum(cached: CachedBytecode, sourceCode: string): boolean {
    const currentHash = this._calculateHash(sourceCode);
    return currentHash === cached.sourceHash;
  }

  private _validateTimestamp(cached: CachedBytecode): boolean {
    if (!this.policy.ttl) return true;

    const now = Date.now();
    const cacheTime = cached.cachedAt.getTime();
    const age = now - cacheTime;

    return age < this.policy.ttl;
  }

  private _validateVersion(cached: CachedBytecode): boolean {
    // 버전 번호 비교 (예: bytecode.version)
    return cached.version === '1.0';
  }

  private _calculateHash(content: string): string {
    return createHash('sha256').update(content).digest('hex').substring(0, 16);
  }
}
