/**
 * Personal Dashboard
 * Vanilla JS — Modular Architecture
 * 
 * Modules: Storage, Clock, Todo, FocusTimer, Theme, Animations
 * Quick Links are permanent (hardcoded in HTML).
 */

'use strict';

// ===========================
// Storage Module
// ===========================

const Storage = (() => {
  const PREFIX = 'dashboard_';
  let memoryFallback = {};
  let useMemory = false;

  function isAvailable() {
    try {
      const key = PREFIX + '__test__';
      localStorage.setItem(key, '1');
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  }

  if (!isAvailable()) {
    useMemory = true;
    console.warn('[Dashboard] LocalStorage unavailable — using in-memory fallback.');
  }

  function get(key, defaultValue = null) {
    const nsKey = PREFIX + key;

    if (useMemory) {
      return nsKey in memoryFallback ? memoryFallback[nsKey] : defaultValue;
    }

    try {
      const raw = localStorage.getItem(nsKey);
      if (raw === null) return defaultValue;
      return JSON.parse(raw);
    } catch (e) {
      console.warn(`[Storage] Corrupted data for "${key}". Returning default.`, e);
      return defaultValue;
    }
  }

  function set(key, value) {
    const nsKey = PREFIX + key;

    if (useMemory) {
      memoryFallback[nsKey] = value;
      return;
    }

    try {
      localStorage.setItem(nsKey, JSON.stringify(value));
    } catch (e) {
      console.warn(`[Storage] Write failed for "${key}". Switching to memory.`, e);
      useMemory = true;
      memoryFallback[nsKey] = value;
    }
  }

  function remove(key) {
    const nsKey = PREFIX + key;
    if (useMemory) {
      delete memoryFallback[nsKey];
      return;
    }
    try {
      localStorage.removeItem(nsKey);
    } catch (e) {
      console.warn(`[Storage] Remove failed for "${key}".`, e);
    }
  }

  return { get, set, remove };
})();


// ===========================
// Clock Module
// ===========================

const Clock = (() => {
  let intervalId = null;
  let clockEl = null;
  let dateEl = null;
  let greetingEl = null;
  let nameInputEl = null;
  let currentName = 'Friend';

  function formatTime(date) {
    return [date.getHours(), date.getMinutes(), date.getSeconds()]
      .map(n => String(n).padStart(2, '0'))
      .join(':');
  }

  function formatDate(date) {
    return date.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  function getGreeting(hour) {
    if (hour >= 5 && hour < 12) return 'Good Morning';
    if (hour >= 12 && hour < 18) return 'Good Afternoon';
    if (hour >= 18 && hour < 22) return 'Good Evening';
    return 'Good Night';
  }

  function getDisplayName(name) {
    if (!name || !name.trim()) return 'Friend';
    const trimmed = name.trim();
    return trimmed.length > 30 ? trimmed.substring(0, 30) : trimmed;
  }

  function updateGreeting(now) {
    if (!greetingEl) return;
    const greeting = getGreeting(now.getHours());
    greetingEl.textContent = `${greeting}, ${getDisplayName(currentName)}`;
  }

  function handleNameInput(e) {
    currentName = e.target.value;
    Storage.set('username', currentName);
    updateGreeting(new Date());
  }

  function update() {
    const now = new Date();
    if (clockEl) clockEl.textContent = formatTime(now);
    if (dateEl) dateEl.textContent = formatDate(now);
    updateGreeting(now);
  }

  function handleVisibility() {
    if (!document.hidden) update();
  }

  function init() {
    clockEl = document.getElementById('clock-display');
    dateEl = document.getElementById('date-display');
    greetingEl = document.getElementById('greeting-display');
    nameInputEl = document.getElementById('name-input');

    currentName = Storage.get('username', '');

    if (nameInputEl && currentName) {
      nameInputEl.value = currentName;
    }

    if (nameInputEl) {
      nameInputEl.addEventListener('input', handleNameInput);
    }

    update();
    intervalId = setInterval(update, 1000);
    document.addEventListener('visibilitychange', handleVisibility);
  }

  function destroy() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    document.removeEventListener('visibilitychange', handleVisibility);
  }

  return { init, destroy, getGreeting, formatTime, formatDate };
})();


// ===========================
// Todo Module
// ===========================

const Todo = (() => {
  let todos = [];
  let listEl = null;
  let formEl = null;
  let inputEl = null;
  let errorEl = null;
  let sortSelectEl = null;
  let currentSort = 'date';

  function generateId() {
    if (crypto?.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 11);
  }

  function isDuplicate(text, excludeId) {
    const normalized = text.toLowerCase();
    return todos.some(t => {
      if (excludeId && t.id === excludeId) return false;
      return t.text.toLowerCase() === normalized;
    });
  }

  function showError(msg) {
    if (!errorEl) return;
    errorEl.textContent = msg;
    errorEl.hidden = false;
  }

  function clearError() {
    if (!errorEl) return;
    errorEl.textContent = '';
    errorEl.hidden = true;
  }

  function showToast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    el.classList.add('toast--visible');
    setTimeout(() => {
      el.classList.remove('toast--visible');
      el.hidden = true;
    }, 3000);
  }

  function persist() {
    Storage.set('todos', todos);
  }

  function sortTodos(arr, criteria) {
    const sorted = [...arr];
    switch (criteria) {
      case 'date':
        sorted.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case 'alpha':
        sorted.sort((a, b) => a.text.toLowerCase().localeCompare(b.text.toLowerCase()));
        break;
      case 'status':
        sorted.sort((a, b) => {
          if (a.completed === b.completed) return 0;
          return a.completed ? 1 : -1;
        });
        break;
    }
    return sorted;
  }

  function render() {
    if (!listEl) return;

    const sorted = sortTodos(todos, currentSort);

    // Clear list
    while (listEl.firstChild) listEl.removeChild(listEl.firstChild);

    if (sorted.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'todo-empty';
      empty.textContent = 'No tasks yet. Add one above!';
      listEl.appendChild(empty);
      return;
    }

    const fragment = document.createDocumentFragment();

    sorted.forEach(todo => {
      const li = document.createElement('li');
      li.className = 'todo-item' + (todo.completed ? ' todo-item--completed' : '');
      li.dataset.id = todo.id;

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'todo-checkbox';
      checkbox.checked = todo.completed;
      checkbox.setAttribute('aria-label', `Mark "${todo.text}" as ${todo.completed ? 'incomplete' : 'complete'}`);

      const textSpan = document.createElement('span');
      textSpan.className = 'todo-text';
      textSpan.textContent = todo.text;

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn--danger todo-delete';
      deleteBtn.setAttribute('aria-label', `Delete "${todo.text}"`);
      const trashIcon = document.createElement('i');
      trashIcon.className = 'fa-solid fa-trash';
      deleteBtn.appendChild(trashIcon);

      const editBtn = document.createElement('button');
      editBtn.className = 'btn btn--edit todo-edit';
      editBtn.setAttribute('aria-label', `Edit "${todo.text}"`);
      const editIcon = document.createElement('i');
      editIcon.className = 'fa-solid fa-pen';
      editBtn.appendChild(editIcon);

      li.appendChild(checkbox);
      li.appendChild(textSpan);
      li.appendChild(editBtn);
      li.appendChild(deleteBtn);
      fragment.appendChild(li);
    });

    listEl.appendChild(fragment);
  }

  function add(text) {
    clearError();

    if (typeof text !== 'string') {
      showError('Task must be text.');
      return { success: false, error: 'INVALID_TYPE' };
    }

    const trimmed = text.trim();

    if (!trimmed) {
      showError('Task cannot be empty.');
      return { success: false, error: 'EMPTY_TEXT' };
    }

    if (trimmed.length > 200) {
      showError('Task must be 200 characters or less.');
      return { success: false, error: 'TOO_LONG' };
    }

    if (isDuplicate(trimmed)) {
      showToast('This task already exists.');
      return { success: false, error: 'DUPLICATE' };
    }

    const newTodo = {
      id: generateId(),
      text: trimmed,
      completed: false,
      createdAt: Date.now()
    };

    todos.push(newTodo);
    persist();
    render();
    return { success: true, todo: newTodo };
  }

  function toggle(id) {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;
    todo.completed = !todo.completed;
    persist();
    render();
  }

  function deleteTodo(id) {
    const idx = todos.findIndex(t => t.id === id);
    if (idx === -1) return;
    todos.splice(idx, 1);
    persist();
    render();
  }

  function edit(id, newText) {
    if (typeof newText !== 'string') return { success: false, error: 'INVALID_TYPE' };

    const trimmed = newText.trim();
    if (!trimmed) return { success: false, error: 'EMPTY_TEXT' };
    if (trimmed.length > 200) return { success: false, error: 'TOO_LONG' };
    if (isDuplicate(trimmed, id)) return { success: false, error: 'DUPLICATE' };

    const todo = todos.find(t => t.id === id);
    if (!todo) return { success: false, error: 'NOT_FOUND' };

    todo.text = trimmed;
    persist();
    render();
    return { success: true };
  }

  function sort(criteria) {
    if (!['date', 'alpha', 'status'].includes(criteria)) return;
    currentSort = criteria;
    if (sortSelectEl) sortSelectEl.value = criteria;
    render();
  }

  function getAll() {
    return [...todos];
  }

  // Event handlers
  function handleSubmit(e) {
    e.preventDefault();
    if (!inputEl) return;
    const result = add(inputEl.value);
    if (result.success) inputEl.value = '';
  }

  function handleListClick(e) {
    const target = e.target;

    if (target.classList.contains('todo-checkbox')) {
      const li = target.closest('.todo-item');
      if (li) toggle(li.dataset.id);
      return;
    }

    if (target.classList.contains('todo-delete') || target.closest('.todo-delete')) {
      const li = target.closest('.todo-item');
      if (li) deleteTodo(li.dataset.id);
      return;
    }

    if (target.classList.contains('todo-edit') || target.closest('.todo-edit')) {
      const li = target.closest('.todo-item');
      if (li) startEdit(li);
    }
  }

  function startEdit(li) {
    if (!li || li.querySelector('.todo-edit-input')) return;

    const id = li.dataset.id;
    const todo = todos.find(t => t.id === id);
    if (!todo) return;

    const textSpan = li.querySelector('.todo-text');
    if (!textSpan) return;

    const editInput = document.createElement('input');
    editInput.type = 'text';
    editInput.className = 'todo-edit-input';
    editInput.value = todo.text;
    editInput.maxLength = 200;

    textSpan.style.display = 'none';
    li.insertBefore(editInput, textSpan.nextSibling);
    editInput.focus();
    editInput.select();

    let committed = false;

    function commit() {
      if (committed) return;
      committed = true;
      const result = edit(id, editInput.value);
      if (!result.success) {
        const msgs = { EMPTY_TEXT: 'Task cannot be empty.', TOO_LONG: 'Too long.', DUPLICATE: 'Already exists.' };
        showToast(msgs[result.error] || 'Edit failed.');
        cancel();
      }
    }

    function cancel() {
      if (editInput.parentNode) editInput.remove();
      textSpan.style.display = '';
    }

    editInput.addEventListener('blur', commit);
    editInput.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') { ev.preventDefault(); commit(); }
      if (ev.key === 'Escape') { ev.preventDefault(); committed = true; cancel(); }
    });
  }

  function handleDblClick(e) {
    if (!e.target.classList.contains('todo-text')) return;
    const li = e.target.closest('.todo-item');
    startEdit(li);
  }

  function init() {
    listEl = document.getElementById('todo-list');
    formEl = document.getElementById('todo-form');
    inputEl = document.getElementById('todo-input');
    errorEl = document.getElementById('todo-error');
    sortSelectEl = document.getElementById('sort-select');

    todos = Storage.get('todos', []);
    if (!Array.isArray(todos)) todos = [];

    if (formEl) formEl.addEventListener('submit', handleSubmit);
    if (listEl) {
      listEl.addEventListener('click', handleListClick);
      listEl.addEventListener('dblclick', handleDblClick);
    }
    if (sortSelectEl) sortSelectEl.addEventListener('change', e => { currentSort = e.target.value; render(); });

    render();
  }

  return { init, add, getAll, render, toggle, delete: deleteTodo, edit, sort };
})();


