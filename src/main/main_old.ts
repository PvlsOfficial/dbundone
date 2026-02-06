import { app, BrowserWindow, ipcMain, dialog, shell } from "electron"
import * as path from "path"
import * as fs from "fs"
import * as https from "https"
import * as http from "http"
import { spawn } from "child_process"
import { Database } from "./database"
import { IPC_CHANNELS, Project, ProjectGroup, Task, Tag, AppSettings, DEFAULT_SETTINGS, SUPPORTED_DAWS, AudioVersion, Annotation } from "../shared/types"

let mainWindow: BrowserWindow | null = null
let database: Database | null = null

let appSettings: AppSettings = { ...DEFAULT_SETTINGS }

// Register custom protocol for local audio files
app.whenReady().then(() => {
  const { protocol } = require('electron');
  protocol.registerFileProtocol(
    'appfile',
    (request: Electron.ProtocolRequest, callback: (filePath: string) => void) => {
      // Remove protocol prefix and decode URI
      let filePath = request.url.replace(/^appfile:\/\//, "");
      // On Windows, filePath may start with a slash, remove it
      if (process.platform === 'win32' && filePath.startsWith('/')) {
        filePath = filePath.slice(1);
      }
      // Decode URI components (spaces, etc)
      filePath = decodeURIComponent(filePath);
      console.log('Serving file:', filePath);
      callback(filePath);
    }
  );
});

const isDev = process.env.NODE_ENV === "development" || !app.isPackaged

function createWindow(): void {
  // Calculate window size based on work area (excluding taskbar)
  const { screen } = require('electron')
  const primaryDisplay = screen.getPrimaryDisplay()
  const workArea = primaryDisplay.workArea
  
  // Use work area dimensions, but cap at reasonable maximums
  const windowWidth = Math.min(workArea.width * 0.9, 1400)
  const windowHeight = Math.min(workArea.height * 0.9, 900)
  
  // Center the window in the work area
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
      sandbox: false, // Required for preload script to work with contextBridge
      preload: path.join(__dirname, "preload.js"),
    },
    icon: path.join(__dirname, "../../assets/icon.png"),
  })

  if (isDev) {
    // Try multiple ports in case default ports are in use
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

  // Handle fullscreen to avoid taskbar overlap on Windows
  let normalBounds: Electron.Rectangle | null = null
  
  mainWindow.on('enter-full-screen', () => {
    // Store normal bounds before going fullscreen
    normalBounds = mainWindow!.getBounds()
    
    // On Windows, adjust for taskbar by getting the work area
    if (process.platform === 'win32') {
      const { screen } = require('electron')
      const primaryDisplay = screen.getPrimaryDisplay()
      const workArea = primaryDisplay.workArea
      
      // Set window to work area bounds (excludes taskbar)
      mainWindow!.setBounds(workArea)
    }
  })
  
  mainWindow.on('leave-full-screen', () => {
    // Restore normal bounds when leaving fullscreen
    if (normalBounds) {
      mainWindow!.setBounds(normalBounds)
      normalBounds = null
    }
  })

  mainWindow.on("closed", () => {
    mainWindow = null
  })
}

// Recursively scan folder for .flp files
async function scanForFLPFiles(folderPath: string): Promise<string[]> {
  const flpFiles: string[] = []

  async function scan(dir: string) {
    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          await scan(fullPath)
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".flp")) {
          flpFiles.push(fullPath)
        }
      }
    } catch (error) {
      // Skip folders we can't access
      console.error(`Cannot access ${dir}:`, error)
    }
  }

  await scan(folderPath)
  return flpFiles
}

