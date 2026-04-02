# Claufig

**Spec → Figma in minutes via Claude Code + MCP**

Write your screen descriptions in plain language. Claufig sends them to Claude Code, which reads your Design System, generates the components, and pushes the frames directly into Figma.

---

## How it works

```
Your spec (plain text)
    ↓
Claude Code (agent)
    ↓ MCP Figma
Design System tokens extracted
    ↓
React components generated
    ↓
Frames pushed to Figma
```

No manual token copy-paste. No back-and-forth on DS compliance. N screens in one session for visual consistency.

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

### 3. Find your Figma team ID
In Figma, go to your team page. The URL contains your team ID:
`figma.com/files/team/XXXXXXXXXXXXXXXXX/...`

---

## Setup

```bash
git clone https://github.com/YOUR_USERNAME/claufig
cd claufig
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

No `.env.local` needed — Claufig uses your Claude Code OAuth session directly.

---

## Usage

1. **Design System** — paste a Figma file URL (`figma.com/design/...`) or a DS doc URL (`polaris-react.shopify.com`)
2. **Figma Team** — enter your team ID
3. **Screens** — describe each screen in plain language, add as many as you need
4. **Generate** — Claude Code reads the DS, builds the HTML, captures and pushes to Figma

---

## Stack

| Layer | Tool |
|-------|------|
| Agent | Claude Code (`--print --output-format stream-json`) |
| Figma connection | MCP Figma official (`mcp.figma.com/mcp`) |
| Interface | Next.js 14 + Tailwind + Geist |
| Streaming | SSE (`text/event-stream`) |
| DS support | Any URL doc or Figma file |

---

## Notes

- Claude Code runs on your machine — no cloud, no API key needed
- The Figma MCP requires a Pro/Dev seat for unlimited calls (Starter = 6 calls/month)
- All screens are generated in a single Claude Code session for visual consistency
- Output files are saved to `~/spec-to-figma-output/`

---

## Built by

[Pierre Pavlovic](https://linkedin.com/in/pierrepavlovic)

Feel free to open issues or PRs.
