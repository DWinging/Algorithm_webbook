# Algorithm WebBook

## Build

```bash
node build-static-index.cjs
```

## Local Preview

```bash
python -m http.server 5500
```

Open:

```text
http://localhost:5500
```

If Python is not available, use any static file server from the project root.

## PDF Export

When saving as PDF, disable the browser print option named "Headers and footers" or "머리글과 바닥글".

For best visual output, enable "Background graphics" so cover, chapter cover, and editorial card backgrounds are preserved.

## Replace Images

The current image slots are placeholders. Replace these files when artwork is ready:

- `assets/images/book-cover.webp`
- `assets/images/back-cover.webp`
- `assets/images/chapter3-path.webp`
- `assets/images/chapter3-grid.webp`
