// dashboard/index.js — entry point; wires connection.js, poll-engine.js, modal.js, dashboard-ui.js together.

import { createConnection, loadConnectionSettings } from "./connection.js";
import { createPollEngine } from "./poll-engine.js";
import { createConnectionUI } from "./modal.js";
import { createDashboardUI } from "./dashboard-ui.js";
import { styleDialogScrollbars } from "./dialog-scrollbar.js";

// Declared with `let`: the handlers below close over connection/engine by reference, so it's fine they don't exist yet here.

let connection;
let engine;

const connectionUI = createConnectionUI({
  getConnection: () => connection,
  loadConnectionSettings,
});

const dashboardUI = createDashboardUI({
  onStart: (pollData) =>
    engine.createPoll(pollData.choicesArray, pollData.title, pollData.duration),
  onEnd: () => engine.endPoll(),
  onToggle: () => engine.togglePoll(),
  onReset: () => engine.resetPoll(),
});

engine = createPollEngine({
  doAction: (id, args) => connection.doAction(id, args),
  sendToOverlay: (event, payload) => connection.sendToOverlay(event, payload),
  onUpdate: (event, payload) => dashboardUI.render(event, payload),
});

connection = createConnection({
  onChatMessage: engine.onChatMessage,
  onDurationPreset: (value) => dashboardUI.applyDurationPreset(value),

  // Same as clicking the dashboard's own Clear button.
  onClear: () => dashboardUI.clearAll(),

  onStartEndToggle: () => dashboardUI.startEndPoll(),

  onRequeue: ({ title, choicesArray, duration }) =>
    engine.createPoll(choicesArray, title, duration, { requeued: true }),

  // Saved Polls is a PRO-only feature — main has no saved slots to run, so just nudge the upsell.
  onRunSavedPoll: () => connectionUI.openLockedFeatureModal(),

  onSbStatusChange: connectionUI.handleSbStatusChange,
  onTikfinityStatusChange: connectionUI.handleTikfinityStatusChange,
});

dashboardUI.init();
connectionUI.init(); // also attempts auto-reconnect from saved settings, which triggers connection.connectStreamerbot(...)
connection.connectTikfinity();

// The dialog bodies scroll inside wa-dialog's shadow root, out of reach of style.css — see dialog-scrollbar.js.
styleDialogScrollbars();

// Hide the loading overlay once the WA custom elements upgrade; timeout is a safety net if the CDN is slow/unreachable.
const loadingOverlay = document.getElementById("loading-overlay");
const WA_TAGS = ["wa-input", "wa-select", "wa-number-input", "wa-dialog", "wa-copy-button"];

Promise.race([
  Promise.all(WA_TAGS.map((tag) => customElements.whenDefined(tag))),
  new Promise((resolve) => setTimeout(resolve, 8000)),
]).then(() => {
  loadingOverlay?.classList.add("hidden");
});