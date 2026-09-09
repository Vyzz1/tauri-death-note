const book = document.getElementById("book");
const cover = document.getElementById("cover");
const closeTab = document.getElementById("closeTab");
const ruled = document.getElementById("ruled");
const page = document.querySelector(".page");
const pageShadow = document.querySelector(".page-shadow");

const CLOSED_ANGLE = 0;
const OPEN_ANGLE = -172;
const CLOSE_DRAG_THRESHOLD = 0.35;
const SWIPE_COMMIT_PX = 90;
const SWIPE_HORIZONTAL_BIAS = 2.2;

const STORAGE_KEY = "deathnote-content";

let moveKeyHeld = false;
let suppressDragClick = false;

document.addEventListener("keydown", (event) => {
  if (event.code !== "KeyM" || event.repeat || event.isComposing) return;
  if (event.ctrlKey || event.altKey || event.metaKey) return;
  // Keep normal M typing available in the note.
  moveKeyHeld = true;
});

document.addEventListener("keyup", (event) => {
  if (event.code === "KeyM") moveKeyHeld = false;
});

window.addEventListener("blur", () => {
  moveKeyHeld = false;
});

// Only the closed cover can start a window drag, before its click opens it.
document.addEventListener("mousedown", (event) => {
  if (event.button !== 0) return;
  suppressDragClick = false;
  if (isOpen() || !cover.contains(event.target)) return;
  if (!moveKeyHeld || event.ctrlKey || event.altKey || event.metaKey) return;
  const currentWindow = window.__TAURI__?.window.getCurrentWindow();
  if (!currentWindow) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  suppressDragClick = true;
  currentWindow.startDragging().catch((error) => {
    console.error("Could not move the window:", error);
  }).finally(() => {
    // Native dragging may consume the keyup event.
    moveKeyHeld = false;
  });
}, true);

document.addEventListener("click", (event) => {
  if (!suppressDragClick || event.detail === 0) return;
  suppressDragClick = false;
  event.preventDefault();
  event.stopImmediatePropagation();
}, true);

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

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let progress = 0;
let targetProgress = 0;
let velocity = 0;
let animationFrame = null;
let lastFrameTime = null;
let swipe = null;

function renderBook() {
  const visibleProgress = Math.min(Math.max(progress, 0), 1);
  const lift = Math.sin(visibleProgress * Math.PI);
  const angle = CLOSED_ANGLE + (OPEN_ANGLE - CLOSED_ANGLE) * progress;
  cover.style.transform = `rotateY(${angle}deg)`;
  // The same angle drives the cover, cast shadow and reflected light.
  pageShadow.style.opacity = String(0.16 + lift * 0.55);
  pageShadow.style.transform = `scaleX(${0.18 + (1 - visibleProgress) * 0.82})`;
  cover.style.setProperty("--cover-light", String(lift * 0.2));
  const pageUnavailable = !isOpen() || visibleProgress < 0.6;
  if (page.inert !== pageUnavailable) page.inert = pageUnavailable;
}

function stopAnimation() {
  if (animationFrame !== null) cancelAnimationFrame(animationFrame);
  animationFrame = null;
  lastFrameTime = null;
}

function finishAnimation() {
  stopAnimation();
  progress = targetProgress;
  velocity = 0;
  renderBook();
  book.classList.remove("animating");
  if (isOpen() && !swipe && document.hasFocus()) ruled.focus({ preventScroll: true });
}

function animateBook(timestamp) {
  animationFrame = null;
  // Small simulation steps keep the spring stable across refresh rates.
  let remaining = lastFrameTime === null ? 0 : Math.min((timestamp - lastFrameTime) / 1000, 0.05);
  lastFrameTime = timestamp;
  const dragging = swipe?.committed;
  const stiffness = dragging ? 460 : isOpen() ? 150 : 210;
  const damping = dragging ? 40 : isOpen() ? 23 : 29;
  while (remaining > 0) {
    const dt = Math.min(remaining, 1 / 120);
    velocity += ((targetProgress - progress) * stiffness - velocity * damping) * dt;
    progress += velocity * dt;
    // The closed cover has a physical stop; the open hinge has a little give.
    if (progress < 0 || progress > 1.025) {
      progress = Math.min(Math.max(progress, 0), 1.025);
      velocity = 0;
    }
    remaining -= dt;
  }
  renderBook();
  if (Math.abs(targetProgress - progress) < 0.0005 && Math.abs(velocity) < 0.005) {
    finishAnimation();
    return;
  }
  animationFrame = requestAnimationFrame(animateBook);
}

function animateTo(nextProgress) {
  targetProgress = nextProgress;
  if (reducedMotion.matches) {
    finishAnimation();
    return;
  }
  book.classList.add("animating");
  if (animationFrame === null) {
    lastFrameTime = null;
    animationFrame = requestAnimationFrame(animateBook);
  }
}

function setBookOpen(open) {
  book.classList.toggle("open", open);
  cover.setAttribute("aria-expanded", String(open));
  cover.tabIndex = open ? -1 : 0;
  if (!open) ruled.blur();
  animateTo(open ? 1 : 0);
}

function openBook() {
  cancelSwipe();
  setBookOpen(true);
}

function closeBook() {
  cancelSwipe();
  setBookOpen(false);
}

cover.addEventListener("click", openBook);
cover.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    openBook();
  }
});

closeTab.addEventListener("click", closeBook);

function cancelSwipe() {
  window.removeEventListener("mousemove", onSwipeMove);
  window.removeEventListener("mouseup", onSwipeUp);
  swipe = null;
  book.classList.remove("dragging");
}

// Swiping left-to-right anywhere on the written page closes the book,
// mirroring how the cover physically sweeps back over the page. Short or
// mostly-vertical drags are left alone so text selection keeps working.
function onSwipeMove(event) {
  if (!swipe) return;
  if (!(event.buttons & 1)) {
    onSwipeUp(event);
    return;
  }
  const dx = event.clientX - swipe.startX;
  const dy = event.clientY - swipe.startY;

  if (!swipe.committed) {
    if (dx > SWIPE_COMMIT_PX && dx > Math.abs(dy) * SWIPE_HORIZONTAL_BIAS) {
      swipe.committed = true;
      window.getSelection()?.removeAllRanges();
      ruled.blur();
      book.classList.add("dragging");
    } else {
      return;
    }
  }

  event.preventDefault();
  const ratio = Math.min(Math.max(dx / swipe.dragSpan, 0), 1);
  animateTo(1 - ratio);
}

function onSwipeUp(event) {
  if (!swipe) return;
  const committed = swipe.committed;
  const ratio = Math.min(Math.max((event.clientX - swipe.startX) / swipe.dragSpan, 0), 1);
  cancelSwipe();
  if (committed) setBookOpen(ratio <= CLOSE_DRAG_THRESHOLD);
}

ruled.addEventListener("mousedown", (event) => {
  if (!isOpen() || event.button !== 0) return;
  swipe = {
    committed: false,
    startX: event.clientX,
    startY: event.clientY,
    dragSpan: Math.max(book.getBoundingClientRect().width * 0.6, 1),
  };
  window.addEventListener("mousemove", onSwipeMove);
  window.addEventListener("mouseup", onSwipeUp);
});

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
  if (isOpen() && !page.inert && animationFrame === null) ruled.focus();
});

window.addEventListener("blur", () => {
  const wasDragging = swipe?.committed;
  cancelSwipe();
  if (wasDragging) animateTo(isOpen() ? 1 : 0);
});

reducedMotion.addEventListener("change", () => {
  if (reducedMotion.matches) finishAnimation();
});

renderBook();
loadContent();
