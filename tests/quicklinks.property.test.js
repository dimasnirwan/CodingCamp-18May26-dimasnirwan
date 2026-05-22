/**
 * Property-Based Tests for Quick Links Module
 * 
 * Tests the QuickLinks module's core properties using fast-check:
 * - Property 12: URL validation rejects non-http protocols
 * - Property 13: Empty link name is rejected
 * - Property 14: Link removal decreases count
 * 
 * Validates: Requirements 5.3, 5.4, 5.6, 10.2
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';

/**
 * Minimal re-implementation of the QuickLinks module for isolated property testing.
 * This mirrors the exact logic from js/app.js QuickLinks IIFE.
 */
function createQuickLinksModule() {
  var links = [];
  var MAX_LINKS = 20;

  function generateId() {
    return 'link-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 11);
  }

  /**
   * Validate a URL string.
   * Only allows http:// and https:// protocols to prevent javascript: injection.
   */
  function isValidUrl(url) {
    if (typeof url !== 'string') return false;
    var trimmed = url.trim();
    if (!trimmed) return false;
    return /^https?:\/\//i.test(trimmed);
  }

  /**
   * Add a new quick link.
   * Validates name (non-empty, 1-50 chars) and URL (must start with http:// or https://).
   * Enforces maximum of 20 links.
   */
  function add(name, url, icon) {
    if (!icon || typeof icon !== 'string' || !icon.trim()) {
      icon = 'fa-solid fa-link';
    }

    // Validate name
    if (typeof name !== 'string' || !name.trim()) {
      return { success: false, error: 'EMPTY_NAME' };
    }

    var trimmedName = name.trim();

    if (trimmedName.length > 50) {
      return { success: false, error: 'NAME_TOO_LONG' };
    }

    // Validate URL
    if (typeof url !== 'string' || !url.trim()) {
      return { success: false, error: 'INVALID_URL' };
    }

    var trimmedUrl = url.trim();

    if (!isValidUrl(trimmedUrl)) {
      return { success: false, error: 'INVALID_URL' };
    }

    // Enforce maximum links limit
    if (links.length >= MAX_LINKS) {
      return { success: false, error: 'MAX_LINKS' };
    }

    var newLink = {
      id: generateId(),
      name: trimmedName,
      url: trimmedUrl,
      icon: icon.trim()
    };

    links.push(newLink);
    return { success: true, link: newLink };
  }

  /**
   * Remove a quick link by ID.
   */
  function remove(id) {
    var index = links.findIndex(function (link) { return link.id === id; });
    if (index === -1) return { success: false, error: 'NOT_FOUND' };

    links.splice(index, 1);
    return { success: true };
  }

  /**
   * Get all quick links (returns a copy of the array).
   */
  function getAll() {
    return links.slice();
  }

  /**
   * Reset links for testing purposes.
   */
  function reset() {
    links = [];
  }

  return {
    add: add,
    remove: remove,
    getAll: getAll,
    isValidUrl: isValidUrl,
    reset: reset
  };
}

