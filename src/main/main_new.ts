import { app, BrowserWindow, ipcMain, dialog, shell } from "electron"
import * as path from "path"
import * as fs from "fs"
import * as http from "http"
import { spawn, ChildProcess } from "child_process"
import { Database } from "./database"
import { IPC_CHANNELS, Project, ProjectGroup, Task, Tag, AppSettings, DEFAULT_SETTINGS, SUPPORTED_DAWS, AudioVersion, Annotation } from "../shared/types"

let mainWindow: BrowserWindow | null = null
let database: Database | null = null

let appSettings: AppSettings = { ...DEFAULT_SETTINGS }

const fileCache = new Map<string, { mtime: number; size: number; exists: boolean }>()
const projectCache = new Map<string, Project>()

const processingQueue: Array<() => Promise<void>> = []
let isProcessing = false

let currentPythonProcess: ChildProcess | null = null

function cleanupPythonProcess() {
  if (currentPythonProcess) {
    try {
      currentPythonProcess.kill('SIGTERM')
    } catch (error) {
      console.log('Error killing Python process:', error)
    }
    currentPythonProcess = null
  }
}

async function getCachedFileStats(filePath: string): Promise<{ mtime: Date; birthtime: Date; size: number }> {
  const cacheKey = filePath
  const cache = fileCache.get(cacheKey)
  
  try {
    const stats = await fs.promises.stat(filePath)
    fileCache.set(cacheKey, {
      mtime: stats.mtimeMs,
      size: stats.size,
      exists: true
    })
    
    return {
      mtime: stats.mtime,
      birthtime: stats.birthtime,
      size: stats.size
    }
  } catch (error) {
    fileCache.set(cacheKey, {
      mtime: 0,
      size: 0,
      exists: false
    })
    throw error
  }
}

async function scanForFLPFiles(folderPath: string, maxDepth: number = 10): Promise<string[]> {
  const flpFiles: string[] = []
  const scanQueue: Array<{ path: string; depth: number }> = [{ path: folderPath, depth: 0 }]
  const scannedDirs = new Set<string>()

  while (scanQueue.length > 0) {
    const { path: dir, depth } = scanQueue.shift()!
    
    if (scannedDirs.has(dir) || depth > maxDepth) {
      continue
    }
    
    scannedDirs.add(dir)

    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true })
      
      const dirsToScan: string[] = []
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        
        if (entry.isDirectory()) {
          if (depth < maxDepth) {
            dirsToScan.push(fullPath)
          }
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".flp")) {
          flpFiles.push(fullPath)
        }
      }
      
      for (const dirPath of dirsToScan) {
        scanQueue.push({ path: dirPath, depth: depth + 1 })
      }
      
    } catch (error) {
      console.error(`Cannot access ${dir}:`, error)
    }
  }

  return flpFiles
}

async function extractFLPMetadataBatchOptimized(flpPaths: string[]): Promise<Record<string, any>> {
  return new Promise((resolve, reject) => {
    if (flpPaths.length === 0) {
      resolve({})
      return
    }

    cleanupPythonProcess()

    const isDev = process.env.NODE_ENV === "development" || !app.isPackaged
    
    let pythonExecutable: string
    let scriptPath: string
    
    if (isDev) {
      pythonExecutable = 'C:\\Users\\paulw\\Documents\\GitHub\\dbundone\\.venv\\Scripts\\python.exe'
      scriptPath = 'C:\\Users\\paulw\\Documents\\GitHub\\dbundone\\src\\renderer\\optimized_script.py'
    } else {
      pythonExecutable = 'python'
      scriptPath = path.join(process.resourcesPath, 'optimized_script.py')
    }

    console.log(`[Optimized Batch] Processing ${flpPaths.length} FLP files`)

    currentPythonProcess = spawn(pythonExecutable, [scriptPath, '--batch'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: path.dirname(scriptPath),
      windowsHide: true
    })

    let stdout = ''
    let stderr = ''
    let hasStarted = false

    if (currentPythonProcess.stdout) {
      currentPythonProcess.stdout.on('data', (data) => {
        const dataStr = data.toString()
        stdout += dataStr
        
        if (!hasStarted) {
          try {
            const firstOutput = JSON.parse(dataStr.trim())
            if (firstOutput.type === 'start') {
              hasStarted = true
              console.log(`[Python] Started processing ${firstOutput.total_files} files`)
            }
          } catch {
          }
        }
      })
    }

    if (currentPythonProcess.stderr) {
      currentPythonProcess.stderr.on('data', (data) => {
        stderr += data.toString()
      })
    }

    const sendFilePaths = async () => {
      const batchSize = 100
      
      for (let i = 0; i < flpPaths.length; i += batchSize) {
        const batch = flpPaths.slice(i, i + batchSize)
        if (currentPythonProcess?.stdin) {
          currentPythonProcess.stdin.write(JSON.stringify(batch) + '\n')
        }
        
        if (i + batchSize < flpPaths.length) {
          await new Promise(resolve => setTimeout(resolve, 50))
        }
      }
      if (currentPythonProcess?.stdin) {
        currentPythonProcess.stdin.end()
      }
    }

    sendFilePaths()

    const timeoutId = setTimeout(() => {
      cleanupPythonProcess()
      reject(new Error("Python process timeout after 2 minutes"))
    }, 120000)

    currentPythonProcess.on('close', (code) => {
      clearTimeout(timeoutId)
      console.log(`[Optimized Batch] Python process exited with code: ${code}`)
      
      if (stderr) {
        console.log('[Optimized Batch] Python stderr:', stderr.substring(0, 500))
      }
      
      if (code === 0) {
        try {
          const lines = stdout.split('\n')
          let finalResult = ''
          
          for (let i = lines.length - 1; i >= 0; i--) {
            if (lines[i].trim().startsWith('{')) {
              finalResult = lines[i].trim()
              break
            }
          }
          
          if (!finalResult) {
            finalResult = lines[lines.length - 1].trim()
          }
          
          const parsed = JSON.parse(finalResult)
          
          if (parsed.type === 'complete' && parsed.results) {
            const metadataMap: Record<string, any> = {}
            for (const result of parsed.results) {
              if (result.file_path) {
                metadataMap[result.file_path] = result
              }
            }
            console.log(`[Optimized Batch] Successfully extracted metadata for ${Object.keys(metadataMap).length} files`)
            resolve(metadataMap)
          } else {
            reject(new Error(`Unexpected Python output format: ${finalResult}`))
          }
        } catch (e: any) {
          reject(new Error(`Failed to parse batch JSON output: ${e.message}`))
        }
      } else {
        reject(new Error(`Python batch script failed with code ${code}: ${stderr}`))
      }
      currentPythonProcess = null
    })

    currentPythonProcess.on('error', (error) => {
      clearTimeout(timeoutId)
      cleanupPythonProcess()
      reject(error)
    })
  })
}

