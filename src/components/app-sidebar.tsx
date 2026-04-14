"use client"

import { Calendar, BarChart3, Newspaper, PenTool, Send, Settings } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar"

// Menu items.
const items = [
  {
    title: "뉴스 클리핑", // News Clipping
    url: "/dashboard",
    icon: Newspaper,
  },
  {
    title: "보도자료 생성", // PR Generator
    url: "/generator",
    icon: PenTool,
  },
  {
    title: "배포 캘린더", // Calendar
    url: "/calendar",
    icon: Calendar,
  },
  {
    title: "성과 리포트", // Reports
    url: "/reports",
    icon: BarChart3,
  },
  {
    title: "보도자료 의뢰", // PR Request
    url: "/request",
    icon: Send,
  },
]

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b">
        <h1 className="text-xl font-bold tracking-tight text-primary">FURSYS Press AI</h1>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>애플리케이션</SidebarGroupLabel> {/* Application */}
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname === item.url}>
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
