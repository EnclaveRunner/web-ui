import { AppSidebar, type SidebarData } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { navigationConfig } from "@/config/navigation";

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export function DashboardLayout({
  children,
  title = "Dashboard",
}: DashboardLayoutProps) {
  const { user } = useAuth();

  const sidebarData: SidebarData = {
    user: {
      name: user?.name || "Demo User",
      email: user?.username || "demo@enclave.com",
      avatar: "",
    },
    company: {
      name: "Enclave Console",
      logoImage: "/enclave-logo.png",
    },
    navMain: navigationConfig.main,
    navSecondary: navigationConfig.secondary,
    documents: navigationConfig.documents.map((item) => ({
      name: item.title,
      url: item.url,
      icon: item.icon,
    })),
  };

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" data={sidebarData} />
      <SidebarInset>
        <SiteHeader title={title} />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              {children}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
