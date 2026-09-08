/* Everything editable about the socials page lives here.
   Add, remove or reorder links and the page rebuilds itself — no HTML to touch.

   Each link:
     icon    key from icons.js ('twitch', 'youtube', 'kofi', ...)
     brand   colour on hover; use a token from .shared/css/global.css or any hex
     name    the label
     handle  the short URL shown under the label
     url     where it actually goes
     hero    optional — full-width row, bigger mark (one per section at most)
     wide    optional — spans two columns so a row doesn't end short
     liveOn  optional — 'twitch' adds a LIVE pill while the stream is up
*/
window.SOCIALS = {

  profile: {
    name: 'rexbordz',
    avatar: '../.shared/assets/images/circle-logo.png',
    tagline: 'Streamer and widget developer. I build tools and overlays for Streamer.bot.',
  },

  // Live check for the Twitch tile. Set to null to switch it off entirely.
  // Offline is always the default: the pill only appears on a positive response.
  live: {
    twitchChannel: 'rexbordz',
    endpoint: 'https://decapi.me/twitch/uptime/',
    refreshMinutes: 2,
  },

  footer: [
    { label: 'Widget docs', url: '../' },
  ],

  sections: [
    {
      title: 'Socials',
      columns: 3,
      links: [
        { icon: 'twitch',  brand: 'var(--twitch)',  name: 'Twitch',             handle: 'twitch.tv/rexbordz',          url: 'https://twitch.tv/rexbordz', hero: true, liveOn: 'twitch' },
        { icon: 'youtube', brand: 'var(--youtube)', name: 'Gaming Channel',     handle: 'youtube.com/@rexbordz',       url: 'https://youtube.com/@rexbordz' },
        { icon: 'youtube', brand: 'var(--youtube)', name: 'Tech &amp; Tutorials', handle: 'youtube.com/@rexbordz_codes', url: 'https://youtube.com/@rexbordz_codes' },
        { icon: 'kick',    brand: 'var(--kick)',    name: 'Kick',               handle: 'kick.com/rexbordz',           url: 'https://kick.com/rexbordz' },
        { icon: 'tiktok',  brand: 'var(--tiktok)',  name: 'TikTok',             handle: 'tiktok.com/@rexbordz',        url: 'https://www.tiktok.com/@rexbordz' },
        { icon: 'x',       brand: 'var(--x)',       name: 'X',                  handle: 'x.com/rexbordz',              url: 'https://www.x.com/rexbordz/', wide: true },
      ],
    },
    {
      title: 'Community',
      columns: 2,
      links: [
        { icon: 'discord', brand: 'var(--discord)', name: 'My Discord',                  handle: 'discord.gg/pJWEPzbdfa', url: 'https://discord.gg/pJWEPzbdfa' },
        { icon: 'discord', brand: 'var(--discord)', name: 'Streamer Community Discord',  handle: 'discord.gg/cgufFBJKY7', url: 'https://discord.gg/cgufFBJKY7' },
      ],
    },
    {
      title: 'Support',
      columns: 3,
      links: [
        { icon: 'patreon', brand: 'var(--patreon)', name: 'Patreon', handle: 'patreon.com/rexbordz', url: 'https://www.patreon.com/rexbordz/' },
        { icon: 'kofi',    brand: 'var(--kofi)',    name: 'Ko-fi',   handle: 'ko-fi.com/rexbordz',   url: 'https://ko-fi.com/rexbordz/' },
        { icon: 'github',  brand: 'var(--github)',  name: 'GitHub',  handle: 'github.com/rexbordz',  url: 'https://github.com/rexbordz' },
      ],
    },
  ],
};
