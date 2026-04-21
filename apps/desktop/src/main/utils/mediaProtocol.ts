export function resolveMediaFilePath(
  requestUrl: string,
  platform: NodeJS.Platform = process.platform
): string {
  const mediaUrl = new URL(requestUrl)
  let finalPath = decodeURIComponent(mediaUrl.pathname)

  if (platform === 'win32') {
    if (finalPath.startsWith('/') && finalPath.includes(':')) {
      finalPath = finalPath.slice(1)
    }
  } else if (!finalPath.startsWith('/')) {
    finalPath = `/${finalPath}`
  }

  return finalPath
}
