declare module 'bun:sqlite' {
  export interface DatabaseOptions {
    readonly?: boolean;
    create?: boolean;
    readwrite?: boolean;
  }

  export interface Statement<T = unknown> {
    get(...params: unknown[]): T | null;
    all(...params: unknown[]): T[];
    run(...params: unknown[]): { changes: number; lastInsertRowid: number };
  }

  export interface PreparedStatement<T = unknown> {
    get(...params: unknown[]): T | null;
    all(...params: unknown[]): T[];
    run(...params: unknown[]): { changes: number; lastInsertRowid: number };
    finalize(): void;
  }

  export interface RunResult {
    changes: number;
    lastInsertRowid: number;
  }

  export class Database {
    constructor(path: string, options?: DatabaseOptions);
    query<T = unknown>(sql: string): Statement<T>;
    prepare<T = unknown>(sql: string): PreparedStatement<T>;
    run(sql: string, ...params: unknown[]): RunResult;
    close(): void;
  }
} 