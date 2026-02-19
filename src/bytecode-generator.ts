/**
 * Bytecode Generator - Compile migration code to bytecode
 */

import { createHash } from 'crypto';
import { Bytecode, BytecodeInstruction, BytecodeOp, BytecodeGenerationOptions } from './types';

export class BytecodeGenerator {
  private options: BytecodeGenerationOptions;

  constructor(options: BytecodeGenerationOptions = {}) {
    this.options = {
      optimize: true,
      strict: true,
      verbose: false,
      ...options,
    };
  }

  /**
   * SQL 코드를 바이트코드로 컴파일
   */
  compile(sourceCode: string): Bytecode {
    const startTime = Date.now();
    const sourceHash = this._calculateHash(sourceCode);

    // SQL 파싱 및 바이트코드 생성
    const instructions = this._parse(sourceCode);

    // 최적화
    let optimized = instructions;
    if (this.options.optimize) {
      optimized = this._optimize(instructions);
    }

    const bytecode: Bytecode = {
      version: '1.0',
      sourceCode,
      sourceHash,
      instructions: optimized,
      metadata: {
        compiledAt: new Date(),
        compiledBy: 'BytecodeGenerator',
        executionTime: Date.now() - startTime,
      },
    };

    if (this.options.verbose) {
      console.log(`✅ Compiled ${sourceCode.split('\n').length} lines in ${bytecode.metadata.executionTime}ms`);
    }

    return bytecode;
  }

  /**
   * 검증
   */
  validate(bytecode: Bytecode): boolean {
    try {
      if (!bytecode.instructions || bytecode.instructions.length === 0) {
        return false;
      }

      for (const instr of bytecode.instructions) {
        if (!this._isValidOp(instr.op)) {
          return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  // ============ PRIVATE METHODS ============

  /**
   * SQL 파싱
   */
  private _parse(sourceCode: string): BytecodeInstruction[] {
    const instructions: BytecodeInstruction[] = [];
    const lines = sourceCode.split('\n');
    let lineNumber = 0;

    for (const line of lines) {
      lineNumber++;
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith('--')) continue;

      const instruction = this._parseLine(trimmed, lineNumber);
      if (instruction) {
        instructions.push(instruction);
      }
    }

    return instructions;
  }

  /**
   * 라인 파싱
   */
  private _parseLine(line: string, lineNumber: number): BytecodeInstruction | null {
    const upperLine = line.toUpperCase();

    if (upperLine.startsWith('CREATE TABLE')) {
      return {
        op: 'CREATE_TABLE' as BytecodeOp,
        args: { sql: line },
        lineNumber,
      };
    }

    if (upperLine.startsWith('DROP TABLE')) {
      return {
        op: 'DROP_TABLE' as BytecodeOp,
        args: { sql: line },
        lineNumber,
      };
    }

    if (upperLine.startsWith('ALTER TABLE')) {
      if (upperLine.includes('ADD COLUMN')) {
        return {
          op: 'ADD_COLUMN' as BytecodeOp,
          args: { sql: line },
          lineNumber,
        };
      }
      if (upperLine.includes('DROP COLUMN')) {
        return {
          op: 'DROP_COLUMN' as BytecodeOp,
          args: { sql: line },
          lineNumber,
        };
      }
    }

    if (upperLine.startsWith('CREATE INDEX')) {
      return {
        op: 'CREATE_INDEX' as BytecodeOp,
        args: { sql: line },
        lineNumber,
      };
    }

    if (upperLine.startsWith('DROP INDEX')) {
      return {
        op: 'DROP_INDEX' as BytecodeOp,
        args: { sql: line },
        lineNumber,
      };
    }

    if (upperLine.startsWith('BEGIN')) {
      return {
        op: 'TRANSACTION_BEGIN' as BytecodeOp,
        args: {},
        lineNumber,
      };
    }

    if (upperLine.startsWith('COMMIT')) {
      return {
        op: 'TRANSACTION_COMMIT' as BytecodeOp,
        args: {},
        lineNumber,
      };
    }

    if (upperLine.startsWith('ROLLBACK')) {
      return {
        op: 'TRANSACTION_ROLLBACK' as BytecodeOp,
        args: {},
        lineNumber,
      };
    }

    // 주석 또는 지원하지 않는 명령
    if (line.startsWith('--')) {
      return {
        op: 'COMMENT' as BytecodeOp,
        args: { text: line },
        lineNumber,
      };
    }

    return null;
  }

  /**
   * 최적화
   */
  private _optimize(instructions: BytecodeInstruction[]): BytecodeInstruction[] {
    // 불필요한 명령 제거
    return instructions.filter((instr) => instr.op !== 'COMMENT');
  }

  /**
   * 유효한 Op인지 확인
   */
  private _isValidOp(op: BytecodeOp): boolean {
    const validOps: BytecodeOp[] = [
      'CREATE_TABLE',
      'DROP_TABLE',
      'ADD_COLUMN',
      'DROP_COLUMN',
      'CREATE_INDEX',
      'DROP_INDEX',
      'ALTER_TABLE',
      'CONSTRAINT_ADD',
      'CONSTRAINT_DROP',
      'DATA_MIGRATION',
      'TRANSACTION_BEGIN',
      'TRANSACTION_COMMIT',
      'TRANSACTION_ROLLBACK',
      'COMMENT',
    ];

    return validOps.includes(op);
  }

  /**
   * 해시 계산
   */
  private _calculateHash(content: string): string {
    return createHash('sha256').update(content).digest('hex').substring(0, 16);
  }
}
