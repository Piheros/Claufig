import { NextRequest } from 'next/server'
import { spawn } from 'child_process'
import * as os from 'os'
import * as path from 'path'
import * as fs from 'fs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isFigmaFile(link: string): boolean {
  return link.includes('figma.com/design/') || link.includes('figma.com/file/')
}

function findClaude(): string {
  const candidates = [
    `${os.homedir()}/.npm-global/bin/claude`,
    `${os.homedir()}/.local/bin/claude`,
    '/usr/local/bin/claude',
    '/opt/homebrew/bin/claude',
  ]
  for (const p of candidates) {
    try { fs.accessSync(p, fs.constants.X_OK); return p } catch {}
  }
  return 'claude'
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const specs: { id: string; label: string; spec: string }[] = body.specs || [{ id: 'page1', label: 'Page', spec: body.spec }]
  const dsLink: string = body.figmaLink
  const figmaTeam: string = body.figmaTeam || ''
  const isFigma = isFigmaFile(dsLink)

  const workDir = path.join(os.homedir(), 'spec-to-figma-output', 'run-' + Date.now())
  fs.mkdirSync(workDir, { recursive: true })

  const unifiedSpec = specs.map((s, i) =>
    `## Screen ${i + 1}: ${s.label}\n\n${s.spec}`
  ).join('\n\n---\n\n')

  const claudeMd = `# Claufig — Agent Rules

## Design system
${isFigma
    ? `Source: Figma file at ${dsLink}\nUse get_design_context and get_variable_defs to extract tokens.`
    : `Source: Documentation at ${dsLink}\nFetch the docs, extract all tokens (colors, spacing, typography, radius), define them as CSS variables.`
}

## Figma output
- Team: ${figmaTeam}
- ALWAYS use planKey: "${figmaTeam}" when calling generate_figma_design — never ask which team, always use this one
- Put all screens in the same Figma file named "Claufig — ${specs.map(s => s.label).join(' · ')}"

## Your task
Build ${specs.length} screen${specs.length > 1 ? 's' : ''} for a cohesive product. Generate them in sequence.

## Screens to build
${unifiedSpec}

## Rules
- Use ONLY DS tokens — never hardcode hex or px values
- Keep visual consistency across all screens
- Push ALL screens to Figma using generate_figma_design with planKey: "${figmaTeam}"
- NEVER ask which team — always use the planKey above
- Name each Figma frame exactly as the screen label above
- Build a local HTML file per screen, serve with python3 http.server, then capture
`
  fs.writeFileSync(path.join(workDir, 'CLAUDE.md'), claudeMd)

  const mcp = { mcpServers: { figma: { type: 'http', url: 'https://mcp.figma.com/mcp' } } }
  fs.writeFileSync(path.join(workDir, '.mcp.json'), JSON.stringify(mcp, null, 2))

  const prompt = [
    'Read CLAUDE.md for full instructions.',
    '',
    isFigma
      ? `Step 1: Call get_design_context with ${dsLink} then get_variable_defs to extract all DS tokens.`
      : `Step 1: Fetch ${dsLink} (and sub-pages like /tokens/color, /tokens/spacing, /tokens/typography) to extract all DS tokens.`,
    '',
    `Step 2: Build ${specs.length} screen${specs.length > 1 ? 's' : ''} in sequence as described in CLAUDE.md.`,
    'For each screen:',
    '  a. Generate a standalone HTML file with DS tokens as CSS variables + Tailwind CDN',
    '  b. Start a python3 http.server on an available port',
    '  c. Call generate_figma_design with outputMode "newFile" (first screen) or "existingFile" (subsequent screens)',
    `  d. ALWAYS use planKey "${figmaTeam}" — do NOT ask which team, use this value directly`,
    '  e. Name the frame exactly as the screen label',
    '',
    'Step 3: Output the Figma file URL and a token audit summary.',
    '',
    `IMPORTANT: planKey is always "${figmaTeam}" — never prompt for team selection.`,
  ].join('\n')

  const promptFile = path.join(workDir, 'prompt.txt')
  fs.writeFileSync(promptFile, prompt, 'utf8')

  const claudeBin = findClaude()
  const encoder = new TextEncoder()
  let controllerClosed = false

  const stream = new ReadableStream({
    start(controller) {
      const send = (type: string, data: string) => {
        if (controllerClosed) return
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, data, page: 'main' })}\n\n`))
        } catch { controllerClosed = true }
      }

      const close = () => {
        if (controllerClosed) return
        controllerClosed = true
        try { controller.close() } catch {}
      }

      send('status', `Starting Claude Code — ${specs.length} screen${specs.length > 1 ? 's' : ''} · team ${figmaTeam}`)
      send('log', `Claude: ${claudeBin}`)

      const cmd = `"${claudeBin}" --print --output-format stream-json --verbose --dangerously-skip-permissions < "${promptFile}"`

      const proc = spawn('/bin/bash', ['-l', '-c', cmd], {
        cwd: workDir,
        env: {
          HOME: os.homedir(),
          USER: process.env.USER || '',
          SHELL: '/bin/bash',
          TERM: 'xterm-256color',
          PATH: [
            `${os.homedir()}/.npm-global/bin`,
            `${os.homedir()}/.local/bin`,
            '/usr/local/bin',
            '/opt/homebrew/bin',
            '/usr/bin',
            '/bin',
            process.env.PATH || '',
          ].join(':'),
        },
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      let buffer = ''
      proc.stdout.on('data', (data: Buffer) => {
        if (controllerClosed) return
        buffer += data.toString()
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const parsed = JSON.parse(line)
            if (parsed.type === 'assistant') {
              const content = parsed.message?.content
              if (Array.isArray(content)) {
                for (const block of content) {
                  if (block.type === 'text' && block.text) send('output', block.text)
                  if (block.type === 'tool_use') send('tool', `→ ${block.name}(${JSON.stringify(block.input).slice(0, 100)}...)`)
                }
              }
            }
            if (parsed.type === 'tool_result') send('tool_result', `✓ ${String(parsed.content || '').slice(0, 120)}`)
            if (parsed.type === 'result') send('result', parsed.result || '')
          } catch {
            if (line.trim()) send('raw', line.trim())
          }
        }
      })

      proc.stderr.on('data', (data: Buffer) => {
        if (controllerClosed) return
        const t = data.toString().trim()
        if (t) send('log', t)
      })

      proc.on('error', (err) => { send('error', `spawn error: ${err.message}`); close() })
      proc.on('close', (code) => { send('done', code === 0 ? 'success' : `exit ${code}`); close() })

      req.signal?.addEventListener('abort', () => {
        controllerClosed = true
        try { proc.kill() } catch {}
      })
    }
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
  })
}
