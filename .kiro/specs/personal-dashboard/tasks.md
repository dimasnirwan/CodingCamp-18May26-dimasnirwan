# Implementation Plan: Personal Dashboard

## Overview

Implement a personal dashboard web application as a single-page app with vanilla HTML, CSS, and JavaScript. The dashboard includes a real-time clock with contextual greetings, a to-do list with full CRUD, a Pomodoro-style focus timer, configurable quick links, and theme management. All data persists via LocalStorage. The implementation follows 6 phases: UI Setup, Realtime Clock, To-Do Logic, Focus Timer, Quick Links, and UI Polish.

## Tasks

- [x] 1. FASE 1: Setup UI - HTML Layout and Project Structure
  - [x] 1.1 Create project files and HTML structure with CDN dependencies
    - Create `index.html` with semantic HTML5 structure
    - Include CDN links for GSAP, AOS (2.3.4), Font Awesome (6.7.2), and Google Fonts (Mona Sans)
    - Define main layout sections: header (clock/greeting), todo container, timer container, quick links container
    - Add theme toggle button in header
    - Add name input field for custom greeting
    - Create `css/style.css` and `js/app.js` with proper linking
    - _Requirements: 8.2, 8.3, 9.1_

  - [x] 1.2 Implement CSS foundation with theme system and glassmorphism
    - Define CSS custom properties for light and dark themes (colors, shadows, blur)
    - Implement Golden Ratio typography scale (base 16px, ratio 1.618)
    - Create glassmorphism card pattern (20px backdrop blur, 0.72 opacity backgrounds)
    - Add backdrop-filter fallback for unsupported browsers (solid background with readable contrast)
    - Implement mobile-first responsive breakpoints (640px, 960px, 1280px)
    - Set minimum touch target size of 44x44px for interactive elements below 640px
    - Apply 960-grid system with flexbox for multi-column layout at 960px+
    - Center content with max-width 1280px at 1280px+
    - Ensure minimum body font size of 14px
    - _Requirements: 8.1, 8.2, 8.4, 8.5, 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 1.3 Implement Storage Module in app.js
    - Create Storage object with `get(key, defaultValue)`, `set(key, value)`, and `remove(key)` methods
    - Use namespaced keys prefixed with "dashboard_"
    - Serialize data as JSON before writing, deserialize when reading
    - Handle corrupted/unparseable data by returning default value and logging console warning
    - Handle missing keys by returning default value without warning
    - Handle LocalStorage unavailability or quota exceeded gracefully (continue with in-memory state, show warning indicator)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 10.3_

  - [x] 1.4 Write property tests for Storage Module
    - **Property 16: Storage serialization round-trip** - For any JSON-serializable value, store via set and retrieve via get produces equivalent value
    - **Property 17: Storage resilience to corrupted data** - For any non-JSON string in localStorage, get returns default without throwing
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.7**

- [x] 2. Checkpoint - Verify project structure and base styling
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. FASE 2: Realtime Clock and Contextual Greeting
  - [x] 3.1 Implement Clock Module with real-time updates
    - Create Clock object with `init()`, `destroy()`, `getGreeting(hour)`, `formatTime(date)`, `formatDate(date)` methods
    - Display current time (HH:MM:SS) updated every 1 second via setInterval
    - Display current date formatted according to user's system locale
    - Resynchronize time when tab regains visibility (visibilitychange event)
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 3.2 Implement contextual greeting with custom name
    - Implement `getGreeting(hour)` returning "Good Morning" (5-11), "Good Afternoon" (12-17), "Good Evening" (18-21), "Good Night" (22-4)
    - Display greeting in format "[Greeting], [Name]" with name truncated to 30 characters max
    - Use "Friend" as default name when no custom name is set or stored name is empty/whitespace
    - Bind name input to update greeting and persist to LocalStorage via Storage Module
    - Update greeting automatically when hour crosses into different period
    - Use textContent for rendering (XSS prevention)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 10.1, 10.4_

  - [x] 3.3 Write property tests for Clock Module
    - **Property 1: Greeting correctness by hour** - For any hour 0-23, getGreeting returns correct greeting for that bracket
    - **Property 2: Greeting includes custom name** - For any non-empty username string, rendered greeting contains that string
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

