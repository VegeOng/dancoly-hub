export function getTikTokConfig() {
  return {
    appKey: process.env.TIKTOK_SHOP_APP_KEY || '',
    appSecret: process.env.TIKTOK_SHOP_APP_SECRET || '',
    redirectUri:
      process.env.TIKTOK_SHOP_REDIRECT_URI ||
      'https://dancoly-hub.vercel.app/api/tiktok/callback',
    authUrl:
      process.env.TIKTOK_SHOP_AUTH_URL ||
      'https://auth.tiktok-shops.com/oauth/authorize',
    tokenUrl:
      process.env.TIKTOK_SHOP_TOKEN_URL ||
      'https://auth.tiktok-shops.com/api/v2/token/get',
  }
}

export function missingTikTokConfig() {
  const config = getTikTokConfig()
  return [
    !config.appKey && 'TIKTOK_SHOP_APP_KEY',
    !config.appSecret && 'TIKTOK_SHOP_APP_SECRET',
  ].filter(Boolean) as string[]
}
