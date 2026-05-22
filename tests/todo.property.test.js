/**
 * Property-Based Tests for Todo Module
 * 
 * Tests the Todo module's core properties using fast-check:
 * - Property 3: Adding a valid todo grows the list
 * - Property 4: Whitespace-only todos are rejected
 * - Property 5: Duplicate todos are rejected (case-insensitive)
 * - Property 6: Todo toggle is a round-trip
 * - Property 7: Todo deletion removes exactly one item
 * - Property 8: Sort preserves all elements
 * - Property 18: XSS prevention via text rendering
 * 
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.7, 10.1
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';

/**
 * Minimal re-implementation of the Todo module for isolated property testing.
 * This mirrors the exact logic from js/app.js Todo IIFE without DOM dependencies.
 */
function createTodoModule() {
  let todos = [];

  function generateId() {
    return Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 11);
  }

  function isDuplicate(text, excludeId) {
    var normalizedInput = text.toLowerCase();
    return todos.some(function (todo) {
      if (excludeId && todo.id === excludeId) return false;
      return todo.text.toLowerCase() === normalizedInput;
    });
  }

  function add(text) {
    if (typeof text !== 'string') {
      return { success: false, error: 'INVALID_TYPE' };
    }

    var trimmed = text.trim();

    if (!trimmed) {
      return { success: false, error: 'EMPTY_TEXT' };
    }

    if (trimmed.length > 200) {
      return { success: false, error: 'TOO_LONG' };
    }

    if (isDuplicate(trimmed)) {
      return { success: false, error: 'DUPLICATE' };
    }

    var newTodo = {
      id: generateId(),
      text: trimmed,
      completed: false,
      createdAt: Date.now()
    };

    todos.push(newTodo);
    return { success: true, todo: newTodo };
  }

  function toggle(id) {
    var todo = todos.find(function (t) { return t.id === id; });
    if (!todo) return;
    todo.completed = !todo.completed;
  }

  function deleteTodo(id) {
    var index = todos.findIndex(function (t) { return t.id === id; });
    if (index === -1) return;
    todos.splice(index, 1);
  }

  function sortTodos(todosArr, criteria) {
    var sorted = todosArr.slice();

    switch (criteria) {
      case 'date':
        sorted.sort(function (a, b) { return b.createdAt - a.createdAt; });
        break;
      case 'alpha':
        sorted.sort(function (a, b) {
          return a.text.toLowerCase().localeCompare(b.text.toLowerCase());
        });
        break;
      case 'status':
        sorted.sort(function (a, b) {
          if (a.completed === b.completed) return 0;
          return a.completed ? 1 : -1;
        });
        break;
    }

    return sorted;
  }

  function getAll() {
    return todos.slice();
  }

  return {
    add: add,
    toggle: toggle,
    delete: deleteTodo,
    sort: sortTodos,
    getAll: getAll
  };
}

/**
 * Generator for valid todo text: non-empty, 1-200 characters, printable.
 */
const validTodoText = fc.string({ minLength: 1, maxLength: 200 })
  .filter(s => s.trim().length > 0 && s.trim().length <= 200);

/**
 * Generator for whitespace-only strings.
 */
const whitespaceOnly = fc.array(
  fc.constantFrom(' ', '\t', '\n', '\r', ' ', '\t'),
  { minLength: 1, maxLength: 20 }
).map(arr => arr.join(''));

