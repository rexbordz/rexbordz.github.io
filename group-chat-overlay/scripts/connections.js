// Settings configuration
const urlParams = new URLSearchParams(window.location.search);
const sbAddress = urlParams.get("address") || "127.0.0.1";
const sbPort = urlParams.get("port") || "8080";
const sbPassword = urlParams.get("password");

// Global variables
const WIDGET_TITLE = "GC Multichat";
const kickPusherWsUrl = 'wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679?protocol=7&client=js&version=7.6.0&flash=false';
let streamerbotConnected = false;
let tikfinityConnected = false;
let kickUsername = null;
let kickSubBadges = null;
let kick7TVEmotes = new Map();   // name -> url, read by onKickChatMessage
let notifications = document.querySelector('.notifications');
const kickPusher = createEmitter();
const tikfinityWs = createEmitter();

// =============================
// Streamer.bot Setup
// =============================
const client = new StreamerbotClient({
  host: sbAddress,
  port: sbPort,
  password: sbPassword,

  onConnect: (data) => {
    if (!streamerbotConnected){
      streamerbotConnected = true;
      console.log(`✅ Streamer.bot connected to ${sbAddress}:${sbPort}`)
      console.debug(data);
      createToast('success', 'fa-solid fa-circle-check', WIDGET_TITLE, 'Connected to Streamer.bot', 'streamerbot');
    }
    connectKickPusher();
  },

  onDisconnect: () => {
    if (streamerbotConnected) {
      streamerbotConnected = false;
      console.warn("❌ Streamer.bot disconnected");
      createToast('warning', 'fa-solid fa-triangle-exclamation', WIDGET_TITLE, 'Disconnected from Streamer.bot', 'streamerbot');
    }
  }
});

/* -------------------------------------------------- Streamer.bot handlers -- */

client.on("Twitch.ChatMessage", ({ data }) => {
    console.debug('📢 New Twitch Chat:', data);
    onTwitchChatMessage(data);
});

client.on("Twitch.Announcement", ({ data }) => {
    console.debug('📢 New Twitch Announcement:', data);
    onTwitchAnnouncement(data);
});

client.on("Twitch.ChatMessageDeleted", ({ event, data }) => {
    console.debug('📢 Twitch Chat Message Deleted:', event, data);
    onTwitchChatMessageDeleted(event, data);
});

client.on("Twitch.UserTimedOut", ({ event, data }) => {
    console.debug('📢 Twitch User Timed Out:', event, data);
    onTwitchUserTimedOut(event, data);
});

client.on("Twitch.UserBanned", ({ event, data }) => {
    console.debug('📢 Twitch User Banned:', event, data);
    onTwitchUserBanned(event, data);
});

client.on("Kick.UserTimedOut", ({ event, data }) => {
    console.debug('📢 Kick User Timed Out:', event, data);
    onKickUserTimedOut(event, data);
});

client.on("Kick.UserBanned", ({ event, data }) => {
    console.debug('📢 Kick User Banned:', event, data);
    onKickUserBanned(event, data);
});

client.on("YouTube.Message", ({ data }) => {
    console.debug('📢 New YouTube Chat:', data);
    onYouTubeChatMessage(data);
});

client.on("YouTube.UserTimedOut", ({ event, data }) => {
    console.debug('📢 YouTube User Timed Out:', event, data);
    onYouTubeUserTimedOut(event, data);
});

client.on("YouTube.UserBanned", ({ event, data }) => {
    console.debug('📢 YouTube User Banned:', event, data);
    onYouTubeUserBanned(event, data);
});

/* --------------------------------------------------- Kick Pusher handlers -- */

kickPusher.on("ChatMessageEvent", ({ data }) => {
    console.debug('📢 New Kick Chat:', data);
    onKickChatMessage(data);
});

kickPusher.on("MessageDeletedEvent", ({ data }) => {
    console.debug('📢 Kick Message Deleted:', data);
    onKickMessageDeleted(data);
});

/* ----------------------------------------------------- TikFinity handlers -- */

tikfinityWs.on("chat", ({ data }) => {
    console.debug('📢 New TikTok Chat:', data);
    onTikTokChatMessage(data);
});

document.addEventListener("DOMContentLoaded", connectTikfinity);

