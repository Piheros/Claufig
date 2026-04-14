'use client'

import { useState, useRef, useEffect } from 'react'

const DEFAULT_SPECS = [
  {
    id: 'page1', label: 'Gallery', variations: 1,
    spec: `Main gallery page for an art painting e-commerce site. Hero with title "Original Works" and CTA. 3-column product grid with image, artwork title, artist name, price, "Limited Edition" badge. Horizontal filters: All / Painting / Photography / Drawing.`,
  },
  {
    id: 'page2', label: 'Product', variations: 1,
    spec: `Product page for a painting "Autumn Light" by Marie Dupont. Large image left, details right: title, artist, dimensions 60x80cm, price €380, authenticity badge. Format selector: Original / Numbered reproduction / Poster. Add to cart + Add to wishlist CTAs. Collapsible details section.`,
  },
  {
    id: 'page3', label: 'Cart', variations: 1,
    spec: `Shopping cart with 2 items. Item rows: thumbnail, title, artist, format, price, remove button. Order summary panel: subtotal, shipping, total. Free shipping badge over €500. Checkout CTA. Secure payment + 14-day returns trust message.`,
  },
]

type LogLine = { type: string; text: string }
type DSMode = 'figma' | 'url'

const termStyle: Record<string, string> = {
  tool:        'text-dim',
  tool_figma:  'text-purple-400',
  tool_web:    'text-blue-400',
  tool_claude: 'text-amber-400',
  tool_result: 'text-secondary',
  output:      'text-text',
  error:       'text-red-400',
  status:      'text-subtle',
  result:      'text-text',
  done:        'text-text',
  log:         'text-muted',
  raw:         'text-muted',
  system:      'text-border',
}

let pageCounter = 4

