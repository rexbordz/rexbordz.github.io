// dashboard/modal.js — connection modal + Streamer.bot integration-check modal (both <wa-dialog>s in index.html).

import { STREAM_DECK_IMPORT_CODE } from "./stream-deck-import-code.js";

const REQUIRED_ACTIONS = [
  { id: "8413040f-ee21-439d-be53-b44f55d35998", name: "MultiPoll • [SD] Clear" },
  { id: "41abf643-fc8b-4983-a75f-2236a99b5a20", name: "MultiPoll • [SD] Run Saved Poll" },
  { id: "ec6fb9ae-1a07-4698-bb44-149e05e11b22", name: "MultiPoll • [SD] Set Duration" },
  { id: "e14a127f-34f6-4091-ba06-a1eb4d387564", name: "MultiPoll • [SD] Start/End Poll" },
  { id: "705bae3a-36f1-4f42-9bb1-110c8bc5feb7", name: "MultiPoll • [SD] Toggle Poll " },
  { id: "510c00ce-3de9-48c3-82fb-a6b30ad37934", name: "MultiPoll • Poll Ended" },
  { id: "4c16514d-8672-4c36-823e-ce11219a3bdb", name: "MultiPoll • Poll Started" },
  { id: "7f9394a3-1b78-4ca1-a978-fad1d54517ad", name: "MultiPoll • Register Custom Triggers" },
  { id: "36315a8e-25c8-4f5c-a1f3-fd479a7540a7", name: "MultiPoll • Stream Deck Dynamic Buttons" },
];

/**
 * @param {() => ReturnType<import('./connection.js').createConnection>} getConnection - thunk, since connection.js needs this module's handlers before it exists
 * @param {() => {address: string, port: string, password: string}} loadConnectionSettings
 */
