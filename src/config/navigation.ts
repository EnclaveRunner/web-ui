import { type Icon } from "@tabler/icons-react";
import { IconDashboard, IconSettings } from "@tabler/icons-react";

export interface NavigationItem {
  title: string;
  url: string;
  icon: Icon;
  active?: boolean;
}

export interface NavigationConfig {
  main: NavigationItem[];
  secondary: NavigationItem[];
  documents: NavigationItem[];
}

/**
 * Centralized navigation configuration
 * Add new pages here to automatically include them in the sidebar
 */
export const navigationConfig: NavigationConfig = {
  main: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: IconDashboard,
    },
  ],
  secondary: [
    {
      title: "Settings",
      url: "/settings",
      icon: IconSettings,
    },
  ],
  documents: [],
};

/**
 * Helper function to get navigation config based on current path
 */
export function getActiveNavigation(currentPath: string): NavigationConfig {
  return {
    main: navigationConfig.main.map((item) => ({
      ...item,
      active: item.url === currentPath,
    })),
    secondary: navigationConfig.secondary.map((item) => ({
      ...item,
      active: item.url === currentPath,
    })),
    documents: navigationConfig.documents.map((item) => ({
      ...item,
      active: item.url === currentPath,
    })),
  };
}
