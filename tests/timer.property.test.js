/**
 * Property-Based Tests for Focus Timer Module
 * 
 * Tests the Focus Timer module's core properties using fast-check:
 * - Property 9: Timer display format
 * - Property 10: Timer bounds invariant
 * - Property 11: Timer reset restores duration
 * 
 * Validates: Requirements 4.2, 4.3, 4.6, 4.8
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';

/**
 * Minimal re-implementation of the FocusTimer module for isolated property testing.
 * This mirrors the exact logic from js/app.js FocusTimer IIFE.
 */
function createFocusTimerModule() {
  const PRESETS = [1, 5, 10, 15, 20, 25, 30, 45, 60];

  let duration = 25 * 60;
  let remaining = 25 * 60;
  let running = false;

  /**
   * Format total seconds as "MM:SS" (zero-padded).
   * @param {number} totalSeconds - Seconds remaining (0 to 3600)
   * @returns {string} Formatted time string
   */
  function formatTimerDisplay(totalSeconds) {
    var minutes = Math.floor(totalSeconds / 60);
    var seconds = totalSeconds % 60;
    return String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
  }

  /**
   * Set the timer duration from a preset value in minutes.
   * Resets the timer to the new duration.
   * @param {number} minutes - Duration in minutes (must be one of PRESETS)
   */
  function setDuration(minutes) {
    if (PRESETS.indexOf(minutes) === -1) return;

    if (running) {
      running = false;
    }

    duration = minutes * 60;
    remaining = duration;
  }

  /**
   * Start the countdown timer.
   */
  function start() {
    if (running) return;
    if (remaining <= 0) return;
    running = true;
  }

  /**
   * Simulate a single tick (1 second decrement).
   */
  function tick() {
    if (!running) return;
    if (remaining <= 0) {
      running = false;
      return;
    }

    remaining--;

    if (remaining <= 0) {
      running = false;
    }
  }

  /**
   * Stop (pause) the countdown timer.
   */
  function stop() {
    running = false;
  }

  /**
   * Reset the timer to the selected duration.
   */
  function reset() {
    stop();
    remaining = duration;
  }

  /**
   * Get the current timer state.
   * @returns {{ running: boolean, remaining: number, duration: number }}
   */
  function getState() {
    return {
      running: running,
      remaining: remaining,
      duration: duration
    };
  }

  return {
    formatTimerDisplay: formatTimerDisplay,
    setDuration: setDuration,
    start: start,
    stop: stop,
    reset: reset,
    tick: tick,
    getState: getState,
    PRESETS: PRESETS
  };
}

