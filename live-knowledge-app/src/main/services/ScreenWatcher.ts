import { desktopCapturer, nativeImage, systemPreferences } from 'electron'
import { Rectangle } from '../../renderer/src/types'

export class ScreenWatcher {
  private captureRegion?: Rectangle
  private lastScreenshot?: Buffer
  private similarityThreshold: number = 0.85
  private isCapturing: boolean = false

  constructor(captureRegion?: Rectangle, similarityThreshold: number = 0.85) {
    this.captureRegion = captureRegion
    this.similarityThreshold = similarityThreshold
  }

  async captureScreen(): Promise<Buffer> {
    try {
      // Check for screen recording permissions on macOS
      if (process.platform === 'darwin') {
        const status = systemPreferences.getMediaAccessStatus('screen')
        console.log('Screen recording permission status:', status)
        if (status === 'denied') {
          throw new Error(
            'Screen recording permission denied. Please enable it in System Settings > Privacy & Security > Screen Recording.'
          )
        }
      }

      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 1920, height: 1080 }
      })

      console.log('Available screen sources:', sources.length)

      if (sources.length === 0) {
        // Try to check if we can get windows at least, which might indicate some access but not full screen
        const windowSources = await desktopCapturer.getSources({ types: ['window'] })
        console.log('Available window sources:', windowSources.length)

        throw new Error('No screen sources available. This usually means Screen Recording permission is missing.')
      }

      const screenshot = sources[0].thumbnail.toPNG()

      // If a specific region is defined, crop the screenshot
      if (this.captureRegion) {
        return this.cropScreenshot(screenshot, this.captureRegion)
      }

      return screenshot
    } catch (error) {
      console.error('Screen capture failed:', error)
      throw error
    }
  }

  async detectChanges(): Promise<{ hasChanged: boolean; screenshot: Buffer; similarity: number }> {
    const currentScreenshot = await this.captureScreen()

    if (!this.lastScreenshot) {
      this.lastScreenshot = currentScreenshot
      return {
        hasChanged: true,
        screenshot: currentScreenshot,
        similarity: 0
      }
    }

    const similarity = await this.calculateSimilarity(this.lastScreenshot, currentScreenshot)
    const hasSignificantChange = similarity < this.similarityThreshold

    if (hasSignificantChange) {
      this.lastScreenshot = currentScreenshot
    }

    return {
      hasChanged: hasSignificantChange,
      screenshot: currentScreenshot,
      similarity
    }
  }

  private async cropScreenshot(screenshot: Buffer, region: Rectangle): Promise<Buffer> {
    try {
      const image = nativeImage.createFromBuffer(screenshot)
      const { width, height } = image.getSize()

      // Ensure the region is within bounds
      const validRegion = {
        x: Math.max(0, Math.min(region.x, width - 1)),
        y: Math.max(0, Math.min(region.y, height - 1)),
        width: Math.min(region.width, width - region.x),
        height: Math.min(region.height, height - region.y)
      }

      // Crop the image
      const cropped = image.crop(validRegion)
      return cropped.toPNG()
    } catch (error) {
      console.error('Screenshot cropping failed:', error)
      return screenshot // Return original if cropping fails
    }
  }

  private async calculateSimilarity(img1: Buffer, img2: Buffer): Promise<number> {
    try {
      const hash1 = await this.calculatePerceptualHash(img1)
      const hash2 = await this.calculatePerceptualHash(img2)

      return this.hammingDistance(hash1, hash2) / 64 // 64-bit hash
    } catch (error) {
      console.error('Similarity calculation failed:', error)
      return 1 // Return maximum difference if calculation fails
    }
  }

  private async calculatePerceptualHash(imageBuffer: Buffer): Promise<string> {
    // Simple perceptual hash implementation
    // This is a basic version - in production, consider using a more sophisticated algorithm
    try {
      const image = nativeImage.createFromBuffer(imageBuffer)

      // Resize to 8x8 for hash calculation
      const resized = image.resize({ width: 8, height: 8 })
      const bitmap = resized.toBitmap()

      // Calculate average pixel value
      let totalValue = 0
      let pixelCount = 0

      for (let i = 0; i < bitmap.length; i += 4) {
        const gray = (bitmap[i] + bitmap[i + 1] + bitmap[i + 2]) / 3
        totalValue += gray
        pixelCount++
      }

      const average = totalValue / pixelCount

      // Generate hash based on pixels above/below average
      let hash = ''
      for (let i = 0; i < bitmap.length; i += 4) {
        const gray = (bitmap[i] + bitmap[i + 1] + bitmap[i + 2]) / 3
        hash += gray > average ? '1' : '0'
      }

      return hash
    } catch (error) {
      console.error('Perceptual hash calculation failed:', error)
      return '0'.repeat(64) // Return default hash if calculation fails
    }
  }

  private hammingDistance(hash1: string, hash2: string): number {
    if (hash1.length !== hash2.length) {
      return Math.max(hash1.length, hash2.length)
    }

    let distance = 0
    for (let i = 0; i < hash1.length; i++) {
      if (hash1[i] !== hash2[i]) {
        distance++
      }
    }

    return distance
  }

  setCaptureRegion(region?: Rectangle): void {
    this.captureRegion = region
  }

  setSimilarityThreshold(threshold: number): void {
    this.similarityThreshold = Math.max(0, Math.min(1, threshold))
  }

  reset(): void {
    this.lastScreenshot = undefined
  }

  getIsCapturing(): boolean {
    return this.isCapturing
  }

  setIsCapturing(capturing: boolean): void {
    this.isCapturing = capturing
  }
}