export function createConnectionUI({ getConnection, loadConnectionSettings }) {
  let lastSBConnected = false;
  let lastSBVersion = "";
  let lastTikfinityConnected = false;

  let actionLookup = new Map();

  const connectionDialog = document.getElementById("connection-dialog");
  const sbActionsDialog = document.getElementById("sb-actions-dialog");
  const lockedFeatureDialog = document.getElementById("locked-feature-dialog");

  const warningBanner = connectionDialog.querySelector(".modal-warning");
  const addressInput = connectionDialog.querySelector("#sb-address");
  const portInput = connectionDialog.querySelector("#sb-port");
  const passwordInput = connectionDialog.querySelector("#sb-password");
  const connectBtn = connectionDialog.querySelector("#connect-btn");

  const codeBox = sbActionsDialog.querySelector("#codeBox");
  const importCopyBtn = sbActionsDialog.querySelector("#import-copy-btn");
  const recheckBtn = sbActionsDialog.querySelector("#integration-recheck-btn");

  codeBox.textContent = STREAM_DECK_IMPORT_CODE;
  importCopyBtn.value = STREAM_DECK_IMPORT_CODE;

  // =============================
  // Status Indicator
  // =============================

  function updateStatusIndicator() {
    const indicator = document.querySelector(".status-indicator");
    if (!indicator) return;

    indicator.classList.remove("online", "offline");
    indicator.classList.add(lastSBConnected ? "online" : "offline");

    const sbLine = lastSBConnected
      ? `Connected to Streamer.bot ${lastSBVersion}`
      : "Disconnected from Streamer.bot";

    const tikLine = lastTikfinityConnected
      ? "Connected to TikFinity"
      : "Disconnected from TikFinity (Optional)";

    indicator.title = `${sbLine}\n${tikLine}`;
  }

  // =============================
  // Connection Modal
  // =============================

  function openConnectionModal() {
    if (connectionDialog.open || sbActionsDialog.open || lockedFeatureDialog.open) return;

    const saved = loadConnectionSettings();
    addressInput.value = saved.address;
    portInput.value = saved.port;
    passwordInput.value = saved.password;

    warningBanner.textContent = "Disconnected from Streamer.bot";
    warningBanner.classList.toggle("hidden", lastSBConnected);

    connectBtn.disabled = false;
    connectBtn.textContent = "Connect";

    document.body.classList.add("modal-open");
    connectionDialog.open = true;
  }

  function closeConnectionModal() {
    connectionDialog.open = false;
    document.body.classList.remove("modal-open");
  }

  connectBtn.addEventListener("click", () => {
    const sbAddress = addressInput.value.trim();
    const sbPort = portInput.value.trim();
    const sbPassword = passwordInput.value.trim();

    if (!sbAddress || !sbPort) {
      warningBanner.textContent = "Address and Port are required.";
      warningBanner.classList.remove("hidden");
      return;
    }

    connectBtn.disabled = true;
    connectBtn.textContent = "Connecting...";

    getConnection().connectStreamerbot(sbAddress, sbPort, sbPassword);
  });

  connectionDialog.addEventListener("wa-after-hide", () => {
    document.body.classList.remove("modal-open");
  });

  // =============================
  // Integration-Check Modal
  // =============================

  function buildActionLookup(streamerbotActions) {
    actionLookup.clear();
    streamerbotActions.forEach((action) => actionLookup.set(action.id, action));
  }

  function computeIntegrationHealth() {
    return REQUIRED_ACTIONS.every((expected) => {
      const found = actionLookup.get(expected.id);
      return found && found.name === expected.name && found.enabled === true;
    });
  }

  function paintActionRows() {
    REQUIRED_ACTIONS.forEach((expected) => {
      const row = document.querySelector(`.row[data-id="${expected.id}"]`);
      if (!row) return;

      const statusEl = row.querySelector(".status");
      const found = actionLookup.get(expected.id);
      const isValid = found && found.name === expected.name && found.enabled === true;

      statusEl.classList.remove("found", "not-found");
      if (isValid) {
        statusEl.classList.add("found");
        statusEl.textContent = "✔";
      } else {
        statusEl.classList.add("not-found");
        statusEl.textContent = "✖";
      }
    });
  }

  function updateActionsSummary(allValid) {
    const summary = document.querySelector(".status-text");
    const integrationBtn = document.querySelector(".integration-check");
    if (!summary || !integrationBtn) return;

    summary.classList.remove("valid", "invalid", "checking");
    if (allValid) {
      summary.textContent = "All actions are found";
      summary.classList.add("valid");
    } else {
      summary.textContent = "Some actions are not found";
      summary.classList.add("invalid");
    }
  }

  function updateIntegrationButton(allValid) {
    const integrationBtn = document.querySelector(".integration-check");
    if (!integrationBtn) return;
    integrationBtn.classList.toggle("warning", !allValid);
  }

  function renderActionsList() {
    const list = document.querySelector(".actions-list");
    if (!list) return;
    list.innerHTML = "";

    REQUIRED_ACTIONS.forEach((action) => {
      const row = document.createElement("div");
      row.className = "row";
      row.dataset.id = action.id;
      row.innerHTML = `
        <span>${action.name}</span>
        <span class="status not-found">✖</span>
      `;
      list.appendChild(row);
    });
  }

  function refreshIntegrationDisplay() {
    const streamerbotActions = getConnection().getKnownActions();
    buildActionLookup(streamerbotActions);
    const allValid = computeIntegrationHealth();
    updateActionsSummary(allValid);
    updateIntegrationButton(allValid);
    paintActionRows();
    return allValid;
  }

  async function recheckIntegration() {
    const summary = document.querySelector(".status-text");

    recheckBtn.classList.add("loading");
    if (summary) {
      summary.textContent = "Fetching latest actions...";
      summary.classList.add("checking");
    }

    try {
      await getConnection().refreshActions();
      refreshIntegrationDisplay();
    } catch (err) {
      console.error("Integration recheck failed:", err);
      if (summary) summary.textContent = "Failed to reach Streamer.bot.";
    } finally {
      recheckBtn.classList.remove("loading");
    }
  }

  recheckBtn.addEventListener("click", recheckIntegration);

  function openIntegrationModal() {
    if (connectionDialog.open || sbActionsDialog.open || lockedFeatureDialog.open) return;

    renderActionsList();
    refreshIntegrationDisplay();

    document.body.classList.add("modal-open");
    sbActionsDialog.open = true;
  }

  sbActionsDialog.addEventListener("wa-after-hide", () => {
    document.body.classList.remove("modal-open");
  });

  // =============================
  // Locked Feature Modal (PRO upsell)
  // =============================

  function openLockedFeatureModal() {
    if (connectionDialog.open || sbActionsDialog.open || lockedFeatureDialog.open) return;

    document.body.classList.add("modal-open");
    lockedFeatureDialog.open = true;
  }

  lockedFeatureDialog.addEventListener("wa-after-hide", () => {
    document.body.classList.remove("modal-open");
  });

  // =============================
  // Status Handlers (wired into connection.js)
  // =============================

  function handleSbStatusChange(connected, version = "") {
    lastSBConnected = connected;
    lastSBVersion = version || "";
    updateStatusIndicator();

    if (connected) {
      if (connectionDialog.open) closeConnectionModal();
      getConnection().refreshActions().then(refreshIntegrationDisplay);
    } else {
      if (!connectionDialog.open) {
        openConnectionModal();
      } else {
        warningBanner.textContent = "Disconnected from Streamer.bot";
        warningBanner.classList.remove("hidden");
        connectBtn.disabled = false;
        connectBtn.textContent = "Connect";
      }
    }
  }

  function handleTikfinityStatusChange(connected) {
    lastTikfinityConnected = connected;
    updateStatusIndicator();
  }

  // =============================
  // Init
  // =============================

  function init() {
    updateStatusIndicator();

    const statusIndicator = document.querySelector(".status-indicator");
    if (statusIndicator) {
      statusIndicator.addEventListener("click", openConnectionModal);
    }

    const integrationBtn = document.querySelector(".integration-check");
    if (integrationBtn) {
      integrationBtn.addEventListener("click", openIntegrationModal);
    }

    const savedPollsBtn = document.querySelector(".saved-polls-btn");
    if (savedPollsBtn) {
      savedPollsBtn.addEventListener("click", openLockedFeatureModal);
    }

    const addChoiceBtn = document.getElementById("add-choice-btn");
    if (addChoiceBtn) {
      addChoiceBtn.addEventListener("click", openLockedFeatureModal);
    }

    // Auto-open the connection modal on first load, same as before
    openConnectionModal();

    const saved = loadConnectionSettings();
    if (saved.address && saved.port) {
      getConnection().connectStreamerbot(saved.address, saved.port, saved.password);
    }
  }

  return {
    init,
    handleSbStatusChange,
    handleTikfinityStatusChange,
    openLockedFeatureModal,
  };
}