// Extract metadata from FLP file using Python script (single file - backwards compatible)
async function extractFLPMetadata(flpPath: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const isDev = process.env.NODE_ENV === "development" || !app.isPackaged
    
    let pythonExecutable: string
    let scriptPath: string
    
    if (isDev) {
      // Development paths
      pythonExecutable = 'C:\\Users\\paulw\\Documents\\GitHub\\dbundone\\.venv\\Scripts\\python.exe'
      scriptPath = 'C:\\Users\\paulw\\Documents\\GitHub\\dbundone\\src\\renderer\\test.py'
    } else {
      // Production paths - use system Python and bundled script
      pythonExecutable = 'python' // Use system Python
      scriptPath = path.join(process.resourcesPath, 'test.py')
    }

    console.log('Python executable path:', pythonExecutable)
    console.log('Script path:', scriptPath)
    console.log('FLP path:', flpPath)
    console.log('Is dev:', isDev)

    // Check if script file exists
    if (!fs.existsSync(scriptPath)) {
      reject(new Error(`Python script not found at: ${scriptPath}`))
      return
    }

    // Check if Python executable exists (only in development)
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

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    pythonProcess.on('close', (code) => {
      console.log('Python process exited with code:', code)
      console.log('Python stdout:', stdout)
      console.log('Python stderr:', stderr)
      
      if (code === 0) {
        try {
          const metadata = JSON.parse(stdout.trim())
          console.log('Parsed metadata from Python:', metadata)
          resolve(metadata)
        } catch (e) {
          reject(new Error(`Failed to parse JSON output: ${e}`))
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

// Extract metadata from multiple FLP files in batch (much faster - single Python process)
async function extractFLPMetadataBatch(flpPaths: string[]): Promise<Record<string, any>> {
  return new Promise((resolve, reject) => {
    if (flpPaths.length === 0) {
      resolve({})
      return
    }

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

    console.log(`[Batch] Processing ${flpPaths.length} FLP files`)

    // Check if script file exists
    if (!fs.existsSync(scriptPath)) {
      reject(new Error(`Python script not found at: ${scriptPath}`))
      return
    }

    // Check if Python executable exists (only in development)
    if (isDev && !fs.existsSync(pythonExecutable)) {
      reject(new Error(`Python executable not found at: ${pythonExecutable}`))
      return
    }

    // Use --batch flag and send file paths via stdin
    const pythonProcess = spawn(pythonExecutable, [scriptPath, '--batch'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: path.dirname(scriptPath)
    })

    let stdout = ''
    let stderr = ''

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    // Send the file paths as JSON array via stdin
    pythonProcess.stdin.write(JSON.stringify(flpPaths))
    pythonProcess.stdin.end()

    pythonProcess.on('close', (code) => {
      console.log(`[Batch] Python process exited with code: ${code}`)
      if (stderr) {
        console.log('[Batch] Python stderr:', stderr)
      }
      
      if (code === 0) {
        try {
          const results = JSON.parse(stdout.trim())
          
          // Convert array of results to a map keyed by file_path
          const metadataMap: Record<string, any> = {}
          if (Array.isArray(results)) {
            for (const result of results) {
              if (result.file_path) {
                metadataMap[result.file_path] = result
              }
            }
          }
          
          console.log(`[Batch] Successfully extracted metadata for ${Object.keys(metadataMap).length} files`)
          resolve(metadataMap)
        } catch (e) {
          reject(new Error(`Failed to parse batch JSON output: ${e}`))
        }
      } else {
        reject(new Error(`Python batch script failed with code ${code}: ${stderr}`))
      }
    })

    pythonProcess.on('error', (error) => {
      reject(error)
    })
  })
}

// Recursively scan folder for .als files
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
      // Skip folders we can't access
      console.error(`Cannot access ${dir}:`, error)
    }
  }

  await scan(folderPath)
  return alsFiles
}

// Generate procedural artwork as fallback
async function generateProceduralArtwork(title: string, outputPath: string): Promise<void> {
  // Create a simple colored SVG as artwork
  const width = 512
  const height = 512

  // Generate a color based on the title hash
  let hash = 0
  for (let i = 0; i < title.length; i++) {
    hash = ((hash << 5) - hash) + title.charCodeAt(i)
    hash = hash & hash // Convert to 32-bit integer
  }

  const r = (hash & 0xff) % 128 + 64 // Keep colors muted
  const g = ((hash >> 8) & 0xff) % 128 + 64
  const b = ((hash >> 16) & 0xff) % 128 + 64

  // Create SVG content
  const svgContent = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="rgb(${r},${g},${b})"/>
    <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="24" fill="white" text-anchor="middle" dy=".3em" font-weight="bold">${title.substring(0, 20)}</text>
  </svg>`

  // Create directory if it doesn't exist
  const fs = require('fs')
  const path = require('path')
  const dir = path.dirname(outputPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  // For now, save as SVG instead of PNG to ensure it works
  // In a real implementation, you'd convert SVG to PNG
  const svgPath = outputPath.replace('.png', '.svg')
  fs.writeFileSync(svgPath, svgContent)

  // Also create a simple PNG placeholder - a minimal 1x1 PNG
  // This is a valid minimal PNG file (1x1 transparent pixel)
  const minimalPNG = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, // IHDR length
    0x49, 0x48, 0x44, 0x52, // IHDR type
    0x00, 0x00, 0x00, 0x01, // Width: 1
    0x00, 0x00, 0x00, 0x01, // Height: 1
    0x08, 0x02, 0x00, 0x00, 0x00, // Bit depth: 8, Color type: 2 (RGB), Compression: 0, Filter: 0, Interlace: 0
    0x90, 0x77, 0x53, 0xDE, // IHDR CRC
    0x00, 0x00, 0x00, 0x0C, // IDAT length
    0x49, 0x44, 0x41, 0x54, // IDAT type
    0x08, 0x99, 0x01, 0x01, 0x00, 0x00, 0x00, 0xFF, 0xFF, 0x00, 0x00, 0x00, // Compressed data for 1x1 RGB pixel
    0x02, 0x00, 0x01, // IDAT CRC (approximate)
    0x00, 0x00, 0x00, 0x00, // IEND length
    0x49, 0x45, 0x4E, 0x44, // IEND type
    0xAE, 0x42, 0x60, 0x82  // IEND CRC
  ])

  // Write the minimal PNG as a placeholder
  fs.writeFileSync(outputPath, minimalPNG)
}

// Generate image using AI services (online or local)
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
      // Download the image and save it locally for online providers
      imageBuffer = await downloadImage(imageUrl)
    }

    if (!imageBuffer) {
      return false
    }

    // Create artwork directory if it doesn't exist
    const artworkDir = path.dirname(outputPath)
    if (!fs.existsSync(artworkDir)) {
      fs.mkdirSync(artworkDir, { recursive: true })
    }

    // Save as PNG with proper file handling
    const pngPath = outputPath.replace(/\.\w+$/, ".png")
    
    // Write file with explicit sync to ensure it's fully written
    const fileHandle = await fs.promises.open(pngPath, 'w')
    try {
      await fileHandle.write(imageBuffer, 0, imageBuffer.length)
      await fileHandle.sync() // Force flush to disk
    } finally {
      await fileHandle.close()
    }
    
    // Verify the file was written correctly
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

// Generate image with OpenAI DALL-E
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
        response_format: "url", // Ensure we get URLs, not base64
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
    
    // Verify the URL is accessible
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

// Generate image with Stability AI
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

// Generate image with Replicate
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

  // Poll for completion
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

// Generate image with local Stable Diffusion WebUI (Automatic1111)
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
        seed: -1, // Random seed
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

    // Decode base64 image data
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

// Generate image with custom OpenAI-compatible API
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

// Download image from URL and return as buffer
async function downloadImage(imageUrl: string, maxRetries: number = 3): Promise<Buffer | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (imageUrl.startsWith("data:")) {
        // Handle base64 data URLs (from Stability AI)
        const base64Data = imageUrl.split(",")[1]
        const buffer = Buffer.from(base64Data, "base64")
        if (buffer.length === 0) {
          throw new Error("Empty base64 data")
        }
        return buffer
      } else {
        // Handle regular URLs (DALL-E, Replicate)
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

      // Wait before retrying (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
      console.log(`Waiting ${delay}ms before retry...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  return null
}

function setupIpcHandlers(): void {
  if (!database) return

  // Project handlers
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

  // Group handlers
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

  // Task handlers
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

  // Tag handlers
  ipcMain.handle(IPC_CHANNELS.DB_GET_TAGS, async () => {
    return database!.getTags()
  })

  ipcMain.handle(IPC_CHANNELS.DB_CREATE_TAG, async (_, tag: Omit<Tag, "id">) => {
    return database!.createTag(tag)
  })

  ipcMain.handle(IPC_CHANNELS.DB_DELETE_TAG, async (_, id: string) => {
    return database!.deleteTag(id)
  })

  // Database management
  ipcMain.handle(IPC_CHANNELS.DB_CLEAR_ALL_PROJECTS, async () => {
    return database!.clearAllProjects()
  })

  // Audio Version handlers
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

  // Annotation handlers
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

  // Audio waveform peaks extraction
  ipcMain.handle(IPC_CHANNELS.AUDIO_GET_WAVEFORM_PEAKS, async (_, filePath: string, numPeaks: number = 200) => {
    try {
      // Use ffmpeg to extract raw PCM audio data
      const ffmpegPath = app.isPackaged
        ? path.join(process.resourcesPath, 'ffmpeg', 'ffmpeg.exe')
        : require('ffmpeg-static');

      return new Promise<number[]>((resolve, reject) => {
        const chunks: Buffer[] = [];
        
        // Use ffmpeg to convert audio to raw PCM (mono, 16-bit, 8000Hz for efficiency)
        const ffmpeg = spawn(ffmpegPath, [
          '-i', filePath,
          '-ac', '1',           // mono
          '-ar', '8000',        // 8kHz sample rate (sufficient for waveform)
          '-f', 's16le',        // signed 16-bit little-endian PCM
          '-acodec', 'pcm_s16le',
          '-'                   // output to stdout
        ]);

        ffmpeg.stdout.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        ffmpeg.stderr.on('data', (data: Buffer) => {
          // FFmpeg outputs info to stderr, we can ignore most of it
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

          // Calculate peaks by sampling the audio
          const peaks: number[] = [];
          const samplesPerPeak = Math.floor(samples.length / numPeaks);
          
          if (samplesPerPeak === 0) {
            // Very short audio, just return what we have
            for (let i = 0; i < samples.length && peaks.length < numPeaks; i++) {
              peaks.push(Math.abs(samples[i]) / 32768);
            }
          } else {
            for (let i = 0; i < numPeaks; i++) {
              const start = i * samplesPerPeak;
              const end = Math.min(start + samplesPerPeak, samples.length);
              
              // Find the max amplitude in this chunk
              let maxAmp = 0;
              for (let j = start; j < end; j++) {
                const amp = Math.abs(samples[j]);
                if (amp > maxAmp) maxAmp = amp;
              }
              
              // Normalize to 0-1 range
              peaks.push(maxAmp / 32768);
            }
          }

          // Apply some light normalization so quiet tracks still show up
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

  // File handlers
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
          // Skip folders we can't access
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

  // Load audio file as ArrayBuffer
  ipcMain.handle(IPC_CHANNELS.FILE_LOAD_AUDIO, async (_, filePath: string) => {
    try {
      const fs = require('fs')
      const buffer = fs.readFileSync(filePath)
      // Create a new ArrayBuffer and copy the data
      const arrayBuffer = new ArrayBuffer(buffer.length)
      const uint8Array = new Uint8Array(arrayBuffer)
      buffer.copy(uint8Array, 0, 0, buffer.length)
      return arrayBuffer
    } catch (error) {
      throw new Error(`Failed to load audio file: ${(error as Error).message}`)
    }
  })

  // FL Studio folder scanning
  ipcMain.handle(IPC_CHANNELS.SCAN_FL_FOLDER, async (_, folderPath: string) => {
    try {
      let flpFiles = await scanForFLPFiles(folderPath)
      let addedCount = 0

      // Filter out autosave/backup files if setting is enabled
      if (appSettings.excludeAutosaves) {
        const autosavePatterns = [
          /overwritten/i,
          /backup/i,
          /autosave/i,
          /\.bak$/i,
          /_backup\d*/i,
          /\(\d+\)\.flp$/i, // Files like "project (1).flp", "project (2).flp"
        ]
        flpFiles = flpFiles.filter((flpPath) => {
          const filename = path.basename(flpPath)
          return !autosavePatterns.some((pattern) => pattern.test(filename))
        })
      }

      let processedCount = 0
      for (const flpPath of flpFiles) {
        try {
          // Send progress update
          processedCount++
          mainWindow?.webContents.send(IPC_CHANNELS.SCAN_PROGRESS, {
            current: processedCount,
            total: flpFiles.length,
            daw: "FL Studio",
            file: path.basename(flpPath)
          })

          // Extract metadata from FLP file
          const metadata = await extractFLPMetadata(flpPath)
          console.log(`Extracted metadata for ${flpPath}:`, metadata)
          console.log('time_spent_minutes from metadata:', metadata.time_spent_minutes, 'type:', typeof metadata.time_spent_minutes)

          // Check if metadata extraction was successful
          if (!metadata.success) {
            console.error(`Failed to extract metadata for ${flpPath}: ${metadata.error}`)
            // Continue with basic project creation if metadata extraction fails
            const projectName = path.basename(flpPath, ".flp")

            // Check if project already exists
            const existingProjects = database!.getProjects()
            const existingProject = existingProjects.find((p) => p.dawProjectPath === flpPath)

            if (!existingProject) {
              // Look for artwork
              let artworkPath: string | null = null
              const possibleArtPaths = [
                path.join(path.dirname(flpPath), "artwork.png"),
                path.join(path.dirname(flpPath), "artwork.jpg"),
                path.join(path.dirname(flpPath), "cover.png"),
                path.join(path.dirname(flpPath), "cover.jpg"),
                path.join(path.dirname(flpPath), projectName + ".png"),
                path.join(path.dirname(flpPath), projectName + ".jpg"),
              ]

              for (const artFile of possibleArtPaths) {
                if (fs.existsSync(artFile)) {
                  artworkPath = artFile
                  break
                }
              }

              // Get file modification date
              const fileStats = fs.statSync(flpPath)
              const fileModifiedAt = fileStats.mtime.toISOString()
              const fileCreatedAt = fileStats.birthtime.toISOString()

              // Create the project without metadata
              database!.createProject({
                title: projectName,
                artworkPath,
                audioPreviewPath: null,
                dawProjectPath: flpPath,
                dawType: "FL Studio",
                bpm: 0,
                musicalKey: "None",
                tags: [],
                collectionName: path.basename(path.dirname(flpPath)),
                status: "idea",
                favoriteVersionId: null,
                fileModifiedAt,
                archived: false,
                createdAt: fileCreatedAt,
                updatedAt: fileModifiedAt,
              })

              addedCount++
            }
            continue
          }

          // Get project name from metadata or filename
          const projectName = metadata.project_title || path.basename(flpPath, ".flp")

          // Check if project already exists (by DAW project path)
          const existingProjects = database!.getProjects()
          const existingProject = existingProjects.find((p) => p.dawProjectPath === flpPath)

          if (existingProject) {
            // Get file dates for existing project
            const fileStats = fs.statSync(flpPath)
            const fileModifiedAt = fileStats.mtime.toISOString()
            const fileCreatedAt = fileStats.birthtime.toISOString()

            console.log(`Updating existing FLP project: ${flpPath}`)
            console.log(`File stats - birthtime: ${fileStats.birthtime}, mtime: ${fileStats.mtime}`)
            console.log(`Converted dates - createdAt: ${fileCreatedAt}, updatedAt: ${fileModifiedAt}`)

            // Update existing project with metadata - ALWAYS update dates from file metadata
            const updates: any = {
              fileModifiedAt,
              updatedAt: fileModifiedAt,
              createdAt: fileCreatedAt,  // Always use file creation date
            }

            console.log(`Updating dates for ${existingProject.title}: createdAt=${fileCreatedAt}, updatedAt=${fileModifiedAt}`)

            if (metadata.bpm && metadata.bpm !== existingProject.bpm) {
              updates.bpm = metadata.bpm
            }

            if (metadata.time_spent_minutes !== undefined && metadata.time_spent_minutes !== null && metadata.time_spent_minutes !== existingProject.timeSpent) {
              console.log(`Updating timeSpent for ${existingProject.title}: ${existingProject.timeSpent} -> ${metadata.time_spent_minutes}`)
              updates.timeSpent = metadata.time_spent_minutes
            }

            if (metadata.musical_key && metadata.musical_key !== existingProject.musicalKey) {
              updates.musicalKey = metadata.musical_key
            }

            database!.updateProject(existingProject.id, updates)
          } else {
            // Look for artwork
            let artworkPath: string | null = null
            const possibleArtPaths = [
              path.join(path.dirname(flpPath), "artwork.png"),
              path.join(path.dirname(flpPath), "artwork.jpg"),
              path.join(path.dirname(flpPath), "cover.png"),
              path.join(path.dirname(flpPath), "cover.jpg"),
              path.join(path.dirname(flpPath), projectName + ".png"),
              path.join(path.dirname(flpPath), projectName + ".jpg"),
            ]

            for (const artFile of possibleArtPaths) {
              if (fs.existsSync(artFile)) {
                artworkPath = artFile
                break
              }
            }

            // Get file modification date
            const fileStats = fs.statSync(flpPath)
            const fileModifiedAt = fileStats.mtime.toISOString()
            const fileCreatedAt = fileStats.birthtime.toISOString()

            console.log(`Creating new FLP project: ${flpPath}`)
            console.log(`File stats - birthtime: ${fileStats.birthtime}, mtime: ${fileStats.mtime}`)
            console.log(`Converted dates - createdAt: ${fileCreatedAt}, updatedAt: ${fileModifiedAt}`)

            // Create the project with metadata
            database!.createProject({
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
              fileModifiedAt,
              archived: false,
              timeSpent: metadata.time_spent_minutes !== undefined && metadata.time_spent_minutes !== null ? metadata.time_spent_minutes : null,
              createdAt: fileCreatedAt,
              updatedAt: fileModifiedAt,
            })

            addedCount++
          }
        } catch (error) {
          console.error(`Failed to extract metadata from ${flpPath}:`, error)
          // Continue with basic project creation if metadata extraction fails
          const projectName = path.basename(flpPath, ".flp")

          // Check if project already exists
          const existingProjects = database!.getProjects()
          const existingProject = existingProjects.find((p) => p.dawProjectPath === flpPath)

          if (!existingProject) {
            // Look for artwork
            let artworkPath: string | null = null
            const possibleArtPaths = [
              path.join(path.dirname(flpPath), "artwork.png"),
              path.join(path.dirname(flpPath), "artwork.jpg"),
              path.join(path.dirname(flpPath), "cover.png"),
              path.join(path.dirname(flpPath), "cover.jpg"),
              path.join(path.dirname(flpPath), projectName + ".png"),
              path.join(path.dirname(flpPath), projectName + ".jpg"),
            ]

            for (const artFile of possibleArtPaths) {
              if (fs.existsSync(artFile)) {
                artworkPath = artFile
                break
              }
            }

            // Get file modification date
            const fileStats = fs.statSync(flpPath)
            const fileModifiedAt = fileStats.mtime.toISOString()
            const fileCreatedAt = fileStats.birthtime.toISOString()

            // Create the project without metadata
            database!.createProject({
              title: projectName,
              artworkPath,
              audioPreviewPath: null,
              dawProjectPath: flpPath,
              dawType: "FL Studio",
              bpm: 0,
              musicalKey: "None",
              tags: [],
              collectionName: path.basename(path.dirname(flpPath)),
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
      }

      return { count: addedCount }
    } catch (error) {
      console.error("Failed to scan FL folder:", error)
      return { count: 0, error: (error as Error).message }
    }
  })

  // Test metadata extraction
  ipcMain.handle('test-extract-metadata', async (_, flpPath: string) => {
    try {
      const metadata = await extractFLPMetadata(flpPath)
      return { success: true, metadata }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // FLP metadata extraction (single file)
  ipcMain.handle(IPC_CHANNELS.EXTRACT_FLP_METADATA, async (_, flpPath: string) => {
    try {
      const metadata = await extractFLPMetadata(flpPath)
      return metadata
    } catch (error) {
      console.error(`Failed to extract FLP metadata for ${flpPath}:`, error)
      return null
    }
  })

  // FLP metadata extraction (batch - much faster for multiple files)
  ipcMain.handle(IPC_CHANNELS.EXTRACT_FLP_METADATA_BATCH, async (_, flpPaths: string[]) => {
    try {
      console.log(`[IPC] Batch metadata extraction for ${flpPaths.length} files`)
      const metadata = await extractFLPMetadataBatch(flpPaths)
      return { success: true, metadata }
    } catch (error) {
      console.error(`Failed to extract FLP metadata batch:`, error)
      return { success: false, error: (error as Error).message, metadata: {} }
    }
  })

  // Ableton folder scanning
  ipcMain.handle(IPC_CHANNELS.SCAN_ABLETON_FOLDER, async (_, folderPath: string) => {
    try {
      let alsFiles = await scanForALSFiles(folderPath)
      let addedCount = 0

      // Filter out autosave/backup files if setting is enabled
      if (appSettings.excludeAutosaves) {
        const autosavePatterns = [
          /overwritten/i,
          /backup/i,
          /autosave/i,
          /\.bak$/i,
          /_backup\d*/i,
          /\(\d+\)\.als$/i, // Files like "project (1).als", "project (2).als"
          /backup\.als$/i, // Files ending with "backup.als"
          /.*backup.*\.als$/i, // Files containing "backup" anywhere in the name
          /\[\d{4}-\d{2}-\d{2} \d{6}\]\.als$/i, // Ableton timestamp backups like "project [2025-06-17 030124].als"
        ]
        alsFiles = alsFiles.filter((alsPath) => {
          const filename = path.basename(alsPath)
          return !autosavePatterns.some((pattern) => pattern.test(filename))
        })
      }

      let processedCount = 0
      for (const alsPath of alsFiles) {
        // Send progress update
        processedCount++
        mainWindow?.webContents.send(IPC_CHANNELS.SCAN_PROGRESS, {
          current: processedCount,
          total: alsFiles.length,
          daw: "Ableton Live",
          file: path.basename(alsPath)
        })

        // Get project name from filename (without extension)
        const projectName = path.basename(alsPath, ".als")

        // Check if project already exists (by DAW project path)
        const existingProjects = database!.getProjects()
        const existingProject = existingProjects.find((p) => p.dawProjectPath === alsPath)

        if (existingProject) {
          // Update file modification date for existing project
          const fileStats = fs.statSync(alsPath)
          const fileModifiedAt = fileStats.mtime.toISOString()
          const fileCreatedAt = fileStats.birthtime.toISOString()

          // Always update dates from file metadata
          const updates: any = {
            fileModifiedAt,
            updatedAt: fileModifiedAt,
            createdAt: fileCreatedAt,  // Always use file creation date
          }

          console.log(`Updating ALS dates for ${existingProject.title}: createdAt=${fileCreatedAt}, updatedAt=${fileModifiedAt}`)

          database!.updateProject(existingProject.id, updates)
        } else {
          // Look for artwork
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

          // Get file modification date
          const fileStats = fs.statSync(alsPath)
          const fileModifiedAt = fileStats.mtime.toISOString()
          const fileCreatedAt = fileStats.birthtime.toISOString()

          // Create the project
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

  // Update file modification dates for existing projects
  ipcMain.handle(IPC_CHANNELS.UPDATE_FILE_MOD_DATES, async () => {
    try {
      const projects = database!.getProjects()
      let updatedCount = 0

      for (const project of projects) {
        if (project.dawProjectPath && fs.existsSync(project.dawProjectPath)) {
          try {
            const fileStats = fs.statSync(project.dawProjectPath)
            const fileModifiedAt = fileStats.mtime.toISOString()
            const fileCreatedAt = fileStats.birthtime.toISOString()

            // Always update dates from file metadata
            const updates: any = {
              fileModifiedAt,
              updatedAt: fileModifiedAt,
              createdAt: fileCreatedAt,  // Always use file creation date
            }

            console.log(`Updating file dates for ${project.title}: createdAt=${fileCreatedAt}, updatedAt=${fileModifiedAt}`)

            database!.updateProject(project.id, updates)
            updatedCount++
          } catch (error) {
            console.error(`Failed to update file dates for ${project.dawProjectPath}:`, error)
          }
        }
      }

      return { count: updatedCount }
    } catch (error) {
      console.error("Failed to update file modification dates:", error)
      return { count: 0, error: (error as Error).message }
    }
  })

  // Update DAW types for existing projects (migration for consistency)
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

  // AI Artwork generation
  ipcMain.handle(
    IPC_CHANNELS.GENERATE_ARTWORK,
    async (_, projectId: string, projectTitle: string) => {
      try {
        const userDataPath = app.getPath("userData")
        const artworkDir = path.join(userDataPath, "artwork")
        const outputPath = path.join(artworkDir, `${projectId}.png`)

        // Check if API key is configured (not needed for local)
        if (appSettings.aiProvider !== "local" && !appSettings.aiApiKey) {
          throw new Error("AI API key not configured")
        }

        // Check if custom API URL is configured for custom provider
        if (appSettings.aiProvider === "custom" && !appSettings.aiApiUrl) {
          throw new Error("Custom API URL not configured")
        }

        // Try AI generation
        const aiSuccess = await generateImageWithAI(
          projectTitle,
          outputPath,
          appSettings.aiApiKey,
          appSettings.aiProvider,
          appSettings.aiApiUrl
        )

        if (!aiSuccess) {
          // Fallback to procedural generation
          await generateProceduralArtwork(projectTitle, outputPath)
        }

        // Update project with new artwork path
        if (fs.existsSync(outputPath)) {
          // Wait for the file to be fully written and stable
          let attempts = 0
          const maxAttempts = 10
          while (attempts < maxAttempts) {
            try {
              const stats = fs.statSync(outputPath)
              if (stats.size > 0) {
                // Additional wait to ensure file is stable
                await new Promise(resolve => setTimeout(resolve, 200))
                // Verify file is still accessible and has content
                const finalStats = fs.statSync(outputPath)
                if (finalStats.size > 0) {
                  database!.updateProject(projectId, { artworkPath: outputPath })
                  return outputPath
                }
              }
            } catch (error) {
              // File might still be writing
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

  // Unsplash random photo fetch
  ipcMain.handle(
    IPC_CHANNELS.FETCH_UNSPLASH_PHOTO,
    async (_, projectId: string) => {
      try {
        const userDataPath = app.getPath("userData")
        const artworkDir = path.join(userDataPath, "artwork")
        const outputPath = path.join(artworkDir, `${projectId}_unsplash.jpg`)

        // Ensure artwork directory exists
        if (!fs.existsSync(artworkDir)) {
          fs.mkdirSync(artworkDir, { recursive: true })
        }

        // Try multiple image sources as fallback with better error handling
        const sources = [
          // Primary sources - more reliable
          'https://picsum.photos/800/600?random=' + Date.now(), // Add timestamp to avoid caching
          'https://loremflickr.com/800/600/music,studio,production/all',
          'https://source.unsplash.com/random/800x600/?music,studio,production',
          // Fallback to placeholder that always works
          'https://via.placeholder.com/800x600/1a1a2e/ffffff?text=Music+Studio'
        ]

        let lastError: Error | null = null

        for (const source of sources) {
          try {
            console.log(`Attempting to fetch image from: ${source}`)

            // For placeholder, we can generate it locally instead of downloading
            if (source.includes('via.placeholder.com')) {
              console.log('Using placeholder image generation')
              // Generate a simple colored background with text
              const width = 800
              const height = 600
              const bgColor = '1a1a2e'
              const textColor = 'ffffff'
              const text = 'Music Studio'

              // Create a simple SVG that will be saved as JPG
              const svgContent = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
                <rect width="100%" height="100%" fill="#${bgColor}"/>
                <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="48" fill="#${textColor}" text-anchor="middle" dy=".3em" font-weight="bold">${text}</text>
              </svg>`

              // Save as SVG first, then we'll handle it
              const svgPath = outputPath.replace('.jpg', '.svg')
              fs.writeFileSync(svgPath, svgContent)

              // For now, create a simple colored PNG as fallback
              const buffer = Buffer.from([
                0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
                0x00, 0x00, 0x00, 0x0D, // IHDR length
                0x49, 0x48, 0x44, 0x52, // IHDR type
                0x00, 0x00, 0x03, 0x20, // Width: 800
                0x00, 0x00, 0x02, 0x58, // Height: 600
                0x08, 0x02, 0x00, 0x00, 0x00, // Bit depth: 8, Color type: 2 (RGB), etc.
                0x4C, 0x8F, 0x5E, 0x51, // IHDR CRC
                0x00, 0x00, 0x00, 0x0C, // IDAT length
                0x49, 0x44, 0x41, 0x54, // IDAT type
                0x08, 0x99, 0x01, 0x01, 0x00, 0x00, 0x00, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, // Compressed data
                0x00, 0x00, 0x00, 0x00, // IEND length
                0x49, 0x45, 0x4E, 0x44, // IEND type
                0xAE, 0x42, 0x60, 0x82  // IEND CRC
              ])

              fs.writeFileSync(outputPath, buffer)
              console.log('Generated placeholder image successfully')
            } else {
              // Download from external source
              const imageBuffer = await downloadImage(source, 2) // 2 retries per source
              if (!imageBuffer) {
                throw new Error(`Failed to download from ${source}`)
              }

              fs.writeFileSync(outputPath, imageBuffer)
              console.log(`Successfully downloaded and saved image from ${source}`)
            }

            // Verify the file was written and update database
            if (fs.existsSync(outputPath)) {
              const stats = fs.statSync(outputPath)
              if (stats.size > 100) { // Ensure it's not an empty/corrupted file
                // Wait a bit for file to be stable
                await new Promise(resolve => setTimeout(resolve, 200))

                database!.updateProject(projectId, { artworkPath: outputPath })
                console.log(`Successfully updated project ${projectId} with artwork`)
                return outputPath
              } else {
                // File too small, delete and try next source
                fs.unlinkSync(outputPath)
                throw new Error('Downloaded file too small')
              }
            } else {
              throw new Error('File was not created')
            }

          } catch (error) {
            lastError = error as Error
            console.log(`Failed to get image from ${source}:`, (error as Error).message)

            // Clean up any partial files
            if (fs.existsSync(outputPath)) {
              try {
                fs.unlinkSync(outputPath)
              } catch (cleanupError) {
                console.log('Failed to clean up partial file:', cleanupError)
              }
            }

            // Continue to next source
          }
        }

        // If we get here, all sources failed
        console.error('All image sources failed. Last error:', lastError?.message)
        throw new Error(`Failed to fetch artwork after trying all sources. Last error: ${lastError?.message}`)

      } catch (error) {
        console.error("Failed to fetch Unsplash photo:", error)
        throw error // Re-throw so frontend knows it failed
      }
    }
  )

  // Rescan FLP metadata for existing projects
  ipcMain.handle("scan:rescan-flp-metadata", async () => {
    try {
      console.log("Starting FLP metadata rescan...")
      const projects = database!.getProjects()
      const flpProjects = projects.filter(p => p.dawProjectPath && p.dawProjectPath.toLowerCase().endsWith('.flp'))
      
      console.log(`Found ${flpProjects.length} FLP projects to rescan`)
      
      let updatedCount = 0
      let errorCount = 0
      
      for (const project of flpProjects) {
        try {
          console.log(`Processing project: ${project.title} (${project.dawProjectPath})`)
          const metadata = await extractFLPMetadata(project.dawProjectPath!)
          console.log(`Rescanned metadata for ${project.title}:`, JSON.stringify(metadata, null, 2))
          
          if (!metadata.success) {
            console.error(`Failed to extract metadata for ${project.title}: ${metadata.error}`)
            errorCount++
            continue
          }
          
          const updates: any = {}

          // Get actual file dates - ALWAYS update from file metadata
          const fileStats = fs.statSync(project.dawProjectPath!)
          const fileModifiedAt = fileStats.mtime.toISOString()
          const fileCreatedAt = fileStats.birthtime.toISOString()

          updates.fileModifiedAt = fileModifiedAt
          updates.updatedAt = fileModifiedAt
          updates.createdAt = fileCreatedAt  // Always use file creation date

          console.log(`Rescan updating dates for ${project.title}: createdAt=${fileCreatedAt}, updatedAt=${fileModifiedAt}`)

          console.log(`Current project timeSpent: ${project.timeSpent}, metadata time_spent_minutes: ${metadata.time_spent_minutes}`)

          if (metadata.bpm && metadata.bpm !== project.bpm) {
            console.log(`Updating BPM for ${project.title}: ${project.bpm} -> ${metadata.bpm}`)
            updates.bpm = metadata.bpm
          }

          if (metadata.time_spent_minutes !== undefined && metadata.time_spent_minutes !== null) {
            console.log(`Updating timeSpent for ${project.title}: ${project.timeSpent} -> ${metadata.time_spent_minutes}`)
            updates.timeSpent = metadata.time_spent_minutes
          } else {
            console.log(`NOT updating timeSpent for ${project.title}: metadata.time_spent_minutes is ${metadata.time_spent_minutes}`)
          }

          if (metadata.musical_key && metadata.musical_key !== project.musicalKey) {
            console.log(`Updating musicalKey for ${project.title}: ${project.musicalKey} -> ${metadata.musical_key}`)
            updates.musicalKey = metadata.musical_key
          }

          console.log(`Updates object keys: ${Object.keys(updates).join(', ')} (length: ${Object.keys(updates).length})`)

          if (Object.keys(updates).length > 1) { // More than just fileModifiedAt
            console.log(`Updating database for ${project.title} with:`, updates)
            database!.updateProject(project.id, updates)
            updatedCount++
            console.log(`Successfully updated ${project.title}`)
          } else {
            console.log(`No updates needed for ${project.title}`)
          }
        } catch (error) {
          console.error(`Failed to rescan metadata for ${project.title}:`, error)
          errorCount++
        }
      }
      
      console.log(`Rescan complete. Updated ${updatedCount} projects, ${errorCount} errors.`)
      return { count: updatedCount, errors: errorCount }
    } catch (error) {
      console.error("Failed to rescan FLP metadata:", error)
      return { count: 0, error: (error as Error).message }
    }
  })

  // App handlers
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

  // Settings handlers
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async () => {
    return appSettings
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, async (_, settings: AppSettings) => {
    return saveSettings(settings)
  })
}

// Settings file path
function getSettingsPath(): string {
  return path.join(app.getPath("userData"), "settings.json")
}

// Load settings from file
function loadSettings(): AppSettings {
  try {
    const settingsPath = getSettingsPath()
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, "utf-8")
      const loaded = JSON.parse(data) as Partial<AppSettings>
      const settings = { ...DEFAULT_SETTINGS, ...loaded }
      // Migrate: ensure selectedDAWs only contains supported DAWs
      settings.selectedDAWs = settings.selectedDAWs.filter(
        (daw) => SUPPORTED_DAWS.includes(daw as typeof SUPPORTED_DAWS[number])
      )
      // Ensure at least one DAW is selected
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

// Save settings to file
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

app.whenReady().then(() => {
  // Initialize database
  const userDataPath = app.getPath("userData")
  database = new Database(path.join(userDataPath, "dbundone.db"))

  // Load settings
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
  database?.close()
})
