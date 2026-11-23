import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

// next/link and next/navigation expect the App Router to be mounted. These tests render
// components directly, so both are stubbed down to what the components actually use.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => <a href={href} {...rest}>{children}</a>,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/screen",
  useRouter: () => ({ replace: () => {}, push: () => {} }),
}));

// Node 22+ ships its own experimental `localStorage` global. Without
// `--localstorage-file` it is a stub with no methods, and on Node 26 it shadows jsdom's
// implementation, so `localStorage.clear()` throws before any test runs. Put an in-memory
// Storage back so the suite behaves the same on every Node version.
if (typeof window.localStorage?.clear !== "function") {
  const store = new Map<string, string>();
  const memoryStorage: Storage = {
    get length() { return store.size; },
    clear: () => store.clear(),
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    key: (i) => Array.from(store.keys())[i] ?? null,
    removeItem: (k) => { store.delete(k); },
    setItem: (k, v) => { store.set(k, String(v)); },
  };
  Object.defineProperty(window, "localStorage", { value: memoryStorage, configurable: true });
  Object.defineProperty(globalThis, "localStorage", { value: memoryStorage, configurable: true });
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
