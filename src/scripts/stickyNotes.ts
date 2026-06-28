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

let notes: Note[] = [];
let root: HTMLElement | null = null;

function uid(): string {
  return 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
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

  const color = document.createElement('button');
  color.className = 'sticky-note__color';
  color.type = 'button';
  color.setAttribute('aria-label', '切換便利貼顏色');

  const del = document.createElement('button');
  del.className = 'sticky-note__delete';
  del.type = 'button';
  del.setAttribute('aria-label', '刪除便利貼');
  del.textContent = '×';

  bar.append(color, del);

  const text = document.createElement('div');
  text.className = 'sticky-note__text';
  text.setAttribute('contenteditable', 'true');
  text.setAttribute('role', 'textbox');
  text.textContent = note.text;

  el.append(bar, text);
  return el;
}

function addNote(x: number, y: number): void {
  if (!root) return;
  const note: Note = { id: uid(), text: '', color: 'yellow', x, y };
  notes.push(note);
  const el = renderNote(note);
  root.appendChild(el);
  el.querySelector<HTMLElement>('.sticky-note__text')?.focus();
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
  document.addEventListener('click', onTripleClick);
}
