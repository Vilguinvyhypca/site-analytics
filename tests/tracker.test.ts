import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { build } from 'esbuild';

test('standalone tracker loads without a framework, storage, or network access', async () => {
  const source = await readFile(new URL('../packages/tracker/src/index.ts', import.meta.url), 'utf8');
  const result = await build({ stdin: { contents: source, loader: 'ts' }, bundle: true, write: false, format: 'iife', globalName: 'SiteAnalytics' });
  const context = vm.createContext({});
  vm.runInContext(result.outputFiles[0]!.text, context);
  assert.equal(vm.runInContext('SiteAnalytics.status().collectionEnabled', context), false);
});
