const { parentPort } = require('worker_threads')
const fs = require('fs')
const path = require('path')

// Notify ready
if (parentPort) parentPort.postMessage({ type: 'ready' })

parentPort.on('message', async (msg) => {
  if (!msg || msg.type !== 'run') return
  const job = msg.job
  try {
    let result = null
    if (job.task === 'thumbnail') {
      // Try to use sharp if available
      try {
        const sharp = require('sharp')
        const inputPath = job.data.inputPath
        const size = job.data.size || 300
        const outDir = job.data.outDir || path.dirname(inputPath)
        const ext = path.extname(inputPath)
        const name = path.basename(inputPath, ext)
        const outPath = path.join(outDir, `${name}_thumb_${size}${ext}`)
        await sharp(inputPath).resize(size, size, { fit: 'cover' }).toFile(outPath)
        result = { outPath }
      } catch (err) {
        // sharp not available or failed — return error
        result = { error: 'sharp_unavailable_or_failed', message: err?.message }
      }
    } else if (job.task === 'heavy-calc') {
      // Example heavy CPU task: sum of many numbers
      const n = job.data.n || 1e7
      let s = 0
      for (let i = 0; i < n; i++) s += i
      result = { sum: s }
    } else {
      result = { error: 'unknown_task' }
    }

    parentPort.postMessage({ type: 'result', job, result })
    parentPort.postMessage({ type: 'ready' })
  } catch (error) {
    parentPort.postMessage({ type: 'error', job, error: error?.message || String(error) })
  }
})
