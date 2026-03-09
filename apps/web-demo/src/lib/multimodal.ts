export type MultimodalMode = 'raw' | 'markitdown' | 'local_file'

export interface MultimodalResource {
  mode: MultimodalMode
  raw?: Record<string, unknown>
  markdown?: string
  localFiles?: string[]
}

export function normalizeMultimodal(resource: Partial<MultimodalResource> | null | undefined): MultimodalResource | null {
  if (!resource || !resource.mode) return null

  if (resource.mode === 'raw') {
    return {
      mode: 'raw',
      raw: resource.raw || {},
      markdown: resource.markdown,
      localFiles: resource.localFiles || [],
    }
  }

  if (resource.mode === 'markitdown') {
    return {
      mode: 'markitdown',
      raw: resource.raw || {},
      markdown: resource.markdown || '',
      localFiles: resource.localFiles || [],
    }
  }

  return {
    mode: 'local_file',
    raw: resource.raw,
    markdown: resource.markdown,
    localFiles: resource.localFiles || [],
  }
}

export function requiresStructuredContent(resource: MultimodalResource | null): boolean {
  if (!resource) return false
  if (resource.mode === 'raw') return Object.keys(resource.raw || {}).length > 0
  if (resource.mode === 'markitdown') return Boolean(resource.markdown && resource.markdown.trim())
  return Boolean(
    (resource.raw && Object.keys(resource.raw).length > 0) ||
      (resource.markdown && resource.markdown.trim()),
  )
}
