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
  Plug,
  Radio,
  Mic,
  Cloud,
  LogOut,
  User,
  AlertCircle,
  Loader2,
  Info,
  Bell,
  Grid2X2,
  List,
  GalleryHorizontalEnd,
  Globe,
  Puzzle,
  BellRing,
  MessageSquare,
  GitBranch,
  Plus,
  X,
  FolderSearch,
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
import { selectFolder } from "@/lib/tauriApi"
import { DEFAULT_SETTINGS } from "@/lib/constants"
import { Logo } from "@/components/Logo"
import { useAuth } from "@/contexts/AuthContext"
import { useI18n } from "@/i18n"
import type { AppSettings } from "@shared/types"
import { SUPPORTED_DAWS, DAW_EXTENSIONS } from "@shared/types"

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

const languages = [
  { value: "en", label: "English" },
  { value: "de", label: "Deutsch" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
  { value: "ja", label: "日本語" },
  { value: "pt", label: "Português" },
  { value: "ro", label: "Română" },
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
  const [isDeletingRecordings, setIsDeletingRecordings] = useState(false)
  const [showDeleteRecordingsConfirm, setShowDeleteRecordingsConfirm] = useState(false)
  const [activeSection, setActiveSection] = useState('general')
  const { t } = useI18n()

  const navItems = [
    { id: 'general', label: t('settings.nav.general'), icon: SettingsIcon },
    { id: 'appearance', label: t('settings.nav.appearance'), icon: Monitor },
    { id: 'daw', label: t('settings.nav.daw'), icon: Music },
    { id: 'ai-artwork', label: t('settings.nav.aiArtwork'), icon: Sparkles },
    { id: 'notifications', label: t('settings.nav.notifications'), icon: Bell },
    { id: 'integrations', label: t('settings.nav.integrations'), icon: Puzzle },
    { id: 'data', label: t('settings.nav.data'), icon: Database },
    { id: 'about', label: t('settings.nav.about'), icon: Info },
  ]

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

  const handleAddDAWFolder = async (daw: string) => {
    try {
      const folderPath = await selectFolder()
      if (folderPath) {
        setSettings((prev) => {
          const existing = prev.dawFolders[daw] || []
          if (existing.includes(folderPath)) return prev
          return {
            ...prev,
            dawFolders: { ...prev.dawFolders, [daw]: [...existing, folderPath] }
          }
        })
      }
    } catch (error) {
      console.error("Failed to select folder:", error)
    }
  }

  const handleRemoveDAWFolder = (daw: string, folder: string) => {
    setSettings((prev) => {
      const existing = prev.dawFolders[daw] || []
      return {
        ...prev,
        dawFolders: { ...prev.dawFolders, [daw]: existing.filter(f => f !== folder) }
      }
    })
  }

  const handleAddSampleFolder = async () => {
    try {
      const folderPath = await selectFolder()
      if (folderPath && !settings.sampleFolders.includes(folderPath)) {
        setSettings((prev) => ({
          ...prev,
          sampleFolders: [...prev.sampleFolders, folderPath]
        }))
      }
    } catch (error) {
      console.error("Failed to select sample folder:", error)
    }
  }

  const handleRemoveSampleFolder = (folder: string) => {
    setSettings((prev) => ({
      ...prev,
      sampleFolders: prev.sampleFolders.filter(f => f !== folder)
    }))
  }

  const handleClearDatabase = async () => {
    if (!isElectron()) return
    setIsClearing(true)
    try {
      const deletedCount = await window.electron?.clearAllProjects()
      setShowClearConfirm(false)
      console.log(`Cleared ${deletedCount} projects from database`)
      if (onDatabaseCleared) onDatabaseCleared()
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-xl bg-primary/10">
              <SettingsIcon className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">{t('settings.title')}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleReset} className="gap-2">
              <RotateCcw className="w-4 h-4" />
              {t('settings.reset')}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!hasChanges || isSaving} className="gap-2">
              {saveSuccess ? (
                <><Check className="w-4 h-4" /> {t('settings.saved')}</>
              ) : (
                <><Save className="w-4 h-4" /> {t('settings.save')}</>
              )}
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <nav className="w-48 border-r border-border/30 py-2 flex flex-col gap-0.5 shrink-0">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 text-sm transition-all text-left",
                  activeSection === item.id
                    ? "bg-primary/10 text-primary border-r-2 border-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {item.label}
              </button>
            )
          })}
        </nav>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* ── GENERAL ─────────────────────────────────────────── */}
          {activeSection === 'general' && (
            <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <SettingsIcon className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold">{t('settings.general.title')}</h2>
              </div>

              <div className="space-y-4 p-4 rounded-xl bg-card/50 border border-border/30">
                {/* Language */}
                <div className="space-y-2">
                  <Label>{t('settings.general.language')}</Label>
                  <Select
                    value={settings.language}
                    onValueChange={(value: AppSettings['language']) =>
                      setSettings((prev) => ({ ...prev, language: value }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-muted-foreground" />
                        <SelectValue placeholder={t('settings.general.language')} />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {languages.map((lang) => (
                        <SelectItem key={lang.value} value={lang.value}>
                          {lang.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {t('settings.general.languageHint')}
                  </p>
                </div>

                <Separator />

                {/* Auto-Scan */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t('settings.general.autoScan')}</Label>
                    <p className="text-xs text-muted-foreground">
                      {t('settings.general.autoScanHint')}
                    </p>
                  </div>
                  <Switch
                    checked={settings.autoScanOnStartup}
                    onCheckedChange={(checked) =>
                      setSettings((prev) => ({ ...prev, autoScanOnStartup: checked }))
                    }
                  />
                </div>

                <Separator />

                {/* Exclude Autosaves */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t('settings.general.excludeAutosaves')}</Label>
                    <p className="text-xs text-muted-foreground">
                      {t('settings.general.excludeAutosavesHint')}
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

                {/* Unsplash */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t('settings.general.unsplash')}</Label>
                    <p className="text-xs text-muted-foreground">
                      {t('settings.general.unsplashHint')}
                    </p>
                  </div>
                  <Switch
                    checked={settings.unsplashEnabled}
                    onCheckedChange={(checked) =>
                      setSettings((prev) => ({ ...prev, unsplashEnabled: checked }))
                    }
                  />
                </div>

                <Separator />

                {/* Confirm Destructive */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t('settings.general.confirm')}</Label>
                    <p className="text-xs text-muted-foreground">
                      {t('settings.general.confirmHint')}
                    </p>
                  </div>
                  <Switch
                    checked={settings.confirmDestructiveActions}
                    onCheckedChange={(checked) =>
                      setSettings((prev) => ({ ...prev, confirmDestructiveActions: checked }))
                    }
                  />
                </div>
              </div>
            </motion.section>
          )}

          {/* ── APPEARANCE ──────────────────────────────────────── */}
          {activeSection === 'appearance' && (
            <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <Monitor className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold">{t('settings.appearance.title')}</h2>
              </div>

              {/* Theme & Colors */}
              <div className="space-y-4 p-4 rounded-xl bg-card/50 border border-border/30">
                <div className="space-y-2">
                  <Label htmlFor="theme">{t('settings.appearance.theme')}</Label>
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
                      <SelectItem value="dark">{t('settings.appearance.themeDark')}</SelectItem>
                      <SelectItem value="light">{t('settings.appearance.themeLight')}</SelectItem>
                      <SelectItem value="system">{t('settings.appearance.themeSystem')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {t('settings.appearance.themeHint')}
                  </p>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>{t('settings.appearance.accent')}</Label>
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
                    {t('settings.appearance.accentHint')}
                  </p>
                </div>
              </div>

              {/* Layout Preferences */}
              <div className="space-y-4 p-4 rounded-xl bg-card/50 border border-border/30">
                <h3 className="text-sm font-medium text-muted-foreground">{t('settings.appearance.layout')}</h3>

                <div className="space-y-2">
                  <Label>{t('settings.appearance.viewMode')}</Label>
                  <div className="flex gap-2">
                    <Button
                      variant={settings.viewMode === 'grid' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSettings((prev) => ({ ...prev, viewMode: 'grid' }))}
                      className="gap-2"
                    >
                      <Grid2X2 className="w-4 h-4" /> {t('dashboard.grid')}
                    </Button>
                    <Button
                      variant={settings.viewMode === 'gallery' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSettings((prev) => ({ ...prev, viewMode: 'gallery' }))}
                      className="gap-2"
                    >
                      <GalleryHorizontalEnd className="w-4 h-4" /> {t('dashboard.gallery')}
                    </Button>
                    <Button
                      variant={settings.viewMode === 'list' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSettings((prev) => ({ ...prev, viewMode: 'list' }))}
                      className="gap-2"
                    >
                      <List className="w-4 h-4" /> {t('dashboard.list')}
                    </Button>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>{t('settings.appearance.gridSize')}</Label>
                  <div className="flex gap-2">
                    {(['small', 'medium', 'large'] as const).map((size) => (
                      <Button
                        key={size}
                        variant={settings.gridSize === size ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSettings((prev) => ({ ...prev, gridSize: size }))}
                      >
                        {size === 'small' ? t('settings.appearance.gridSmall') : size === 'medium' ? t('settings.appearance.gridMedium') : t('settings.appearance.gridLarge')}
                      </Button>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>{t('settings.appearance.sortOrder')}</Label>
                  <Select
                    value={settings.defaultSort}
                    onValueChange={(value: AppSettings['defaultSort']) =>
                      setSettings((prev) => ({ ...prev, defaultSort: value }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select sort order" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date-newest">{t('dashboard.sort.dateNewest')}</SelectItem>
                      <SelectItem value="date-oldest">{t('dashboard.sort.dateOldest')}</SelectItem>
                      <SelectItem value="name-asc">{t('dashboard.sort.nameAsc')}</SelectItem>
                      <SelectItem value="name-desc">{t('dashboard.sort.nameDesc')}</SelectItem>
                      <SelectItem value="bpm-asc">{t('dashboard.sort.bpmAsc')}</SelectItem>
                      <SelectItem value="bpm-desc">{t('dashboard.sort.bpmDesc')}</SelectItem>
                      <SelectItem value="time-spent-asc">{t('dashboard.sort.timeSpentAsc')}</SelectItem>
                      <SelectItem value="time-spent-desc">{t('dashboard.sort.timeSpentDesc')}</SelectItem>
                      <SelectItem value="key">{t('dashboard.sort.key')}</SelectItem>
                      <SelectItem value="tags-asc">{t('dashboard.sort.tagsAsc')}</SelectItem>
                      <SelectItem value="tags-desc">{t('dashboard.sort.tagsDesc')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {t('settings.appearance.sortOrderHint')}
                  </p>
                </div>
              </div>
            </motion.section>
          )}

          {/* ── DAW CONFIG ──────────────────────────────────────── */}
          {activeSection === 'daw' && (
            <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center gap-2 mb-4">
                <Music className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold">{t('settings.daw.title')}</h2>
              </div>
              <div className="space-y-4 p-4 rounded-xl bg-card/50 border border-border/30">
                <div className="space-y-3">
                  <div>
                    <Label>{t('settings.daw.selectDAWs')}</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('settings.daw.selectDAWsHint')}
                    </p>
                  </div>

                  <div className="space-y-3">
                    {SUPPORTED_DAWS.map((daw) => {
                      const isSelected = settings.selectedDAWs.includes(daw);
                      const extLabel = (DAW_EXTENSIONS[daw] || []).join(", ");
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
                                {isSelected && <Check className="w-3.5 h-3.5 text-primary-foreground" />}
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
                                {t(`settings.daw.desc.${daw}`) !== `settings.daw.desc.${daw}`
                                  ? t(`settings.daw.desc.${daw}`)
                                  : `${daw} projects (${extLabel})`}
                              </p>
                            </div>
                          </div>

                          {isSelected && (
                            <div className="mt-4 pt-4 border-t border-border/30">
                              <Label className="text-xs">{t('settings.daw.projectsFolders')}</Label>
                              <p className="text-xs text-muted-foreground/70 mt-0.5 mb-2">
                                {t('settings.daw.projectsFoldersHint')}
                              </p>
                              <div className="space-y-2">
                                {(settings.dawFolders[daw] || []).map((folder) => (
                                  <div key={folder} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border/30">
                                    <FolderOpen className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                    <span className="text-sm text-foreground truncate flex-1" title={folder}>{folder}</span>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                      onClick={() => handleRemoveDAWFolder(daw, folder)}
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                ))}

                                {(settings.dawFolders[daw] || []).length === 0 && (
                                  <div className="text-center py-3 text-xs text-muted-foreground/70">
                                    {t('settings.daw.noFolders')}
                                  </div>
                                )}

                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full gap-2"
                                  onClick={() => handleAddDAWFolder(daw)}
                                >
                                  <Plus className="w-4 h-4" /> {t('settings.daw.addFolder')}
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

              {/* Sample Folders */}
              <div className="space-y-4 p-4 rounded-xl bg-card/50 border border-border/30 mt-6">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <FolderSearch className="w-4 h-4 text-green-500" />
                    <Label className="text-sm font-medium">Sample Folders</Label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Add your sample library root folders so statistics can accurately detect sample pack names.
                  </p>
                </div>

                <div className="space-y-2">
                  {settings.sampleFolders.map((folder) => (
                    <div key={folder} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border/30">
                      <FolderOpen className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm text-foreground truncate flex-1" title={folder}>{folder}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemoveSampleFolder(folder)}
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}

                  {settings.sampleFolders.length === 0 && (
                    <div className="text-center py-4 text-xs text-muted-foreground/70">
                      No sample folders added yet
                    </div>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                    onClick={handleAddSampleFolder}
                  >
                    <Plus className="w-4 h-4" /> Add Sample Folder
                  </Button>
                </div>
              </div>
            </motion.section>
          )}

          {/* ── AI ARTWORK ──────────────────────────────────────── */}
          {activeSection === 'ai-artwork' && (
            <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold">{t('settings.ai.title')}</h2>
              </div>
              <div className="space-y-4 p-4 rounded-xl bg-card/50 border border-border/30">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t('settings.ai.autoGenerate')}</Label>
                    <p className="text-xs text-muted-foreground">
                      {t('settings.ai.autoGenerateHint')}
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
                  <Label>{t('settings.ai.provider')}</Label>
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
                              <div className={cn(
                                "w-4 h-4 rounded-full border-2 transition-all",
                                isSelected ? "bg-primary border-primary" : "border-muted-foreground/30"
                              )}>
                                {isSelected && (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <Label className={cn("text-sm font-medium", isSelected ? "text-foreground" : "text-muted-foreground")}>
                                {provider.name}
                              </Label>
                              <p className="text-xs text-muted-foreground mt-0.5">{provider.description}</p>
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
                      <Label htmlFor="aiApiUrl">{t('settings.ai.apiUrl')}</Label>
                      <Input
                        id="aiApiUrl"
                        value={settings.aiApiUrl || ""}
                        onChange={(e) => setSettings((prev) => ({ ...prev, aiApiUrl: e.target.value }))}
                        placeholder="https://api.example.com/v1/images/generations"
                        className="flex-1 font-mono text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        Full URL for your OpenAI-compatible image generation API
                      </p>
                    </div>
                  </>
                )}

                {settings.aiProvider !== "local" && (
                  <div className="space-y-2">
                    <Label htmlFor="aiApiKey">{t('settings.ai.apiKey')}</Label>
                    <Input
                      id="aiApiKey"
                      type="password"
                      value={settings.aiApiKey}
                      onChange={(e) => setSettings((prev) => ({ ...prev, aiApiKey: e.target.value }))}
                      placeholder="Enter your API key"
                      className="flex-1"
                    />
                    <p className="text-xs text-muted-foreground">{t('settings.ai.apiKeyHint')}</p>
                  </div>
                )}

                {settings.aiProvider === "local" && (
                  <div className="space-y-4">
                    <Label className="text-base">{t('settings.ai.localGuide')}</Label>
                    <div className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg border border-primary/20">
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="w-4 h-4 text-primary" />
                        <span className="font-medium text-sm">Recommended: Stability Matrix</span>
                        <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">Easiest</span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        One-click installer that handles everything for you.
                      </p>
                      <ol className="text-sm text-muted-foreground space-y-2 mb-3">
                        <li className="flex items-start gap-2">
                          <span className="bg-primary/20 text-primary text-xs px-1.5 py-0.5 rounded font-medium mt-0.5">1</span>
                          <span>Download <a href="https://lykos.ai/" className="text-primary hover:underline font-medium" target="_blank" rel="noopener noreferrer">Stability Matrix</a> and install it</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="bg-primary/20 text-primary text-xs px-1.5 py-0.5 rounded font-medium mt-0.5">2</span>
                          <span>Install <strong>Automatic1111 WebUI</strong> or <strong>ComfyUI</strong></span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="bg-primary/20 text-primary text-xs px-1.5 py-0.5 rounded font-medium mt-0.5">3</span>
                          <span>Download a model (search for "DreamShaper" or "Juggernaut")</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="bg-primary/20 text-primary text-xs px-1.5 py-0.5 rounded font-medium mt-0.5">4</span>
                          <span>Launch and ensure API runs at <code className="bg-background/50 px-1.5 py-0.5 rounded text-xs">http://127.0.0.1:7860</code></span>
                        </li>
                      </ol>
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <p className="text-xs text-green-400">
                        <strong>100% Free</strong> — No API keys, runs entirely on your computer!
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </motion.section>
          )}

          {/* ── NOTIFICATIONS ───────────────────────────────────── */}
          {activeSection === 'notifications' && (
            <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <Bell className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold">{t('settings.notifications.title')}</h2>
              </div>

              {/* Master Toggle */}
              <div className="space-y-4 p-4 rounded-xl bg-card/50 border border-border/30">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">{t('settings.notifications.enable')}</Label>
                    <p className="text-xs text-muted-foreground">
                      {t('settings.notifications.enableHint')}
                    </p>
                  </div>
                  <Switch
                    checked={settings.notificationsEnabled}
                    onCheckedChange={(checked) =>
                      setSettings((prev) => ({ ...prev, notificationsEnabled: checked }))
                    }
                  />
                </div>
              </div>

              {/* Per-type Toggles */}
              <div className={cn(
                "space-y-4 p-4 rounded-xl bg-card/50 border border-border/30 transition-opacity",
                !settings.notificationsEnabled && "opacity-50 pointer-events-none"
              )}>
                <h3 className="text-sm font-medium text-muted-foreground">{t('settings.notifications.collaboration')}</h3>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-md bg-blue-500/10">
                      <BellRing className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="space-y-0.5">
                      <Label>{t('settings.notifications.shares')}</Label>
                      <p className="text-xs text-muted-foreground">
                        {t('settings.notifications.sharesHint')}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.notifyOnShare}
                    onCheckedChange={(checked) =>
                      setSettings((prev) => ({ ...prev, notifyOnShare: checked }))
                    }
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-md bg-purple-500/10">
                      <MessageSquare className="w-4 h-4 text-purple-400" />
                    </div>
                    <div className="space-y-0.5">
                      <Label>{t('settings.notifications.annotations')}</Label>
                      <p className="text-xs text-muted-foreground">
                        {t('settings.notifications.annotationsHint')}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.notifyOnAnnotation}
                    onCheckedChange={(checked) =>
                      setSettings((prev) => ({ ...prev, notifyOnAnnotation: checked }))
                    }
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-md bg-green-500/10">
                      <GitBranch className="w-4 h-4 text-green-400" />
                    </div>
                    <div className="space-y-0.5">
                      <Label>{t('settings.notifications.statusChanges')}</Label>
                      <p className="text-xs text-muted-foreground">
                        {t('settings.notifications.statusChangesHint')}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.notifyOnStatusChange}
                    onCheckedChange={(checked) =>
                      setSettings((prev) => ({ ...prev, notifyOnStatusChange: checked }))
                    }
                  />
                </div>
              </div>
            </motion.section>
          )}

          {/* ── INTEGRATIONS ────────────────────────────────────── */}
          {activeSection === 'integrations' && (
            <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <Puzzle className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold">{t('settings.integrations.title')}</h2>
              </div>

              {/* Plugin Bridge */}
              <div className="space-y-4 p-4 rounded-xl bg-card/50 border border-border/30">
                <div className="flex items-center gap-2 mb-1">
                  <Plug className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-medium">{t('settings.integrations.pluginBridge')}</h3>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-md bg-green-500/10">
                      <Radio className="w-4 h-4 text-green-500" />
                    </div>
                    <div>
                      <Label className="text-sm">{t('settings.integrations.pluginServer')}</Label>
                      <p className="text-xs text-muted-foreground">
                        {t('settings.integrations.pluginServerHint')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-xs text-green-500 font-medium">{t('settings.integrations.running')}</span>
                  </div>
                </div>

                <div>
                  <Label className="text-sm text-muted-foreground">{t('settings.integrations.connectionInfo')}</Label>
                  <div className="mt-2 p-3 rounded-lg bg-muted/30 border border-border/20 font-mono text-xs space-y-1">
                    <p><span className="text-muted-foreground">Address:</span> <span className="text-foreground">ws://127.0.0.1:9847</span></p>
                    <p><span className="text-muted-foreground">Status:</span> <span className="text-green-500">Active</span></p>
                  </div>
                </div>

                <div>
                  <Label className="text-sm text-muted-foreground">{t('settings.integrations.setupInstructions')}</Label>
                  <div className="mt-2 space-y-2 text-xs text-muted-foreground">
                    <p>1. Download <code className="px-1 py-0.5 rounded bg-muted text-foreground">dbundone-bridge.vst3</code> from the <a href="https://github.com/pvls/dbundone/releases" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">latest release</a></p>
                    <p>2. Copy it to your VST3 folder: <code className="px-1 py-0.5 rounded bg-muted text-foreground">C:\Program Files\Common Files\VST3\</code></p>
                    <p>3. Load "DBundone Bridge" as an effect on any mixer track in your DAW</p>
                    <p>4. The plugin auto-connects to DBundone when both are running</p>
                    <p>5. Link the plugin to a project from the Project Detail page</p>
                  </div>
                </div>
              </div>

              {/* Cloud & Collaboration */}
              <CloudCollaborationSection />
            </motion.section>
          )}

          {/* ── DATA MANAGEMENT ─────────────────────────────────── */}
          {activeSection === 'data' && (
            <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center gap-2 mb-4">
                <Database className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold">{t('settings.data.title')}</h2>
              </div>

              {/* Maintenance */}
              <div className="space-y-3 p-4 rounded-xl bg-card/50 border border-border/30 mb-6">
                <h3 className="text-sm font-medium text-muted-foreground mb-2">{t('settings.data.maintenance')}</h3>

                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/20">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-md bg-primary/10"><FolderSync className="w-4 h-4 text-primary" /></div>
                    <div>
                      <Label className="text-sm">{t('settings.data.rescan')}</Label>
                      <p className="text-xs text-muted-foreground">{t('settings.data.rescanHint')}</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={async () => { if (!isElectron()) return; await onRescan?.() }}>
                    <FolderSync className="w-4 h-4 mr-2" /> {t('settings.data.rescanBtn')}
                  </Button>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/20">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-md bg-primary/10"><FileMusic className="w-4 h-4 text-primary" /></div>
                    <div>
                      <Label className="text-sm">{t('settings.data.refreshMetadata')}</Label>
                      <p className="text-xs text-muted-foreground">{t('settings.data.refreshMetadataHint')}</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={async () => { if (!isElectron()) return; await onRefreshMetadata?.() }}>
                    <RefreshCw className="w-4 h-4 mr-2" /> {t('settings.data.refreshBtn')}
                  </Button>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/20">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-md bg-primary/10"><RefreshCw className="w-4 h-4 text-primary" /></div>
                    <div>
                      <Label className="text-sm">{t('settings.data.syncDates')}</Label>
                      <p className="text-xs text-muted-foreground">{t('settings.data.syncDatesHint')}</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleSyncFileDates} disabled={isUpdatingFileModDates}>
                    <RefreshCw className={cn("w-4 h-4 mr-2", isUpdatingFileModDates && "animate-spin")} />
                    {isUpdatingFileModDates ? t('settings.data.updating') : t('settings.data.syncDatesBtn')}
                  </Button>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="space-y-3 p-4 rounded-xl bg-destructive/5 border border-destructive/20">
                <h3 className="text-sm font-medium text-destructive mb-2">{t('settings.data.dangerZone')}</h3>

                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/20">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-md bg-destructive/10"><ImageOff className="w-4 h-4 text-destructive" /></div>
                    <div>
                      <Label className="text-sm">{t('settings.data.removeArtwork')}</Label>
                      <p className="text-xs text-muted-foreground">{t('settings.data.removeArtworkHint')}</p>
                    </div>
                  </div>
                  {!showRemoveArtworkConfirm ? (
                    <Button variant="outline" size="sm" onClick={() => setShowRemoveArtworkConfirm(true)}
                      className="text-destructive border-destructive/30 hover:bg-destructive/10">
                      <ImageOff className="w-4 h-4 mr-2" /> {t('settings.data.removeBtn')}
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setShowRemoveArtworkConfirm(false)} disabled={isRemovingArtwork}>{t('settings.data.cancel')}</Button>
                      <Button variant="destructive" size="sm" disabled={isRemovingArtwork}
                        onClick={async () => { setIsRemovingArtwork(true); try { await onRemoveAllArtwork?.() } finally { setIsRemovingArtwork(false); setShowRemoveArtworkConfirm(false) } }}>
                        {isRemovingArtwork ? t('settings.data.removing') : t('settings.data.confirm')}
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/20">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-md bg-destructive/10"><Mic className="w-4 h-4 text-destructive" /></div>
                    <div>
                      <Label className="text-sm">{t('settings.data.deleteRecordings')}</Label>
                      <p className="text-xs text-muted-foreground">{t('settings.data.deleteRecordingsHint')}</p>
                    </div>
                  </div>
                  {!showDeleteRecordingsConfirm ? (
                    <Button variant="outline" size="sm" onClick={() => setShowDeleteRecordingsConfirm(true)}
                      className="text-destructive border-destructive/30 hover:bg-destructive/10">
                      <Mic className="w-4 h-4 mr-2" /> {t('settings.data.deleteBtn')}
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setShowDeleteRecordingsConfirm(false)} disabled={isDeletingRecordings}>{t('settings.data.cancel')}</Button>
                      <Button variant="destructive" size="sm" disabled={isDeletingRecordings}
                        onClick={async () => {
                          if (!isElectron()) return
                          setIsDeletingRecordings(true)
                          try {
                            const result = await window.electron?.deleteAllRecordings()
                            console.log("Deleted all recordings:", result)
                            if (onDatabaseCleared) onDatabaseCleared()
                          } catch (error) { console.error("Failed to delete recordings:", error) }
                          finally { setIsDeletingRecordings(false); setShowDeleteRecordingsConfirm(false) }
                        }}>
                        {isDeletingRecordings ? t('settings.data.deleting') : t('settings.data.confirm')}
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/20">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-md bg-destructive/10"><Trash2 className="w-4 h-4 text-destructive" /></div>
                    <div>
                      <Label className="text-sm">{t('settings.data.clearProjects')}</Label>
                      <p className="text-xs text-muted-foreground">{t('settings.data.clearProjectsHint')}</p>
                    </div>
                  </div>
                  {!showClearConfirm ? (
                    <Button variant="outline" size="sm" onClick={() => setShowClearConfirm(true)}
                      className="text-destructive border-destructive/30 hover:bg-destructive/10">
                      <Trash2 className="w-4 h-4 mr-2" /> {t('settings.data.clearBtn')}
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setShowClearConfirm(false)} disabled={isClearing}>{t('settings.data.cancel')}</Button>
                      <Button variant="destructive" size="sm" onClick={handleClearDatabase} disabled={isClearing}>
                        {isClearing ? t('settings.data.clearing') : t('settings.data.confirm')}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </motion.section>
          )}

          {/* ── ABOUT ───────────────────────────────────────────── */}
          {activeSection === 'about' && (
            <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center gap-2 mb-4">
                <Info className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold">{t('settings.about.title')}</h2>
              </div>
              <div className="p-4 rounded-xl bg-card/50 border border-border/30">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary via-primary/80 to-primary/60 flex items-center justify-center shadow-lg">
                    <Logo size="lg" className="text-primary-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold">DBundone</h3>
                    <p className="text-sm text-muted-foreground">{t('settings.about.subtitle')}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('settings.about.version')} • {t('settings.about.madeBy')} <span className="text-primary font-medium">pvls</span>
                    </p>
                  </div>
                </div>
              </div>
            </motion.section>
          )}

        </div>
      </div>
    </div>
  )
}

// ── Cloud & Collaboration Sub-Section ──────────────────────────────────────

function CloudCollaborationSection() {
  const auth = useAuth()
  const { t } = useI18n()

  return (
    <div className="space-y-4 p-4 rounded-xl bg-card/50 border border-border/30">
      <div className="flex items-center gap-2 mb-1">
        <Cloud className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-medium">{t('settings.integrations.cloud')}</h3>
      </div>

      <div>
        <h4 className="text-xs font-medium text-muted-foreground mb-2">{t('settings.integrations.account')}</h4>
        {auth.isAuthenticated ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">{auth.profile?.displayName || auth.user?.email}</p>
                <p className="text-xs text-muted-foreground">{auth.user?.email}</p>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={auth.signOut} className="gap-1.5">
              <LogOut className="w-3.5 h-3.5" /> {t('settings.integrations.signOut')}
            </Button>
          </div>
        ) : auth.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> <span>{t('settings.integrations.loading')}</span>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">
            <p>{t('settings.integrations.notSignedIn')}</p>
          </div>
        )}
        {auth.error && (
          <div className="mt-2 p-2.5 rounded-lg bg-destructive/10 text-destructive text-xs flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> <span>{auth.error}</span>
          </div>
        )}
      </div>

      <Separator />

      <div className="text-xs text-muted-foreground space-y-1">
        <p>{t('settings.integrations.shareInfo')}</p>
        <p>{t('settings.integrations.supabaseInfo')}</p>
      </div>
    </div>
  )
}

export default Settings
