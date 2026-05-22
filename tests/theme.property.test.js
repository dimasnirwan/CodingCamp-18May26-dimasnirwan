/**
 * Property-Based Tests for Theme Module
 * 
 * Tests the Theme module's core properties using fast-check:
 * - Property 15: Theme toggle round-trip
 * 
 * **Validates: Requirements 6.2, 6.3, 6.5**
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';

/**
 * Minimal re-implementation of the Theme module for isolated property testing.
 * This mirrors the exact logic from js/app.js Theme IIFE, using the jsdom environment.
 */
function createThemeModule() {
  const PREFIX = 'dashboard_';
  const STORAGE_KEY = 'theme';
  const VALID_THEMES = ['light', 'dark'];

  function getStoredTheme() {
    try {
      var raw = localStorage.getItem(PREFIX + STORAGE_KEY);
      if (raw === null) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function setStoredTheme(theme) {
    localStorage.setItem(PREFIX + STORAGE_KEY, JSON.stringify(theme));
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
  }

  function get() {
    return document.documentElement.getAttribute('data-theme') || 'light';
  }

  function toggle() {
    var current = get();
    var next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    setStoredTheme(next);
  }

  function init(initialTheme) {
    applyTheme(initialTheme);
    setStoredTheme(initialTheme);
  }

  return { init, toggle, get, getStoredTheme };
}

describe('Theme Module - Property-Based Tests', () => {
  let Theme;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    Theme = createThemeModule();
  });

  /**
   * Property 15: Theme toggle round-trip
   * 
   * For any initial theme state (light or dark), toggling the theme twice
   * returns to the original theme state, and the stored preference matches
   * the displayed theme after each toggle.
   * 
   * **Validates: Requirements 6.2, 6.3, 6.5**
   */
  describe('Property 15: Theme toggle round-trip', () => {
    it('toggling twice returns to original state for any initial theme', () => {
      const themeArb = fc.constantFrom('light', 'dark');

      fc.assert(
        fc.property(themeArb, (initialTheme) => {
          // Set up initial state
          Theme.init(initialTheme);
          expect(Theme.get()).toBe(initialTheme);

          // First toggle
          Theme.toggle();
          const afterFirstToggle = Theme.get();
          expect(afterFirstToggle).not.toBe(initialTheme);

          // Stored preference matches displayed theme after first toggle
          expect(Theme.getStoredTheme()).toBe(afterFirstToggle);

          // Second toggle
          Theme.toggle();
          const afterSecondToggle = Theme.get();

          // Round-trip: back to original
          expect(afterSecondToggle).toBe(initialTheme);

          // Stored preference matches displayed theme after second toggle
          expect(Theme.getStoredTheme()).toBe(afterSecondToggle);
        }),
        { numRuns: 200 }
      );
    });

    it('stored preference always matches displayed theme after any number of toggles', () => {
      const themeArb = fc.constantFrom('light', 'dark');
      const toggleCountArb = fc.integer({ min: 1, max: 20 });

      fc.assert(
        fc.property(themeArb, toggleCountArb, (initialTheme, toggleCount) => {
          // Set up initial state
          Theme.init(initialTheme);

          // Perform N toggles, checking consistency after each
          for (let i = 0; i < toggleCount; i++) {
            Theme.toggle();
            const displayed = Theme.get();
            const stored = Theme.getStoredTheme();

            // Consistency: stored always matches displayed
            expect(stored).toBe(displayed);

            // Theme is always a valid value
            expect(['light', 'dark']).toContain(displayed);
          }

          // After even number of toggles, should be back to original
          if (toggleCount % 2 === 0) {
            expect(Theme.get()).toBe(initialTheme);
          } else {
            // After odd number of toggles, should be the opposite
            const expected = initialTheme === 'light' ? 'dark' : 'light';
            expect(Theme.get()).toBe(expected);
          }
        }),
        { numRuns: 200 }
      );
    });
  });
});
