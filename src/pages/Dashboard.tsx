import { PageLayout } from "@/components/PageLayout";
import { useAuth } from "@/contexts/AuthContext";

export default function Dashboard() {
  const { user } = useAuth();
  return (
    <PageLayout title="Dashboard">
      <h2 className="text-2xl font-bold mb-">
        Welcome back {user?.displayName}!
      </h2>

      <div className="min-h-[60vh] flex flex-col items-center justify-center">
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
