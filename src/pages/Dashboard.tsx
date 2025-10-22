import { PageLayout } from "@/components/PageLayout";

export default function Dashboard() {
  return (
    <PageLayout title="Dashboard">
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <div className="text-center">
          <img
            src="/enclave-logo.png"
            alt="Enclave Logo"
            className="h-24 w-auto mx-auto mb-8"
          />
          <h1 className="text-4xl font-bold mb-4">
            Welcome to Enclave Console
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl">
            Seamlessly execute isolated tasks and workflows with fine-grained
            control over resource access and permissions.
          </p>
        </div>
      </div>
    </PageLayout>
  );
}
