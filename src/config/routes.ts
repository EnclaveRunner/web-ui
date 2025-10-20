import { type ComponentType } from "react";
import { lazy } from "react";

// Lazy load pages for better performance
const Dashboard = lazy(() => import("../pages/Dashboard"));
const Settings = lazy(() => import("../pages/Settings"));
const Login = lazy(() => import("../pages/Login"));

export interface RouteConfig {
  path: string;
  component: ComponentType;
  protected: boolean;
  title?: string;
}

/**
 * Centralized route configuration
 * Add new routes here to automatically include them in the app
 */
export const routes: RouteConfig[] = [
  {
    path: "/login",
    component: Login,
    protected: false,
    title: "Login",
  },
  {
    path: "/dashboard",
    component: Dashboard,
    protected: true,
    title: "Dashboard",
  },
  {
    path: "/settings",
    component: Settings,
    protected: true,
    title: "Settings",
  },
];

/**
 * Helper to get route config by path
 */
export function getRouteConfig(path: string): RouteConfig | undefined {
  return routes.find((route) => route.path === path);
}
