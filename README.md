# Claufig

**Spec → Figma in minutes via Claude Code + MCP**

Write your screen descriptions in plain language. Claufig sends them to Claude Code, which reads your Design System, generates the components, and pushes the frames directly into Figma.

---

## How it works

```
Your spec (plain text)
    ↓
Claude Code (agent)
    ↓ reads Design System (Figma MCP or URL)
DS tokens extracted (colors, spacing, typography)
    ↓
HTML screens generated + served locally
    ↓ Figma MCP
Frames pushed to Figma (new file or existing)
```

No manual token copy-paste. No back-and-forth on DS compliance. N screens in one session for visual consistency.

---

## Features

- 🎨 **Auto-load Figma files** — Your team's Figma files are listed automatically on startup via your Personal Access Token
- 📁 **Target File picker** — Choose to inject screens into an existing Figma file, or create a brand new one
- 🔀 **Layout Variants** — Generate 1, 2 or 3 spatial layout variants for each screen (same style, different component arrangement)
- 📊 **Live progress bar** — Animated header progress bar with percentage and elapsed time
- 🖥️ **Color-coded logs** — 🎨 Figma tool calls, 🌐 web fetches, 🤖 Claude commands each in a distinct color
- 🔗 **Auto-link to Figma** — The output Figma URL is extracted from logs and shown as a clickable link when generation completes

---

## Prerequisites

### 1. Claude Code
```bash
npm install -g @anthropic-ai/claude-code
claude  # authenticate with your claude.ai account
```

### 2. Figma MCP (official server)
```bash
claude mcp add --transport http figma https://mcp.figma.com/mcp --scope user
claude  # then: /mcp → figma → Authenticate → Allow Access
```

### 3. Figma Personal Access Token
Generate one at: **Figma → Settings → Personal access tokens**

The token is used server-side only to list your team files. It is never exposed to the browser.

### 4. Find your Figma Team ID
In Figma, open your team page. Your Team ID is in the URL:
`figma.com/files/team/XXXXXXXXXXXXXXXXX/...`

---

## Setup

```bash
git clone https://github.com/Piheros/Claufig
cd Claufig
npm install
```

Copy the environment template and fill in your values:
```bash
cp .env.example .env.local
```

Edit `.env.local`:
```env
FIGMA_TOKEN=figd_your_personal_access_token
FIGMA_TEAM_ID=your_team_id
```

Then start the dev server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

> ⚠️ Never commit `.env.local` — it is already in `.gitignore`.

---

## Usage

1. **Design System** — paste a Figma file URL (`figma.com/design/...`) or a DS doc URL (e.g. `polaris-react.shopify.com`)
2. **Target File** — the dropdown auto-loads your Figma team files. Choose an existing file to inject screens into, or select "Create a new file"
3. **Screens** — describe each screen in plain language. Use the `1 / 2 / 3` buttons to generate multiple layout variants of the same screen
4. **Generate** — Claude Code reads the DS, builds the HTML, captures each screen and pushes frames to Figma
5. **Open Figma →** — once done, click the link in the footer to jump directly to your file

---

## Stack

| Layer | Tool |
|-------|------|
| Agent | Claude Code (`--print --output-format stream-json`) |
| Figma connection | MCP Figma official (`mcp.figma.com/mcp`) |
| Figma file listing | Figma REST API v1 (via PAT) |
| Interface | Next.js 14 + Tailwind + Geist |
| Streaming | SSE (`text/event-stream`) |
| DS support | Any URL doc or Figma file |

---

## Notes

- Claude Code runs on your machine — no cloud, no LLM API key needed beyond your Claude subscription
- The Figma MCP requires a Pro/Dev seat for unlimited calls (Starter = 6 calls/month)
- All screens are generated in a single Claude Code session for visual consistency
- Output files (HTML, prompts) are saved to `~/spec-to-figma-output/`
- Layout variants share the same design tokens and visual style — only component arrangement differs

---

## Contributing

Feel free to open issues or PRs.
