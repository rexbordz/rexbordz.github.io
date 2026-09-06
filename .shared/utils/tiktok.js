/* ================================================================= TikTok ====
 * Everything a widget needs to paint TikTok chat: the shortcode emote map, the
 * message renderer, and the badge set.
 *
 * Self-contained on purpose. This file has no dependencies at all — not on
 * helpers.js, not on a stylesheet, not on load order. A widget that only wants
 * TikTok badges loads this and the TikTok Sans font, and nothing else. The one
 * cost of that is the private _escape below, which is four lines duplicated
 * from Utils rather than a reason to pull the whole of helpers.js in.
 *
 * Emote artwork under assets/images/tiktok/emotes/ was downloaded from TikTok's
 * own web chat in September 2026.
 * ============================================================================ */

const TikTok = {

  /* ------------------------------------------------------------- messages -- */

  // Where the shortcode PNGs below are served from. A widget that keeps its own
  // copy of the artwork can repoint this instead of forking the module.
  emoteBase: 'https://rexbordz.github.io/widget-core/assets/images/tiktok/emotes/',

  // Shortcodes a viewer can type in TikTok chat. A value ending in .png names a
  // file under emoteBase; anything else is passed straight through as unicode.
  //
  // Grouped by where the art comes from, then by character, because that is how
  // you actually look one up — TikTok's own drawings first, then the standard
  // shortcode set that maps to plain emoji.
  emotes: {
    // -- TikTok's own chat art -------------------------------------------------
    '[wow]':                'wow.png',
    '[laugh]':              'laugh.png',
    '[laughcry]':           'laughcry.png',
    '[thanks]':             'thanks.png',
    '[thumb]':              'thumb.png',
    '[hi]':                 'hi.png',
    '[heart]':              'heart.png',
    '[congrat]':            'congrat.png',

    '[rockyserious]':       'rockyserious.png',
    '[rockyloveit]':        'rockyloveit.png',
    '[rockyproud]':         'rockyproud.png',
    '[rockycool]':          'rockycool.png',

    '[rosiedislike]':       'rosiedislike.png',
    '[rosieawkward]':       'rosieawkward.png',
    '[rosiekisskiss]':      'rosiekisskiss.png',
    '[rosiecute]':          'rosiecute.png',

    '[jolliekissingface]':  'jolliekissingface.png',
    '[jolliewow]':          'jolliewow.png',
    '[jolliespeechless]':   'jolliespeechless.png',
    '[jolliesatisfied]':    'jolliesatisfied.png',

    '[sagethink]':          'sagethink.png',
    '[sagefulfilled]':      'sagefulfilled.png',
    '[sageclever]':         'sageclever.png',
    '[sagemoney]':          'sagemoney.png',

    // -- unicode passthrough: smiling and laughing -----------------------------
    '[grinning]': '😀', '[smiley]': '😃', '[smile]': '😄', '[grin]': '😁',
    '[laughing]': '😆', '[sweat_smile]': '😅', '[rofl]': '🤣', '[joy]': '😂',
    '[slightly_smiling_face]': '🙂', '[upside_down_face]': '🙃',
    '[wink]': '😉', '[blush]': '😊', '[innocent]': '😇',

    // -- affection and tongue --------------------------------------------------
    '[heart_eyes]': '😍', '[kissing_heart]': '😘', '[kissing]': '😗',
    '[kissing_closed_eyes]': '😚', '[kissing_smiling_eyes]': '😙',
    '[yum]': '😋', '[stuck_out_tongue]': '😛',
    '[stuck_out_tongue_winking_eye]': '😜',
    '[stuck_out_tongue_closed_eyes]': '😝',
    '[money_mouth_face]': '🤑', '[hugs]': '🤗',

    // -- neutral and sceptical -------------------------------------------------
    '[thinking]': '🤔', '[zipper_mouth_face]': '🤐', '[neutral_face]': '😐',
    '[expressionless]': '😑', '[no_mouth]': '😶', '[smirk]': '😏',
    '[unamused]': '😒', '[roll_eyes]': '🙄', '[grimacing]': '😬',
    '[lying_face]': '🤥',

    // -- calm, tired and unwell ------------------------------------------------
    '[relieved]': '😌', '[pensive]': '😔', '[sleepy]': '😪',
    '[drooling_face]': '🤤', '[sleeping]': '😴', '[mask]': '😷',
    '[face_with_thermometer]': '🤒', '[face_with_head_bandage]': '🤕',
    '[nauseated_face]': '🤢', '[sneezing_face]': '🤧', '[dizzy_face]': '😵',

    // -- cool ------------------------------------------------------------------
    '[cowboy_hat_face]': '🤠', '[sunglasses]': '😎', '[nerd_face]': '🤓',

    // -- confusion and surprise ------------------------------------------------
    '[confused]': '😕', '[worried]': '😟', '[slightly_frowning_face]': '🙁',
    '[open_mouth]': '😮', '[hushed]': '😯', '[astonished]': '😲',
    '[flushed]': '😳', '[frowning]': '😦', '[anguished]': '😧',

    // -- fear and sadness ------------------------------------------------------
    '[fearful]': '😨', '[cold_sweat]': '😰', '[disappointed_relieved]': '😥',
    '[cry]': '😢', '[sob]': '😭', '[scream]': '😱', '[confounded]': '😖',
    '[persevere]': '😣', '[disappointed]': '😞', '[sweat]': '😓',
    '[weary]': '😩', '[tired_face]': '😫',

    // -- anger -----------------------------------------------------------------
    '[triumph]': '😤', '[rage]': '😡', '[angry]': '😠',

    // -- creatures -------------------------------------------------------------
    '[smiling_imp]': '😈', '[imp]': '👿', '[skull]': '💀', '[hankey]': '💩',
    '[clown_face]': '🤡', '[japanese_ogre]': '👹', '[japanese_goblin]': '👺',
    '[ghost]': '👻', '[alien]': '👽', '[space_invader]': '👾', '[robot]': '🤖',

    // -- cats ------------------------------------------------------------------
    '[smiley_cat]': '😺', '[smile_cat]': '😸', '[joy_cat]': '😹',
    '[heart_eyes_cat]': '😻', '[smirk_cat]': '😼', '[kissing_cat]': '😽',
    '[scream_cat]': '🙀', '[crying_cat_face]': '😿', '[pouting_cat]': '😾'
  },

  // TikTok's emote objects carry `emoteImageUrl`/`emoteId` and a single
  // `placeInComment` index rather than a startIndex/endIndex span, so each
  // emote replaces exactly one placeholder character in the comment.
  buildMessageHtml(originalMessage, emotes) {
    const text = String(originalMessage ?? '');

    if (!emotes || emotes.length === 0) return TikTok._buildTextHtml(text);
    const sorted = [...emotes].sort((a, b) => a.placeInComment - b.placeInComment);

    let html = '';
    let cursor = 0;

    sorted.forEach(emote => {
      // The run of comment text since the previous emote, shortcodes and all.
      if (emote.placeInComment > cursor) {
        html += TikTok._buildTextHtml(text.slice(cursor, emote.placeInComment));
      }

      // The emote itself, standing in for the one placeholder character.
      const label = TikTok._escape(emote.emoteId ?? '');
      html += `<img src="${TikTok._escape(emote.emoteImageUrl)}" alt="${label}" title="${label}" class="emote">`;

      cursor = emote.placeInComment + 1;
    });

    // Whatever trails the last emote.
    return html + (cursor < text.length ? TikTok._buildTextHtml(text.slice(cursor)) : '');
  },

  // Plain text segments can also contain typed shortcodes like "[laughcry]".
  // Walk the segment and swap any recognised shortcode in place, escaping
  // everything else.
  _buildTextHtml(segment) {
    let html = '';
    let cursor = 0;
    const shortcodePattern = /\[[a-z0-9_]+\]/gi;
    let match;

    while ((match = shortcodePattern.exec(segment)) !== null) {
      const token = match[0];
      const value = TikTok.emotes[token];

      if (value === undefined) continue; // Not a known shortcode, leave as literal text

      html += TikTok._escape(segment.slice(cursor, match.index));

      if (value.endsWith('.png')) {
        const label = TikTok._escape(token);
        html += `<img src="${TikTok._escape(TikTok.emoteBase + value)}" alt="${label}" title="${label}" class="emote">`;
      } else {
        // Value is a plain unicode emoji, not a filename
        html += TikTok._escape(value);
      }

      cursor = match.index + token.length;
    }

    html += TikTok._escape(segment.slice(cursor));
    return html;
  },

  /* --------------------------------------------------------------- badges --
   * createBadges hands back finished DOM elements, so there is no badge CSS to
   * copy and no renderer support code.
   * ------------------------------------------------------------------------ */

  // TikFinity's chat payload names a user's grade, fan-club and moderator badges
  // but ships an image url for none of them — only the top-gifter badge carries
  // its own `url`. These are the icons TikTok itself serves, so the missing three
  // are synthesized from the level in the payload.
  //
  // Icons are bare filenames off `base`; _icon joins them. A tier applies from
  // its `min` up to the next tier's, so a level past the last row clamps.
  _badgeData: {
    base: "https://p16-webcast.tiktokcdn.com/webcast-va/",

    // badgeSceneType 8 — colors deepen with the tier, then hold: TikTok stops
    // varying the color past grade 30, so the icons keep stepping but the chip
    // stays the same from there up.
    grade: [
      { min: 1,  icon: "grade_badge_icon_lite_lv1_v1.png~tplv-obj.image",  color: "rgba(120, 158, 231, .6)" },
      { min: 5,  icon: "grade_badge_icon_lite_lv5_v1.png~tplv-obj.image",  color: "rgba(95, 144, 239, .6)"  },
      { min: 10, icon: "grade_badge_icon_lite_lv10_v1.png~tplv-obj.image", color: "rgba(63, 125, 246, .6)"  },
      { min: 15, icon: "grade_badge_icon_lite_lv15_v2.png~tplv-obj.image", color: "rgba(71, 126, 255, .7)"  },
      { min: 20, icon: "grade_badge_icon_lite_lv20_v1.png~tplv-obj.image", color: "rgba(71, 90, 255, .7)"   },
      { min: 25, icon: "grade_badge_icon_lite_lv25_v1.png~tplv-obj.image", color: "rgba(39, 47, 243, .7)"   },
      { min: 30, icon: "grade_badge_icon_lite_lv30_v1.png~tplv-obj.image", color: "rgba(42, 25, 238, .75)"  },
      { min: 35, icon: "grade_badge_icon_lite_lv35_v3.png~tplv-obj.image", color: "rgba(42, 25, 238, .75)"  },
      { min: 40, icon: "grade_badge_icon_lite_lv40_v2.png~tplv-obj.image", color: "rgba(42, 25, 238, .75)"  },
      { min: 45, icon: "grade_badge_icon_lite_lv45_v1.png~tplv-obj.image", color: "rgba(42, 25, 238, .75)"  },
      { min: 50, icon: "grade_badge_icon_lite_lv50_v1.png~tplv-obj.image", color: "rgba(42, 25, 238, .75)"  }
    ],

    // badgeSceneType 10, plain member — the "webcast-va-…-v2" icon set on a flat
    // pill. One color across all tiers; the icon steps every ten levels.
    fan: [
      { min: 1,  icon: "webcast-va-fans_badge_icon_lv1_v2.png~tplv-obj.image",  color: "rgba(255, 94, 58, .5)" },
      { min: 10, icon: "webcast-va-fans_badge_icon_lv10_v2.png~tplv-obj.image", color: "rgba(255, 94, 58, .5)" },
      { min: 20, icon: "webcast-va-fans_badge_icon_lv20_v2.png~tplv-obj.image", color: "rgba(255, 94, 58, .5)" },
      { min: 30, icon: "webcast-va-fans_badge_icon_lv30_v2.png~tplv-obj.image", color: "rgba(255, 94, 58, .5)" },
      { min: 40, icon: "webcast-va-fans_badge_icon_lv40_v2.png~tplv-obj.image", color: "rgba(255, 94, 58, .5)" },
      { min: 50, icon: "webcast-va-fans_badge_icon_lv50_v2.png~tplv-obj.image", color: "rgba(255, 94, 58, .5)" }
    ],

    // badgeSceneType 10, subscribed member — the "super fan", the one badge TikTok
    // draws two-tone: a lighter pill behind the text and a darker cap behind the
    // icon, each carrying its own border. See createSuperFanBadge.
    fanSubscriber: {
      background: "rgba(188, 39, 0, .85)",
      panel: "rgba(122, 10, 0, .85)",
      border: "rgba(214, 122, 64, .95)",
      tiers: [
        { min: 1,  icon: "fans_badge_icon_lv1_v4.png~tplv-obj.image"  },
        { min: 10, icon: "fans_badge_icon_lv10_v4.png~tplv-obj.image" },
        { min: 20, icon: "fans_badge_icon_lv20_v4.png~tplv-obj.image" },
        { min: 30, icon: "fans_badge_icon_lv30_v4.png~tplv-obj.image" },
        { min: 40, icon: "fans_badge_icon_lv40_v4.png~tplv-obj.image" },
        { min: 50, icon: "fans_badge_icon_lv50_v4.png~tplv-obj.image" }
      ]
    },

    // badgeSceneType 6 — the payload supplies this one's icon
    topGifter: { color: "rgba(254, 44, 85, .4)" },

    // badgeSceneType 1. TikTok's #803F3F3F is Android AARRGGBB: alpha 0x80/255.
    mod: {
      icon: "moderater_badge_icon.png~tplv-obj.image",
      color: "rgba(63, 63, 63, .5)"
    }
  },

  // Every metric below is an em multiple of whatever font-size the badge inherits —
  // nothing here sets one. Drop the elements into a container sized the way TikTok
  // sizes its own (13px text gives the 15px pill) and they come out right; rescale
  // that single font-size and the whole badge follows, which is what lets a widget
  // ship no badge CSS at all.
  _badgeStyle: (() => {
    // A host sets ONE thing — the font-size these badges inherit — and that is the
    // badge's scale. Every proportion is owned here and expressed against it, so a
    // widget never restates the design just to use it:
    //
    //   pill height   1.641em of the inherited size
    //   icon          0.9 of the pill
    //   padding       0.2 of the pill
    //   radius        0.267 of the pill
    //   border        0.067 of the pill, floored at 1px so it cannot vanish
    //
    // Where 1.641 and 0.9 come from: the multistream chat overlay draws badge text at
    // 0.65 of its --font and every platform's badge at --chip (1.067 of --font), so a
    // pill is 1.067/0.65 = 1.641 times its own text, with the icon at 0.9 of that.
    // The icon is the one part allowed past 1.0, where it grows out over the pill's
    // top and bottom edges the way TikTok draws the super fan.
    //
    // The custom properties below are escape hatches, not part of the contract — a
    // widget that wants to deviate can, but none has to. --tiktok-badge-height:
    // 1.154em gives TikTok's own proportions (13px text in a 15px pill), where the
    // text reads much larger against the pill than it does here.
    const h = 'var(--tiktok-badge-height, 1.6415em)';

    return {
      font: '"TikTok Sans", system-ui, -apple-system, sans-serif',
      height: h,
      radius: `calc(${h} * 0.267)`,
      pad: `calc(${h} * 0.2)`,
      // Never allowed to vanish sub-pixel. calc(-1 * …) because a function can't be
      // negated by writing a minus in front of it.
      border: `max(1px, calc(${h} * 0.067))`,
      borderNeg: `calc(-1 * max(1px, calc(${h} * 0.067)))`,
      // Shared by every badge so the super fan's icon comes out the same size as the
      // flat chips' — only the pill around it differs. Width is always left to the
      // art's own aspect ratio.
      iconHeight: `var(--tiktok-badge-icon, calc(${h} * 0.9))`
    };
  })(),

  _icon(icon) {
    return TikTok._badgeData.base + icon;
  },

  // Tiers are listed low to high, so the last one the level clears wins. A level
  // below the first tier means the badge isn't really earned yet.
  _tier(tiers, level) {
    return typeof level === 'number' ? tiers.filter((t) => level >= t.min).pop() : null;
  },

  _scene(data, sceneType) {
    return (data?.userBadges || []).find((b) => b && b.badgeSceneType === sceneType) || null;
  },

  // These elements are handed out fully built, so there is no widget-side image
  // guard to fall back on: a dropped CDN request has to leave the pill and its text
  // rather than a broken-image glyph.
  _badgeImg(src, css) {
    const img = document.createElement('img');
    img.alt = '';
    img.style.cssText = css;
    img.onerror = () => img.remove();
    img.src = src;
    return img;
  },

  // Grade, plain fan club, top gifter and moderator: a flat one-toned pill with the
  // icon contained inside it, beside the text. Deliberately not the super fan's
  // shape — TikTok gives only that one the two-tone cap and the borders.
  _buildChip({ icon, text, label, background }) {
    const style = TikTok._badgeStyle;

    const badge = document.createElement('div');
    if (label) badge.title = label;
    badge.style.cssText = [
      'display:inline-flex', 'align-items:center', 'justify-content:center',
      'box-sizing:border-box', `height:${style.height}`,
      `padding:0 ${style.pad}`, 'gap:0.15em',
      `border-radius:${style.radius}`, `background:${background}`,
      `font-family:${style.font}`, 'font-weight:700', 'line-height:1',
      // text-shadow:none because a chat header commonly sets one for legibility over
      // video, and it inherits straight into the badge's own text.
      'color:#fff', 'text-shadow:none', 'white-space:nowrap',
      'vertical-align:middle', 'user-select:none'
    ].join(';');

    badge.appendChild(TikTok._badgeImg(
      icon,
      `height:${style.iconHeight};width:auto;object-fit:contain;display:block`
    ));

    // No text means no gap and no span — the padding closes up around the icon.
    if (text) {
      const span = document.createElement('span');
      span.textContent = text;
      badge.appendChild(span);
    }

    return badge;
  },

  // The one badge TikTok draws differently: the icon sits on a darker cap panel with
  // a border of its own, inside a pill that carries a second border. The icon itself
  // is the same size as every other badge's — only the pill around it differs.
  //
  // The cap is a normal flex child, not an absolutely positioned box, so it shrink-
  // wraps whatever the icon's aspect ratio turns out to be; negative margins pull it
  // back over the pill's own border so the two borders meet instead of stacking.
  createSuperFanBadge(data, { fansClubName = '' } = {}) {
    const style = TikTok._badgeStyle;
    const theme = TikTok._badgeData.fanSubscriber;

    const fan = TikTok._scene(data, 10);
    const tier = fan && TikTok._tier(theme.tiers, fan.level);
    if (!tier) return null;

    const text = String(fansClubName || '');

    const badge = document.createElement('div');
    badge.title = `Fan level ${fan.level}`;
    badge.style.cssText = [
      'display:inline-flex', 'align-items:center', 'box-sizing:border-box',
      `height:${style.height}`,
      // No club name to show means no pill to show either — the cap below pulls
      // flush to the right edge and the badge is just the capped icon.
      `padding:0 ${text ? style.pad : '0'} 0 0`,
      `border:${style.border} solid ${theme.border}`,
      `border-radius:${style.radius}`, `background:${theme.background}`,
      `font-family:${style.font}`, 'line-height:1',
      // text-shadow:none because a chat header commonly sets one for legibility over
      // video, and it inherits straight into the badge's own text.
      'color:#fff', 'text-shadow:none', 'white-space:nowrap',
      'vertical-align:middle', 'user-select:none'
    ].join(';');

    const panel = document.createElement('div');
    panel.style.cssText = [
      'flex:none', 'display:flex', 'align-items:center', 'justify-content:center',
      'box-sizing:border-box', `height:${style.height}`, `padding:0 ${style.pad}`,
      // Top/bottom/left sit the cap's border exactly on the pill's; the right is
      // the gap to the text, or another overlap when there is no text.
      `margin:${style.borderNeg} ${text ? style.pad : style.borderNeg} ${style.borderNeg} ${style.borderNeg}`,
      `border:${style.border} solid ${theme.border}`,
      `border-radius:${style.radius}`, `background:${theme.panel}`
    ].join(';');

    panel.appendChild(TikTok._badgeImg(
      TikTok._icon(tier.icon),
      `height:${style.iconHeight};width:auto;object-fit:contain;display:block`
    ));
    badge.appendChild(panel);

    if (text) {
      const span = document.createElement('span');
      span.textContent = text;
      span.style.cssText = [
        'font-weight:700', 'letter-spacing:0.015em', 'white-space:nowrap',
        'transform:scaleX(0.94)', 'transform-origin:left center'
      ].join(';');
      badge.appendChild(span);
    }

    return badge;
  },

  createGradeBadge(data) {
    const grade = TikTok._scene(data, 8);
    const tier = grade && TikTok._tier(TikTok._badgeData.grade, grade.level);
    if (!tier) return null;

    return TikTok._buildChip({
      icon: TikTok._icon(tier.icon),
      text: String(grade.level),
      label: `Level ${grade.level}`,
      background: tier.color
    });
  },

  // The chip's text is the club's name, which the payload never carries — it comes
  // from the widget's own settings. Without it the icon stands alone. A subscribed
  // member is a "super fan" and gets its own shape entirely.
  createFanBadge(data, { fansClubName = '' } = {}) {
    if (data?.isSubscriber) return TikTok.createSuperFanBadge(data, { fansClubName });

    const fan = TikTok._scene(data, 10);
    const tier = fan && TikTok._tier(TikTok._badgeData.fan, fan.level);
    if (!tier) return null;

    return TikTok._buildChip({
      icon: TikTok._icon(tier.icon),
      text: fansClubName ? String(fansClubName) : '',
      label: `Fan level ${fan.level}`,
      background: tier.color
    });
  },

  // The only badge whose art the payload ships. Its rank lives on the message
  // rather than on the badge.
  createTopGifterBadge(data) {
    const gifter = TikTok._scene(data, 6);
    if (!gifter || !gifter.url) return null;

    return TikTok._buildChip({
      icon: gifter.url,
      text: data.topGifterRank > 0 ? `No. ${data.topGifterRank}` : '',
      label: 'Top gifter',
      background: TikTok._badgeData.topGifter.color
    });
  },

  // Announced twice — as a scene-1 badge and as a top-level flag — and not always
  // both, so take either.
  createModBadge(data) {
    if (!data || (!data.isModerator && !TikTok._scene(data, 1))) return null;

    return TikTok._buildChip({
      icon: TikTok._icon(TikTok._badgeData.mod.icon),
      label: 'Moderator',
      background: TikTok._badgeData.mod.color
    });
  },

  // Returns finished DOM elements rather than descriptors, in the order TikTok
  // paints them — grade, fan club, top gifter, mod — which is not the order they
  // arrive in. Append them and you're done.
  //
  // Build a fresh set per message: these are live nodes, so reusing one array across
  // messages moves the badges to the newest one instead of copying them.
  createBadges(data, { fansClubName = '' } = {}) {
    if (!data) return [];

    return [
      TikTok.createGradeBadge(data),
      TikTok.createFanBadge(data, { fansClubName }),
      TikTok.createTopGifterBadge(data),
      TikTok.createModBadge(data)
    ].filter(Boolean);
  },

  /* --------------------------------------------------------------- private -- */

  // Escapes text before it goes into innerHTML. Duplicated from Utils rather than
  // depended on, so this file stands alone — see the header.
  _escape(value) {
    const chars = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return String(value ?? '').replace(/[&<>"']/g, (char) => chars[char]);
  }
};
