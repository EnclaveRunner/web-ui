import { PageLayout } from "@/components/PageLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useEffect, useMemo } from "react";
import { getV1Artifact, getV1Task } from "../client";
import { client } from "../client/client.gen";
import type { Task, Artifact } from "../client/types.gen";
import {
  IconCube,
  IconActivity,
  IconCircleCheck,
  IconAlertCircle,
} from "@tabler/icons-react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

/** Returns the ISO date string (YYYY-MM-DD) for a given date */
function toDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Builds a 224 window (13 complete weeks) ending today */
function buildHeatmapData(tasks: Task[]): { day: string; count: number }[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Walk back 90 days
  const days: { day: string; count: number }[] = [];
  
  for (let i = 223; i >= -1; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push({ day: toDay(d), count: 0 });
  }

  const index = new Map(days.map((d) => [d.day, d]));

  for (const task of tasks) {
    // Use whichever timestamp is available — prefer completed_at, fall back to next_process_at
    const raw = task.status.completed_at ?? task.status.next_process_at ?? task.status.last_failed_at;
    if (!raw) continue;
    const d = toDay(new Date(raw));
    const bucket = index.get(d);
    if (bucket) bucket.count++;
  }

  return days;
}

function TaskHeatmap({ data, loading }: { data: { day: string; count: number }[]; loading: boolean }) {
  const max = useMemo(() => Math.max(1, ...data.map((d) => d.count)), [data]);

  // Split into weeks (columns of 7) aligned to Sunday
  const weeks = useMemo(() => {
    if (data.length === 0) return [] as (Array<{ day: string; count: number } | null>)[];
    const first = new Date(data[0].day);
    const sundayIndex = first.getDay(); // Sunday=0 ... Saturday=6
    const padded: Array<{ day: string; count: number } | null> = [
      ...Array.from({ length: sundayIndex }, () => null),
      ...data,
    ];
    while (padded.length % 7 !== 0) padded.push(null);
    const w: Array<Array<{ day: string; count: number } | null>> = [];
    for (let i = 0; i < padded.length; i += 7) w.push(padded.slice(i, i + 7));
    return w;
  }, [data]);

  // Month labels: emit a label when the month changes across weeks
  const monthLabels = useMemo(() => {
    const labels: { col: number; label: string }[] = [];
    let lastMonth = -1;
    weeks.forEach((week, col) => {
      const firstDay = week.find((d) => d !== null);
      if (!firstDay) return;
      const month = new Date(firstDay.day).getMonth();
      if (month !== lastMonth) {
        labels.push({
          col,
          label: new Date(firstDay.day).toLocaleString("default", { month: "short" }),
        });
        lastMonth = month;
      }
    });
    return labels;
  }, [weeks]);

  const dayLabels = ["", "Mon", "", "Wed", "", "Fri", ""];

  function cellColor(count: number): string {
    if (count === 0) return "var(--color-cell-empty)";
    const intensity = count / max;
    if (intensity < 0.25) return "oklch(0.75 0.14 162)";
    if (intensity < 0.5)  return "oklch(0.65 0.18 160)";
    if (intensity < 0.75) return "oklch(0.55 0.20 158)";
    return "oklch(0.45 0.22 155)";
  }

  const CELL = 15;
  const GAP  = 3;
  const STEP = CELL + GAP;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Task in System</CardTitle>
        <p className="text-xs text-muted-foreground">Tasks dispatched per day and still in system — last 6 months</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-24 flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
        ) : (
          <div className="overflow-x-auto">
            <style>{`
              .heatmap-cell-empty { fill: var(--heatmap-empty, oklch(0.92 0.004 286)); }
              .dark .heatmap-cell-empty { fill: var(--heatmap-empty-dark, oklch(0.25 0.006 286)); }
            `}</style>
            <svg
              width={weeks.length * STEP + 28}
              height={7 * STEP + 24}
              style={{ display: "block" }}
            >
              {/* Month labels */}
              {monthLabels.map(({ col, label }) => (
                <text
                  key={label + col}
                  x={28 + col * STEP}
                  y={10}
                  fontSize={10}
                  fill="currentColor"
                  opacity={0.5}
                >
                  {label}
                </text>
              ))}
              {/* Day-of-week labels */}
              {dayLabels.map((lbl, row) =>
                lbl ? (
                  <text
                    key={lbl}
                    x={0}
                    y={18 + row * STEP + CELL * 0.75}
                    fontSize={9}
                    fill="currentColor"
                    opacity={0.45}
                  >
                    {lbl}
                  </text>
                ) : null
              )}
              {/* Cells */}
              {weeks.map((week, col) =>
                week.map((d, row) => {
                  const isEmpty = d === null || d.count === 0;
                  return (
                    <rect
                      key={d ? d.day : `pad-${col}-${row}`}
                      x={28 + col * STEP}
                      y={16 + row * STEP}
                      width={CELL}
                      height={CELL}
                      rx={3}
                      fill={!d || d.count === 0 ? undefined : cellColor(d.count)}
                      className={isEmpty ? "heatmap-cell-empty" : undefined}
                      opacity={isEmpty ? 1 : 0.9}
                    >
                      {d ? (
                        <title>
                          {d.day}: {d.count} task{d.count !== 1 ? "s" : ""}
                        </title>
                      ) : null}
                    </rect>
                  );
                })
              )}
            </svg>
            {/* Legend */}
            <div className="flex items-center gap-1.5 mt-2 justify-end">
              <span className="text-[10px] text-muted-foreground">Less</span>
              {[0, 0.2, 0.5, 0.8, 1].map((v) => (
                <svg key={v} width={CELL} height={CELL}>
                  <rect
                    width={CELL} height={CELL} rx={3}
                    fill={v === 0 ? undefined : cellColor(Math.ceil(v * max))}
                    className={v === 0 ? "heatmap-cell-empty" : undefined}
                  />
                </svg>
              ))}
              <span className="text-[10px] text-muted-foreground">More</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── State donut ──────────────────────────────────────────────────────────────

const STATE_META: Record<string, { label: string; color: string }> = {
  scheduled: { label: "Scheduled", color: "oklch(0.65 0.15 240)" },
  pending:   { label: "Pending",   color: "oklch(0.72 0.16 75)"  },
  active:    { label: "Active",    color: "oklch(0.65 0.18 162)" },
  completed: { label: "Completed", color: "oklch(0.55 0.20 155)" },
  retry:     { label: "Retry",     color: "oklch(0.68 0.18 50)"  },
  archived:  { label: "Archived",  color: "oklch(0.60 0.20 25)"  },
};

function StateDonut({ tasks, loading }: { tasks: Task[]; loading: boolean }) {
  const data = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of tasks) {
      counts[t.status.state] = (counts[t.status.state] ?? 0) + 1;
    }
    return Object.entries(counts)
      .map(([state, value]) => ({
        state,
        value,
        label: STATE_META[state]?.label ?? state,
        color: STATE_META[state]?.color ?? "oklch(0.6 0.1 285)",
      }))
      .sort((a, b) => b.value - a.value);
  }, [tasks]);

  const total = tasks.length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Task State Breakdown</CardTitle>
        <p className="text-xs text-muted-foreground">Distribution across all pipeline stages</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
        ) : total === 0 ? (
          <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No tasks yet</div>
        ) : (
          <div className="flex items-center gap-6">
            <div className="relative flex-shrink-0" style={{ width: 140, height: 140 }}>
              <ResponsiveContainer width={140} height={140}>
                <PieChart>
                  <Pie
                    data={data}
                    cx={65}
                    cy={65}
                    innerRadius={42}
                    outerRadius={62}
                    paddingAngle={data.length > 1 ? 2 : 0}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {data.map((entry) => (
                      <Cell key={entry.state} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, _name, props) => {
                      const v = typeof value === "number" ? value : 0;
                      const label = (props as { payload?: { label?: string } }).payload?.label ?? "";
                      return [`${v} (${((v / total) * 100).toFixed(1)}%)`, label];
                    }}
                    contentStyle={{
                      fontSize: 12,
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Centre label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-bold leading-none">{total}</span>
                <span className="text-[10px] text-muted-foreground mt-0.5">total</span>
              </div>
            </div>
            {/* Legend */}
            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
              {data.map((entry) => (
                <div key={entry.state} className="flex items-center gap-2 text-sm">
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: entry.color }} />
                  <span className="text-muted-foreground truncate flex-1">{entry.label}</span>
                  <span className="font-medium tabular-nums">{entry.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Top artifact sources ─────────────────────────────────────────────────────

/** Extract a short display name from a task source string */
function sourceLabel(source: string): string {
  // Format: namespace:name@hash:... or namespace:name@tag:...
  const match = source.match(/^([^:]+):([^@]+)/);
  if (match) return `${match[1]}/${match[2]}`;
  return source.slice(0, 24);
}

function TopSources({ tasks, artifacts, loading }: { tasks: Task[]; artifacts: Artifact[]; loading: boolean }) {
  const data = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of tasks) {
      const key = sourceLabel(t.source);
      counts[key] = (counts[key] ?? 0) + 1;
    }
    // Include artifacts with 0 tasks so known sources always show
    for (const a of artifacts) {
      const key = `${a.namespace}/${a.name}`;
      if (!(key in counts)) counts[key] = 0;
    }
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [tasks, artifacts]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Top Artifact Sources</CardTitle>
        <p className="text-xs text-muted-foreground">Tasks dispatched per artifact</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
        ) : data.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
        ) : (
          <ResponsiveContainer width="100%" height={data.length * 32 + 24}>
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
              barCategoryGap="25%"
            >
              <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="var(--color-border)" strokeOpacity={0.5} />
              <XAxis
                type="number"
                allowDecimals={false}
                tick={{ fontSize: 11, fill: "currentColor", opacity: 0.5 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={110}
                tick={{ fontSize: 11, fill: "currentColor", opacity: 0.7 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ fill: "var(--color-muted)", opacity: 0.4 }}
                formatter={(v) => [typeof v === "number" ? v : 0, "tasks"]}
                contentStyle={{
                  fontSize: 12,
                  background: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                }}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {data.map((entry, i) => (
                  <Cell
                    key={entry.name}
                    fill={`oklch(${0.60 - i * 0.025} 0.18 ${160 + i * 3})`}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user } = useAuth();
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [taskLoading, setTaskLoading] = useState(true);

  const configureClient = () => {
    const storedCredentials = localStorage.getItem("enclave_credentials");
    if (storedCredentials) {
      client.setConfig({
        baseUrl: "/api",
        headers: { Authorization: `Basic ${storedCredentials}` },
      });
    } else {
      throw new Error("No authentication credentials found");
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        configureClient();

        const artifactResponse = await getV1Artifact();
        if (artifactResponse.data && Array.isArray(artifactResponse.data)) {
          setArtifacts(artifactResponse.data);
        }
        setLoading(false);

        const taskResponse = await getV1Task();
        if (taskResponse.data && Array.isArray(taskResponse.data)) {
          setTasks(taskResponse.data);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
        setTaskLoading(false);
      }
    };
    fetchData();
  }, []);

  const artifactCount  = artifacts.length;
  const totalTasks     = tasks.length;
  const completedTasks = tasks.filter(t => t.status.state === "completed").length;
  const failedTasks    = tasks.filter(t => t.status.state === "archived").length;

  const heatmapData = useMemo(() => buildHeatmapData(tasks), [tasks]);

  return (
    <PageLayout title="Dashboard">
      <h2 className="text-2xl font-bold mb-6">
        Welcome back {user?.displayName}!
      </h2>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Artifacts</CardTitle>
            <IconCube className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "..." : artifactCount.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Available artifacts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
            <IconActivity className="h-5 w-5 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {taskLoading ? "..." : totalTasks.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">All task executions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <IconCircleCheck className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {taskLoading ? "..." : completedTasks.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Successful tasks</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <IconAlertCircle className="h-5 w-5 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {taskLoading ? "..." : failedTasks.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Failed tasks</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
        {/* Heatmap spans 2 columns on large screens */}
        <div className="lg:col-span-2">
          <TaskHeatmap data={heatmapData} loading={taskLoading} />
        </div>
        <StateDonut tasks={tasks} loading={taskLoading} />
      </div>

      <div className="mb-10">
        <TopSources tasks={tasks} artifacts={artifacts} loading={taskLoading || loading} />
      </div>

      <div className="min-h-[30vh] flex flex-col items-center justify-center">
        <div className="text-center">
          <img
            src="/enclave-logo.png"
            alt="Enclave Logo"
            className="h-24 w-auto mx-auto mb-8"
          />
          <h1 className="text-4xl font-bold mb-4">Enclave Console</h1>
          <p className="text-xl text-muted-foreground max-w-2xl">
            Seamlessly execute isolated tasks and workflows with fine-grained
            control over resource access and permissions.
          </p>
        </div>
      </div>
    </PageLayout>
  );
}