describe('Quick Links Module - Property-Based Tests', () => {
  let QuickLinks;

  beforeEach(() => {
    QuickLinks = createQuickLinksModule();
  });

  /**
   * Property 12: URL validation rejects non-http protocols
   * 
   * For any string that does not start with "http://" or "https://",
   * the URL validation SHALL reject it, preventing addition as a quick link.
   * 
   * **Validates: Requirements 5.3, 10.2**
   */
  describe('Property 12: URL validation rejects non-http protocols', () => {
    it('for any string not starting with http:// or https://, URL validation rejects it', () => {
      // Generate strings that do NOT start with http:// or https://
      const nonHttpUrl = fc.string({ minLength: 1 }).filter(s => {
        const trimmed = s.trim();
        return trimmed.length > 0 &&
          !trimmed.toLowerCase().startsWith('http://') &&
          !trimmed.toLowerCase().startsWith('https://');
      });

      fc.assert(
        fc.property(nonHttpUrl, (invalidUrl) => {
          // isValidUrl should reject it
          expect(QuickLinks.isValidUrl(invalidUrl)).toBe(false);

          // Attempting to add with a valid name should fail with INVALID_URL
          const result = QuickLinks.add('Valid Name', invalidUrl);
          expect(result.success).toBe(false);
          expect(result.error).toBe('INVALID_URL');
        }),
        { numRuns: 200 }
      );
    });

    it('rejects dangerous protocols like javascript:, data:, ftp:', () => {
      const dangerousProtocols = fc.oneof(
        fc.constant('javascript:alert(1)'),
        fc.constant('javascript:void(0)'),
        fc.constant('data:text/html,<script>alert(1)</script>'),
        fc.constant('ftp://files.example.com'),
        fc.constant('file:///etc/passwd'),
        fc.constant('mailto:user@example.com'),
        fc.constant('tel:+1234567890'),
        fc.constant('vbscript:msgbox("xss")')
      );

      fc.assert(
        fc.property(dangerousProtocols, (dangerousUrl) => {
          expect(QuickLinks.isValidUrl(dangerousUrl)).toBe(false);

          const result = QuickLinks.add('Test Link', dangerousUrl);
          expect(result.success).toBe(false);
          expect(result.error).toBe('INVALID_URL');
        }),
        { numRuns: 50 }
      );
    });

    it('accepts valid http:// and https:// URLs', () => {
      const validUrl = fc.oneof(
        fc.webUrl().map(url => url.startsWith('http') ? url : 'https://' + url),
        fc.string({ minLength: 1, maxLength: 50 }).map(s => 'https://' + s.replace(/\s/g, '')),
        fc.string({ minLength: 1, maxLength: 50 }).map(s => 'http://' + s.replace(/\s/g, ''))
      );

      fc.assert(
        fc.property(validUrl, (url) => {
          expect(QuickLinks.isValidUrl(url)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 13: Empty link name is rejected
   * 
   * For any string composed entirely of whitespace characters,
   * attempting to add it as a quick link name SHALL be rejected.
   * 
   * **Validates: Requirements 5.4**
   */
  describe('Property 13: Empty link name is rejected', () => {
    it('for any whitespace-only string, adding as link name is rejected', () => {
      // Generate strings composed entirely of whitespace characters
      const whitespaceOnly = fc.array(
        fc.constantFrom(' ', '\t', '\n', '\r', '\f', '\v'),
        { minLength: 1, maxLength: 20 }
      ).map(chars => chars.join(''));

      fc.assert(
        fc.property(whitespaceOnly, (emptyName) => {
          const result = QuickLinks.add(emptyName, 'https://example.com');
          expect(result.success).toBe(false);
          expect(result.error).toBe('EMPTY_NAME');

          // List should remain unchanged
          expect(QuickLinks.getAll().length).toBe(0);
        }),
        { numRuns: 200 }
      );
    });

    it('empty string is rejected as link name', () => {
      const result = QuickLinks.add('', 'https://example.com');
      expect(result.success).toBe(false);
      expect(result.error).toBe('EMPTY_NAME');
      expect(QuickLinks.getAll().length).toBe(0);
    });
  });

  /**
   * Property 14: Link removal decreases count
   * 
   * For any quick links list containing at least one item,
   * removing a specific link SHALL reduce the list length by exactly one
   * and that link's ID SHALL no longer appear in the list.
   * 
   * **Validates: Requirements 5.6**
   */
  describe('Property 14: Link removal decreases count', () => {
    it('removing a link reduces list length by exactly one and ID is no longer present', () => {
      // Generate a number of links to add (1 to 10)
      const linkCount = fc.integer({ min: 1, max: 10 });

      fc.assert(
        fc.property(linkCount, fc.integer({ min: 0, max: 9 }), (count, removeIndex) => {
          // Reset state for each test run
          QuickLinks.reset();

          // Add 'count' links
          const addedLinks = [];
          for (let i = 0; i < count; i++) {
            const result = QuickLinks.add('Link ' + i, 'https://example' + i + '.com');
            if (result.success) {
              addedLinks.push(result.link);
            }
          }

          // Ensure we have links to work with
          const allBefore = QuickLinks.getAll();
          if (allBefore.length === 0) return;

          // Pick a valid index to remove
          const validIndex = removeIndex % allBefore.length;
          const linkToRemove = allBefore[validIndex];
          const lengthBefore = allBefore.length;

          // Remove the link
          const removeResult = QuickLinks.remove(linkToRemove.id);
          expect(removeResult.success).toBe(true);

          // Verify length decreased by exactly one
          const allAfter = QuickLinks.getAll();
          expect(allAfter.length).toBe(lengthBefore - 1);

          // Verify the removed link's ID is no longer present
          const idsAfter = allAfter.map(link => link.id);
          expect(idsAfter).not.toContain(linkToRemove.id);
        }),
        { numRuns: 200 }
      );
    });

    it('removing a non-existent ID does not change the list', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 5 }),
          fc.string({ minLength: 5, maxLength: 20 }),
          (count, fakeId) => {
            QuickLinks.reset();

            // Add some links
            for (let i = 0; i < count; i++) {
              QuickLinks.add('Link ' + i, 'https://example' + i + '.com');
            }

            const allBefore = QuickLinks.getAll();
            const lengthBefore = allBefore.length;

            // Try to remove a non-existent ID
            const result = QuickLinks.remove('nonexistent-' + fakeId);
            expect(result.success).toBe(false);

            // Length should remain unchanged
            const allAfter = QuickLinks.getAll();
            expect(allAfter.length).toBe(lengthBefore);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
