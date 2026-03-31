"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  GitBranch,
  Zap,
  Calendar,
  Puzzle,
  Lock,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  User,
  LogOut,
  Bell,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/stores/auth-store";
import { authApi } from "@/lib/api/auth";
import { apiClient } from "@/lib/api/client";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Workflows", href: "/workflows", icon: GitBranch },
  { label: "Triggers", href: "/triggers", icon: Zap },
  { label: "Schedule", href: "/schedules", icon: Calendar },
  { label: "Integration", href: "/integrations", icon: Puzzle },
  { label: "Authentication", href: "/authentication", icon: Lock },
  { label: "Statistics", href: "/statistics", icon: BarChart3 },
] as const;

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [query]);
  return matches;
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [manualCollapse, setManualCollapse] = useState<boolean | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const isSmall = useMediaQuery("(max-width: 1279px)");
  const isMedium = useMediaQuery("(min-width: 1280px) and (max-width: 1439px)");

  const collapsed = manualCollapse ?? isMedium;
  const hidden = isSmall && !mobileOpen;

  // Notification unread count
  const unreadQuery = useQuery<number>({
    queryKey: ["notifications", "unread-count"],
    queryFn: async () => {
      const { data } = await apiClient.get("/notifications/unread-count");
      return data.data?.count ?? data.count ?? 0;
    },
    refetchInterval: 30000,
  });
  const unreadCount = unreadQuery.data ?? 0;

  // Notification list
  const notifListQuery = useQuery({
    queryKey: ["notifications", "list"],
    queryFn: async () => {
      const { data } = await apiClient.get("/notifications?limit=10");
      return (data.data?.data ?? data.data ?? []) as Array<{
        id: string;
        title: string;
        message: string;
        isRead: boolean;
        createdAt: string;
      }>;
    },
    enabled: notifOpen,
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node)
      ) {
        setUserMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    if (userMenuOpen || notifOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [userMenuOpen, notifOpen]);

  // Close mobile sidebar on navigation
  const [lastPathname, setLastPathname] = useState(pathname);
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    if (mobileOpen) {
      setMobileOpen(false);
    }
  }

  async function handleLogout() {
    try {
      await authApi.logout();
    } catch {
      // Proceed with client-side logout even if API fails
    }
    logout();
    router.push("/login");
  }

  const userInitial = user?.name?.charAt(0)?.toUpperCase() ?? "U";
  const userName = user?.name ?? "User";

  return (
    <>
      {/* Mobile hamburger button */}
      {isSmall && !mobileOpen && (
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="fixed left-4 top-4 z-40 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2 shadow-sm"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}

      {/* Mobile overlay */}
      {isSmall && mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-[hsl(var(--border))] bg-[hsl(var(--card))] transition-all duration-200",
          collapsed ? "w-16" : "w-60",
          hidden && "-translate-x-full",
        )}
      >
        {/* Logo */}
        <div className="flex h-14 items-center border-b border-[hsl(var(--border))] px-4">
          {!collapsed && (
            <Link href="/dashboard" className="text-lg font-semibold">
              Workflow
            </Link>
          )}
          {collapsed && (
            <Link
              href="/dashboard"
              className="mx-auto text-lg font-semibold"
            >
              W
            </Link>
          )}
          {isSmall && mobileOpen && (
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="ml-auto"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-2">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                    : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]",
                  collapsed && "justify-center px-2",
                )}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Notification bell */}
        <div className="relative px-2 pb-1" ref={notifRef}>
          {notifOpen && (
            <div className="absolute bottom-full left-2 right-2 mb-1 max-h-[300px] overflow-y-auto rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-lg">
              <div className="border-b border-[hsl(var(--border))] px-3 py-2">
                <p className="text-sm font-medium">Notifications</p>
              </div>
              {!notifListQuery.data?.length ? (
                <div className="px-3 py-4 text-center text-sm text-[hsl(var(--muted-foreground))]">
                  No notifications
                </div>
              ) : (
                notifListQuery.data.map((notif) => (
                  <div
                    key={notif.id}
                    className={cn(
                      "border-b border-[hsl(var(--border))] px-3 py-2 last:border-b-0",
                      !notif.isRead && "bg-[hsl(var(--accent))/0.3]",
                    )}
                  >
                    <p className="text-sm font-medium">{notif.title}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      {notif.message}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => setNotifOpen(!notifOpen)}
            className={cn(
              "relative flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]",
              collapsed && "justify-center px-2",
            )}
            title={collapsed ? "Notifications" : undefined}
          >
            <Bell className="h-5 w-5 shrink-0" />
            {!collapsed && <span>Notifications</span>}
            {unreadCount > 0 && (
              <span className="absolute right-2 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[hsl(var(--destructive))] px-1 text-[10px] font-bold text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* User area */}
        <div
          className="relative border-t border-[hsl(var(--border))] p-2"
          ref={userMenuRef}
        >
          {userMenuOpen && (
            <div className="absolute bottom-full left-2 right-2 mb-1 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] py-1 shadow-lg">
              <div className="border-b border-[hsl(var(--border))] px-3 py-2">
                <p className="text-sm font-medium text-[hsl(var(--foreground))]">
                  {userName}
                </p>
                {user?.email && (
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    {user.email}
                  </p>
                )}
              </div>
              <Link
                href="/profile"
                onClick={() => setUserMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]"
              >
                <User className="h-4 w-4" />
                Profile
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className={cn(
              "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]",
              collapsed && "justify-center px-2",
            )}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-xs font-semibold text-[hsl(var(--primary-foreground))]">
              {userInitial}
            </div>
            {!collapsed && <span>{userName}</span>}
          </button>
        </div>

        {/* Collapse toggle */}
        {!isSmall && (
          <div className="border-t border-[hsl(var(--border))] p-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setManualCollapse(manualCollapse === null ? !isMedium : !manualCollapse)
              }
              className={cn("w-full", collapsed && "px-2")}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <>
                  <ChevronLeft className="h-4 w-4" />
                  <span className="ml-2">Collapse</span>
                </>
              )}
            </Button>
          </div>
        )}
      </aside>
    </>
  );
}
