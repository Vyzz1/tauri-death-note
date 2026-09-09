const book = document.getElementById("book");
const cover = document.getElementById("cover");
const closeTab = document.getElementById("closeTab");
const ruled = document.getElementById("ruled");

const CLOSED_ANGLE = 0;
const OPEN_ANGLE = -172;
const CLOSE_DRAG_THRESHOLD = 0.35;
const SWIPE_COMMIT_PX = 90;
const SWIPE_HORIZONTAL_BIAS = 2.2;

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

// Swiping left-to-right anywhere on the written page closes the book,
// mirroring how the cover physically sweeps back over the page. Short or
// mostly-vertical drags are left alone so text selection keeps working.
let swipe = null;

function onSwipeMove(event) {
  if (!swipe) return;
  const dx = event.clientX - swipe.startX;
  const dy = event.clientY - swipe.startY;

  if (!swipe.committed) {
    if (dx > SWIPE_COMMIT_PX && dx > Math.abs(dy) * SWIPE_HORIZONTAL_BIAS) {
      swipe.committed = true;
      window.getSelection()?.removeAllRanges();
      ruled.blur();
      cover.style.transition = "none";
    } else {
      return;
    }
  }

  const ratio = Math.min(Math.max(dx / swipe.dragSpan, 0), 1);
  cover.style.transform = `rotateY(${OPEN_ANGLE + (CLOSED_ANGLE - OPEN_ANGLE) * ratio}deg)`;
}

function onSwipeUp(event) {
  window.removeEventListener("mousemove", onSwipeMove);
  window.removeEventListener("mouseup", onSwipeUp);
  if (!swipe) return;
  if (swipe.committed) {
    const dx = event.clientX - swipe.startX;
    const ratio = Math.min(Math.max(dx / swipe.dragSpan, 0), 1);
    settleDrag(ratio);
  }
  swipe = null;
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
  if (isOpen()) ruled.focus();
});

loadContent();
