declare module "gifenc" {
  export interface WriteFrameOptions {
    palette?: number[][]
    /** Frame delay in milliseconds. */
    delay?: number
    repeat?: number
    transparent?: boolean
    transparentIndex?: number
    dispose?: number
    first?: boolean
  }

  export interface GIFEncoderInstance {
    reset(): void
    finish(): void
    bytes(): Uint8Array
    bytesView(): Uint8Array
    buffer: ArrayBuffer
    writeHeader(): void
    writeFrame(
      index: Uint8Array | number[],
      width: number,
      height: number,
      opts?: WriteFrameOptions
    ): void
  }

  export function GIFEncoder(opts?: { auto?: boolean; initialCapacity?: number }): GIFEncoderInstance

  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: { format?: "rgb565" | "rgb444" | "rgba4444"; oneBitAlpha?: boolean | number; clearAlpha?: boolean }
  ): number[][]

  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: number[][],
    format?: "rgb565" | "rgb444" | "rgba4444"
  ): Uint8Array

  export function nearestColorIndex(palette: number[][], pixel: number[]): number
}
