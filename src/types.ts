/**
 * Bytecode Caching System - Type Definitions
 */

/**
 * 바이트코드 명령어
 */
export type BytecodeOp =
  | 'CREATE_TABLE'
  | 'DROP_TABLE'
  | 'ADD_COLUMN'
  | 'DROP_COLUMN'
  | 'CREATE_INDEX'
  | 'DROP_INDEX'
  | 'ALTER_TABLE'
  | 'CONSTRAINT_ADD'
  | 'CONSTRAINT_DROP'
  | 'DATA_MIGRATION'
  | 'TRANSACTION_BEGIN'
  | 'TRANSACTION_COMMIT'
  | 'TRANSACTION_ROLLBACK'
  | 'COMMENT';

/**
 * 바이트코드 명령
 */
export interface BytecodeInstruction {
  op: BytecodeOp;
  args: Record<string, unknown>;
  lineNumber?: number;
}

/**
 * 컴파일된 바이트코드
 */
export interface Bytecode {
  version: string;
  sourceCode: string;
  sourceHash: string;
  instructions: BytecodeInstruction[];
  metadata: {
    compiledAt: Date;
    compiledBy: string;
    executionTime: number;
  };
}

/**
 * 캐시된 바이트코드
 */
export interface CachedBytecode extends Bytecode {
  cacheId: string;
  cachedAt: Date;
  hits: number;
  lastAccessed: Date;
  memoryUsage: number;
}

/**
 * 캐시 통계
 */
export interface CacheStatistics {
  totalSize: number;
  cachedCount: number;
  hitRate: number;
  missRate: number;
  averageHits: number;
  memoryUsage: number;
  lastPurge?: Date;
}

/**
 * 캐시 무효화 정책
 */
export interface InvalidationPolicy {
  type: 'CHECKSUM' | 'TIMESTAMP' | 'VERSION' | 'MANUAL';
  checkInterval?: number; // 밀리초
  ttl?: number; // 캐시 유효 기간 (밀리초)
  maxAge?: number; // 최대 나이 (일)
}

/**
 * 메모리 관리 옵션
 */
export interface MemoryManagementOptions {
  maxMemory: number; // 바이트
  strategy: 'LRU' | 'LFU' | 'FIFO';
  enableCompression?: boolean;
  compressionThreshold?: number; // 바이트
}

/**
 * 바이트코드 생성 옵션
 */
export interface BytecodeGenerationOptions {
  optimize?: boolean;
  strict?: boolean;
  verbose?: boolean;
}

/**
 * 캐시 결과
 */
export interface CacheResult {
  success: boolean;
  source: 'CACHE' | 'GENERATED';
  bytecode: Bytecode | null;
  executionTime: number;
  message: string;
  error?: string;
}

/**
 * 캐시 무효화 결과
 */
export interface InvalidationResult {
  invalidated: number;
  remaining: number;
  freedMemory: number;
  executionTime: number;
}

/**
 * 메모리 상태
 */
export interface MemoryStatus {
  used: number;
  available: number;
  total: number;
  percentage: number;
  itemCount: number;
  evictionThreshold: number;
}