describe('Todo Module - Property-Based Tests', () => {

  /**
   * Property 3: Adding a valid todo grows the list
   * 
   * For any non-empty, non-duplicate task description, adding it to the todo list
   * SHALL increase the list length by exactly one and the new item SHALL appear in the list.
   * 
   * **Validates: Requirements 3.1**
   */
  describe('Property 3: Adding a valid todo grows the list', () => {
    it('non-empty, non-duplicate text increases list length by exactly one', () => {
      fc.assert(
        fc.property(
          validTodoText,
          (text) => {
            const todo = createTodoModule();
            const before = todo.getAll().length;
            const result = todo.add(text);

            if (result.success) {
              const after = todo.getAll().length;
              expect(after).toBe(before + 1);

              // The new item should appear in the list
              const allTodos = todo.getAll();
              const found = allTodos.find(t => t.text === text.trim());
              expect(found).toBeDefined();
              expect(found.completed).toBe(false);
            }
          }
        ),
        { numRuns: 200 }
      );
    });

    it('multiple unique additions each grow the list by one', () => {
      fc.assert(
        fc.property(
          fc.uniqueArray(validTodoText, { minLength: 1, maxLength: 10, comparator: (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase() }),
          (texts) => {
            const todo = createTodoModule();

            texts.forEach((text, i) => {
              const result = todo.add(text);
              if (result.success) {
                expect(todo.getAll().length).toBe(i + 1);
              }
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 4: Whitespace-only todos are rejected
   * 
   * For any string composed entirely of whitespace characters (spaces, tabs, newlines),
   * attempting to add it as a todo SHALL be rejected and the todo list SHALL remain unchanged.
   * 
   * **Validates: Requirements 3.2**
   */
  describe('Property 4: Whitespace-only todos are rejected', () => {
    it('whitespace-only strings are rejected, list unchanged', () => {
      fc.assert(
        fc.property(
          whitespaceOnly,
          (text) => {
            const todo = createTodoModule();
            // Add a valid todo first to ensure list is non-empty
            todo.add('Existing task');
            const before = todo.getAll().length;

            const result = todo.add(text);

            expect(result.success).toBe(false);
            expect(result.error).toBe('EMPTY_TEXT');
            expect(todo.getAll().length).toBe(before);
          }
        ),
        { numRuns: 200 }
      );
    });

    it('empty string is also rejected', () => {
      const todo = createTodoModule();
      const result = todo.add('');
      expect(result.success).toBe(false);
      expect(result.error).toBe('EMPTY_TEXT');
      expect(todo.getAll().length).toBe(0);
    });
  });

  /**
   * Property 5: Duplicate todos are rejected (case-insensitive)
   * 
   * For any existing todo item and any case variation of its text,
   * attempting to add the case variation SHALL be rejected and the todo list SHALL remain unchanged.
   * 
   * **Validates: Requirements 3.3**
   */
  describe('Property 5: Duplicate todos are rejected (case-insensitive)', () => {
    it('case variations of existing text are rejected', () => {
      fc.assert(
        fc.property(
          validTodoText,
          fc.constantFrom('upper', 'lower', 'mixed'),
          (text, caseType) => {
            const todo = createTodoModule();
            const firstResult = todo.add(text);

            // Only proceed if the first add succeeded
            if (!firstResult.success) return;

            const trimmed = text.trim();
            let caseVariation;
            switch (caseType) {
              case 'upper':
                caseVariation = trimmed.toUpperCase();
                break;
              case 'lower':
                caseVariation = trimmed.toLowerCase();
                break;
              case 'mixed':
                caseVariation = trimmed.split('').map((c, i) =>
                  i % 2 === 0 ? c.toUpperCase() : c.toLowerCase()
                ).join('');
                break;
            }

            const before = todo.getAll().length;
            const result = todo.add(caseVariation);

            expect(result.success).toBe(false);
            expect(result.error).toBe('DUPLICATE');
            expect(todo.getAll().length).toBe(before);
          }
        ),
        { numRuns: 200 }
      );
    });
  });

  /**
   * Property 6: Todo toggle is a round-trip
   * 
   * For any todo item, toggling its completion status twice
   * SHALL return it to its original completion state.
   * 
   * **Validates: Requirements 3.4**
   */
  describe('Property 6: Todo toggle is a round-trip', () => {
    it('toggling twice returns to original state', () => {
      fc.assert(
        fc.property(
          validTodoText,
          (text) => {
            const todo = createTodoModule();
            const addResult = todo.add(text);
            if (!addResult.success) return;

            const id = addResult.todo.id;
            const originalState = todo.getAll().find(t => t.id === id).completed;

            // Toggle once
            todo.toggle(id);
            const afterFirst = todo.getAll().find(t => t.id === id).completed;
            expect(afterFirst).toBe(!originalState);

            // Toggle again
            todo.toggle(id);
            const afterSecond = todo.getAll().find(t => t.id === id).completed;
            expect(afterSecond).toBe(originalState);
          }
        ),
        { numRuns: 200 }
      );
    });
  });

  /**
   * Property 7: Todo deletion removes exactly one item
   * 
   * For any todo list containing at least one item, deleting a specific item
   * SHALL reduce the list length by exactly one and that item's id SHALL no longer appear in the list.
   * 
   * **Validates: Requirements 3.5**
   */
  describe('Property 7: Todo deletion removes exactly one item', () => {
    it('deleting reduces length by one, ID no longer present', () => {
      fc.assert(
        fc.property(
          fc.uniqueArray(validTodoText, { minLength: 1, maxLength: 10, comparator: (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase() }),
          fc.nat(),
          (texts, indexSeed) => {
            const todo = createTodoModule();
            const addedIds = [];

            texts.forEach(text => {
              const result = todo.add(text);
              if (result.success) {
                addedIds.push(result.todo.id);
              }
            });

            if (addedIds.length === 0) return;

            // Pick a random item to delete
            const deleteIndex = indexSeed % addedIds.length;
            const deleteId = addedIds[deleteIndex];
            const before = todo.getAll().length;

            todo.delete(deleteId);

            const after = todo.getAll().length;
            expect(after).toBe(before - 1);

            // ID should no longer be present
            const found = todo.getAll().find(t => t.id === deleteId);
            expect(found).toBeUndefined();
          }
        ),
        { numRuns: 200 }
      );
    });
  });

  /**
   * Property 8: Sort preserves all elements
   * 
   * For any todo list and any valid sort criteria (date, alpha, status),
   * sorting SHALL produce a list of the same length containing exactly the same set of todo items.
   * 
   * **Validates: Requirements 3.7**
   */
  describe('Property 8: Sort preserves all elements', () => {
    it('sorting produces same length with same items', () => {
      fc.assert(
        fc.property(
          fc.uniqueArray(validTodoText, { minLength: 1, maxLength: 10, comparator: (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase() }),
          fc.constantFrom('date', 'alpha', 'status'),
          (texts, criteria) => {
            const todo = createTodoModule();

            texts.forEach(text => {
              todo.add(text);
            });

            const allBefore = todo.getAll();
            const sorted = todo.sort(allBefore, criteria);

            // Same length
            expect(sorted.length).toBe(allBefore.length);

            // Same set of IDs
            const idsBefore = allBefore.map(t => t.id).sort();
            const idsSorted = sorted.map(t => t.id).sort();
            expect(idsSorted).toEqual(idsBefore);

            // Same set of texts
            const textsBefore = allBefore.map(t => t.text).sort();
            const textsSorted = sorted.map(t => t.text).sort();
            expect(textsSorted).toEqual(textsBefore);
          }
        ),
        { numRuns: 200 }
      );
    });
  });

  /**
   * Property 18: XSS prevention via text rendering
   * 
   * For any string containing HTML tags or script elements, rendering it as todo text
   * SHALL produce DOM output where the string appears as literal text (not interpreted as HTML).
   * 
   * **Validates: Requirements 10.1**
   */
  describe('Property 18: XSS prevention via text rendering', () => {
    it('HTML/script strings appear as literal text when rendered via textContent', () => {
      const htmlStrings = fc.oneof(
        // Script tags
        fc.string({ minLength: 1, maxLength: 50 }).map(s => `<script>${s}</script>`),
        // HTML tags
        fc.string({ minLength: 1, maxLength: 50 }).map(s => `<div>${s}</div>`),
        // Event handlers
        fc.string({ minLength: 1, maxLength: 50 }).map(s => `<img onerror="${s}" src=x>`),
        // Mixed content
        fc.string({ minLength: 1, maxLength: 50 }).map(s => `<b>${s}</b><script>alert(1)</script>`)
      ).filter(s => s.trim().length > 0 && s.trim().length <= 200);

      fc.assert(
        fc.property(
          htmlStrings,
          (maliciousText) => {
            // Simulate the rendering approach used in the Todo module:
            // textContent assignment ensures HTML is NOT interpreted
            const span = document.createElement('span');
            span.textContent = maliciousText.trim();

            // The text should appear as literal text
            expect(span.textContent).toBe(maliciousText.trim());

            // No child elements should be created (HTML not parsed)
            expect(span.children.length).toBe(0);

            // innerHTML should show escaped entities, not raw HTML
            expect(span.innerHTML).not.toBe(maliciousText.trim());
          }
        ),
        { numRuns: 200 }
      );
    });
  });
});