// ======================
// Connect to Kick Pusher
// ======================
async function connectKickPusher() {

  // Get username from Streamer.bot
  const broadcasterInfo = await client.getBroadcaster();

  if (broadcasterInfo.platforms.kick)
    kickUsername = broadcasterInfo.platforms.kick.broadcasterLogin;
  else
    return;

	const kickIds = await Kick.getChannelIds(kickUsername);
	const chatroomId = kickIds.chatroomId;
	const channelId = kickIds.channelId;

	// Cache subscriber badges and the channel's 7TV emotes. Neither changes
	// mid-stream, and both are needed to render every incoming message.
	[kickSubBadges, kick7TVEmotes] = await Promise.all([
		Kick.getSubBadges(kickUsername),
		Kick.get7TVEmotes(kickIds.userId)
	]);

	const websocket = new WebSocket(kickPusherWsUrl);

	// Reconnect
	websocket.onclose = function () {
		console.log("❌ Disconnected from Kick Pusher");
		setTimeout(connectKickPusher, 5000);
	};

	websocket.onopen = function () {
		console.log(`✅ Kick Pusher successfully connected to ${kickUsername}`);
	}

	websocket.onmessage = function (response) {
		try {
			let data = JSON.parse(response.data);

			// console.debug(data);

			// When connection is established, subscribe to a channel
			if (data.event === 'pusher:connection_established') {
				const socketData = JSON.parse(data.data);
				console.log(`[Pusher] Socket established with ID: ${socketData.socket_id}`);

				// Now subscribe to a channel
				websocket.send(JSON.stringify({ event: 'pusher:subscribe', data: { channel: `chatroom_${chatroomId}` } }));
				websocket.send(JSON.stringify({ event: 'pusher:subscribe', data: { channel: `chatrooms.${chatroomId}` } }));
				websocket.send(JSON.stringify({ event: 'pusher:subscribe', data: { channel: `chatrooms.${chatroomId}.v2` } }));
				websocket.send(JSON.stringify({ event: 'pusher:subscribe', data: { channel: `predictions-channel-${chatroomId}` } }));
				websocket.send(JSON.stringify({ event: 'pusher:subscribe', data: { channel: `channel_${channelId}` } }));
				console.log(`[Pusher] Sent subscription request to channel: ${chatroomId}`);
			}

			// Event handlers
			const args = JSON.parse(data.data);
			const event = data.event.split('\\').pop();

			kickPusher.emit(event, args);
		}
		catch (error) {
			console.error("Failed to process Kick pusher event:", error);
		}
	}
}

// =============================
// Tikfinity Setup
// =============================
function connectTikfinity() {
  const socket = new WebSocket("ws://localhost:21213");

  socket.onopen = () => {
    if (!tikfinityConnected) {
      tikfinityConnected = true;
      console.log("✅ Connected to TikFinity");
      createToast('success', 'fa-solid fa-circle-check', WIDGET_TITLE, 'Connected to Tikfinity', 'tikfinity');
    }
  };

  socket.onclose = () => {
    if (tikfinityConnected) {
      tikfinityConnected = false;
      console.warn("❌ Disconnected from TikFinity");
      createToast('warning', 'fa-solid fa-triangle-exclamation', WIDGET_TITLE, 'Disconnected from Tikfinity', 'tikfinity');
    }
    setTimeout(connectTikfinity, 3000);
  };

  socket.onerror = (err) => {
    console.error("TikFinity WebSocket error:", err);
  };

  socket.onmessage = (event) => {
    try {
      const response = JSON.parse(event.data);
      tikfinityWs.emit(response.event, response.data);
    } catch (err) {
      console.error("Failed to process TikFinity event:", err);
    }
  };
}

// Toast notifications for connections
function createToast(type, icon, title, text, source){
    let newToast = document.createElement('div');
    let logo;
    if (source === "streamerbot") {
        logo = 'assets/images/streamerbot-logo.svg';
    } else if (source === "tikfinity") {
        logo = "assets/images/tikfinity-logo.png";
    }

    newToast.innerHTML = `
        <div class="toast ${type}">
            <i class="${icon}"></i>
            <div class="content">
                <div class="title">${title}</div>
                <span>${text}</span>
            </div>
            <img class="toast-logo" src="${logo}" alt="${source} logo">
        </div>`;
    notifications.appendChild(newToast);
    newToast.timeOut = setTimeout(
        ()=>newToast.remove(), 3000
    )
}

// Tiny pub/sub used by kickPusher and tikfinityWs
function createEmitter() {
  return {
    listeners: {},
    on(event, callback) {
      (this.listeners[event] ??= []).push(callback);
    },
    emit(event, data) {
      (this.listeners[event] || []).forEach(callback => callback({ event, data }));
    }
  };
}
