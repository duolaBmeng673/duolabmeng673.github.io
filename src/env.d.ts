declare module 'node:child_process' {
  export function execFileSync(
    file: string,
    args?: readonly string[],
    options?: {
      cwd?: string;
      encoding: 'utf8' | 'utf-8';
      maxBuffer?: number;
      env?: Record<string, string | undefined>;
    },
  ): string;
}

declare module 'node:fs' {
  export function existsSync(path: string): boolean;
  export function readFileSync(path: string, encoding: 'utf8' | 'utf-8'): string;
}

declare module 'node:module' {
  export function createRequire(filename: string | URL): {
    resolve(id: string): string;
  };
}

declare module 'node:path' {
  export function dirname(p: string): string;
  export function join(...paths: string[]): string;
}

declare module 'node:url' {
  export function fileURLToPath(url: string | URL): string;
}

declare const process: {
  cwd(): string;
  env: Record<string, string | undefined>;
};
