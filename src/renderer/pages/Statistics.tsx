import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3,
  Clock,
  Music,
  RefreshCw,
  Plug,
  FileAudio,
  SlidersHorizontal,
  Cpu,
  AudioLines,
  Volume2,
  Headphones,
  Layers,
  Loader2,
  Search,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Project, AppSettings, FlpAnalysis } from '@shared/types';
import { scanSampleTree, getAllFlpAnalysesCached, analyzeFlpProject } from '@/lib/tauriApi';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n';
import './Statistics.css';

interface StatisticsProps {
  projects: Project[];
  settings: AppSettings;
}

// ── Horizontal bar list ──────────────────────────────
const BarList: React.FC<{
  data: { name: string; value: number; color?: string }[];
  max?: number;
  showPercent?: boolean;
}> = ({ data, max = 10, showPercent = true }) => {
  const { t } = useI18n();
  const items = data.slice(0, max);
  const maxValue = Math.max(...items.map(d => d.value), 1);
  const total = items.reduce((s, d) => s + d.value, 0);

  if (items.length === 0) return <p className="text-sm text-muted-foreground py-4 text-center">{t('common.noData')}</p>;

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const pct = total > 0 ? ((item.value / total) * 100).toFixed(0) : '0';
        return (
          <div key={item.name}>
            <div className="flex items-baseline justify-between text-sm mb-1.5">
              <span className="truncate font-medium mr-2">{item.name}</span>
              <span className="tabular-nums text-muted-foreground flex-shrink-0">
                {item.value}{showPercent && <span className="text-xs ml-1">({pct}%)</span>}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(item.value / maxValue) * 100}%`,
                  backgroundColor: item.color || 'hsl(var(--primary))',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ── Activity heatmap (GitHub-style) ──────────────────
const Heatmap: React.FC<{ projects: Project[] }> = ({ projects }) => {
  const { t } = useI18n();
  const WEEKS = 12;
  const DAYS = 7;

  const { grid, total, streak, mostActiveDay } = useMemo(() => {
    const data: number[][] = Array.from({ length: WEEKS }, () => Array(DAYS).fill(0));
    const now = new Date();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayCounts = Array(7).fill(0);
    let t = 0;

    for (const p of projects) {
      const diff = Math.floor((now.getTime() - new Date(p.createdAt).getTime()) / 86400000);
      if (diff >= 0 && diff < WEEKS * 7) {
        const w = WEEKS - 1 - Math.floor(diff / 7);
        const d = 6 - (diff % 7);
        if (w >= 0 && w < WEEKS && d >= 0 && d < DAYS) {
          data[w][d]++;
          dayCounts[d]++;
          t++;
        }
      }
    }

    let s = 0;
    for (let d = 0; d < WEEKS * 7; d++) {
      const w = WEEKS - 1 - Math.floor(d / 7);
      const di = 6 - (d % 7);
      if (w >= 0 && data[w][di] > 0) s++;
      else if (d > 0) break;
    }

    const maxDayIdx = dayCounts.indexOf(Math.max(...dayCounts));
    return {
      grid: data,
      total: t,
      streak: s,
      mostActiveDay: dayCounts[maxDayIdx] > 0 ? dayNames[maxDayIdx] : '—',
    };
  }, [projects]);

  const maxVal = Math.max(...grid.flat(), 1);
  const cellColor = (v: number) => {
    if (v === 0) return 'bg-secondary';
    const r = v / maxVal;
    if (r <= 0.25) return 'bg-emerald-500/30';
    if (r <= 0.5) return 'bg-emerald-500/50';
    if (r <= 0.75) return 'bg-emerald-500/70';
    return 'bg-emerald-500';
  };

  const dayLabels = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

  return (
    <TooltipProvider delayDuration={80}>
      <div className="space-y-2">
        <div className="flex gap-[3px]">
          <div className="flex flex-col gap-[3px] pr-1.5">
            {dayLabels.map((d, i) => (
              <div key={i} className="h-3 text-[10px] leading-3 text-muted-foreground flex items-center justify-end">{d}</div>
            ))}
          </div>
          {grid.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px] flex-1">
              {week.map((val, di) => (
                <Tooltip key={`${wi}-${di}`}>
                  <TooltipTrigger asChild>
                    <div className={cn("h-3 rounded-[2px]", cellColor(val))} />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs py-1 px-2">
                    {val} project{val !== 1 ? 's' : ''}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1">
          <div className="flex items-center gap-4">
            <span>{t('stats.heatmapWeeks', { count: String(total) })}</span>
            <span>{t('stats.heatmapStreak', { count: String(streak) })}</span>
            <span>{t('stats.heatmapMostActive', { day: mostActiveDay })}</span>
          </div>
          <div className="flex items-center gap-1">
            <span>{t('common.less')}</span>
            {['bg-secondary', 'bg-emerald-500/30', 'bg-emerald-500/50', 'bg-emerald-500/70', 'bg-emerald-500'].map((c, i) => (
              <div key={i} className={cn("w-2.5 h-2.5 rounded-[2px]", c)} />
            ))}
            <span>{t('common.more')}</span>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};

// ════════════════════════════════════════
//  MAIN COMPONENT
// ════════════════════════════════════════

export const Statistics: React.FC<StatisticsProps> = ({ projects, settings }) => {
  const { t } = useI18n();
  const [isDataReady, setIsDataReady] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [analysisMap, setAnalysisMap] = useState<Record<string, FlpAnalysis>>({});
  const [analysisProgress, setAnalysisProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [sampleTree, setSampleTree] = useState<Record<string, string[]>>({});

  // ── Load sample folder tree from filesystem ─────────────
  useEffect(() => {
    if (settings.sampleFolders.length > 0) {
      scanSampleTree(settings.sampleFolders)
        .then(tree => setSampleTree(tree))
        .catch(err => console.error('[Statistics] Failed to scan sample tree:', err));
    } else {
      setSampleTree({});
    }
  }, [settings.sampleFolders]);

  // ── Load FLP analyses — fast cache first, then background re-analyze new projects ──
  const loadAnalyses = useCallback(async (force = false) => {
    const flProjects = projects.filter(p => p.dawType === 'FL Studio' && p.dawProjectPath);
    if (flProjects.length === 0) {
      setIsDataReady(true);
      return;
    }

    if (!force) {
      // Fast path: load everything from DB cache in one call
      try {
        const cached = await (window.electron?.getAllFlpAnalysesCached?.() ?? getAllFlpAnalysesCached());
        if (cached && Object.keys(cached).length > 0) {
          setAnalysisMap(cached as Record<string, FlpAnalysis>);
          setIsDataReady(true);

          // Background: find projects missing from cache and analyze them
          const uncached = flProjects.filter(p => !cached[p.id]);
          if (uncached.length > 0) {
            setAnalysisProgress({ current: 0, total: uncached.length });
            const updated = { ...cached } as Record<string, FlpAnalysis>;
            for (let i = 0; i < uncached.length; i++) {
              const p = uncached[i];
              try {
                const result = await (window.electron?.analyzeFlpProject?.(p.id, p.dawProjectPath!) ?? analyzeFlpProject(p.id, p.dawProjectPath!));
                if (result) updated[p.id] = result as FlpAnalysis;
              } catch (err) {
                console.error(`[Statistics] Failed to analyze ${p.title}:`, err);
              }
              setAnalysisProgress({ current: i + 1, total: uncached.length });
            }
            setAnalysisMap(updated);
            setAnalysisProgress({ current: 0, total: 0 });
          }
          return;
        }
      } catch (err) {
        console.warn('[Statistics] Cache load failed, falling back to per-project analysis:', err);
      }
    }

    // Full (re-)analysis path — used on first run or when forced by refresh button
    setAnalysisProgress({ current: 0, total: flProjects.length });
    const map: Record<string, FlpAnalysis> = {};
    for (let i = 0; i < flProjects.length; i++) {
      const p = flProjects[i];
      try {
        const result = await (window.electron?.analyzeFlpProject?.(p.id, p.dawProjectPath!) ?? analyzeFlpProject(p.id, p.dawProjectPath!));
        if (result) map[p.id] = result as FlpAnalysis;
      } catch (err) {
        console.error(`[Statistics] Failed to analyze ${p.title}:`, err);
      }
      setAnalysisProgress({ current: i + 1, total: flProjects.length });
    }

    setAnalysisMap(map);
    setIsDataReady(true);
    setAnalysisProgress({ current: 0, total: 0 });
  }, [projects]);

  useEffect(() => { loadAnalyses(); }, [loadAnalyses]);

  const refreshData = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setIsDataReady(false);
    await loadAnalyses(true);
    setIsRefreshing(false);
  };

  // ── Aggregate FLP analysis data across all projects ───────
  const analysisStats = useMemo(() => {
    const analyses = Object.values(analysisMap);

    // ─ Plugin rankings ──────────────────────
    const pluginUsage: Record<string, { count: number; isInstrument: boolean; isSampler: boolean; projects: Set<string> }> = {};
    const pluginTypeCount = { instruments: 0, effects: 0, samplers: 0 };
    let totalPluginInstances = 0;

    for (const [pid, a] of Object.entries(analysisMap)) {
      for (const plugin of a.plugins) {
        const isSampler = plugin.dllName === 'Sampler';
        if (!pluginUsage[plugin.name]) {
          pluginUsage[plugin.name] = { count: 0, isInstrument: plugin.isInstrument, isSampler, projects: new Set() };
        }
        pluginUsage[plugin.name].count++;
        pluginUsage[plugin.name].projects.add(pid);
        totalPluginInstances++;
      }
    }

    const uniquePlugins = Object.keys(pluginUsage).length;
    for (const p of Object.values(pluginUsage)) {
      if (p.isSampler) pluginTypeCount.samplers++;
      else if (p.isInstrument) pluginTypeCount.instruments++;
      else pluginTypeCount.effects++;
    }

    const pluginRanking = Object.entries(pluginUsage)
      .map(([name, data]) => ({ name, ...data, projectCount: data.projects.size }))
      .sort((a, b) => b.count - a.count);

    const topPlugins = pluginRanking.slice(0, 15);
    const topInstruments = pluginRanking.filter(p => p.isInstrument && !p.isSampler).slice(0, 10);
    const topEffects = pluginRanking.filter(p => !p.isInstrument && !p.isSampler).slice(0, 10);
    const topSamplers = pluginRanking.filter(p => p.isSampler).slice(0, 10);

    const favoritePlugin = pluginRanking.length > 0 ? pluginRanking[0] : null;
    const favoriteInstrument = topInstruments.length > 0 ? topInstruments[0] : null;
    const favoriteEffect = topEffects.length > 0 ? topEffects[0] : null;

    // ─ Mixer stats ──────────────────────────
    let totalMixerTracks = 0;
    let totalMixerEffects = 0;
    let maxMixerEffectsOnTrack = 0;
    let maxMixerEffectsTrackName = '';
    const mixerEffectUsage: Record<string, number> = {};

    for (const a of analyses) {
      totalMixerTracks += a.mixerTracks.length;
      for (const mt of a.mixerTracks) {
        totalMixerEffects += mt.plugins.length;
        if (mt.plugins.length > maxMixerEffectsOnTrack) {
          maxMixerEffectsOnTrack = mt.plugins.length;
          maxMixerEffectsTrackName = mt.name || `Insert ${mt.index}`;
        }
        for (const plugin of mt.plugins) {
          mixerEffectUsage[plugin] = (mixerEffectUsage[plugin] || 0) + 1;
        }
      }
    }

    const topMixerEffects = Object.entries(mixerEffectUsage)
      .map(([name, count]) => ({ name, value: count }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    const avgMixerTracksPerProject = analyses.length > 0 ? totalMixerTracks / analyses.length : 0;
    const avgMixerEffectsPerProject = analyses.length > 0 ? totalMixerEffects / analyses.length : 0;

    // ─ Channel stats ────────────────────────
    let totalChannels = 0;
    const channelTypeCounts: Record<string, number> = {};

    for (const a of analyses) {
      totalChannels += a.channels.length;
      for (const ch of a.channels) {
        channelTypeCounts[ch.channelType] = (channelTypeCounts[ch.channelType] || 0) + 1;
      }
    }
    const avgChannelsPerProject = analyses.length > 0 ? totalChannels / analyses.length : 0;

    // ─ Sample stats ─────────────────────────
    let totalSamples = 0;
    const samplePackUsage: Record<string, number> = {};
    const sampleExtUsage: Record<string, number> = {};
    // Track individual sample file usage across all projects (by filename)
    const sampleFileUsage: Record<string, { count: number; projects: Set<string> }> = {};

    // ── Smart sample pack detection ──────────────────────────
    // Uses the REAL filesystem tree (from settings.sampleFolders scan)
    // to detect organizational folders by their actual child count.
    //
    // Algorithm: for each sample path, walk top-down through the folder
    // hierarchy. Skip a folder if ANY of these is true:
    //   1. It's a known sound category / genre name
    //   2. The REAL filesystem shows it has ≥5 non-category sub-folders
    //   3. Its child folder name starts with the parent name (brand grouping)
    // First folder that passes none of these checks = the pack.

    const SOUND_CATEGORIES = new Set([
      'kicks', 'kick', 'snares', 'snare', 'claps', 'clap',
      'hats', 'hi-hats', 'hi hats', 'hihat', 'hihats', 'open hats', 'closed hats',
      'cymbals', 'rides', 'crashes', 'percussion', 'perc', 'percs',
      'toms', 'rims', 'rimshots', '808', '808s', 'drums', 'drum', 'drum loops',
      'bass', 'basses', 'sub bass', 'leads', 'lead', 'keys', 'pads', 'pad',
      'synths', 'synth', 'strings', 'piano', 'pianos', 'guitars', 'guitar',
      'brass', 'flutes', 'flute', 'bells', 'plucks', 'pluck', 'chords', 'arps', 'arp',
      'melodies', 'melody', 'melodics', 'melodic',
      'fx', 'sfx', 'effects', 'risers', 'riser', 'impacts', 'impact',
      'transitions', 'sweeps', 'downlifters', 'textures', 'foley',
      'noise', 'ambient', 'atmosphere', 'atmos',
      'vocals', 'vocal', 'vox', 'chants', 'adlibs', 'tags',
      'loops', 'loop', 'one shots', 'one-shots', 'oneshots', 'one shot',
      'midi', 'stems', 'bounces', 'renders', 'breaks', 'fills',
      'samples', 'wavs', 'wav', 'misc', 'other', 'extras', 'bonus',
      'drum and bass', 'dnb', 'd&b', 'jump up',
      'hip hop', 'hip-hop', 'hiphop', 'rnb', 'r&b',
      'trap', 'drill', 'phonk', 'house', 'techno', 'dubstep',
      'pop', 'rock', 'jazz', 'soul', 'lo-fi', 'lofi',
      'general', 'presets', 'preset', 'default',
    ]);

    const SKIP_ROOTS = new Set([
      'audio', 'recorded', 'recordings', 'backup', 'rendered', 'sliced audio', 'collected',
    ]);

    const isSoundCategory = (name: string): boolean => {
      const lower = name.toLowerCase().trim();
      if (SOUND_CATEGORIES.has(lower)) return true;
      const words = lower.split(/[\s_\-]+/);
      // Require ALL words to be category terms — prevents false positives
      // like "Drum Industry" where only "drum" matches.
      // Full multi-word categories ("hi hats", "sub bass") are already
      // caught by the exact-match check above.
      if (words.length <= 2 && words.every(w =>
        SOUND_CATEGORIES.has(w) || SOUND_CATEGORIES.has(w + 's') || SOUND_CATEGORIES.has(w.replace(/s$/, ''))
      )) return true;
      return false;
    };

    // Build a lookup: normalized folder path → real child count (non-category)
    // The sampleTree keys are full paths like "C:/Users/.../Samples/! GO TO"
    // with values being arrays of child folder names.
    const fsChildCount: Record<string, number> = {};
    const FS_ORG_THRESHOLD = 5;
    const hasFsTree = Object.keys(sampleTree).length > 0;

    if (hasFsTree) {
      for (const [folderPath, children] of Object.entries(sampleTree)) {
        // Use JUST the folder name as key (last segment)
        const segments = folderPath.split('/');
        const folderName = segments[segments.length - 1];
        const nonCatChildren = children.filter(c => !isSoundCategory(c));
        // Track by full path AND by folder name (folder name may collide, use max)
        const fullKey = folderPath.toLowerCase();
        fsChildCount[fullKey] = nonCatChildren.length;
        // Also index by folder name for path-based lookups
        const nameKey = 'name:' + folderName.toLowerCase();
        fsChildCount[nameKey] = Math.max(fsChildCount[nameKey] || 0, nonCatChildren.length);
      }
    }

    // Helper: build the full path for a folder in the sample tree
    const isOrgFolder = (folderName: string, pathSoFar: string[]): boolean => {
      if (hasFsTree) {
        // Try exact path match first
        for (const root of settings.sampleFolders) {
          const normalized = root.replace(/\\/g, '/');
          const fullPath = (normalized + '/' + pathSoFar.join('/')).toLowerCase();
          if (fsChildCount[fullPath] !== undefined) {
            return fsChildCount[fullPath] >= FS_ORG_THRESHOLD;
          }
        }
        // Fall back to name-based lookup
        const nameKey = 'name:' + folderName.toLowerCase();
        if (fsChildCount[nameKey] !== undefined) {
          return fsChildCount[nameKey] >= FS_ORG_THRESHOLD;
        }
      }
      return false;
    };

    // Collect folder hierarchy from sample paths (for prefix detection)
    const normalizedCats = new Set(
      [...SOUND_CATEGORIES].map(c => c.replace(/[^a-z0-9]/g, ''))
    );

    for (const [pid, a] of Object.entries(analysisMap)) {
      totalSamples += a.samples.length;
      for (const s of a.samples) {
        const normalized = s.replace(/\\/g, '/');
        const parts = normalized.split('/').filter(Boolean);

        // Track individual sample file usage (by filename)
        const sampleFileName = parts[parts.length - 1];
        if (sampleFileName) {
          if (!sampleFileUsage[sampleFileName]) {
            sampleFileUsage[sampleFileName] = { count: 0, projects: new Set() };
          }
          sampleFileUsage[sampleFileName].count++;
          sampleFileUsage[sampleFileName].projects.add(pid);
        }

        // Find sample folder root from settings, or fall back to "Samples" marker
        let afterRoot: string[] | null = null;

        if (hasFsTree) {
          // Match against configured sample roots
          for (const root of settings.sampleFolders) {
            const normRoot = root.replace(/\\/g, '/').replace(/\/$/, '');
            if (normalized.toLowerCase().startsWith(normRoot.toLowerCase() + '/')) {
              const rest = normalized.slice(normRoot.length + 1);
              const restParts = rest.split('/').filter(Boolean);
              afterRoot = restParts.slice(0, -1); // folders only, no filename
              break;
            }
          }
        }

        if (!afterRoot) {
          // Fallback: find "Samples" or similar marker in path
          const ROOT_MARKERS = new Set(['samples', 'packs', 'sample packs', 'drumkits']);
          let rootIdx = -1;
          for (let i = 0; i < parts.length; i++) {
            if (ROOT_MARKERS.has(parts[i].toLowerCase())) { rootIdx = i; break; }
          }
          if (rootIdx === -1 || rootIdx >= parts.length - 2) {
            totalSamples--; // undo the count
            continue;
          }
          afterRoot = parts.slice(rootIdx + 1, parts.length - 1);
        }

        if (afterRoot.length === 0) continue;
        if (SKIP_ROOTS.has(afterRoot[0].toLowerCase())) continue;

        // Extension tracking
        const ext = s.split('.').pop()?.toLowerCase() || 'unknown';
        sampleExtUsage[ext] = (sampleExtUsage[ext] || 0) + 1;

        // ── Top-down walk to find pack ──
        let i = 0;
        while (i < afterRoot.length - 1) {
          const folder = afterRoot[i];
          const nextFolder = afterRoot[i + 1];

          // 1) Sound category used as org folder
          if (isSoundCategory(folder)) {
            const hasNonCatAhead = afterRoot.slice(i + 1).some(f => !isSoundCategory(f));
            if (hasNonCatAhead) { i++; continue; }
          }

          // 2) Org folder: real FS shows ≥5 non-category children
          if (isOrgFolder(folder, afterRoot.slice(0, i + 1))) {
            i++; continue;
          }

          // 3) Brand/prefix: child starts with parent name
          const currNorm = folder.toLowerCase().replace(/[^a-z0-9]/g, '');
          const nextNorm = nextFolder.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (currNorm.length >= 3 && nextNorm.startsWith(currNorm)) {
            const extra = nextNorm.slice(currNorm.length);
            if (extra.length > 0 && !normalizedCats.has(extra)) {
              i++; continue;
            }
          }

          break; // this is the pack
        }

        const packName = afterRoot[i];
        if (packName) {
          samplePackUsage[packName] = (samplePackUsage[packName] || 0) + 1;
        }
      }
    }

    const avgSamplesPerProject = analyses.length > 0 ? totalSamples / analyses.length : 0;

    const topSamplePacks = Object.entries(samplePackUsage)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);

    const sampleFormats = Object.entries(sampleExtUsage)
      .map(([name, value]) => ({ name: name.toUpperCase(), value }))
      .sort((a, b) => b.value - a.value);

    // ─ Most used individual samples ─────────
    const topSamples = Object.entries(sampleFileUsage)
      .filter(([, d]) => d.projects.size >= 2) // Only samples used in 2+ projects
      .map(([name, d]) => ({ name, value: d.count, projectCount: d.projects.size }))
      .sort((a, b) => b.projectCount - a.projectCount || b.value - a.value)
      .slice(0, 20);

    // All individual sample filenames for explorer search (including single-project samples)
    const allSamples = Object.entries(sampleFileUsage)
      .map(([name, d]) => ({ name, value: d.count, projectCount: d.projects.size }))
      .sort((a, b) => b.value - a.value);

    // ─ Pattern stats ────────────────────────
    let totalPatterns = 0;
    for (const a of analyses) totalPatterns += a.patterns.length;
    const avgPatternsPerProject = analyses.length > 0 ? totalPatterns / analyses.length : 0;

    // ─ FL Version distribution ──────────────
    const flVersions: Record<string, number> = {};
    for (const a of analyses) {
      if (a.flVersion) {
        const major = a.flVersion.split('.').slice(0, 2).join('.');
        flVersions[major] = (flVersions[major] || 0) + 1;
      }
    }
    const flVersionData = Object.entries(flVersions)
      .map(([name, value]) => ({ name: `FL ${name}`, value }))
      .sort((a, b) => b.value - a.value);

    // ─ Per-project plugin count trend ───────
    const pluginCountPerProject = Object.values(analysisMap).map(a => a.plugins.length);
    const channelCountPerProject = Object.values(analysisMap).map(a => a.channels.length);
    const mixerCountPerProject = Object.values(analysisMap).map(a => a.mixerTracks.length);

    return {
      analyzedCount: analyses.length,
      uniquePlugins,
      totalPluginInstances,
      pluginTypeCount,
      pluginRanking,
      topPlugins,
      topInstruments,
      topEffects,
      topSamplers,
      favoritePlugin,
      favoriteInstrument,
      favoriteEffect,
      totalMixerTracks,
      totalMixerEffects,
      maxMixerEffectsOnTrack,
      maxMixerEffectsTrackName,
      topMixerEffects,
      avgMixerTracksPerProject,
      avgMixerEffectsPerProject,
      totalChannels,
      channelTypeCounts,
      avgChannelsPerProject,
      totalSamples,
      avgSamplesPerProject,
      topSamplePacks,
      topSamples,
      allSamples,
      sampleFormats,
      totalPatterns,
      avgPatternsPerProject,
      flVersionData,
      pluginCountPerProject,
      channelCountPerProject,
      mixerCountPerProject,
    };
  }, [analysisMap, sampleTree, settings.sampleFolders]);

  // ── Basic project stats ───────────────────────────
  const stats = useMemo(() => {
    const totalProjects = projects.length;
    const archivedProjects = projects.filter(p => p.status === 'archived' || p.archived).length;
    const activeProjects = projects.filter(p => p.status !== 'archived' && !p.archived).length;
    const completedProjects = projects.filter(p => p.status === 'completed' || p.status === 'released').length;
    const releasedProjects = projects.filter(p => p.status === 'released').length;
    const inProgressProjects = projects.filter(p => p.status === 'in-progress').length;
    const mixingProjects = projects.filter(p => p.status === 'mixing').length;
    const masteringProjects = projects.filter(p => p.status === 'mastering').length;
    const ideaProjects = projects.filter(p => p.status === 'idea').length;

    const dawStats = projects.reduce((acc, p) => {
      const daw = p.dawType || 'Unknown';
      acc[daw] = (acc[daw] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const bpmRanges = projects.reduce((acc, p) => {
      if (p.bpm <= 0) return acc;
      if (p.bpm < 90) acc['< 90']++;
      else if (p.bpm < 120) acc['90-119']++;
      else if (p.bpm < 140) acc['120-139']++;
      else if (p.bpm < 160) acc['140-159']++;
      else if (p.bpm < 180) acc['160-179']++;
      else acc['180+']++;
      return acc;
    }, { '< 90': 0, '90-119': 0, '120-139': 0, '140-159': 0, '160-179': 0, '180+': 0 } as Record<string, number>);

    const keyStats = projects.reduce((acc, p) => {
      if (p.musicalKey && p.musicalKey !== 'Unknown') acc[p.musicalKey] = (acc[p.musicalKey] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const topKeys = Object.entries(keyStats).sort(([, a], [, b]) => b - a).slice(0, 8);

    const projectsWithTimeData = projects.filter(p => p.timeSpent && p.timeSpent > 0);
    const totalTimeSpent = projectsWithTimeData.reduce((sum, p) => sum + (p.timeSpent || 0), 0);
    const avgTimePerProject = projectsWithTimeData.length > 0 ? totalTimeSpent / projectsWithTimeData.length : 0;
    const maxTimeSpent = projectsWithTimeData.length > 0 ? Math.max(...projectsWithTimeData.map(p => p.timeSpent!)) : 0;

    const tagStats = projects.reduce((acc, p) => {
      p.tags?.forEach(tag => { acc[tag] = (acc[tag] || 0) + 1; });
      return acc;
    }, {} as Record<string, number>);
    const topTags = Object.entries(tagStats).sort(([, a], [, b]) => b - a).slice(0, 12);

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const recentProjects = projects.filter(p => new Date(p.createdAt) > thirtyDaysAgo);
    const weeklyProjects = projects.filter(p => new Date(p.createdAt) > sevenDaysAgo);
    const recentTimeSpent = recentProjects
      .filter(p => p.timeSpent && p.timeSpent > 0)
      .reduce((sum, p) => sum + (p.timeSpent || 0), 0);

    const projectsWithBpm = projects.filter(p => p.bpm > 0);
    const avgBpm = projectsWithBpm.length > 0
      ? projectsWithBpm.reduce((sum, p) => sum + p.bpm, 0) / projectsWithBpm.length : 0;

    const completionRate = totalProjects > 0 ? (completedProjects / totalProjects) : 0;
    const activityRate = totalProjects > 0 ? (recentProjects.length / totalProjects) : 0;
    const timeRate = projectsWithTimeData.length > 0 ? Math.min(1, avgTimePerProject / 120) : 0;
    const productivityScore = Math.min(100, Math.max(0, completionRate * 40 + activityRate * 30 + timeRate * 30));

    const weeklyTrend = Array.from({ length: 8 }, (_, i) => {
      const weekStart = new Date(now.getTime() - (7 - i) * 7 * 24 * 60 * 60 * 1000);
      const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
      return projects.filter(p => {
        const c = new Date(p.createdAt);
        return c >= weekStart && c < weekEnd;
      }).length;
    });

    return {
      totalProjects, activeProjects, archivedProjects, completedProjects, releasedProjects,
      inProgressProjects, mixingProjects, masteringProjects, ideaProjects,
      dawStats, bpmRanges, keyStats, topKeys, tagStats, topTags,
      totalTimeSpent, avgTimePerProject, maxTimeSpent,
      recentProjects: recentProjects.length, weeklyProjects: weeklyProjects.length,
      recentTimeSpent, avgBpm, productivityScore, completionRate: completionRate * 100,
      weeklyTrend, projectsWithTimeData: projectsWithTimeData.length,
    };
  }, [projects]);

  const formatTime = (minutes: number) => {
    if (minutes < 1) return '0m';
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  // ── Chart data ────────────────────────────────────
  const statusColors: Record<string, string> = {
    'idea': '#c084fc', 'in-progress': '#60a5fa', 'mixing': '#fb923c',
    'mastering': '#22d3ee', 'completed': '#4ade80', 'released': '#f472b6', 'archived': '#9ca3af',
  };
  const statusChartData = [
    { name: t('stats.ideas'), value: stats.ideaProjects, color: statusColors['idea'] },
    { name: t('status.inProgress'), value: stats.inProgressProjects, color: statusColors['in-progress'] },
    { name: t('status.mixing'), value: stats.mixingProjects, color: statusColors['mixing'] },
    { name: t('status.mastering'), value: stats.masteringProjects, color: statusColors['mastering'] },
    { name: t('status.completed'), value: stats.completedProjects - stats.releasedProjects, color: statusColors['completed'] },
    { name: t('status.released'), value: stats.releasedProjects, color: statusColors['released'] },
    { name: t('status.archived'), value: stats.archivedProjects, color: statusColors['archived'] },
  ].filter(d => d.value > 0);

  const dawChartData = Object.entries(stats.dawStats)
    .map(([daw, count]) => ({ name: daw, value: count, color: 'hsl(var(--primary))' }))
    .sort((a, b) => b.value - a.value);

  const bpmChartData = Object.entries(stats.bpmRanges)
    .map(([range, count]) => ({ name: range, value: count }))
    .filter(d => d.value > 0);

  const channelTypeData = Object.entries(analysisStats.channelTypeCounts)
    .map(([type, count]) => ({
      name: type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' '),
      value: count,
      color: type === 'generator' ? '#3b82f6' : type === 'sampler' ? '#22c55e' : type === 'audio_clip' ? '#f59e0b' : type === 'layer' ? '#a855f7' : '#6b7280',
    }))
    .sort((a, b) => b.value - a.value);

  const isLoading = !isDataReady;

  const [explorerQuery, setExplorerQuery] = useState('');

  const explorerResults = useMemo(() => {
    const q = explorerQuery.trim().toLowerCase();
    if (!q || q.length < 2) return null;

    const matchedPlugins = analysisStats.pluginRanking
      .filter(p => p.name.toLowerCase().includes(q))
      .slice(0, 20);

    // Search all individual sample files (not just top packs)
    const matchedSampleFiles = analysisStats.allSamples
      .filter(p => p.name.toLowerCase().includes(q))
      .slice(0, 30);

    // Also search pack names
    const matchedSamplePacks = analysisStats.topSamplePacks
      .filter(p => p.name.toLowerCase().includes(q))
      .slice(0, 20);

    const matchedMixer = analysisStats.topMixerEffects
      .filter(p => p.name.toLowerCase().includes(q))
      .slice(0, 20);

    return { matchedPlugins, matchedSampleFiles, matchedSamplePacks, matchedMixer };
  }, [explorerQuery, analysisStats]);

  // ── RENDER ────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="px-6 py-5 border-b border-border/30"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-xl bg-primary/10">
              <BarChart3 className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">{t('stats.title')}</h1>
            {analysisStats.analyzedCount > 0 && (
              <Badge variant="secondary" className="text-sm">
                {t('stats.analyzed', { count: String(analysisStats.analyzedCount) })}
              </Badge>
            )}
          </div>
          <button
            onClick={refreshData}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin")} />
            {t('common.refresh')}
          </button>
        </div>
      </motion.div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {analysisProgress.total > 0
                ? t('stats.analyzing', { current: String(analysisProgress.current), total: String(analysisProgress.total) })
                : t('common.loading')}
            </p>
            {analysisProgress.total > 0 && (
              <Progress value={(analysisProgress.current / analysisProgress.total) * 100} className="w-48 h-1" />
            )}
          </div>
        ) : (
          <Tabs defaultValue="overview" className="flex flex-col h-full">
            <div className="px-6 pt-4 pb-0">
              <TabsList>
                <TabsTrigger value="overview" data-tour-tab="stats-overview">{t('stats.tab.overview')}</TabsTrigger>
                <TabsTrigger value="plugins" data-tour-tab="stats-plugins">{t('stats.tab.plugins')}</TabsTrigger>
                <TabsTrigger value="production" data-tour-tab="stats-production">{t('stats.tab.production')}</TabsTrigger>
                <TabsTrigger value="explorer" data-tour-tab="stats-explorer">{t('stats.tab.explorer')}</TabsTrigger>
              </TabsList>
            </div>

            {/* ── Overview ── */}
            <TabsContent value="overview" className="flex-1 overflow-auto px-6 pb-6">
              <div className="max-w-6xl mx-auto space-y-6">
                {/* Key metrics */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">{t('stats.totalProjects')}</p>
                      <p className="text-3xl font-semibold tracking-tight mt-1">{stats.totalProjects}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t('stats.activeArchived', { active: String(stats.activeProjects), archived: String(stats.archivedProjects) })}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">{t('stats.completionRate')}</p>
                      <p className="text-3xl font-semibold tracking-tight mt-1">{stats.completionRate.toFixed(0)}%</p>
                      <Progress value={stats.completionRate} className="h-1 mt-3" />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">{t('stats.timeInvested')}</p>
                      <p className="text-3xl font-semibold tracking-tight mt-1">{formatTime(stats.totalTimeSpent)}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t('stats.avgPerProject', { time: formatTime(stats.avgTimePerProject) })}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">{t('stats.thisMonth')}</p>
                      <p className="text-3xl font-semibold tracking-tight mt-1">{stats.recentProjects}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t('stats.thisWeek', { count: String(stats.weeklyProjects) })}</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Status + Activity */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium">{t('stats.statusBreakdown')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <BarList data={statusChartData} />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium">{t('stats.activity')}</CardTitle>
                      <CardDescription>{t('stats.last12weeks')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Heatmap projects={projects} />
                    </CardContent>
                  </Card>
                </div>

                {/* BPM + Musical Profile */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium">{t('stats.tempoDistribution')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <BarList data={bpmChartData} showPercent={false} />
                      {stats.avgBpm > 0 && (
                        <>
                          <Separator className="my-4" />
                          <div className="flex items-baseline justify-between text-sm">
                            <span className="text-muted-foreground">{t('common.average')}</span>
                            <span className="text-lg font-semibold tabular-nums">{Math.round(stats.avgBpm)} BPM</span>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium">{t('stats.musicalProfile')}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {stats.topKeys.length > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-2">{t('stats.keys')}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {stats.topKeys.map(([key, count], i) => (
                              <Badge key={key} variant={i === 0 ? "default" : "secondary"} className="tabular-nums">
                                {key} <span className="ml-1 opacity-60">{count}</span>
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {stats.topTags.length > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-2">{t('stats.tags')}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {stats.topTags.map(([tag, count]) => (
                              <Badge key={tag} variant="outline" className="tabular-nums">
                                {tag} <span className="ml-1 opacity-60">{count}</span>
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {stats.topKeys.length === 0 && stats.topTags.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-6">
                          {t('stats.addKeysHint')}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* ── Plugins ── */}
            <TabsContent value="plugins" className="flex-1 overflow-auto px-6 pb-6">
              <div className="max-w-6xl mx-auto space-y-6">
                {/* Numbers */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <Plug className="w-3.5 h-3.5" /> {t('stats.uniquePlugins')}
                      </div>
                      <p className="text-3xl font-semibold tracking-tight">{analysisStats.uniquePlugins}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t('stats.totalInstances', { count: String(analysisStats.totalPluginInstances) })}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <Cpu className="w-3.5 h-3.5" /> {t('stats.instruments')}
                      </div>
                      <p className="text-3xl font-semibold tracking-tight">{analysisStats.pluginTypeCount.instruments}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <AudioLines className="w-3.5 h-3.5" /> {t('stats.effects')}
                      </div>
                      <p className="text-3xl font-semibold tracking-tight">{analysisStats.pluginTypeCount.effects}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <Volume2 className="w-3.5 h-3.5" /> {t('stats.samplers')}
                      </div>
                      <p className="text-3xl font-semibold tracking-tight">{analysisStats.pluginTypeCount.samplers}</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Favorites row */}
                {analysisStats.favoritePlugin && (
                  <Card>
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">
                        <div className="pb-4 md:pb-0 md:pr-6">
                          <p className="text-xs text-muted-foreground mb-1">{t('stats.mostUsed')}</p>
                          <p className="font-semibold truncate">{analysisStats.favoritePlugin.name}</p>
                          <p className="text-sm text-muted-foreground">{t('stats.usedAcross', { count: String(analysisStats.favoritePlugin.count), projects: String(analysisStats.favoritePlugin.projectCount) })}</p>
                        </div>
                        {analysisStats.favoriteInstrument && (
                          <div className="pt-4 md:pt-0 md:px-6">
                            <p className="text-xs text-muted-foreground mb-1">{t('stats.topInstrument')}</p>
                            <p className="font-semibold truncate">{analysisStats.favoriteInstrument.name}</p>
                            <p className="text-sm text-muted-foreground">{t('stats.usedTimes', { count: String(analysisStats.favoriteInstrument.count) })}</p>
                          </div>
                        )}
                        {analysisStats.favoriteEffect && (
                          <div className="pt-4 md:pt-0 md:pl-6">
                            <p className="text-xs text-muted-foreground mb-1">{t('stats.topEffect')}</p>
                            <p className="font-semibold truncate">{analysisStats.favoriteEffect.name}</p>
                            <p className="text-sm text-muted-foreground">{t('stats.usedTimes', { count: String(analysisStats.favoriteEffect.count) })}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Rankings */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {analysisStats.topInstruments.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm font-medium">{t('stats.topInstruments')}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <BarList data={analysisStats.topInstruments.map(p => ({ name: p.name, value: p.count, color: '#3b82f6' }))} />
                      </CardContent>
                    </Card>
                  )}
                  {analysisStats.topEffects.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm font-medium">{t('stats.topEffects')}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <BarList data={analysisStats.topEffects.map(p => ({ name: p.name, value: p.count, color: '#f97316' }))} />
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Mixer effects */}
                {analysisStats.topMixerEffects.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium">{t('stats.mixerInsertRankings')}</CardTitle>
                      <CardDescription>
                        {t('stats.mixerEffectsAcross', { effects: String(analysisStats.totalMixerEffects), tracks: String(analysisStats.totalMixerTracks) })}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <BarList data={analysisStats.topMixerEffects.map(p => ({ name: p.name, value: p.value, color: '#a855f7' }))} />
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* ── Production ── */}
            <TabsContent value="production" className="flex-1 overflow-auto px-6 pb-6">
              <div className="max-w-6xl mx-auto space-y-6">
                {/* Time stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">{t('stats.totalTime')}</p>
                      <p className="text-2xl font-semibold tracking-tight mt-1">{formatTime(stats.totalTimeSpent)}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t('stats.projectsTracked', { count: String(stats.projectsWithTimeData) })}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">{t('stats.avgPerProjectTime')}</p>
                      <p className="text-2xl font-semibold tracking-tight mt-1">{formatTime(stats.avgTimePerProject)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">{t('stats.longestSession')}</p>
                      <p className="text-2xl font-semibold tracking-tight mt-1">{formatTime(stats.maxTimeSpent)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">{t('stats.thisMonth')}</p>
                      <p className="text-2xl font-semibold tracking-tight mt-1">{formatTime(stats.recentTimeSpent)}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t('stats.projects', { count: String(stats.recentProjects) })}</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Composition stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <SlidersHorizontal className="w-3.5 h-3.5" /> {t('stats.channels')}
                      </div>
                      <p className="text-2xl font-semibold">{analysisStats.totalChannels}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t('stats.avgProjectSuffix', { value: analysisStats.avgChannelsPerProject.toFixed(1) })}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <Layers className="w-3.5 h-3.5" /> {t('stats.patterns')}
                      </div>
                      <p className="text-2xl font-semibold">{analysisStats.totalPatterns}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t('stats.avgProjectSuffix', { value: analysisStats.avgPatternsPerProject.toFixed(1) })}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <Headphones className="w-3.5 h-3.5" /> {t('stats.mixerInserts')}
                      </div>
                      <p className="text-2xl font-semibold">{analysisStats.totalMixerTracks}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t('stats.avgProjectSuffix', { value: analysisStats.avgMixerTracksPerProject.toFixed(1) })}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <FileAudio className="w-3.5 h-3.5" /> {t('stats.samples')}
                      </div>
                      <p className="text-2xl font-semibold">{analysisStats.totalSamples}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t('stats.avgProjectSuffix', { value: analysisStats.avgSamplesPerProject.toFixed(1) })}</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Channel types + DAW + FL versions */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {channelTypeData.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm font-medium">{t('stats.channelTypes')}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <BarList data={channelTypeData} />
                      </CardContent>
                    </Card>
                  )}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium">{t('stats.dawUsage')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <BarList data={dawChartData} />
                    </CardContent>
                  </Card>
                  {analysisStats.flVersionData.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm font-medium">{t('stats.flVersions')}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <BarList data={analysisStats.flVersionData} />
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Sample packs + formats */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {analysisStats.topSamplePacks.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm font-medium">{t('stats.topSamplePacks')}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <BarList data={analysisStats.topSamplePacks.map(f => ({ name: f.name, value: f.value, color: '#22c55e' }))} max={12} />
                      </CardContent>
                    </Card>
                  )}
                  {analysisStats.sampleFormats.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm font-medium">{t('stats.sampleFormats')}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <BarList data={analysisStats.sampleFormats.map((f, i) => ({
                          name: `.${f.name.toLowerCase()}`,
                          value: f.value,
                          color: ['#22c55e', '#3b82f6', '#f97316', '#ec4899', '#8b5cf6'][i % 5],
                        }))} />
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Most used individual samples */}
                {analysisStats.topSamples.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium">{t('stats.topSamples')}</CardTitle>
                      <CardDescription>{t('stats.topSamplesDesc')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {analysisStats.topSamples.map((s) => (
                          <div key={s.name} className="flex items-center justify-between text-sm py-1.5 border-b border-border/20 last:border-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <FileAudio className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                              <span className="truncate font-medium">{s.name}</span>
                            </div>
                            <span className="text-muted-foreground tabular-nums flex-shrink-0 ml-3">
                              {t('stats.sampleUsage', { count: String(s.value), projects: String(s.projectCount) })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>
            {/* ── Explorer ── */}
            <TabsContent value="explorer" className="flex-1 overflow-auto px-6 pb-6">
              <div className="max-w-6xl mx-auto space-y-6">
                {/* Search */}
                <div className="relative max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={explorerQuery}
                    onChange={(e) => setExplorerQuery(e.target.value)}
                    placeholder={t('stats.explorerSearch')}
                    className="pl-9 bg-muted/30"
                  />
                </div>

                {explorerQuery.trim().length < 2 ? (
                  <div className="space-y-6">
                    <p className="text-sm text-muted-foreground">{t('stats.explorerHint')}</p>

                    {/* Full plugin list */}
                    {analysisStats.pluginRanking.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm font-medium">{t('stats.allPlugins', { count: String(analysisStats.pluginRanking.length) })}</CardTitle>
                          <CardDescription>{t('stats.everyPlugin')}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {analysisStats.pluginRanking.map((p) => (
                              <div key={p.name} className="flex items-center justify-between text-sm py-1.5 border-b border-border/20 last:border-0">
                                <div className="flex items-center gap-2 min-w-0">
                                  <Badge variant={p.isSampler ? 'default' : p.isInstrument ? 'secondary' : 'outline'} className="text-[10px] px-1.5 py-0 flex-shrink-0">
                                    {p.isSampler ? 'SMP' : p.isInstrument ? 'INST' : 'FX'}
                                  </Badge>
                                  <span className="truncate font-medium">{p.name}</span>
                                </div>
                                <span className="text-muted-foreground tabular-nums flex-shrink-0 ml-3">
                                  {t('stats.pluginUsage', { count: String(p.count), projects: String(p.projectCount) })}
                                </span>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Full sample files list */}
                    {analysisStats.allSamples.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm font-medium">{t('stats.allSampleFiles', { count: String(analysisStats.allSamples.length) })}</CardTitle>
                          <CardDescription>{t('stats.allSampleFilesDesc')}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2 max-h-80 overflow-y-auto">
                            {analysisStats.allSamples.slice(0, 100).map((s) => (
                              <div key={s.name} className="flex items-center justify-between text-sm py-1.5 border-b border-border/20 last:border-0">
                                <div className="flex items-center gap-2 min-w-0">
                                  <FileAudio className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                                  <span className="truncate font-medium">{s.name}</span>
                                </div>
                                <span className="text-muted-foreground tabular-nums flex-shrink-0 ml-3">
                                  {t('stats.sampleUsage', { count: String(s.value), projects: String(s.projectCount) })}
                                </span>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Full sample packs list */}
                    {analysisStats.topSamplePacks.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm font-medium">{t('stats.allSamplePacks', { count: String(analysisStats.topSamplePacks.length) })}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <BarList data={analysisStats.topSamplePacks.map(f => ({ name: f.name, value: f.value, color: '#22c55e' }))} max={100} />
                        </CardContent>
                      </Card>
                    )}

                    {/* Full mixer effects list */}
                    {analysisStats.topMixerEffects.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm font-medium">{t('stats.allMixerEffects', { count: String(analysisStats.topMixerEffects.length) })}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <BarList data={analysisStats.topMixerEffects.map(f => ({ name: f.name, value: f.value, color: '#a855f7' }))} max={100} />
                        </CardContent>
                      </Card>
                    )}
                  </div>
                ) : explorerResults ? (
                  <div className="space-y-6">
                    {explorerResults.matchedPlugins.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm font-medium">{t('stats.pluginsLabel', { count: String(explorerResults.matchedPlugins.length) })}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {explorerResults.matchedPlugins.map((p) => (
                              <div key={p.name} className="flex items-center justify-between text-sm py-1.5 border-b border-border/20 last:border-0">
                                <div className="flex items-center gap-2 min-w-0">
                                  <Badge variant={p.isSampler ? 'default' : p.isInstrument ? 'secondary' : 'outline'} className="text-[10px] px-1.5 py-0 flex-shrink-0">
                                    {p.isSampler ? 'SMP' : p.isInstrument ? 'INST' : 'FX'}
                                  </Badge>
                                  <span className="truncate font-medium">{p.name}</span>
                                </div>
                                <span className="text-muted-foreground tabular-nums flex-shrink-0 ml-3">
                                  {t('stats.pluginUsage', { count: String(p.count), projects: String(p.projectCount) })}
                                </span>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {explorerResults.matchedSampleFiles.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm font-medium">Sample Files ({explorerResults.matchedSampleFiles.length})</CardTitle>
                          <CardDescription>Individual sample files matching your search</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {explorerResults.matchedSampleFiles.map((s) => (
                              <div key={s.name} className="flex items-center justify-between text-sm py-1.5 border-b border-border/20 last:border-0">
                                <div className="flex items-center gap-2 min-w-0">
                                  <FileAudio className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                                  <span className="truncate font-medium">{s.name}</span>
                                </div>
                                <span className="text-muted-foreground tabular-nums flex-shrink-0 ml-3">
                                  {t('stats.sampleUsage', { count: String(s.value), projects: String(s.projectCount) })}
                                </span>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {explorerResults.matchedSamplePacks.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm font-medium">{t('stats.samplePacksLabel', { count: String(explorerResults.matchedSamplePacks.length) })}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <BarList data={explorerResults.matchedSamplePacks.map(f => ({ name: f.name, value: f.value, color: '#22c55e' }))} max={20} />
                        </CardContent>
                      </Card>
                    )}

                    {explorerResults.matchedMixer.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm font-medium">{t('stats.mixerEffectsLabel', { count: String(explorerResults.matchedMixer.length) })}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <BarList data={explorerResults.matchedMixer.map(f => ({ name: f.name, value: f.value, color: '#a855f7' }))} max={20} />
                        </CardContent>
                      </Card>
                    )}

                    {explorerResults.matchedPlugins.length === 0 &&
                     explorerResults.matchedSampleFiles.length === 0 &&
                     explorerResults.matchedSamplePacks.length === 0 &&
                     explorerResults.matchedMixer.length === 0 && (
                      <p className="text-sm text-muted-foreground py-8 text-center">
                        {t('stats.noResults', { query: explorerQuery })}
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
};