async function processBatch<T>(items: T[], batchSize: number, processor: (batch: T[]) => Promise<void>) {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    await processor(batch)
    
    if (i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, 10))
    }
  }
}

async function findArtworkFile(projectPath: string, projectName: string): Promise<string | null> {
  const dir = path.dirname(projectPath)
  const possiblePaths = [
    path.join(dir, "artwork.png"),
    path.join(dir, "artwork.jpg"),
    path.join(dir, "cover.png"),
    path.join(dir, "cover.jpg"),
    path.join(dir, `${projectName}.png`),
    path.join(dir, `${projectName}.jpg`),
  ]
  
  for (const artFile of possiblePaths) {
    try {
      await fs.promises.access(artFile)
      return artFile
    } catch {
      continue
    }
  }
  return null
}

async function addToProcessingQueue(task: () => Promise<void>) {
  processingQueue.push(task)
  if (!isProcessing) {
    await processQueue()
  }
}

async function processQueue() {
  isProcessing = true
  while (processingQueue.length > 0) {
    const task = processingQueue.shift()
    if (task) {
      try {
        await task()
      } catch (error) {
        console.error("Queue task error:", error)
      }
    }
    await new Promise(resolve => setTimeout(resolve, 0))
  }
  isProcessing = false
}

async function scanFLFolderInternal(folderPath: string) {
  try {
    const flpFiles = await scanForFLPFiles(folderPath)
    console.log(`Found ${flpFiles.length} FLP files`)
    
    let filteredFiles = flpFiles
    if (appSettings.excludeAutosaves) {
      const autosavePatterns = [
        /overwritten/i,
        /backup/i,
        /autosave/i,
        /\.bak$/i,
        /_backup\d*/i,
        /\(\d+\)\.flp$/i,
      ]
      filteredFiles = flpFiles.filter((flpPath) => {
        const filename = path.basename(flpPath)
        return !autosavePatterns.some((pattern) => pattern.test(filename))
      })
      console.log(`After filtering autosaves: ${filteredFiles.length} files`)
    }
    
    const existingProjects = database?.getProjects() || []
    const existingProjectMap = new Map<string, Project>()
    existingProjects.forEach(p => {
      if (p.dawProjectPath) {
        existingProjectMap.set(p.dawProjectPath, p)
      }
    })
    
    let metadataMap: Record<string, any> = {}
    try {
      metadataMap = await extractFLPMetadataBatchOptimized(filteredFiles)
    } catch (error) {
      console.error("Batch metadata extraction failed, falling back to individual:", error)
    }
    
    let addedCount = 0
    let updatedCount = 0
    
    await processBatch(filteredFiles, 50, async (batch) => {
      for (const flpPath of batch) {
        try {
          const filename = path.basename(flpPath)
          const existingProject = existingProjectMap.get(flpPath)
          
          mainWindow?.webContents?.send(IPC_CHANNELS.SCAN_PROGRESS, {
            current: filteredFiles.indexOf(flpPath) + 1,
            total: filteredFiles.length,
            daw: "FL Studio",
            file: filename
          })
          
          const metadata = metadataMap[flpPath] || { success: false }
          const projectName = metadata.project_title || path.basename(flpPath, ".flp")
          
          const [fileStats, artworkPath] = await Promise.all([
            getCachedFileStats(flpPath).catch(() => null),
            findArtworkFile(flpPath, projectName)
          ])
          
          if (existingProject) {
            const updates: any = {}
            
            if (fileStats) {
              updates.fileModifiedAt = fileStats.mtime.toISOString()
              updates.updatedAt = fileStats.mtime.toISOString()
              updates.createdAt = fileStats.birthtime.toISOString()
            }
            
            if (metadata.success) {
              if (metadata.bpm && metadata.bpm !== existingProject.bpm) {
                updates.bpm = metadata.bpm
              }
              if (metadata.time_spent_minutes !== undefined && metadata.time_spent_minutes !== null) {
                updates.timeSpent = metadata.time_spent_minutes
              }
              if (metadata.musical_key) {
                updates.musicalKey = metadata.musical_key
              }
            }
            
            if (Object.keys(updates).length > 0) {
              database?.updateProject(existingProject.id, updates)
              updatedCount++
            }
          } else {
            const projectData: any = {
              title: projectName,
              artworkPath,
              audioPreviewPath: null,
              dawProjectPath: flpPath,
              dawType: "FL Studio",
              bpm: metadata.bpm || 0,
              musicalKey: metadata.musical_key || "None",
              tags: [],
              collectionName: path.basename(path.dirname(flpPath)),
              status: "idea",
              favoriteVersionId: null,
              archived: false,
              timeSpent: metadata.time_spent_minutes || null
            }
            
            if (fileStats) {
              projectData.fileModifiedAt = fileStats.mtime.toISOString()
              projectData.createdAt = fileStats.birthtime.toISOString()
              projectData.updatedAt = fileStats.mtime.toISOString()
            } else {
              const now = new Date().toISOString()
              projectData.createdAt = now
              projectData.updatedAt = now
            }
            
            database?.createProject(projectData)
            addedCount++
          }
        } catch (error) {
          console.error(`Failed to process ${flpPath}:`, error)
        }
      }
    })
    
    console.log(`Scan complete: ${addedCount} added, ${updatedCount} updated`)
    return { count: addedCount, updated: updatedCount }
  } catch (error: any) {
    console.error("Failed to scan FL folder:", error)
    return { count: 0, error: error.message }
  }
}

async function updateFileModDatesInternal() {
  try {
    const projects = database?.getProjects() || []
    let updatedCount = 0
    
    await processBatch(projects, 20, async (batch) => {
      const updatePromises = batch.map(async (project) => {
        if (project.dawProjectPath) {
          try {
            const stats = await getCachedFileStats(project.dawProjectPath)
            const updates = {
              fileModifiedAt: stats.mtime.toISOString(),
              updatedAt: stats.mtime.toISOString(),
              createdAt: stats.birthtime.toISOString()
            }
            database?.updateProject(project.id, updates)
            updatedCount++
          } catch (error) {
            console.error(`Failed to update ${project.dawProjectPath}:`, error)
          }
        }
      })
      await Promise.all(updatePromises)
    })
    
    return { count: updatedCount }
  } catch (error: any) {
    console.error("Failed to update file modification dates:", error)
    return { count: 0, error: error.message }
  }
}