// ===========================
// Focus Timer Module
// ===========================

const FocusTimer = (() => {
  const PRESETS = [1, 5, 10, 15, 20, 25, 30, 45, 60];

  let duration = 25 * 60;
  let remaining = 25 * 60;
  let running = false;
  let intervalId = null;

  let containerEl, timeDisplayEl, startBtn, stopBtn, resetBtn, notificationEl, dismissBtn, presetButtons;

  function formatTimerDisplay(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function updateDisplay() {
    if (timeDisplayEl) timeDisplayEl.textContent = formatTimerDisplay(remaining);
  }

  function updateControls() {
    if (startBtn) {
      startBtn.disabled = running;
      startBtn.classList.toggle('btn--disabled', running);
    }
  }

  function showNotification() {
    if (notificationEl) notificationEl.hidden = false;
  }

  function hideNotification() {
    if (notificationEl) notificationEl.hidden = true;
  }

  function tick() {
    if (remaining <= 0) return;
    remaining--;
    updateDisplay();
    if (remaining <= 0) {
      stop();
      showNotification();
    }
  }

  function setDuration(minutes) {
    if (minutes < 1 || minutes > 120) return;
    if (running) { clearInterval(intervalId); intervalId = null; running = false; }

    duration = minutes * 60;
    remaining = duration;
    hideNotification();
    updateDisplay();
    updateControls();
    updatePresetHighlight(minutes);
  }

  function updatePresetHighlight(activeMinutes) {
    if (!presetButtons) return;
    presetButtons.forEach(btn => {
      const d = parseInt(btn.dataset.duration, 10);
      btn.classList.toggle('active', d === activeMinutes);
    });
  }

  function start() {
    if (running || remaining <= 0) return;
    running = true;
    hideNotification();
    updateControls();
    intervalId = setInterval(tick, 1000);
  }

  function stop() {
    if (intervalId) { clearInterval(intervalId); intervalId = null; }
    running = false;
    updateControls();
  }

  function reset() {
    stop();
    remaining = duration;
    hideNotification();
    updateDisplay();
    updateControls();
  }

  function getState() {
    return { running, remaining, duration };
  }

  function init(container) {
    containerEl = container;
    if (!containerEl) return;

    timeDisplayEl = document.getElementById('timer-time');
    startBtn = document.getElementById('timer-start');
    stopBtn = document.getElementById('timer-stop');
    resetBtn = document.getElementById('timer-reset');
    notificationEl = document.getElementById('timer-notification');
    dismissBtn = document.getElementById('timer-dismiss');
    presetButtons = containerEl.querySelectorAll('.btn--preset');

    if (startBtn) startBtn.addEventListener('click', start);
    if (stopBtn) stopBtn.addEventListener('click', stop);
    if (resetBtn) resetBtn.addEventListener('click', reset);
    if (dismissBtn) dismissBtn.addEventListener('click', hideNotification);

    const presetsContainer = containerEl.querySelector('.timer-presets');
    if (presetsContainer) {
      presetsContainer.addEventListener('click', e => {
        const btn = e.target.closest('.btn--preset');
        if (!btn) return;
        const mins = parseInt(btn.dataset.duration, 10);
        if (!isNaN(mins)) setDuration(mins);
      });
    }

    // Custom duration input
    const customInput = document.getElementById('timer-custom-input');
    const customSetBtn = document.getElementById('timer-custom-set');
    if (customInput && customSetBtn) {
      customSetBtn.addEventListener('click', () => {
        const mins = parseInt(customInput.value, 10);
        if (!isNaN(mins) && mins >= 1 && mins <= 120) {
          setDuration(mins);
          customInput.value = '';
        }
      });
      customInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const mins = parseInt(customInput.value, 10);
          if (!isNaN(mins) && mins >= 1 && mins <= 120) {
            setDuration(mins);
            customInput.value = '';
          }
        }
      });
    }

    updateDisplay();
    updateControls();
  }

  return { init, setDuration, start, stop, reset, getState, formatTimerDisplay };
})();


