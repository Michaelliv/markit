---
name: markit
description: Convert files and URLs to clean Markdown using the markit CLI. Supports PDF, DOCX, PPTX, XLSX, HTML, EPUB, Jupyter, RSS, CSV, JSON, YAML, XML, images, audio, ZIP, and more.
argument-hint: <file-or-url>
metadata:
  author: Michaelliv
  version: "0.2.0"
---

# markit

Convert anything to clean Markdown. PDFs, DOCX, PPTX, XLSX, HTML, EPUB, Jupyter notebooks, RSS feeds, images, audio, URLs, and more.

## When to use

- User asks to convert a file to Markdown
- User wants to extract text content from a PDF, Word doc, spreadsheet, or other document
- User wants to convert a web page or URL to Markdown
- User needs to read/parse a document format that isn't plain text
- User wants to process images (EXIF + AI description) or audio (metadata + transcription)

## Inputs

- `source`: A file path, URL, or `-` for stdin.

## Prerequisites

The `markit` CLI must be installed. If not available, install it:

```bash
npm install -g markit-ai
```

## Steps

1. Determine the source: file path, URL, or stdin.
2. Run the conversion:
   ```bash
   npx markit-ai <source> -q
   ```
   - Use `-q` (quiet) for raw Markdown output without decoration.
   - Use `--json` for structured JSON output with `{ markdown, title }`.
   - Use `-o <file>` to write output to a file.
   - Use `-p "<text>"` to add extra instructions for AI image description.
3. If the format is not supported, run `npx markit-ai formats` to check available formats.
4. Present the converted Markdown to the user.

## Supported formats

| Format      | Extensions                          |
| ----------- | ----------------------------------- |
| PDF         | `.pdf`                              |
| Word        | `.docx`                             |
| PowerPoint  | `.pptx`                             |
| Excel       | `.xlsx`                             |
| HTML        | `.html`, `.htm`                     |
| EPUB        | `.epub`                             |
| Jupyter     | `.ipynb`                            |
| RSS/Atom    | `.rss`, `.atom`, `.xml`             |
| CSV         | `.csv`, `.tsv`                      |
| JSON        | `.json`                             |
| YAML        | `.yaml`, `.yml`                     |
| XML         | `.xml`, `.svg`                      |
| Images      | `.jpg`, `.png`, `.gif`, `.webp`     |
| Audio       | `.mp3`, `.wav`, `.m4a`, `.flac`     |
| ZIP         | `.zip` (recursively converts files) |
| Plain text  | `.txt`, `.md`, `.rst`, `.log`       |
| Code        | `.py`, `.js`, `.ts`, `.go`, `.rs`   |
| URLs        | `http://`, `https://`               |
| Wikipedia   | `*.wikipedia.org` URLs              |

## Examples

```bash
# Convert a PDF
npx markit-ai report.pdf -q

# Convert a web page
npx markit-ai https://example.com -q

# Convert and save to file
npx markit-ai document.docx -q -o doc.md

# Get JSON output
npx markit-ai report.pdf --json

# Read from stdin
cat file.pdf | npx markit-ai - -q

# Describe an image with extra prompt
npx markit-ai photo.jpg -q -p "Focus on the text in the image"
```

## Programmatic usage

markit can also be used as a library:

```typescript
import { Markit } from "markit-ai";

const markit = new Markit();
const result = await markit.convertFile("report.pdf");
console.log(result.markdown);

const urlResult = await markit.convertUrl("https://example.com");
console.log(urlResult.markdown);
```
