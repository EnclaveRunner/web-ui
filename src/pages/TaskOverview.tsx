import { PageLayout } from "@/components/PageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState, useEffect, useCallback } from "react";
import { getV1Task, getV1TaskByIdLogs } from "../client";
import { client } from "../client/client.gen";
import type { Task, TaskLog } from "../client/types.gen";
import {
  IconActivity,
  IconAlertCircle,
  IconCircleCheck,
  IconClock,
  IconCpu,
  IconDatabase,
  IconLockAccess,
  IconPlayerPlay,
  IconRefresh,
  IconRotate,
  IconTerminal,
  IconDownload,
} from "@tabler/icons-react";

const TASK_STAGES: { [key: string]: { name: string; color: string; icon: React.ReactNode; iconColor: string } } = {
  scheduled: {
    name: 'Scheduled',
    color: 'border-l-4 border-l-blue-500 bg-blue-50 dark:bg-blue-950/30',
    iconColor: 'text-blue-500',
    icon: <IconClock className="h-4 w-4 text-blue-500" />
  },
  pending: {
    name: 'Pending',
    color: 'border-l-4 border-l-amber-500 bg-amber-50 dark:bg-amber-950/30',
    iconColor: 'text-amber-500',
    icon: <IconCpu className="h-4 w-4 text-amber-500" />
  },
  active: {
    name: 'Active',
    color: 'border-l-4 border-l-green-500 bg-green-50 dark:bg-green-950/30',
    iconColor: 'text-green-500',
    icon: <IconPlayerPlay className="h-4 w-4 text-green-500 animate-pulse" />
  },
  completed: {
    name: 'Completed',
    color: 'border-l-4 border-l-emerald-500 bg-emerald-50 dark:bg-emerald-950/30',
    iconColor: 'text-emerald-500',
    icon: <IconCircleCheck className="h-4 w-4 text-emerald-500" />
  },
  retry: {
    name: 'Retry',
    color: 'border-l-4 border-l-orange-500 bg-orange-50 dark:bg-orange-950/30',
    iconColor: 'text-orange-500',
    icon: <IconRotate className="h-4 w-4 text-orange-500" />
  },
  archived: {
    name: 'Archived',
    color: 'border-l-4 border-l-red-500 bg-red-50 dark:bg-red-950/30',
    iconColor: 'text-red-500',
    icon: <IconAlertCircle className="h-4 w-4 text-red-500" />
  },
};

