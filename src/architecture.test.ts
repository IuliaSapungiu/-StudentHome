/// <reference types="node" />
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Enforces the layering that keeps the future Supabase migration cheap:
//  1. UI (app, components, hooks) never touches storage, mock data, demo code or the services root directly.
//  2. Pure logic and data files stay free of React / React Native / Expo / AsyncStorage.
// Allow-lists are explicit and checked for staleness.

const SRC = path.join(process.cwd(), 'src');
const rel = (f: string) => path.relative(SRC, f).split(path.sep).join('/');

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [p] : [];
  });
}
const importsOf = (file: string) => [...fs.readFileSync(file, 'utf8').matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);

const files = walk(SRC);
const UI = files.filter((f) => /^(app|components|hooks)\//.test(rel(f)));

// UI files allowed to import the demo-only module (each is gated by a flag in src/config/demo.ts).
const DEMO_ALLOWED = new Set(['app/(auth)/login.tsx', 'app/(auth)/verify-email.tsx', 'app/demo-controls.tsx']);
for (const f of DEMO_ALLOWED) assert.ok(fs.existsSync(path.join(SRC, f)), `stale allow-list entry: ${f}`);

const violations: string[] = [];
for (const file of UI) {
  for (const spec of importsOf(file)) {
    const bad =
      /@react-native-async-storage\//.test(spec) ? 'imports AsyncStorage' :
      /(^|\/)storage(\/|$)/.test(spec) ? 'imports the storage layer' :
      /\/mock[^/]*$/.test(spec) ? 'imports a mock implementation' :
      /(^|\/)services(\/|$)/.test(spec) ? 'imports the services root (use a provider or hook)' :
      /(^@\/|\.\.?\/(?:.*\/)?)demo\//.test(spec) && !DEMO_ALLOWED.has(rel(file)) ? 'imports demo-only code' :
      null;
    if (bad) violations.push(`${rel(file)}: ${bad} (${spec})`);
  }
}
assert.deepEqual(violations, [], `UI layering violations:\n${violations.join('\n')}`);

// Pure logic / data / mock-repository files: no React, React Native, Expo, AsyncStorage, '@/' aliases or the AsyncStorage binding.
const PURE = [
  /^lib\//, /^features\/validation\//, /^storage\/keyValue\.ts$/,
  /^features\/forms\/(types|formRules|providerForms|registrationForm|formConfigRepository|mockFormConfigRepository)\.ts$/,
  /^features\/plans\/(types|plans|pricing|eligibility|planCatalogRepository|mockPlanCatalogRepository)\.ts$/,
  /^features\/session\/(types|sessionLogic|validation|accountRepository|mockAccountRepository)\.ts$/,
  /^features\/verification\/(types|verificationRules|verificationRepository|mockVerificationStore|verificationService|mockVerificationService)\.ts$/,
  /^data\/(types|listing|format|filterProperties|repository|mockRepository|mockProperties)\.ts$/,
  /^demo\/(demoAccounts|demoVerificationControls)\.ts$/,
];
const pureFiles = files.filter((f) => PURE.some((r) => r.test(rel(f))));
assert.ok(pureFiles.length >= 30, `expected many pure files, found ${pureFiles.length}`);
const pureViolations: string[] = [];
for (const file of pureFiles) {
  for (const spec of importsOf(file)) {
    if (/^(react|react-native|expo|expo-.*|@expo\/.*|@react-native.*)$/.test(spec) || spec.startsWith('@/') || /mockStorage$/.test(spec)) {
      pureViolations.push(`${rel(file)} imports ${spec}`);
    }
  }
}
assert.deepEqual(pureViolations, [], `Pure-logic violations:\n${pureViolations.join('\n')}`);

console.log(`architecture: all checks passed (${UI.length} UI files, ${pureFiles.length} pure files)`);
