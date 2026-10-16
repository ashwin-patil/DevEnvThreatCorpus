import test from 'node:test';

export function privateStoreTest(name, fn) {
  return test(name, {
    skip: process.platform === 'win32' ? 'POSIX-only private storage; not validated on native Windows' : false,
  }, fn);
}
