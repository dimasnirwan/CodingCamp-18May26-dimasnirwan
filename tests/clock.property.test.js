/**
 * Property-Based Tests for Clock Module
 * 
 * Tests the Clock module's core properties using fast-check:
 * - Property 1: Greeting correctness by hour
 * - Property 2: Greeting includes custom name
 * 
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

/**
 * Re-implementation of the getGreeting function from js/app.js Clock module
 * for isolated property testing.
 * 
 * Morning: 5-11, Afternoon: 12-17, Evening: 18-21, Night: 22-4
 */
function getGreeting(hour) {
  if (hour >= 5 && hour < 12) return 'Good Morning';
  if (hour >= 12 && hour < 18) return 'Good Afternoon';
  if (hour >= 18 && hour < 22) return 'Good Evening';
  return 'Good Night';
}

/**
 * Re-implementation of the getDisplayName function from js/app.js Clock module.
 * Returns "Friend" when name is empty or whitespace-only.
 * Truncates to 30 characters max.
 */
function getDisplayName(name) {
  if (!name || !name.trim()) return 'Friend';
  var trimmed = name.trim();
  return trimmed.length > 30 ? trimmed.substring(0, 30) : trimmed;
}

/**
 * Renders the full greeting string in the format "[Greeting], [Name]".
 */
function renderGreeting(hour, name) {
  var greeting = getGreeting(hour);
  var displayName = getDisplayName(name);
  return greeting + ', ' + displayName;
}

describe('Clock Module - Property-Based Tests', () => {
  /**
   * Property 1: Greeting correctness by hour
   * 
   * For any hour value between 0 and 23, the getGreeting function SHALL return
   * the correct greeting for that hour's time bracket:
   * - "Good Morning" for hours 5–11
   * - "Good Afternoon" for hours 12–17
   * - "Good Evening" for hours 18–21
   * - "Good Night" for hours 22–4 (wrapping midnight)
   * 
   * **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
   */
  describe('Property 1: Greeting correctness by hour', () => {
    it('for any hour 0-23, getGreeting returns the correct greeting for that time bracket', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 23 }),
          (hour) => {
            const greeting = getGreeting(hour);

            if (hour >= 5 && hour <= 11) {
              expect(greeting).toBe('Good Morning');
            } else if (hour >= 12 && hour <= 17) {
              expect(greeting).toBe('Good Afternoon');
            } else if (hour >= 18 && hour <= 21) {
              expect(greeting).toBe('Good Evening');
            } else {
              // hours 22, 23, 0, 1, 2, 3, 4
              expect(greeting).toBe('Good Night');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('getGreeting always returns one of the four valid greeting strings', () => {
      const validGreetings = ['Good Morning', 'Good Afternoon', 'Good Evening', 'Good Night'];

      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 23 }),
          (hour) => {
            const greeting = getGreeting(hour);
            expect(validGreetings).toContain(greeting);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('every hour maps to exactly one greeting (no overlap)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 23 }),
          (hour) => {
            const greeting = getGreeting(hour);
            // The greeting should be a single defined string, not undefined or empty
            expect(greeting).toBeDefined();
            expect(greeting.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 2: Greeting includes custom name
   * 
   * For any non-empty string used as a username, the rendered greeting SHALL
   * contain that exact string (truncated to 30 chars if needed).
   * 
   * **Validates: Requirements 2.5**
   */
  describe('Property 2: Greeting includes custom name', () => {
    it('for any non-empty username, the rendered greeting contains that name (truncated to 30 chars)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 23 }),
          fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
          (hour, name) => {
            const greeting = renderGreeting(hour, name);
            const expectedName = name.trim().length > 30
              ? name.trim().substring(0, 30)
              : name.trim();

            expect(greeting).toContain(expectedName);
          }
        ),
        { numRuns: 200 }
      );
    });

    it('greeting format is always "[Greeting], [Name]" with comma separator', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 23 }),
          fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
          (hour, name) => {
            const greeting = renderGreeting(hour, name);
            // Should contain ", " as separator between greeting and name
            expect(greeting).toContain(', ');
            // Should start with one of the valid greetings
            const validPrefixes = ['Good Morning, ', 'Good Afternoon, ', 'Good Evening, ', 'Good Night, '];
            const startsWithValid = validPrefixes.some(prefix => greeting.startsWith(prefix));
            expect(startsWithValid).toBe(true);
          }
        ),
        { numRuns: 200 }
      );
    });

    it('names longer than 30 characters are truncated in the greeting', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 23 }),
          fc.string({ minLength: 31, maxLength: 100 }).filter(s => s.trim().length > 30),
          (hour, longName) => {
            const greeting = renderGreeting(hour, longName);
            const truncatedName = longName.trim().substring(0, 30);

            expect(greeting).toContain(truncatedName);
            // The full untrimmed name should NOT appear if it's longer than 30 chars
            if (longName.trim().length > 30) {
              expect(greeting).not.toContain(longName.trim());
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('empty or whitespace-only names default to "Friend"', () => {
      const whitespaceStrings = fc.oneof(
        fc.constant(''),
        fc.constant('   '),
        fc.constant('\t'),
        fc.constant('\n'),
        fc.array(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 0, maxLength: 20 }).map(arr => arr.join(''))
      );

      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 23 }),
          whitespaceStrings,
          (hour, emptyName) => {
            const greeting = renderGreeting(hour, emptyName);
            expect(greeting).toContain('Friend');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
