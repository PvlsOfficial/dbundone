// Font discovery for Cover Lab text layers.
//
// Tries the Local Font Access API (Chromium / WebView2) to enumerate every font
// installed on the user's machine, and always merges in a large curated set of
// common families as a fallback so there's plenty to choose from regardless.

const CURATED_FONTS = [
  "Geist",
  "Arial", "Arial Black", "Helvetica", "Helvetica Neue", "Verdana", "Tahoma", "Trebuchet MS",
  "Segoe UI", "Calibri", "Candara", "Corbel", "Franklin Gothic Medium", "Century Gothic",
  "Gill Sans", "Gill Sans MT", "Futura", "Avenir", "Avenir Next", "Optima", "Geneva",
  "Lucida Grande", "Lucida Sans", "Lucida Console", "Microsoft Sans Serif",
  "Times New Roman", "Times", "Georgia", "Garamond", "Palatino", "Palatino Linotype",
  "Book Antiqua", "Bookman Old Style", "Baskerville", "Cambria", "Constantia", "Didot",
  "Bodoni MT", "Rockwell", "Courier New", "Courier", "Consolas", "Monaco", "Menlo",
  "Cascadia Code", "Cascadia Mono", "Lucida Sans Typewriter", "Andale Mono", "DejaVu Sans Mono",
  "Impact", "Haettenschweiler", "Bebas Neue", "Oswald", "Anton", "Comic Sans MS",
  "Brush Script MT", "Segoe Script", "Segoe Print", "Ink Free", "Pacifico", "Lobster",
  "Copperplate", "Papyrus", "Stencil", "Cooper Black", "Goudy Stout", "Bahnschrift",
  "Roboto", "Open Sans", "Lato", "Montserrat", "Poppins", "Inter", "Raleway", "Nunito",
  "Source Sans Pro", "Playfair Display", "Merriweather", "Work Sans", "Quicksand",
  "sans-serif", "serif", "monospace", "cursive", "fantasy",
]

let cached: string[] | null = null

export async function getAvailableFonts(): Promise<string[]> {
  if (cached) return cached
  const set = new Set<string>(CURATED_FONTS)
  try {
    const query = (window as unknown as { queryLocalFonts?: () => Promise<Array<{ family: string }>> }).queryLocalFonts
    if (typeof query === "function") {
      const fonts = await query.call(window)
      for (const f of fonts) {
        if (f.family) set.add(f.family)
      }
    }
  } catch {
    // Permission denied / unsupported — curated list still applies.
  }
  cached = Array.from(set).sort((a, b) => a.localeCompare(b))
  return cached
}
