import { Worker } from 'worker_threads'
import * as os from 'os'
import * as path from 'path'

type Job = {
  id: number
  task: string
  data: any
  resolve: (value: any) => void
  reject: (err: any) => void
}

export class WorkerPool {
  private workers: Worker[] = []
  private queue: Job[] = []
  private nextJobId = 1
  private idleWorkers: Set<number> = new Set()

  constructor(workerScript: string, size: number = Math.max(1, os.cpus().length - 1)) {
    for (let i = 0; i < size; i++) {
      const w = new Worker(workerScript)
      const idx = this.workers.length
      this.workers.push(w)
      this.idleWorkers.add(idx)
      w.on('message', (msg: any) => this.handleWorkerMessage(idx, msg))
      w.on('error', (err) => console.error('Worker error:', err))
      w.on('exit', (code) => {
        this.idleWorkers.delete(idx)
        console.log(`Worker ${idx} exited (${code})`)
      })
    }
  }

  private handleWorkerMessage(idx: number, msg: any) {
    if (msg && msg.type === 'result') {
      const job = msg.job
      // Resolve the job promise stored on the job object
      // We keep a reference on the queue until processed
      const qIndex = this.queue.findIndex(j => j.id === job.id)
      if (qIndex !== -1) {
        const j = this.queue.splice(qIndex, 1)[0]
        j.resolve(msg.result)
      }
    } else if (msg && msg.type === 'ready') {
      this.idleWorkers.add(idx)
      this.processQueue()
    } else if (msg && msg.type === 'error') {
      const jobId = msg.job?.id
      const qIndex = this.queue.findIndex(j => j.id === jobId)
      if (qIndex !== -1) {
        const j = this.queue.splice(qIndex, 1)[0]
        j.reject(msg.error)
      }
    }
  }

  private processQueue() {
    if (this.queue.length === 0) return
    const idle = Array.from(this.idleWorkers)
    if (idle.length === 0) return
    const workerIdx = idle[0]
    const job = this.queue.shift()!
    this.idleWorkers.delete(workerIdx)
    const w = this.workers[workerIdx]
    w.postMessage({ type: 'run', job: { id: job.id, task: job.task, data: job.data } })
  }

  runTask(task: string, data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = this.nextJobId++
      const job: Job = { id, task, data, resolve, reject }
      this.queue.push(job)
      this.processQueue()
    })
  }
}

export function createDefaultWorkerPool() {
  const script = path.join(__dirname, 'workerThread.js')
  return new WorkerPool(script)
}
