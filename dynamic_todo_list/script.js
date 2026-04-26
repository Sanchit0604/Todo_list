/**
 * ============================================================
 * Project Title : Dynamic To-Do List (Experiment 4)
 * File          : script.js
 * Author        : [Your Name]
 * Date          : April 26, 2026
 *
 * Description   : Core JavaScript for TaskFlow.
 *   Task 4 — Capture input, add tasks dynamically, block empties
 *   Task 5 — Inline edit and animated delete for each task
 *   Task 6  — Checkbox completion toggle + live stats counter
 * ============================================================
 */

"use strict";

/* ============================================================
   SECTION 1 — DOM REFERENCES
   Cache all elements we need so we don't query the DOM repeatedly
   ============================================================ */

const taskInput  = document.getElementById("task-input");   // text field
const addBtn     = document.getElementById("add-btn");       // "Add Task" button
const taskList   = document.getElementById("task-list");     // <ul> container
const emptyState = document.getElementById("empty-state");  // empty placeholder <li>
const errorMsg   = document.getElementById("error-msg");    // validation error <p>

// Stats elements (Bonus Task 6)
const statTotal   = document.getElementById("stat-total");
const statDone    = document.getElementById("stat-done");
const statPending = document.getElementById("stat-pending");

/* ============================================================
   SECTION 2 — APPLICATION STATE
   We keep all tasks in a plain array.
   Each task is an object: { id: Number, text: String, completed: Boolean }
   ============================================================ */

let tasks  = [];   // master task array
let nextId = 1;    // auto-increment ID counter

/* ============================================================
   SECTION 3 — UTILITY HELPERS
   ============================================================ */

/**
 * Returns the next unique ID and increments the counter.
 * @returns {number}
 */
function generateId() {
  return nextId++;
}

/**
 * Shows or hides the empty-state placeholder.
 * Placeholder is visible only when tasks array is empty.
 */
function toggleEmptyState() {
  emptyState.style.display = tasks.length === 0 ? "flex" : "none";
}

/**
 * Recalculates and updates the three stats chips in the header.
 * Called after every add / delete / toggle operation.
 */
function updateStats() {
  const total   = tasks.length;
  const done    = tasks.filter(t => t.completed).length;
  const pending = total - done;

  statTotal.textContent   = total;
  statDone.textContent    = done;
  statPending.textContent = pending;
}

/**
 * Displays an inline validation error below the input field.
 * The message auto-disappears after 2.5 seconds.
 *
 * @param {string} message - Error text to show.
 */
function showError(message) {
  errorMsg.textContent = message;
  errorMsg.classList.add("visible");

  // Clear any previous timer to avoid overlapping hides
  clearTimeout(showError._hideTimer);
  showError._hideTimer = setTimeout(() => {
    errorMsg.classList.remove("visible");
  }, 2500);
}

/* ============================================================
   SECTION 4 — RENDER ONE TASK  (used by add & initial load)
   Builds and injects a single <li> for the given task object.
   ============================================================ */

/**
 * Creates a fully-featured task <li> element and appends it to the list.
 *
 * Each <li> contains:
 *   • a circular checkbox   (Task 6)
 *   • a text span           (Tasks 4 & 5)
 *   • Edit + Delete buttons (Task 5)
 *
 * @param {Object} task - { id, text, completed }
 */
function renderTask(task) {

  /* ── Create <li> ── */
  const li = document.createElement("li");
  li.classList.add("task-item");
  li.dataset.id = task.id;           // store ID on the DOM element
  if (task.completed) li.classList.add("completed");
  li.setAttribute("role", "listitem");

  /* ── Checkbox (Task 6) ── */
  const checkbox = document.createElement("input");
  checkbox.type      = "checkbox";
  checkbox.className = "task-checkbox";
  checkbox.checked   = task.completed;
  checkbox.setAttribute("aria-label", "Mark task as complete");
  // Wire up the completion toggle handler
  checkbox.addEventListener("change", () => handleToggle(task.id, checkbox.checked));

  /* ── Task text <span> ── */
  const textSpan = document.createElement("span");
  textSpan.classList.add("task-text");
  textSpan.textContent = task.text;

  /* ── Edit button (Task 5) ── */
  const editBtn = document.createElement("button");
  editBtn.classList.add("btn", "btn-sm", "btn-edit");
  editBtn.textContent = "Edit";
  editBtn.setAttribute("aria-label", "Edit this task");
  editBtn.addEventListener("click", () => handleEdit(task.id, li, textSpan, editBtn));

  /* ── Delete button (Task 5) ── */
  const deleteBtn = document.createElement("button");
  deleteBtn.classList.add("btn", "btn-sm", "btn-delete");
  deleteBtn.textContent = "Delete";
  deleteBtn.setAttribute("aria-label", "Delete this task");
  deleteBtn.addEventListener("click", () => handleDelete(task.id, li));

  /* ── Actions wrapper ── */
  const actions = document.createElement("div");
  actions.classList.add("task-actions");
  actions.appendChild(editBtn);
  actions.appendChild(deleteBtn);

  /* ── Assemble and insert ── */
  li.appendChild(checkbox);
  li.appendChild(textSpan);
  li.appendChild(actions);

  // Insert before the empty-state so it stays last
  taskList.insertBefore(li, emptyState);
}

/* ============================================================
   SECTION 5 — ADD TASK  (Task 4)
   ============================================================ */

/**
 * Reads the input field, validates, creates a task, and renders it.
 * Prevents empty strings from being added (Task 4 requirement).
 */