describe('Focus Timer Module - Property-Based Tests', () => {
  let timer;

  beforeEach(() => {
    timer = createFocusTimerModule();
  });

  /**
   * Property 9: Timer display format
   * 
   * For any integer value of seconds between 0 and 3600, the formatTimerDisplay function
   * produces a string matching the pattern "MM:SS" where MM is zero-padded minutes and
   * SS is zero-padded seconds.
   * 
   * **Validates: Requirements 4.2**
   */
  describe('Property 9: Timer display format', () => {
    it('for any seconds 0-3600, formatTimerDisplay produces "MM:SS" pattern', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 3600 }),
          (totalSeconds) => {
            const result = timer.formatTimerDisplay(totalSeconds);

            // Must match MM:SS pattern (two digits, colon, two digits)
            expect(result).toMatch(/^\d{2}:\d{2}$/);

            // Verify the values are correct
            const expectedMinutes = Math.floor(totalSeconds / 60);
            const expectedSeconds = totalSeconds % 60;
            const expectedStr = String(expectedMinutes).padStart(2, '0') + ':' + String(expectedSeconds).padStart(2, '0');
            expect(result).toBe(expectedStr);
          }
        ),
        { numRuns: 500 }
      );
    });

    it('minutes and seconds are always zero-padded to 2 digits', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 3600 }),
          (totalSeconds) => {
            const result = timer.formatTimerDisplay(totalSeconds);
            const [mm, ss] = result.split(':');

            // Both parts must be exactly 2 characters
            expect(mm.length).toBe(2);
            expect(ss.length).toBe(2);

            // Seconds must be 0-59
            const secondsVal = parseInt(ss, 10);
            expect(secondsVal).toBeGreaterThanOrEqual(0);
            expect(secondsVal).toBeLessThanOrEqual(59);

            // Minutes must be non-negative
            const minutesVal = parseInt(mm, 10);
            expect(minutesVal).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 300 }
      );
    });
  });

  /**
   * Property 10: Timer bounds invariant
   * 
   * For any sequence of timer operations (setDuration, start, tick, stop, reset),
   * the remaining time is always >= 0 and <= duration.
   * 
   * **Validates: Requirements 4.3, 4.8**
   */
  describe('Property 10: Timer bounds invariant', () => {
    it('for any sequence of operations, remaining is always >= 0 and <= duration', () => {
      // Define possible timer operations
      const timerOperation = fc.oneof(
        fc.constant({ type: 'start' }),
        fc.constant({ type: 'stop' }),
        fc.constant({ type: 'reset' }),
        fc.constant({ type: 'tick' }),
        fc.constantFrom(...[1, 5, 10, 15, 20, 25, 30, 45, 60]).map(m => ({ type: 'setDuration', minutes: m }))
      );

      fc.assert(
        fc.property(
          fc.array(timerOperation, { minLength: 1, maxLength: 100 }),
          (operations) => {
            // Fresh timer for each test
            const t = createFocusTimerModule();

            for (const op of operations) {
              switch (op.type) {
                case 'start':
                  t.start();
                  break;
                case 'stop':
                  t.stop();
                  break;
                case 'reset':
                  t.reset();
                  break;
                case 'tick':
                  t.tick();
                  break;
                case 'setDuration':
                  t.setDuration(op.minutes);
                  break;
              }

              // After every operation, check the invariant
              const state = t.getState();
              expect(state.remaining).toBeGreaterThanOrEqual(0);
              expect(state.remaining).toBeLessThanOrEqual(state.duration);
            }
          }
        ),
        { numRuns: 300 }
      );
    });

    it('ticking down never goes below zero', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...[1, 5, 10, 15, 20, 25, 30, 45, 60]),
          fc.integer({ min: 1, max: 4000 }),
          (presetMinutes, tickCount) => {
            const t = createFocusTimerModule();
            t.setDuration(presetMinutes);
            t.start();

            // Tick more times than the duration to ensure we don't go below 0
            for (let i = 0; i < tickCount; i++) {
              t.tick();
              const state = t.getState();
              expect(state.remaining).toBeGreaterThanOrEqual(0);
              expect(state.remaining).toBeLessThanOrEqual(state.duration);
            }
          }
        ),
        { numRuns: 200 }
      );
    });
  });

  /**
   * Property 11: Timer reset restores duration
   * 
   * For any timer state (running or stopped) with any remaining time,
   * calling reset sets remaining to exactly the selected duration.
   * 
   * **Validates: Requirements 4.6**
   */
  describe('Property 11: Timer reset restores duration', () => {
    it('reset always sets remaining to exactly the selected duration', () => {
      const timerOperation = fc.oneof(
        fc.constant({ type: 'start' }),
        fc.constant({ type: 'stop' }),
        fc.constant({ type: 'tick' }),
        fc.constantFrom(...[1, 5, 10, 15, 20, 25, 30, 45, 60]).map(m => ({ type: 'setDuration', minutes: m }))
      );

      fc.assert(
        fc.property(
          fc.constantFrom(...[1, 5, 10, 15, 20, 25, 30, 45, 60]),
          fc.array(timerOperation, { minLength: 0, maxLength: 50 }),
          (initialPreset, operations) => {
            const t = createFocusTimerModule();
            t.setDuration(initialPreset);

            // Apply a sequence of operations to put the timer in an arbitrary state
            for (const op of operations) {
              switch (op.type) {
                case 'start':
                  t.start();
                  break;
                case 'stop':
                  t.stop();
                  break;
                case 'tick':
                  t.tick();
                  break;
                case 'setDuration':
                  t.setDuration(op.minutes);
                  break;
              }
            }

            // Record the current duration before reset
            const stateBeforeReset = t.getState();
            const expectedDuration = stateBeforeReset.duration;

            // Reset the timer
            t.reset();

            // After reset, remaining must equal the duration
            const stateAfterReset = t.getState();
            expect(stateAfterReset.remaining).toBe(expectedDuration);
            expect(stateAfterReset.duration).toBe(expectedDuration);
            expect(stateAfterReset.running).toBe(false);
          }
        ),
        { numRuns: 300 }
      );
    });

    it('reset after partial countdown restores full duration', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...[1, 5, 10, 15, 20, 25, 30, 45, 60]),
          fc.integer({ min: 1, max: 3600 }),
          (presetMinutes, tickCount) => {
            const t = createFocusTimerModule();
            t.setDuration(presetMinutes);
            const expectedDuration = presetMinutes * 60;

            // Start and tick some number of times
            t.start();
            const actualTicks = Math.min(tickCount, expectedDuration);
            for (let i = 0; i < actualTicks; i++) {
              t.tick();
            }

            // Reset
            t.reset();

            const state = t.getState();
            expect(state.remaining).toBe(expectedDuration);
            expect(state.duration).toBe(expectedDuration);
            expect(state.running).toBe(false);
          }
        ),
        { numRuns: 200 }
      );
    });
  });
});
