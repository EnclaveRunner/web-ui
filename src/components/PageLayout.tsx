import { type ReactNode } from "react";
import { DashboardLayout } from "./DashboardLayout";

export interface PageLayoutProps {
  children: ReactNode;
  title?: string;
  showSidebar?: boolean;
  className?: string;
}

/**
 * Base page layout component that provides consistent structure for all pages
 */
export function PageLayout({
  children,
  title = "Enclave Console",
  showSidebar = true,
  className = "",
}: PageLayoutProps) {
  if (showSidebar) {
    return (
      <DashboardLayout title={title}>
        <div className={`px-4 lg:px-6 ${className}`}>{children}</div>
      </DashboardLayout>
    );
  }

  // For pages without sidebar (like login)
  return <div className={`min-h-screen ${className}`}>{children}</div>;
}
