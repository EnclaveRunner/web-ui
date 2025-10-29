import { type ComponentType } from "react";
import { lazy } from "react";
import { type Icon } from "@tabler/icons-react";
import {
  IconDashboard,
  IconSettings,
  IconUsers,
  IconShield,
} from "@tabler/icons-react";

// Lazy load pages for better performance
const Dashboard = lazy(() => import("../pages/Dashboard"));
const Settings = lazy(() => import("../pages/Settings"));
const Login = lazy(() => import("../pages/Login"));
const UserManagement = lazy(() => import("../pages/UserManagement"));
const RoleManagement = lazy(() => import("../pages/RoleManagement"));

export interface AppRoute {
  path: string;
  component: ComponentType;
  protected: boolean;
  title?: string;
  icon?: Icon;
  navGroup?: "main" | "secondary" | "navIAM";
  order?: number; // For controlling navigation order
}

export const appRoutes: AppRoute[] = [
  {
    path: "/login",
    component: Login,
    protected: false,
    // No navigation properties - login doesn't appear in nav
  },
  {
    path: "/dashboard",
    component: Dashboard,
    protected: true,
    title: "Dashboard",
    icon: IconDashboard,
    navGroup: "main",
    order: 1,
  },
  {
    path: "/users",
    component: UserManagement,
    protected: true,
    title: "Users",
    icon: IconUsers,
    navGroup: "navIAM",
    order: 1,
  },
  {
    path: "/roles",
    component: RoleManagement,
    protected: true,
    title: "Roles & Groups",
    icon: IconShield,
    navGroup: "navIAM",
    order: 2,
  },
  {
    path: "/settings",
    component: Settings,
    protected: true,
    title: "Settings",
    icon: IconSettings,
    navGroup: "secondary",
    order: 1,
  },
];

// Route utilities
export function getRouteConfig(path: string): AppRoute | undefined {
  return appRoutes.find((route) => route.path === path);
}

// Navigation utilities
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
  navIAM: Array<{
    name: string;
    url: string;
    icon: Icon;
    active?: boolean;
  }>;
}

export function getNavigationConfig(): NavigationConfig {
  const navRoutes = appRoutes.filter(
    (route) => route.title && route.icon && route.navGroup
  );

  const createNavItems = (group: string): NavigationItem[] =>
    navRoutes
      .filter((route) => route.navGroup === group)
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map((route) => ({
        title: route.title!,
        url: route.path,
        icon: route.icon!,
      }));

  const createNavIAMItems = (group: string) =>
    navRoutes
      .filter((route) => route.navGroup === group)
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map((route) => ({
        name: route.title!,
        url: route.path,
        icon: route.icon!,
      }));

  return {
    main: createNavItems("main"),
    secondary: createNavItems("secondary"),
    documents: createNavItems("documents"),
    navIAM: createNavIAMItems("navIAM"),
  };
}

export function getActiveNavigation(currentPath: string): NavigationConfig {
  const config = getNavigationConfig();

  return {
    main: config.main.map((item) => ({
      ...item,
      active: item.url === currentPath,
    })),
    secondary: config.secondary.map((item) => ({
      ...item,
      active: item.url === currentPath,
    })),
    documents: config.documents.map((item) => ({
      ...item,
      active: item.url === currentPath,
    })),
    navIAM: config.navIAM.map((item) => ({
      ...item,
      active: item.url === currentPath,
    })),
  };
}

export const routes = appRoutes.map(
  ({ path, component, protected: isProtected }) => ({
    path,
    component,
    protected: isProtected,
  })
);
