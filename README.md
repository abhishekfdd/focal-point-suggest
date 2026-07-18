# Focal Point Suggest

Never crop out a face again.

A WordPress plugin that suggests a focal point for Cover block images by
detecting faces **locally in the browser** (WASM — no image ever leaves the
site). The suggestion appears in the block inspector, where you can accept,
reject, or fine-tune it with the standard focal point picker.

> **Status:** early development.

## Development

Requires Node.js 20+ and a running WordPress site (this plugin lives in
`wp-content/plugins/`).

```bash
npm install
npm run start   # watch mode
```

Then activate **Focal Point Suggest** in wp-admin and open a post with a
Cover block.

```bash
npm run build   # production build
npm run test:unit
```

## License

GPL-2.0-or-later.
