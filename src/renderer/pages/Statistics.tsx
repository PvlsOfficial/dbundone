import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence, useSpring, useTransform } from 'framer-motion';
import {
  BarChart3,
  Clock,
  Music,
  TrendingUp,
  TrendingDown,
  Calendar,
  Tag,
  Archive,
  PlayCircle,
  Target,
  Activity,
  PieChart,
  Timer,
  Star,
  Flame,
  Trophy,
  Sparkles,
  ArrowUp,
  ArrowDown,
  Minus,
  ChevronRight,
  BarChart,
  LineChart,
  RefreshCw,
  Zap,
  Award,
  Crown,
  Rocket,
  Heart,
  CheckCircle2,
  Circle,
  Disc,
  Headphones,
  Mic2,
  Radio,
  Volume2,
  Wand2,
  Layers,
  GitBranch,
  CalendarDays,
  MoreHorizontal
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Project, AppSettings } from '@shared/types';
import { cn } from '@/lib/utils';
import './Statistics.css';

interface StatisticsProps {
  projects: Project[];
  settings: AppSettings;
}

interface FLPMetadata {
  title?: string;
  bpm?: number;
  key?: string;
  length?: number;
  channels?: number;
  patterns?: number;
  created?: string;
  modified?: string;
}

// Animated number counter component
const AnimatedNumber: React.FC<{ value: number; duration?: number; decimals?: number; suffix?: string; prefix?: string }> = ({ 
  value, 
  duration = 1.5, 
  decimals = 0,
  suffix = '',
  prefix = ''
}) => {
  const spring = useSpring(0, { duration: duration * 1000 });
  const display = useTransform(spring, (current) => 
    `${prefix}${current.toFixed(decimals)}${suffix}`
  );
  const [displayValue, setDisplayValue] = useState(`${prefix}0${suffix}`);

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  useEffect(() => {
    return display.on('change', (latest) => {
      setDisplayValue(latest);
    });
  }, [display]);

  return <span className="count-value">{displayValue}</span>;
};

// Progress Ring Component
const ProgressRing: React.FC<{ 
  progress: number; 
  size?: number; 
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
}> = ({ progress, size = 120, strokeWidth = 8, label, sublabel }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="progress-ring">
        <circle
          className="progress-ring-bg"
          strokeWidth={strokeWidth}
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <motion.circle
          className="progress-ring-progress"
          strokeWidth={strokeWidth}
          r={radius}
          cx={size / 2}
          cy={size / 2}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          style={{
            strokeDasharray: circumference,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold">
          <AnimatedNumber value={progress} decimals={0} suffix="%" />
        </span>
        {label && <span className="text-xs text-muted-foreground mt-1">{label}</span>}
      </div>
    </div>
  );
};

// Mini Sparkline Component
const Sparkline: React.FC<{ data: number[]; width?: number; height?: number; color?: string }> = ({ 
  data, 
  width = 80, 
  height = 30,
  color
}) => {
  if (data.length < 2) return null;
  
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  const areaPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id="sparklineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.4" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.polygon
        points={areaPoints}
        className="sparkline-area"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.3 }}
        transition={{ duration: 0.5 }}
      />
      <motion.polyline
        points={points}
        className="sparkline-path"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1, ease: "easeOut" }}
      />
    </svg>
  );
};

