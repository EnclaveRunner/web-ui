import { PageLayout } from "@/components/PageLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useEffect } from "react";
import { getArtifactList } from "../client";
import { client } from "../client/client.gen";
import { IconCube } from "@tabler/icons-react";

export default function Dashboard() {
  const { user } = useAuth();
  const [artifactCount, setArtifactCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

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
    const fetchArtifactCount = async () => {
      try {
        configureClient();
        const response = await getArtifactList();
        
        if (response.data && Array.isArray(response.data)) {
          setArtifactCount(response.data.length);
        } else {
          setArtifactCount(0);
        }
      } catch (error) {
        console.error("Error fetching artifact count:", error);
        setArtifactCount(0);
      } finally {
        setLoading(false);
      }
    };

    fetchArtifactCount();
  }, []);

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
            <IconCube className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "..." : artifactCount.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Available in your environment
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
