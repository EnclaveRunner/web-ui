import { PageLayout } from "@/components/PageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect, useCallback } from "react";
import { getTasksList } from "../client";
import { client } from "../client/client.gen";
import type { TaskState } from "../client/types.gen";
import {
  IconActivity,
  IconClock,
  IconCpu,
  IconDatabase,
  IconLockAccess,
  IconPlayerPlay,
  IconRefresh,
  IconServer,
} from "@tabler/icons-react";

const TASK_STAGES: { [key: string]: { name: string; color: string; icon: React.ReactNode; iconColor: string } } = {
  ENQUEUED: {
    name: 'Enqueued',
    color: 'border-l-4 border-l-blue-500 bg-blue-50 dark:bg-blue-950/30',
    iconColor: 'text-blue-500',
    icon: <IconClock className="h-4 w-4 text-blue-500" />
  },
  PICKED_UP: {
    name: 'Picked Up', 
    color: 'border-l-4 border-l-amber-500 bg-amber-50 dark:bg-amber-950/30',
    iconColor: 'text-amber-500',
    icon: <IconCpu className="h-4 w-4 text-amber-500" />
  },
  RUNNING: {
    name: 'Running',
    color: 'border-l-4 border-l-green-500 bg-green-50 dark:bg-green-950/30',
    iconColor: 'text-green-500',
    icon: <IconPlayerPlay className="h-4 w-4 text-green-500 animate-pulse" />
  }
};

function getTaskStatusBadge(lastAction: string) {
  const statusColors: { [key: string]: string } = {
    ENQUEUED: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    PICKED_UP: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
    RUNNING: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
  };
  
  const stage = TASK_STAGES[lastAction] || TASK_STAGES.ENQUEUED;
  const colorClass = statusColors[lastAction] || statusColors.ENQUEUED;
  
  return (
    <Badge className={`${colorClass} flex items-center gap-1`}>
      {stage.icon}
      {stage.name}
    </Badge>
  );
}

function TaskCard({ task }: { task: TaskState }) {
  const formatTime = (timestamp: string) => {
    try {
      // Handle the custom format "2026-02-23-14:45" by replacing the last hyphen with space and adding seconds
      const normalizedTimestamp = timestamp.replace(/-([0-9]{2}:[0-9]{2})$/, ' $1:00');
      const date = new Date(normalizedTimestamp);
      
      if (isNaN(date.getTime())) {
        return timestamp; // Return original if parsing fails
      }
      
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric', 
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } catch {
      return timestamp;
    }
  };

  const stage = TASK_STAGES[task.last_action] || TASK_STAGES.ENQUEUED;

  return (
    <Card className={`mb-3 ${stage.color} hover:shadow-md transition-shadow`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="font-mono text-sm font-medium truncate">
            {task.id.split('-')[0]}
          </div>
          {getTaskStatusBadge(task.last_action)}
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <IconServer className="h-4 w-4 text-slate-600 dark:text-slate-400" />
            <span className="truncate font-medium">{task.runner_host || 'Unassigned'}</span>
          </div>
          <div className="flex items-center gap-2">
            <IconClock className="h-4 w-4 text-blue-500" />
            <span className="font-medium">{formatTime(task.created_on)}</span>
          </div>
          <div className="flex items-center gap-2">
            <IconActivity className="h-4 w-4 text-purple-500" />
            <span className="font-medium">Retries: {task.retries}/{task.max_retries}</span>
          </div>
          <div className="flex items-center gap-2">
            <IconDatabase className="h-4 w-4 text-orange-500" />
            <span className="font-medium">{task.retention}</span>
          </div>
        </div>
        <div className="mt-3 pt-2 border-t">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Status:</span>
            <span className="text-xs font-medium">{task.status}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TaskStageColumn({ stage, tasks, isLoading }: { 
  stage: { name: string; color: string; icon: React.ReactNode; iconColor: string }, 
  tasks: TaskState[], 
  isLoading: boolean 
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
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function TaskOverview() {
  const [tasks, setTasks] = useState<TaskState[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(() => new Date());

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
      const response = await getTasksList();
      
      // Check if the response indicates access denied
      if (response.response && !response.response.ok) {
        console.log('API response not ok:', response.response.status, response.response);
        if (response.response.status === 403) {
          console.log('Setting hasAccess to false due to response.ok === false and 403 status');
          setHasAccess(false);
          setTasks([]);
          return;
        }
      }
      
      if (response.data && Array.isArray(response.data)) {
        setTasks(response.data);
        setHasAccess(true); // Set access to true on successful response
        console.log('Tasks loaded successfully, hasAccess set to true');
      } else {
        setTasks([]);
      }
    } catch (error: unknown) {
      console.error("Error fetching tasks:", error);
      
      // Try to extract status code from various possible error structures
      const err = error as { 
        status?: number; 
        response?: { status?: number; ok?: boolean };
        body?: { error?: string };
      };
      
      let status = err.status || err.response?.status;
      
      // If no status but response is not ok, assume access denied
      if (!status && err.response && err.response.ok === false) {
        status = 403;
      }
      
      console.log('Error status detected:', status, 'Full error:', err);
      
      if (status === 403) {
        console.log('Setting hasAccess to false due to 403 status');
        setHasAccess(false);
      } else if (status === 401) {
        // Redirect to login for authentication issues
        window.location.assign("/login");
      } else if (!status) {
        // If we can't determine status but got an error, assume access denied
        console.log('No status code found, assuming access denied');
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

  // Group tasks by last_action
  const tasksByAction = tasks.reduce((acc, task) => {
    const action = task.last_action || 'ENQUEUED';
    if (!acc[action]) acc[action] = [];
    acc[action].push(task);
    return acc;
  }, {} as Record<string, TaskState[]>);

  const totalTasks = tasks.length;
  const enqueuedTasks = tasksByAction.ENQUEUED?.length || 0;
  const runningTasks = tasksByAction.RUNNING?.length || 0;

  // ===== ACCESS DENIED STATE =====
  console.log('Access check - hasAccess:', hasAccess, 'loading:', loading);
  if (!hasAccess) {
    console.log('Showing access denied screen');
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
            <CardTitle className="text-sm font-medium">Enqueued</CardTitle>
            <IconClock className="h-5 w-5 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{enqueuedTasks}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Running</CardTitle>
            <IconPlayerPlay className="h-5 w-5 text-purple-500 animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{runningTasks}</div>
          </CardContent>
        </Card>
      </div>

      {/* Task Queue Visualization */}
      <div className="space-y-6 mb-8">
        <div className="flex items-center gap-2">
          <IconActivity className="h-5 w-5 text-indigo-500" />
          <h2 className="text-xl font-semibold">Task Pipeline</h2>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {Object.entries(TASK_STAGES).map(([actionKey, stage]) => (
            <TaskStageColumn 
              key={actionKey}
              stage={stage}
              tasks={tasksByAction[actionKey] || []}
              isLoading={loading}
            />
          ))}
        </div>
      </div>
    </PageLayout>
  );
}
