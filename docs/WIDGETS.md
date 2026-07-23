# Writing a PiBoard widget / Écrire un widget PiBoard

**EN** — A widget is a self-contained folder inside `public/widgets/`. The server discovers it automatically at startup; no core code changes are needed.

**FR** — Un widget est un dossier autonome dans `public/widgets/`. Le serveur le découvre automatiquement au démarrage ; aucun code du cœur à modifier.

```
public/widgets/mywidget/
├── manifest.json    # identity, default size, settings schema
├── widget.js        # a class registered on window.PiBoard
├── widget.css       # optional styles (prefix your classes!)
└── icon.svg         # icon shown in the catalog
```

## manifest.json

```json
{
  "id": "mywidget",
  "version": "0.1.0",
  "name": { "en": "My widget", "fr": "Mon widget" },
  "description": { "en": "What it does.", "fr": "Ce qu'il fait." },
  "size": { "w": 3, "h": 2, "minW": 2, "minH": 2, "maxW": 6, "maxH": 4 },
  "settings": [
    { "key": "title", "type": "text", "default": "",
      "label": { "en": "Title", "fr": "Titre" } },
    { "key": "count", "type": "number", "default": 5, "min": 1, "max": 20, "step": 1,
      "label": { "en": "Items", "fr": "Éléments" } },
    { "key": "enabled", "type": "checkbox", "default": true,
      "label": { "en": "Enabled", "fr": "Activé" } },
    { "key": "mode", "type": "select", "default": "a",
      "label": { "en": "Mode", "fr": "Mode" },
      "options": [
        { "value": "a", "label": { "en": "Mode A", "fr": "Mode A" } },
        { "value": "b", "label": { "en": "Mode B", "fr": "Mode B" } }
      ] }
  ]
}
```

- `size` is expressed in grid cells (the grid is 12 columns wide; screen height defaults to 8 rows).
- `"titleBar": true` (optional) shows the universal title bar by default for this widget. Every tile automatically gets core-managed appearance settings in its form — show title bar, custom title, and a custom tile color — stored under the reserved keys `_showTitle`, `_title`, `_customColor`, `_bgColor` (never use keys starting with `_` in your own settings schema). The default title is the localized widget `name`; the default color is the current theme's tile color.
- Field `type`: `text`, `number`, `checkbox`, `select`, `textarea`, `datetime`, `color`, `time`. The tile settings form is generated automatically from this schema.
- Any field can carry an optional `hint`: a short bilingual note rendered under the field (small, muted text; inline `<code>` and `<a>` are fine). Use it for anything that isn't obvious from the label alone — where to find an ID, what format is expected, a link to the source's documentation. Example: `{ "key": "league", "type": "text", "default": "", "label": {...}, "hint": { "en": "Find it on ESPN's scoreboard page — see <a href=\"...\">docs</a>.", "fr": "..." } }`.
- `name`, `description`, `label`, `hint` accept `{ "en": …, "fr": … }` objects or plain strings.

## widget.js

```js
(function () {
  "use strict";

  class MyWidget {
    constructor(ctx) {
      this.ctx = ctx;
      // ctx.el         -> tile body element (render inside it)
      // ctx.settings   -> current settings (defaults merged)
      // ctx.instanceId -> unique per tile ("t-…")
      // ctx.manifest   -> your manifest
      // ctx.i18n       -> { t(key), lang, fromManifest(obj) }
      // ctx.api.state  -> get(key) / put(key, value): server-side JSON storage
      // ctx.api.proxyUrl(url) -> proxied URL (bypasses CORS for feeds)
    }

    async init() { /* first render; may be async */ }

    onSettingsChanged(settings) { /* optional; else the tile is re-created */ }

    onLangChanged(lang) { /* optional */ }

    destroy() { /* clear timers, observers… */ }
  }

  window.PiBoard.registerWidget("mywidget", MyWidget);
})();
```

Guidelines / bonnes pratiques :

- **Prefix your CSS classes** (e.g. `.pw-mywidget …`) — all widget stylesheets share the page.
- Use the theme variables so both themes work: `var(--text)`, `var(--muted)`, `var(--faint)`, `var(--tile-edge)`, `var(--accent)`, `var(--font)`, `var(--mono)`. This also makes the per-tile custom color picker work correctly: when someone picks a custom background for a tile, the core automatically switches `--text`/`--muted`/`--faint` to a light or dark palette based on that color's luminance. Hardcoding a color (instead of referencing these variables) will look fine by default but stay unreadable on a custom-colored tile.
- Scale your typography with the tile size (`el.clientHeight`) — the board is read from across the room.
- Always clean up in `destroy()`: the tile can be removed or re-created at any time.
- Per-tile persistent data goes through `ctx.api.state` with a key that includes `ctx.instanceId`.
- The interface is bilingual: provide `en` and `fr` in every label. English is the fallback.
