import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  try {
    const figmaTeam = process.env.FIGMA_TEAM_ID
    const figmaToken = process.env.FIGMA_TOKEN

    if (!figmaTeam || !figmaToken) {
      return NextResponse.json({ error: 'Missing FIGMA_TEAM_ID or FIGMA_TOKEN in environment' }, { status: 400 })
    }

    const headers = {
      'X-Figma-Token': figmaToken,
    }

    // 1. Fetch all projects in the team
    const projectsResponse = await fetch(`https://api.figma.com/v1/teams/${figmaTeam}/projects`, { headers })
    
    if (!projectsResponse.ok) {
      const errorText = await projectsResponse.text()
      console.error('Figma projects fetch error:', errorText)
      return NextResponse.json({ error: `Failed to fetch projects for team ${figmaTeam}` }, { status: projectsResponse.status })
    }

    const projectsData = await projectsResponse.json()
    const projects = projectsData.projects || []

    // 2. Fetch files for each project
    const filesPromises = projects.map(async (project: any) => {
      try {
        const res = await fetch(`https://api.figma.com/v1/projects/${project.id}/files`, { headers })
        if (!res.ok) return []
        const data = await res.json()
        return (data.files || []).map((f: any) => ({
          key: f.key,
          name: f.name,
          last_modified: f.last_modified,
          projectName: project.name
        }))
      } catch (err) {
        return []
      }
    })

    const filesArrays = await Promise.all(filesPromises)
    const allFiles = filesArrays.flat()

    // Sort by last modified descending
    allFiles.sort((a, b) => new Date(b.last_modified).getTime() - new Date(a.last_modified).getTime())

    return NextResponse.json({ files: allFiles })
  } catch (error: any) {
    console.error('Figma files API error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
