// The lookups below are handed over unresolved on purpose. Awaiting them here
// only ever waited on a url string — never the picture behind it — while giving
// two messages a chance to overtake each other on the way to the overlay.
// ChatOverlay.push queues them, waits on the images too, and renders in order.
function onTwitchChatMessage(data) {
    if (!ChatOverlay.settings.showTwitchChat) return;
    if (ChatOverlay.settings.excludeCommands && data.text.startsWith("!")) return;

    ChatOverlay.push({
        id: data.messageId,
        platform: "twitch",
        mine: data.user.id === data.broadcaster.id,
        text: data.text,
        html: Twitch.buildMessageHtml(data.parts),
        user: {
            id: data.user.id,
            name: data.user.name,
            color: data.user.color,
            avatar: Twitch.getAvatar(data.user.login),
            badges: data.user.badges.map(b => ({
                icon: b.imageUrl,
                label: b.name,
            })),
        },
        replyTo: data.isReply ? ({
            name: data.reply.userName,
            text: data.reply.msgBody,
        }) : null,
    });
}

const ANNOUNCEMENT_COLORS = {
    blue: "linear-gradient(#03d3d7, #8d49fe)",
    green: "linear-gradient(#01da86, #55bee4)",
    orange: "linear-gradient(#feb419, #e1df00)",
    purple: "linear-gradient(#9548ff, #fc74e6)",
};

function onTwitchAnnouncement(data) {
    if (!ChatOverlay.settings.showTwitchAnnounce) return;

    const bubbleColor = ANNOUNCEMENT_COLORS[data.announcementColor.toLowerCase()] || null;

    ChatOverlay.push({
        id: data.messageId,
        platform: "twitch",
        mine: data.user.id == data.broadcaster.id,
        text: "📢 " + data.text,
        html: "📢 " + Twitch.buildMessageHtml(data.parts),
        bubbleColor,
        user: {
            id: data.user.id,
            name: data.user.name,
            color: data.user.color,
            avatar: Twitch.getAvatar(data.user.login),
            badges: data.user.badges.map(b => ({
                icon: b.imageUrl,
                label: b.name,
            })),
        },
        replyTo: null,
    });
}

function onTwitchChatMessageDeleted(event, data) {
    ChatOverlay.deleteMessage(event.source.toLowerCase(), data.messageId);
}

function onTwitchUserTimedOut(event, data) {
    ChatOverlay.deleteUserMessages(event.source.toLowerCase(), data.targetUser.id);
}

function onTwitchUserBanned(event, data) {
    ChatOverlay.deleteUserMessages(event.source.toLowerCase(), data.targetUser.id);
}

function onKickChatMessage(data) {
    if (!ChatOverlay.settings.showKickChat) return;
    if (ChatOverlay.settings.excludeCommands && data.content.startsWith("!")) return;

    // Unlike Twitch, Kick's Pusher payload hands us no resolved images at all —
    // badges arrive as bare types and emotes as [emote:id:name] markers, so both
    // are resolved here against what was cached when the socket connected.
    const identity = data.sender.identity || {};

    ChatOverlay.push({
        id: data.id,
        platform: "kick",
        mine: (identity.badges || []).some(b => b.type === "broadcaster"),
        text: data.content,
        html: Kick.buildMessageHtml(data.content, kick7TVEmotes),
        user: {
            // Kick sends a numeric id; the renderer lowercases it to match the
            // bot list, so hand it a string.
            id: String(data.sender.id),
            name: data.sender.username,
            color: identity.color,
            avatar: Kick.getAvatar(data.sender.slug),
            badges: Kick.getBadges(identity, { subBadges: kickSubBadges }),
        },
        replyTo: data.type === "reply" ? ({
            name: data.metadata.original_sender.username,
            text: data.metadata.original_message.content,
            html: Kick.buildMessageHtml(data.metadata.original_message.content, kick7TVEmotes),
        }) : null,
    });
}

function onKickMessageDeleted(data) {
    ChatOverlay.deleteMessage('kick', data.message.id);
}

function onKickUserTimedOut(event, data) {
    ChatOverlay.deleteUserMessages(event.source.toLowerCase(), data.user.id);
}

function onKickUserBanned(event, data) {
    ChatOverlay.deleteUserMessages(event.source.toLowerCase(), data.user.id);
}

function onYouTubeChatMessage(data) {
    if (!ChatOverlay.settings.showYoutubeChat) return;
    if (ChatOverlay.settings.excludeCommands && data.message.startsWith("!")) return;

    ChatOverlay.push({
        platform: "youtube",
        platformIcon: ["vertical", "shorts"].some(t => data.broadcast.tags.includes(t)) ? "assets/images/youtube/logo-youtube-vertical.svg" : null,
        mine: data.user.isOwner,
        text: data.message,
        html: Utils.buildEmoteMessageHtml(data.message, data.emotes),
        user: {
            id: data.user.id,
            name: data.user.name,
            color: data.user.isOwner ? "#ffd600"
                : data.user.isModerator ? "#3ea6ff"
                : data.user.isSponsor ? "#2ba640"
                : null,
            avatar: data.user.profileImageUrl,
            badges: data.user.isModerator ? [{
                icon: "https://api.iconify.design/material-symbols:shield-rounded.svg?color=%233ea6ff",
                label: "MOD",
            }] : [],
        },
    });
}

function onYouTubeUserTimedOut(event, data) {
    ChatOverlay.deleteUserMessages(event.source.toLowerCase(), data.targetUser.id);
}

function onYouTubeUserBanned(event, data) {
    ChatOverlay.deleteUserMessages(event.source.toLowerCase(), data.targetUser.id);
}

function onTikTokChatMessage(data) {
    if (!ChatOverlay.settings.showTikTokChat) return;
    if (ChatOverlay.settings.excludeCommands && data.comment.startsWith("!")) return;

    ChatOverlay.push({
        id: data.msgId,
        platform: "tiktok",
        mine: data.uniqueId === data.tikfinityUsername,
        text: data.comment,
        html: TikTok.buildMessageHtml(data.comment, data.emotes),
        user: {
            id: data.userId,
            name: data.nickname,
            color: "#1fd2e8" ,
            avatar: data.profilePictureUrl,
            badges: TikTok.createBadges(data, { fansClubName: ChatOverlay.settings.fansClubName }),
        },
    });
}

