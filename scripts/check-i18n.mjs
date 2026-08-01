#!/usr/bin/env node
/**
 * Fails when the locale dictionaries drift apart.
 *
 * The `uz` locale had silently fallen 13 keys behind `en`; because the fallback
 * language was `ru`, Uzbek users saw Russian sentences and nothing ever surfaced
 * the gap. This check makes that a build error instead of a support ticket.
 *
 * Usage: node scripts/check-i18n.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const localesDir = resolve(here, '..', 'src', 'i18n');
const REFERENCE = 'en';
const LOCALES = ['en', 'ru', 'uz'];

/** Plural variants of one logical key; each locale legitimately has a different set. */
const PLURAL_SUFFIXES = ['_zero', '_one', '_two', '_few', '_many', '_other'];

const stripPlural = key => {
  const suffix = PLURAL_SUFFIXES.find(s => key.endsWith(s));
  return suffix ? key.slice(0, -suffix.length) : key;
};

/**
 * Collects dotted key paths from a locale module. The files are plain TS object
 * literals, so a brace-depth walk over `identifier:` lines is enough and keeps the
 * script dependency-free (no ts parser, no transpile step).
 */
function collectKeys(source) {
  const keys = new Set();
  const stack = [];
  for (const rawLine of source.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) continue;

    const opening = line.match(/^([a-zA-Z0-9_]+)\s*:\s*\{$/);
    if (opening) {
      stack.push(opening[1]);
      continue;
    }
    if (line.startsWith('}')) {
      stack.pop();
      continue;
    }
    const entry = line.match(/^([a-zA-Z0-9_]+)\s*:/);
    if (entry && stack.length > 0) {
      keys.add([...stack, entry[1]].join('.'));
    }
  }
  return keys;
}

const byLocale = new Map();
for (const locale of LOCALES) {
  const source = readFileSync(resolve(localesDir, `${locale}.ts`), 'utf8');
  byLocale.set(locale, collectKeys(source));
}

const reference = byLocale.get(REFERENCE);
const referenceLogical = new Set([...reference].map(stripPlural));

let failed = false;
for (const locale of LOCALES) {
  if (locale === REFERENCE) continue;
  const keys = byLocale.get(locale);
  const logical = new Set([...keys].map(stripPlural));

  const missing = [...referenceLogical].filter(key => !logical.has(key)).sort();
  const extra = [...logical].filter(key => !referenceLogical.has(key)).sort();

  if (missing.length) {
    failed = true;
    console.error(`\n${locale}: ${missing.length} key(s) missing vs ${REFERENCE}`);
    for (const key of missing) console.error(`  - ${key}`);
  }
  if (extra.length) {
    failed = true;
    console.error(`\n${locale}: ${extra.length} key(s) not present in ${REFERENCE}`);
    for (const key of extra) console.error(`  + ${key}`);
  }
}

if (failed) {
  console.error('\ni18n check failed — add the missing keys to every locale.');
  process.exit(1);
}

console.log(`i18n check passed — ${reference.size} keys, locales in sync (${LOCALES.join(', ')}).`);
