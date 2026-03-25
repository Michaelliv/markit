# markit ✓

Convert anything to markdown. Everything gets milled.

```bash
npm install -g markit-ai
```

## The Problem

Your agent needs to read a PDF. Or a DOCX. Or a spreadsheet someone emailed you. Or a web page. Or an EPUB. Or slides from a meeting.

But agents speak markdown.

```bash
markit report.pdf
```

That's it. PDF goes in, markdown comes out. Same for everything else.

---

## Quick Start

```bash
# Documents
markit report.pdf
markit document.docx
markit slides.pptx

# Data
markit data.csv
markit config.json
markit schema.yaml

# Web
markit https://example.com/article
markit https://en.wikipedia.org/wiki/Markdown

# Media (with AI features — set OPENAI_API_KEY)
markit photo.jpg              # EXIF metadata + AI description
markit recording.mp3          # Audio metadata + transcription

# Write to file
markit report.pdf -o report.md

# Pipe it
markit report.pdf | pbcopy
markit data.xlsx -q | napkin create "Imported Data"
```

---

## Supported Formats

| Format | Extensions | How |
|--------|-----------|-----|
| PDF | `.pdf` | Text extraction via unpdf |
| Word | `.docx` | mammoth → turndown, preserves headings/tables |
| PowerPoint | `.pptx` | XML parsing, slides + notes + tables |
| Excel | `.xlsx` `.xls` | Each sheet → markdown table *(optional dep)* |
| HTML | `.html` `.htm` | turndown, scripts/styles stripped |
| EPUB | `.epub` | Spine-ordered chapters, metadata header |
| Jupyter | `.ipynb` | Markdown cells + code + outputs |
| RSS/Atom | `.rss` `.atom` `.xml` | Feed items with dates and content |
| CSV/TSV | `.csv` `.tsv` | Markdown tables |
| JSON | `.json` | Pretty-printed code block |
| YAML | `.yaml` `.yml` | Code block |
| XML/SVG | `.xml` `.svg` | Code block |
| Images | `.jpg` `.png` `.gif` `.webp` | EXIF metadata + optional AI description |
| Audio | `.mp3` `.wav` `.m4a` `.flac` | Metadata + optional AI transcription |
| ZIP | `.zip` | Recursive — converts each file inside |
| URLs | `http://` `https://` | Fetches with `Accept: text/markdown` |
| Wikipedia | `*.wikipedia.org` | Main content extraction |
| Code | `.py` `.ts` `.go` `.rs` ... | Fenced code block |
| Plain text | `.txt` `.md` `.rst` `.log` | Pass-through |

---

## AI Features

Images and audio get metadata extraction for free. For AI-powered descriptions and transcription, set an API key:

```bash
export OPENAI_API_KEY=sk-...
markit photo.jpg        # EXIF + "A sunset over mountains with..."
markit interview.mp3    # Metadata + full transcript
```

Or configure it:

```bash
markit init
markit config set llm.apiKey sk-...
markit config set llm.model gpt-4o-mini
```

Works with any OpenAI-compatible API (OpenAI, Azure, Ollama, etc.):

```bash
markit config set llm.apiBase http://localhost:11434/v1
```

---

## For Agents

Every command supports `--json`. Raw markdown with `-q`.

```bash
# Structured output for parsing
markit report.pdf --json

# Raw markdown, nothing else
markit report.pdf -q

# Teach your agent about mill
markit onboard
```

---

## SDK

markit is also a library:

```typescript
import { Markit } from "markit-ai";

const markit = new Markit();
const { markdown } = await markit.convertFile("report.pdf");
const { markdown } = await markit.convertUrl("https://example.com");
const { markdown } = await markit.convert(buffer, { extension: ".docx" });
```

With AI features — pass plain functions, use any provider:

```typescript
import OpenAI from "openai";
import { Markit } from "markit-ai";

const openai = new OpenAI();

const markit = new Markit({
  describe: async (image, mime) => {
    const res = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: [
        { type: "text", text: "Describe this image." },
        { type: "image_url", image_url: { url: `data:${mime};base64,${image.toString("base64")}` } },
      ]}],
    });
    return res.choices[0].message.content ?? "";
  },
  transcribe: async (audio, mime) => {
    const res = await openai.audio.transcriptions.create({
      model: "gpt-4o-mini-transcribe",
      file: new File([audio], "audio.mp3", { type: mime }),
    });
    return res.text;
  },
});
```

Mix providers — Claude for vision, OpenAI for audio, whatever:

```typescript
const markit = new Markit({
  describe: async (image, mime) => {
    const res = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: mime, data: image.toString("base64") } },
        { type: "text", text: "Describe this image." },
      ]}],
    });
    return res.content[0].text;
  },
  transcribe: async (audio, mime) => { /* Whisper, Deepgram, AssemblyAI, ... */ },
});
```

Individual converters are importable too:

```typescript
import { PdfConverter, HtmlConverter } from "markit-ai";
```

---

## Configuration

```bash
markit init                              # Create .markit/config.json
markit config show                       # Show resolved settings
markit config get llm.model              # Get a value
markit config set llm.apiKey sk-...      # Set a value
```

`.markit/config.json`:

```json
{
  "llm": {
    "apiBase": "https://api.openai.com/v1",
    "apiKey": "sk-...",
    "model": "gpt-4o",
    "transcriptionModel": "gpt-4o-mini-transcribe"
  }
}
```

Env vars override config:

| Setting | Env var | Config key | Default |
|---------|---------|------------|---------|
| API key | `OPENAI_API_KEY` | `llm.apiKey` | — |
| API base | `OPENAI_BASE_URL` | `llm.apiBase` | `https://api.openai.com/v1` |
| Model | `MARKIT_MODEL` | `llm.model` | `gpt-4o` |
| Transcription | — | `llm.transcriptionModel` | `gpt-4o-mini-transcribe` |

---

## CLI Reference

```bash
markit <source>                          # Convert file or URL
markit <source> -o output.md             # Write to file
markit <source> --json                   # JSON output
markit <source> -q                       # Raw markdown only
cat file.pdf | markit -                  # Read from stdin
markit formats                           # List supported formats
markit init                              # Create .markit/ config
markit config show                       # Show settings
markit config get <key>                  # Get config value
markit config set <key> <value>          # Set config value
markit onboard                           # Add to CLAUDE.md
```

---

## Development

```bash
bun install
bun run dev -- report.pdf
bun test
bun run check
```

## License

MIT
