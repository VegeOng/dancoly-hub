// Temporary debug endpoint — DELETE after confirming env vars are correct
export async function GET() {
  const appKey = process.env.TIKTOK_SHOP_APP_KEY ?? ''
  const appSecret = process.env.TIKTOK_SHOP_APP_SECRET ?? ''
  const redirectUri = process.env.TIKTOK_SHOP_REDIRECT_URI ?? ''

  return Response.json({
    TIKTOK_SHOP_APP_KEY: appKey
      ? `${appKey.slice(0, 4)}...${appKey.slice(-4)} (length: ${appKey.length})`
      : '(not set)',
    TIKTOK_SHOP_APP_SECRET: appSecret
      ? `${appSecret.slice(0, 4)}...${appSecret.slice(-4)} (length: ${appSecret.length})`
      : '(not set)',
    TIKTOK_SHOP_REDIRECT_URI: redirectUri || '(not set)',
  })
}