export default function Home() {
  const [dsMode, setDsMode]       = useState<DSMode>('url')
  const [figmaLink, setFigmaLink] = useState('https://www.figma.com/community/file/1251583926296440701')
  const [dsUrl, setDsUrl]         = useState('https://polaris-react.shopify.com/')
  const [specs, setSpecs]         = useState(DEFAULT_SPECS)
  const [running, setRunning]     = useState(false)
  const [done, setDone]           = useState(false)
  const [lines, setLines]         = useState<LogLine[]>([])
  const [started, setStarted]     = useState(false)
  const [targetFileKey, setTargetFileKey] = useState('new')
  const [figmaFiles, setFigmaFiles] = useState<{key: string, name: string, projectName: string}[]>([])
  const [loadingFiles, setLoadingFiles] = useState(true)
  const [progress, setProgress] = useState(0)
  const [statusText, setStatusText] = useState('Ready')
  const [figmaUrl, setFigmaUrl] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const termRef  = useRef<HTMLDivElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const toolResultCountRef = useRef(0)
  const startTimeRef = useRef<number>(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    async function loadFiles() {
      try {
        const res = await fetch('/api/figma/files', { method: 'POST' })
        if (res.ok) {
          const data = await res.json()
          setFigmaFiles(data.files || [])
        }
      } catch (e) {}
      finally { setLoadingFiles(false) }
    }
    loadFiles()
  }, [])

  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight
  }, [lines])

  const addLine = (type: string, text: string) => setLines(p => [...p, { type, text }])

  async function generate() {
    if (running) return
    // Compute total expected frames
    const totalFrames = specs.reduce((acc, s) => acc + Math.min(Math.max(s.variations ?? 1, 1), 3), 0)
    const stepsPerFrame = 6 // fetch, write, serve, capture, figma, result
    const totalSteps = totalFrames * stepsPerFrame + 3
    toolResultCountRef.current = 0
    setProgress(0)
    setStatusText('Starting...')
    setFigmaUrl('')
    setElapsed(0)
    startTimeRef.current = Date.now()
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 1000)
    setRunning(true); setDone(false); setLines([]); setStarted(true)
    const abort = new AbortController(); abortRef.current = abort
    const dsLink = dsMode === 'figma' ? figmaLink : dsUrl

    addLine('system', `claufig · ${specs.length} screen${specs.length > 1 ? 's' : ''} · ${new Date().toLocaleTimeString()}`)

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ specs, figmaLink: dsLink, targetFileKey }),
        signal: abort.signal,
      })
      const reader = res.body!.getReader()
      const dec = new TextDecoder()
      let buf = ''
      while (true) {
        const { done: d, value } = await reader.read(); if (d) break
        buf += dec.decode(value, { stream: true })
        const events = buf.split('\n\n'); buf = events.pop() || ''
        for (const ev of events) {
          const line = ev.replace(/^data: /, '').trim(); if (!line) continue
          try {
            const { type, data } = JSON.parse(line)
            addLine(type, data)
            if (type === 'done') { setDone(true); setProgress(100); setStatusText('Done') }
            if (type === 'status') setStatusText(data)
            if (type === 'output' || type === 'result') {
              const match = data.match(/https:\/\/(?:www\.)?figma\.com\/(?:design|file)\/[\w-]+[^\s)]*/)
              if (match) setFigmaUrl(match[0])
            }
            if (type === 'tool_result' || type === 'tool_figma' || type === 'tool_claude' || type === 'tool_web') {
              toolResultCountRef.current += 1
              const pct = Math.min(95, Math.round((toolResultCountRef.current / totalSteps) * 100))
              setProgress(pct)
            }
          } catch {}
        }
      }
    } catch (e: unknown) {
      if ((e as Error).name !== 'AbortError') addLine('error', String(e))
    } finally {
      setRunning(false)
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
      if (!done) setStatusText('Stopped')
    }
  }

  function stop() {
    abortRef.current?.abort()
    setRunning(false)
    setStatusText('Stopped')
    setProgress(0)
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }

  const formatTime = (s: number) => s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`

  function addSpec() {
    const id = `page${pageCounter++}`
    setSpecs(p => [...p, { id, label: `Screen ${p.length + 1}`, spec: '' }])
  }
  function removeSpec(id: string) {
    if (specs.length <= 1) return
    setSpecs(p => p.filter(s => s.id !== id))
  }
  function updateSpec(id: string, field: 'label' | 'spec', val: string) {
    setSpecs(p => p.map(s => s.id === id ? { ...s, [field]: val } : s))
  }

  return (
    <div className="h-screen bg-bg flex flex-col overflow-hidden" style={{ fontFamily: 'Geist, sans-serif' }}>

      {/* Header */}
      <header className="border-b border-border px-6 h-12 flex items-center justify-between flex-shrink-0 relative overflow-hidden">
        {/* Progress bar */}
        {(running || done) && (
          <div
            className="absolute bottom-0 left-0 h-0.5 transition-all duration-500 ease-out"
            style={{
              width: `${progress}%`,
              background: done ? '#ffffff' : 'linear-gradient(90deg, #6366f1, #a855f7, #ec4899)',
              boxShadow: done ? 'none' : '0 0 8px #a855f7',
            }}
          />
        )}
        <span className="text-sm font-medium text-text">Claufig</span>
        <div className="flex items-center gap-3">
          {running && (
            <span className="text-xs text-muted tabular-nums">{progress}% · {formatTime(elapsed)}</span>
          )}
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full transition-colors ${running ? 'bg-purple-400 animate-pulse' : done ? 'bg-white' : 'bg-border'}`} />
            <span className="text-xs text-muted max-w-[200px] truncate">
              {running ? statusText : done ? 'Done' : 'Ready'}
            </span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar */}
        <aside className="w-64 border-r border-border flex flex-col flex-shrink-0 bg-panel">

          {/* DS */}
          <div className="p-4 border-b border-border">
            <p className="text-xs text-muted uppercase tracking-widest mb-3">Design System</p>
            <div className="flex gap-1 mb-3">
              {(['figma', 'url'] as DSMode[]).map(m => (
                <button key={m} onClick={() => setDsMode(m)} disabled={running}
                  className={`flex-1 py-1.5 text-xs rounded transition-colors ${dsMode === m ? 'bg-white text-black font-medium' : 'text-muted hover:text-text border border-border'}`}>
                  {m === 'figma' ? 'Figma' : 'URL'}
                </button>
              ))}
            </div>
            <input type="text"
              value={dsMode === 'figma' ? figmaLink : dsUrl}
              onChange={e => dsMode === 'figma' ? setFigmaLink(e.target.value) : setDsUrl(e.target.value)}
              disabled={running}
              placeholder={dsMode === 'figma' ? 'figma.com/design/...' : 'design-system-docs.com'}
              className="w-full bg-card text-text text-xs rounded border border-border px-3 py-2 placeholder-muted focus:border-border-hi transition-colors disabled:opacity-40"
            />
            <p className="text-xs text-muted mt-1.5">
              {dsMode === 'figma' ? 'Read via MCP Figma' : 'Fetched by Claude Code'}
            </p>
          </div>

          {/* Figma Target File */}
          <div className="p-4 border-b border-border">
            <p className="text-xs text-muted uppercase tracking-widest mb-2 mt-2">Target File</p>
            <select value={targetFileKey} onChange={e => setTargetFileKey(e.target.value)} disabled={running || loadingFiles}
              className="w-full bg-card text-text text-xs rounded border border-border px-3 py-2 focus:border-border-hi transition-colors disabled:opacity-40">
              <option value="new">✨ Create a new file</option>
              {loadingFiles ? (
                <option disabled>Loading files...</option>
              ) : (
                figmaFiles.map(f => (
                  <option key={f.key} value={f.key}>{f.projectName} / {f.name}</option>
                ))
              )}
            </select>
          </div>

          {/* Screens */}
          <div className="flex-1 overflow-y-auto">
            {specs.map((s, i) => (
              <div key={s.id} className="p-4 border-b border-border">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-muted">{String(i + 1).padStart(2, '0')}</span>
                  <input type="text" value={s.label}
                    onChange={e => updateSpec(s.id, 'label', e.target.value)}
                    disabled={running}
                    className="flex-1 bg-transparent text-xs text-secondary font-medium border-none focus:outline-none focus:text-text disabled:opacity-40 uppercase tracking-wider"
                    placeholder={`Screen ${i + 1}`}
                  />
                  {specs.length > 1 && !running && (
                    <button onClick={() => removeSpec(s.id)} className="text-xs text-border hover:text-muted transition-colors">✕</button>
                  )}
                </div>
                <textarea value={s.spec} onChange={e => updateSpec(s.id, 'spec', e.target.value)}
                  rows={5} disabled={running}
                  className="w-full bg-card text-secondary text-xs rounded border border-border p-2.5 resize-none leading-relaxed focus:border-border-hi focus:text-text transition-colors disabled:opacity-40 placeholder-muted"
                  placeholder="Describe the screen..."
                />
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-muted">Variants</span>
                  <div className="flex gap-1">
                    {[1, 2, 3].map(v => (
                      <button key={v} onClick={() => updateSpec(s.id, 'variations', v)} disabled={running}
                        className={`w-6 h-6 text-xs rounded border transition-colors disabled:opacity-40 ${
                          (s.variations ?? 1) === v
                            ? 'border-border-hi text-text bg-card'
                            : 'border-border text-muted hover:border-border-md hover:text-secondary'
                        }`}>
                        {v}
                      </button>
                    ))}
                  </div>

                </div>
              </div>
            ))}
            {!running && (
              <div className="p-4">
                <button onClick={addSpec}
                  className="w-full border border-dashed border-border hover:border-border-md text-muted hover:text-secondary text-xs rounded py-2 transition-colors">
                  + Add screen
                </button>
              </div>
            )}
          </div>

          {/* CTA */}
          <div className="p-4 border-t border-border space-y-2">
            {!running ? (
              <button onClick={generate} disabled={specs.some(s => !s.spec.trim())}
                className="w-full bg-white text-black text-xs font-medium rounded px-4 py-2.5 hover:bg-secondary transition-colors disabled:opacity-30">
                Generate {specs.length} frame{specs.length > 1 ? 's' : ''} →
              </button>
            ) : (
              <button onClick={stop}
                className="w-full border border-border text-muted text-xs rounded px-4 py-2.5 hover:text-text hover:border-border-md transition-colors">
                Stop
              </button>
            )}
            <p className="text-xs text-border text-center">1 Claude Code session · {specs.length} screen{specs.length > 1 ? 's' : ''}</p>
          </div>
        </aside>

        {/* Terminal */}
        <main className="flex-1 overflow-hidden flex flex-col bg-bg">
          <div ref={termRef} className="flex-1 overflow-y-auto px-8 py-6 space-y-0.5" style={{ fontFamily: 'Geist Mono, monospace' }}>
            {!started && (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-center" style={{ fontFamily: 'Geist, sans-serif' }}>
                <p className="text-sm text-secondary">{specs.length} screen{specs.length > 1 ? 's' : ''} · 1 Claude Code session</p>
                <p className="text-xs text-muted max-w-xs leading-relaxed">
                  Describe your screens on the left, then click Generate to build all frames in Figma.
                </p>
              </div>
            )}
            {lines.map((l, i) => (
              <div key={i} className={`text-xs leading-relaxed terminal-line ${termStyle[l.type] || 'text-secondary'} whitespace-pre-wrap break-all`}>
                {l.text}
              </div>
            ))}
            {running && <span className="inline-block w-1.5 h-3 bg-white cursor-blink mt-1" />}
            {done && (
              <div className="mt-8 border border-border-md rounded-lg p-4">
                <p className="text-xs text-text">✓ {specs.length} frame{specs.length > 1 ? 's' : ''} pushed to Figma</p>
              </div>
            )}
          </div>
        </main>
      </div>

      {done && !running && (
        <div className="border-t border-border px-6 h-10 flex items-center justify-between flex-shrink-0 bg-panel">
          <span className="text-xs text-secondary">✓ {specs.length} frames in Figma</span>
          {figmaUrl ? (
            <a href={figmaUrl} target="_blank" rel="noopener noreferrer"
              className="text-xs text-muted hover:text-text transition-colors underline underline-offset-2">
              Open Figma →
            </a>
          ) : (
            <span className="text-xs text-muted">Open Figma to view your screens</span>
          )}
        </div>
      )}
    </div>
  )
}
