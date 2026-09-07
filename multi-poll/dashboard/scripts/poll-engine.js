// poll-engine.js — pure poll domain logic: votes, timer, winner, state machine. No DOM, no Streamer.bot access.

const SB_ACTIONS = {
  pollStarted: "4c16514d-8672-4c36-823e-ce11219a3bdb",
  pollEnded: "510c00ce-3de9-48c3-82fb-a6b30ad37934",
};

const RESULTS_RESET_DELAY_MS = 8000;

/**
 * @param {object} io
 * @param {(actionId: string, args: object) => void} io.doAction
 *   Fire a Streamer.bot action directly (e.g. narration hooks).
 * @param {(event: string, payload: object) => void} io.sendToOverlay
 *   Push a render event to the overlay (ExecuteCodeTrigger under the hood).
 * @param {(event: string, payload: object) => void} [io.onUpdate] - notifies the dashboard's own UI mirror directly
 */
export function createPollEngine({ doAction, sendToOverlay, onUpdate = () => {} }) {
  let votes = [];
  let pollDuration = 0;
  let isPollActive = false;
  let votedUsers = new Map(); // platform -> Set(usernames), resets every poll
  let maxChoices = 0;
  let pollSessionId = 0;
  let currentPollTitle = "";
  let currentPollChoices = [];
  let pollTimer = null;
  let countdownInterval = null;

  // Only these five reach the overlay — timerTick/lockStartButton are dashboard-only.
  const OVERLAY_EVENTS = new Set([
    "PollStarted",
    "LiveStatsUpdate",
    "PollEnded",
    "PollReset",
    "TogglePoll",
  ]);

  function emit(event, payload) {
    if (OVERLAY_EVENTS.has(event)) {
      sendToOverlay(event, payload);
    }
    onUpdate(event, payload);
  }

  function addChoicesToArgs(targetArgs, choiceList) {
    if (!Array.isArray(choiceList)) return targetArgs;
    choiceList.forEach((choice, index) => {
      const choiceText = typeof choice === "object" ? choice.text : choice;
      targetArgs[`choice${index}`] = choiceText;
    });
    return targetArgs;
  }

  /**
   * @param {{text: string}[]} choicesArray
   * @param {string} pollTitle
   * @param {number|"permanent"} duration
   * @param {{requeued?: boolean}} [opts] - true when replaying a poll rather than starting fresh
   */
  function createPoll(choicesArray, pollTitle = "Type number (1, 2...) in chat to vote", duration = 0, opts = {}) {
    const { requeued = false } = opts;
    pollSessionId++;

    currentPollTitle = pollTitle;
    currentPollChoices = choicesArray;
    maxChoices = choicesArray.length;

    votes = new Array(maxChoices).fill(0);
    pollDuration = duration;
    isPollActive = true;
    votedUsers.clear();

    emit("PollStarted", { title: pollTitle, choicesArray, duration, requeued });

    if (duration !== "permanent" && duration > 0) {
      startPollTimer();
    } else {
      emit("timerTick", { time: "permanent" });
    }

    if (!requeued) {
      let args = {
        pollTitle,
        pollDuration: duration,
        numChoices: maxChoices,
        choicesArray: JSON.stringify(choicesArray),
      };
      args = addChoicesToArgs(args, choicesArray);
      doAction(SB_ACTIONS.pollStarted, args);
    }
  }

  function startPollTimer() {
    clearTimeout(pollTimer);
    clearInterval(countdownInterval);

    if (pollDuration === 0) {
      emit("timerTick", { time: "permanent" });
      return;
    }

    let secondsLeft = pollDuration;

    // Tick once up front: the interval's first callback is a full second away, so
    // without this the dashboard shows nothing for that second and then opens on
    // pollDuration - 1, permanently a second behind the real countdown.
    emit("timerTick", { time: secondsLeft });

    countdownInterval = setInterval(() => {
      secondsLeft--;
      emit("timerTick", { time: secondsLeft });

      if (secondsLeft <= 0) {
        clearInterval(countdownInterval);
        endPoll();
      }
    }, 1000);
  }

  function computeLiveStats() {
    const totalVotes = votes.reduce((sum, v) => sum + v, 0);

    const stats = votes.map((voteCount, index) => ({
      index,
      votes: voteCount,
      percent: totalVotes > 0
        ? parseFloat(((voteCount / totalVotes) * 100).toFixed(1))
        : 0,
    }));

    emit("LiveStatsUpdate", { stats });
  }

  function applyVoteDelta(choiceIndex, delta) {
    if (choiceIndex < 0 || choiceIndex >= votes.length) return;
    votes[choiceIndex] += delta;
    computeLiveStats();
  }

  /** Feed a single chat message in from any platform; no-ops unless it's a valid vote. */
  function onChatMessage(username, message, platform) {
    if (!isPollActive) return;

    // Strip invisible/combining Unicode chars first — some chat clients append
    // one to slip duplicate-looking messages past anti-spam filters.
    const cleaned = message.replace(/[\p{Cf}\p{M}]/gu, "");
    const trimmed = cleaned.trim();
    if (!/^\d+$/.test(trimmed)) return;

    const vote = Number(trimmed);
    if (vote < 1 || vote > maxChoices) return;
    const choiceIndex = vote - 1;

    if (!votedUsers.has(platform)) {
      votedUsers.set(platform, new Map());
    }
    const platformVotes = votedUsers.get(platform); // username -> choiceIndex

    const previousChoice = platformVotes.get(username);
    if (previousChoice === choiceIndex) return; // same vote again, nothing to do

    if (previousChoice !== undefined) {
      applyVoteDelta(previousChoice, -1); // undo their old vote
    }
    applyVoteDelta(choiceIndex, +1);
    platformVotes.set(username, choiceIndex);
  }


  function highlightWinner() {
    isPollActive = false;

    let winners = [];
    let maxVotes = 0;
    let winnerArray = [];
    let voteCount = 0;
    let winnerPercent = 0;
    let pollResults = "";

    const totalVotes = votes.reduce((sum, v) => sum + v, 0);

    if (!votes.length || maxVotes === 0 && totalVotes === 0) {
      pollResults = "NOBODY voted. . . LOL";
    } else {
      maxVotes = Math.max(...votes);
      winners = votes.map((v, i) => (v === maxVotes ? i : -1)).filter(i => i !== -1);

      if (winners.length === votes.length) {
        pollResults = "It's a TIE. GG";
      } else {
        winnerArray = winners
          .map(i => (currentPollChoices[i]?.text || "").replace(/[^a-zA-Z0-9 ]/g, "").trim())
          .filter(Boolean);

        voteCount = votes[winners[0]];
        winnerPercent = totalVotes > 0
          ? parseFloat(((voteCount / totalVotes) * 100).toFixed(1))
          : 0;

        const winnerTextFormatted = winnerArray.length > 1
          ? winnerArray.slice(0, -1).join(", ") + " and " + winnerArray.slice(-1)
          : winnerArray[0] || "";

        const voteLabel = voteCount === 1 ? "vote" : "votes";
        pollResults = `${winnerTextFormatted} with ${voteCount} ${voteLabel} (${winnerPercent}%).`;
      }
    }

    let args = {
      pollTitle: currentPollTitle,
      pollDuration,
      choicesArray: JSON.stringify(currentPollChoices),
    };
    args = addChoicesToArgs(args, currentPollChoices);
    Object.assign(args, {
      winner: winnerArray.join(", "),
      numVotes: voteCount,
      percent: `${winnerPercent}%`,
      pollResults,
      totalVotes,
    });
    doAction(SB_ACTIONS.pollEnded, args);

    emit("PollEnded", { winners, maxVotes });

    return { winners, maxVotes, pollResults };
  }

  function endPoll() {
    clearInterval(countdownInterval);
    emit("timerTick", { time: "ended" });

    const hasVotes = votes.some(v => v > 0);

    if (!hasVotes) {
      resetPoll();
      return;
    }

    highlightWinner();
    emit("lockStartButton", { lock: true });

    const sessionAtEnd = pollSessionId;
    pollTimer = setTimeout(() => {
      if (sessionAtEnd !== pollSessionId) return; // a newer poll superseded this reset
      resetPoll();
      emit("lockStartButton", { lock: false });
    }, RESULTS_RESET_DELAY_MS);
  }

  function resetPoll() {
    isPollActive = false;
    clearTimeout(pollTimer);
    clearInterval(countdownInterval);
    votedUsers.clear();
    votes = [];

    emit("timerTick", { time: "ended" });
    emit("PollReset", { isActive: false });
  }

  function togglePoll() {
    emit("TogglePoll", {});
  }

  return {
    createPoll,
    onChatMessage,
    endPoll,
    resetPoll,
    togglePoll,
    get isPollActive() {
      return isPollActive;
    },
    get currentPollTitle() {
      return currentPollTitle;
    },
    get currentPollChoices() {
      return currentPollChoices;
    },
  };
}