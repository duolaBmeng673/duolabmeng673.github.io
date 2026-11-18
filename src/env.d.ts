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

declare const process: {
  cwd(): string;
  env: Record<string, string | undefined>;
};
