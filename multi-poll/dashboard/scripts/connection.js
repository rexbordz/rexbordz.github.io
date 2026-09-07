// connection.js — I/O layer: owns the Streamer.bot client and Tikfinity socket.
// StreamerbotClient is a global from the CDN <script> in index.html, not imported.
const { StreamerbotClient } = window;

export const SB_ACTION_IDS = {
  duration: "ec6fb9ae-1a07-4698-bb44-149e05e11b22",
  clear: "8413040f-ee21-439d-be53-b44f55d35998",
  startEndToggle: "e14a127f-34f6-4091-ba06-a1eb4d387564",
  togglePoll: "705bae3a-36f1-4f42-9bb1-110c8bc5feb7",
  pollEnded: "e5a8fac6-f58e-4344-88eb-9bd13be4ab2e",
  pollStarted: "4c16514d-8672-4c36-823e-ce11219a3bdb",
  runSavedPoll: "41abf643-fc8b-4983-a75f-2236a99b5a20",
};

const STORAGE_KEYS = {
  address: "sb_address",
  port: "sb_port",
  password: "sb_password",
};

const TIKFINITY_URL = "ws://localhost:21213";
const TIKFINITY_RECONNECT_DELAY_MS = 3000;

export function saveConnectionSettings(address, port, password) {
  localStorage.setItem(STORAGE_KEYS.address, address);
  localStorage.setItem(STORAGE_KEYS.port, port);
  localStorage.setItem(STORAGE_KEYS.password, password);
}

export function loadConnectionSettings() {
  return {
    address: localStorage.getItem(STORAGE_KEYS.address) || "127.0.0.1",
    port: localStorage.getItem(STORAGE_KEYS.port) || "8080",
    password: localStorage.getItem(STORAGE_KEYS.password) || "",
  };
}

function parseRequeueArgs(args) {
  let choicesArray = [];
  try {
    choicesArray = typeof args.choicesArray === "string"
      ? JSON.parse(args.choicesArray)
      : (args.choicesArray || []);
  } catch (err) {
    console.error("Failed to parse choicesArray for requeue:", err);
  }
  return { title: args.pollTitle, choicesArray, duration: args.pollDuration };
}

/**
 * @param {object} handlers
 * @param {(username: string, message: string, platform: string) => void} handlers.onChatMessage
 *   Fired for every chat message from Twitch, Kick, YouTube, or TikTok.
 * @param {(presetValue: string) => void} handlers.onDurationPreset
 *   A Stream Deck-style duration preset button was pressed.
 * @param {() => void} handlers.onClear
 * @param {() => void} handlers.onStartEndToggle
 * @param {(payload: {title: string, choicesArray: object[], duration: number|string}) => void} handlers.onRequeue
 * @param {(slot: number) => void} [handlers.onRunSavedPoll]
 *   The "Run Saved Poll" Stream Deck action was pressed, with a `slot` arg (1-10).
 * @param {(connected: boolean, version?: string) => void} [handlers.onSbStatusChange]
 * @param {(connected: boolean) => void} [handlers.onTikfinityStatusChange]
 */
