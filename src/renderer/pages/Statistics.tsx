import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3,
  Clock,
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
  Users,
  FolderOpen,
  Hash,
  Target,
  Zap,
  ChevronRight,
  Calendar,
  Disc3,
  Star,
  Trophy,
  Activity,
  GitBranch,
  X,
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

// ── Mini sparkline bar chart ──────────────────────────
const MiniBarChart: React.FC<{
  data: number[];
  labels?: string[];
  height?: number;
  color?: string;
}> = ({ data, labels, height = 60, color = 'hsl(var(--primary))' }) => {
  const maxVal = Math.max(...data, 1);
  return (
    <TooltipProvider delayDuration={80}>
      <div className="flex items-end gap-[3px]" style={{ height }}>
        {data.map((val, i) => (
          <Tooltip key={i}>
            <TooltipTrigger asChild>
              <div
                className="flex-1 rounded-t-sm transition-all duration-300 min-w-[4px] hover:opacity-80"
                style={{
                  height: `${Math.max((val / maxVal) * 100, 2)}%`,
                  backgroundColor: val > 0 ? color : 'hsl(var(--secondary))',
                }}
              />
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs py-1 px-2">
              {labels?.[i] ?? `#${i + 1}`}: {val}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
};

// ── Stat number with label ──────────────────────────
const StatNumber: React.FC<{
  label: string;
  value: string | number;
  sub?: string;
  icon?: React.ReactNode;
}> = ({ label, value, sub, icon }) => (
  <div>
    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
      {icon}
      {label}
    </div>
    <p className="text-2xl font-semibold tracking-tight">{value}</p>
    {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
  </div>
);

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

  // UI state
  const [pluginSearch, setPluginSearch] = useState('');
  const [pluginTypeFilter, setPluginTypeFilter] = useState<'all' | 'instrument' | 'effect' | 'sampler'>('all');
  const [pluginSort, setPluginSort] = useState<'count' | 'name' | 'projects'>('count');
  const [expandedPlugin, setExpandedPlugin] = useState<string | null>(null);
  const [explorerQuery, setExplorerQuery] = useState('');
  const [explorerCategory, setExplorerCategory] = useState<'all' | 'plugins' | 'samples' | 'packs' | 'mixer'>('all');
  const [explorerSort, setExplorerSort] = useState<'count' | 'name'>('count');
  const [activeTab, setActiveTab] = useState('overview');

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

  // ── Load FLP analyses ──
  const loadAnalyses = useCallback(async (force = false) => {
    const flProjects = projects.filter(p => p.dawType === 'FL Studio' && p.dawProjectPath);
    if (flProjects.length === 0) {
      setIsDataReady(true);
      return;
    }

    if (!force) {
      try {
        const cached = await ((window.electron as any)?.getAllFlpAnalysesCached?.() ?? getAllFlpAnalysesCached());
        if (cached && Object.keys(cached).length > 0) {
          setAnalysisMap(cached as Record<string, FlpAnalysis>);
          setIsDataReady(true);
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
        console.warn('[Statistics] Cache load failed:', err);
      }
    }

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

  // ── Project name lookup ──
  const projectNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of projects) map[p.id] = p.title;
    return map;
  }, [projects]);

  // ── Aggregate FLP analysis data across all projects ───────
  const analysisStats = useMemo(() => {
    const analyses = Object.values(analysisMap);

    // ─ Plugin rankings ──────────────────────
    const pluginUsage: Record<string, {
      count: number;
      isInstrument: boolean;
      isSampler: boolean;
      projects: Set<string>;
      presets: Set<string>;
      channelNames: Set<string>;
    }> = {};
    const pluginTypeCount = { instruments: 0, effects: 0, samplers: 0 };
    let totalPluginInstances = 0;

    // Plugin co-occurrence
    const projectPluginSets: Record<string, Set<string>> = {};

    for (const [pid, a] of Object.entries(analysisMap)) {
      if (!projectPluginSets[pid]) projectPluginSets[pid] = new Set();

      for (const plugin of a.plugins) {
        const isSampler = plugin.dllName === 'Sampler';
        if (!pluginUsage[plugin.name]) {
          pluginUsage[plugin.name] = { count: 0, isInstrument: plugin.isInstrument, isSampler, projects: new Set(), presets: new Set(), channelNames: new Set() };
        }
        pluginUsage[plugin.name].count++;
        pluginUsage[plugin.name].projects.add(pid);
        if (plugin.presetName) pluginUsage[plugin.name].presets.add(plugin.presetName);
        if (plugin.channelName) pluginUsage[plugin.name].channelNames.add(plugin.channelName);
        projectPluginSets[pid].add(plugin.name);
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
      .map(([name, data]) => ({
        name,
        ...data,
        projectCount: data.projects.size,
        presetList: [...data.presets],
        channelList: [...data.channelNames],
        projectNames: [...data.projects].map(pid => projectNameMap[pid] || pid),
      }))
      .sort((a, b) => b.count - a.count);

    const topPlugins = pluginRanking.slice(0, 15);
    const topInstruments = pluginRanking.filter(p => p.isInstrument && !p.isSampler).slice(0, 10);
    const topEffects = pluginRanking.filter(p => !p.isInstrument && !p.isSampler).slice(0, 10);
    const topSamplers = pluginRanking.filter(p => p.isSampler).slice(0, 10);

    const favoritePlugin = pluginRanking.length > 0 ? pluginRanking[0] : null;
    const favoriteInstrument = topInstruments.length > 0 ? topInstruments[0] : null;
    const favoriteEffect = topEffects.length > 0 ? topEffects[0] : null;

    // ─ Plugin co-occurrence ──────────────────
    const coOccurrence: Record<string, number> = {};
    const pluginSetsArr = Object.values(projectPluginSets);
    for (const pSet of pluginSetsArr) {
      const arr = [...pSet];
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          const key = [arr[i], arr[j]].sort().join(' + ');
          coOccurrence[key] = (coOccurrence[key] || 0) + 1;
        }
      }
    }
    const topCoOccurrence = Object.entries(coOccurrence)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 15);

    // ─ Mixer stats ──────────────────────────
    let totalMixerTracks = 0;
    let totalMixerEffects = 0;
    let maxMixerEffectsOnTrack = 0;
    let maxMixerEffectsTrackName = '';
    const mixerEffectUsage: Record<string, number> = {};
    const mixerChainLengths: number[] = [];

    for (const a of analyses) {
      totalMixerTracks += a.mixerTracks.length;
      for (const mt of a.mixerTracks) {
        totalMixerEffects += mt.plugins.length;
        if (mt.plugins.length > 0) mixerChainLengths.push(mt.plugins.length);
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
    const avgEffectsPerMixerTrack = mixerChainLengths.length > 0
      ? mixerChainLengths.reduce((a, b) => a + b, 0) / mixerChainLengths.length : 0;
    const sortedChains = [...mixerChainLengths].sort((a, b) => a - b);
    const medianEffectsPerTrack = sortedChains.length > 0
      ? sortedChains[Math.floor(sortedChains.length / 2)] : 0;

    // ─ Per-project complexity ────────────────
    const projectComplexity = Object.entries(analysisMap).map(([pid, a]) => ({
      id: pid,
      name: projectNameMap[pid] || pid,
      plugins: a.plugins.length,
      channels: a.channels.length,
      patterns: a.patterns.length,
      mixerTracks: a.mixerTracks.length,
      samples: a.samples.length,
      mixerEffects: a.mixerTracks.reduce((sum, mt) => sum + mt.plugins.length, 0),
      score: a.plugins.length + a.channels.length + a.patterns.length + a.mixerTracks.length + a.samples.length,
    })).sort((a, b) => b.score - a.score);

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
    const sampleFileUsage: Record<string, { count: number; projects: Set<string> }> = {};

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
      if (words.length <= 2 && words.every(w =>
        SOUND_CATEGORIES.has(w) || SOUND_CATEGORIES.has(w + 's') || SOUND_CATEGORIES.has(w.replace(/s$/, ''))
      )) return true;
      return false;
    };

    const fsChildCount: Record<string, number> = {};
    const FS_ORG_THRESHOLD = 5;
    const hasFsTree = Object.keys(sampleTree).length > 0;

    if (hasFsTree) {
      for (const [folderPath, children] of Object.entries(sampleTree)) {
        const segments = folderPath.split('/');
        const folderName = segments[segments.length - 1];
        const nonCatChildren = children.filter(c => !isSoundCategory(c));
        const fullKey = folderPath.toLowerCase();
        fsChildCount[fullKey] = nonCatChildren.length;
        const nameKey = 'name:' + folderName.toLowerCase();
        fsChildCount[nameKey] = Math.max(fsChildCount[nameKey] || 0, nonCatChildren.length);
      }
    }

    const isOrgFolder = (folderName: string, pathSoFar: string[]): boolean => {
      if (hasFsTree) {
        for (const root of settings.sampleFolders) {
          const normalized = root.replace(/\\/g, '/');
          const fullPath = (normalized + '/' + pathSoFar.join('/')).toLowerCase();
          if (fsChildCount[fullPath] !== undefined) {
            return fsChildCount[fullPath] >= FS_ORG_THRESHOLD;
          }
        }
        const nameKey = 'name:' + folderName.toLowerCase();
        if (fsChildCount[nameKey] !== undefined) {
          return fsChildCount[nameKey] >= FS_ORG_THRESHOLD;
        }
      }
      return false;
    };

    const normalizedCats = new Set(
      [...SOUND_CATEGORIES].map(c => c.replace(/[^a-z0-9]/g, ''))
    );

    for (const [pid, a] of Object.entries(analysisMap)) {
      totalSamples += a.samples.length;
      for (const s of a.samples) {
        const normalized = s.replace(/\\/g, '/');
        const parts = normalized.split('/').filter(Boolean);

        const sampleFileName = parts[parts.length - 1];
        if (sampleFileName) {
          if (!sampleFileUsage[sampleFileName]) {
            sampleFileUsage[sampleFileName] = { count: 0, projects: new Set() };
          }
          sampleFileUsage[sampleFileName].count++;
          sampleFileUsage[sampleFileName].projects.add(pid);
        }

        let afterRoot: string[] | null = null;

        if (hasFsTree) {
          for (const root of settings.sampleFolders) {
            const normRoot = root.replace(/\\/g, '/').replace(/\/$/, '');
            if (normalized.toLowerCase().startsWith(normRoot.toLowerCase() + '/')) {
              const rest = normalized.slice(normRoot.length + 1);
              const restParts = rest.split('/').filter(Boolean);
              afterRoot = restParts.slice(0, -1);
              break;
            }
          }
        }

        if (!afterRoot) {
          const ROOT_MARKERS = new Set(['samples', 'packs', 'sample packs', 'drumkits']);
          let rootIdx = -1;
          for (let i = 0; i < parts.length; i++) {
            if (ROOT_MARKERS.has(parts[i].toLowerCase())) { rootIdx = i; break; }
          }
          if (rootIdx === -1 || rootIdx >= parts.length - 2) {
            totalSamples--;
            continue;
          }
          afterRoot = parts.slice(rootIdx + 1, parts.length - 1);
        }

        if (afterRoot.length === 0) continue;
        if (SKIP_ROOTS.has(afterRoot[0].toLowerCase())) continue;

        const ext = s.split('.').pop()?.toLowerCase() || 'unknown';
        sampleExtUsage[ext] = (sampleExtUsage[ext] || 0) + 1;

        let i = 0;
        while (i < afterRoot.length - 1) {
          const folder = afterRoot[i];
          const nextFolder = afterRoot[i + 1];

          if (isSoundCategory(folder)) {
            const hasNonCatAhead = afterRoot.slice(i + 1).some(f => !isSoundCategory(f));
            if (hasNonCatAhead) { i++; continue; }
          }

          if (isOrgFolder(folder, afterRoot.slice(0, i + 1))) {
            i++; continue;
          }

          const currNorm = folder.toLowerCase().replace(/[^a-z0-9]/g, '');
          const nextNorm = nextFolder.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (currNorm.length >= 3 && nextNorm.startsWith(currNorm)) {
            const extra = nextNorm.slice(currNorm.length);
            if (extra.length > 0 && !normalizedCats.has(extra)) {
              i++; continue;
            }
          }

          break;
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

    const allSamplePacks = Object.entries(samplePackUsage)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const sampleFormats = Object.entries(sampleExtUsage)
      .map(([name, value]) => ({ name: name.toUpperCase(), value }))
      .sort((a, b) => b.value - a.value);

    const topSamples = Object.entries(sampleFileUsage)
      .filter(([, d]) => d.projects.size >= 2)
      .map(([name, d]) => ({ name, value: d.count, projectCount: d.projects.size }))
      .sort((a, b) => b.projectCount - a.projectCount || b.value - a.value)
      .slice(0, 20);

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

    const pluginCountPerProject = Object.values(analysisMap).map(a => a.plugins.length);
    const channelCountPerProject = Object.values(analysisMap).map(a => a.channels.length);
    const mixerCountPerProject = Object.values(analysisMap).map(a => a.mixerTracks.length);

    // ─ Unique presets total ────────────────
    const allPresets = new Set<string>();
    for (const p of pluginRanking) p.presetList.forEach(pr => allPresets.add(pr));

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
      topCoOccurrence,
      totalMixerTracks,
      totalMixerEffects,
      maxMixerEffectsOnTrack,
      maxMixerEffectsTrackName,
      topMixerEffects,
      avgMixerTracksPerProject,
      avgMixerEffectsPerProject,
      avgEffectsPerMixerTrack,
      medianEffectsPerTrack,
      totalChannels,
      channelTypeCounts,
      avgChannelsPerProject,
      totalSamples,
      avgSamplesPerProject,
      topSamplePacks,
      allSamplePacks,
      topSamples,
      allSamples,
      sampleFormats,
      totalPatterns,
      avgPatternsPerProject,
      flVersionData,
      pluginCountPerProject,
      channelCountPerProject,
      mixerCountPerProject,
      projectComplexity,
      totalPresets: allPresets.size,
    };
  }, [analysisMap, sampleTree, settings.sampleFolders, projectNameMap]);

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
    const topKeys = Object.entries(keyStats).sort(([, a], [, b]) => b - a).slice(0, 12);

    const projectsWithTimeData = projects.filter(p => p.timeSpent && p.timeSpent > 0);
    const totalTimeSpent = projectsWithTimeData.reduce((sum, p) => sum + (p.timeSpent || 0), 0);
    const avgTimePerProject = projectsWithTimeData.length > 0 ? totalTimeSpent / projectsWithTimeData.length : 0;
    const maxTimeSpent = projectsWithTimeData.length > 0 ? Math.max(...projectsWithTimeData.map(p => p.timeSpent!)) : 0;

    const tagStats = projects.reduce((acc, p) => {
      p.tags?.forEach(tag => { acc[tag] = (acc[tag] || 0) + 1; });
      return acc;
    }, {} as Record<string, number>);
    const topTags = Object.entries(tagStats).sort(([, a], [, b]) => b - a).slice(0, 12);
    const allTags = Object.entries(tagStats).sort(([, a], [, b]) => b - a);

    // Genre stats
    const genreStats = projects.reduce((acc, p) => {
      if (p.genre) acc[p.genre] = (acc[p.genre] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const topGenres = Object.entries(genreStats)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Artist stats
    const artistStats = projects.reduce((acc, p) => {
      if (p.artists) {
        p.artists.split(/[,;&]+/).map(a => a.trim()).filter(Boolean).forEach(artist => {
          acc[artist] = (acc[artist] || 0) + 1;
        });
      }
      return acc;
    }, {} as Record<string, number>);
    const topArtists = Object.entries(artistStats)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Collection stats
    const collectionStats = projects.reduce((acc, p) => {
      if (p.collectionName) acc[p.collectionName] = (acc[p.collectionName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const topCollections = Object.entries(collectionStats)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

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
    const bpmValues = projectsWithBpm.map(p => p.bpm).sort((a, b) => a - b);
    const medianBpm = bpmValues.length > 0 ? bpmValues[Math.floor(bpmValues.length / 2)] : 0;
    const minBpm = bpmValues.length > 0 ? bpmValues[0] : 0;
    const maxBpm = bpmValues.length > 0 ? bpmValues[bpmValues.length - 1] : 0;

    const bpmCounts: Record<number, number> = {};
    for (const b of bpmValues) bpmCounts[b] = (bpmCounts[b] || 0) + 1;
    const modeBpm = Object.entries(bpmCounts).sort(([, a], [, b]) => b - a)[0];

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

    // Monthly trend (12 months)
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyTrend = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const count = projects.filter(p => {
        const c = new Date(p.createdAt);
        return c >= d && c < nextMonth;
      }).length;
      return { label: `${monthNames[d.getMonth()]} ${d.getFullYear().toString().slice(2)}`, value: count };
    });

    // Monthly status breakdown
    const monthlyStatus = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const monthProjects = projects.filter(p => {
        const c = new Date(p.createdAt);
        return c >= d && c < nextMonth;
      });
      return {
        label: `${monthNames[d.getMonth()]} ${d.getFullYear().toString().slice(2)}`,
        total: monthProjects.length,
        completed: monthProjects.filter(p => p.status === 'completed' || p.status === 'released').length,
        inProgress: monthProjects.filter(p => p.status === 'in-progress').length,
        idea: monthProjects.filter(p => p.status === 'idea').length,
      };
    });

    // Major vs minor key distribution
    const majorKeys = Object.entries(keyStats).filter(([k]) => !k.toLowerCase().includes('m') || k.toLowerCase().includes('maj')).reduce((s, [, v]) => s + v, 0);
    const minorKeys = Object.entries(keyStats).filter(([k]) => k.toLowerCase().includes('m') && !k.toLowerCase().includes('maj')).reduce((s, [, v]) => s + v, 0);

    // Most productive month
    const mostProductiveMonth = monthlyTrend.reduce((best, m) => m.value > best.value ? m : best, { label: '—', value: 0 });

    // Longest time project
    const longestProject = projectsWithTimeData.length > 0
      ? projectsWithTimeData.reduce((best, p) => (p.timeSpent || 0) > (best.timeSpent || 0) ? p : best)
      : null;

    // Share count stats
    const totalShares = projects.reduce((sum, p) => sum + (p.shareCount || 0), 0);
    const projectsShared = projects.filter(p => (p.shareCount || 0) > 0).length;

    return {
      totalProjects, activeProjects, archivedProjects, completedProjects, releasedProjects,
      inProgressProjects, mixingProjects, masteringProjects, ideaProjects,
      dawStats, bpmRanges, keyStats, topKeys, tagStats, topTags, allTags,
      totalTimeSpent, avgTimePerProject, maxTimeSpent,
      recentProjects: recentProjects.length, weeklyProjects: weeklyProjects.length,
      recentTimeSpent, avgBpm, medianBpm, minBpm, maxBpm, modeBpm: modeBpm ? { bpm: Number(modeBpm[0]), count: modeBpm[1] } : null,
      productivityScore, completionRate: completionRate * 100,
      weeklyTrend, monthlyTrend, monthlyStatus,
      projectsWithTimeData: projectsWithTimeData.length,
      topGenres, topArtists, topCollections,
      majorKeys, minorKeys,
      mostProductiveMonth,
      longestProject,
      totalShares, projectsShared,
      genreCount: Object.keys(genreStats).length,
      artistCount: Object.keys(artistStats).length,
      collectionCount: Object.keys(collectionStats).length,
      tagCount: Object.keys(tagStats).length,
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

  // ── Filtered plugin list ────────────────────────────
  const filteredPlugins = useMemo(() => {
    let list = analysisStats.pluginRanking;
    if (pluginSearch) {
      const q = pluginSearch.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q));
    }
    if (pluginTypeFilter !== 'all') {
      list = list.filter(p => {
        if (pluginTypeFilter === 'sampler') return p.isSampler;
        if (pluginTypeFilter === 'instrument') return p.isInstrument && !p.isSampler;
        return !p.isInstrument && !p.isSampler;
      });
    }
    if (pluginSort === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    else if (pluginSort === 'projects') list = [...list].sort((a, b) => b.projectCount - a.projectCount);
    return list;
  }, [analysisStats.pluginRanking, pluginSearch, pluginTypeFilter, pluginSort]);

  // ── Explorer results ────────────────────────────
  const explorerResults = useMemo(() => {
    const q = explorerQuery.trim().toLowerCase();
    const nameSorter = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
    const countSorter = (a: { value: number }, b: { value: number }) => b.value - a.value;
    const sortFn = explorerSort === 'name' ? nameSorter : countSorter;

    if (!q || q.length < 2) {
      return {
        matchedPlugins: explorerCategory === 'all' || explorerCategory === 'plugins'
          ? [...analysisStats.pluginRanking].sort(sortFn as any) : [],
        matchedSampleFiles: explorerCategory === 'all' || explorerCategory === 'samples'
          ? [...analysisStats.allSamples].sort(sortFn as any).slice(0, 100) : [],
        matchedSamplePacks: explorerCategory === 'all' || explorerCategory === 'packs'
          ? [...analysisStats.allSamplePacks].sort(sortFn as any) : [],
        matchedMixer: explorerCategory === 'all' || explorerCategory === 'mixer'
          ? [...analysisStats.topMixerEffects].sort(sortFn as any) : [],
        isSearch: false,
      };
    }

    return {
      matchedPlugins: (explorerCategory === 'all' || explorerCategory === 'plugins')
        ? analysisStats.pluginRanking.filter(p => p.name.toLowerCase().includes(q)).slice(0, 30) : [],
      matchedSampleFiles: (explorerCategory === 'all' || explorerCategory === 'samples')
        ? analysisStats.allSamples.filter(p => p.name.toLowerCase().includes(q)).slice(0, 50) : [],
      matchedSamplePacks: (explorerCategory === 'all' || explorerCategory === 'packs')
        ? analysisStats.allSamplePacks.filter(p => p.name.toLowerCase().includes(q)).slice(0, 30) : [],
      matchedMixer: (explorerCategory === 'all' || explorerCategory === 'mixer')
        ? analysisStats.topMixerEffects.filter(p => p.name.toLowerCase().includes(q)).slice(0, 30) : [],
      isSearch: true,
    };
  }, [explorerQuery, explorerCategory, explorerSort, analysisStats]);

  const isLoading = !isDataReady;

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
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
            <div className="px-6 pt-4 pb-0">
              <TabsList>
                <TabsTrigger value="overview" data-tour-tab="stats-overview">{t('stats.tab.overview')}</TabsTrigger>
                <TabsTrigger value="plugins" data-tour-tab="stats-plugins">{t('stats.tab.plugins')}</TabsTrigger>
                <TabsTrigger value="production" data-tour-tab="stats-production">{t('stats.tab.production')}</TabsTrigger>
                <TabsTrigger value="trends">Trends</TabsTrigger>
                <TabsTrigger value="explorer" data-tour-tab="stats-explorer">{t('stats.tab.explorer')}</TabsTrigger>
              </TabsList>
            </div>

            {/* ═══════════════════════════════════════ */}
            {/*  OVERVIEW TAB                           */}
            {/* ═══════════════════════════════════════ */}
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

                {/* Productivity Score + Quick Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <Zap className="w-3.5 h-3.5" /> Productivity Score
                      </div>
                      <p className="text-3xl font-semibold tracking-tight">{stats.productivityScore.toFixed(0)}</p>
                      <Progress value={stats.productivityScore} className="h-1 mt-3" />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <Disc3 className="w-3.5 h-3.5" /> Genres
                      </div>
                      <p className="text-3xl font-semibold tracking-tight">{stats.genreCount}</p>
                      {stats.topGenres[0] && <p className="text-xs text-muted-foreground mt-1">Top: {stats.topGenres[0].name}</p>}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <Users className="w-3.5 h-3.5" /> Artists
                      </div>
                      <p className="text-3xl font-semibold tracking-tight">{stats.artistCount}</p>
                      {stats.topArtists[0] && <p className="text-xs text-muted-foreground mt-1">Top: {stats.topArtists[0].name}</p>}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <FolderOpen className="w-3.5 h-3.5" /> Collections
                      </div>
                      <p className="text-3xl font-semibold tracking-tight">{stats.collectionCount}</p>
                      {stats.topCollections[0] && <p className="text-xs text-muted-foreground mt-1">Top: {stats.topCollections[0].name}</p>}
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

                {/* Genre + Artist distributions */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {stats.topGenres.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm font-medium">Genre Distribution</CardTitle>
                        <CardDescription>{stats.genreCount} unique genres</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <BarList data={stats.topGenres.map((g, i) => ({
                          name: g.name,
                          value: g.value,
                          color: ['#f472b6', '#c084fc', '#60a5fa', '#22d3ee', '#4ade80', '#fb923c', '#f97316', '#ef4444'][i % 8],
                        }))} max={12} />
                      </CardContent>
                    </Card>
                  )}
                  {stats.topArtists.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm font-medium">Artist / Collaborator Rankings</CardTitle>
                        <CardDescription>{stats.artistCount} unique artists</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <BarList data={stats.topArtists.map(a => ({
                          name: a.name, value: a.value, color: '#8b5cf6',
                        }))} max={10} />
                      </CardContent>
                    </Card>
                  )}
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
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Average</span>
                              <span className="font-semibold tabular-nums">{Math.round(stats.avgBpm)} BPM</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Median</span>
                              <span className="font-semibold tabular-nums">{stats.medianBpm} BPM</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Range</span>
                              <span className="font-semibold tabular-nums">{stats.minBpm}–{stats.maxBpm}</span>
                            </div>
                            {stats.modeBpm && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Most Common</span>
                                <span className="font-semibold tabular-nums">{stats.modeBpm.bpm} ({stats.modeBpm.count}x)</span>
                              </div>
                            )}
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
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs text-muted-foreground">{t('stats.keys')}</p>
                            {(stats.majorKeys > 0 || stats.minorKeys > 0) && (
                              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                <span>Major: {stats.majorKeys}</span>
                                <span>Minor: {stats.minorKeys}</span>
                              </div>
                            )}
                          </div>
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
                          <p className="text-xs text-muted-foreground mb-2">{t('stats.tags')} ({stats.tagCount} unique)</p>
                          <div className="flex flex-wrap gap-1.5">
                            {stats.topTags.map(([tag, count]) => (
                              <Badge key={tag} variant="outline" className="tabular-nums">
                                {tag} <span className="ml-1 opacity-60">{count}</span>
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {stats.topCollections.length > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-2">Collections</p>
                          <div className="flex flex-wrap gap-1.5">
                            {stats.topCollections.slice(0, 8).map(c => (
                              <Badge key={c.name} variant="outline" className="tabular-nums">
                                {c.name} <span className="ml-1 opacity-60">{c.value}</span>
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

                {/* Records row */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-amber-500" /> Records & Milestones
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Most Productive Month</p>
                        <p className="font-semibold">{stats.mostProductiveMonth.label}</p>
                        <p className="text-sm text-muted-foreground">{stats.mostProductiveMonth.value} projects</p>
                      </div>
                      {stats.longestProject && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Longest Session</p>
                          <p className="font-semibold truncate">{stats.longestProject.title}</p>
                          <p className="text-sm text-muted-foreground">{formatTime(stats.longestProject.timeSpent || 0)}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Total Shares</p>
                        <p className="font-semibold">{stats.totalShares}</p>
                        <p className="text-sm text-muted-foreground">{stats.projectsShared} projects shared</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Released Tracks</p>
                        <p className="font-semibold">{stats.releasedProjects}</p>
                        <p className="text-sm text-muted-foreground">of {stats.totalProjects} total</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ═══════════════════════════════════════ */}
            {/*  PLUGINS TAB                            */}
            {/* ═══════════════════════════════════════ */}
            <TabsContent value="plugins" className="flex-1 overflow-auto px-6 pb-6">
              <div className="max-w-6xl mx-auto space-y-6">
                {/* Numbers */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
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
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <Star className="w-3.5 h-3.5" /> Presets Used
                      </div>
                      <p className="text-3xl font-semibold tracking-tight">{analysisStats.totalPresets}</p>
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

                {/* Plugin Search + Filter + Sort */}
                <Card>
                  <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <CardTitle className="text-sm font-medium">All Plugins ({filteredPlugins.length})</CardTitle>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="relative w-48">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                          <Input
                            value={pluginSearch}
                            onChange={(e) => setPluginSearch(e.target.value)}
                            placeholder="Search plugins..."
                            className="pl-8 h-8 text-xs"
                          />
                          {pluginSearch && (
                            <button type="button" title="Clear search" onClick={() => setPluginSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                              <X className="w-3 h-3 text-muted-foreground" />
                            </button>
                          )}
                        </div>
                        <div className="flex border rounded-md overflow-hidden">
                          {(['all', 'instrument', 'effect', 'sampler'] as const).map(type => (
                            <button
                              key={type}
                              onClick={() => setPluginTypeFilter(type)}
                              className={cn(
                                "px-2.5 py-1 text-[11px] font-medium transition-colors",
                                pluginTypeFilter === type
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-background hover:bg-muted text-muted-foreground"
                              )}
                            >
                              {type === 'all' ? 'All' : type === 'instrument' ? 'INST' : type === 'effect' ? 'FX' : 'SMP'}
                            </button>
                          ))}
                        </div>
                        <div className="flex border rounded-md overflow-hidden">
                          {(['count', 'name', 'projects'] as const).map(sort => (
                            <button
                              key={sort}
                              onClick={() => setPluginSort(sort)}
                              className={cn(
                                "px-2.5 py-1 text-[11px] font-medium transition-colors",
                                pluginSort === sort
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-background hover:bg-muted text-muted-foreground"
                              )}
                            >
                              {sort === 'count' ? 'Uses' : sort === 'name' ? 'A-Z' : 'Projects'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <CardDescription>Click any plugin to see detailed usage — presets, channels, and projects</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1 max-h-[500px] overflow-y-auto">
                      {filteredPlugins.map((p) => (
                        <div key={p.name}>
                          <button
                            onClick={() => setExpandedPlugin(expandedPlugin === p.name ? null : p.name)}
                            className="w-full flex items-center justify-between text-sm py-2 px-2 rounded-md hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <ChevronRight className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform flex-shrink-0", expandedPlugin === p.name && "rotate-90")} />
                              <Badge variant={p.isSampler ? 'default' : p.isInstrument ? 'secondary' : 'outline'} className="text-[10px] px-1.5 py-0 flex-shrink-0">
                                {p.isSampler ? 'SMP' : p.isInstrument ? 'INST' : 'FX'}
                              </Badge>
                              <span className="truncate font-medium">{p.name}</span>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                              <span className="text-muted-foreground tabular-nums text-xs">{p.count} uses</span>
                              <span className="text-muted-foreground tabular-nums text-xs">{p.projectCount} proj</span>
                            </div>
                          </button>
                          <AnimatePresence>
                            {expandedPlugin === p.name && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <div className="ml-8 mr-2 mb-2 p-3 rounded-lg bg-muted/30 border border-border/30 space-y-3">
                                  <div className="grid grid-cols-3 gap-4 text-xs">
                                    <div>
                                      <p className="text-muted-foreground mb-1">Type</p>
                                      <p className="font-medium">{p.isSampler ? 'Sampler' : p.isInstrument ? 'Instrument' : 'Effect'}</p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground mb-1">Total Instances</p>
                                      <p className="font-medium">{p.count}</p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground mb-1">Avg Per Project</p>
                                      <p className="font-medium">{(p.count / Math.max(p.projectCount, 1)).toFixed(1)}</p>
                                    </div>
                                  </div>
                                  {p.presetList.length > 0 && (
                                    <div>
                                      <p className="text-xs text-muted-foreground mb-1.5">Presets ({p.presetList.length})</p>
                                      <div className="flex flex-wrap gap-1">
                                        {p.presetList.slice(0, 20).map(pr => (
                                          <Badge key={pr} variant="outline" className="text-[10px]">{pr}</Badge>
                                        ))}
                                        {p.presetList.length > 20 && <Badge variant="outline" className="text-[10px]">+{p.presetList.length - 20} more</Badge>}
                                      </div>
                                    </div>
                                  )}
                                  {p.channelList.length > 0 && (
                                    <div>
                                      <p className="text-xs text-muted-foreground mb-1.5">Channel Names ({p.channelList.length})</p>
                                      <div className="flex flex-wrap gap-1">
                                        {p.channelList.slice(0, 15).map(ch => (
                                          <Badge key={ch} variant="secondary" className="text-[10px]">{ch}</Badge>
                                        ))}
                                        {p.channelList.length > 15 && <Badge variant="secondary" className="text-[10px]">+{p.channelList.length - 15} more</Badge>}
                                      </div>
                                    </div>
                                  )}
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-1.5">Used In Projects ({p.projectCount})</p>
                                    <div className="flex flex-wrap gap-1">
                                      {p.projectNames.slice(0, 15).map(name => (
                                        <Badge key={name} variant="outline" className="text-[10px]">{name}</Badge>
                                      ))}
                                      {p.projectNames.length > 15 && <Badge variant="outline" className="text-[10px]">+{p.projectNames.length - 15} more</Badge>}
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ))}
                      {filteredPlugins.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-8">No plugins match your filter</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Rankings side by side */}
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

                {/* Co-occurrence + Mixer effects */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {analysisStats.topCoOccurrence.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <GitBranch className="w-4 h-4" /> Plugin Pairs (Co-occurrence)
                        </CardTitle>
                        <CardDescription>Plugins most frequently used together in the same project</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <BarList data={analysisStats.topCoOccurrence.map(p => ({ name: p.name, value: p.value, color: '#06b6d4' }))} max={10} />
                      </CardContent>
                    </Card>
                  )}

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
              </div>
            </TabsContent>

            {/* ═══════════════════════════════════════ */}
            {/*  PRODUCTION TAB                         */}
            {/* ═══════════════════════════════════════ */}
            <TabsContent value="production" className="flex-1 overflow-auto px-6 pb-6">
              <div className="max-w-6xl mx-auto space-y-6">
                {/* Time stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card><CardContent className="pt-6">
                    <StatNumber label={t('stats.totalTime')} value={formatTime(stats.totalTimeSpent)} sub={t('stats.projectsTracked', { count: String(stats.projectsWithTimeData) })} icon={<Clock className="w-3.5 h-3.5" />} />
                  </CardContent></Card>
                  <Card><CardContent className="pt-6">
                    <StatNumber label={t('stats.avgPerProjectTime')} value={formatTime(stats.avgTimePerProject)} icon={<Clock className="w-3.5 h-3.5" />} />
                  </CardContent></Card>
                  <Card><CardContent className="pt-6">
                    <StatNumber label={t('stats.longestSession')} value={formatTime(stats.maxTimeSpent)} icon={<Clock className="w-3.5 h-3.5" />} />
                  </CardContent></Card>
                  <Card><CardContent className="pt-6">
                    <StatNumber label={t('stats.thisMonth')} value={formatTime(stats.recentTimeSpent)} sub={t('stats.projects', { count: String(stats.recentProjects) })} icon={<Clock className="w-3.5 h-3.5" />} />
                  </CardContent></Card>
                </div>

                {/* Composition stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card><CardContent className="pt-6">
                    <StatNumber label={t('stats.channels')} value={analysisStats.totalChannels} sub={t('stats.avgProjectSuffix', { value: analysisStats.avgChannelsPerProject.toFixed(1) })} icon={<SlidersHorizontal className="w-3.5 h-3.5" />} />
                  </CardContent></Card>
                  <Card><CardContent className="pt-6">
                    <StatNumber label={t('stats.patterns')} value={analysisStats.totalPatterns} sub={t('stats.avgProjectSuffix', { value: analysisStats.avgPatternsPerProject.toFixed(1) })} icon={<Layers className="w-3.5 h-3.5" />} />
                  </CardContent></Card>
                  <Card><CardContent className="pt-6">
                    <StatNumber label={t('stats.mixerInserts')} value={analysisStats.totalMixerTracks} sub={t('stats.avgProjectSuffix', { value: analysisStats.avgMixerTracksPerProject.toFixed(1) })} icon={<Headphones className="w-3.5 h-3.5" />} />
                  </CardContent></Card>
                  <Card><CardContent className="pt-6">
                    <StatNumber label={t('stats.samples')} value={analysisStats.totalSamples} sub={t('stats.avgProjectSuffix', { value: analysisStats.avgSamplesPerProject.toFixed(1) })} icon={<FileAudio className="w-3.5 h-3.5" />} />
                  </CardContent></Card>
                </div>

                {/* Mixer chain analysis */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Mixer Chain Analysis</CardTitle>
                    <CardDescription>How many effects are loaded per mixer insert track</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Total Mixer Effects</p>
                        <p className="text-lg font-semibold">{analysisStats.totalMixerEffects}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Avg Effects / Insert</p>
                        <p className="text-lg font-semibold">{analysisStats.avgEffectsPerMixerTrack.toFixed(1)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Median Effects / Insert</p>
                        <p className="text-lg font-semibold">{analysisStats.medianEffectsPerTrack}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Max on Single Insert</p>
                        <p className="text-lg font-semibold">{analysisStats.maxMixerEffectsOnTrack}</p>
                        {analysisStats.maxMixerEffectsTrackName && (
                          <p className="text-xs text-muted-foreground truncate">{analysisStats.maxMixerEffectsTrackName}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Project Complexity Ranking */}
                {analysisStats.projectComplexity.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Target className="w-4 h-4" /> Project Complexity Rankings
                      </CardTitle>
                      <CardDescription>Projects ranked by total plugins + channels + patterns + mixer tracks + samples</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-left text-muted-foreground">
                              <th className="py-2 pr-4 font-medium">#</th>
                              <th className="py-2 pr-4 font-medium">Project</th>
                              <th className="py-2 pr-4 font-medium text-right">Plugins</th>
                              <th className="py-2 pr-4 font-medium text-right">Channels</th>
                              <th className="py-2 pr-4 font-medium text-right">Patterns</th>
                              <th className="py-2 pr-4 font-medium text-right">Mixer</th>
                              <th className="py-2 pr-4 font-medium text-right">Samples</th>
                              <th className="py-2 pr-4 font-medium text-right">FX Chain</th>
                              <th className="py-2 font-medium text-right">Score</th>
                            </tr>
                          </thead>
                          <tbody>
                            {analysisStats.projectComplexity.slice(0, 20).map((p, i) => (
                              <tr key={p.id} className="border-b border-border/20 hover:bg-muted/30">
                                <td className="py-2 pr-4 tabular-nums text-muted-foreground">{i + 1}</td>
                                <td className="py-2 pr-4 font-medium truncate max-w-[200px]">{p.name}</td>
                                <td className="py-2 pr-4 text-right tabular-nums">{p.plugins}</td>
                                <td className="py-2 pr-4 text-right tabular-nums">{p.channels}</td>
                                <td className="py-2 pr-4 text-right tabular-nums">{p.patterns}</td>
                                <td className="py-2 pr-4 text-right tabular-nums">{p.mixerTracks}</td>
                                <td className="py-2 pr-4 text-right tabular-nums">{p.samples}</td>
                                <td className="py-2 pr-4 text-right tabular-nums">{p.mixerEffects}</td>
                                <td className="py-2 text-right font-semibold tabular-nums">{p.score}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}

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

            {/* ═══════════════════════════════════════ */}
            {/*  TRENDS TAB                             */}
            {/* ═══════════════════════════════════════ */}
            <TabsContent value="trends" className="flex-1 overflow-auto px-6 pb-6">
              <div className="max-w-6xl mx-auto space-y-6">
                {/* Monthly project creation */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Calendar className="w-4 h-4" /> Monthly Project Creation
                    </CardTitle>
                    <CardDescription>Projects created per month over the last 12 months</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <MiniBarChart
                      data={stats.monthlyTrend.map(m => m.value)}
                      labels={stats.monthlyTrend.map(m => m.label)}
                      height={100}
                      color="#3b82f6"
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground mt-2">
                      <span>{stats.monthlyTrend[0]?.label}</span>
                      <span>{stats.monthlyTrend[stats.monthlyTrend.length - 1]?.label}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Weekly trend */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Activity className="w-4 h-4" /> Weekly Trend
                    </CardTitle>
                    <CardDescription>Projects created per week over the last 8 weeks</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <MiniBarChart
                      data={stats.weeklyTrend}
                      labels={stats.weeklyTrend.map((_, i) => `Week ${i + 1}`)}
                      height={80}
                      color="#22c55e"
                    />
                  </CardContent>
                </Card>

                {/* Monthly status breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Monthly Status Breakdown</CardTitle>
                    <CardDescription>How projects created each month are distributed by status</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-muted-foreground">
                            <th className="py-2 pr-4 font-medium">Month</th>
                            <th className="py-2 pr-4 font-medium text-right">Total</th>
                            <th className="py-2 pr-4 font-medium text-right">Completed</th>
                            <th className="py-2 pr-4 font-medium text-right">In Progress</th>
                            <th className="py-2 pr-4 font-medium text-right">Ideas</th>
                            <th className="py-2 font-medium text-right">Completion %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.monthlyStatus.filter(m => m.total > 0).map((m) => (
                            <tr key={m.label} className="border-b border-border/20">
                              <td className="py-2 pr-4 font-medium">{m.label}</td>
                              <td className="py-2 pr-4 text-right tabular-nums">{m.total}</td>
                              <td className="py-2 pr-4 text-right tabular-nums text-emerald-500">{m.completed}</td>
                              <td className="py-2 pr-4 text-right tabular-nums text-blue-500">{m.inProgress}</td>
                              <td className="py-2 pr-4 text-right tabular-nums text-purple-500">{m.idea}</td>
                              <td className="py-2 text-right tabular-nums font-medium">
                                {m.total > 0 ? `${((m.completed / m.total) * 100).toFixed(0)}%` : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {/* All Tags */}
                {stats.allTags.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Hash className="w-4 h-4" /> All Tags ({stats.tagCount})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-1.5">
                        {stats.allTags.map(([tag, count]) => (
                          <Badge key={tag} variant="outline" className="tabular-nums">
                            {tag} <span className="ml-1 opacity-60">{count}</span>
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Full genre + artist + collection breakdowns */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {stats.topGenres.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm font-medium">All Genres ({stats.genreCount})</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <BarList data={stats.topGenres.map((g, i) => ({
                          name: g.name, value: g.value,
                          color: ['#f472b6', '#c084fc', '#60a5fa', '#22d3ee', '#4ade80', '#fb923c'][i % 6],
                        }))} max={50} />
                      </CardContent>
                    </Card>
                  )}
                  {stats.topArtists.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm font-medium">All Artists ({stats.artistCount})</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <BarList data={stats.topArtists.map(a => ({ name: a.name, value: a.value, color: '#8b5cf6' }))} max={50} />
                      </CardContent>
                    </Card>
                  )}
                  {stats.topCollections.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm font-medium">All Collections ({stats.collectionCount})</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <BarList data={stats.topCollections.map(c => ({ name: c.name, value: c.value, color: '#f59e0b' }))} max={50} />
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* ═══════════════════════════════════════ */}
            {/*  EXPLORER TAB                           */}
            {/* ═══════════════════════════════════════ */}
            <TabsContent value="explorer" className="flex-1 overflow-auto px-6 pb-6">
              <div className="max-w-6xl mx-auto space-y-6">
                {/* Search + Category Filter + Sort */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={explorerQuery}
                      onChange={(e) => setExplorerQuery(e.target.value)}
                      placeholder={t('stats.explorerSearch')}
                      className="pl-9 bg-muted/30"
                    />
                    {explorerQuery && (
                      <button type="button" title="Clear search" onClick={() => setExplorerQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                        <X className="w-4 h-4 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex border rounded-md overflow-hidden">
                      {(['all', 'plugins', 'samples', 'packs', 'mixer'] as const).map(cat => (
                        <button
                          key={cat}
                          onClick={() => setExplorerCategory(cat)}
                          className={cn(
                            "px-3 py-1.5 text-xs font-medium transition-colors",
                            explorerCategory === cat
                              ? "bg-primary text-primary-foreground"
                              : "bg-background hover:bg-muted text-muted-foreground"
                          )}
                        >
                          {cat === 'all' ? 'All' : cat === 'plugins' ? 'Plugins' : cat === 'samples' ? 'Samples' : cat === 'packs' ? 'Packs' : 'Mixer FX'}
                        </button>
                      ))}
                    </div>
                    <div className="flex border rounded-md overflow-hidden">
                      {(['count', 'name'] as const).map(sort => (
                        <button
                          key={sort}
                          onClick={() => setExplorerSort(sort)}
                          className={cn(
                            "px-3 py-1.5 text-xs font-medium transition-colors",
                            explorerSort === sort
                              ? "bg-primary text-primary-foreground"
                              : "bg-background hover:bg-muted text-muted-foreground"
                          )}
                        >
                          {sort === 'count' ? 'By Count' : 'A-Z'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {!explorerQuery && <p className="text-sm text-muted-foreground">{t('stats.explorerHint')}</p>}

                {/* Results */}
                {(explorerCategory === 'all' || explorerCategory === 'plugins') && explorerResults.matchedPlugins.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium">
                        {explorerResults.isSearch ? t('stats.pluginsLabel', { count: String(explorerResults.matchedPlugins.length) }) : t('stats.allPlugins', { count: String(explorerResults.matchedPlugins.length) })}
                      </CardTitle>
                      {!explorerResults.isSearch && <CardDescription>{t('stats.everyPlugin')}</CardDescription>}
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 max-h-[400px] overflow-y-auto">
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

                {(explorerCategory === 'all' || explorerCategory === 'samples') && explorerResults.matchedSampleFiles.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium">
                        {explorerResults.isSearch ? `Sample Files (${explorerResults.matchedSampleFiles.length})` : `All Sample Files (${explorerResults.matchedSampleFiles.length})`}
                      </CardTitle>
                      {!explorerResults.isSearch && <CardDescription>Every individual sample file found across your projects</CardDescription>}
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 max-h-[400px] overflow-y-auto">
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

                {(explorerCategory === 'all' || explorerCategory === 'packs') && explorerResults.matchedSamplePacks.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium">
                        {explorerResults.isSearch ? t('stats.samplePacksLabel', { count: String(explorerResults.matchedSamplePacks.length) }) : t('stats.allSamplePacks', { count: String(explorerResults.matchedSamplePacks.length) })}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <BarList data={explorerResults.matchedSamplePacks.map(f => ({ name: f.name, value: f.value, color: '#22c55e' }))} max={100} />
                    </CardContent>
                  </Card>
                )}

                {(explorerCategory === 'all' || explorerCategory === 'mixer') && explorerResults.matchedMixer.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium">
                        {explorerResults.isSearch ? t('stats.mixerEffectsLabel', { count: String(explorerResults.matchedMixer.length) }) : t('stats.allMixerEffects', { count: String(explorerResults.matchedMixer.length) })}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <BarList data={explorerResults.matchedMixer.map(f => ({ name: f.name, value: f.value, color: '#a855f7' }))} max={100} />
                    </CardContent>
                  </Card>
                )}

                {explorerResults.isSearch &&
                  explorerResults.matchedPlugins.length === 0 &&
                  explorerResults.matchedSampleFiles.length === 0 &&
                  explorerResults.matchedSamplePacks.length === 0 &&
                  explorerResults.matchedMixer.length === 0 && (
                    <p className="text-sm text-muted-foreground py-8 text-center">
                      {t('stats.noResults', { query: explorerQuery })}
                    </p>
                  )}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
};
