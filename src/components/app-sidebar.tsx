import * as React from "react";
import {
  IconDashboard,
  IconDatabase,
  IconFileWord,
  IconHelp,
  IconInnerShadowTop,
  IconReport,
  IconSearch,
  IconSettings,
  type Icon,
} from "@tabler/icons-react";

import { NavIAM } from "@/components/nav-iam";
import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export interface SidebarData {
  user: {
    name: string;
    displayName: string;
    avatar: string;
  };
  company: {
    name: string;
    logo?: Icon;
    logoImage?: string; // URL/path to company logo image
  };
  navMain: Array<{
    title: string;
    url: string;
    icon?: Icon;
  }>;
  navSecondary: Array<{
    title: string;
    url: string;
    icon: Icon;
  }>;
  navIAM: Array<{
    name: string;
    url: string;
    icon: Icon;
  }>;
}

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  data?: SidebarData;
}

// Default data as fallback
const defaultData: SidebarData = {
  user: {
    name: "guest",
    displayName: "Guest User",
    avatar: "/avatars/shadcn.jpg",
  },
  company: {
    name: "Acme Inc.",
    logo: IconInnerShadowTop,
  },
  navMain: [
    {
      title: "Dashboard",
      url: "#",
      icon: IconDashboard,
    },
  ],
  navSecondary: [
    {
      title: "Settings",
      url: "#",
      icon: IconSettings,
    },
    {
      title: "Get Help",
      url: "#",
      icon: IconHelp,
    },
    {
      title: "Search",
      url: "#",
      icon: IconSearch,
    },
  ],
  navIAM: [
    {
      name: "Data Library",
      url: "#",
      icon: IconDatabase,
    },
    {
      name: "Reports",
      url: "#",
      icon: IconReport,
    },
    {
      name: "Word Assistant",
      url: "#",
      icon: IconFileWord,
    },
  ],
};

export function AppSidebar({ data = defaultData, ...props }: AppSidebarProps) {
  const LogoIcon = data.company.logo || IconInnerShadowTop;

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <a href="#">
                {data.company.logoImage ? (
                  <img
                    src={data.company.logoImage}
                    alt={`${data.company.name} logo`}
                    className="!size-8 object-contain"
                  />
                ) : (
                  <LogoIcon className="!size-5" />
                )}
                <span className="text-base font-semibold">
                  {data.company.name}
                </span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        {data.navIAM && data.navIAM.length > 0 && (
          <NavIAM items={data.navIAM} />
        )}
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  );
}
