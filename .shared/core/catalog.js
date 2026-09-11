/* Every widget and tool on the site, declared once.
   This feeds the homepage cards, the Docs menu, the search index and each
   widget's own docs page — so adding a widget here is the whole job.

   Paths are relative to the site root; CHROME.root() resolves them.

     tier     'free' | 'freemium' | 'pro'   — 'pro' moves it to the Patreon shelf
     icon     an icones.js.org name, a full URL, or a local file
     thumb    optional; a generated placeholder shows until the file exists */
window.CATALOG = [
  {
    id: 'multi-poll',
    name: 'MultiPoll',
    eyebrow: 'TOOL',
    version: '1.0',
    tagline: 'Run one poll across every chat at once. Viewers vote by typing a number, results update live in OBS.',
    lede: 'Run a poll across all the platforms supported -- Twitch, YouTube, Kick and Tiktok. You start a poll using the dock provided in the tool and the poll is displayed on your OBS as an overlay. Your viewers just need to vote by typing the number in chat (e.g., 1-5).',
    tier: 'freemium',
    proHref: 'https://www.patreon.com/rexbordz/posts/multipoll-widget-166929219',
    platforms: ['twitch', 'youtube', 'kick', 'tiktok'],
    accent: '#3b82f6',
    icon: 'ph:chart-bar-bold',
    docsUrl: 'multi-poll/docs/',
    widgetUrl: 'multi-poll/',
    settingsUrl: 'multi-poll/settings/',
    thumb: 'multi-poll/assets/thumb.png',
  },
  {
    id: 'bubble-alerts',
    name: 'Bubble Alerts',
    eyebrow: 'ALERTS',
    version: '1.0',
    tagline: 'Android-inspired bubble alerts for follows, subs, cheers, gifts and raids — every event, one overlay.',
    lede: 'Android-inspired bubble alerts for follows, subs, cheers, gifts and raids across Twitch, YouTube, Kick & TikTok.',
    tier: 'free',
    platforms: ['twitch', 'youtube', 'kick', 'tiktok'],
    accent: '#a855f7',
    icon: 'ph:chat-circle-dots-bold',
    docsUrl: 'bubble-alerts/docs/',
    widgetUrl: 'bubble-alerts/',
    settingsUrl: 'bubble-alerts/settings/',
    thumb: 'bubble-alerts/assets/thumb.png',
  },
  {
    id: 'group-chat-overlay',
    name: 'Group Chat Overlay',
    eyebrow: 'OVERLAY',
    version: '1.0',
    tagline: 'Every chat merged into one group-chat overlay, with 7TV and native platform emotes rendered inline.',
    lede: "A multichat overlay that looks like Mark Zuckerberg's idea. Supports Twitch, YouTube, Kick & TikTok. Supports 7TV and native platform emotes as well.",
    tier: 'free',
    platforms: ['twitch', 'youtube', 'kick', 'tiktok'],
    accent: '#2f9e51',
    icon: 'ph:chats-circle-bold',
    docsUrl: 'group-chat-overlay/docs/',
    widgetUrl: 'group-chat-overlay/',
    settingsUrl: 'group-chat-overlay/settings/',
    thumb: 'group-chat-overlay/assets/thumb.png',
  },
];