function getTaskStatusBadge(state: string) {
  const statusColors: { [key: string]: string } = {
    scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    pending:   'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
    active:    'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300',
    retry:     'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
    archived:  'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  };

  const stage = TASK_STAGES[state] || TASK_STAGES.pending;
  const colorClass = statusColors[state] || statusColors.pending;

  return (
    <Badge className={`${colorClass} flex items-center gap-1`}>
      {stage.icon}
      {stage.name}
    </Badge>
  );
}


function LogLevelBadge({ level }: { level: string }) {
  const l = level.toLowerCase();
  const styles: Record<string, string> = {
    debug:   "bg-zinc-600 text-zinc-200",
    info:    "bg-sky-700 text-sky-100",
    warn:    "bg-amber-600 text-amber-100",
    warning: "bg-amber-600 text-amber-100",
    error:   "bg-red-700 text-red-100",
    fatal:   "bg-red-900 text-red-200 font-bold",
  };
  const cls = styles[l] ?? "bg-zinc-700 text-zinc-300";
  return (
    <span className={`inline-block px-1.5 py-px rounded text-[10px] font-mono uppercase tracking-wide ${cls} shrink-0 select-none`}>
      {level.slice(0, 5)}
    </span>
  );
}


function TaskLogDialog({ taskId, open, onClose }: { taskId: string | null; open: boolean; onClose: () => void }) {
  const [logs, setLogs] = useState<TaskLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !taskId) {
      return;
    }

    const fetchLogs = async () => {
      setLogsLoading(true);
      setLogsError(null);
      setLogs([]);
      try {
        const res = await getV1TaskByIdLogs({ path: { id: taskId } });
        if (res.data && Array.isArray(res.data)) {
          setLogs(res.data);
        } else {
          setLogs([]);
        }
      } catch {
        setLogsError("Failed to load logs.");
      } finally {
        setLogsLoading(false);
      }
    };

    fetchLogs();
  }, [open, taskId]);

  const formatTimestamp = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }) +
        "." + String(d.getMilliseconds()).padStart(3, "0");
    } catch { return ts; }
  };

  const downloadLogs = () => {
    if (!logs.length || !taskId) return;
    const text = logs.map(l => `[${l.timestamp}] [${l.level.toUpperCase()}] [${l.issuer}] ${l.message}`).join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `task-${taskId.slice(0, 8)}-logs.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-3xl w-full p-0 bg-zinc-950 border-zinc-800 text-zinc-100 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-3 border-b border-zinc-800 flex flex-row items-center gap-3 pr-12">
          <DialogTitle className="flex items-center gap-2 font-mono text-sm text-zinc-300 flex-1">
            <IconTerminal className="h-4 w-4 text-emerald-400" />
            <span className="text-emerald-400">task</span>
            <span className="text-zinc-500">/</span>
            <span className="text-zinc-300 font-normal">{taskId?.slice(0, 8) ?? "…"}</span>
            <span className="text-zinc-500 font-normal">/logs</span>
          </DialogTitle>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 shrink-0"
            onClick={downloadLogs}
            disabled={!logs.length}
            title="Download logs"
          >
            <IconDownload className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="h-[60vh] overflow-y-auto font-mono text-xs leading-relaxed p-4 space-y-0.5 scrollbar-thin">
          {logsLoading && (
            <div className="flex items-center gap-2 text-zinc-500 py-2">
              <IconRefresh className="h-3.5 w-3.5 animate-spin" />
              Loading logs…
            </div>
          )}
          {logsError && (
            <div className="text-red-400 py-2">{logsError}</div>
          )}
          {!logsLoading && !logsError && logs.length === 0 && (
            <div className="text-zinc-600 py-2">No logs available for this task.</div>
          )}
          {logs.map((log, i) => (
            <div key={`${log.timestamp}-${log.issuer}-${i}`} className="flex items-start gap-2 group hover:bg-zinc-900/60 rounded px-1 py-0.5 -mx-1">
              <span className="text-zinc-600 shrink-0 w-24">{formatTimestamp(log.timestamp)}</span>
              <LogLevelBadge level={log.level} />
              <span className="text-zinc-500 shrink-0 max-w-[100px] truncate" title={log.issuer}>{log.issuer}</span>
              <span className="text-zinc-200 break-words min-w-0">{log.message}</span>
            </div>
          ))}
        </div>

        {/* Status bar */}
        <div className="px-4 py-2 border-t border-zinc-800 flex items-center justify-between text-[10px] text-zinc-600 font-mono">
          <span>{logs.length} line{logs.length !== 1 ? "s" : ""}</span>
          <span className="text-zinc-700">{taskId}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TaskCard({ task, onViewLogs }: { task: Task; onViewLogs: (id: string) => void }) {
  const formatTime = (timestamp?: string) => {
    if (!timestamp) return '—';
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return timestamp;
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    } catch {
      return timestamp;
    }
  };

  const stage = TASK_STAGES[task.status.state] || TASK_STAGES.pending;

  const stateTimestamp: string | undefined =
    task.status.state === 'scheduled' ? task.status.next_process_at :
    task.status.state === 'completed' ? task.status.completed_at :
    task.status.state === 'retry'     ? task.status.last_failed_at :
    task.status.state === 'archived'  ? task.status.last_failed_at :
    undefined;

  const timestampLabel =
    task.status.state === 'scheduled' ? 'Run at' :
    task.status.state === 'completed' ? 'Completed' :
    task.status.state === 'retry'     ? 'Last failed' :
    task.status.state === 'archived'  ? 'Failed at' :
    'Time';

  return (
    <Card className={`mb-3 ${stage.color} hover:shadow-md transition-shadow`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="font-mono text-sm font-medium truncate">
            {task.id.split('-')[0]}
          </div>
          {getTaskStatusBadge(task.status.state)}
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <IconActivity className="h-4 w-4 text-purple-500" />
            <span className="font-medium">Retries: {task.status.retries}/{task.retries ?? '—'}</span>
          </div>
          <div className="flex items-center gap-2">
            <IconDatabase className="h-4 w-4 text-orange-500" />
            <span className="font-medium">{task.retention ?? '—'}</span>
          </div>
          {stateTimestamp && (
            <div className="col-span-2 flex items-center gap-2">
              <IconClock className="h-4 w-4 text-blue-500 shrink-0" />
              <span className="text-muted-foreground text-xs">{timestampLabel}:</span>
              <span className="font-medium text-xs">{formatTime(stateTimestamp)}</span>
            </div>
          )}
        </div>
        {(task.status.state === 'retry' || task.status.state === 'archived') && task.status.last_error && (
          <div className="mt-3 pt-2 border-t">
            <div className="flex items-start gap-2">
              <IconAlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
              <span className="text-xs text-red-600 dark:text-red-400 break-words line-clamp-2">
                {task.status.last_error}
              </span>
            </div>
          </div>
        )}
        <div className="mt-3 pt-2 border-t">
          <Button
            size="sm"
            variant="outline"
            className="w-full h-7 text-xs gap-1.5"
            onClick={() => onViewLogs(task.id)}
          >
            <IconTerminal className="h-3.5 w-3.5" />
            View Logs
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TaskStageColumn({ stage, tasks, isLoading, onViewLogs }: {
  stage: { name: string; color: string; icon: React.ReactNode; iconColor: string },
  tasks: Task[],
  isLoading: boolean,
  onViewLogs: (id: string) => void,
}) {
  if (isLoading) {
    return (
      <Card className="h-96">
        <CardHeader>
          <div className="flex items-center gap-2">
            {stage.icon}
            <CardTitle className="text-lg">{stage.name}</CardTitle>
            <Skeleton className="h-5 w-8 ml-auto" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(3)].map(() => (
              <Skeleton key={crypto.randomUUID()} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-96">
      <CardHeader>
        <div className="flex items-center gap-2">
          {stage.icon}
          <CardTitle className="text-lg">{stage.name}</CardTitle>
          <Badge variant="outline" className="ml-auto">
            {tasks.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="h-80 overflow-y-auto">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <IconDatabase className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-sm">No {stage.name.toLowerCase()} tasks</p>
          </div>
        ) : (
          <div className="space-y-1">
            {tasks.map((task) => (
              <TaskCard key={task.id} task={task} onViewLogs={onViewLogs} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function TaskOverview() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(() => new Date());
  const [logTaskId, setLogTaskId] = useState<string | null>(null);

  // Configure client function
  const configureClient = useCallback(() => {
    const storedCredentials = localStorage.getItem("enclave_credentials");
    if (storedCredentials) {
      try {
        client.setConfig({
          baseUrl: "/api",
          headers: {
            Authorization: `Basic ${storedCredentials}`,
          },
        });
      } catch {
        throw new Error("Failed to configure API client with existing credentials");
      }
    } else {
      throw new Error("No authentication credentials found");
    }
  }, []);

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    try {
      configureClient();

      const all: Task[] = [];
      const limit = 100;
      let offset = 0;
      while (true) {
        const response = await getV1Task({ query: { limit, offset } });

        if (response.response && !response.response.ok) {
          if (response.response.status === 403) {
            setHasAccess(false);
            setTasks([]);
            return;
          }
        }

        if (!response.data || !Array.isArray(response.data)) break;
        all.push(...response.data);
        if (response.data.length < limit) break;
        offset += limit;
      }
      setTasks(all);
      setHasAccess(true);
    } catch (error: unknown) {
      const err = error as {
        status?: number;
        response?: { status?: number; ok?: boolean };
        body?: { error?: string };
      };

      let status = err.status || err.response?.status;
      if (!status && err.response && err.response.ok === false) {
        status = 403;
      }

      if (status === 403) {
        setHasAccess(false);
      } else if (status === 401) {
        window.location.assign("/login");
      } else if (!status) {
        setHasAccess(false);
      }

      setTasks([]);
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  }, [configureClient]);

  // Auto refresh
  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, [fetchTasks]);

  const handleRefresh = () => {
    setLoading(true);
    fetchTasks();
  };

  // Group tasks by state
  const tasksByState = tasks.reduce((acc, task) => {
    const state = task.status.state || 'pending';
    if (!acc[state]) acc[state] = [];
    acc[state].push(task);
    return acc;
  }, {} as Record<string, Task[]>);

  const totalTasks = tasks.length;
  const pendingTasks = (tasksByState.scheduled?.length || 0) + (tasksByState.pending?.length || 0);
  const activeTasks = tasksByState.active?.length || 0;


  if (!hasAccess) {
    return (
      <PageLayout title="Task Overview">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <IconLockAccess className="h-16 w-16 text-muted-foreground mx-auto" />
            <h2 className="text-xl font-semibold">Access Denied</h2>
            <p className="text-muted-foreground max-w-md">
              You don't have permission to access the task overview.
              Contact your administrator if you believe this is an error.
            </p>
            <div className="flex justify-center space-x-2 pt-4">
              <Button variant="outline" onClick={() => window.history.back()}>
                Go Back
              </Button>
              <Button variant="default" onClick={() => { setLoading(true); fetchTasks(); }}>
                <IconRefresh className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Task Overview">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">Task Overview</h1>
          <p className="text-muted-foreground mt-1">
            Monitor task queue and runner status in real-time
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-muted-foreground">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </div>
          <Button onClick={handleRefresh} disabled={loading} variant="outline">
            <IconRefresh className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
            <IconDatabase className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTasks}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <IconClock className="h-5 w-5 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingTasks}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <IconPlayerPlay className="h-5 w-5 text-purple-500 animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeTasks}</div>
          </CardContent>
        </Card>
      </div>

      {/* Task Queue Visualization */}
      <div className="space-y-6 mb-8">
        <div className="flex items-center gap-2">
          <IconActivity className="h-5 w-5 text-indigo-500" />
          <h2 className="text-xl font-semibold">Task Pipeline</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Object.entries(TASK_STAGES).map(([stateKey, stage]) => (
            <TaskStageColumn
              key={stateKey}
              stage={stage}
              tasks={tasksByState[stateKey] || []}
              isLoading={loading}
              onViewLogs={setLogTaskId}
            />
          ))}
        </div>
      </div>

      <TaskLogDialog
        taskId={logTaskId}
        open={logTaskId !== null}
        onClose={() => setLogTaskId(null)}
      />
    </PageLayout>
  );
}
