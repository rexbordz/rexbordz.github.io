/* Site-wide docs config. Every widget's docs page reads this — change it here, not per widget. */
window.DOCS_SITE = {
  brand: 'rexbordz',
  logo: '../../.shared/assets/images/rexbordz-blue-and-white-gradient-logo.png',

  // `soon: true` renders the label with a "Coming Soon" tooltip and no link.
  nav: [
    { label: 'Widgets', soon: true },
    { label: 'Docs', href: '#', active: true },
    { label: 'Commissions', soon: true },
  ],

  links: [
    { label: 'GitHub', href: 'https://github.com/rexbordz', icon: 'github' },
    { label: 'Patreon', href: 'https://www.patreon.com/rexbordz', icon: 'patreon' },
  ],

  // Powers the "Need help?" button in the header. Leave null to hide the button.
  discord: 'https://discord.gg/cgufFBJKY7',

  //   repo: 'rexbordz/rexbordz.github.io', branch: 'main'
  // "Edit on GitHub" is hidden entirely while repo is null.
  repo: 'rexbordz/rexbordz.github.io',
  branch: 'main',
};
