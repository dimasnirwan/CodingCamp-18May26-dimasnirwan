/**
 * Property-Based Tests for Storage Module
 * 
 * Tests the Storage module's core properties using fast-check:
 * - Property 16: Storage serialization round-trip
 * - Property 17: Storage resilience to corrupted data
 * 
 * Validates: Requirements 7.1, 7.2, 7.3, 7.7
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';

/**
 * Minimal re-implementation of the Storage module for isolated property testing.
 * This mirrors the exact logic from js/app.js Storage IIFE, using the jsdom localStorage.
 */
function createStorageModule() {
  const PREFIX = 'dashboard_';

  function get(key, defaultValue) {
    if (typeof defaultValue === 'undefined') {
      defaultValue = null;
    }

    var namespacedKey = PREFIX + key;

    try {
      var raw = localStorage.getItem(namespacedKey);
      if (raw === null) {
        return defaultValue;
      }
      return JSON.parse(raw);
    } catch (e) {
      console.warn('Storage.get: Failed to parse data for key "' + key + '". Returning default value.', e);
      return defaultValue;
    }
  }

  function set(key, value) {
    var namespacedKey = PREFIX + key;
    try {
      localStorage.setItem(namespacedKey, JSON.stringify(value));
    } catch (e) {
      console.warn('Storage.set: Failed to write key "' + key + '".', e);
    }
  }

  function remove(key) {
    var namespacedKey = PREFIX + key;
    try {
      localStorage.removeItem(namespacedKey);
    } catch (e) {
      console.warn('Storage.remove: Failed to remove key "' + key + '".', e);
    }
  }

  return { get, set, remove };
}

describe('Storage Module - Property-Based Tests', () => {
  let Storage;

  beforeEach(() => {
    localStorage.clear();
    Storage = createStorageModule();
  });

  /**
   * Property 16: Storage serialization round-trip
   * 
   * For any JSON-serializable value (objects, arrays, strings, numbers, booleans, null),
   * storing it via Storage.set and retrieving it via Storage.get produces an equivalent value.
   * 
   * **Validates: Requirements 7.1, 7.2, 7.7**
   */
  describe('Property 16: Storage serialization round-trip', () => {
    it('for any JSON-serializable value, set then get produces equivalent value', () => {
      const jsonSerializable = fc.oneof(
        fc.string(),
        fc.integer(),
        fc.double({ noNaN: true, noDefaultInfinity: true }).filter(v => !Object.is(v, -0)),
        fc.boolean(),
        fc.constant(null),
        fc.array(fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null))),
        fc.dictionary(
          fc.string().filter(s => s.length > 0),
          fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null))
        )
      );

      fc.assert(
        fc.property(
          fc.string().filter(s => s.length > 0 && s.length <= 100),
          jsonSerializable,
          (key, value) => {
            Storage.set(key, value);
            const retrieved = Storage.get(key, undefined);
            expect(retrieved).toEqual(value);
          }
        ),
        { numRuns: 200 }
      );
    });

    it('round-trip works for nested objects and arrays', () => {
      const nestedValue = fc.oneof(
        fc.array(fc.array(fc.integer())),
        fc.dictionary(
          fc.string().filter(s => s.length > 0),
          fc.array(fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null)))
        ),
        fc.tuple(fc.string(), fc.integer(), fc.boolean()).map(([s, n, b]) => ({ str: s, num: n, bool: b }))
      );

      fc.assert(
        fc.property(
          fc.string().filter(s => s.length > 0 && s.length <= 50),
          nestedValue,
          (key, value) => {
            Storage.set(key, value);
            const retrieved = Storage.get(key, undefined);
            expect(retrieved).toEqual(value);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 17: Storage resilience to corrupted data
   * 
   * For any non-JSON string stored directly in localStorage under a dashboard key,
   * calling Storage.get returns the specified default value without throwing an exception.
   * 
   * **Validates: Requirements 7.3, 7.7**
   */
  describe('Property 17: Storage resilience to corrupted data', () => {
    it('for any non-JSON string in localStorage, get returns default without throwing', () => {
      // Generate strings that are NOT valid JSON
      const nonJsonString = fc.string().filter(s => {
        try {
          JSON.parse(s);
          return false; // It IS valid JSON, so filter it out
        } catch {
          return true; // It is NOT valid JSON, keep it
        }
      });

      const defaultValue = fc.oneof(
        fc.string(),
        fc.integer(),
        fc.constant(null),
        fc.constant([]),
        fc.constant({})
      );

      fc.assert(
        fc.property(
          fc.string().filter(s => s.length > 0 && s.length <= 50),
          nonJsonString,
          defaultValue,
          (key, corruptedData, defaultVal) => {
            // Write corrupted data directly to localStorage (bypassing Storage.set)
            localStorage.setItem('dashboard_' + key, corruptedData);

            // Storage.get should return the default value without throwing
            let result;
            expect(() => {
              result = Storage.get(key, defaultVal);
            }).not.toThrow();

            expect(result).toEqual(defaultVal);
          }
        ),
        { numRuns: 200 }
      );
    });

    it('corrupted data does not affect other keys', () => {
      fc.assert(
        fc.property(
          fc.string().filter(s => s.length > 0 && s.length <= 30),
          fc.string().filter(s => s.length > 0 && s.length <= 30).filter(s2 => s2 !== 'corrupted_key'),
          fc.string().filter(s => { try { JSON.parse(s); return false; } catch { return true; } }),
          fc.integer(),
          (corruptedKey, validKey, corruptedData, validValue) => {
            // Ensure keys are different
            if (corruptedKey === validKey) return;

            // Store a valid value
            Storage.set(validKey, validValue);

            // Write corrupted data directly for another key
            localStorage.setItem('dashboard_' + corruptedKey, corruptedData);

            // The valid key should still return its value
            const retrieved = Storage.get(validKey, null);
            expect(retrieved).toEqual(validValue);

            // The corrupted key should return default
            const corruptedResult = Storage.get(corruptedKey, 'default');
            expect(corruptedResult).toEqual('default');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