// Activity Heatmap Component
const ActivityHeatmap: React.FC<{ projects: Project[] }> = ({ projects }) => {
  const weeks = 12;
  const days = 7;
  
  const { heatmapData, totalActivity, mostActiveDay, currentStreak } = useMemo(() => {
    const data: number[][] = Array(weeks).fill(null).map(() => Array(days).fill(0));
    const now = new Date();
    let total = 0;
    let maxDayValue = 0;
    let maxDayName = '';
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayCounts = [0, 0, 0, 0, 0, 0, 0];
    
    projects.forEach(project => {
      const created = new Date(project.createdAt);
      const diffDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays < weeks * 7 && diffDays >= 0) {
        const weekIndex = weeks - 1 - Math.floor(diffDays / 7);
        const dayIndex = 6 - (diffDays % 7);
        if (weekIndex >= 0 && weekIndex < weeks && dayIndex >= 0 && dayIndex < days) {
          data[weekIndex][dayIndex]++;
          total++;
          dayCounts[dayIndex]++;
        }
      }
    });
    
    // Find most active day of week
    dayCounts.forEach((count, idx) => {
      if (count > maxDayValue) {
        maxDayValue = count;
        maxDayName = dayNames[idx];
      }
    });
    
    // Calculate current streak (consecutive days with activity from today backwards)
    let streak = 0;
    for (let d = 0; d < weeks * 7; d++) {
      const weekIndex = weeks - 1 - Math.floor(d / 7);
      const dayIndex = 6 - (d % 7);
      if (weekIndex >= 0 && data[weekIndex][dayIndex] > 0) {
        streak++;
      } else if (d > 0) {
        break;
      }
    }
    
    return { 
      heatmapData: data, 
      totalActivity: total, 
      mostActiveDay: maxDayName,
      currentStreak: streak
    };
  }, [projects]);

  const maxValue = Math.max(...heatmapData.flat(), 1);

  const getIntensity = (value: number) => {
    if (value === 0) return 'bg-muted/30';
    const intensity = value / maxValue;
    if (intensity <= 0.25) return 'bg-emerald-500/40';
    if (intensity <= 0.5) return 'bg-emerald-500/60';
    if (intensity <= 0.75) return 'bg-emerald-500/80';
    return 'bg-emerald-500';
  };

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  // Generate month labels
  const getMonthLabels = () => {
    const labels: { label: string; weekIndex: number }[] = [];
    const now = new Date();
    let lastMonth = -1;
    
    for (let w = 0; w < weeks; w++) {
      const daysAgo = (weeks - 1 - w) * 7;
      const date = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      const month = date.getMonth();
      
      if (month !== lastMonth) {
        labels.push({
          label: date.toLocaleDateString('en-US', { month: 'short' }),
          weekIndex: w
        });
        lastMonth = month;
      }
    }
    return labels;
  };
  
  const monthLabels = getMonthLabels();

  return (
    <div className="space-y-4">
      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-muted/30 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-primary">{totalActivity}</div>
          <div className="text-xs text-muted-foreground">Projects Created</div>
        </div>
        <div className="bg-muted/30 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-emerald-500">{currentStreak}</div>
          <div className="text-xs text-muted-foreground">Day Streak</div>
        </div>
        <div className="bg-muted/30 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-orange-400">{mostActiveDay || '—'}</div>
          <div className="text-xs text-muted-foreground">Most Active</div>
        </div>
      </div>

      {/* Month labels */}
      <div className="flex items-start gap-2">
        <div className="w-8" /> {/* Spacer for day labels */}
        <div className="flex-1 flex">
          {monthLabels.map((m, idx) => (
            <div 
              key={idx} 
              className="text-xs text-muted-foreground"
              style={{ 
                marginLeft: idx === 0 ? `${m.weekIndex * (100 / weeks)}%` : undefined,
                width: idx < monthLabels.length - 1 
                  ? `${(monthLabels[idx + 1].weekIndex - m.weekIndex) * (100 / weeks)}%`
                  : 'auto'
              }}
            >
              {m.label}
            </div>
          ))}
        </div>
      </div>

      {/* Heatmap */}
      <div className="flex items-start gap-2">
        {/* Day labels */}
        <div className="flex flex-col gap-[3px] w-8">
          {dayLabels.map((day, i) => (
            <div key={day} className="h-4 text-[10px] text-muted-foreground flex items-center justify-end pr-1">
              {i % 2 === 1 ? day : ''}
            </div>
          ))}
        </div>
        
        {/* Heatmap grid */}
        <div className="flex-1 flex gap-[3px]">
          {heatmapData.map((weekData, weekIndex) => (
            <div key={weekIndex} className="flex-1 flex flex-col gap-[3px]">
              {weekData.map((value, dayIndex) => (
                <motion.div
                  key={`${weekIndex}-${dayIndex}`}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: (weekIndex * 7 + dayIndex) * 0.005 }}
                  className={cn(
                    "h-4 w-full rounded-sm cursor-default",
                    getIntensity(value)
                  )}
                  title={`${value} project${value !== 1 ? 's' : ''} created`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      
      {/* Legend */}
      <div className="flex items-center justify-between pt-1">
        <span className="text-xs text-muted-foreground">← 12 weeks ago</span>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Less</span>
          <div className="flex gap-1">
            {['bg-muted/30', 'bg-emerald-500/40', 'bg-emerald-500/60', 'bg-emerald-500/80', 'bg-emerald-500'].map((cls, i) => (
              <div key={i} className={cn("w-3.5 h-3.5 rounded-sm", cls)} />
            ))}
          </div>
          <span>More</span>
        </div>
        <span className="text-xs text-muted-foreground">Today →</span>
      </div>
    </div>
  );
};

// Donut Chart Component
const DonutChart: React.FC<{ 
  data: { name: string; value: number; color: string }[];
  size?: number;
}> = ({ data, size = 160 }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  
  let currentOffset = 0;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        {data.map((item, index) => {
          const percentage = (item.value / total) * 100;
          const strokeDasharray = (percentage / 100) * circumference;
          const strokeDashoffset = -currentOffset;
          currentOffset += strokeDasharray;

          return (
            <motion.circle
              key={item.name}
              className="donut-segment"
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={item.color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              initial={{ strokeDasharray: `0 ${circumference}` }}
              animate={{ strokeDasharray: `${strokeDasharray} ${circumference - strokeDasharray}` }}
              transition={{ duration: 1, delay: index * 0.15, ease: "easeOut" }}
              style={{ strokeDashoffset }}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold">
          <AnimatedNumber value={total} />
        </span>
        <span className="text-xs text-muted-foreground">Total</span>
      </div>
    </div>
  );
};

// Milestone/Achievement Component
const Milestone: React.FC<{
  icon: React.ComponentType<any>;
  title: string;
  description: string;
  unlocked: boolean;
  progress?: number;
}> = ({ icon: Icon, title, description, unlocked, progress }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "milestone-card p-4 rounded-xl border transition-all duration-300",
        unlocked 
          ? "milestone-unlocked border-primary/30" 
          : "border-border/50 opacity-60"
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          "milestone-icon p-2 rounded-lg",
          unlocked ? "bg-primary/20" : "bg-muted/50"
        )}>
          <Icon className={cn("w-5 h-5", unlocked ? "text-primary" : "text-muted-foreground")} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium truncate">{title}</h4>
            {unlocked && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 500 }}
              >
                <CheckCircle2 className="w-4 h-4 text-primary" />
              </motion.div>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          {!unlocked && progress !== undefined && (
            <div className="mt-2">
              <Progress value={progress} className="h-1.5" />
              <span className="text-xs text-muted-foreground mt-1">{progress}%</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// Horizontal Bar Chart Component
const HorizontalBarChart: React.FC<{ 
  data: { name: string; value: number; color?: string }[];
  showPercentage?: boolean;
}> = ({ data, showPercentage = true }) => {
  const maxValue = Math.max(...data.map(d => d.value), 1);
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="space-y-3">
      {data.map((item, index) => {
        const percentage = total > 0 ? (item.value / total) * 100 : 0;
        const widthPercentage = (item.value / maxValue) * 100;
        
        return (
          <motion.div
            key={item.name}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="group"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium truncate flex-1">{item.name}</span>
              <div className="flex items-center gap-2 text-sm">
                <span className="font-semibold">{item.value}</span>
                {showPercentage && (
                  <span className="text-muted-foreground text-xs">
                    ({percentage.toFixed(0)}%)
                  </span>
                )}
              </div>
            </div>
            <div className="relative h-2.5 bg-muted/30 rounded-full overflow-hidden">
              <motion.div
                className="chart-bar absolute inset-y-0 left-0 rounded-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${widthPercentage}%` }}
                transition={{ delay: index * 0.1 + 0.2, duration: 0.8, ease: "easeOut" }}
                style={{ 
                  background: item.color || 'hsl(var(--primary))'
                }}
              />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

// Insight Card Component
const InsightCard: React.FC<{
  icon: React.ComponentType<any>;
  title: string;
  value: string | number;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  description?: string;
}> = ({ icon: Icon, title, value, trend, trendValue, description }) => {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="insight-card p-4 rounded-xl border border-border/50 transition-all duration-300"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className="text-lg font-bold">{value}</p>
          </div>
        </div>
        {trend && (
          <div className={cn(
            "flex items-center gap-1 text-xs font-medium",
            trend === 'up' && "trend-up",
            trend === 'down' && "trend-down",
            trend === 'neutral' && "trend-neutral"
          )}>
            {trend === 'up' && <TrendingUp className="w-3 h-3" />}
            {trend === 'down' && <TrendingDown className="w-3 h-3" />}
            {trend === 'neutral' && <Minus className="w-3 h-3" />}
            {trendValue}
          </div>
        )}
      </div>
      {description && (
        <p className="text-xs text-muted-foreground mt-2">{description}</p>
      )}
    </motion.div>
  );
};

export const Statistics: React.FC<StatisticsProps> = ({ projects, settings }) => {
  const [flpMetadata, setFlpMetadata] = useState<Record<string, FLPMetadata>>({});
  const [activeTab, setActiveTab] = useState('overview');
  const [scanningProgress, setScanningProgress] = useState<{ current: number; total: number; isScanning: boolean }>({
    current: 0,
    total: 0,
    isScanning: false
  });
  const [isDataReady, setIsDataReady] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hoveredStat, setHoveredStat] = useState<string | null>(null);

  // Extract FLP metadata when component mounts - using BATCH mode for speed
  useEffect(() => {
    if (typeof window === 'undefined' ||
        !window.electron ||
        typeof window.electron.extractFlpMetadataBatch !== 'function') {
      // Fallback to old method if batch not available
      if (window.electron?.extractFlpMetadata) {
        // Legacy sequential extraction
        const extractLegacy = async () => {
          const flProjects = projects.filter(p => p.dawType === 'FL Studio' && p.dawProjectPath);
          if (flProjects.length === 0) {
            setIsDataReady(true);
            return;
          }
          setScanningProgress({ current: 0, total: flProjects.length, isScanning: true });
          const metadataMap: Record<string, FLPMetadata> = {};
          for (let i = 0; i < flProjects.length; i++) {
            const project = flProjects[i];
            try {
              const metadata = await window.electron!.extractFlpMetadata(project.dawProjectPath!);
              if (metadata) metadataMap[project.id] = metadata;
            } catch (error) {
              console.error(`Failed to extract metadata for ${project.title}:`, error);
            }
            setScanningProgress(prev => ({ ...prev, current: i + 1 }));
          }
          setFlpMetadata(metadataMap);
          localStorage.setItem('statistics_flp_metadata', JSON.stringify(metadataMap));
          localStorage.setItem('statistics_last_scan', Date.now().toString());
          setScanningProgress(prev => ({ ...prev, isScanning: false }));
          setIsDataReady(true);
        };
        extractLegacy();
      } else {
        setIsDataReady(true);
      }
      return;
    }

    const extractMetadata = async () => {
      const flProjects = projects.filter(p => p.dawType === 'FL Studio' && p.dawProjectPath);

      if (flProjects.length === 0) {
        setIsDataReady(true);
        return;
      }

      const lastScan = localStorage.getItem('statistics_last_scan');
      const now = Date.now();
      const ONE_MINUTE = 60 * 1000;

      // Check cache first
      if (lastScan && (now - parseInt(lastScan)) < ONE_MINUTE) {
        const cachedMetadata = localStorage.getItem('statistics_flp_metadata');
        if (cachedMetadata) {
          try {
            setFlpMetadata(JSON.parse(cachedMetadata));
          } catch (error) {
            console.error('Failed to parse cached metadata:', error);
          }
        }
        setIsDataReady(true);
        return;
      }

      setScanningProgress({ current: 0, total: flProjects.length, isScanning: true });

      try {
        // Use BATCH extraction - single Python process for all files
        const filePaths = flProjects.map(p => p.dawProjectPath!);
        console.log(`[Statistics] Starting batch extraction for ${filePaths.length} files`);
        
        const startTime = performance.now();
        const result = await window.electron!.extractFlpMetadataBatch(filePaths);
        const endTime = performance.now();
        
        console.log(`[Statistics] Batch extraction completed in ${(endTime - startTime).toFixed(0)}ms`);

        if (result.success && result.metadata) {
          // Map file paths back to project IDs
          const metadataMap: Record<string, FLPMetadata> = {};
          for (const project of flProjects) {
            const fileMetadata = result.metadata[project.dawProjectPath!];
            if (fileMetadata) {
              metadataMap[project.id] = fileMetadata;
            }
          }
          
          setFlpMetadata(metadataMap);
          localStorage.setItem('statistics_flp_metadata', JSON.stringify(metadataMap));
          localStorage.setItem('statistics_last_scan', now.toString());
          
          setScanningProgress({ current: flProjects.length, total: flProjects.length, isScanning: false });
        } else {
          console.error('[Statistics] Batch extraction failed:', result.error);
        }
      } catch (error) {
        console.error('[Statistics] Failed to extract batch metadata:', error);
      }
      
      setIsDataReady(true);
    };

    extractMetadata();
  }, [projects]);

  const refreshData = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setIsDataReady(false);

    try {
      const flProjects = projects.filter(p => p.dawType === 'FL Studio' && p.dawProjectPath);

      if (flProjects.length === 0) {
        setIsDataReady(true);
        return;
      }

      setScanningProgress({ current: 0, total: flProjects.length, isScanning: true });

      // Use batch extraction for refresh too
      if (window.electron?.extractFlpMetadataBatch) {
        try {
          const filePaths = flProjects.map(p => p.dawProjectPath!);
          console.log(`[Statistics] Refreshing - batch extraction for ${filePaths.length} files`);
          
          const startTime = performance.now();
          const result = await window.electron.extractFlpMetadataBatch(filePaths);
          const endTime = performance.now();
          
          console.log(`[Statistics] Refresh batch completed in ${(endTime - startTime).toFixed(0)}ms`);

          if (result.success && result.metadata) {
            const metadataMap: Record<string, FLPMetadata> = {};
            for (const project of flProjects) {
              const fileMetadata = result.metadata[project.dawProjectPath!];
              if (fileMetadata) {
                metadataMap[project.id] = fileMetadata;
              }
            }
            
            setFlpMetadata(metadataMap);
            localStorage.setItem('statistics_flp_metadata', JSON.stringify(metadataMap));
            localStorage.setItem('statistics_last_scan', Date.now().toString());
          }
        } catch (error) {
          console.error('[Statistics] Refresh batch extraction failed:', error);
        }
      } else {
        // Fallback to sequential extraction
        const metadataMap: Record<string, FLPMetadata> = {};
        for (let i = 0; i < flProjects.length; i++) {
          const project = flProjects[i];
          try {
            if (!window.electron) continue;
            const metadata = await window.electron.extractFlpMetadata(project.dawProjectPath!);
            if (metadata) {
              metadataMap[project.id] = metadata;
            }
          } catch (error) {
            console.error(`Failed to extract metadata for ${project.title}:`, error);
          }
          setScanningProgress(prev => ({ ...prev, current: i + 1 }));
        }
        setFlpMetadata(metadataMap);
        localStorage.setItem('statistics_flp_metadata', JSON.stringify(metadataMap));
        localStorage.setItem('statistics_last_scan', Date.now().toString());
      }
      
      setScanningProgress(prev => ({ ...prev, isScanning: false }));
      setIsDataReady(true);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Calculate comprehensive statistics
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

    // DAW distribution
    const dawStats = projects.reduce((acc, project) => {
      const daw = project.dawType || 'Unknown';
      acc[daw] = (acc[daw] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Status distribution
    const statusStats = projects.reduce((acc, project) => {
      acc[project.status] = (acc[project.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // BPM ranges - optimized for FL Studio producers (typically 90-200+ BPM)
    const bpmRanges = projects.reduce((acc, project) => {
      if (project.bpm <= 0) return acc;
      if (project.bpm < 90) acc['< 90 BPM']++;
      else if (project.bpm < 120) acc['90-119 BPM']++;
      else if (project.bpm < 140) acc['120-139 BPM']++;
      else if (project.bpm < 160) acc['140-159 BPM']++;
      else if (project.bpm < 180) acc['160-179 BPM']++;
      else acc['180+ BPM']++;
      return acc;
    }, { '< 90 BPM': 0, '90-119 BPM': 0, '120-139 BPM': 0, '140-159 BPM': 0, '160-179 BPM': 0, '180+ BPM': 0 });

    // Key distribution
    const keyStats = projects.reduce((acc, project) => {
      if (project.musicalKey && project.musicalKey !== 'Unknown') {
        acc[project.musicalKey] = (acc[project.musicalKey] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    // Top keys
    const topKeys = Object.entries(keyStats)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    // Time spent statistics
    const projectsWithTimeData = projects.filter(p => p.timeSpent && p.timeSpent > 0);
    const totalTimeSpent = projectsWithTimeData.reduce((sum, p) => sum + (p.timeSpent || 0), 0);
    const avgTimePerProject = projectsWithTimeData.length > 0 ? totalTimeSpent / projectsWithTimeData.length : 0;
    const maxTimeSpent = projectsWithTimeData.length > 0 ? Math.max(...projectsWithTimeData.map(p => p.timeSpent!)) : 0;
    const minTimeSpent = projectsWithTimeData.length > 0 ? Math.min(...projectsWithTimeData.map(p => p.timeSpent!)) : 0;

    // FLP specific stats
    const flpProjects = projects.filter(p => p.dawType === 'FL Studio');
    const flpStats = {
      count: flpProjects.length,
      totalChannels: flpProjects.reduce((sum, p) => sum + (flpMetadata[p.id]?.channels || 0), 0),
      totalPatterns: flpProjects.reduce((sum, p) => sum + (flpMetadata[p.id]?.patterns || 0), 0),
      avgChannelsPerProject: flpProjects.length > 0 ?
        flpProjects.reduce((sum, p) => sum + (flpMetadata[p.id]?.channels || 0), 0) / flpProjects.length : 0,
    };

    // Recent activity (30 days)
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const recentProjects = projects.filter(p => new Date(p.createdAt) > thirtyDaysAgo);
    const weeklyProjects = projects.filter(p => new Date(p.createdAt) > sevenDaysAgo);
    
    const recentProjectsWithTimeData = recentProjects.filter(p => p.timeSpent && p.timeSpent > 0);
    const recentTimeSpent = recentProjectsWithTimeData.reduce((sum, p) => sum + (p.timeSpent || 0), 0);

    // Average BPM
    const projectsWithBpm = projects.filter(p => p.bpm > 0);
    const avgBpm = projectsWithBpm.length > 0 
      ? projectsWithBpm.reduce((sum, p) => sum + p.bpm, 0) / projectsWithBpm.length 
      : 0;

    // Tags analysis
    const tagStats = projects.reduce((acc, project) => {
      project.tags?.forEach(tag => {
        acc[tag] = (acc[tag] || 0) + 1;
      });
      return acc;
    }, {} as Record<string, number>);

    const topTags = Object.entries(tagStats)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8);

    // Productivity score (0-100)
    const completionRate = totalProjects > 0 ? (completedProjects / totalProjects) : 0;
    const activityRate = totalProjects > 0 ? (recentProjects.length / totalProjects) : 0;
    const timeInvestmentRate = projectsWithTimeData.length > 0 ? Math.min(1, avgTimePerProject / 120) : 0;
    
    const productivityScore = Math.min(100, Math.max(0,
      completionRate * 40 +
      activityRate * 30 +
      timeInvestmentRate * 30
    ));

    // Weekly trend data
    const weeklyTrend = Array.from({ length: 8 }, (_, i) => {
      const weekStart = new Date(now.getTime() - (7 - i) * 7 * 24 * 60 * 60 * 1000);
      const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
      return projects.filter(p => {
        const created = new Date(p.createdAt);
        return created >= weekStart && created < weekEnd;
      }).length;
    });

    return {
      totalProjects,
      activeProjects,
      archivedProjects,
      completedProjects,
      releasedProjects,
      inProgressProjects,
      mixingProjects,
      masteringProjects,
      ideaProjects,
      projectsWithTimeData: projectsWithTimeData.length,
      dawStats,
      statusStats,
      bpmRanges,
      keyStats,
      topKeys,
      tagStats,
      topTags,
      totalTimeSpent,
      avgTimePerProject,
      maxTimeSpent,
      minTimeSpent,
      avgBpm,
      flpStats,
      recentProjects: recentProjects.length,
      weeklyProjects: weeklyProjects.length,
      recentTimeSpent,
      productivityScore,
      completionRate: completionRate * 100,
      weeklyTrend,
    };
  }, [projects, flpMetadata]);

  const formatTime = (minutes: number) => {
    if (minutes < 1) return '0m';
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Milestones/Achievements
  const milestones = useMemo(() => [
    {
      icon: Music,
      title: 'First Beat',
      description: 'Create your first project',
      unlocked: stats.totalProjects >= 1,
      progress: Math.min(100, stats.totalProjects * 100),
    },
    {
      icon: Flame,
      title: 'On Fire',
      description: 'Complete 10 projects',
      unlocked: stats.completedProjects >= 10,
      progress: Math.min(100, (stats.completedProjects / 10) * 100),
    },
    {
      icon: Trophy,
      title: 'Prolific Producer',
      description: 'Have 50+ projects',
      unlocked: stats.totalProjects >= 50,
      progress: Math.min(100, (stats.totalProjects / 50) * 100),
    },
    {
      icon: Clock,
      title: 'Time Master',
      description: 'Spend 100+ hours creating',
      unlocked: stats.totalTimeSpent >= 6000,
      progress: Math.min(100, (stats.totalTimeSpent / 6000) * 100),
    },
    {
      icon: Rocket,
      title: 'Release Machine',
      description: 'Release 5 tracks',
      unlocked: stats.releasedProjects >= 5,
      progress: Math.min(100, (stats.releasedProjects / 5) * 100),
    },
    {
      icon: Star,
      title: 'Consistent Creator',
      description: 'Create 4+ projects this week',
      unlocked: stats.weeklyProjects >= 4,
      progress: Math.min(100, (stats.weeklyProjects / 4) * 100),
    },
  ], [stats]);

  // Status chart colors - matching the kanban board columns
  const statusColors: Record<string, string> = {
    'idea': '#c084fc', // purple-400
    'in-progress': '#60a5fa', // blue-400
    'mixing': '#fb923c', // orange-400
    'mastering': '#22d3ee', // cyan-400
    'completed': '#4ade80', // green-400
    'released': '#f472b6', // pink-400
    'archived': '#9ca3af', // gray-400
  };

  const statusChartData = [
    { name: 'Ideas', value: stats.ideaProjects, color: statusColors['idea'] },
    { name: 'In Progress', value: stats.inProgressProjects, color: statusColors['in-progress'] },
    { name: 'Mixing', value: stats.mixingProjects, color: statusColors['mixing'] },
    { name: 'Mastering', value: stats.masteringProjects, color: statusColors['mastering'] },
    { name: 'Completed', value: stats.completedProjects - stats.releasedProjects, color: statusColors['completed'] },
    { name: 'Released', value: stats.releasedProjects, color: statusColors['released'] },
    { name: 'Archived', value: stats.archivedProjects, color: statusColors['archived'] },
  ].filter(d => d.value > 0);

  const dawChartData = Object.entries(stats.dawStats)
    .map(([daw, count]) => ({
      name: daw,
      value: count,
      color: 'hsl(var(--primary))'
    }))
    .sort((a, b) => b.value - a.value);

  const bpmChartData = Object.entries(stats.bpmRanges)
    .map(([range, count]) => ({
      name: range,
      value: count,
    }))
    .filter(d => d.value > 0);

  return (
    <div className="stats-page flex-1 flex flex-col overflow-hidden relative">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-6 py-5 border-b border-border/30 relative z-10"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <BarChart3 className="w-6 h-6 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Statistics</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {['overview', 'production', 'achievements'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200",
                    activeTab === tab 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
            <button
              onClick={refreshData}
              disabled={isRefreshing || scanningProgress.isScanning}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200",
                "bg-muted/50 hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              <RefreshCw className={cn("w-4 h-4", (isRefreshing || scanningProgress.isScanning) && "animate-spin")} />
              Refresh
            </button>
          </div>
        </div>
      </motion.div>

      {/* Content */}
      <div className="stats-content flex-1 overflow-auto p-6 relative z-10">
        <div className="max-w-7xl mx-auto">
          {!isDataReady ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center space-y-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin mx-auto" />
                  <Sparkles className="w-6 h-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <p className="text-muted-foreground">Crunching the numbers...</p>
              </div>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {activeTab === 'overview' && (
                <motion.div
                  key="overview"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6"
                >
                  {/* Hero Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Total Projects */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      whileHover={{ scale: 1.02 }}
                      className="hero-stat-card stat-card-glow rounded-2xl p-6"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="icon-wrapper p-3 rounded-xl bg-primary/20">
                          <Music className="w-6 h-6 text-primary" />
                        </div>
                        <Sparkline data={stats.weeklyTrend} width={60} height={24} />
                      </div>
                      <div className="space-y-1">
                        <div className="text-4xl font-bold">
                          <AnimatedNumber value={stats.totalProjects} />
                        </div>
                        <div className="text-sm font-medium text-muted-foreground">Total Projects</div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-primary">{stats.activeProjects} active</span>
                          <span className="text-muted-foreground">•</span>
                          <span className="text-muted-foreground">{stats.archivedProjects} archived</span>
                        </div>
                      </div>
                    </motion.div>

                    {/* Completion Rate */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      whileHover={{ scale: 1.02 }}
                      className="stat-card-glow rounded-2xl p-6 border border-border/50 bg-card"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Target className="w-5 h-5 text-muted-foreground" />
                            <span className="text-sm font-medium text-muted-foreground">Completion Rate</span>
                          </div>
                          <div className="text-3xl font-bold">
                            <AnimatedNumber value={stats.completionRate} decimals={1} suffix="%" />
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {stats.completedProjects} of {stats.totalProjects} completed
                          </div>
                        </div>
                        <ProgressRing progress={stats.completionRate} size={80} strokeWidth={6} />
                      </div>
                    </motion.div>

                    {/* Time Invested */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      whileHover={{ scale: 1.02 }}
                      className="stat-card-glow rounded-2xl p-6 border border-border/50 bg-card"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="icon-wrapper p-3 rounded-xl bg-primary/20">
                          <Clock className="w-6 h-6 text-primary" />
                        </div>
                        {stats.recentTimeSpent > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            +{formatTime(stats.recentTimeSpent)} this month
                          </Badge>
                        )}
                      </div>
                      <div className="space-y-1">
                        <div className="text-3xl font-bold">{formatTime(stats.totalTimeSpent)}</div>
                        <div className="text-sm font-medium text-muted-foreground">Time Invested</div>
                        <div className="text-xs text-muted-foreground">
                          Avg: {formatTime(stats.avgTimePerProject)} per project
                        </div>
                      </div>
                    </motion.div>

                    {/* Productivity Score */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                      whileHover={{ scale: 1.02 }}
                      className="stat-card-glow rounded-2xl p-6 border border-border/50 bg-card"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Zap className="w-5 h-5 text-primary" />
                            <span className="text-sm font-medium text-muted-foreground">Productivity</span>
                          </div>
                          <div className="text-3xl font-bold">
                            <AnimatedNumber value={stats.productivityScore} decimals={0} />
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Score out of 100
                          </div>
                        </div>
                        <ProgressRing 
                          progress={stats.productivityScore} 
                          size={80} 
                          strokeWidth={6}
                        />
                      </div>
                    </motion.div>
                  </div>

                  {/* Quick Stats Row */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="flex flex-wrap gap-3"
                  >
                    <div className="quick-stat-pill">
                      <Calendar className="w-4 h-4 text-primary" />
                      <span><strong>{stats.recentProjects}</strong> projects this month</span>
                    </div>
                    <div className="quick-stat-pill">
                      <Activity className="w-4 h-4 text-primary/80" />
                      <span>Avg <strong>{Math.round(stats.avgBpm)}</strong> BPM</span>
                    </div>
                    <div className="quick-stat-pill">
                      <Layers className="w-4 h-4 text-primary/70" />
                      <span><strong>{Object.keys(stats.dawStats).length}</strong> DAWs used</span>
                    </div>
                    <div className="quick-stat-pill">
                      <Tag className="w-4 h-4 text-primary/60" />
                      <span><strong>{Object.keys(stats.tagStats).length}</strong> unique tags</span>
                    </div>
                  </motion.div>

                  {/* Charts Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Project Status */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.6 }}
                    >
                      <Card className="border-border/50">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <PieChart className="w-5 h-5 text-primary" />
                            Project Status
                          </CardTitle>
                          <CardDescription>Distribution by workflow stage</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center justify-center gap-8">
                            <DonutChart data={statusChartData} size={160} />
                            <div className="space-y-2 min-w-[160px]">
                              {statusChartData.map((item, index) => {
                                const total = statusChartData.reduce((sum, d) => sum + d.value, 0);
                                const percentage = total > 0 ? ((item.value / total) * 100).toFixed(0) : 0;
                                return (
                                  <motion.div
                                    key={item.name}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.8 + index * 0.1 }}
                                    className="flex items-center gap-2"
                                  >
                                    <div 
                                      className="w-3 h-3 rounded-full flex-shrink-0" 
                                      style={{ backgroundColor: item.color }}
                                    />
                                    <span className="text-sm truncate flex-1">{item.name}</span>
                                    <span className="text-sm font-semibold tabular-nums">{item.value}</span>
                                    <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">({percentage}%)</span>
                                  </motion.div>
                                );
                              })}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>

                    {/* DAW Usage */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.7 }}
                    >
                      <Card className="border-border/50">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Headphones className="w-5 h-5 text-primary" />
                            DAW Usage
                          </CardTitle>
                          <CardDescription>Projects by digital audio workstation</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <HorizontalBarChart data={dawChartData} />
                        </CardContent>
                      </Card>
                    </motion.div>
                  </div>

                  {/* Activity Heatmap & BPM */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Activity Heatmap */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.8 }}
                    >
                      <Card className="border-border/50">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <CalendarDays className="w-5 h-5 text-primary" />
                            Activity
                          </CardTitle>
                          <CardDescription>Project creation over the last 12 weeks</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <ActivityHeatmap projects={projects} />
                        </CardContent>
                      </Card>
                    </motion.div>

                    {/* Tempo Distribution */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.9 }}
                    >
                      <Card className="border-border/50">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Activity className="w-5 h-5 text-primary" />
                            Tempo Distribution
                          </CardTitle>
                          <CardDescription>Projects grouped by BPM range</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <HorizontalBarChart data={bpmChartData} />
                        </CardContent>
                      </Card>
                    </motion.div>
                  </div>

                  {/* Top Tags */}
                  {stats.topTags.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 1 }}
                    >
                      <Card className="border-border/50">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Tag className="w-5 h-5 text-primary" />
                            Top Tags
                          </CardTitle>
                          <CardDescription>Most used tags across your projects</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="flex flex-wrap gap-2">
                            {stats.topTags.map(([tag, count], index) => (
                              <motion.div
                                key={tag}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 1.1 + index * 0.05 }}
                              >
                                <Badge 
                                  variant="secondary" 
                                  className="px-3 py-1.5 text-sm hover:bg-primary/20 transition-colors cursor-default"
                                >
                                  {tag}
                                  <span className="ml-2 opacity-60">{count}</span>
                                </Badge>
                              </motion.div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}
                </motion.div>
              )}

              {activeTab === 'production' && (
                <motion.div
                  key="production"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6"
                >
                  {/* Time Analytics */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <InsightCard
                      icon={Clock}
                      title="Total Time"
                      value={formatTime(stats.totalTimeSpent)}
                      description={`Across ${stats.projectsWithTimeData} projects with time data`}
                    />
                    <InsightCard
                      icon={Timer}
                      title="Average Session"
                      value={formatTime(stats.avgTimePerProject)}
                      description="Average time per project"
                    />
                    <InsightCard
                      icon={TrendingUp}
                      title="Longest Session"
                      value={formatTime(stats.maxTimeSpent)}
                      description="Most time on a single project"
                    />
                    <InsightCard
                      icon={Zap}
                      title="Quick Wins"
                      value={formatTime(stats.minTimeSpent)}
                      description="Fastest project completion"
                    />
                  </div>

                  {/* FL Studio Stats */}
                  {stats.flpStats.count > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                    >
                      <Card className="border-border/50 overflow-hidden">
                        <div className="bg-gradient-to-r from-primary/10 to-transparent p-1" />
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <div className="p-2 rounded-lg bg-primary/20">
                              <Disc className="w-5 h-5 text-primary" />
                            </div>
                            FL Studio Analytics
                          </CardTitle>
                          <CardDescription>Deep insights from your FL Studio projects</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            <div className="text-center p-4 rounded-xl bg-muted/30">
                              <div className="text-3xl font-bold text-primary">
                                <AnimatedNumber value={stats.flpStats.count} />
                              </div>
                              <div className="text-sm text-muted-foreground mt-1">Projects</div>
                            </div>
                            <div className="text-center p-4 rounded-xl bg-muted/30">
                              <div className="text-3xl font-bold">
                                <AnimatedNumber value={stats.flpStats.totalChannels} />
                              </div>
                              <div className="text-sm text-muted-foreground mt-1">Total Channels</div>
                            </div>
                            <div className="text-center p-4 rounded-xl bg-muted/30">
                              <div className="text-3xl font-bold">
                                <AnimatedNumber value={stats.flpStats.totalPatterns} />
                              </div>
                              <div className="text-sm text-muted-foreground mt-1">Total Patterns</div>
                            </div>
                            <div className="text-center p-4 rounded-xl bg-muted/30">
                              <div className="text-3xl font-bold">
                                <AnimatedNumber value={Math.round(stats.flpStats.avgChannelsPerProject)} />
                              </div>
                              <div className="text-sm text-muted-foreground mt-1">Avg Channels</div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}

                  {/* Musical Keys */}
                  {stats.topKeys.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                    >
                      <Card className="border-border/50">
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Radio className="w-5 h-5 text-primary" />
                            Favorite Keys
                          </CardTitle>
                          <CardDescription>Your most used musical keys</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="flex flex-wrap gap-3">
                            {stats.topKeys.map(([key, count], index) => (
                              <motion.div
                                key={key}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.4 + index * 0.1 }}
                                className="relative group"
                              >
                                <div className="px-4 py-3 rounded-xl bg-muted/50 border border-border/50 group-hover:border-primary/50 transition-colors">
                                  <div className="text-lg font-bold">{key}</div>
                                  <div className="text-xs text-muted-foreground">{count} projects</div>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}

                  {/* Recent Activity Summary */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                  >
                    <Card className="border-border/50">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Activity className="w-5 h-5 text-primary" />
                          Recent Activity
                        </CardTitle>
                        <CardDescription>Your productivity over the last 30 days</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-transparent border border-primary/20">
                            <div className="flex items-center gap-2 mb-2">
                              <Music className="w-4 h-4 text-primary" />
                              <span className="text-sm text-muted-foreground">New Projects</span>
                            </div>
                            <div className="text-2xl font-bold">{stats.recentProjects}</div>
                          </div>
                          <div className="p-4 rounded-xl bg-gradient-to-br from-primary/15 to-transparent border border-primary/20">
                            <div className="flex items-center gap-2 mb-2">
                              <Clock className="w-4 h-4 text-primary/80" />
                              <span className="text-sm text-muted-foreground">Time Invested</span>
                            </div>
                            <div className="text-2xl font-bold">{formatTime(stats.recentTimeSpent)}</div>
                          </div>
                          <div className="p-4 rounded-xl bg-gradient-to-br from-primary/20 to-transparent border border-primary/20">
                            <div className="flex items-center gap-2 mb-2">
                              <Flame className="w-4 h-4 text-primary/70" />
                              <span className="text-sm text-muted-foreground">This Week</span>
                            </div>
                            <div className="text-2xl font-bold">{stats.weeklyProjects}</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </motion.div>
              )}

              {activeTab === 'achievements' && (
                <motion.div
                  key="achievements"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6"
                >
                  {/* Achievement Progress */}
                  <div className="text-center mb-8">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 200 }}
                      className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 border-2 border-primary/30 mb-4"
                    >
                      <Trophy className="w-10 h-10 text-primary" />
                    </motion.div>
                    <h2 className="text-2xl font-bold mb-2">
                      {milestones.filter(m => m.unlocked).length} / {milestones.length} Unlocked
                    </h2>
                    <p className="text-muted-foreground">Keep creating to unlock more achievements!</p>
                  </div>

                  {/* Milestones Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {milestones.map((milestone, index) => (
                      <motion.div
                        key={milestone.title}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        <Milestone {...milestone} />
                      </motion.div>
                    ))}
                  </div>

                  {/* Stats Summary */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                  >
                    <Card className="border-border/50">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Star className="w-5 h-5 text-primary" />
                          Your Journey
                        </CardTitle>
                        <CardDescription>A summary of your production milestones</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="text-center p-4 rounded-xl bg-muted/30">
                            <div className="text-2xl font-bold text-primary">
                              <AnimatedNumber value={stats.totalProjects} />
                            </div>
                            <div className="text-sm text-muted-foreground">Total Projects</div>
                          </div>
                          <div className="text-center p-4 rounded-xl bg-muted/30">
                            <div className="text-2xl font-bold text-primary/90">
                              <AnimatedNumber value={stats.completedProjects} />
                            </div>
                            <div className="text-sm text-muted-foreground">Completed</div>
                          </div>
                          <div className="text-center p-4 rounded-xl bg-muted/30">
                            <div className="text-2xl font-bold text-primary/80">
                              <AnimatedNumber value={stats.releasedProjects} />
                            </div>
                            <div className="text-sm text-muted-foreground">Released</div>
                          </div>
                          <div className="text-center p-4 rounded-xl bg-muted/30">
                            <div className="text-2xl font-bold text-primary/70">
                              {formatTime(stats.totalTimeSpent)}
                            </div>
                            <div className="text-sm text-muted-foreground">Hours Invested</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
};
