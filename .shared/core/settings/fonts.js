/* ==========================================================================
 * FontCatalog — what fonts can this machine actually render?
 *
 * Two sources, because neither one is enough on its own:
 *
 *   probeInstalled()  Canvas metric probing against a curated candidate list.
 *                     No permission, no click, every browser, ~milliseconds.
 *                     Only ever finds names that are already on the list.
 *
 *   queryLocal()      The Local Font Access API. Complete and exact, but
 *                     Chromium-desktop-only and it REQUIRES a user gesture on
 *                     every single call — even once the permission has been
 *                     granted, calling it without a click rejects outright.
 *                     That's why there is a button; it can't be avoided.
 *
 * readCache()/writeCache() make the button a one-time cost rather than a
 * per-visit one, and the cache is origin-wide so one click covers every widget.
 * ========================================================================== */

(function () {
  'use strict';

  var CACHE_KEY = 'wsettings:system-fonts';
  var CACHE_VERSION = 1;
  var CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

  /* --------------------------------------------------------- candidate list */

  // Probing can only confirm names it is handed, so this list is the ceiling
  // on what the no-click path can find. Grouped by where the fonts come from;
  // the groups are only for maintenance, the array is flattened on use.
  var CANDIDATES = [
    // -- Windows system ----------------------------------------------------
    'Arial', 'Arial Black', 'Arial Narrow', 'Arial Rounded MT Bold',
    'Bahnschrift', 'Calibri', 'Calibri Light', 'Cambria', 'Cambria Math',
    'Candara', 'Comic Sans MS', 'Consolas', 'Constantia', 'Corbel',
    'Courier New', 'Ebrima', 'Franklin Gothic Medium', 'Gabriola', 'Gadugi',
    'Georgia', 'HoloLens MDL2 Assets', 'Impact', 'Ink Free', 'Javanese Text',
    'Leelawadee UI', 'Lucida Console', 'Lucida Sans Unicode', 'Malgun Gothic',
    'Microsoft Himalaya', 'Microsoft JhengHei', 'Microsoft JhengHei UI',
    'Microsoft New Tai Lue', 'Microsoft PhagsPa', 'Microsoft Sans Serif',
    'Microsoft Tai Le', 'Microsoft YaHei', 'Microsoft YaHei UI',
    'Microsoft Yi Baiti', 'MingLiU-ExtB', 'Mongolian Baiti', 'MS Gothic',
    'MS PGothic', 'MS UI Gothic', 'MV Boli', 'Myanmar Text', 'Nirmala UI',
    'Palatino Linotype', 'Sans Serif Collection', 'Segoe Fluent Icons',
    'Segoe MDL2 Assets', 'Segoe Print', 'Segoe Script', 'Segoe UI',
    'Segoe UI Black', 'Segoe UI Emoji', 'Segoe UI Historic', 'Segoe UI Light',
    'Segoe UI Semibold', 'Segoe UI Symbol', 'Segoe UI Variable', 'SimSun',
    'SimSun-ExtB', 'Sitka Banner', 'Sitka Display', 'Sitka Heading',
    'Sitka Small', 'Sitka Subheading', 'Sitka Text', 'Sylfaen', 'Tahoma',
    'Times New Roman', 'Trebuchet MS', 'Verdana', 'Yu Gothic', 'Yu Gothic UI',

    // -- Windows symbol / dingbat -----------------------------------------
    'Bookshelf Symbol 7', 'Marlett', 'MT Extra', 'Symbol', 'Webdings',
    'Wingdings', 'Wingdings 2', 'Wingdings 3',

    // -- Microsoft Office --------------------------------------------------
    'Aptos', 'Aptos Display', 'Aptos Mono', 'Aptos Narrow', 'Aptos Serif',
    'Bierstadt', 'Grandview', 'Seaford', 'Skeena', 'Tenorite',
    'Agency FB', 'Algerian', 'Baskerville Old Face', 'Bauhaus 93',
    'Bell MT', 'Berlin Sans FB', 'Berlin Sans FB Demi', 'Bernard MT Condensed',
    'Blackadder ITC', 'Bodoni MT', 'Bodoni MT Black', 'Bodoni MT Poster Compressed',
    'Book Antiqua', 'Bookman Old Style', 'Bradley Hand ITC', 'Britannic Bold',
    'Broadway', 'Brush Script MT', 'Californian FB', 'Calisto MT', 'Castellar',
    'Centaur', 'Century', 'Century Gothic', 'Century Schoolbook',
    'Chiller', 'Colonna MT', 'Cooper Black', 'Copperplate Gothic Bold',
    'Copperplate Gothic Light', 'Curlz MT', 'Dubai', 'Edwardian Script ITC',
    'Elephant', 'Engravers MT', 'Eras Bold ITC', 'Eras Demi ITC',
    'Eras Light ITC', 'Eras Medium ITC', 'Felix Titling', 'Footlight MT Light',
    'Forte', 'Franklin Gothic Book', 'Franklin Gothic Demi',
    'Franklin Gothic Heavy', 'Freestyle Script', 'French Script MT',
    'Garamond', 'Gigi', 'Gill Sans MT', 'Gill Sans Nova',
    'Gloucester MT Extra Condensed', 'Goudy Old Style', 'Goudy Stout',
    'Haettenschweiler', 'Harlow Solid Italic', 'Harrington', 'High Tower Text',
    'Imprint MT Shadow', 'Informal Roman', 'Jokerman', 'Juice ITC',
    'Kristen ITC', 'Kunstler Script', 'Lucida Bright', 'Lucida Calligraphy',
    'Lucida Fax', 'Lucida Handwriting', 'Lucida Sans', 'Lucida Sans Typewriter',
    'Magneto', 'Maiandra GD', 'Matura MT Script Capitals', 'Mistral',
    'Modern No. 20', 'Monotype Corsiva', 'Niagara Engraved', 'Niagara Solid',
    'OCR A Extended', 'Old English Text MT', 'Onyx', 'Palace Script MT',
    'Papyrus', 'Parchment', 'Perpetua', 'Perpetua Titling MT', 'Playbill',
    'Poor Richard', 'Pristina', 'Rage Italic', 'Ravie', 'Rockwell',
    'Rockwell Condensed', 'Rockwell Extra Bold', 'Rockwell Nova',
    'Script MT Bold', 'Showcard Gothic', 'Snap ITC', 'Stencil',
    'Tempus Sans ITC', 'Tw Cen MT', 'Tw Cen MT Condensed', 'Viner Hand ITC',
    'Vivaldi', 'Vladimir Script', 'Wide Latin',

    // -- macOS -------------------------------------------------------------
    'American Typewriter', 'Andale Mono', 'Apple Chancery', 'Apple Color Emoji',
    'Apple SD Gothic Neo', 'AppleGothic', 'Arial Hebrew', 'Athelas',
    'Avenir', 'Avenir Book', 'Avenir Next', 'Avenir Next Condensed',
    'Ayuthaya', 'Baghdad', 'Bangla Sangam MN', 'Baskerville', 'Big Caslon',
    'Bodoni 72', 'Bodoni 72 Oldstyle', 'Bodoni 72 Smallcaps', 'Bradley Hand',
    'Chalkboard', 'Chalkboard SE', 'Chalkduster', 'Charter', 'Cochin',
    'Copperplate', 'Courier', 'Damascus', 'Devanagari Sangam MN', 'Didot',
    'DIN Alternate', 'DIN Condensed', 'Futura', 'Geneva', 'Georgia Pro',
    'Gill Sans', 'Helvetica', 'Helvetica Neue', 'Herculanum', 'Hiragino Sans',
    'Hoefler Text', 'Iowan Old Style', 'Kefa', 'Krungthep', 'Lucida Grande',
    'Luminari', 'Marker Felt', 'Menlo', 'Monaco', 'Noteworthy', 'Optima',
    'Palatino', 'Phosphate', 'PT Mono', 'PT Sans', 'PT Serif', 'Rockwell Nova',
    'SF Compact', 'SF Mono', 'SF Pro', 'SF Pro Display', 'SF Pro Text',
    'Savoye LET', 'Seravek', 'SignPainter', 'Skia', 'Snell Roundhand',
    'Superclarendon', 'Thonburi', 'Times', 'Trattatello', 'Zapfino',

    // -- Linux / open source ----------------------------------------------
    'Cantarell', 'DejaVu Sans', 'DejaVu Sans Mono', 'DejaVu Serif',
    'Droid Sans', 'Droid Sans Mono', 'Droid Serif', 'FreeMono', 'FreeSans',
    'FreeSerif', 'Liberation Mono', 'Liberation Sans', 'Liberation Sans Narrow',
    'Liberation Serif', 'Nimbus Mono PS', 'Nimbus Roman', 'Nimbus Sans',
    'Noto Color Emoji', 'Noto Mono', 'Noto Sans', 'Noto Sans Mono',
    'Noto Serif', 'Ubuntu', 'Ubuntu Condensed', 'Ubuntu Mono',
    'URW Bookman', 'URW Gothic',

    // -- Adobe / Creative Cloud -------------------------------------------
    'Acumin Pro', 'Adobe Caslon Pro', 'Adobe Garamond Pro', 'Bickham Script Pro',
    'Minion Pro', 'Myriad Pro', 'Source Code Pro', 'Source Sans 3',
    'Source Sans Pro', 'Source Serif 4', 'Source Serif Pro', 'Trajan Pro',

    // -- Google Fonts / free faces streamers commonly install --------------
    'Alfa Slab One', 'Anton', 'Archivo', 'Archivo Black', 'Arvo', 'Asap',
    'Bangers', 'Barlow', 'Barlow Condensed', 'Bebas Neue', 'Bitter',
    'Cabin', 'Cairo', 'Caveat', 'Chakra Petch', 'Comfortaa', 'Cormorant Garamond',
    'Crimson Text', 'DM Sans', 'DM Serif Display', 'Dosis', 'EB Garamond',
    'Exo', 'Exo 2', 'Figtree', 'Fira Code', 'Fira Sans', 'Fjalla One',
    'Fredoka', 'Fredoka One', 'Heebo', 'Hind', 'IBM Plex Mono', 'IBM Plex Sans',
    'IBM Plex Serif', 'Inconsolata', 'Inter', 'Inter Tight', 'Josefin Sans',
    'Jost', 'JetBrains Mono', 'Kanit', 'Karla', 'Lato', 'League Spartan',
    'Lexend', 'Libre Baskerville', 'Libre Franklin', 'Lobster', 'Lora',
    'Luckiest Guy', 'Manrope', 'Merriweather', 'Montserrat',
    'Montserrat Alternates', 'Mulish', 'Nunito', 'Nunito Sans', 'Open Sans',
    'Orbitron', 'Oswald', 'Outfit', 'Overpass', 'Pacifico', 'Permanent Marker',
    'Playfair Display', 'Plus Jakarta Sans', 'Poppins', 'Prompt', 'Quicksand',
    'Raleway', 'Righteous', 'Roboto', 'Roboto Condensed', 'Roboto Flex',
    'Roboto Mono', 'Roboto Serif', 'Roboto Slab', 'Rubik', 'Russo One',
    'Satoshi', 'Sora', 'Space Grotesk', 'Space Mono', 'Teko', 'Titillium Web',
    'Ubuntu Sans', 'Unbounded', 'Urbanist', 'Varela Round', 'Work Sans',
    'Yanone Kaffeesatz', 'Zilla Slab',

    // -- Monospace / coding faces -----------------------------------------
    'Cascadia Code', 'Cascadia Mono', 'Courier Prime', 'Hack', 'Input Mono',
    'Iosevka', 'MonaLisa', 'Monaspace Neon', 'Operator Mono', 'Victor Mono',

    // -- Faces some widget in this repo ships as a webfont -----------------
    // Listed only so probing recognises them if they're installed locally.
    // Which fonts a widget actually bundles is that widget's own business —
    // it declares them in its settings.json as `bundledFonts`.
    'TikTok Sans',
  ];

  // These render their own names as gibberish, so the picker labels them in
  // the UI font instead of previewing them.
  var SYMBOL_FONTS = [
    'Bookshelf Symbol 7', 'HoloLens MDL2 Assets', 'Marlett', 'MT Extra',
    'Segoe Fluent Icons', 'Segoe MDL2 Assets', 'Symbol', 'Webdings',
    'Wingdings', 'Wingdings 2', 'Wingdings 3',
  ];

  var symbolLookup = {};
  SYMBOL_FONTS.forEach(function (name) { symbolLookup[name.toLowerCase()] = true; });

  /* ------------------------------------------------------------- probing */

  // Glyphs picked for maximum width spread between typefaces: wide round
  // lowercase, narrow verticals, and digits (which many display faces set to
  // a distinctive width).
  var PROBE_TEXT = 'mmmwwwiiilll0123456789';
  var PROBE_SIZE = '72px';
  var PROBE_BASES = ['monospace', 'sans-serif', 'serif'];

  var probeContext = null;

  function getProbeContext() {
    if (!probeContext) {
      var canvas = document.createElement('canvas');
      probeContext = canvas.getContext && canvas.getContext('2d');
    }
    return probeContext;
  }

  // A family name goes into a CSS font shorthand, so double quotes and
  // backslashes have to go.
  function cssFamily(name) {
    return '"' + String(name).replace(/[\\"]/g, '') + '"';
  }

  function measure(ctx, fontSpec) {
    ctx.font = fontSpec;
    return ctx.measureText(PROBE_TEXT).width;
  }

  /**
   * Canvas metric probing: render the probe string in "<name>, <base>" and in
   * <base> alone. If the widths differ, <name> was used, so it's installed.
   * All three bases are tried because a font can coincidentally match one.
   *
   * @param {string[]} [names] defaults to the full candidate list
   * @returns {string[]} installed names, sorted
   */
  function probeInstalled(names) {
    var ctx = getProbeContext();
    if (!ctx) return [];

    var list = names || CANDIDATES;
    var baseWidths = PROBE_BASES.map(function (base) {
      return measure(ctx, PROBE_SIZE + ' ' + base);
    });

    var found = [];
    list.forEach(function (name) {
      var family = cssFamily(name);
      for (var i = 0; i < PROBE_BASES.length; i += 1) {
        var width = measure(ctx, PROBE_SIZE + ' ' + family + ', ' + PROBE_BASES[i]);
        if (width !== baseWidths[i]) {
          found.push(name);
          return;
        }
      }
    });

    return sortNames(found);
  }

  /* ------------------------------------------------- local font access API */

  function supportsLocalFonts() {
    return typeof window.queryLocalFonts === 'function';
  }

  /**
   * The complete installed list. MUST be called from inside a click handler —
   * without transient activation this rejects with SecurityError even when the
   * permission has already been granted.
   *
   * @returns {Promise<string[]>} unique family names, sorted
   * @throws {Error} with .reason of 'unsupported' | 'denied' | 'blocked' | 'failed'
   */
  async function queryLocal() {
    if (!supportsLocalFonts()) throw catalogError('unsupported', 'This browser cannot list system fonts.');

    var records;
    try {
      records = await window.queryLocalFonts();
    } catch (error) {
      var name = error && error.name;
      if (name === 'NotAllowedError') throw catalogError('denied', 'Font access was blocked.');
      if (name === 'SecurityError') throw catalogError('blocked', 'Font access is not permitted here.');
      throw catalogError('failed', (error && error.message) || 'Could not read system fonts.');
    }

    var seen = {};
    var families = [];
    (records || []).forEach(function (record) {
      var family = record && record.family;
      if (!family) return;
      var key = family.toLowerCase();
      if (seen[key]) return;
      seen[key] = true;
      families.push(family);
    });

    return sortNames(families);
  }

  function catalogError(reason, message) {
    var error = new Error(message);
    error.reason = reason;
    return error;
  }

  /* --------------------------------------------------------------- cache */

  function readCache() {
    var raw;
    try {
      raw = localStorage.getItem(CACHE_KEY);
    } catch (error) {
      return null; // private mode / storage disabled
    }
    if (!raw) return null;

    try {
      var parsed = JSON.parse(raw);
      if (!parsed || parsed.v !== CACHE_VERSION || !Array.isArray(parsed.fonts)) return null;
      if (!parsed.at || Date.now() - parsed.at > CACHE_MAX_AGE_MS) return null;
      return parsed.fonts;
    } catch (error) {
      return null;
    }
  }

  function writeCache(fonts) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        v: CACHE_VERSION,
        at: Date.now(),
        fonts: fonts,
      }));
    } catch (error) {
      console.warn('Could not cache the system font list', error);
    }
  }

  function clearCache() {
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch (error) {
      /* nothing to do */
    }
  }

  /* --------------------------------------------------------------- utils */

  function sortNames(names) {
    return names.slice().sort(function (a, b) {
      return a.localeCompare(b, undefined, { sensitivity: 'base' });
    });
  }

  /** Union of every list passed in, case-insensitively deduped and sorted. */
  function merge() {
    var seen = {};
    var out = [];

    Array.prototype.forEach.call(arguments, function (list) {
      (list || []).forEach(function (name) {
        if (!name) return;
        var trimmed = String(name).trim();
        if (!trimmed) return;
        var key = trimmed.toLowerCase();
        if (seen[key]) return;
        seen[key] = true;
        out.push(trimmed);
      });
    });

    return sortNames(out);
  }

  function isSymbolFont(name) {
    return Boolean(symbolLookup[String(name).trim().toLowerCase()]);
  }

  window.FontCatalog = {
    CANDIDATES: CANDIDATES,
    cssFamily: cssFamily,
    probeInstalled: probeInstalled,
    supportsLocalFonts: supportsLocalFonts,
    queryLocal: queryLocal,
    readCache: readCache,
    writeCache: writeCache,
    clearCache: clearCache,
    merge: merge,
    isSymbolFont: isSymbolFont,
  };
})();