async function rescanFLPMetadataInternal() {
  const projects = database?.getProjects() || []
  const flpProjects = projects.filter(p => p.dawProjectPath && p.dawProjectPath.toLowerCase().endsWith('.flp'))
  
  if (flpProjects.length === 0) {
    return { count: 0, errors: 0 }
  }
  
  const flpPaths = flpProjects.map(p => p.dawProjectPath!).filter(Boolean)
  
  let metadataMap: Record<string, any> = {}
  try {
    metadataMap = await extractFLPMetadataBatchOptimized(flpPaths)
  } catch (error) {
    console.error("Batch rescan failed:", error)
  }
  
  let updatedCount = 0
  let errorCount = 0
  
  await processBatch(flpProjects, 20, async (batch) => {
    const updatePromises = batch.map(async (project) => {
      try {
        const metadata = metadataMap[project.dawProjectPath!] || { success: false }
        const updates: any = {}
        
        try {
          const stats = await getCachedFileStats(project.dawProjectPath!)
          updates.fileModifiedAt = stats.mtime.toISOString()
          updates.updatedAt = stats.mtime.toISOString()
          updates.createdAt = stats.birthtime.toISOString()
        } catch {
        }
        
        if (metadata.success) {
          if (metadata.bpm && metadata.bpm !== project.bpm) {
            updates.bpm = metadata.bpm
          }
          if (metadata.time_spent_minutes !== undefined && metadata.time_spent_minutes !== null) {
            updates.timeSpent = metadata.time_spent_minutes
          }
          if (metadata.musical_key) {
            updates.musicalKey = metadata.musical_key
          }
        }
        
        if (Object.keys(updates).length > 0) {
          database?.updateProject(project.id, updates)
          updatedCount++
        }
      } catch (error) {
        errorCount++
        console.error(`Rescan failed for ${project.title}:`, error)
      }
    })
    
    await Promise.all(updatePromises)
  })
  
  return { count: updatedCount, errors: errorCount }
}

function createWindow(): void {
  const { screen } = require('electron')
  const primaryDisplay = screen.getPrimaryDisplay()
  const workArea = primaryDisplay.workArea
  
  const windowWidth = Math.min(workArea.width * 0.9, 1400)
  const windowHeight = Math.min(workArea.height * 0.9, 900)
  
  const x = workArea.x + (workArea.width - windowWidth) / 2
  const y = workArea.y + (workArea.height - windowHeight) / 2

  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: x,
    y: y,
    minWidth: 1000,
    minHeight: 700,
    frame: false,
    backgroundColor: "#09090b",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, "preload.js"),
    },
    icon: path.join(__dirname, "../../assets/icon.png"),
  })

  const isDev = process.env.NODE_ENV === "development" || !app.isPackaged

  if (isDev) {
    const tryPorts = [5174, 5175, 5176, 5177, 5173, 5178, 5179, 5180, 5181, 5182, 5183, 5184, 5185]
    const checkViteServer = (port: number): Promise<boolean> => {
      return new Promise((resolve) => {
        const req = http.get(`http://localhost:${port}`, (res) => {
          let data = ''
          res.on('data', chunk => { data += chunk })
          res.on('end', () => {
            const isOurApp = data.includes('DBundone') && data.includes('main.tsx')
            resolve(isOurApp)
          })
        })
        req.on("error", () => resolve(false))
        req.setTimeout(2000, () => {
          req.destroy()
          resolve(false)
        })
      })
    }
    const findAndLoadDevServer = async () => {
      await new Promise(r => setTimeout(r, 3000))
      for (const port of tryPorts) {
        console.log(`Checking port ${port}...`)
        const isViteServer = await checkViteServer(port)
        if (isViteServer) {
          console.log(`DBundone Vite server found on port ${port}`)
          await mainWindow!.loadURL(`http://localhost:${port}`)
          return
        }
      }
      console.error("Could not connect to DBundone Vite dev server on any port")
    }
    findAndLoadDevServer()
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, "../../../renderer/index.html"))
  }

  let normalBounds: Electron.Rectangle | null = null
  
  mainWindow.on('enter-full-screen', () => {
    normalBounds = mainWindow!.getBounds()
    
    if (process.platform === 'win32') {
      const { screen } = require('electron')
      const primaryDisplay = screen.getPrimaryDisplay()
      const workArea = primaryDisplay.workArea
      
      mainWindow!.setBounds(workArea)
    }
  })
  
  mainWindow.on('leave-full-screen', () => {
    if (normalBounds) {
      mainWindow!.setBounds(normalBounds)
      normalBounds = null
    }
  })

  mainWindow.on("closed", () => {
    mainWindow = null
  })
}

async function scanForALSFiles(folderPath: string): Promise<string[]> {
  const alsFiles: string[] = []

  async function scan(dir: string) {
    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          await scan(fullPath)
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".als")) {
          alsFiles.push(fullPath)
        }
      }
    } catch (error) {
      console.error(`Cannot access ${dir}:`, error)
    }
  }

  await scan(folderPath)
  return alsFiles
}

async function extractFLPMetadata(flpPath: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const isDev = process.env.NODE_ENV === "development" || !app.isPackaged
    
    let pythonExecutable: string
    let scriptPath: string
    
    if (isDev) {
      pythonExecutable = 'C:\\Users\\paulw\\Documents\\GitHub\\dbundone\\.venv\\Scripts\\python.exe'
      scriptPath = 'C:\\Users\\paulw\\Documents\\GitHub\\dbundone\\src\\renderer\\test.py'
    } else {
      pythonExecutable = 'python'
      scriptPath = path.join(process.resourcesPath, 'test.py')
    }

    console.log('Python executable path:', pythonExecutable)
    console.log('Script path:', scriptPath)
    console.log('FLP path:', flpPath)
    console.log('Is dev:', isDev)

    if (!fs.existsSync(scriptPath)) {
      reject(new Error(`Python script not found at: ${scriptPath}`))
      return
    }

    if (isDev && !fs.existsSync(pythonExecutable)) {
      reject(new Error(`Python executable not found at: ${pythonExecutable}`))
      return
    }

    const pythonProcess = spawn(pythonExecutable, [scriptPath, flpPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: path.dirname(scriptPath)
    })

    let stdout = ''
    let stderr = ''

    if (pythonProcess.stdout) {
      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString()
      })
    }

    if (pythonProcess.stderr) {
      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString()
      })
    }

    pythonProcess.on('close', (code) => {
      console.log('Python process exited with code:', code)
      console.log('Python stdout:', stdout)
      console.log('Python stderr:', stderr)
      
      if (code === 0) {
        try {
          const metadata = JSON.parse(stdout.trim())
          console.log('Parsed metadata from Python:', metadata)
          resolve(metadata)
        } catch (e: any) {
          reject(new Error(`Failed to parse JSON output: ${e.message}`))
        }
      } else {
        reject(new Error(`Python script failed with code ${code}: ${stderr}`))
      }
    })

    pythonProcess.on('error', (error) => {
      reject(error)
    })
  })
}