- [x] 4. FASE 3: To-Do Logic
  - [x] 4.1 Implement Todo Module - Add and Render
    - Create Todo object with `init()`, `add(text)`, `getAll()`, `render()` methods
    - Generate unique IDs using `crypto.randomUUID()` or timestamp-based fallback
    - Validate input: reject empty/whitespace-only text, enforce 1-200 character limit
    - Detect duplicates case-insensitively before adding
    - Show inline error for empty text, toast notification for duplicates
    - Render todo list using textContent (never innerHTML) for XSS prevention
    - Persist all changes to LocalStorage immediately after each operation
    - _Requirements: 3.1, 3.2, 3.3, 3.8, 10.1, 10.3, 10.4_

  - [x] 4.2 Implement Todo Module - Toggle, Delete, and Edit
    - Implement `toggle(id)` to invert completion status with strikethrough styling
    - Implement `delete(id)` to remove item from list (length decreases by exactly one)
    - Implement `edit(id, newText)` with same validation rules as creation (non-empty, 1-200 chars, no duplicate with other items)
    - Persist all changes to LocalStorage immediately
    - Use textContent for all user-provided text rendering
    - _Requirements: 3.4, 3.5, 3.6, 3.8, 10.1_

  - [x] 4.3 Implement Todo Module - Sort functionality
    - Implement `sort(criteria)` supporting "date" (newest first), "alpha" (A-Z case-insensitive), "status" (incomplete before completed)
    - Return new sorted array without mutating original
    - Add sort selector UI element with three options
    - Re-render list after sort change
    - _Requirements: 3.7_

  - [x] 4.4 Write property tests for Todo Module
    - **Property 3: Adding a valid todo grows the list** - Non-empty, non-duplicate text increases list length by exactly one
    - **Property 4: Whitespace-only todos are rejected** - Whitespace-only strings are rejected, list unchanged
    - **Property 5: Duplicate todos are rejected (case-insensitive)** - Case variations of existing text are rejected
    - **Property 6: Todo toggle is a round-trip** - Toggling twice returns to original state
    - **Property 7: Todo deletion removes exactly one item** - Deleting reduces length by one, ID no longer present
    - **Property 8: Sort preserves all elements** - Sorting produces same length with same items
    - **Property 18: XSS prevention via text rendering** - HTML/script strings appear as literal text
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.7, 10.1**

- [x] 5. Checkpoint - Verify clock, greeting, and todo functionality
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. FASE 4: Focus Timer
  - [x] 6.1 Implement Focus Timer Module
    - Create FocusTimer object with `init()`, `setDuration(minutes)`, `start()`, `stop()`, `reset()`, `getState()` methods
    - Support preset durations: 1, 5, 10, 15, 20, 25, 30, 45, 60 minutes as selectable options
    - Display remaining time in MM:SS format (zero-padded)
    - Implement countdown with setInterval (1 second tick), decrementing each second
    - On completion (remaining reaches zero): stop countdown, show visual completion notification
    - Stop button pauses countdown preserving remaining time
    - Start on paused timer resumes from preserved remaining time
    - Reset stops countdown and restores display to selected duration
    - Disable Start control while timer is running
    - Maintain invariant: remaining time always between 0 and selected duration (inclusive)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9_

  - [x] 6.2 Write property tests for Focus Timer
    - **Property 9: Timer display format** - For any seconds 0-3600, formatTimerDisplay produces "MM:SS" pattern
    - **Property 10: Timer bounds invariant** - For any sequence of operations, remaining is always >= 0 and <= duration
    - **Property 11: Timer reset restores duration** - Reset always sets remaining to exactly the selected duration
    - **Validates: Requirements 4.2, 4.3, 4.6, 4.8**

