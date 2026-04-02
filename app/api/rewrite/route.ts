import { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SYSTEM_PROMPT = `You are a senior product designer and spec writer.
Your job is to take a rough screen description and rewrite it as a precise, structured specification document that a developer and designer can use to build a high-fidelity mockup.

Follow this exact structure:

# [Screen Name] — Spec

## Overview
One paragraph describing the screen's purpose, context, target user, and overall layout approach.

## User Journeys
Numbered list of the key interactions a user can perform on this screen.
Use sub-sections like ### 1. [Journey Name] and numbered steps 1.1, 1.1.1, etc.

## Data Model
List every data entity shown on screen with its fields, types, and relationships.
Use mock/hardcoded data where needed.

## Screen Contents

### [ScreenName]Screen

Preview size: 1440x900

#### Preview states
Table with columns: State | Name | Description
List every interactive state (default, hover, modal open, empty, error, loading, etc.)

#### Contents

**Content Hierarchy:**
Deeply nested bullet list describing every UI element, its position, visual properties, interactions, and edge cases.
Be extremely precise: mention typography scale, spacing, color role, icon names, badge variants, empty states.

## Technical Notes
- Framework/component library constraints
- Accessibility requirements
- Responsive behavior
- Data dependencies

Rules:
- Never use vague words like "clean", "nice", "modern" — always be specific
- Every element must have a described state (default + at least one interaction state)
- Reference design system token roles, not hex values
- If the user mentions a design system, reference its component names specifically
- Output ONLY the markdown spec, no preamble or explanation`

export async function POST(req: NextRequest) {
  const { spec, dsName } = await req.json()

  const apiKey = process.env.ANTHROPIC_API_KEY
  console.log('[rewrite] API key present:', !!apiKey, '| starts with:', apiKey?.slice(0, 10))

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'Missing ANTHROPIC_API_KEY — add it to .env.local and restart npm run dev' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const userMessage = dsName
    ? `Design system: ${dsName}\n\nRough screen description:\n${spec}`
    : `Rough screen description:\n${spec}`

  let response: Response
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })
  } catch (err) {
    console.error('[rewrite] fetch error:', err)
    return new Response(
      JSON.stringify({ error: `Network error: ${String(err)}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const responseText = await response.text()
  console.log('[rewrite] Anthropic status:', response.status)
  console.log('[rewrite] Anthropic body:', responseText.slice(0, 400))

  if (!response.ok) {
    return new Response(
      JSON.stringify({ error: `Anthropic ${response.status}: ${responseText.slice(0, 300)}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const data = JSON.parse(responseText)
  const rewritten = data.content?.[0]?.text || ''

  return new Response(
    JSON.stringify({ rewritten }),
    { headers: { 'Content-Type': 'application/json' } }
  )
}