export function createConnection(handlers) {
  const {
    onChatMessage,
    onDurationPreset,
    onClear,
    onStartEndToggle,
    onRequeue,
    onRunSavedPoll = () => {},
    onSbStatusChange = () => {},
    onTikfinityStatusChange = () => {},
  } = handlers;

  let sbClient = null;
  let sbClientConnected = false;
  let tikfinitySocket = null;
  let tikfinityConnected = false;
  let isConnecting = false;
  let streamerbotActions = [];

  // ---- Streamer.bot ----

  function connectStreamerbot(address, port, password) {
    if (isConnecting) return;
    isConnecting = true;

    if (sbClient) {
      try { sbClient.disconnect(); } catch (err) { /* already gone */ }
    }

    sbClient = new StreamerbotClient({
      host: address,
      port,
      password,

      onConnect: async (data) => {
        sbClientConnected = true;
        isConnecting = false;

        const version = data.info?.version || data.version || "";
        saveConnectionSettings(address, port, password);
        onSbStatusChange(true, version);

        await refreshActions();
      },

      onDisconnect: () => {
        sbClientConnected = false;
        isConnecting = false;
        onSbStatusChange(false);
      },
    });

    sbClient.on("Twitch.ChatMessage", (r) =>
      onChatMessage(r.data.user.login, r.data.text, r.event.source));
    sbClient.on("Kick.ChatMessage", (r) =>
      onChatMessage(r.data.user.login, r.data.text, r.event.source));
    sbClient.on("YouTube.Message", (r) =>
      onChatMessage(r.data.user.name, r.data.message, r.event.source));

    sbClient.on("Raw.Action", (response) => {
      const actionId = response?.data?.actionId;
      if (!actionId) return;

      if (actionId === SB_ACTION_IDS.duration) {
        const duration = response?.data?.arguments?.duration;
        if (duration === undefined) return;
        onDurationPreset(String(duration));
        return;
      }

      switch (actionId) {
        case SB_ACTION_IDS.clear:
          onClear();
          return;

        case SB_ACTION_IDS.startEndToggle:
          onStartEndToggle();
          return;

        // Toggle Poll is handled directly by the overlay (script.js), not here — avoids a double-toggle.

        case SB_ACTION_IDS.pollStarted: {
          const args = response?.data?.arguments || {};
          if (!args.requeuedAction) return; // a normal poll start, not an external requeue
          onRequeue(parseRequeueArgs(args));
          return;
        }

        case SB_ACTION_IDS.runSavedPoll: {
          const slot = parseInt(response?.data?.arguments?.slot, 10);
          if (isNaN(slot)) return;
          onRunSavedPoll(slot);
          return;
        }

        default:
          return; // not an action ID this widget cares about
      }
    });
  }

  async function refreshActions() {
    if (!sbClientConnected || !sbClient) return streamerbotActions;
    const response = await sbClient.getActions();
    streamerbotActions = response.actions || [];
    return streamerbotActions;
  }

  function doAction(actionId, args = {}) {
    if (!sbClientConnected || !sbClient) {
      console.warn("doAction requested but Streamer.bot isn't connected:", actionId);
      return;
    }
    sbClient.doAction(actionId, args)
      .catch((err) => console.error("Streamer.bot action failed:", actionId, err));
  }

  function sendToOverlay(event, payload) {
    if (!sbClientConnected || !sbClient) {
      console.warn("sendToOverlay requested but Streamer.bot isn't connected:", event);
      return;
    }
    sbClient.executeCodeTrigger(event, payload)
      .catch((err) => console.error("executeCodeTrigger failed:", event, err));
  }

  // ---- Tikfinity ----

  function connectTikfinity() {
    const alreadyConnecting =
      tikfinitySocket &&
      (tikfinitySocket.readyState === WebSocket.OPEN || tikfinitySocket.readyState === WebSocket.CONNECTING);
    if (alreadyConnecting) return;

    tikfinitySocket = new WebSocket(TIKFINITY_URL);

    tikfinitySocket.onopen = () => {
      tikfinityConnected = true;
      onTikfinityStatusChange(true);
    };

    tikfinitySocket.onclose = () => {
      tikfinityConnected = false;
      onTikfinityStatusChange(false);
      setTimeout(connectTikfinity, TIKFINITY_RECONNECT_DELAY_MS);
    };

    tikfinitySocket.onmessage = (event) => {
      try {
        const packet = JSON.parse(event.data);
        if (packet.event === "chat") {
          onChatMessage(packet.data.uniqueId, packet.data.comment, "TikTok");
        }
      } catch (err) {
        console.error("Failed to process TikFinity event:", err);
      }
    };
  }

  return {
    connectStreamerbot,
    connectTikfinity,
    refreshActions,
    doAction,
    sendToOverlay,
    isStreamerbotConnected: () => sbClientConnected,
    isTikfinityConnected: () => tikfinityConnected,
    getKnownActions: () => streamerbotActions,
  };
}