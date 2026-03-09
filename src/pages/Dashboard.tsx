import { PageLayout } from "@/components/PageLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useEffect } from "react";
import { getArtifactList, getTasksList } from "../client";
import { client } from "../client/client.gen";
import type { TaskState } from "../client/types.gen";
import {
  IconCube,
  IconActivity,
  IconCircleCheck,
  IconAlertCircle,
} from "@tabler/icons-react";

export default function Dashboard() {
  const { user } = useAuth();
  const [artifactCount, setArtifactCount] = useState<number>(0);
  const [tasks, setTasks] = useState<TaskState[]>([]);
  const [loading, setLoading] = useState(true);
  const [taskLoading, setTaskLoading] = useState(true);

  // Configure client function
  const configureClient = () => {
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
  };

  // Fetch artifact count
  useEffect(() => {
    const fetchData = async () => {
      try {
        configureClient();
        
        // Fetch artifacts
        const artifactResponse = await getArtifactList();
        if (artifactResponse.data && Array.isArray(artifactResponse.data)) {
          setArtifactCount(artifactResponse.data.length);
        } else {
          setArtifactCount(0);
        }
        setLoading(false);
        
        // Fetch tasks
        const taskResponse = await getTasksList();
        if (taskResponse.data && Array.isArray(taskResponse.data)) {
          setTasks(taskResponse.data);
        } else {
          setTasks([]);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        setArtifactCount(0);
        setTasks([]);
      } finally {
        setLoading(false);
        setTaskLoading(false);
      }
    };

    fetchData();
  }, []);

  // Calculate essential task metrics
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(task => task.state === 'completed').length;
  const failedTasks = tasks.filter(task => task.state === 'archived').length;

  return (
    <PageLayout title="Dashboard">
      <h2 className="text-2xl font-bold mb-6">
        Welcome back {user?.displayName}!
      </h2>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Artifacts</CardTitle>
            <IconCube className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "..." : artifactCount.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Available artifacts
            </p>
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
            <p className="text-xs text-muted-foreground">
              All task executions
            </p>
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
            <p className="text-xs text-muted-foreground">
              Successful tasks
            </p>
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
            <p className="text-xs text-muted-foreground">
              Failed tasks
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="min-h-[40vh] flex flex-col items-center justify-center">
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