// ===========================
// Theme Module
// ===========================

const Theme = (() => {
  const KEY = 'theme';
  const VALID = ['light', 'dark'];

  function getSystemPref() {
    try {
      if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
    } catch {}
    return 'light';
  }

  function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    // Update icon
    const icon = document.getElementById('theme-icon');
    if (icon) {
      icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }
  }

  function get() {
    return document.documentElement.getAttribute('data-theme') || 'light';
  }

  function toggle() {
    const next = get() === 'dark' ? 'light' : 'dark';
    apply(next);
    Storage.set(KEY, next);
  }

  function init() {
    const stored = Storage.get(KEY, null);
    let theme;

    if (stored && VALID.includes(stored)) {
      theme = stored;
    } else {
      theme = getSystemPref();
      Storage.set(KEY, theme);
    }

    apply(theme);

    const btn = document.getElementById('theme-toggle');
    if (btn) btn.addEventListener('click', toggle);
  }

  return { init, toggle, get };
})();


// ===========================
// Quick Links Module
// ===========================

const QuickLinks = (() => {
  const DEFAULT_LINKS = [
    { id: 'gmail', name: 'Gmail', url: 'mailto:dimasnirwan@gmail.com', icon: 'fa-solid fa-envelope' },
    { id: 'github', name: 'GitHub', url: 'https://github.com/dimasnirwan', icon: 'fa-brands fa-github' }
  ];

  let links = [];
  let gridEl = null;

  function persist() {
    Storage.set('links', links);
  }

  function render() {
    if (!gridEl) return;
    while (gridEl.firstChild) gridEl.removeChild(gridEl.firstChild);

    const fragment = document.createDocumentFragment();
    links.forEach(link => {
      const a = document.createElement('a');
      a.className = 'link-button';
      a.href = link.url;
      if (!link.url.startsWith('mailto:')) {
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      }
      a.setAttribute('aria-label', `Open ${link.name}`);

      const icon = document.createElement('i');
      link.icon.split(' ').forEach(cls => { if (cls.trim()) icon.classList.add(cls.trim()); });
      a.appendChild(icon);

      const name = document.createElement('span');
      name.className = 'link-name';
      name.textContent = link.name;
      a.appendChild(name);

      fragment.appendChild(a);
    });
    gridEl.appendChild(fragment);
  }

  function init() {
    gridEl = document.getElementById('links-grid');
    const stored = Storage.get('links', null);

    if (stored && Array.isArray(stored) && stored.length > 0) {
      links = stored;
    } else {
      links = DEFAULT_LINKS.slice();
      persist();
    }

    render();
  }

  function getAll() { return [...links]; }

  function isValidUrl(url) {
    if (typeof url !== 'string') return false;
    return /^(https?:\/\/|mailto:)/i.test(url.trim());
  }

  function add(name, url, icon) {
    if (!name || !name.trim()) return { success: false, error: 'EMPTY_NAME' };
    if (!isValidUrl(url)) return { success: false, error: 'INVALID_URL' };

    const trimmedName = name.trim();
    if (trimmedName.length > 50) return { success: false, error: 'NAME_TOO_LONG' };
    if (links.length >= 20) return { success: false, error: 'MAX_LINKS' };

    const newLink = {
      id: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
      name: trimmedName,
      url: url.trim(),
      icon: (icon && icon.trim()) || 'fa-solid fa-link'
    };

    links.push(newLink);
    persist();
    render();
    return { success: true, link: newLink };
  }

  function remove(id) {
    const idx = links.findIndex(l => l.id === id);
    if (idx === -1) return { success: false, error: 'NOT_FOUND' };
    links.splice(idx, 1);
    persist();
    render();
    return { success: true };
  }

  function reset() {
    links = [];
  }

  return { init, getAll, add, remove, isValidUrl, reset };
})();


