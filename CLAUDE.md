# mill

Convert anything to markdown. PDFs, DOCX, HTML, URLs — everything gets milled.

## Commands

```bash
bun run dev -- <file-or-url>           # Dev — convert something
bun run dev -- formats                 # List supported formats
bun test                               # Tests
bun run check                          # Biome lint + format
```

## Architecture

- `src/main.ts` — Commander entry point, global --json/--quiet flags
- `src/markit.ts` — Core converter registry. Tries converters in priority order.
- `src/types.ts` — StreamInfo, ConversionResult, Converter interface
- `src/converters/` — One file per format (pdf, docx, html, csv, json, xlsx, plain-text)
- `src/commands/` — CLI commands (convert, formats, onboard)
- `src/utils/output.ts` — Chalk output helpers, triple output (json/quiet/human)

## Key Patterns

- **Converter interface**: Each converter implements `accepts(streamInfo)` and `convert(buffer, streamInfo)`
- **Priority order**: Specific formats first (pdf, docx), generic last (plain-text as catch-all)
- **Output triple**: Every command supports `--json`, `--quiet`, and human-readable output
- **URL support**: `markit https://example.com` fetches with `Accept: text/markdown` header
- **Optional deps**: xlsx is a dynamic import — fails gracefully with install instructions

## Adding a New Converter

1. Create `src/converters/<format>.ts`
2. Implement the `Converter` interface (name, accepts, convert)
3. Import and add to the converters array in `src/markit.ts`
4. Add to the formats list in `src/commands/formats.ts`
