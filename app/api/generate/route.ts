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
  const rawSpecs: { id: string; label: string; spec: string; variations?: number }[] = body.specs || [{ id: 'page1', label: 'Page', spec: body.spec }]
  const figmaTeamId: string = body.figmaTeamId || process.env.FIGMA_TEAM_ID || ''
  const targetFileKey: string = body.targetFileKey || 'new'
  const isNewFile = targetFileKey === 'new'
  const dsLink: string = body.figmaLink
  const isFigma = isFigmaFile(dsLink)
  const dsFileKeyMatch = dsLink.match(/figma\.com\/(?:design|file)\/([a-zA-Z0-9]+)/)
  const dsFileKey = dsFileKeyMatch ? dsFileKeyMatch[1] : null
  const generationMode: 'visual' | 'native' = body.generationMode || 'visual'

  // Expand specs by variations: each screen becomes N frames with distinct design direction hints
  const variantHints = [
    'Layout A: default arrangement as described in the spec',
    'Layout B: same visual style and components, but rearranged — e.g. swap sidebar/main positions, stack elements differently, move CTA to a different location. Keep the same design language.',
    'Layout C: same visual style and components, but with a third spatial arrangement — experiment with hierarchy and whitespace distribution while keeping identical brand tokens.',
  ]
  const specs = rawSpecs.flatMap(s => {
    const n = Math.min(Math.max(s.variations ?? 1, 1), 3)
    if (n === 1) return [{ id: s.id, label: s.label, spec: s.spec }]
    return Array.from({ length: n }, (_, i) => ({
      id: `${s.id}_v${i + 1}`,
      label: `${s.label} — v${i + 1}`,
      spec: `${s.spec}\n\n[Variant ${i + 1}/${n}: ${variantHints[i] ?? variantHints[0]} — Do NOT change colors, typography or visual style. Only change the spatial layout and component arrangement.]`,
    }))
  })

  const workDir = path.join(os.homedir(), 'spec-to-figma-output', 'run-' + Date.now())
  fs.mkdirSync(workDir, { recursive: true })

  const unifiedSpec = specs.map((s, i) =>
    `## Screen ${i + 1}: ${s.label}\n\n${s.spec}`
  ).join('\n\n---\n\n')

  let claudeMd = ''
  let promptStr = ''

  if (generationMode === 'visual') {
    claudeMd = `# Claufig — Agent Rules
    
## Design system
${isFigma
    ? `Source: Figma file at ${dsLink}\nUse get_design_context and get_variable_defs to extract tokens.`
    : `Source: Documentation at ${dsLink}\nFetch the docs, extract all tokens (colors, spacing, typography, radius), define them as CSS variables.`
}

## Figma output
- Target: ${isNewFile ? `New file in team ${figmaTeamId}` : `Existing file ${targetFileKey}`}
- ALWAYS use outputMode: "${isNewFile ? 'newFile' : 'existingFile'}" when calling generate_figma_design.
${isNewFile ? `- ALWAYS use planKey: "${figmaTeamId}" to specify the team.\n- Put all screens in a new Figma file named "Claufig — ${specs.map(s => s.label).join(' · ')}"` : `- ALWAYS use fileKey: "${targetFileKey}" to inject screens into the existing file.`}

## Your task
Build ${specs.length} screen${specs.length > 1 ? 's' : ''} for a cohesive product. Generate them in sequence.

## Screens to build
${unifiedSpec}

## Rules
- Use ONLY DS tokens — never hardcode hex or px values
- Keep visual consistency across all screens
- Push ALL screens to Figma using generate_figma_design
- Use outputMode: "${isNewFile ? 'newFile' : 'existingFile'}"
${isNewFile ? `- ALWAYS use planKey: "${figmaTeamId}"` : `- ALWAYS use fileKey: "${targetFileKey}"`}
- NEVER ask which team or file — always use the exact keys provided above
- Name each Figma frame exactly as the screen label above
- Build a local HTML file per screen, serve with python3 http.server, then capture
`

    promptStr = [
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
      `  c. Call generate_figma_design with outputMode "${isNewFile ? 'newFile' : 'existingFile'}"`,
      `  d. ${isNewFile ? `ALWAYS use planKey "${figmaTeamId}"` : `ALWAYS use fileKey "${targetFileKey}"`} — do NOT ask, use this value directly`,
      '  e. Name the frame exactly as the screen label',
      '',
      'Step 3: Output the Figma file URL and a token audit summary.',
      '',
      `IMPORTANT: Never prompt for team or file selection. Use the exact keys provided.`,
    ].join('\n')
  } else {
    // Native Mode
    claudeMd = `# Claufig — Agent Rules (Native Component Mode)

## Design system
${!isFigma || !dsFileKey 
  ? `ERROR: Native mode requires a valid Figma design system URL. This might fail. End.`
  : `Source: Figma library file at ${dsLink} (File Key: ${dsFileKey})\nUse get_variable_defs on ${dsFileKey} to extract variables.\nUse search_design_system on ${dsFileKey} to find real component keys.`
}

## Figma output
- Target: ${isNewFile ? `New file in team ${figmaTeamId}` : `Existing file ${targetFileKey}`}
${isNewFile 
  ? `- ALWAYS use create_new_file first with planKey: "${figmaTeamId}" and editorType: "design" to get a new fileKey.`
  : `- You will use use_figma tool on the existing file: "${targetFileKey}".`}

## Your task
Build ${specs.length} screen${specs.length > 1 ? 's' : ''} using REAL Figma library components. Generate them in sequence.

## Screens to build
${unifiedSpec}

## Rules
- NEVER generate HTML. You must build layouts NATIVELY in Figma via the use_figma tool using the Plugin API JS context.
- Step 1: Use search_design_system with fileKey: "${dsFileKey}" to discover component keys. (e.g. search for 'button', 'card')
- Step 2: For each screen, write JavaScript to execute via use_figma on the target file.
- The use_figma tool executes JS with access to \`figma\` global.
- Use \`figma.importComponentByKeyAsync(key)\` and \`createInstance()\` to place components.
- Use \`figma.createFrame()\` for the root screen. Name it exactly as the screen label.
- Do NOT hardcode hex colors.
- Step 3: After executing use_figma successfully for a screen, move on to the next.
`

    promptStr = [
      'Read CLAUDE.md for full instructions on Native Component Mode.',
      '',
      isNewFile ? `Step 0: Call create_new_file with planKey "${figmaTeamId}" and editorType "design" to create the target file. Extract its fileKey.` : `Step 0: Your target fileKey is "${targetFileKey}".`,
      '',
      `Step 1: Call search_design_system on fileKey "${dsFileKey}" for components needed in the specs. Get component keys.`,
      '',
      `Step 2: Build ${specs.length} screen${specs.length > 1 ? 's' : ''} natively in Figma using use_figma tool on the target file.`,
      `For each screen:`,
      `  a. Write robust JS calling Figma Plugin API (importComponentByKeyAsync, createFrame, etc.)`,
      `  b. Execute it via use_figma on the target file.`,
      '',
      'Step 3: Output the Figma file URL and a summary.',
      '',
      `IMPORTANT: Never prompt for team or file selection. Do everything autonomously.`,
    ].join('\n')
  }

  fs.writeFileSync(path.join(workDir, 'CLAUDE.md'), claudeMd)

  const mcp = { mcpServers: { figma: { type: 'http', url: 'https://mcp.figma.com/mcp' } } }
  fs.writeFileSync(path.join(workDir, '.mcp.json'), JSON.stringify(mcp, null, 2))

  const promptFile = path.join(workDir, 'prompt.txt')
  fs.writeFileSync(promptFile, promptStr, 'utf8')

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

      send('status', `Starting Claude Code — ${specs.length} screen${specs.length > 1 ? 's' : ''}...`)
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
                  if (block.type === 'tool_use') {
                    let inputStr = ''
                    if (block.input && typeof block.input === 'object') {
                      const { description, command, query, ...rest } = block.input as any
                      const trunc = (s: string, max: number) => s.length > max ? s.slice(0, max) + '...' : s
                      if (description) inputStr += `\n  Description : ${trunc(String(description), 200)}`
                      if (command) inputStr += `\n  Command : ${trunc(String(command), 150)}`
                      if (query) inputStr += `\n  Query : ${trunc(String(query), 150)}`
                      if (Object.keys(rest).length > 0) inputStr += `\n  Args : ${trunc(JSON.stringify(rest), 200)}`
                    } else {
                      const str = JSON.stringify(block.input)
                      inputStr = `\n  ${str.length > 200 ? str.slice(0, 200) + '...' : str}`
                    }
                    
                    let toolType = 'tool'
                    let emoji = '🛠️'
                    if (block.name.includes('figma')) { toolType = 'tool_figma'; emoji = '🎨' }
                    else if (/fetch|web|browser/i.test(block.name)) { toolType = 'tool_web'; emoji = '🌐' }
                    else if (block.name.includes('claude') || block.name.includes('Bash') || block.name.includes('Todo') || block.name.includes('Write')) { toolType = 'tool_claude'; emoji = '🤖' }
                    
                    send(toolType, `→ ${emoji} ${block.name}${inputStr}`)
                  }
                }
              }
            }
            if (parsed.type === 'tool_result') {
              let resStr = typeof parsed.content === 'string' ? parsed.content : JSON.stringify(parsed.content, null, 2)
              if (resStr.length > 2000) resStr = resStr.slice(0, 2000) + '\n... [truncated]'
              send('tool_result', `✓ ${resStr}`)
            }
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
