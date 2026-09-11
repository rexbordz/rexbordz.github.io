/* ============================================================================
 * Multistream chat overlay - renderer
 *
 *   ChatOverlay.push(message)            queue one chat message; it renders once
 *                                        its pictures have loaded, in push order.
 *                                        avatar / html / replyTo.html may be promises.
 *   ChatOverlay.clear()                  wipe the overlay
 *   ChatOverlay.setOptions({ … })        change any setting at runtime
 *   ChatOverlay.settings                 current resolved settings (read-only copy)
 *
 * Settings come from URL params first (?fontSize=18&direction=top&sim=1), and any of
 * them can be overridden later with setOptions().
 * ========================================================================== */

(function () {
  "use strict";

  /* ------------------------------------------------------------- settings -- */

  var Q = new URLSearchParams(location.search);
  var qBool = function (k, d) { return Q.has(k) ? !/^(0|false|no|off)$/i.test(Q.get(k)) : d; };
  var qStr  = function (k, d) { return Q.get(k) || d; };
  var qNum  = function (k, d) { return Q.has(k) ? (Number(Q.get(k)) || d) : d; };
  // qNum's `||` reads 0 as "missing", which is right where 0 is meaningless (a
  // font size) but wrong for a wait: 0 there is a real choice — don't wait at all.
  var qMs   = function (k, d) {
    var v = Q.get(k);
    return v !== null && v !== "" && isFinite(v) ? Math.max(0, Number(v)) : d;
  };

  var settings = {
    font:               qStr("font", "Figtree"),     // font-family for the whole overlay
    fontSize:           qNum("fontSize", 18),          // px — whole overlay scales off this
    direction:          qStr("direction", "bottom"), // "bottom" | "top"
    duration:           qNum("duration", 0),         // seconds until a message fades out, 0 = never
    maxMessages:        qNum("maxMessages", 40),
    assetWait:          qMs("assetWait", 1200),      // ms a message waits for its images before it shows anyway; 0 = don't wait
    showTheirAvatar:    qBool("showTheirAvatar", true),
    showMyAvatar:       qBool("showMyAvatar", true),
    showPlatform:       qBool("showPlatform", true),
    showBadges:         qBool("showBadges", true),
    otherBubbleColor:   qStr("otherBubbleColor", "rgba(51,51,53,0.92)"),
    myBubbleColor:      qStr("myBubbleColor", "rgba(0,106,255,1)"),
    botBubbleColor:     qStr("botBubbleColor", "rgba(83,60,224,1)"),
    textColor:          qStr("textColor", "auto"),   // "auto" = black/white by contrast
    contrastBase:       qStr("contrastBase", "#000000"), // what translucent bubbles sit on
    // No default list on purpose: the settings page prefills the usual bots and
    // always writes them into the URL, so an empty `bots` here means the user
    // deliberately cleared the field and wants nobody treated as a bot.
    bots:               qStr("bots", "").split(",")
                          .map(function (s) { return s.trim().toLowerCase(); })
                          .filter(Boolean),
    ignoreUsers:        qStr("ignore", "").split(",")
                          .map(function (s) { return s.trim().toLowerCase(); })
                          .filter(Boolean),
    sim:                qBool("sim", false),          // 1 = generate fake chat
    excludeCommands:    qBool("excludeCommands", true), // drop messages that start with "!"
    showTwitchChat:     qBool("showTwitchChat", true),
    showTwitchAnnounce: qBool("showTwitchAnnounce", true),
    showYoutubeChat:    qBool("showYoutubeChat", true),
    showKickChat:       qBool("showKickChat", true),
    showTikTokChat:     qBool("showTikTokChat", true),
    fansClubName:       qStr("fansClub", ""),        // tag painted in the TikTok fan-club badge
  };

  // icon = bundled logo; mark/bg/fg are the letter-chip fallback if the file is missing
  var LOGOS = "assets/images/";
  var PLATFORMS = {
    twitch:  { icon: LOGOS + "twitch/logo-twitch.svg",   mark: "T",  bg: "#9146ff", fg: "#ffffff" },
    youtube: { icon: LOGOS + "youtube/logo-youtube.svg", mark: "Y",  bg: "#ff0033", fg: "#ffffff" },
    kick:    { icon: LOGOS + "kick/logo-kick.svg",       mark: "K",  bg: "#53fc18", fg: "#0b1a00" },
    tiktok:  { icon: LOGOS + "tiktok/logo-tiktok.svg",   mark: "TT", bg: "#111318", fg: "#25f4ee" }
  };

  var AVATAR_COLORS = ["#5b6cff", "#e0645c", "#2fb894", "#d4933a", "#a065e0", "#3aa6d4"];

  var EASE_IN  = "cubic-bezier(.22,1,.36,1)";
  var EASE_POP = "cubic-bezier(.22,1.3,.4,1)";
  var EASE_OUT = "cubic-bezier(.4,0,.6,1)";

  // How long a bubble takes to arrive and to leave. applyVars publishes both to CSS,
  // where .bubble's border-radius transition rides them — a neighbour's corners morph
  // over exactly the fade that caused them to change.
  var DUR_IN  = 300;
  var DUR_OUT = 360;

  /* ------------------------------------------------------------------ dom -- */

  var root = document.getElementById("chat");
  var tpl = {
    group:  document.getElementById("tpl-group"),
    bubble: document.getElementById("tpl-bubble"),
    reply:  document.getElementById("tpl-reply"),
    badge:  document.getElementById("tpl-badge")
  };

  var seq = 0;              // internal id counter
  var live = [];            // [{ id, key, node, groupEl, timer }] oldest → newest
  var lastGroup = null;     // { key, el, stackEl, count }

  /* ------------------------------------------- automatic text contrast ----- */

  var probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  probe.canvas.width = probe.canvas.height = 1;
  var contrastCache = {};

  // Paints the (possibly translucent) bubble color over contrastBase and reads
  // the real pixel back, so rgba()/hsl()/oklch()/named colors all work.
  function textColorFor(bg) {
    if (settings.textColor !== "auto") return settings.textColor;
    var key = bg + "|" + settings.contrastBase;
    if (contrastCache[key]) return contrastCache[key];
    var out = "#ffffff";
    try {
      probe.clearRect(0, 0, 1, 1);
      probe.fillStyle = settings.contrastBase;
      probe.fillRect(0, 0, 1, 1);
      probe.fillStyle = bg;
      probe.fillRect(0, 0, 1, 1);
      var px = probe.getImageData(0, 0, 1, 1).data;
      var lin = function (c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
      var L = 0.2126 * lin(px[0]) + 0.7152 * lin(px[1]) + 0.0722 * lin(px[2]);
      out = L > 0.42 ? "#000000" : "#ffffff";
    } catch (e) { /* unparseable color → keep white */ }
    contrastCache[key] = out;
    return out;
  }

  function applyVars() {
    var s = document.documentElement.style;
    s.setProperty("--font-size", (Number(settings.fontSize) || 15) + "px");
    s.setProperty("--font-family", settings.font || "Figtree, system-ui, -apple-system, sans-serif");
    s.setProperty("--other-bubble", settings.otherBubbleColor);
    s.setProperty("--my-bubble", settings.myBubbleColor);
    s.setProperty("--bot-bubble", settings.botBubbleColor);
    s.setProperty("--dur-in", DUR_IN + "ms");
    s.setProperty("--dur-out", DUR_OUT + "ms");
    root.setAttribute("data-dir", settings.direction === "top" ? "top" : "bottom");
  }

  /* --------------------------------------------------------- build helpers - */

  // Kick sends numeric user ids, so coerce before lowercasing — a bare number
  // has no .toLowerCase and would throw on every message.
  function matchesBot(msg) {
    var u = msg.user || {};
    var name = String(u.name || "").toLowerCase();
    var id = String(u.id || "").toLowerCase();
    return settings.bots.indexOf(name) > -1 || settings.bots.indexOf(id) > -1;
  }
  // Name only, unlike matchesBot: this list is typed by hand, so ids never apply.
  function isIgnored(msg) {
    if (!settings.ignoreUsers.length) return false;
    var name = String((msg.user || {}).name || "").toLowerCase();
    return !!name && settings.ignoreUsers.indexOf(name) > -1;
  }
  function isMine(msg) {
    if (msg.mine) return true;
    return matchesBot(msg);
  }
  function isBot(msg) {
    return matchesBot(msg);
  }
  function bubbleColor(msg) {
    if (msg.bubbleColor) return msg.bubbleColor;
    if (isBot(msg)) return settings.botBubbleColor;
    return isMine(msg) ? settings.myBubbleColor : settings.otherBubbleColor;
  }
  function groupKey(msg) {
    var u = msg.user || {};
    return (isMine(msg) ? "me" : msg.platform) + ":" + (u.id || u.name || "?");
  }
  // The handle a deletion names its target by. Same id-then-name fallback as
  // groupKey, and lowercased for the same reason matchesBot coerces: Kick hands
  // us numeric ids, and the moderation event may spell one as the other type.
  function userKey(msg) {
    var u = msg.user || {};
    return lower(u.id === 0 || u.id ? u.id : u.name);
  }
  function lower(v) {
    return v == null ? "" : String(v).toLowerCase();
  }
  function platformOf(msg) {
    return PLATFORMS[msg.platform] || { mark: (msg.platform || "?").slice(0, 2).toUpperCase(), bg: "#3a3f4d", fg: "#fff" };
  }

  function paintPlatform(el, msg) {
    var p = platformOf(msg);
    var icon = msg.platformIcon || p.icon;
    el.dataset.platform = msg.platform || "";   // lets CSS target a specific logo, e.g. to resize it
    el.textContent = "";
    el.style.backgroundColor = "transparent";
    el.style.backgroundImage = "none";
    el.style.color = p.fg;
    if (!icon) return letterMark(el, p);

    var img = document.createElement("img");
    img.className = "platform-logo";
    img.alt = "";
    // a broken/missing logo file falls back to the letter chip
    img.onerror = function () {
      if (img.parentNode !== el) return;   // already repainted
      el.removeChild(img);
      letterMark(el, p);
    };
    img.src = icon;
    el.appendChild(img);
  }

  function letterMark(el, p) {
    el.style.backgroundColor = p.bg;
    el.textContent = p.mark;
  }

  // These urls come off third-party APIs and land inside a CSS url("…") value,
  // so a stray quote or backslash would break out of it.
  function cssUrl(src) {
    return 'url("' + String(src).replace(/[\\"]/g, "\\$&").replace(/[\r\n]/g, "") + '")';
  }

  /* ------------------------------------------------------- image preloading - */

  // A message is held back until its pictures have decoded (see the queue under
  // "push"), so every url it names is fetched through here first. Awaiting the
  // handlers' fetches only ever yielded a url string — the bytes behind it were
  // still on the wire when the bubble animated in, which is what showed as an
  // avatar disc with no picture and emotes popping in a beat late.
  var assetCache = new Map();     // url -> Promise<boolean loaded>
  var assetOk = new Map();        // url -> boolean, once settled — readable synchronously
  var ASSET_CACHE_MAX = 500;      // a long stream must not grow these forever

  function preloadImage(url) {
    if (!url) return Promise.resolve(true);
    if (assetCache.has(url)) return assetCache.get(url);

    var p = new Promise(function (done) {
      var img = new Image();
      var settle = function (ok) { assetOk.set(url, ok); done(ok); };
      img.onload = function () {
        // decode here so painting it later cannot stall the frame; a browser
        // without decode(), or one that refuses an image it already has, still
        // counts as loaded.
        if (!img.decode) return settle(true);
        img.decode().then(function () { settle(true); }, function () { settle(true); });
      };
      // Resolve rather than reject: a dead url must not hold up the message, and
      // guardImages / paintBadgeIcon / paintAvatar each degrade on their own.
      img.onerror = function () { settle(false); };
      img.src = url;
    });

    if (assetCache.size >= ASSET_CACHE_MAX) {
      var oldest = assetCache.keys().next().value;   // Map iterates in insertion order
      assetCache.delete(oldest);
      assetOk.delete(oldest);
    }
    assetCache.set(url, p);
    return p;
  }

  // Parsed into a template so the fragment stays inert — the srcs are collected
  // and fetched by preloadImage alone, rather than racing a speculative load.
  var htmlProbe = document.createElement("template");

  function htmlImageSrcs(html) {
    if (!html || html.indexOf("<img") === -1) return [];
    htmlProbe.innerHTML = html;
    var out = Array.prototype.map.call(htmlProbe.content.querySelectorAll("img"), function (img) {
      return img.getAttribute("src");
    }).filter(Boolean);
    htmlProbe.innerHTML = "";
    return out;
  }

  // Every picture that has to be on screen the moment the bubble animates in.
  // b.fallbackIcon is left out on purpose: it is only reached once b.icon has
  // failed, and paintBadgeIcon walks that chain itself.
  function collectAssets(msg) {
    var urls = [];
    var u = msg.user || {};

    if (u.avatar) urls.push(u.avatar);
    if (settings.showPlatform) {
      var icon = msg.platformIcon || (PLATFORMS[msg.platform] && PLATFORMS[msg.platform].icon);
      if (icon) urls.push(icon);
    }

    if (settings.showBadges) {
      (u.badges || []).forEach(function (b) {
        if (!b) return;
        // TikTok hands its badges over as finished elements — read their imgs.
        if (b.nodeType === 1) {
          Array.prototype.forEach.call(b.querySelectorAll("img"), function (i) {
            if (i.src) urls.push(i.src);
          });
          return;
        }
        if (b.icon) urls.push(b.icon);
      });
    }

    htmlImageSrcs(msg.html).forEach(function (s) { urls.push(s); });
    if (msg.replyTo) htmlImageSrcs(msg.replyTo.html).forEach(function (s) { urls.push(s); });
    return urls;
  }

  function paintAvatar(el, msg) {
    var u = msg.user || {};
    var name = u.name || "?";
    var letter = name.slice(0, 1).toUpperCase();
    el.style.backgroundColor = AVATAR_COLORS[(name.charCodeAt(0) + name.length) % AVATAR_COLORS.length];

    // A CSS background fires no error event, so a picture that never arrives used
    // to leave a blank colored disc for good. The preload already knows how the
    // url ended: show the initial instead when it failed, and when it is still in
    // flight (it outran the wait budget) come back and correct it.
    var draw = function (ok) {
      var show = u.avatar && ok !== false;
      el.style.backgroundImage = show ? cssUrl(u.avatar) : "none";
      el.textContent = show ? "" : letter;
    };

    if (!u.avatar) return draw(false);
    if (assetOk.has(u.avatar)) return draw(assetOk.get(u.avatar));
    draw(true);
    preloadImage(u.avatar).then(function (ok) { if (!ok) draw(false); });
  }

  function textChip(el, b) {
    el.classList.remove("has-icon");
    el.style.backgroundImage = "none";
    el.style.backgroundColor = b.color || "#4b5566";
    el.textContent = b.label || b.id || "";
  }

  // A CSS background-image fires no error event, so a badge whose CDN drops the
  // request just goes blank. Show it optimistically, but probe the url and fall
  // back — to a local icon if the badge offers one, then to a text chip.
  function paintBadgeIcon(el, b) {
    var chain = [b.icon, b.fallbackIcon].filter(function (u, i, a) { return u && a.indexOf(u) === i; });

    (function attempt(i) {
      if (i >= chain.length) return textChip(el, b);

      el.classList.add("has-icon");
      el.style.backgroundImage = cssUrl(chain[i]);

      var probe = new Image();
      probe.onerror = function () { attempt(i + 1); };
      probe.src = chain[i];   // same url, so this rides the request the background already made
    })(0);
  }

  // Kick's files.kick.com throttles bursts and its QUIC connections go idle and
  // reset (ERR_QUIC_PROTOCOL_ERROR), so an emote that loaded a moment ago can
  // fail on the next message. Retry a couple of times, backing off so we don't
  // add to the burst, then degrade to the emote's name so the message stays
  // readable instead of showing a broken-image icon.
  var IMG_RETRIES = 2;

  function guardImages(scope) {
    var imgs = scope.querySelectorAll("img");
    Array.prototype.forEach.call(imgs, function (img) {
      img.decoding = "async";
      img.addEventListener("error", function () {
        var tries = (+img.dataset.retry || 0) + 1;

        if (tries > IMG_RETRIES) {
          var alt = img.getAttribute("alt");
          if (!img.parentNode) return;
          if (alt) img.parentNode.replaceChild(document.createTextNode(alt), img);
          else img.parentNode.removeChild(img);
          return;
        }

        img.dataset.retry = tries;
        var base = img.dataset.src || img.src.split("#")[0];
        img.dataset.src = base;

        // Only the fragment changes, so the retry reuses the same HTTP cache
        // key rather than minting a fresh request the CDN counts against us.
        setTimeout(function () { img.src = base + "#retry" + tries; }, 250 * tries + Math.random() * 250);
      });
    });
  }

  function paintBadges(holder, msg) {
    holder.textContent = "";
    // Lets css reach a platform's own badge styling. TikTok's badges arrive as
    // finished elements sized purely in em, so this is also where their scale
    // comes from — see .badges[data-platform="tiktok"] in style.css.
    holder.dataset.platform = msg.platform || "";
    var badges = (msg.user && msg.user.badges) || [];
    badges.forEach(function (b) {
      if (!b) return;

      // A badge may arrive already built, self-styled and self-guarding — that is
      // how TikTok.createBadges hands TikTok's over. Nothing here to paint.
      if (b.nodeType === 1) { holder.appendChild(b); return; }

      var el = tpl.badge.content.firstElementChild.cloneNode(true);
      if (b.icon) {
        el.title = b.label || b.id || "";
        paintBadgeIcon(el, b);
      } else {
        textChip(el, b);
      }
      holder.appendChild(el);
    });
  }

  function makeGroup(msg) {
    var el = tpl.group.content.firstElementChild.cloneNode(true);
    var mine = isMine(msg);
    el.dataset.side = mine ? "right" : "left";

    var avatar = el.querySelector(".avatar");
    var show = mine ? settings.showMyAvatar : settings.showTheirAvatar;
    if (show) { avatar.hidden = false; paintAvatar(avatar, msg); }

    // A reply carries its user info inline on the "replied to" line instead.
    if (!msg.replyTo) {
      var head = el.querySelector(".head");
      head.hidden = false;
      var pf = head.querySelector(".platform");
      if (settings.showPlatform) paintPlatform(pf, msg); else pf.hidden = true;
      var bg = head.querySelector(".badges");
      if (settings.showBadges) paintBadges(bg, msg); else bg.hidden = true;
      var name = head.querySelector(".name");
      name.textContent = (msg.user && msg.user.name) || "unknown";
      if (msg.user && msg.user.color) name.style.color = msg.user.color;
    }

    root.appendChild(el);
    // must be appended first — animating a detached node leaves it stuck at 0 opacity
    if (!msg.replyTo) animateMeta(el.querySelector(".head"));
    return { key: groupKey(msg), el: el, stackEl: el.querySelector(".stack"), count: 0 };
  }

  function makeReply(msg) {
    var el = tpl.reply.content.firstElementChild.cloneNode(true);
    var rpf = el.querySelector(".platform");
    if (settings.showPlatform) paintPlatform(rpf, msg); else rpf.hidden = true;
    var rbg = el.querySelector(".badges");
    if (settings.showBadges) paintBadges(rbg, msg); else rbg.hidden = true;
    var from = el.querySelector(".reply-from");
    from.textContent = (msg.user && msg.user.name) || "unknown";
    if (msg.user && msg.user.color) from.style.color = msg.user.color;
    el.querySelector(".reply-to").textContent = msg.replyTo.name || "";
    var quote = el.querySelector(".reply-quote");
    if (msg.replyTo.html) { quote.innerHTML = msg.replyTo.html; guardImages(quote); }  // emotes — sanitize upstream
    else quote.textContent = msg.replyTo.text || "";
    quote.style.color = textColorFor("rgba(0,0,0,.42)") === "#000000"
      ? "rgba(0,0,0,.85)" : "rgba(255,255,255,.85)";
    return el;
  }

  /* ------------------------------------------------------------- animation - */

  // OBS stops drawing an off-air scene without touching document.hidden, so animations
  // pile up unplayed and all run at once on the way back. rAF fires only when the
  // browser draws, which is exactly when an animation advances — no frame, no animation.
  var STILL = 250;                  // ms without a frame before we stop animating
  var lastFrame = performance.now();
  (function beat() { lastFrame = performance.now(); requestAnimationFrame(beat); })();

  // False while placing a backlog too — see `placing` under push.
  function animating() {
    return !placing && performance.now() - lastFrame < STILL;
  }

  function origin(side) {
    // Top mode grows downward only until the stack reaches the bottom edge;
    // after that it behaves exactly like bottom mode.
    var down = settings.direction === "top" && !overflowing;
    return (down ? "top " : "bottom ") + (side === "right" ? "right" : "left");
  }

  // Neither sets `fill`, so skipping lands on the same end state the animation would.
  function animateMeta(el) {
    if (!animating()) return;
    el.animate([{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "none" }],
      { duration: 220, easing: "ease" });
  }

  function animateIn(wrap, side) {
    if (!animating()) return;
    wrap.animate([{ gridTemplateRows: "0fr" }, { gridTemplateRows: "1fr" }],
      { duration: 260, easing: EASE_IN });
    var pill = wrap.querySelector(".bubble");
    pill.style.transformOrigin = origin(side);
    pill.animate([
      { opacity: 0, transform: "scale(.5) translateY(4px)" },
      { opacity: 1, offset: 0.6 },
      { opacity: 1, transform: "scale(1) translateY(0)" }
    ], { duration: DUR_IN, easing: EASE_POP });
    var reply = wrap.querySelector(".reply");
    if (reply) animateMeta(reply);
  }

  // The corner rules stop counting a bubble the moment it is marked leaving, so the
  // pills around it start rounding out with the collapse instead of snapping once the
  // node is finally detached. is-removing paces that morph off the collapse, not the pop.
  function animateOut(entry, done) {
    entry.leaving = true;
    entry.node.classList.add("is-leaving");
    var stack = entry.node.parentNode;
    if (stack) stack.classList.add("is-removing");

    var finish = function () {
      done();
      // another pill in the same run may still be collapsing
      if (stack && !stack.querySelector(".wrap.is-leaving")) stack.classList.remove("is-removing");
    };

    // fill:forwards and removal driven off onfinish, so this one settles by hand.
    if (!animating()) return finish();

    var a = entry.node.animate(
      [{ gridTemplateRows: "1fr", opacity: 1 }, { gridTemplateRows: "0fr", opacity: 0 }],
      { duration: DUR_OUT, easing: EASE_OUT, fill: "forwards" });

    a.onfinish = finish;
    setTimeout(finish, DUR_OUT + 60); // safety net if drawing stops mid-collapse
  }

  /* -------------------------------------------------------- bubble sizing - */

  // A bubble is sized from its text on one line and then clamped to --max-bubble,
  // and nothing in CSS goes back to look at where the text actually broke — so
  // every wrapped message keeps the full cap width and trails empty space past
  // its shortest line. Measure the line boxes it drew and pin that width.
  function fitBubble(pill) {
    if (!pill || !pill.isConnected) return;
    watchImages(pill);

    pill.style.width = "";                 // measure the natural wrap, not the last fit
    var cs = getComputedStyle(pill);
    var pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    var natural = pill.offsetWidth;
    var tall = pill.offsetHeight;

    // Client rects come back with the pop animation's scale baked in, so divide
    // it out — an emote that loads mid-flight refits against the real widths.
    var scale = pill.getBoundingClientRect().width / (natural || 1);
    var widest = widestLine(pill) / (scale || 1);
    if (widest <= 0) return;

    var width = Math.ceil(widest + pad);
    if (width >= natural) return;          // single line, or already tight

    // Landing a hair narrow drops a word onto a line of its own, which is worse
    // than the gap we came to close. The retry covers what the rects leave out —
    // an inline emote's own margin — and past that the width goes back.
    if (tryWidth(pill, width, tall)) return;
    if (width + 4 < natural && tryWidth(pill, width + 4, tall)) return;
    pill.style.width = "";
  }

  function tryWidth(pill, width, tall) {
    pill.style.width = width + "px";
    return pill.offsetHeight <= tall;
  }

  // One rect per line fragment, plus a rect of its own for every inline emote —
  // so rects that share a line are merged before the widest one is taken.
  function widestLine(el) {
    var range = document.createRange();
    range.selectNodeContents(el);
    var rects = range.getClientRects();
    var lines = [];
    var widest = 0;

    for (var i = 0; i < rects.length; i++) {
      var r = rects[i];
      if (!r.width || !r.height) continue;
      var line = null;

      for (var j = 0; j < lines.length; j++) {
        var over = Math.min(r.bottom, lines[j].bottom) - Math.max(r.top, lines[j].top);
        // Half the shorter rect, not a flat pixel: emotes stand taller than the
        // line box, so they graze the line above without belonging to it.
        if (over > 0.5 * Math.min(r.bottom - r.top, lines[j].bottom - lines[j].top)) { line = lines[j]; break; }
      }

      if (!line) { lines.push({ top: r.top, bottom: r.bottom, left: r.left, right: r.right }); continue; }
      line.top = Math.min(line.top, r.top);
      line.bottom = Math.max(line.bottom, r.bottom);
      line.left = Math.min(line.left, r.left);
      line.right = Math.max(line.right, r.right);
    }

    for (var k = 0; k < lines.length; k++) widest = Math.max(widest, lines[k].right - lines[k].left);
    return widest;
  }

  // An emote arriving after the fit changes the line it sits on. Refit on the
  // error too: that is where guardImages swaps the image for its alt text.
  function watchImages(pill) {
    Array.prototype.forEach.call(pill.querySelectorAll("img"), function (img) {
      if (img.complete || img.dataset.fit) return;
      img.dataset.fit = "1";
      var refit = function () { fitBubble(pill); };
      img.addEventListener("load", refit);
      img.addEventListener("error", refit);
    });
  }

  // The cap is a percentage, so every bubble has to be measured again whenever
  // the overlay is resized or the fontSize setting rescales it.
  var refitRaf = 0;
  function refitAll() {
    cancelAnimationFrame(refitRaf);
    refitRaf = requestAnimationFrame(function () {
      var pills = root.querySelectorAll(".bubble");
      // Clear every width first: one layout pass for the batch, not one each.
      Array.prototype.forEach.call(pills, function (p) { p.style.width = ""; });
      Array.prototype.forEach.call(pills, fitBubble);
    });
  }

  /* ------------------------------------------------------------------ push - */

  // Messages queue here rather than going straight to the dom. The drain holds
  // each one until its pictures have decoded, so a bubble arrives complete
  // instead of filling in after the fact — and because a single consumer walks
  // the queue, they render in the order they arrived no matter how their
  // lookups raced. Nothing waits longer than the budget below.
  var pending = [];          // [{ msg, id, platform, userId, cancelled }] oldest → newest
  var draining = false;
  var DEFERRED_WAIT = 2000;  // ms a handler's own lookup gets before we give up on it
  var BACKLOG_SOFT = 4;      // queued messages tolerated before the waits shorten
  var BACKLOG_FLOOR = 150;   // ms — the shortest the picture wait ever gets
  var LATE = 500;            // ms queued before a message counts as catching up
  var placing = false;       // true while the drain is placing a backlog, not live chat

  // Past maxMessages the queue holds bubbles that can never be seen — trim() drops the
  // oldest the moment they render. Cut them rather than draw each one to throw it away.
  function capBacklog() {
    var over = pending.length - (Number(settings.maxMessages) || 40);
    if (over > 0) pending.splice(0, over);
  }

  function timeout(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  // One consumer means one slow message holds up every message behind it, so
  // nothing below is allowed to wait forever, and a backlog shortens all of it:
  // drifting behind live chat is worse than a missing emote.
  function backlogFactor() {
    var over = pending.length - BACKLOG_SOFT;
    return over > 0 ? over + 1 : 1;
  }

  // Pictures. Whatever misses this still arrives on its own — guardImages,
  // paintBadgeIcon and paintAvatar each degrade without it.
  function assetBudget() {
    var full = Math.max(0, Number(settings.assetWait) || 0);
    return Math.max(Math.min(BACKLOG_FLOOR, full), full / backlogFactor());
  }

  // The handler's lookups, which carry the message's own content rather than
  // polish — so this keeps a floor even when assetWait is set to 0, and exists
  // only to stop a dead endpoint from wedging the queue.
  function deferredBudget() {
    return Math.max(300, DEFERRED_WAIT / backlogFactor());
  }

  function isThenable(v) {
    return !!v && typeof v.then === "function";
  }

  // A handler may hand over a lookup still in flight (a twitch avatar, a parsed
  // message) instead of its result. Awaiting it here rather than in the handler
  // is what keeps arrival order: the fetch races, the queue does not.
  //
  // Each field is set to null up front, so giving up on `deadline` still leaves a
  // concrete value behind — a lost avatar draws the initial, lost html falls back
  // to msg.text. A reply that lands after the deadline writes into a message that
  // has already rendered, which is harmless.
  function resolveDeferred(msg, deadline) {
    var jobs = [];
    var settle = function (obj, key, val) {
      obj[key] = null;
      jobs.push(Promise.race([
        Promise.resolve(val).then(function (v) { obj[key] = v; }, function () {}),
        deadline
      ]));
    };

    if (msg.user && isThenable(msg.user.avatar)) {
      var avatar = msg.user.avatar;
      msg.user = Object.assign({}, msg.user);   // don't write through to the caller's object
      settle(msg.user, "avatar", avatar);
    }
    if (isThenable(msg.html)) settle(msg, "html", msg.html);
    if (msg.replyTo && isThenable(msg.replyTo.html)) {
      var replyHtml = msg.replyTo.html;
      msg.replyTo = Object.assign({}, msg.replyTo);
      settle(msg.replyTo, "html", replyHtml);
    }

    return jobs.length ? Promise.all(jobs) : null;
  }

  function waitForAssets(msg, budget) {
    var urls = collectAssets(msg);
    if (!urls.length || !budget) return null;
    return Promise.race([Promise.all(urls.map(preloadImage)), timeout(budget)]);
  }

  async function drain() {
    if (draining) return;
    draining = true;

    try {
      while (pending.length) {
        capBacklog();   // sync, and before pending[0] is read — the shift below stays correct
        var item = pending[0];
        if (item.cancelled) { pending.shift(); continue; }

        // Sat here this long and it is history, not live chat: put it straight on
        // screen rather than pay the picture wait and the animation for each one.
        placing = performance.now() - item.at > LATE;

        try {
          var deferred = resolveDeferred(item.msg, timeout(deferredBudget()));
          if (deferred) await deferred;
          // Read the budget after the lookups: the queue may have grown while
          // they were out, and the pictures are the part worth giving up first.
          var assets = (item.cancelled || placing) ? null : waitForAssets(item.msg, assetBudget());
          if (assets) await assets;
        } catch (e) {
          console.error("[ChatOverlay] preload failed, showing anyway:", e);
        }

        pending.shift();
        // a moderator may have deleted it while it sat here
        if (item.cancelled) continue;
        try { render(item.msg); }
        catch (e) { console.error("[ChatOverlay] render failed:", e); }
      }
    } finally {
      draining = false;
      placing = false;
    }
  }

  function push(msg) {
    if (!msg || !root) return null;
    if (isIgnored(msg)) return null;
    msg = Object.assign({}, msg);
    msg.id = msg.id || "m" + (++seq);

    var dup = function (e) { return e.id === msg.id; };
    if (live.some(dup) || pending.some(dup)) return msg.id;   // dedupe

    pending.push({
      msg: msg,
      id: msg.id,
      at: performance.now(),   // queued at — a long wait here means we are catching up
      platform: lower(msg.platform),
      userId: userKey(msg),
      cancelled: false
    });
    drain();
    return msg.id;
  }

  function render(msg) {
    var key = groupKey(msg);
    var group = (lastGroup && lastGroup.key === key && !msg.replyTo) ? lastGroup : makeGroup(msg);
    lastGroup = group;

    var wrap = tpl.bubble.content.firstElementChild.cloneNode(true);
    wrap.dataset.mid = msg.id;
    var inner = wrap.querySelector(".wrap-inner");
    if (msg.replyTo) inner.insertBefore(makeReply(msg), inner.firstChild);

    var pill = wrap.querySelector(".bubble");
    var bg = bubbleColor(msg);
    pill.style.background = bg;
    pill.style.color = textColorFor(bg);
    if (msg.html) { pill.innerHTML = msg.html; guardImages(pill); }   // emotes etc. — sanitize upstream
    else pill.textContent = msg.text || "";

    group.stackEl.appendChild(wrap);
    group.count++;
    fitBubble(pill);        // before animateIn — the pop scale would skew the rects

    var entry = { id: msg.id, key: key, node: wrap, groupEl: group.el, timer: null,
                  platform: lower(msg.platform), userId: userKey(msg) };
    live.push(entry);

    animateIn(wrap, group.el.dataset.side);
    pinLoop();
    scheduleExpiry(entry);
    trim();
    return msg.id;
  }

  function removeEntry(entry) {
    var i = live.indexOf(entry);
    if (i > -1) live.splice(i, 1);
    clearTimeout(entry.timer);
    if (entry.node.parentNode) entry.node.parentNode.removeChild(entry.node);
    var stack = entry.groupEl.querySelector(".stack");
    if (stack && !stack.querySelector(".wrap")) {
      if (lastGroup && lastGroup.el === entry.groupEl) lastGroup = null;
      if (entry.groupEl.parentNode) entry.groupEl.parentNode.removeChild(entry.groupEl);
    }
  }

  function scheduleExpiry(entry) {
    if (entry.leaving) return;   // already collapsing out — expired, or deleted
    clearTimeout(entry.timer);
    var secs = Number(settings.duration) || 0;
    if (!secs) return;
    var age = entry.born ? Date.now() - entry.born : 0;
    entry.born = entry.born || Date.now();
    entry.timer = setTimeout(function () {
      animateOut(entry, function () { removeEntry(entry); });
    }, Math.max(0, secs * 1000 - age));
  }

  function trim() {
    var max = Number(settings.maxMessages) || 40;
    while (live.length > max) removeEntry(live[0]);
  }

  /* ------------------------------------------------------------ moderation - */

  // Collapse a bubble out exactly the way an expiring one goes. A deletion can
  // name a message that already expired, was trimmed off, or is still mid-fade
  // from an earlier call, so this reports whether it actually took one.
  function fadeOut(entry) {
    if (entry.leaving) return false;
    clearTimeout(entry.timer);        // don't let expiry fire a second removal
    animateOut(entry, function () { removeEntry(entry); });
    return true;
  }

  // A deletion can land while the message is still waiting on its pictures, so
  // it never reached `live` — drop it before it gets to animate in. The entry is
  // marked rather than spliced: the drain loop is holding a reference to it.
  function cancelPending(match) {
    var hit = 0;
    pending.forEach(function (p) {
      if (p.cancelled || !match(p)) return;
      p.cancelled = true;
      hit++;
    });
    return hit;
  }

  // Iterate a copy: an entry stays in `live` until its animation finishes, but
  // a zero-length animation can splice it out from under the loop.
  function removeWhere(match) {
    var hit = cancelPending(match);
    live.slice().forEach(function (e) { if (match(e) && fadeOut(e)) hit++; });
    return hit;
  }

  // platform is optional — omit it to match on the id alone.
  function deleteMessage(platform, msgId) {
    var pf = lower(platform), id = lower(msgId);
    if (!id) return 0;
    return removeWhere(function (e) {
      return lower(e.id) === id && (!pf || e.platform === pf);
    });
  }

  function deleteUserMessages(platform, userId) {
    var pf = lower(platform), uid = lower(userId);
    if (!uid) return 0;
    return removeWhere(function (e) {
      return e.userId === uid && (!pf || e.platform === pf);
    });
  }

  /* ----------------------------------------------------- top-mode scrolling - */

  var overflowing = false;
  var pinning = false;
  var raf = 0;

  // Measure from layout, never scrollHeight: the pop animation's scale overshoot
  // inflates the scroll overflow area and would make the stack rubber-band.
  function contentBottom() {
    var kid = root.lastElementChild;
    while (kid && kid.tagName === "TEMPLATE") kid = kid.previousElementSibling;
    if (!kid) return 0;
    return kid.offsetTop + kid.offsetHeight + parseFloat(getComputedStyle(root).paddingBottom || 0);
  }

  function pinLoop() {
    if (settings.direction !== "top") {
      cancelAnimationFrame(raf); pinning = false;
      root.scrollTop = 0;
      if (overflowing) { overflowing = false; }
      root.classList.add("is-feathered");
      return;
    }
    if (pinning) return;
    pinning = true;
    (function step() {
      if (settings.direction !== "top") { pinning = false; return; }
      raf = requestAnimationFrame(step);
      var max = Math.max(0, contentBottom() - root.clientHeight);
      if (max - root.scrollTop > 0.5) root.scrollTop = max;   // instant: the
      // grid-expand supplies the motion, so it reads as the normal upward push
      var over = max > 2;
      if (over !== overflowing) {
        overflowing = over;
        root.classList.toggle("is-feathered", over);          // no fade until it overflows
      }
    })();
  }

  /* ----------------------------------------------------------------- public - */

  function setOptions(patch) {
    Object.assign(settings, patch || {});
    if (patch && "bots" in patch && typeof patch.bots === "string") {
      settings.bots = patch.bots.split(",").map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);
    }
    if (patch && "ignoreUsers" in patch && typeof patch.ignoreUsers === "string") {
      settings.ignoreUsers = patch.ignoreUsers.split(",").map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);
    }
    contrastCache = {};
    applyVars();
    live.forEach(scheduleExpiry);
    if ("sim" in (patch || {})) settings.sim ? startSim() : stopSim();
    pinLoop();
    trim();
    refitAll();   // fontSize / padding may have changed under every bubble
  }

  function clear() {
    // Mark, don't replace: the drain loop holds `pending` and would otherwise
    // keep rendering the messages this call was meant to wipe.
    pending.forEach(function (p) { p.cancelled = true; });
    live.forEach(function (e) { clearTimeout(e.timer); });
    live = [];
    lastGroup = null;
    Array.prototype.slice.call(root.querySelectorAll(".group")).forEach(function (g) { g.remove(); });
  }

  window.ChatOverlay = {
    push: push,
    deleteMessage: deleteMessage,
    deleteUserMessages: deleteUserMessages,
    clear: clear,
    setOptions: setOptions,
    get settings() { return Object.assign({}, settings, { bots: settings.bots.slice(), ignoreUsers: settings.ignoreUsers.slice() }); }
  };

  /* -------------------------------------------------------------- sim mode -- */

  var SIM = [
    { platform: "twitch",  user: { id: "u1", name: "BordzElements",  avatar: "https://static-cdn.jtvnw.net/jtv_user_pictures/002650ff-08a9-4fee-877c-34273f1bacca-profile_image-70x70.png", color: "#008000", badges: [{ label: "MOD", color: "#3f7ce0", icon: "https://static-cdn.jtvnw.net/badges/v1/3267646d-33f0-4b17-b3df-f923a41db1d0/2" }] },
      lines: ["Don't forget to subscribe to @rexbordz_codes on YouTube. All new streaming videos will be posted there", "Donate to rexbordz if you find this tool helpful at https://ko-fi.com/rexbordz/donate", "W stream"] },
    { platform: "youtube", user: { id: "u2", name: "xThatAwkwardGamer", color: "#ff8b9a", avatar: "https://yt3.googleusercontent.com/GDyudPkTCN7d6anPrm576hp8Y8yrqA3V2omWdYPBO8UUJJY9brcz4RtMrnidZwiMhF8G_oRlCgk=s160-c-k-c0x00ffffff-no-rj", badges: [] },
      lines: ["first time here, love the setup", "how long have you been streaming?", "the overlay looks clean"] },
    { platform: "kick",    user: { id: "u3", name: "VortisRD",  color: "#8ef06a", avatar: "https://files.kick.com/images/user/79214/profile_image/conversion/013ef5a5-5eea-46cf-8041-cb21ad032036-medium.webp", badges: [] },
      lines: ["gg", "one more round", "ez"] },
    { platform: "tiktok",  user: { id: "u4", name: "Shell", color: "#6df0e8" },
      tiktok: {
        isModerator: true,
        isSubscriber: false,
        topGifterRank: 2,
        userBadges: [
          { badgeSceneType: 8, level: 6 },
          { badgeSceneType: 10, level: 1 },
          { badgeSceneType: 6, url: "https://p19-webcast.tiktokcdn.com/webcast-sg/new_top_gifter_version_2.png~tplv-obj.image" }
        ]
      },
      lines: ["hiii", "following", "this is so satisfying"] },
    // Grade + the two-tone "super fan" — a leaner two-chip case that exercises the
    // only badge drawn with the cap panel and its borders.
    { platform: "tiktok",  user: { id: "u5", name: "Alextvz", color: "#6df0e8" },
      tiktok: {
        isSubscriber: true,
        userBadges: [
          { badgeSceneType: 8, level: 40 },
          { badgeSceneType: 10, level: 40 }
        ]
      },
      lines: ["let's goo", "day 40 of watching this stream", "poggers"] },
    { platform: "twitch",  mine: true, user: { id: "me", name: "rexbordz", color: "#1E90FF", avatar: "https://static-cdn.jtvnw.net/jtv_user_pictures/92a3c6c7-3b13-4563-9725-d56a3bc12c0d-profile_image-70x70.png", badges: [{ label: "HOST", color: "#2f6fe0", icon: "https://static-cdn.jtvnw.net/badges/v1/5527c58c-fb7d-422d-b71b-f309dcb85cc1/1" }] },
      lines: ["thanks for hopping in", "new build drops friday", "chat what should we play next"] },
    { platform: "twitch",  mine: true, user: { id: "bot", name: "Streamer.Bot", color: "#9251d4", badges: [{ label: "BOT", color: "#4b5566", icon: "https://static-cdn.jtvnw.net/badges/v1/3267646d-33f0-4b17-b3df-f923a41db1d0/2" }] },
      lines: ["!discord -> discord.gg/rexbordz", "raid incoming from @leonkennedy"] }
  ];
  var simTimer = null;

  // A fresh copy of the user each time, because a TikTok speaker's badges are live
  // DOM nodes that belong to exactly one message.
  function simUser(s) {
    if (!s.tiktok) return s.user;
    return Object.assign({}, s.user, {
      badges: TikTok.createBadges(s.tiktok, { fansClubName: settings.fansClubName })
    });
  }

  function startSim() {
    if (simTimer) return;
    var n = 0;
    (function loop() {
      var s = SIM[Math.floor(Math.random() * SIM.length)];
      push({ platform: s.platform, mine: s.mine, user: simUser(s), text: s.lines[Math.floor(Math.random() * s.lines.length)] });
      if (++n % 7 === 0) {
        var a = SIM[1];
        push({ platform: a.platform, user: simUser(a), text: "wait really?",
               replyTo: { name: (SIM[4].user.name), text: "new build drops friday" } });
      }
      simTimer = setTimeout(loop, 1400 + Math.random() * 1800);
    })();
  }
  function stopSim() { clearTimeout(simTimer); simTimer = null; }

  /* ------------------------------------------------------------------ boot - */

  applyVars();
  pinLoop();
  window.addEventListener("resize", refitAll);
  // Figtree landing after first paint remeasures every bubble at the real metrics
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(refitAll);
  if (settings.sim) startSim();
})();