function handleAddTask() {
  const raw  = taskInput.value;      // raw value (may have leading spaces)
  const text = raw.trim();           // cleaned value

  /* --- VALIDATION: block empty tasks --- */
  if (text === "") {
    showError("⚠️  Please enter a task description before adding.");
    taskInput.focus();
    return;
  }

  /* --- Build task object --- */
  const task = {
    id:        generateId(),
    text:      text,
    completed: false,
  };

  /* --- Update state --- */
  tasks.push(task);

  /* --- Update UI --- */
  renderTask(task);
  toggleEmptyState();
  updateStats();

  /* --- Reset input for next entry --- */
  taskInput.value = "";
  taskInput.focus();
}

/* ============================================================
   SECTION 6 — EDIT TASK  (Task 5)
   Switches the task row into an inline-edit mode.
   ============================================================ */

/**
 * Replaces the task text <span> with a live <input> for editing.
 * Saving: press Enter or click the "Save" button.
 * Cancelling: press Escape — restores original text.
 *
 * @param {number}      id       - Task ID.
 * @param {HTMLElement} li       - The task's <li> element.
 * @param {HTMLElement} textSpan - The <span> showing current text.
 * @param {HTMLElement} editBtn  - The Edit button to swap to Save.
 */
function handleEdit(id, li, textSpan, editBtn) {
  // Guard: if already editing this item, do nothing
  if (li.querySelector(".task-edit-input")) return;

  const originalText = textSpan.textContent;

  /* --- Inline edit <input> --- */
  const editInput = document.createElement("input");
  editInput.type      = "text";
  editInput.className = "task-edit-input";
  editInput.value     = originalText;
  editInput.maxLength = 200;
  editInput.setAttribute("aria-label", "Edit task text");

  // Replace span with input in the DOM
  textSpan.replaceWith(editInput);
  editInput.focus();
  editInput.select();

  // Swap Edit → Save button
  editBtn.textContent = "Save";
  editBtn.classList.replace("btn-edit", "btn-save");

  /* --- Helper: commit the edit --- */
  function commitEdit() {
    const newText = editInput.value.trim();

    // Don't allow saving an empty task
    if (!newText) {
      editInput.style.borderColor = "var(--red)";
      editInput.focus();
      return;
    }

    // Update the in-memory task object
    const task = tasks.find(t => t.id === id);
    if (task) task.text = newText;

    // Update span text and restore it
    textSpan.textContent = newText;
    editInput.replaceWith(textSpan);

    // Restore Edit button
    editBtn.textContent = "Edit";
    editBtn.classList.replace("btn-save", "btn-edit");
    // Rebind click to open editing again with fresh references
    editBtn.onclick = () => handleEdit(id, li, textSpan, editBtn);
  }

  /* --- Helper: cancel the edit --- */
  function cancelEdit() {
    editInput.replaceWith(textSpan);
    editBtn.textContent = "Edit";
    editBtn.classList.replace("btn-save", "btn-edit");
    editBtn.onclick = () => handleEdit(id, li, textSpan, editBtn);
  }

  // Save on Save button click
  editBtn.onclick = commitEdit;

  // Keyboard shortcuts inside the edit field
  editInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter")  commitEdit();   // Enter = save
    if (e.key === "Escape") cancelEdit();   // Escape = cancel
  });
}

/* ============================================================
   SECTION 7 — DELETE TASK  (Task 5)
   ============================================================ */

/**
 * Animates the task row out, then removes it from the DOM and state.
 *
 * @param {number}      id - Task ID to remove.
 * @param {HTMLElement} li - The <li> element to animate and remove.
 */
function handleDelete(id, li) {
  // CSS class triggers a slide-out + fade transition (see style.css .removing)
  li.classList.add("removing");

  // Wait for the CSS transition to finish (~220 ms), then clean up
  li.addEventListener("transitionend", () => {
    li.remove();                                    // remove from DOM
    tasks = tasks.filter(t => t.id !== id);         // remove from state

    toggleEmptyState();
    updateStats();
  }, { once: true });                               // listener fires only once
}

/* ============================================================
   SECTION 8 — TOGGLE COMPLETION  (Task 6 / Bonus)
   ============================================================ */

/**
 * Marks or unmarks a task as completed and updates the UI accordingly.
 * Visual change: CSS class "completed" applies strikethrough text.
 *
 * @param {number}  id        - Task ID.
 * @param {boolean} isChecked - New checked state from the checkbox.
 */
function handleToggle(id, isChecked) {
  // 1. Update the in-memory task
  const task = tasks.find(t => t.id === id);
  if (task) task.completed = isChecked;

  // 2. Toggle the CSS class on the <li>
  const li = taskList.querySelector(`[data-id="${id}"]`);
  if (li) li.classList.toggle("completed", isChecked);

  // 3. Refresh the stats bar
  updateStats();
}

/* ============================================================
   SECTION 9 — EVENT LISTENERS
   ============================================================ */

// Click the Add Task button
addBtn.addEventListener("click", handleAddTask);

// Press Enter inside the text input — same as clicking Add
taskInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleAddTask();
});

/* ============================================================
   SECTION 10 — INITIALISE
   Runs once on page load to set the correct initial UI state.
   ============================================================ */

/**
 * Sets up the app for first use:
 * - Shows the empty-state placeholder
 * - Renders zeroed stats
 * - Focuses the input for immediate typing
 */
function init() {
  toggleEmptyState();
  updateStats();
  taskInput.focus();
}

// Kick everything off
init();