- [x] 7. FASE 5: Quick Links
  - [x] 7.1 Implement Quick Links Module
    - Create QuickLinks object with `init()`, `add(name, url, icon)`, `remove(id)`, `getAll()` methods
    - Display default links (Gmail, GitHub) with Font Awesome icons on first load
    - Load and display stored links from LocalStorage on subsequent loads
    - Validate name: non-empty after trim, 1-50 characters max
    - Validate URL: must start with http:// or https:// (reject javascript: and other protocols)
    - Show validation errors for empty name and invalid URL format
    - Enforce maximum of 20 quick links, reject additions beyond limit
    - Open links in new browser tab on click
    - Remove links with immediate display update
    - Persist all changes to LocalStorage immediately
    - Use textContent for rendering link names (XSS prevention)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 10.1, 10.2, 10.4_

  - [x] 7.2 Write property tests for Quick Links Module
    - **Property 12: URL validation rejects non-http protocols** - Strings not starting with http:// or https:// are rejected
    - **Property 13: Empty link name is rejected** - Whitespace-only strings rejected as link names
    - **Property 14: Link removal decreases count** - Removing a link reduces list length by exactly one
    - **Validates: Requirements 5.3, 5.4, 5.6, 10.2**

- [x] 8. FASE 5.5: Theme Module
  - [x] 8.1 Implement Theme Module with system preference detection
    - Create Theme object with `init()`, `toggle()`, `get()` methods
    - On first load: detect system color scheme via prefers-color-scheme media query
    - If system preference undetectable: default to "light" mode
    - Toggle between light/dark by updating data-theme attribute on document root
    - Persist theme preference to LocalStorage immediately on change
    - On load with stored preference: apply stored theme
    - If stored value is not "light" or "dark": treat as invalid, fall back to system preference
    - Maintain consistency between displayed theme and stored preference
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [x] 8.2 Write property tests for Theme Module
    - **Property 15: Theme toggle round-trip** - Toggling twice returns to original state, stored preference matches displayed theme
    - **Validates: Requirements 6.2, 6.3, 6.5**

- [x] 9. Checkpoint - Verify timer, quick links, and theme functionality
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. FASE 6: Polish UI - Animations, Hover Effects, and Transitions
  - [x] 10.1 Implement entrance animations and interaction effects
    - Initialize AOS with duration 800ms, ease-out-cubic easing, once: true
    - Add AOS data attributes to card elements for scroll-triggered reveals
    - Implement GSAP entrance animations for typography and hero elements
    - Ensure animations play only once and do not block user interaction
    - Add CSS transitions for hover states on buttons, cards, and links
    - Add smooth transitions for theme switching (within single animation frame, 16ms)
    - Use transform and opacity for GPU-composited animations (minimal reflows)
    - _Requirements: 8.3, 8.4_

  - [x] 10.2 Implement app initialization and wiring
    - Create `initializeApp()` function that initializes all modules in correct order
    - Wire DOMContentLoaded event to initializeApp
    - Bind theme toggle button to Theme.toggle()
    - Bind name input change to update greeting and persist
    - Bind todo form submission, sort selector, and action buttons
    - Bind timer controls (start, stop, reset, duration selection)
    - Bind quick links form and remove buttons
    - Use event delegation on todo container for performance
    - _Requirements: 1.1, 2.7, 3.1, 4.1, 5.1, 6.3_

- [x] 11. Final Checkpoint - Ensure all features work together
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation between phases
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All external libraries (GSAP, AOS, Font Awesome, Mona Sans) are loaded via CDN - no npm required
- Use fast-check library for property-based testing as specified in the design
- All user input must be rendered with textContent (never innerHTML) for XSS prevention

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["1.4", "3.1", "3.2"] },
    { "id": 3, "tasks": ["3.3", "4.1"] },
    { "id": 4, "tasks": ["4.2", "4.3"] },
    { "id": 5, "tasks": ["4.4", "6.1"] },
    { "id": 6, "tasks": ["6.2", "7.1"] },
    { "id": 7, "tasks": ["7.2", "8.1"] },
    { "id": 8, "tasks": ["8.2", "10.1"] },
    { "id": 9, "tasks": ["10.2"] }
  ]
}
```
