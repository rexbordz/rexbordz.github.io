/* Docs core: fetch a widget's README.md, render it, and build the page around it.
   Per-widget config comes from the #docsBoot JSON block in the shim. */
(function () {
  'use strict';

  var site = window.DOCS_SITE || {};
  var boot = JSON.parse(document.getElementById('docsBoot').textContent);

  var ICON = {
    github: 'M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22',
    heart: 'M12 21s-7.5-4.6-9.6-9A5.4 5.4 0 0 1 12 6.5 5.4 5.4 0 0 1 21.6 12c-2.1 4.4-9.6 9-9.6 9z',
    search: 'M21 21l-4.3-4.3',
    link: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
    copy: 'M5 15V5a2 2 0 0 1 2-2h10',
    pencil: 'M11 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-6M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z',
    list: 'M4 7h10M4 12h16M4 17h7',
    close: 'M6 6l12 12M18 6L6 18'
  };

  // Filled marks, drawn rather than stroked.
  var MARK = {
    patreon: '<path d="M7.462 3.1c2.615-1.268 6.226-1.446 9.063-.503c2.568.853 4.471 3.175 4.475 5.81c.004 3.061-1.942 5.492-4.896 6.243c-1.693.43-2.338.75-2.942 1.582c-.238.328-.45.745-.796 1.533l-.22.5C11 20.866 9.99 22.027 7.91 22c-2.232-.03-3.603-1.742-4.313-4.48c-.458-1.768-.617-3.808-.594-5.876c.044-3.993 1.42-7.072 4.46-8.545z"></path>',
    discord: '<path d="M19.9 5.2A17.3 17.3 0 0 0 15.6 3.9l-.2.4a16 16 0 0 1 3.8 1.2 15.4 15.4 0 0 0-13 0 16 16 0 0 1 3.8-1.2l-.2-.4A17.3 17.3 0 0 0 5.5 5.2C2.8 9.3 2 13.3 2.4 17.2A17.4 17.4 0 0 0 7.7 19.8l1-1.7a11.3 11.3 0 0 1-1.8-.8l.4-.4a12.5 12.5 0 0 0 10.6 0l.4.4a11.3 11.3 0 0 1-1.8.8l1 1.7a17.4 17.4 0 0 0 5.3-2.6c.5-4.6-.7-8.6-3-12zM9 14.7c-1 0-1.9-.9-1.9-2.1S8 10.5 9 10.5s1.9.9 1.9 2.1-.8 2.1-1.9 2.1zm5 0c-1 0-1.9-.9-1.9-2.1s.9-2.1 1.9-2.1 1.9.9 1.9 2.1-.8 2.1-1.9 2.1z"></path>'
  };

  function mark(name, opts) {
    opts = opts || {};
    var size = opts.size || 18;
    return '<svg class="' + (opts.cls || '') + '" width="' + size + '" height="' + size + '" ' +
      'viewBox="0 0 24 24" fill="' + (opts.fill || 'currentColor') + '" stroke="none">' + MARK[name] + '</svg>';
  }

  var ALERT = {
    NOTE: { cls: 'note', stroke: '#3b82f6', path: 'M12 11v5M12 8h.01', circle: true },
    TIP: { cls: 'tip', stroke: '#2f9e51', path: 'M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z' },
    IMPORTANT: { cls: 'important', stroke: '#ddc54a', path: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 8v5M12 16h.01' },
    WARNING: { cls: 'warning', stroke: '#ef4444', path: 'M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01' },
    CAUTION: { cls: 'caution', stroke: '#ef4444', path: 'M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01' }
  };

  var PLATFORM = {
    twitch: ['Twitch', '#9146ff'],
    youtube: ['YouTube', '#ff0033'],
    tiktok: ['TikTok', '#25f4ee'],
    kick: ['Kick', '#53fc18']
  };

  function svg(path, opts) {
    opts = opts || {};
    var size = opts.size || 16;
    var extra = opts.circle ? '<circle cx="12" cy="12" r="9"></circle>' : '';
    return '<svg class="' + (opts.cls || '') + '" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" ' +
      'fill="none" stroke="' + (opts.stroke || '#8b8b8b') + '" stroke-width="' + (opts.width || 1.8) + '" ' +
      'stroke-linecap="round" stroke-linejoin="round">' + extra + '<path d="' + path + '"></path></svg>';
  }

  function el(html) {
    var t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ── chrome ─────────────────────────────────────────── */

  function buildHeader() {
    var nav = (site.nav || []).map(function (n) {
      if (n.soon) {
        return '<span class="nav-link is-soon" data-tooltip="Coming Soon">' + esc(n.label) + '</span>';
      }
      return '<a class="nav-link' + (n.active ? ' is-active' : '') + '" href="' + esc(n.href) + '">' +
        esc(n.label) + '</a>';
    }).join('');

    var links = (site.links || []).map(function (l) {
      var glyph = MARK[l.icon]
        ? mark(l.icon, { size: 18, cls: "hdr-icon is-filled" })
        : svg(ICON[l.icon] || ICON.link, { size: 19, cls: "hdr-icon", width: 2.2 });
      return '<a href="' + esc(l.href) + '" target="_blank" rel="noopener" aria-label="' +
        esc(l.label) + '" data-tooltip="' + esc(l.label) + '">' + glyph + '</a>';
    }).join('');

    var help = site.discord
      ? '<div class="help-wrap">' +
          '<button class="help-pill" type="button">' + mark("discord", { size: 16, fill: "#fff" }) +
            '<span>Need help?</span></button>' +
          '<div class="help-pop">' +
            '<h4>Stuck on something?</h4>' +
            '<p>Open a thread in the support channels on my Discord. ' +
            'Include the widget name and what you have tried so far.</p>' +
            '<a class="help-cta" href="' + esc(site.discord) + '" target="_blank" rel="noopener">' +
              mark("discord", { size: 16, fill: "#fff" }) + 'Join the Discord</a>' +
          '</div>' +
        '</div>'
      : '';

    return el(
      '<header class="site-header">' +
        '<div class="brand">' +
          '<img src="' + esc(site.logo || '') + '" alt="">' +
          '<span>' + esc(site.brand || '') + '</span>' +
        '</div>' +
        '<nav class="site-nav">' + nav + '<span class="nav-bar"></span></nav>' +
        '<div class="header-spacer"></div>' +
        '<div class="header-actions">' + links +
          '<div class="header-divider"></div>' +
          '<button class="search-pill" type="button">' +
            svg("M21 21l-4.3-4.3", { size: 14, stroke: "#fff", width: 2 })
              .replace("<path", '<circle cx="11" cy="11" r="7"></circle><path') +
            '<span class="search-text">Search</span><kbd>/</kbd>' +
          '</button>' + help +
        '</div>' +
      '</header>'
    );
  }

  function buildHero() {
    var chips = (boot.platforms || []).map(function (p) {
      var m = PLATFORM[p];
      if (!m) return '';
      return '<span class="chip"><span class="dot" style="background:' + m[1] + '"></span>' + m[0] + '</span>';
    }).join('');

    var crumbs = (boot.breadcrumb || ['Docs']).map(function (c, i, a) {
      var last = i === a.length - 1;
      return (last ? '<span class="here">' + esc(c) + '</span>' : '<span>' + esc(c) + '</span>');
    }).join('<span>/</span>');

    var widgetUrl = new URL(boot.widgetUrl || '../', location.href).href;

    return el(
      '<div>' +
        '<div class="breadcrumb">' + crumbs + '</div>' +
        '<div class="eyebrow-row">' +
          (boot.eyebrow ? '<span class="eyebrow">' + esc(boot.eyebrow) + '</span>' : '') +
          (boot.version ? '<span class="version-pill">v' + esc(boot.version) + '</span>' : '') +
        '</div>' +
        '<h1 class="doc-title">' + esc(boot.title || '') + '</h1>' +
        (boot.lede ? '<p class="doc-lede">' + esc(boot.lede) + '</p>' : '') +
        (chips || boot.updated ? '<div class="meta-row">' + chips +
          (boot.updated ? '<span class="updated">Updated ' + esc(boot.updated) + '</span>' : '') + '</div>' : '') +
        '<div class="install-card">' +
          '<div class="install-label">' + svg(ICON.link, { size: 15, stroke: '#7fa6e6' }) + 'Browser source URL</div>' +
          '<div class="install-row">' +
            '<div class="install-url">' + esc(widgetUrl) + '</div>' +
            '<button class="install-copy" type="button" data-url="' + esc(widgetUrl) + '">' +
              svg(ICON.copy, { size: 15, stroke: '#fff' }).replace('<path', '<rect x="9" y="9" width="12" height="12" rx="2"></rect><path') +
              '<span>Copy</span></button>' +
          '</div>' +
          (boot.settingsUrl ? '<div class="install-links" id="configure-widget">' + svg(ICON.link, { size: 14, stroke: '#7fa6e6' }) +
            '<a href="' + esc(boot.settingsUrl) + '">Configure this widget in the settings editor</a></div>' : '') +
        '</div>' +
      '</div>'
    );
  }

  function buildFooter() {
    var cards = '';
    if (boot.prev) {
      cards += '<a class="foot-card prev" href="' + esc(boot.prev.href) + '">' +
        '<div class="foot-dir">← PREVIOUS</div><div class="foot-label">' + esc(boot.prev.label) + '</div></a>';
    }
    if (boot.next) {
      cards += '<a class="foot-card next" href="' + esc(boot.next.href) + '">' +
        '<div class="foot-dir">NEXT →</div><div class="foot-label">' + esc(boot.next.label) + '</div></a>';
    }

    var edit = '';
    if (site.repo) {
      // Repo-relative path. Assumes a user/org page, where the site root is the repo root.
      var path = new URL(boot.source, location.href).pathname.replace(/^\//, '');
      var href = 'https://github.com/' + site.repo + '/edit/' + (site.branch || 'main') + '/' + path;
      edit = '<div class="edit-link">' + svg(ICON.pencil, { size: 14, stroke: '#5c5c5c' }) +
        '<a href="' + esc(href) + '" target="_blank" rel="noopener">Edit this page on GitHub</a></div>';
    }

    return el('<div>' + (cards ? '<div class="doc-footer">' + cards + '</div>' : '') + edit + '</div>');
  }

  /* ── markdown post-processing ───────────────────────── */

  // "> [!NOTE]" blockquotes become callouts. GitHub renders these natively too.
  function upgradeAlerts(root) {
    root.querySelectorAll('blockquote').forEach(function (q) {
      var first = q.querySelector('p');
      if (!first) return;
      var m = first.innerHTML.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(<br\s*\/?>|\n)?/i);
      if (!m) return;

      var kind = m[1].toUpperCase();
      var spec = ALERT[kind];
      first.innerHTML = first.innerHTML.slice(m[0].length);
      if (!first.textContent.trim() && !first.querySelector('*')) first.remove();

      var box = el(
        '<div class="callout callout-' + spec.cls + '">' +
          svg(spec.path, { size: 18, stroke: spec.stroke, width: 1.9, circle: spec.circle }) +
          '<div><div class="callout-title">' + kind.charAt(0) + kind.slice(1).toLowerCase() + '</div>' +
          '<div class="callout-body"></div></div>' +
        '</div>'
      );
      var body = box.querySelector('.callout-body');
      while (q.firstChild) body.appendChild(q.firstChild);
      q.replaceWith(box);
    });
  }

  // Headings get an id and a hover anchor; "### 1. Foo" gets a numbered badge.
  function upgradeHeadings(root) {
    var seen = {};
    root.querySelectorAll('h2, h3').forEach(function (h) {
      var step = h.tagName === 'H3' && h.textContent.match(/^\s*(\d+)\.\s+/);
      if (step) {
        h.classList.add('step');
        h.innerHTML = h.innerHTML.replace(/^\s*\d+\.\s+/, '');
        h.insertBefore(el('<span class="step-num">' + step[1] + '</span>'), h.firstChild);

        // Markdown can't nest under a heading, so pull the step's content into a
        // wrapper that lines up with the heading text rather than the badge.
        var body = el('<div class="step-body"></div>');
        var n = h.nextElementSibling;
        while (n && !/^H[23]$/.test(n.tagName)) {
          var after = n.nextElementSibling;
          body.appendChild(n);
          n = after;
        }
        h.after(body);
      }

      var slug = h.textContent.toLowerCase().trim()
        .replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
      if (seen[slug]) slug += '-' + (++seen[slug]); else seen[slug] = 1;
      h.id = slug;

      h.appendChild(el('<a class="anchor" href="#' + slug + '" aria-label="Link to this section">#</a>'));
    });
  }

  function upgradeCode(root) {
    root.querySelectorAll('pre > code').forEach(function (code) {
      var pre = code.parentElement;
      var lang = (code.className.match(/language-(\S+)/) || [, 'text'])[1];

      var fig = el(
        '<figure class="code-figure">' +
          '<div class="code-head"><span>' + esc(lang) + '</span>' +
            '<button class="code-copy" type="button">' +
              svg(ICON.copy, { size: 13, stroke: '#5c5c5c' }).replace('<path', '<rect x="9" y="9" width="12" height="12" rx="2"></rect><path') +
              '<span>Copy</span></button>' +
          '</div>' +
        '</figure>'
      );
      pre.replaceWith(fig);
      fig.appendChild(pre);

      fig.querySelector('.code-copy').addEventListener('click', function () {
        copy(code.textContent, this);
      });
    });
  }

  function upgradeTables(root) {
    root.querySelectorAll('table').forEach(function (t) {
      var wrap = el('<div class="table-wrap"></div>');
      t.replaceWith(wrap);
      wrap.appendChild(t);
    });
  }

  // Relative paths in the markdown are relative to the .md file, not to this page,
  // so "docs/assets/x.png" resolves the same way here as it does on GitHub.
  function rebase(root, base) {
    root.querySelectorAll("img[src], a[href], source[src]").forEach(function (n) {
      var attr = n.tagName === "A" ? "href" : "src";
      var v = n.getAttribute(attr);
      if (!v) return;
      var c = v.charAt(0);
      if (c === "#" || c === "?" || c === "/") return;
      if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return;
      n.setAttribute(attr, new URL(v, base).href);
    });
  }

  // Links leave the page, so they open in a new tab; in-page anchors stay put.
  function externalize(root) {
    root.querySelectorAll('a[href]').forEach(function (a) {
      if (a.getAttribute('href').charAt(0) === '#') return;
      a.target = '_blank';
      a.rel = 'noopener';
    });
  }

  function lightbox(root) {
    var box = el('<div class="lightbox"><button class="lightbox-close" type="button" aria-label="Close">' +
      svg(ICON.close, { size: 20, stroke: '#d4d4d4', width: 2 }) + '</button><img alt=""></div>');
    document.body.appendChild(box);

    var full = box.querySelector('img');
    var close = function () { box.classList.remove('is-open'); };

    root.querySelectorAll('img').forEach(function (im) {
      // A linked image follows its link instead of zooming.
      if (im.closest('a')) return;
      im.addEventListener('click', function () {
        full.src = im.currentSrc || im.src;
        full.alt = im.alt || '';
        box.classList.add('is-open');
      });
    });

    box.addEventListener('click', function (e) { if (e.target !== full) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  }

  function copy(text, btn) {
    navigator.clipboard.writeText(text).then(function () {
      var label = btn.querySelector('span');
      var was = label.textContent;
      label.textContent = 'Copied';
      btn.classList.add('is-done');
      setTimeout(function () {
        label.textContent = was;
        btn.classList.remove('is-done');
      }, 1600);
    });
  }

  /* ── heading rail ───────────────────────────────────── */

  function buildRail(root) {
    var heads = Array.prototype.slice.call(root.querySelectorAll('h2, h3'));
    if (heads.length < 2) return;

    var ticks = '', links = '';
    heads.forEach(function (h) {
      var lvl = h.tagName === 'H3' ? 3 : 2;

      // Read the label off a clone so the anchor and the step badge do not run
      // into the title as one word.
      var clone = h.cloneNode(true);
      var anchor = clone.querySelector('.anchor');
      if (anchor) anchor.remove();
      var num = clone.querySelector('.step-num');
      var prefix = '';
      if (num) { prefix = num.textContent.trim() + '. '; num.remove(); }
      var text = prefix + clone.textContent.trim();
      ticks += '<div class="rail-tick" data-for="' + h.id + '" data-base="' + (lvl === 2 ? 22 : 13) + '" ' +
        'style="width:' + (lvl === 2 ? 22 : 13) + 'px"></div>';
      links += '<a class="rail-link' + (lvl === 3 ? ' lvl3' : '') + '" data-for="' + h.id + '" href="#' + h.id + '">' + esc(text) + '</a>';
    });

    var rail = el(
      '<div class="rail"><div class="rail-inner">' +
        '<div class="rail-ticks">' + ticks + '</div>' +
        '<div class="rail-panel"><div class="rail-label">ON THIS PAGE</div>' + links + '</div>' +
      '</div></div>'
    );
    document.body.appendChild(rail);

    var toc = el(
      '<details class="toc-mobile"><summary>' + svg(ICON.list, { size: 16, stroke: '#7fa6e6', width: 1.9 }) +
      'On this page</summary><div class="toc-list">' + links + '</div></details>'
    );
    root.parentElement.insertBefore(toc, root);

    magnify(rail);
    spy(heads, rail);
  }

  // Ticks grow and warm toward the pointer, dock-style.
  function magnify(rail) {
    var ticks = Array.prototype.slice.call(rail.querySelectorAll('.rail-tick'));
    var REACH_Y = 96, REACH_X = 240, GROW = 15;
    var lastX = null, lastY = 0, queued = false;

    function paint(px, py) {
      lastX = px;
      lastY = py;
      var rr = rail.getBoundingClientRect();
      var near = px === null ? 0 : Math.max(0, 1 - Math.abs(px - rr.right) / REACH_X);

      ticks.forEach(function (t) {
        var base = Number(t.dataset.base) || 13;
        var r = t.getBoundingClientRect();
        var d = px === null ? Infinity : Math.abs(py - (r.top + r.height / 2));
        var lin = Math.max(0, 1 - d / REACH_Y);
        var e = lin * lin * (3 - 2 * lin) * near;
        var bonus = t.classList.contains('is-active') ? 4 : 0;

        t.style.width = (base + bonus + GROW * e) + 'px';
        t.style.transform = 'translateX(' + (-7 * e) + 'px)';
        if (!t.classList.contains('is-active')) {
          t.style.background = 'rgb(' + Math.round(61 + 66 * e) + ',' +
            Math.round(61 + 105 * e) + ',' + Math.round(61 + 169 * e) + ')';
        }
      });
    }

    document.addEventListener('pointermove', function (ev) {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; paint(ev.clientX, ev.clientY); });
    }, { passive: true });
    document.addEventListener('pointerleave', function () { paint(null, 0); });

    rail.repaint = function () { paint(lastX, lastY); };
    paint(null, 0);
  }

  // Last heading past the reading line wins.
  function spy(heads, rail) {
    var line = 110;
    var queued = false;

    function sync() {
      var current = heads[0];
      heads.forEach(function (h) {
        if (h.getBoundingClientRect().top <= line) current = h;
      });

      rail.querySelectorAll('.rail-tick').forEach(function (t) {
        var on = t.dataset.for === current.id;
        t.classList.toggle('is-active', on);
        if (!on) t.style.background = '';
      });
      document.querySelectorAll('.rail-link').forEach(function (a) {
        a.classList.toggle('is-active', a.dataset.for === current.id);
      });
      if (rail.repaint) rail.repaint();
    }

    window.addEventListener('scroll', function () {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; sync(); });
    }, { passive: true });
    sync();
  }

  // One bar for the whole nav; the leading edge moves faster, so it stretches between tabs.
  function slideNav(header) {
    var nav = header.querySelector('.site-nav');
    var bar = nav && nav.querySelector('.nav-bar');
    if (!nav || !bar) return;

    var links = Array.prototype.slice.call(nav.querySelectorAll('.nav-link'));
    var active = nav.querySelector('.nav-link.is-active') || links[0];
    if (!active) return;

    function move(target, animate) {
      var nr = nav.getBoundingClientRect();
      var r = target.getBoundingClientRect();
      var left = r.left - nr.left;
      var right = nr.right - r.right;
      var was = parseFloat(bar.style.left);
      var goingRight = !isNaN(was) && left > was;

      bar.style.transitionDuration = animate === false ? '0s' : (goingRight ? '0.42s, 0.26s' : '0.26s, 0.42s');
      bar.style.left = left + 'px';
      bar.style.right = right + 'px';
    }

    move(active, false);
    links.forEach(function (l) { l.addEventListener('pointerenter', function () { move(l); }); });
    nav.addEventListener('pointerleave', function () { move(active); });
    window.addEventListener('resize', function () { move(active, false); });
  }

  /* ── boot ───────────────────────────────────────────── */

  function fail(msg) {
    document.body.appendChild(el(
      '<div class="doc-wrap"><h1 class="doc-title">Couldn\'t load these docs</h1>' +
      '<p class="doc-lede">' + esc(msg) + '</p></div>'
    ));
  }

  var header = buildHeader();
  document.body.appendChild(header);
  slideNav(header);

  var wrap = el('<main class="doc-wrap"></main>');
  document.body.appendChild(wrap);
  wrap.appendChild(buildHero());

  var article = el('<article class="doc-body"></article>');
  wrap.appendChild(article);

  externalize(wrap);

  wrap.querySelector('.install-copy').addEventListener('click', function () {
    copy(this.dataset.url, this);
  });

  fetch(boot.source)
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    })
    .then(function (md) {
      // Drop a leading H1 — the hero already carries the title.
      md = md.replace(/^\s*#\s+.*\n+/, '');
      // Parsed inert so nothing loads before the paths are corrected.
      var parsed = new DOMParser().parseFromString(marked.parse(md), "text/html");
      rebase(parsed, new URL(boot.source, location.href));
      while (parsed.body.firstChild) article.appendChild(parsed.body.firstChild);

      upgradeAlerts(article);
      upgradeHeadings(article);
      upgradeCode(article);
      upgradeTables(article);
      buildRail(article);
      lightbox(article);
      externalize(article);

      wrap.appendChild(buildFooter());

      if (location.hash) {
        var t = document.getElementById(location.hash.slice(1));
        if (t) t.scrollIntoView();
      }
    })
    .catch(function (e) {
      fail('Could not read ' + boot.source + ' (' + e.message + '). If you are opening this from the ' +
        'file system, serve the folder over http instead — fetch does not work on file:// URLs.');
    });
})();
