import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'
import os from 'os'

export async function GET(req: NextRequest) {
  const filePath = req.nextUrl.searchParams.get('path')
  if (!filePath) return new Response('Missing path parameter', { status: 400 })

  const outputDir = path.join(os.homedir(), 'spec-to-figma-output')

  const resolvedPath = path.resolve(filePath)
  if (!resolvedPath.startsWith(outputDir)) {
    return new Response('Unauthorized path', { status: 403 })
  }

  if (!fs.existsSync(resolvedPath)) {
    return new Response('File not found', { status: 404 })
  }

  const fileBuffer = fs.readFileSync(resolvedPath)
  const ext = path.extname(resolvedPath).toLowerCase()
  const contentType = ext === '.pdf' ? 'application/pdf' : 'text/markdown'
  
  return new NextResponse(fileBuffer, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${path.basename(resolvedPath)}"`,
    },
  })
}
