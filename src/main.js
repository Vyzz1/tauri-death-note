const book = document.getElementById("book");
const cover = document.getElementById("cover");
const closeTab = document.getElementById("closeTab");
const ruled = document.getElementById("ruled");
const dragHandle = document.getElementById("dragHandle");

const CLOSED_ANGLE = 0;
const OPEN_ANGLE = -155;
const CLOSE_DRAG_THRESHOLD = 0.35;

const STORAGE_KEY = "deathnote-content";

function loadContent() {
  ruled.value = localStorage.getItem(STORAGE_KEY) ?? "";
}

let saveTimer = null;
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    localStorage.setItem(STORAGE_KEY, ruled.value);
  }, 250);
}

function isOpen() {
  return book.classList.contains("open");
}

function onCoverTransitionEnd(event) {
  if (event.target !== cover || event.propertyName !== "transform") return;
  if (isOpen()) {
    ruled.focus();
  } else {
    ruled.blur();
  }
}
cover.addEventListener("transitionend", onCoverTransitionEnd);

function openBook() {
  if (isOpen()) return;
  book.classList.add("open");
}

function closeBook() {
  if (!isOpen()) return;
  book.classList.remove("open");
}

function toggleBook() {
  if (isOpen()) {
    closeBook();
  } else {
    openBook();
  }
}

cover.addEventListener("click", openBook);
cover.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    openBook();
  }
});

closeTab.addEventListener("click", closeBook);

let dragging = false;
let dragStartX = 0;
let dragSpan = 1;

function settleDrag(ratio) {
  if (ratio > CLOSE_DRAG_THRESHOLD) {
    book.classList.remove("open");
  } else {
    book.classList.add("open");
  }
  cover.style.transition = "";
  void cover.offsetWidth;
  cover.style.transform = "";
}

function onDragStart(event) {
  if (!isOpen()) return;
  dragging = true;
  dragStartX = event.clientX;
  dragSpan = Math.max(book.getBoundingClientRect().width * 0.65, 1);
  cover.style.transition = "none";
  dragHandle.setPointerCapture(event.pointerId);
}

function onDragMove(event) {
  if (!dragging) return;
  const draggedLeft = dragStartX - event.clientX;
  const ratio = Math.min(Math.max(draggedLeft / dragSpan, 0), 1);
  cover.style.transform = `rotateY(${OPEN_ANGLE + (CLOSED_ANGLE - OPEN_ANGLE) * ratio}deg)`;
}

function onDragEnd(event) {
  if (!dragging) return;
  dragging = false;
  const draggedLeft = dragStartX - event.clientX;
  const ratio = Math.min(Math.max(draggedLeft / dragSpan, 0), 1);
  settleDrag(ratio);
}

dragHandle.addEventListener("pointerdown", onDragStart);
dragHandle.addEventListener("pointermove", onDragMove);
dragHandle.addEventListener("pointerup", onDragEnd);
dragHandle.addEventListener("pointercancel", onDragEnd);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeBook();
    return;
  }
  const typingInRuled = document.activeElement === ruled;
  if (!isOpen() && !typingInRuled && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    openBook();
  }
});

ruled.addEventListener("input", scheduleSave);

window.addEventListener("focus", () => {
  if (isOpen()) ruled.focus();
});

loadContent();
