import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchMetrics } from '@/services/analytics';
import { Loader2, BarChart3, Users, Wand2, Calendar, AlertCircle, Globe, Sliders, Zap, ChevronDown } from 'lucide-react';


interface FeatureAdoption {
  collectionMode: number;
  hyperFocus: number;
  tinyLeaders: number;
  hasPriceLimit: number;
  hasBudgetLimit: number;
  hasMusts: number;
  hasBans: number;
  deckCount: number;
}

interface MetricsSummary {
  totalEvents: number;
  uniqueUserCount: number;
  eventCounts: Record<string, number>;
  commanderCounts: Record<string, number>;
  themeCounts: Record<string, number>;
  dailyCounts: Record<string, number>;
  dailyBreakdown: Record<string, Record<string, number>>;
  dailyUniqueUsers: Record<string, number>;
  regionCounts: Record<string, number>;
  featureAdoption: FeatureAdoption;
  settingsCounts: Record<string, Record<string, number>>;
  dateRange: { from: string; to: string };
}

const DAY_OPTIONS = [
  { label: '7d', value: 7 },
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
];

const EVENT_LABELS: Record<string, string> = {
  page_viewed: 'Page Views',
  commander_searched: 'Commander Searches',
  commander_selected: 'Commander Selections',
  deck_generated: 'Decks Generated',
  deck_exported: 'Deck Exports',
  deck_generation_failed: 'Generation Failures',
  theme_toggled: 'Theme Toggles',
  combos_viewed: 'Combos Viewed',
  collection_imported: 'Collection Imports',
};

const REGION_FLAGS: Record<string, string> = {
  Americas: '🌎',
  Europe: '🌍',
  Asia: '🌏',
  Oceania: '🌏',
  Africa: '🌍',
  Other: '🌐',
};

const SETTING_LOGICAL_ORDER: Record<string, string[]> = {
  bracketLevel: ['all', '1', '2', '3', '4', '5'],
  comboPreference: ['None', 'A Few', 'Many'],
  maxRarity: ['common', 'uncommon', 'rare', 'none'],
  deckFormat: ['Commander', 'Brawl', 'Custom'],
  landCount: ['≤33 (Aggro)', '34-36', '37 (Standard)', '38-40', '41+ (Control)'],
};

const SETTINGS_PANELS = [
  { key: 'deckFormat', label: 'Deck Format' },
  { key: 'bracketLevel', label: 'Bracket Level' },
  { key: 'comboPreference', label: 'Combo Preference' },
  { key: 'gameChangerLimit', label: 'Game Changers' },
  { key: 'budgetOption', label: 'EDHREC Card Pool' },
  { key: 'deckBudget', label: 'Deck Budget' },
  { key: 'maxCardPrice', label: 'Max Card Price' },
  { key: 'maxRarity', label: 'Max Rarity' },
  { key: 'landCount', label: 'Land Count' },
];

function parseDollarValue(s: string): number {
  if (s === 'None') return -1;
  const m = s.match(/^\$(\d+(?:\.\d+)?)$/);
  return m ? parseFloat(m[1]) : Infinity;
}

function sortSettingEntries(key: string, entries: [string, number][]): [string, number][] {
  const order = SETTING_LOGICAL_ORDER[key];
  if (order) {
    return [...entries].sort(([a], [b]) => {
      const ai = order.indexOf(a);
      const bi = order.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return 0;
    });
  }
  if (key === 'deckBudget' || key === 'maxCardPrice') {
    return [...entries].sort(([a], [b]) => parseDollarValue(a) - parseDollarValue(b));
  }
  if (key === 'gameChangerLimit') {
    const numerics = entries
      .filter(([k]) => k !== 'none' && k !== 'unlimited' && !isNaN(Number(k)))
      .map(([k]) => k)
      .sort((a, b) => Number(a) - Number(b));
    const fullOrder = ['none', ...numerics, 'unlimited'];
    return [...entries].sort(([a], [b]) => {
      const ai = fullOrder.indexOf(a);
      const bi = fullOrder.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      return 0;
    });
  }
  return [...entries].sort(([, a], [, b]) => b - a);
}

function pct(n: number, total: number) {
  if (!total) return '0%';
  return `${Math.round((n / total) * 100)}%`;
}

function BarRow({
  label,
  count,
  max,
  total,
}: {
  label: string;
  count: number;
  max: number;
  total?: number;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="leading-tight">{label}</span>
        <span className="tabular-nums shrink-0 ml-3">
          {count.toLocaleString()}
          {total !== undefined && total > 0 && (
            <span className="text-xs text-muted-foreground ml-1">({pct(count, total)})</span>
          )}
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-300"
          style={{ width: max > 0 ? `${(count / max) * 100}%` : '0%' }}
        />
      </div>
    </div>
  );
}