// ===========================
// Animations Module
// ===========================

const Animations = (() => {
  function initAOS() {
    if (typeof AOS === 'undefined') return;
    AOS.init({
      duration: 800,
      easing: 'ease-out-cubic',
      once: true,
      offset: 50
    });
  }

  function initGSAP() {
    if (typeof gsap === 'undefined') return;

    const tl = gsap.timeline({ defaults: { ease: 'power4.out' } });

    // Header elements — staggered entrance
    tl.from('.clock-display', { opacity: 0, scale: 0.7, y: -40, duration: 1.2, clearProps: 'all' }, 0.1)
      .from('.date-display', { opacity: 0, y: -20, duration: 0.8, clearProps: 'all' }, 0.4)
      .from('.greeting-display', { opacity: 0, y: 30, scale: 0.9, duration: 1, clearProps: 'all' }, 0.6)
      .from('.name-input-wrapper', { opacity: 0, y: 15, duration: 0.7, clearProps: 'all' }, 0.9)
      .from('.theme-toggle', { opacity: 0, scale: 0, rotation: -360, duration: 0.8, ease: 'back.out(2)', clearProps: 'all' }, 0.3);

    // Cards — dramatic entrance
    tl.from('.card--todo', { opacity: 0, y: 60, scale: 0.92, duration: 1, clearProps: 'all' }, 0.8)
      .from('.card--timer', { opacity: 0, y: 60, scale: 0.92, duration: 1, clearProps: 'all' }, 1.0)
      .from('.card--links', { opacity: 0, y: 40, scale: 0.95, duration: 0.8, clearProps: 'all' }, 1.2);

    // Card internals — staggered
    tl.from('.card__title', { opacity: 0, x: -25, duration: 0.6, stagger: 0.15, clearProps: 'all' }, 1.2)
      .from('.todo-form', { opacity: 0, y: 20, duration: 0.6, clearProps: 'all' }, 1.4)
      .from('.sort-select', { opacity: 0, scale: 0.8, duration: 0.5, clearProps: 'all' }, 1.4);

    // Timer elements
    tl.from('.timer-time', { opacity: 0, scale: 0.3, duration: 1, ease: 'elastic.out(1, 0.5)', clearProps: 'all' }, 1.3)
      .from('.timer-label', { opacity: 0, y: 10, duration: 0.5, clearProps: 'all' }, 1.6)
      .from('.btn--preset', { opacity: 0, y: 12, scale: 0.7, duration: 0.4, stagger: 0.04, ease: 'back.out(2)', clearProps: 'all' }, 1.5)
      .from('.timer-custom', { opacity: 0, y: 10, duration: 0.5, clearProps: 'all' }, 1.8)
      .from('.timer-controls .btn', { opacity: 0, scale: 0, duration: 0.5, stagger: 0.1, ease: 'back.out(2.5)', clearProps: 'all' }, 1.9);

    // Quick links
    tl.from('.link-button', { opacity: 0, y: 20, scale: 0.85, duration: 0.6, stagger: 0.12, ease: 'back.out(1.5)', clearProps: 'all' }, 1.5);

    // Interactive hover animations on cards
    document.querySelectorAll('.card').forEach(card => {
      card.addEventListener('mouseenter', () => {
        gsap.to(card, { scale: 1.02, duration: 0.3, ease: 'power2.out' });
      });
      card.addEventListener('mouseleave', () => {
        gsap.to(card, { scale: 1, duration: 0.3, ease: 'power2.out' });
      });
    });

    // Hover animation on link buttons
    document.querySelectorAll('.link-button').forEach(btn => {
      btn.addEventListener('mouseenter', () => {
        gsap.to(btn, { y: -4, scale: 1.05, duration: 0.25, ease: 'power2.out' });
        gsap.to(btn.querySelector('i'), { scale: 1.2, rotation: 5, duration: 0.3, ease: 'power2.out' });
      });
      btn.addEventListener('mouseleave', () => {
        gsap.to(btn, { y: 0, scale: 1, duration: 0.25, ease: 'power2.out' });
        gsap.to(btn.querySelector('i'), { scale: 1, rotation: 0, duration: 0.3, ease: 'power2.out' });
      });
    });

    // Hover on theme toggle
    const themeBtn = document.querySelector('.theme-toggle');
    if (themeBtn) {
      themeBtn.addEventListener('mouseenter', () => {
        gsap.to(themeBtn, { scale: 1.15, rotation: 20, duration: 0.3, ease: 'back.out(2)' });
      });
      themeBtn.addEventListener('mouseleave', () => {
        gsap.to(themeBtn, { scale: 1, rotation: 0, duration: 0.3, ease: 'power2.out' });
      });
    }
  }

  function init() {
    initAOS();
    initGSAP();
  }

  return { init };
})();


// ===========================
// App Initialization
// ===========================

document.addEventListener('DOMContentLoaded', () => {
  // Theme first to prevent flash
  Theme.init();

  // Clock & greeting
  Clock.init();

  // Todo
  Todo.init();

  // Focus Timer
  FocusTimer.init(document.getElementById('timer-container'));

  // Quick Links (saved in LocalStorage)
  QuickLinks.init();

  // Animations last
  Animations.init();
});
