import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';

// Two client artifacts:
// 1. dist/client.js       — better-sidebar tab bundle (ModuleLoader CJS,
//                           id must match the package name; react external).
// 2. dist/standalone.js   — self-contained page bundle served by the host at
//                           /graph-memory/app (react bundled in, no platform
//                           plugin required).
await mkdir('dist', { recursive: true });

const banner = [
  'window.__ModuleLoader__.load({ id: "dsh-graphmemory", factory: (require) => {',
  'var module = { exports: {} };',
  'var exports = module.exports;',
].join('\n');
const footer = '\nreturn module.exports;\n}});';

await build({
  entryPoints: ['dashboard/client.ts'],
  outfile: 'dist/client.js',
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: ['es2022'],
  jsx: 'automatic',
  sourcemap: true,
  external: ['react', 'react-dom/*', '@deepseek-ai/*'],
  banner: { js: banner },
  footer: { js: footer },
});

await build({
  entryPoints: ['dashboard/standalone.ts'],
  outfile: 'dist/standalone.js',
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2022'],
  jsx: 'automatic',
  sourcemap: true,
  minify: true,
});

console.log('graph-memory: dist/client.js + dist/standalone.js 构建完成');
