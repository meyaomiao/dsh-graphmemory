import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';

// Client bundle for the 记忆图谱 tab. DSH loads it through
// window.__ModuleLoader__ with an id matching this package name.
await mkdir('dist', { recursive: true });

const banner = [
  'window.__ModuleLoader__.load({ id: "graph-memory", factory: (require) => {',
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

console.log('graph-memory: dist/client.js 构建完成');
