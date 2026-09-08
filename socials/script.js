/* Renders the page from links.js and keeps the Twitch pill honest.
   Nothing here needs editing to change links — that all lives in links.js. */
(function () {
  'use strict';

  var CFG = window.SOCIALS;
  var ICONS = window.SOCIAL_ICONS || {};
  var page = document.getElementById('page');

  function icon(key, cls) {
    var d = ICONS[key];
    if (!d) return '';
    return '<svg class="' + cls + '" viewBox="0 0 24 24" aria-hidden="true"><path d="' + d + '"/></svg>';
  }

  function tile(link) {
    var cls = 'tile' + (link.hero ? ' hero-tile' : '') + (link.wide ? ' wide' : '');
    // Rendered hidden — only a positive live check reveals it.
    var pill = link.liveOn ? '<span class="live-dot" data-live="' + link.liveOn + '" hidden><i></i>LIVE</span>' : '';
    var body = link.hero
      ? icon(link.icon, 'ghost') + icon(link.icon, 'mark') +
        '<span class="stack"><span class="nm">' + link.name + '</span><span class="hd">' + link.handle + '</span></span>' + pill
      : icon(link.icon, 'ghost') + pill + icon(link.icon, 'mark') +
        '<span class="nm">' + link.name + '</span><span class="hd">' + link.handle + '</span>';

    return '<a class="' + cls + '" href="' + link.url + '" target="_blank" rel="noopener noreferrer"' +
           ' style="--brand:' + link.brand + '">' + body + '</a>';
  }

  function render() {
    var p = CFG.profile;
    var count = CFG.sections.reduce(function (n, s) { return n + s.links.length; }, 0);

    var html =
      '<header class="hero">' +
        '<div class="ring"><img src="' + p.avatar + '" alt="' + p.name + ' logo" width="84" height="84"></div>' +
        '<h1>' + p.name + '</h1>' +
        '<p class="tagline">' + p.tagline + '</p>' +
        '<div class="chips">' +
          '<span class="chip live" id="liveChip" hidden><i></i><span id="liveText">Live on Twitch</span></span>' +
          '<span class="chip">' + count + ' links</span>' +
        '</div>' +
      '</header>';

    CFG.sections.forEach(function (s) {
      html += '<div class="rule">' + s.title + '</div>' +
              '<div class="grid" style="--cols:' + (s.columns || 3) + '">' +
                s.links.map(tile).join('') +
              '</div>';
    });

    html += '<footer class="foot"><span>&copy; ' + p.name + '</span>' +
      (CFG.footer || []).map(function (f) {
        return '<span class="dot">&middot;</span><a href="' + f.url + '">' + f.label + '</a>';
      }).join('') +
      '</footer>';

    page.innerHTML = html;
  }

  /* The glow follows the pointer, one write per frame. Skipped on touch. */
  function trackPointer() {
    if (!matchMedia('(hover: hover)').matches) return;
    var raf = 0, x = 0, y = 0;
    addEventListener('pointermove', function (e) {
      x = e.clientX; y = e.clientY;
      document.body.classList.add('is-near');
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = 0;
        document.body.style.setProperty('--mx', x + 'px');
        document.body.style.setProperty('--my', y + 'px');
      });
    });
    addEventListener('pointerleave', function () { document.body.classList.remove('is-near'); });
  }

  /* DecAPI returns an uptime string when live, "<channel> is offline" when not.
     Offline is the default state, so a failed request leaves the page as-is
     rather than claiming a stream that isn't running. */
  function checkTwitch() {
    var cfg = CFG.live;
    if (!cfg || !cfg.twitchChannel) return;

    var chip = document.getElementById('liveChip');
    var text = document.getElementById('liveText');
    var pills = document.querySelectorAll('.live-dot[data-live="twitch"]');

    function show(on, uptime) {
      if (chip) chip.hidden = !on;
      if (on && text && uptime) text.textContent = 'Live · ' + uptime;
      pills.forEach(function (el) { el.hidden = !on; });
    }

    function poll() {
      fetch(cfg.endpoint + cfg.twitchChannel, { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.text() : Promise.reject(r.status); })
        .then(function (t) {
          t = t.trim();
          var live = t && !/offline|error|unable/i.test(t);
          show(live, t);
        })
        .catch(function () { show(false); });
    }

    poll();
    var mins = cfg.refreshMinutes || 2;
    setInterval(poll, mins * 60 * 1000);
  }

  render();
  trackPointer();
  checkTwitch();
})();
