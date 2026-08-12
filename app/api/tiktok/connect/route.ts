import { NextResponse } from 'next/server'
import { getTikTokConfig, missingTikTokConfig } from '@/lib/tiktok'

export async function GET() {
  const missing = missingTikTokConfig()

  if (missing.length) {
    return NextResponse.json(
      {
        error: 'TikTok Shop API is not configured yet.',
        missing,
      },
      { status: 400 }
    )
  }

  const config = getTikTokConfig()
  const state = crypto.randomUUID()
  const url = new URL(config.authUrl)

  url.searchParams.set('app_key', config.appKey)
  url.searchParams.set('state', state)
  url.searchParams.set('redirect_uri', config.redirectUri)

  const response = NextResponse.redirect(url)
  response.cookies.set('tiktok_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    maxAge: 10 * 60,
    path: '/',
  })

  return response
}