async function generateProceduralArtwork(title: string, outputPath: string): Promise<void> {
  const width = 512
  const height = 512

  let hash = 0
  for (let i = 0; i < title.length; i++) {
    hash = ((hash << 5) - hash) + title.charCodeAt(i)
    hash = hash & hash
  }

  const r = (hash & 0xff) % 128 + 64
  const g = ((hash >> 8) & 0xff) % 128 + 64
  const b = ((hash >> 16) & 0xff) % 128 + 64

  const svgContent = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="rgb(${r},${g},${b})"/>
    <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="24" fill="white" text-anchor="middle" dy=".3em" font-weight="bold">${title.substring(0, 20)}</text>
  </svg>`

  const fs = require('fs')
  const path = require('path')
  const dir = path.dirname(outputPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  const svgPath = outputPath.replace('.png', '.svg')
  fs.writeFileSync(svgPath, svgContent)

  const minimalPNG = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
    0x00, 0x00, 0x00, 0x0D,
    0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01,
    0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00,
    0x90, 0x77, 0x53, 0xDE,
    0x00, 0x00, 0x00, 0x0C,
    0x49, 0x44, 0x41, 0x54,
    0x08, 0x99, 0x01, 0x01, 0x00, 0x00, 0x00, 0xFF, 0xFF, 0x00, 0x00, 0x00,
    0x02, 0x00, 0x01,
    0x00, 0x00, 0x00, 0x00,
    0x49, 0x45, 0x4E, 0x44,
    0xAE, 0x42, 0x60, 0x82
  ])

  fs.writeFileSync(outputPath, minimalPNG)
}

async function generateImageWithAI(
  prompt: string,
  outputPath: string,
  apiKey: string,
  provider: "openai" | "stability" | "replicate" | "local" | "custom",
  apiUrl?: string | null
): Promise<boolean> {
  try {
    let imageUrl: string | null = null
    let imageBuffer: Buffer | null = null

    switch (provider) {
      case "openai":
        imageUrl = await generateWithOpenAI(prompt, apiKey)
        break
      case "stability":
        imageUrl = await generateWithStabilityAI(prompt, apiKey)
        break
      case "replicate":
        imageUrl = await generateWithReplicate(prompt, apiKey)
        break
      case "local":
        imageBuffer = await generateWithLocalStableDiffusion(prompt)
        break
      case "custom":
        if (apiUrl) {
          imageUrl = await generateWithCustomAPI(prompt, apiKey, apiUrl)
        }
        break
    }

    if (provider !== "local" && imageUrl) {
      imageBuffer = await downloadImage(imageUrl)
    }

    if (!imageBuffer) {
      return false
    }

    const artworkDir = path.dirname(outputPath)
    if (!fs.existsSync(artworkDir)) {
      fs.mkdirSync(artworkDir, { recursive: true })
    }

    const pngPath = outputPath.replace(/\.\w+$/, ".png")
    
    const fileHandle = await fs.promises.open(pngPath, 'w')
    try {
      await fileHandle.write(imageBuffer, 0, imageBuffer.length)
      await fileHandle.sync()
    } finally {
      await fileHandle.close()
    }
    
    const stats = fs.statSync(pngPath)
    if (stats.size !== imageBuffer.length) {
      throw new Error(`File size mismatch: expected ${imageBuffer.length}, got ${stats.size}`)
    }
    
    console.log(`Successfully saved image to ${pngPath} (${stats.size} bytes)`)
    return true
  } catch (error) {
    console.error("Failed to generate image with AI:", error)
    return false
  }
}

async function generateWithOpenAI(prompt: string, apiKey: string): Promise<string | null> {
  try {
    console.log("Generating image with OpenAI DALL-E...")
    
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        prompt: `Create abstract digital album artwork for a music track titled: "${prompt}". Style: dark, moody, electronic music aesthetic, neon accents, minimalist, professional album cover. High quality, detailed.`,
        n: 1,
        size: "512x512",
        response_format: "url",
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error("OpenAI API error:", response.status, errorData)
      throw new Error(`OpenAI API error: ${response.status} - ${(errorData as any).error?.message || 'Unknown error'}`)
    }

    const data = await response.json() as any
    console.log("OpenAI API response:", data)
    
    if (!data.data || !data.data[0] || !data.data[0].url) {
      console.error("Invalid OpenAI API response format:", data)
      throw new Error("Invalid OpenAI API response format")
    }

    const imageUrl = data.data[0].url
    console.log("OpenAI generated image URL:", imageUrl)
    
    const verifyResponse = await fetch(imageUrl, { method: 'HEAD' })
    if (!verifyResponse.ok) {
      throw new Error(`Generated image URL is not accessible: ${verifyResponse.status}`)
    }
    
    return imageUrl
  } catch (error) {
    console.error("Failed to generate image with OpenAI:", error)
    throw error
  }
}

async function generateWithStabilityAI(prompt: string, apiKey: string): Promise<string | null> {
  const response = await fetch("https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      text_prompts: [
        {
          text: `abstract digital album artwork for music track "${prompt}", dark moody electronic aesthetic, neon accents, minimalist professional album cover`,
          weight: 1,
        },
      ],
      cfg_scale: 7,
      height: 512,
      width: 512,
      samples: 1,
      steps: 30,
    }),
  })

  if (!response.ok) {
    throw new Error(`Stability AI API error: ${response.status}`)
  }

  const data = await response.json() as any
  return data.artifacts?.[0]?.base64
    ? `data:image/png;base64,${data.artifacts[0].base64}`
    : null
}

async function generateWithReplicate(prompt: string, apiKey: string): Promise<string | null> {
  const response = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Token ${apiKey}`,
    },
    body: JSON.stringify({
      version: "39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
      input: {
        prompt: `abstract digital album artwork for music track "${prompt}", dark moody electronic aesthetic, neon accents, minimalist professional album cover`,
        negative_prompt: "text, watermark, signature, blurry, low quality",
        width: 512,
        height: 512,
        num_inference_steps: 25,
      },
    }),
  })

  if (!response.ok) {
    throw new Error(`Replicate API error: ${response.status}`)
  }

  const prediction = await response.json() as any

  let result = prediction
  while ((result as any).status !== "succeeded" && (result as any).status !== "failed") {
    await new Promise(resolve => setTimeout(resolve, 1000))
    const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
      headers: {
        "Authorization": `Token ${apiKey}`,
      },
    })
    result = await statusResponse.json() as any
  }

  if ((result as any).status === "succeeded") {
    return (result as any).output?.[0] || null
  }

  return null
}

