import React, { useState, useEffect } from "react"
import { motion } from "framer-motion"
import {
  Settings as SettingsIcon,
  FolderOpen,
  Sparkles,
  Monitor,
  Save,
  RotateCcw,
  Check,
  Trash2,
  RefreshCw,
  Music,
  Database,
  ImageOff,
  FolderSync,
  FileMusic,
  Image,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "../components/ui/label"
import { Switch } from "../components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { DEFAULT_SETTINGS } from "@/lib/constants"
import { Logo } from "@/components/Logo"
import type { AppSettings } from "@shared/types"

// Check if running in Electron - must be a function to check at runtime after preload
const isElectron = () => typeof window !== 'undefined' && typeof window.electron !== 'undefined'

interface SettingsProps {
  onClose?: () => void
  onDatabaseCleared?: () => void
  onRescan?: () => Promise<void>
  onRefreshMetadata?: () => Promise<void>
  onSyncFileDates?: () => Promise<void>
  settings?: AppSettings
  onSettingsChange?: (settings: Partial<AppSettings>) => void
  onRemoveAllArtwork?: () => Promise<void>
}

const aiProviders = [
  { name: "Local Stable Diffusion (Free)", value: "local", description: "Run on your own hardware, no API costs" },
  { name: "OpenAI (DALL-E)", value: "openai", description: "High quality, requires API key" },
  { name: "Stability AI", value: "stability", description: "Stable Diffusion via API" },
  { name: "Replicate", value: "replicate", description: "Various models available" },
  { name: "Custom API", value: "custom", description: "Use any OpenAI-compatible API" },
]

const accentColorPresets = [
  { name: "Purple", value: "#8b5cf6" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Green", value: "#10b981" },
  { name: "Orange", value: "#f97316" },
  { name: "Red", value: "#ef4444" },
  { name: "Pink", value: "#ec4899" },
  { name: "Indigo", value: "#6366f1" },
  { name: "Teal", value: "#14b8a6" },
]

export const Settings: React.FC<SettingsProps> = ({ onClose, onDatabaseCleared, onRescan, onRefreshMetadata, onSyncFileDates, settings: externalSettings, onSettingsChange: externalOnSettingsChange, onRemoveAllArtwork }) => {
  const [settings, setSettings] = useState<AppSettings>(externalSettings || DEFAULT_SETTINGS)
  const [originalSettings, setOriginalSettings] = useState<AppSettings>(externalSettings || DEFAULT_SETTINGS)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [isUpdatingFileModDates, setIsUpdatingFileModDates] = useState(false)
  const [isRemovingArtwork, setIsRemovingArtwork] = useState(false)
  const [showRemoveArtworkConfirm, setShowRemoveArtworkConfirm] = useState(false)

  useEffect(() => {
    if (externalSettings) {
      setSettings(externalSettings)
      setOriginalSettings(externalSettings)
      setIsLoading(false)
    }
  }, [externalSettings])

  useEffect(() => {
    const changed = JSON.stringify(settings) !== JSON.stringify(originalSettings)
    setHasChanges(changed)
  }, [settings, originalSettings])



  const handleSave = async () => {
    if (!externalOnSettingsChange) return

    setIsSaving(true)
    try {
      await externalOnSettingsChange(settings)
      setOriginalSettings(settings)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2000)
    } catch (error) {
      console.error("Failed to save settings:", error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS)
  }



  const handleSelectDAWFolder = async (daw: string) => {
    if (!isElectron()) {
      // In browser mode, show a message or use a text input
      console.log("Folder selection only available in desktop app")
      return
    }
    try {
      const folderPath = await window.electron?.selectFolder()
      if (folderPath) {
        setSettings((prev) => ({
          ...prev,
          dawFolders: {
            ...prev.dawFolders,
            [daw]: folderPath
          }
        }))
      }
    } catch (error) {
      console.error("Failed to select folder:", error)
    }
  }

  const handleClearDatabase = async () => {
    if (!isElectron()) {
      console.log("Database clearing only available in desktop app")
      return
    }
    setIsClearing(true)
    try {
      const deletedCount = await window.electron?.clearAllProjects()
      setShowClearConfirm(false)
      console.log(`Cleared ${deletedCount} projects from database`)
      // Notify parent to refresh data
      if (onDatabaseCleared) {
        onDatabaseCleared()
      }
    } catch (error) {
      console.error("Failed to clear database:", error)
    } finally {
      setIsClearing(false)
    }
  }

  const handleSyncFileDates = async () => {
    if (!isElectron()) return
    setIsUpdatingFileModDates(true)
    try {
      await onSyncFileDates?.()
    } finally {
      setIsUpdatingFileModDates(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading settings...</div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-6 py-5 border-b border-border/30"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-xl bg-primary/10">
              <SettingsIcon className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className="gap-2"
            >
              {saveSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  Saved
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Settings Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* DAW Selection Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Music className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">DAW Configuration</h2>
          </div>
          <div className="space-y-4 p-4 rounded-xl bg-card/50 border border-border/30">
            <div className="space-y-3">
              <div>
                <Label>Select Your DAWs</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Choose which DAWs you use. Only selected DAWs will appear in filter dropdowns.
                </p>
              </div>

              <div className="space-y-3">
                {["FL Studio", "Ableton Live"].map((daw) => {
                  const isSelected = settings.selectedDAWs.includes(daw);
                  const isFlStudio = daw === "FL Studio";
                  return (
                    <motion.div
                      key={daw}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={cn(
                        "relative p-4 rounded-lg border transition-all duration-200",
                        isSelected
                          ? "border-primary/50 bg-primary/5 shadow-sm"
                          : "border-border/30 bg-card/30 hover:border-border/50"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0">
                          <div
                            className={cn(
                              "w-5 h-5 rounded border-2 transition-all cursor-pointer flex items-center justify-center",
                              isSelected
                                ? "bg-primary border-primary shadow-sm"
                                : "border-muted-foreground/30 hover:border-muted-foreground/50"
                            )}
                            onClick={() => {
                              setSettings((prev) => ({
                                ...prev,
                                selectedDAWs: isSelected
                                  ? prev.selectedDAWs.filter(d => d !== daw)
                                  : [...prev.selectedDAWs, daw]
                              }));
                            }}
                          >
                            {isSelected && (
                              <Check className="w-3.5 h-3.5 text-primary-foreground" />
                            )}
                          </div>
                        </div>

                        <div className="flex-1">
                          <Label
                            className={cn(
                              "text-sm font-medium cursor-pointer select-none",
                              isSelected ? "text-foreground" : "text-muted-foreground"
                            )}
                            onClick={() => {
                              setSettings((prev) => ({
                                ...prev,
                                selectedDAWs: isSelected
                                  ? prev.selectedDAWs.filter(d => d !== daw)
                                  : [...prev.selectedDAWs, daw]
                              }));
                            }}
                          >
                            {daw}
                          </Label>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {isFlStudio ? "FL Studio projects (.flp)" : "Ableton Live projects (.als)"}
                          </p>
                        </div>
                      </div>

                      {/* FL Studio folder config inline */}
                      {isFlStudio && isSelected && (
                        <div className="mt-4 pt-4 border-t border-border/30">
                          <Label htmlFor="flStudioPath" className="text-xs">Projects Folder</Label>
                          <div className="flex gap-2 mt-1.5">
                            <Input
                              id="flStudioPath"
                              value={settings.dawFolders["FL Studio"] || settings.flStudioPath || ""}
                              onChange={(e) =>
                                setSettings((prev) => ({
                                  ...prev,
                                  dawFolders: { ...prev.dawFolders, "FL Studio": e.target.value }
                                }))
                              }
                              placeholder="Select your FL Studio projects folder..."
                              className="flex-1 h-9 text-sm"
                            />
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-9 w-9"
                              onClick={() => handleSelectDAWFolder("FL Studio")}
                            >
                              <FolderOpen className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Ableton Live folder config inline */}
                      {!isFlStudio && isSelected && (
                        <div className="mt-4 pt-4 border-t border-border/30">
                          <Label htmlFor="abletonPath" className="text-xs">Projects Folder</Label>
                          <div className="flex gap-2 mt-1.5">
                            <Input
                              id="abletonPath"
                              value={settings.dawFolders["Ableton Live"] || ""}
                              onChange={(e) =>
                                setSettings((prev) => ({
                                  ...prev,
                                  dawFolders: { ...prev.dawFolders, "Ableton Live": e.target.value }
                                }))
                              }
                              placeholder="Select your Ableton Live projects folder..."
                              className="flex-1 h-9 text-sm"
                            />
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-9 w-9"
                              onClick={() => handleSelectDAWFolder("Ableton Live")}
                            >
                              <FolderOpen className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        </motion.section>

        {/* Folders Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <FolderOpen className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">General Settings</h2>
          </div>
          <div className="space-y-4 p-4 rounded-xl bg-card/50 border border-border/30">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Exclude Autosaves & Backups</Label>
                <p className="text-xs text-muted-foreground">
                  Skip files with "overwritten", "backup", "autosave" in the name when scanning
                </p>
              </div>
              <Switch
                checked={settings.excludeAutosaves}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({ ...prev, excludeAutosaves: checked }))
                }
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Unsplash Photos</Label>
                <p className="text-xs text-muted-foreground">
                  Enable random Unsplash photo assignment for individual projects and bulk "Add Photos to All"
                </p>
              </div>
              <Switch
                checked={settings.unsplashEnabled}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({ ...prev, unsplashEnabled: checked }))
                }
              />
            </div>
          </div>
        </motion.section>

        {/* Theme Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Monitor className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Appearance</h2>
          </div>
          <div className="space-y-4 p-4 rounded-xl bg-card/50 border border-border/30">
            <div className="space-y-2">
              <Label htmlFor="theme">Theme</Label>
              <Select
                value={settings.theme}
                onValueChange={(value: "dark" | "light" | "system") =>
                  setSettings((prev) => ({ ...prev, theme: value }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select theme" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Choose your preferred theme or follow system settings
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="accentColor">Accent Color</Label>
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {accentColorPresets.map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() =>
                        setSettings((prev) => ({ ...prev, accentColor: preset.value }))
                      }
                      className={cn(
                        "w-8 h-8 rounded-full border-2 transition-all hover:scale-110",
                        settings.accentColor === preset.value
                          ? "border-foreground shadow-lg"
                          : "border-border hover:border-muted-foreground"
                      )}
                      style={{ backgroundColor: preset.value }}
                      title={preset.name}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <input
                    id="accentColor"
                    type="color"
                    value={settings.accentColor}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, accentColor: e.target.value }))
                    }
                    className="w-12 h-8 rounded border border-border cursor-pointer"
                  />
                  <Input
                    value={settings.accentColor}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, accentColor: e.target.value }))
                    }
                    placeholder="#6366f1"
                    className="flex-1 font-mono text-sm"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Choose from presets or pick a custom color for buttons, links, and highlights
              </p>
            </div>
          </div>
        </motion.section>

        {/* AI Artwork Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">AI Artwork Generation</h2>
          </div>
          <div className="space-y-4 p-4 rounded-xl bg-card/50 border border-border/30">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Auto-generate Artwork</Label>
                <p className="text-xs text-muted-foreground">
                  Automatically generate artwork for new projects
                </p>
              </div>
              <Switch
                checked={settings.autoGenerateArtwork}
                onCheckedChange={(checked: boolean) =>
                  setSettings((prev) => ({ ...prev, autoGenerateArtwork: checked }))
                }
              />
            </div>

            <Separator />

            <div className="space-y-3">
              <Label>AI Provider</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {aiProviders.map((provider) => {
                  const isSelected = settings.aiProvider === provider.value;
                  return (
                    <motion.div
                      key={provider.value}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() =>
                        setSettings((prev) => ({ ...prev, aiProvider: provider.value as any }))
                      }
                      className={cn(
                        "relative p-3 rounded-lg border cursor-pointer transition-all duration-200",
                        isSelected
                          ? "border-primary/50 bg-primary/5 shadow-sm"
                          : "border-border/30 bg-card/30 hover:border-border/50"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          <div
                            className={cn(
                              "w-4 h-4 rounded-full border-2 transition-all",
                              isSelected
                                ? "bg-primary border-primary"
                                : "border-muted-foreground/30"
                            )}
                          >
                            {isSelected && (
                              <div className="w-full h-full flex items-center justify-center">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <Label
                            className={cn(
                              "text-sm font-medium",
                              isSelected ? "text-foreground" : "text-muted-foreground"
                            )}
                          >
                            {provider.name}
                          </Label>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {provider.description}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {settings.aiProvider === "custom" && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label htmlFor="aiApiUrl">API URL</Label>
                  <Input
                    id="aiApiUrl"
                    value={settings.aiApiUrl || ""}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, aiApiUrl: e.target.value }))
                    }
                    placeholder="https://api.example.com/v1/images/generations"
                    className="flex-1 font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter the full URL for your OpenAI-compatible image generation API endpoint
                  </p>
                </div>
              </>
            )}

            {settings.aiProvider !== "local" && (
              <div className="space-y-2">
                <Label htmlFor="aiApiKey">API Key</Label>
                <Input
                  id="aiApiKey"
                  type="password"
                  value={settings.aiApiKey}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, aiApiKey: e.target.value }))
                  }
                  placeholder="Enter your API key"
                  className="flex-1"
                />
                <p className="text-xs text-muted-foreground">
                  Your API key for the selected AI provider (stored locally and securely)
                </p>
              </div>
            )}

            {settings.aiProvider === "local" && (
              <div className="space-y-4">
                <Label className="text-base">Local AI Setup Guide</Label>
                
                {/* Recommended: Stability Matrix */}
                <div className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg border border-primary/20">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span className="font-medium text-sm">Recommended: Stability Matrix</span>
                    <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">Easiest</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    One-click installer that handles everything for you - models, UI, and dependencies.
                  </p>
                  <ol className="text-sm text-muted-foreground space-y-2 mb-3">
                    <li className="flex items-start gap-2">
                      <span className="bg-primary/20 text-primary text-xs px-1.5 py-0.5 rounded font-medium mt-0.5">1</span>
                      <span>Download <a href="https://lykos.ai/" className="text-primary hover:underline font-medium" target="_blank" rel="noopener noreferrer">Stability Matrix</a> and install it</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="bg-primary/20 text-primary text-xs px-1.5 py-0.5 rounded font-medium mt-0.5">2</span>
                      <span>Install <strong>Automatic1111 WebUI</strong> or <strong>ComfyUI</strong> from the Packages tab</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="bg-primary/20 text-primary text-xs px-1.5 py-0.5 rounded font-medium mt-0.5">3</span>
                      <span>Download a model from the Model Browser (search for "DreamShaper" or "Juggernaut")</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="bg-primary/20 text-primary text-xs px-1.5 py-0.5 rounded font-medium mt-0.5">4</span>
                      <span>Launch the UI and ensure the API is running at <code className="bg-background/50 px-1.5 py-0.5 rounded text-xs">http://127.0.0.1:7860</code></span>
                    </li>
                  </ol>
                  <p className="text-xs text-muted-foreground/80">
                    Stability Matrix auto-detects your GPU and sets up everything correctly.
                  </p>
                </div>

                <div className="flex items-center gap-2 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <p className="text-xs text-green-400">
                    <strong>100% Free</strong> — No API keys, no subscriptions, runs entirely on your computer!
                  </p>
                </div>
              </div>
            )}
          </div>
        </motion.section>

        {/* Data Management Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Database className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Data Management</h2>
          </div>
          <div className="space-y-3 p-4 rounded-xl bg-card/50 border border-border/30">
            {/* Rescan Projects */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/20">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-md bg-primary/10">
                  <FolderSync className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <Label className="text-sm">Rescan Project Folders</Label>
                  <p className="text-xs text-muted-foreground">
                    Re-scan your DAW folders to find new or changed projects
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (!isElectron()) return
                  await onRescan?.()
                }}
              >
                <FolderSync className="w-4 h-4 mr-2" />
                Rescan
              </Button>
            </div>

            {/* Re-extract Metadata */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/20">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-md bg-primary/10">
                  <FileMusic className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <Label className="text-sm">Refresh Project Metadata</Label>
                  <p className="text-xs text-muted-foreground">
                    Re-extract BPM, time spent, and other data from all project files
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (!isElectron()) return
                  await onRefreshMetadata?.()
                }}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>

            {/* Update File Dates */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/20">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-md bg-primary/10">
                  <RefreshCw className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <Label className="text-sm">Sync File Dates</Label>
                  <p className="text-xs text-muted-foreground">
                    Update project dates from actual file modification times
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSyncFileDates}
                disabled={isUpdatingFileModDates}
              >
                <RefreshCw className={cn("w-4 h-4 mr-2", isUpdatingFileModDates && "animate-spin")} />
                {isUpdatingFileModDates ? "Updating..." : "Sync Dates"}
              </Button>
            </div>

            <Separator className="my-1" />

            {/* Remove Artwork */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/20">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-md bg-destructive/10">
                  <ImageOff className="w-4 h-4 text-destructive" />
                </div>
                <div>
                  <Label className="text-sm">Remove All Artwork</Label>
                  <p className="text-xs text-muted-foreground">
                    Delete all generated artwork images from projects
                  </p>
                </div>
              </div>
              {!showRemoveArtworkConfirm ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRemoveArtworkConfirm(true)}
                  className="text-destructive border-destructive/30 hover:bg-destructive/10"
                >
                  <ImageOff className="w-4 h-4 mr-2" />
                  Remove
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowRemoveArtworkConfirm(false)}
                    disabled={isRemovingArtwork}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={isRemovingArtwork}
                    onClick={async () => {
                      setIsRemovingArtwork(true)
                      try {
                        await onRemoveAllArtwork?.()
                      } finally {
                        setIsRemovingArtwork(false)
                        setShowRemoveArtworkConfirm(false)
                      }
                    }}
                  >
                    {isRemovingArtwork ? "Removing..." : "Confirm"}
                  </Button>
                </div>
              )}
            </div>

            {/* Clear Database */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/20">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-md bg-destructive/10">
                  <Trash2 className="w-4 h-4 text-destructive" />
                </div>
                <div>
                  <Label className="text-sm">Clear All Projects</Label>
                  <p className="text-xs text-muted-foreground">
                    Remove all projects from the database permanently
                  </p>
                </div>
              </div>
              {!showClearConfirm ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowClearConfirm(true)}
                  className="text-destructive border-destructive/30 hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowClearConfirm(false)}
                    disabled={isClearing}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleClearDatabase}
                    disabled={isClearing}
                  >
                    {isClearing ? "Clearing..." : "Confirm"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </motion.section>

        {/* About Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Monitor className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">About</h2>
          </div>
          <div className="p-4 rounded-xl bg-card/50 border border-border/30">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary via-primary/80 to-primary/60 flex items-center justify-center shadow-lg">
                <Logo size="lg" className="text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-semibold">DBundone</h3>
                <p className="text-sm text-muted-foreground">
                  Offline Music Project Management
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Version 1.0.0 • Made by <span className="text-primary font-medium">pvls</span>
                </p>
              </div>
            </div>
          </div>
        </motion.section>
      </div>
    </div>
  )
}

export default Settings
