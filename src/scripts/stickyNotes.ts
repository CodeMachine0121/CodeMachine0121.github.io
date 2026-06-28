// Sticky notes for article pages — triple-click a side margin to add a note,
// edit inline, drag to move, delete; persisted per-article in localStorage.
// Visuals live in blog.css (.sticky-note*) and follow the hand-drawn system.

const COLORS = ['yellow', 'pink', 'blue', 'green'] as const;
type Color = (typeof COLORS)[number];

interface Note {
  id: string;
  text: string;
  color: Color;
  x: number;
  y: number;
}

const DESKTOP_MIN = 768;
const STORAGE_PREFIX = 'sticky-notes:';
const TRASH_THRESHOLD = 90;

let notes: Note[] = [];
let root: HTMLElement | null = null;
let trashEl: HTMLElement | null = null;
let fabEl: HTMLElement | null = null;
let panelEl: HTMLElement | null = null;
let panelListEl: HTMLElement | null = null;
let drag: { note: Note; el: HTMLElement; dx: number; dy: number } | null = null;
let armed = false;

function uid(): string {
  return 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function storageKey(): string {
  return STORAGE_PREFIX + window.location.pathname;
}

function save(): void {
  try {
    window.localStorage.setItem(storageKey(), JSON.stringify(notes));
  } catch {
    // Storage unavailable (private mode / quota) — keep working in-session.
  }
}

function isNote(v: unknown): v is Note {
  const n = v as Note;
  return (
    !!n &&
    typeof n.id === 'string' &&
    typeof n.text === 'string' &&
    (COLORS as readonly string[]).includes(n.color) &&
    typeof n.x === 'number' &&
    typeof n.y === 'number'
  );
}

function load(): void {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(storageKey());
  } catch {
    return;
  }
  if (!raw) return;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    notes = parsed.filter(isNote);
  } catch {
    return;
  }
  if (!root) return;
  for (const note of notes) root.appendChild(renderNote(note));
}

function renderNote(note: Note): HTMLElement {
  const el = document.createElement('div');
  el.className = 'sticky-note';
  el.dataset.noteId = note.id;
  el.dataset.color = note.color;
  el.style.left = note.x + 'px';
  el.style.top = note.y + 'px';

  const bar = document.createElement('div');
  bar.className = 'sticky-note__bar';
  bar.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    drag = { note, el, dx: e.clientX - note.x, dy: e.clientY - note.y };
    el.classList.add('is-dragging');
  });

  const color = document.createElement('button');
  color.className = 'sticky-note__color';
  color.type = 'button';
  color.setAttribute('aria-label', '切換便利貼顏色');
  color.addEventListener('click', () => {
    const next = (COLORS.indexOf(note.color) + 1) % COLORS.length;
    note.color = COLORS[next];
    el.dataset.color = note.color;
    save();
  });

  const del = document.createElement('button');
  del.className = 'sticky-note__delete';
  del.type = 'button';
  del.setAttribute('aria-label', '刪除便利貼');
  del.textContent = '×';
  del.addEventListener('click', () => removeNote(note));

  bar.append(color, del);

  const text = document.createElement('div');
  text.className = 'sticky-note__text';
  text.setAttribute('contenteditable', 'true');
  text.setAttribute('role', 'textbox');
  text.textContent = note.text;
  text.addEventListener('blur', () => {
    note.text = text.textContent ?? '';
    save();
  });

  el.append(bar, text);
  return el;
}

function removeNote(note: Note): void {
  notes = notes.filter((n) => n.id !== note.id);
  root?.querySelector(`[data-note-id="${note.id}"]`)?.remove();
  save();
}

function addNote(x: number, y: number): void {
  if (!root) return;
  const note: Note = { id: uid(), text: '', color: 'yellow', x, y };
  notes.push(note);
  const el = renderNote(note);
  root.appendChild(el);
  save();
  el.querySelector<HTMLElement>('.sticky-note__text')?.focus();
}

function addNoteFromPanel(): void {
  // Cascade panel-added notes near the top-left so they stay on-screen.
  const step = notes.length % 6;
  addNote(20 + step * 12, 100 + step * 12);
  renderPanelList();
}

function onPointerMove(e: PointerEvent): void {
  if (!drag) return;
  drag.note.x = e.clientX - drag.dx;
  drag.note.y = e.clientY - drag.dy;
  drag.el.style.left = drag.note.x + 'px';
  drag.el.style.top = drag.note.y + 'px';

  armed = e.clientY < TRASH_THRESHOLD;
  trashEl?.classList.toggle('is-active', armed);
  trashEl?.classList.toggle('is-armed', armed);
}

function onPointerUp(): void {
  if (!drag) return;
  const note = drag.note;
  drag.el.classList.remove('is-dragging');
  drag = null;
  const wasArmed = armed;
  armed = false;
  trashEl?.classList.remove('is-active', 'is-armed');
  if (wasArmed) {
    removeNote(note);
  } else {
    save();
  }
}

function renderPanelList(): void {
  if (!panelListEl) return;
  panelListEl.textContent = '';
  if (notes.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'sticky-notes-panel__empty';
    empty.textContent = '還沒有便利貼';
    panelListEl.appendChild(empty);
    return;
  }
  for (const note of notes) {
    const li = document.createElement('li');
    li.className = 'sticky-notes-panel__item';
    li.dataset.noteId = note.id;

    const label = document.createElement('span');
    label.className = 'sticky-notes-panel__text';
    label.textContent = note.text.trim() || '（空白便利貼）';

    const del = document.createElement('button');
    del.className = 'sticky-notes-panel__item-delete';
    del.type = 'button';
    del.setAttribute('aria-label', '刪除便利貼');
    del.textContent = '×';

    li.append(label, del);
    panelListEl.appendChild(li);
  }
}

function setPanelOpen(open: boolean): void {
  if (!panelEl) return;
  panelEl.classList.toggle('is-open', open);
  panelEl.setAttribute('aria-hidden', String(!open));
  fabEl?.setAttribute('aria-expanded', String(open));
  if (open) renderPanelList();
}

function onTripleClick(e: MouseEvent): void {
  if (e.detail !== 3) return;
  if (window.innerWidth < DESKTOP_MIN) return;

  const target = e.target as HTMLElement | null;
  if (target?.closest('.sticky-note, #sticky-notes-root, header, footer, a, button')) return;

  const article = document.querySelector('article');
  if (!article) return;
  const rect = article.getBoundingClientRect();
  const inSideMargin = e.clientX < rect.left || e.clientX > rect.right;
  if (!inSideMargin) return;

  addNote(e.clientX, e.clientY);
}

export function initStickyNotes(): void {
  root = document.getElementById('sticky-notes-root');
  if (!root) return;
  trashEl = document.getElementById('sticky-notes-trash');
  fabEl = document.getElementById('sticky-notes-fab');
  panelEl = document.getElementById('sticky-notes-panel');
  panelListEl = document.getElementById('sticky-notes-panel-list');
  load();
  document.addEventListener('click', onTripleClick);
  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);

  fabEl?.addEventListener('click', () => setPanelOpen(!panelEl?.classList.contains('is-open')));
  document.getElementById('sticky-notes-panel-close')?.addEventListener('click', () => setPanelOpen(false));
  document.getElementById('sticky-notes-add')?.addEventListener('click', addNoteFromPanel);
}
