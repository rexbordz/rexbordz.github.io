/* Site-wide chrome config. Every page reads this — change it here, not per page.
   Paths are relative to the site root; CHROME.root() resolves them, so nothing
   here is tied to how deep the page lives. */
window.SITE = {
  brand: 'rexbordz',
  logo: '.shared/assets/images/rexbordz-blue-and-white-gradient-logo.png',

  // `soon: true` renders the label with a "Coming Soon" tooltip and no link.
  // `menu: 'catalog'` renders a dropdown built from catalog.js.
  // The lit tab is worked out from the URL, never set here.
  nav: [
    { label: 'Widgets', href: '#widgets' },
    { label: 'Docs', menu: 'catalog' },
    { label: 'Commissions', soon: true },
  ],

  links: [
    { label: 'GitHub', href: 'https://github.com/rexbordz', icon: 'github' },
    { label: 'Patreon', href: 'https://www.patreon.com/rexbordz', icon: 'patreon' },
  ],

  // Hero support buttons on the homepage. `icon` is a MARK key from chrome.js.
  support: [
    { label: 'Join Patreon', href: 'https://www.patreon.com/rexbordz/', icon: 'patreon', color: 'var(--patreon)' },
    { label: 'Ko-fi', href: 'https://ko-fi.com/rexbordz/', icon: 'kofi', color: 'var(--kofi)' },
  ],

  // Footer marks. YouTube is the tech channel — the gaming one is a different
  // audience and does not belong on a widget site.
  socials: [
    { label: 'Twitch', href: 'https://twitch.tv/rexbordz', icon: 'twitch' },
    { label: 'YouTube — Tech & Tutorials', href: 'https://youtube.com/@rexbordz_codes', icon: 'youtube' },
    { label: 'Kick', href: 'https://kick.com/rexbordz', icon: 'kick' },
    { label: 'TikTok', href: 'https://www.tiktok.com/@rexbordz', icon: 'tiktok' },
    { label: 'X', href: 'https://www.x.com/rexbordz/', icon: 'x' },
    { label: 'Discord', href: 'https://discord.gg/cgufFBJKY7', icon: 'discord' },
    { label: 'GitHub', href: 'https://github.com/rexbordz', icon: 'github' },
  ],

  // Powers the "Need help?" button in the header. Leave null to hide the button.
  discord: 'https://discord.gg/cgufFBJKY7',

  // "Edit on GitHub" is hidden entirely while repo is null.
  repo: 'rexbordz/rexbordz.github.io',
  branch: 'main',
};