export function MetricsPage() {
  if (window.location.hostname !== 'localhost') return null;

  const [data, setData] = useState<MetricsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [dailyMetric, setDailyMetric] = useState<string>('total');
  const [showAllThemes, setShowAllThemes] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
        const result = await fetchMetrics({ from }) as unknown as MetricsSummary;
        if (!cancelled) setData(result);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load metrics');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [days]);

  const deckCount = data?.eventCounts?.deck_generated ?? 0;
  const uniqueCommanders = data ? Object.keys(data.commanderCounts).length : 0;

  const sortedEvents = data
    ? Object.entries(data.eventCounts).sort(([, a], [, b]) => b - a)
    : [];

  const sortedCommanders = data
    ? Object.entries(data.commanderCounts).sort(([, a], [, b]) => b - a).slice(0, 50)
    : [];

  const sortedThemes = data
    ? Object.entries(data.themeCounts ?? {}).sort(([, a], [, b]) => b - a)
    : [];
  const visibleThemes = showAllThemes ? sortedThemes : sortedThemes.slice(0, 15);
  const maxThemeCount = sortedThemes.length > 0 ? sortedThemes[0][1] : 1;

  const DAILY_METRICS = [
    { key: 'total', label: 'All Events' },
    { key: 'unique_users', label: 'Unique Users' },
    { key: 'deck_generated', label: 'Decks' },
    { key: 'page_viewed', label: 'Page Views' },
    { key: 'commander_searched', label: 'Searches' },
  ];

  const allDays = data ? Object.keys(data.dailyCounts).sort() : [];
  const sortedDays: [string, number][] = allDays.map(day => {
    let val = 0;
    if (dailyMetric === 'total') val = data?.dailyCounts[day] ?? 0;
    else if (dailyMetric === 'unique_users') val = data?.dailyUniqueUsers?.[day] ?? 0;
    else val = data?.dailyBreakdown?.[day]?.[dailyMetric] ?? 0;
    return [day, val];
  });
  const maxDailyCount = sortedDays.length > 0 ? Math.max(...sortedDays.map(([, v]) => v), 1) : 1;

  const sortedRegions = data
    ? Object.entries(data.regionCounts ?? {}).sort(([, a], [, b]) => b - a)
    : [];
  const maxRegionCount = sortedRegions.length > 0 ? sortedRegions[0][1] : 1;

  const fa = data?.featureAdoption;
  const featureRows = fa && fa.deckCount > 0 ? [
    { label: 'Collection Mode', count: fa.collectionMode },
    { label: 'Per-Card Price Cap', count: fa.hasPriceLimit },
    { label: 'Total Budget Limit', count: fa.hasBudgetLimit },
    { label: 'Must-Include Cards', count: fa.hasMusts },
    { label: 'Banned Cards', count: fa.hasBans },
    { label: 'Hyper Focus', count: fa.hyperFocus },
    { label: 'Tiny Leaders', count: fa.tinyLeaders },
  ].sort((a, b) => b.count - a.count) : [];

  const sc = data?.settingsCounts;

  return (
    <main className="flex-1 container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">Metrics Dashboard</h1>
          <span className="text-xs text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">
            Dev Only
          </span>
        </div>
        <div className="flex gap-1 bg-accent/50 rounded-lg p-1">
          {DAY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setDays(opt.value)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                days === opt.value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
          <p className="text-muted-foreground text-sm">Loading metrics...</p>
        </div>
      )}

      {error && (
        <div className="flex flex-col items-center justify-center py-20">
          <AlertCircle className="w-8 h-8 text-destructive mb-3" />
          <p className="text-destructive text-sm font-medium">{error}</p>
          <p className="text-muted-foreground text-xs mt-1">
            Make sure VITE_ANALYTICS_URL is set and the Lambda is deployed.
          </p>
        </div>
      )}

      {data && !loading && (
        <div className="space-y-6">

          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-4">
            <Card className="bg-card/80 backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{data.totalEvents.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Total Events</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/80 backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                    <Wand2 className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{deckCount.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Decks Generated</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/80 backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <Users className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{(data.uniqueUserCount ?? 0).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Unique Users</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/80 backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-violet-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{uniqueCommanders.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Unique Commanders</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Row: Event Breakdown + Most Built Commanders */}
          <div className="grid md:grid-cols-2 gap-6 items-start">
            <Card className="bg-card/80 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Event Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {sortedEvents.map(([event, count]) => (
                    <div key={event} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {EVENT_LABELS[event] ?? event}
                      </span>
                      <span className="font-medium tabular-nums">{count.toLocaleString()}</span>
                    </div>
                  ))}
                  {sortedEvents.length === 0 && (
                    <p className="text-sm text-muted-foreground">No events recorded</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/80 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Most Built Commanders
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {uniqueCommanders} unique
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {sortedCommanders.map(([name, count], i) => (
                    <div key={name} className="flex items-center gap-2 text-sm">
                      <span className="text-xs text-muted-foreground w-5 text-right">{i + 1}.</span>
                      <span className="flex-1 truncate">{name}</span>
                      <span className="font-medium tabular-nums text-muted-foreground">{count}</span>
                    </div>
                  ))}
                  {sortedCommanders.length === 0 && (
                    <p className="text-sm text-muted-foreground">No commander data yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Row: Regions + Feature Adoption */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="bg-card/80 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  Regions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {sortedRegions.map(([region, count]) => (
                    <BarRow
                      key={region}
                      label={`${REGION_FLAGS[region] ?? '🌐'} ${region}`}
                      count={count}
                      max={maxRegionCount}
                    />
                  ))}
                  {sortedRegions.length === 0 && (
                    <p className="text-sm text-muted-foreground">No region data yet</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/80 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Feature Adoption
                  {fa && fa.deckCount > 0 && (
                    <span className="text-xs font-normal text-muted-foreground ml-1">
                      of {fa.deckCount.toLocaleString()} decks
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {featureRows.map(({ label, count }) => (
                    <BarRow
                      key={label}
                      label={label}
                      count={count}
                      max={fa!.deckCount}
                      total={fa!.deckCount}
                    />
                  ))}
                  {featureRows.length === 0 && (
                    <p className="text-sm text-muted-foreground">No deck data yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Daily Activity — full width */}
          <Card className="bg-card/80 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Daily Activity</CardTitle>
                <div className="flex gap-1 bg-accent/50 rounded-md p-0.5">
                  {DAILY_METRICS.map(m => (
                    <button
                      key={m.key}
                      onClick={() => setDailyMetric(m.key)}
                      className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                        dailyMetric === m.key
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {sortedDays.length > 0 && sortedDays.some(([, v]) => v > 0) ? (
                <div className="flex items-end gap-[2px] h-40">
                  {sortedDays.map(([day, count]) => (
                    <div
                      key={day}
                      className="flex-1 bg-primary/80 rounded-t-sm hover:bg-primary transition-colors group relative"
                      style={{
                        height: `${Math.max((count / maxDailyCount) * 100, count > 0 ? 0.5 : 0)}%`,
                        minHeight: count > 0 ? 3 : 0,
                      }}
                      title={`${day}: ${count}`}
                    >
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-popover border border-border text-[10px] px-1.5 py-0.5 rounded shadow-sm opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none z-10">
                        <span className="font-medium">{count}</span>
                        <span className="text-muted-foreground ml-1">{day.slice(5)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-40 flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">No data yet for this metric</p>
                </div>
              )}
              {sortedDays.length > 0 && (
                <div className="flex justify-between text-[10px] text-muted-foreground mt-2">
                  <span>{sortedDays[0]?.[0]}</span>
                  {sortedDays.length > 4 && (
                    <span>{sortedDays[Math.floor(sortedDays.length / 2)]?.[0]}</span>
                  )}
                  <span>{sortedDays[sortedDays.length - 1]?.[0]}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Settings Distribution — full width */}
          {sc && (
            <Card className="bg-card/80 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sliders className="w-4 h-4" />
                  Settings Distribution
                  {fa && fa.deckCount > 0 && (
                    <span className="text-xs font-normal text-muted-foreground ml-1">
                      % of {fa.deckCount.toLocaleString()} decks
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {SETTINGS_PANELS.map(({ key, label }) => {
                    const raw = Object.entries(sc[key] ?? {});
                    const entries = sortSettingEntries(key, raw);
                    const maxVal = entries.length > 0 ? Math.max(...entries.map(([, v]) => v)) : 1;
                    const total = fa && fa.deckCount > 0 ? fa.deckCount : undefined;
                    return (
                      <div key={key} className="bg-muted/30 rounded-lg p-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                          {label}
                        </p>
                        <div className="space-y-2">
                          {entries.map(([val, count]) => (
                            <BarRow key={val} label={val} count={count} max={maxVal} total={total} />
                          ))}
                          {entries.length === 0 && (
                            <p className="text-xs text-muted-foreground">No data yet</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Theme Distribution — full width, collapsible */}
          <Card className="bg-card/80 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Theme Distribution
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {sortedThemes.length} themes
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sortedThemes.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {visibleThemes.map(([theme, count]) => (
                      <div key={theme} className="bg-muted/30 rounded-lg px-3 py-2">
                        <BarRow label={theme} count={count} max={maxThemeCount} />
                      </div>
                    ))}
                  </div>
                  {sortedThemes.length > 15 && (
                    <button
                      onClick={() => setShowAllThemes(v => !v)}
                      className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ChevronDown
                        className={`w-3.5 h-3.5 transition-transform duration-200 ${showAllThemes ? 'rotate-180' : ''}`}
                      />
                      {showAllThemes
                        ? 'Show less'
                        : `Show all ${sortedThemes.length} themes`}
                    </button>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No theme data yet</p>
              )}
            </CardContent>
          </Card>

        </div>
      )}
    </main>
  );
}
