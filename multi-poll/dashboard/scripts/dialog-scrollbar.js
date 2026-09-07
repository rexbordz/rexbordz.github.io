// dashboard/scripts/dialog-scrollbar.js — gives <wa-dialog>'s scrolling body the same
// custom scrollbar as the rest of the dashboard.
//
// Why this needs JS at all: the dialog body lives in wa-dialog's shadow root, so from
// the document the only handle on it is `wa-dialog::part(body)`. Chaining a
// ::-webkit-scrollbar pseudo onto ::part() parses in current Chromium but is a syntax
// error in the older CEF that OBS embeds, so `wa-dialog::part(body)::-webkit-scrollbar`
// silently does nothing there and the dialog falls back to the native scrollbar —
// arrow buttons and all. (Plain `wa-dialog::part(body) { overflow-y: auto }` is fine;
// it's only the ::-webkit-scrollbar chaining that breaks.)
//
// Injecting the rules *inside* the shadow root sidesteps ::part() entirely: there the
// body is reachable as a plain attribute selector, which every engine handles.
// Keep these values in sync with the page scrollbar in style.css.

const SCROLLBAR_CSS = `
  [part~="body"]::-webkit-scrollbar {
    width: 10px;
    height: 10px;
  }

  [part~="body"]::-webkit-scrollbar-button {
    display: none;
    width: 0;
    height: 0;
  }

  [part~="body"]::-webkit-scrollbar-track {
    background: #1c1c1c;
  }

  [part~="body"]::-webkit-scrollbar-thumb {
    background-color: #555;
    border-radius: 999px;
    border: 2px solid transparent;
    background-clip: padding-box;
  }

  [part~="body"]::-webkit-scrollbar-thumb:hover {
    background-color: #777;
  }
`;

const MARKER = "data-mp-scrollbar";

/** Injects the scrollbar rules into one dialog's shadow root. Safe to call repeatedly. */
async function injectInto(dialog) {
  // Lit renders the shadow root asynchronously; without this the root can still be empty.
  try {
    await dialog.updateComplete;
  } catch {
    // A dialog that failed to render is not worth blocking the others over.
  }

  const shadow = dialog.shadowRoot;
  if (!shadow || shadow.querySelector(`style[${MARKER}]`)) return;

  const style = document.createElement("style");
  style.setAttribute(MARKER, "");
  style.textContent = SCROLLBAR_CSS;
  shadow.append(style);
}

/** Styles every <wa-dialog> currently in the document. */
export async function styleDialogScrollbars(root = document) {
  await customElements.whenDefined("wa-dialog");
  await Promise.all([...root.querySelectorAll("wa-dialog")].map(injectInto));
}
