const book = document.getElementById("book");
const cover = document.getElementById("cover");
const closeTab = document.getElementById("closeTab");
const ruled = document.getElementById("ruled");

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

function openBook() {
  if (isOpen()) return;
  book.classList.add("open");
  window.setTimeout(() => ruled.focus(), 550);
}

function closeBook() {
  if (!isOpen()) return;
  ruled.blur();
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