async function generateWithLocalStableDiffusion(prompt: string): Promise<Buffer | null> {
  try {
    console.log("Generating image with local Stable Diffusion...")

    const response = await fetch("http://127.0.0.1:7860/sdapi/v1/txt2img", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: `abstract digital album artwork for music track "${prompt}", dark moody electronic aesthetic, neon accents, minimalist professional album cover, high quality, detailed`,
        negative_prompt: "text, watermark, signature, blurry, low quality, deformed, ugly, mutilated, disfigured, text, extra limbs, face cut, head cut, extra fingers, extra arms, poorly drawn face, mutation, bad proportions, cropped head, malformed limbs, mutated hands, fused fingers, long neck",
        steps: 20,
        width: 512,
        height: 512,
        cfg_scale: 7,
        sampler_name: "Euler a",
        batch_size: 1,
        n_iter: 1,
        seed: -1,
        save_images: false,
        send_images: true,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Local Stable Diffusion API error:", response.status, errorText)
      throw new Error(`Local Stable Diffusion API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json() as any
    console.log("Local Stable Diffusion API response received")

    if (!data.images || !data.images[0]) {
      console.error("Invalid local Stable Diffusion API response:", data)
      throw new Error("Invalid local Stable Diffusion API response")
    }

    const base64Data = data.images[0]
    const buffer = Buffer.from(base64Data, "base64")

    if (buffer.length === 0) {
      throw new Error("Empty image data from local Stable Diffusion")
    }

    console.log(`Successfully generated image with local Stable Diffusion (${buffer.length} bytes)`)
    return buffer
  } catch (error) {
    console.error("Failed to generate image with local Stable Diffusion:", error)
    throw error
  }
}

async function generateWithCustomAPI(prompt: string, apiKey: string, apiUrl: string): Promise<string | null> {
  try {
    console.log("Generating image with custom API:", apiUrl)

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: `Abstract digital album artwork for music track "${prompt}". Dark moody electronic aesthetic with neon accents, minimalist professional album cover design.`,
        n: 1,
        size: "1024x1024",
        response_format: "url",
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Custom API error:", response.status, errorText)
      throw new Error(`Custom API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json() as any
    console.log("Custom API response received")

    if (data.data && data.data[0] && data.data[0].url) {
      return data.data[0].url
    } else if (data.data && data.data[0] && data.data[0].b64_json) {
      return `data:image/png;base64,${data.data[0].b64_json}`
    }

    console.error("Invalid custom API response:", data)
    return null
  } catch (error) {
    console.error("Failed to generate image with custom API:", error)
    throw error
  }
}

async function downloadImage(imageUrl: string, maxRetries: number = 3): Promise<Buffer | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (imageUrl.startsWith("data:")) {
        const base64Data = imageUrl.split(",")[1]
        const buffer = Buffer.from(base64Data, "base64")
        if (buffer.length === 0) {
          throw new Error("Empty base64 data")
        }
        return buffer
      } else {
        console.log(`Downloading image (attempt ${attempt}/${maxRetries}): ${imageUrl}`)

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 30000)

        try {
          const response = await fetch(imageUrl, {
            signal: controller.signal,
            headers: {
              'User-Agent': 'DBundone/1.0'
            }
          })

          clearTimeout(timeoutId)

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }

          const contentType = response.headers.get('content-type')
          if (!contentType || !contentType.startsWith('image/')) {
            throw new Error(`Invalid content type: ${contentType}`)
          }

          const arrayBuffer = await response.arrayBuffer()
          const buffer = Buffer.from(arrayBuffer)

          if (buffer.length === 0) {
            throw new Error("Downloaded image is empty")
          }

          console.log(`Successfully downloaded ${buffer.length} bytes`)
          return buffer
        } catch (error) {
          clearTimeout(timeoutId)
          throw error
        }
      }
    } catch (error) {
      console.error(`Download attempt ${attempt} failed:`, error)

      if (attempt === maxRetries) {
        console.error("All download attempts failed")
        return null
      }

      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
      console.log(`Waiting ${delay}ms before retry...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  return null
}

function getSettingsPath(): string {
  return path.join(app.getPath("userData"), "settings.json")
}

function loadSettings(): AppSettings {
  try {
    const settingsPath = getSettingsPath()
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, "utf-8")
      const loaded = JSON.parse(data) as Partial<AppSettings>
      const settings = { ...DEFAULT_SETTINGS, ...loaded }
      settings.selectedDAWs = settings.selectedDAWs.filter(
        (daw) => SUPPORTED_DAWS.includes(daw as typeof SUPPORTED_DAWS[number])
      )
      if (settings.selectedDAWs.length === 0) {
        settings.selectedDAWs = [...SUPPORTED_DAWS]
      }
      return settings
    }
  } catch (error) {
    console.error("Failed to load settings:", error)
  }
  return { ...DEFAULT_SETTINGS }
}

function saveSettings(settings: AppSettings): boolean {
  try {
    const settingsPath = getSettingsPath()
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf-8")
    appSettings = settings
    return true
  } catch (error) {
    console.error("Failed to save settings:", error)
    return false
  }
}

function setupIpcHandlers(): void {
  if (!database) {
    console.error('Database not initialized')
    return
  }

  ipcMain.handle(IPC_CHANNELS.DB_GET_PROJECTS, async () => {
    return database!.getProjects()
  })

  ipcMain.handle(IPC_CHANNELS.DB_GET_PROJECT, async (_, id: string) => {
    return database!.getProject(id)
  })

  ipcMain.handle(
    IPC_CHANNELS.DB_CREATE_PROJECT,
    async (_, project: Omit<Project, "id"> & { createdAt?: string; updatedAt?: string }) => {
      return database!.createProject(project)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.DB_UPDATE_PROJECT,
    async (_, id: string, project: Partial<Project>) => {
      return database!.updateProject(id, project)
    }
  )

  ipcMain.handle(IPC_CHANNELS.DB_DELETE_PROJECT, async (_, id: string) => {
    return database!.deleteProject(id)
  })

  ipcMain.handle(IPC_CHANNELS.DB_GET_GROUPS, async () => {
    return database!.getGroups()
  })

  ipcMain.handle(IPC_CHANNELS.DB_GET_GROUP, async (_, id: string) => {
    return database!.getGroup(id)
  })

  ipcMain.handle(
    IPC_CHANNELS.DB_CREATE_GROUP,
    async (_, group: Omit<ProjectGroup, "id" | "createdAt" | "updatedAt">) => {
      return database!.createGroup(group)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.DB_UPDATE_GROUP,
    async (_, id: string, group: Partial<ProjectGroup>) => {
      return database!.updateGroup(id, group)
    }
  )

  ipcMain.handle(IPC_CHANNELS.DB_DELETE_GROUP, async (_, id: string) => {
    return database!.deleteGroup(id)
  })

  ipcMain.handle(IPC_CHANNELS.DB_GET_TASKS, async () => {
    return database!.getTasks()
  })

  ipcMain.handle(
    IPC_CHANNELS.DB_CREATE_TASK,
    async (_, task: Omit<Task, "id" | "createdAt" | "updatedAt">) => {
      return database!.createTask(task)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.DB_UPDATE_TASK,
    async (_, id: string, task: Partial<Task>) => {
      return database!.updateTask(id, task)
    }
  )

  ipcMain.handle(IPC_CHANNELS.DB_DELETE_TASK, async (_, id: string) => {
    return database!.deleteTask(id)
  })

  ipcMain.handle(
    IPC_CHANNELS.DB_REORDER_TASKS,
    async (_, tasks: { id: string; order: number; status: Task["status"] }[]) => {
      return database!.reorderTasks(tasks)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.DB_GET_TASKS_BY_PROJECT,
    async (_, projectId: string) => {
      return database!.getTasksByProject(projectId)
    }
  )

  ipcMain.handle(IPC_CHANNELS.DB_GET_TAGS, async () => {
    return database!.getTags()
  })

  ipcMain.handle(IPC_CHANNELS.DB_CREATE_TAG, async (_, tag: Omit<Tag, "id">) => {
    return database!.createTag(tag)
  })

  ipcMain.handle(IPC_CHANNELS.DB_DELETE_TAG, async (_, id: string) => {
    return database!.deleteTag(id)
  })

  ipcMain.handle(IPC_CHANNELS.DB_CLEAR_ALL_PROJECTS, async () => {
    return database!.clearAllProjects()
  })

  ipcMain.handle(IPC_CHANNELS.DB_GET_VERSIONS, async (_, projectId: string) => {
    return database!.getVersionsByProject(projectId)
  })

  ipcMain.handle(IPC_CHANNELS.DB_GET_VERSION, async (_, id: string) => {
    return database!.getVersion(id)
  })

  ipcMain.handle(
    IPC_CHANNELS.DB_CREATE_VERSION,
    async (_, version: Omit<AudioVersion, 'id' | 'createdAt' | 'versionNumber'>) => {
      return database!.createVersion(version)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.DB_UPDATE_VERSION,
    async (_, id: string, version: Partial<AudioVersion>) => {
      return database!.updateVersion(id, version)
    }
  )

  ipcMain.handle(IPC_CHANNELS.DB_DELETE_VERSION, async (_, id: string) => {
    return database!.deleteVersion(id)
  })

  ipcMain.handle(IPC_CHANNELS.DB_GET_ANNOTATIONS, async (_, versionId: string) => {
    return database!.getAnnotationsByVersion(versionId)
  })

  ipcMain.handle(
    IPC_CHANNELS.DB_CREATE_ANNOTATION,
    async (_, annotation: Omit<Annotation, 'id' | 'createdAt' | 'updatedAt'>) => {
      return database!.createAnnotation(annotation)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.DB_UPDATE_ANNOTATION,
    async (_, id: string, annotation: Partial<Annotation>) => {
      return database!.updateAnnotation(id, annotation)
    }
  )

  ipcMain.handle(IPC_CHANNELS.DB_DELETE_ANNOTATION, async (_, id: string) => {
    return database!.deleteAnnotation(id)
  })

  ipcMain.handle(IPC_CHANNELS.AUDIO_GET_WAVEFORM_PEAKS, async (_, filePath: string, numPeaks: number = 200) => {
    try {
      const ffmpegPath = app.isPackaged
        ? path.join(process.resourcesPath, 'ffmpeg', 'ffmpeg.exe')
        : require('ffmpeg-static');

      return new Promise<number[]>((resolve, reject) => {
        const chunks: Buffer[] = [];
        
        const ffmpeg = spawn(ffmpegPath, [
          '-i', filePath,
          '-ac', '1',
          '-ar', '8000',
          '-f', 's16le',
          '-acodec', 'pcm_s16le',
          '-'
        ]);

        ffmpeg.stdout.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        ffmpeg.stderr.on('data', (data: Buffer) => {
          const msg = data.toString();
          if (msg.includes('Error') || msg.includes('Invalid')) {
            console.error('FFmpeg error:', msg);
          }
        });

        ffmpeg.on('close', (code: number) => {
          if (code !== 0) {
            reject(new Error(`FFmpeg exited with code ${code}`));
            return;
          }

          const pcmBuffer = Buffer.concat(chunks);
          const samples = new Int16Array(
            pcmBuffer.buffer,
            pcmBuffer.byteOffset,
            pcmBuffer.length / 2
          );

          const peaks: number[] = [];
          const samplesPerPeak = Math.floor(samples.length / numPeaks);
          
          if (samplesPerPeak === 0) {
            for (let i = 0; i < samples.length && peaks.length < numPeaks; i++) {
              peaks.push(Math.abs(samples[i]) / 32768);
            }
          } else {
            for (let i = 0; i < numPeaks; i++) {
              const start = i * samplesPerPeak;
              const end = Math.min(start + samplesPerPeak, samples.length);
              
              let maxAmp = 0;
              for (let j = start; j < end; j++) {
                const amp = Math.abs(samples[j]);
                if (amp > maxAmp) maxAmp = amp;
              }
              
              peaks.push(maxAmp / 32768);
            }
          }

          const maxPeak = Math.max(...peaks);
          if (maxPeak > 0 && maxPeak < 0.5) {
            const boost = 0.8 / maxPeak;
            for (let i = 0; i < peaks.length; i++) {
              peaks[i] = Math.min(1, peaks[i] * boost);
            }
          }

          resolve(peaks);
        });

        ffmpeg.on('error', (err: Error) => {
          reject(new Error(`Failed to spawn ffmpeg: ${err.message}`));
        });
      });
    } catch (error) {
      console.error('Waveform extraction error:', error);
      throw new Error(`Failed to extract waveform: ${(error as Error).message}`);
    }
  })

  ipcMain.handle(IPC_CHANNELS.FILE_SELECT_IMAGE, async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ["openFile"],
      filters: [{ name: "Images", extensions: ["jpg", "jpeg", "png", "gif", "webp", "svg"] }],
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle(IPC_CHANNELS.FILE_SELECT_AUDIO, async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ["openFile"],
      filters: [{ name: "Audio", extensions: ["mp3", "wav", "flac", "ogg", "m4a", "aac"] }],
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle(IPC_CHANNELS.FILE_SELECT_PROJECT, async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ["openFile"],
      filters: [
        { name: "DAW Projects", extensions: ["als", "flp", "logic", "ptx", "cpr", "rpp", "aup"] },
        { name: "All Files", extensions: ["*"] },
      ],
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle(IPC_CHANNELS.FILE_SELECT_FOLDER, async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ["openDirectory"],
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle(IPC_CHANNELS.FILE_READ_DIR, async (_, folderPath: string) => {
    try {
      return fs.readdirSync(folderPath)
    } catch (error) {
      console.error("Failed to read directory:", error)
      return []
    }
  })

  ipcMain.handle(IPC_CHANNELS.FILE_DETECT_PROJECTS, async (_, folderPath: string) => {
    try {
      const result = { hasFLP: false, hasALS: false }

      async function scan(dir: string) {
        try {
          const entries = await fs.promises.readdir(dir, { withFileTypes: true })
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name)
            if (entry.isDirectory()) {
              await scan(fullPath)
            } else if (entry.isFile()) {
              const name = entry.name.toLowerCase()
              if (name.endsWith('.flp')) result.hasFLP = true
              else if (name.endsWith('.als')) result.hasALS = true
            }
          }
        } catch (error) {
        }
      }

      await scan(folderPath)
      return result
    } catch (error) {
      console.error("Failed to detect projects:", error)
      return { hasFLP: false, hasALS: false }
    }
  })

  ipcMain.handle(IPC_CHANNELS.FILE_OPEN_IN_DAW, async (_, filePath: string) => {
    try {
      await shell.openPath(filePath)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle(IPC_CHANNELS.FILE_OPEN_FOLDER, async (_, folderPath: string) => {
    try {
      await shell.openPath(folderPath)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle(IPC_CHANNELS.FILE_LOAD_AUDIO, async (_, filePath: string) => {
    try {
      const fs = require('fs')
      const buffer = fs.readFileSync(filePath)
      const arrayBuffer = new ArrayBuffer(buffer.length)
      const uint8Array = new Uint8Array(arrayBuffer)
      buffer.copy(uint8Array, 0, 0, buffer.length)
      return arrayBuffer
    } catch (error) {
      throw new Error(`Failed to load audio file: ${(error as Error).message}`)
    }
  })

  ipcMain.handle(IPC_CHANNELS.SCAN_FL_FOLDER, async (_, folderPath: string) => {
    return new Promise((resolve) => {
      addToProcessingQueue(async () => {
        try {
          const result = await scanFLFolderInternal(folderPath)
          if (mainWindow?.webContents) {
            mainWindow.webContents.send('scan:complete', result)
          }
          resolve(result)
        } catch (error: any) {
          const errorResult = { count: 0, error: error.message }
          if (mainWindow?.webContents) {
            mainWindow.webContents.send('scan:complete', errorResult)
          }
          resolve(errorResult)
        }
      })
    })
  })

  ipcMain.handle('test-extract-metadata', async (_, flpPath: string) => {
    try {
      const metadata = await extractFLPMetadata(flpPath)
      return { success: true, metadata }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle(IPC_CHANNELS.EXTRACT_FLP_METADATA, async (_, flpPath: string) => {
    try {
      const metadata = await extractFLPMetadata(flpPath)
      return metadata
    } catch (error) {
      console.error(`Failed to extract FLP metadata for ${flpPath}:`, error)
      return null
    }
  })

  ipcMain.handle(IPC_CHANNELS.EXTRACT_FLP_METADATA_BATCH, async (_, flpPaths: string[]) => {
    try {
      console.log(`[IPC] Batch metadata extraction for ${flpPaths.length} files`)
      const metadata = await extractFLPMetadataBatchOptimized(flpPaths)
      return { success: true, metadata }
    } catch (error: any) {
      console.error(`Failed to extract FLP metadata batch:`, error)
      return { success: false, error: error.message, metadata: {} }
    }
  })

  ipcMain.handle(IPC_CHANNELS.SCAN_ABLETON_FOLDER, async (_, folderPath: string) => {
    try {
      let alsFiles = await scanForALSFiles(folderPath)
      let addedCount = 0

      if (appSettings.excludeAutosaves) {
        const autosavePatterns = [
          /overwritten/i,
          /backup/i,
          /autosave/i,
          /\.bak$/i,
          /_backup\d*/i,
          /\(\d+\)\.als$/i,
          /backup\.als$/i,
          /.*backup.*\.als$/i,
          /\[\d{4}-\d{2}-\d{2} \d{6}\]\.als$/i,
        ]
        alsFiles = alsFiles.filter((alsPath) => {
          const filename = path.basename(alsPath)
          return !autosavePatterns.some((pattern) => pattern.test(filename))
        })
      }

      let processedCount = 0
      for (const alsPath of alsFiles) {
        processedCount++
        mainWindow?.webContents.send(IPC_CHANNELS.SCAN_PROGRESS, {
          current: processedCount,
          total: alsFiles.length,
          daw: "Ableton Live",
          file: path.basename(alsPath)
        })

        const projectName = path.basename(alsPath, ".als")

        const existingProjects = database!.getProjects()
        const existingProject = existingProjects.find((p) => p.dawProjectPath === alsPath)

        if (existingProject) {
          const fileStats = fs.statSync(alsPath)
          const fileModifiedAt = fileStats.mtime.toISOString()
          const fileCreatedAt = fileStats.birthtime.toISOString()

          const updates: any = {
            fileModifiedAt,
            updatedAt: fileModifiedAt,
            createdAt: fileCreatedAt,
          }

          console.log(`Updating ALS dates for ${existingProject.title}: createdAt=${fileCreatedAt}, updatedAt=${fileModifiedAt}`)

          database!.updateProject(existingProject.id, updates)
        } else {
          let artworkPath: string | null = null
          const possibleArtPaths = [
            path.join(path.dirname(alsPath), "artwork.png"),
            path.join(path.dirname(alsPath), "artwork.jpg"),
            path.join(path.dirname(alsPath), "cover.png"),
            path.join(path.dirname(alsPath), "cover.jpg"),
            path.join(path.dirname(alsPath), projectName + ".png"),
            path.join(path.dirname(alsPath), projectName + ".jpg"),
          ]

          for (const artFile of possibleArtPaths) {
            if (fs.existsSync(artFile)) {
              artworkPath = artFile
              break
            }
          }

          const fileStats = fs.statSync(alsPath)
          const fileModifiedAt = fileStats.mtime.toISOString()
          const fileCreatedAt = fileStats.birthtime.toISOString()

          database!.createProject({
            title: projectName,
            artworkPath,
            audioPreviewPath: null,
            dawProjectPath: alsPath,
            dawType: "Ableton Live",
            bpm: 0,
            musicalKey: "None",
            tags: [],
            collectionName: path.basename(path.dirname(alsPath)),
            status: "idea",
            favoriteVersionId: null,
            fileModifiedAt,
            archived: false,
            createdAt: fileCreatedAt,
            updatedAt: fileModifiedAt,
          })

          addedCount++
        }
      }

      return { count: addedCount }
    } catch (error) {
      console.error("Failed to scan Ableton folder:", error)
      return { count: 0, error: (error as Error).message }
    }
  })

  ipcMain.handle(IPC_CHANNELS.UPDATE_FILE_MOD_DATES, async () => {
    return new Promise((resolve) => {
      addToProcessingQueue(async () => {
        try {
          const result = await updateFileModDatesInternal()
          resolve(result)
        } catch (error: any) {
          resolve({ count: 0, error: error.message })
        }
      })
    })
  })

  ipcMain.handle("update-daw-types", async () => {
    try {
      const projects = database!.getProjects()
      let updatedCount = 0

      for (const project of projects) {
        if (project.dawType === "Ableton") {
          database!.updateProject(project.id, { dawType: "Ableton Live" })
          updatedCount++
        }
      }

      return { count: updatedCount }
    } catch (error) {
      console.error("Failed to update DAW types:", error)
      return { count: 0, error: (error as Error).message }
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.GENERATE_ARTWORK,
    async (_, projectId: string, projectTitle: string) => {
      try {
        const userDataPath = app.getPath("userData")
        const artworkDir = path.join(userDataPath, "artwork")
        const outputPath = path.join(artworkDir, `${projectId}.png`)

        if (appSettings.aiProvider !== "local" && !appSettings.aiApiKey) {
          throw new Error("AI API key not configured")
        }

        if (appSettings.aiProvider === "custom" && !appSettings.aiApiUrl) {
          throw new Error("Custom API URL not configured")
        }

        const aiSuccess = await generateImageWithAI(
          projectTitle,
          outputPath,
          appSettings.aiApiKey,
          appSettings.aiProvider,
          appSettings.aiApiUrl
        )

        if (!aiSuccess) {
          await generateProceduralArtwork(projectTitle, outputPath)
        }

        if (fs.existsSync(outputPath)) {
          let attempts = 0
          const maxAttempts = 10
          while (attempts < maxAttempts) {
            try {
              const stats = fs.statSync(outputPath)
              if (stats.size > 0) {
                await new Promise(resolve => setTimeout(resolve, 200))
                const finalStats = fs.statSync(outputPath)
                if (finalStats.size > 0) {
                  database!.updateProject(projectId, { artworkPath: outputPath })
                  return outputPath
                }
              }
            } catch (error) {
              console.log(`Waiting for file to be ready... attempt ${attempts + 1}`)
            }
            await new Promise(resolve => setTimeout(resolve, 100))
            attempts++
          }
          console.error("File was not properly written after maximum attempts")
        }

        return null
      } catch (error) {
        console.error("Failed to generate artwork:", error)
        return null
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.FETCH_UNSPLASH_PHOTO,
    async (_, projectId: string) => {
      try {
        const userDataPath = app.getPath("userData")
        const artworkDir = path.join(userDataPath, "artwork")
        const outputPath = path.join(artworkDir, `${projectId}_unsplash.jpg`)

        if (!fs.existsSync(artworkDir)) {
          fs.mkdirSync(artworkDir, { recursive: true })
        }

        const sources = [
          'https://picsum.photos/800/600?random=' + Date.now(),
          'https://loremflickr.com/800/600/music,studio,production/all',
          'https://source.unsplash.com/random/800x600/?music,studio,production',
          'https://via.placeholder.com/800x600/1a1a2e/ffffff?text=Music+Studio'
        ]

        let lastError: Error | null = null

        for (const source of sources) {
          try {
            console.log(`Attempting to fetch image from: ${source}`)

            if (source.includes('via.placeholder.com')) {
              console.log('Using placeholder image generation')
              const width = 800
              const height = 600
              const bgColor = '1a1a2e'
              const textColor = 'ffffff'
              const text = 'Music Studio'

              const svgContent = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
                <rect width="100%" height="100%" fill="#${bgColor}"/>
                <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="48" fill="#${textColor}" text-anchor="middle" dy=".3em" font-weight="bold">${text}</text>
              </svg>`

              const svgPath = outputPath.replace('.jpg', '.svg')
              fs.writeFileSync(svgPath, svgContent)

              const buffer = Buffer.from([
                0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
                0x00, 0x00, 0x00, 0x0D,
                0x49, 0x48, 0x44, 0x52,
                0x00, 0x00, 0x03, 0x20,
                0x00, 0x00, 0x02, 0x58,
                0x08, 0x02, 0x00, 0x00, 0x00,
                0x4C, 0x8F, 0x5E, 0x51,
                0x00, 0x00, 0x00, 0x0C,
                0x49, 0x44, 0x41, 0x54,
                0x08, 0x99, 0x01, 0x01, 0x00, 0x00, 0x00, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01,
                0x00, 0x00, 0x00, 0x00,
                0x49, 0x45, 0x4E, 0x44,
                0xAE, 0x42, 0x60, 0x82
              ])

              fs.writeFileSync(outputPath, buffer)
              console.log('Generated placeholder image successfully')
            } else {
              const imageBuffer = await downloadImage(source, 2)
              if (!imageBuffer) {
                throw new Error(`Failed to download from ${source}`)
              }

              fs.writeFileSync(outputPath, imageBuffer)
              console.log(`Successfully downloaded and saved image from ${source}`)
            }

            if (fs.existsSync(outputPath)) {
              const stats = fs.statSync(outputPath)
              if (stats.size > 100) {
                await new Promise(resolve => setTimeout(resolve, 200))

                database!.updateProject(projectId, { artworkPath: outputPath })
                console.log(`Successfully updated project ${projectId} with artwork`)
                return outputPath
              } else {
                fs.unlinkSync(outputPath)
                throw new Error('Downloaded file too small')
              }
            } else {
              throw new Error('File was not created')
            }

          } catch (error) {
            lastError = error as Error
            console.log(`Failed to get image from ${source}:`, (error as Error).message)

            if (fs.existsSync(outputPath)) {
              try {
                fs.unlinkSync(outputPath)
              } catch (cleanupError) {
                console.log('Failed to clean up partial file:', cleanupError)
              }
            }
          }
        }

        console.error('All image sources failed. Last error:', lastError?.message)
        throw new Error(`Failed to fetch artwork after trying all sources. Last error: ${lastError?.message}`)

      } catch (error) {
        console.error("Failed to fetch Unsplash photo:", error)
        throw error
      }
    }
  )

  ipcMain.handle("scan:rescan-flp-metadata", async () => {
    return new Promise((resolve) => {
      addToProcessingQueue(async () => {
        try {
          const result = await rescanFLPMetadataInternal()
          resolve(result)
        } catch (error: any) {
          resolve({ count: 0, error: error.message })
        }
      })
    })
  })

  ipcMain.handle(IPC_CHANNELS.APP_GET_VERSION, () => {
    return app.getVersion()
  })

  ipcMain.on(IPC_CHANNELS.APP_MINIMIZE, () => {
    mainWindow?.minimize()
  })

  ipcMain.on(IPC_CHANNELS.APP_MAXIMIZE, () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow?.maximize()
    }
  })

  ipcMain.on(IPC_CHANNELS.APP_CLOSE, () => {
    mainWindow?.close()
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async () => {
    return appSettings
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, async (_, settings: AppSettings) => {
    return saveSettings(settings)
  })
}

app.whenReady().then(() => {
  const userDataPath = app.getPath("userData")
  database = new Database(path.join(userDataPath, "dbundone.db"))

  appSettings = loadSettings()

  createWindow()
  setupIpcHandlers()

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
  }
})

app.on("before-quit", () => {
  cleanupPythonProcess()
  if (database) {
    database.close()
  }
})