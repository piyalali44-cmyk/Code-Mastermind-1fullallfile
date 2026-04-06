import { useState, createContext, useContext, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  LayoutDashboard,
  FolderTree,
  ListVideo,
  Mic2,
  AlertTriangle,
  Headphones,
  Map,
  Rss,
  Plug,
  Users,
  CreditCard,
  DollarSign,
  Ticket,
  HeartHandshake,
  Gamepad2,
  Award,
  Trophy,
  Bell,
  MessageSquare,
  MessageSquareWarning,
  LineChart,
  Flag,
  UserX,
  BookOpen,
  BookMarked,
  Download,
  Zap,
  Palette,
  Share2,
  Code2,
  Shield,
  ShieldAlert,
  Activity,
  Moon,
  LogOut,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";

interface SidebarContextType {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType>({
  collapsed: false,
  setCollapsed: () => {},
  mobileOpen: false,
  setMobileOpen: () => {},
});

export function useSidebar() {
  return useContext(SidebarContext);
}

function getPersistedCollapsed(): boolean {
  try {
    return localStorage.getItem("sg-sidebar-collapsed") === "true";
  } catch {
    return false;
  }
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, _setCollapsed] = useState(getPersistedCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  const setCollapsed = (v: boolean) => {
    _setCollapsed(v);
    try { localStorage.setItem("sg-sidebar-collapsed", String(v)); } catch {}
  };

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed, mobileOpen, setMobileOpen }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function Sidebar() {
  const [location] = useLocation();
  const { isAtLeast, role, signOut } = useAuth();
  const isMobile = useIsMobile();
  const { collapsed, setCollapsed, mobileOpen, setMobileOpen } = useSidebar();

  useEffect(() => {
    if (isMobile && mobileOpen) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
    return undefined;
  }, [isMobile, mobileOpen]);

  const handleSignOut = async () => {
    await signOut();
  };

  const handleNavClick = () => {
    if (isMobile) setMobileOpen(false);
  };

  const navGroups = [
    {
      title: "Overview",
      items: [
        { title: "Dashboard", href: "/", icon: LayoutDashboard, show: isAtLeast("content") },
      ],
    },
    {
      title: "Content",
      items: [
        { title: "Categories", href: "/content/categories", icon: FolderTree, show: isAtLeast("content") },
        { title: "Series", href: "/content/series", icon: ListVideo, show: isAtLeast("content") },
        { title: "Episodes", href: "/content/episodes", icon: Mic2, show: isAtLeast("content") },
        { title: "Reciters", href: "/content/reciters", icon: Mic2, show: isAtLeast("content") },
        { title: "Reports", href: "/content/reports", icon: AlertTriangle, show: isAtLeast("content"), badge: 0 },
        { title: "Play Stats", href: "/content/play-stats", icon: Headphones, show: isAtLeast("content") },
      ],
    },
    {
      title: "Journey",
      items: [
        { title: "Journey Timeline", href: "/journey", icon: Map, show: isAtLeast("content") },
      ],
    },
    {
      title: "Home Feed",
      items: [
        { title: "Feed Manager", href: "/feed", icon: Rss, show: isAtLeast("editor") },
        { title: "Widget Injection", href: "/feed/widgets", icon: Plug, show: isAtLeast("editor") },
      ],
    },
    {
      title: "Users",
      items: [
        { title: "All Users", href: "/users", icon: Users, show: isAtLeast("admin") },
      ],
    },
    {
      title: "Monetization",
      items: [
        { title: "Transactions", href: "/monetization/transactions", icon: DollarSign, show: isAtLeast("admin") },
        { title: "Subscription Plans", href: "/monetization/plans", icon: CreditCard, show: isAtLeast("admin") },
        { title: "Coupon Codes", href: "/monetization/coupons", icon: Ticket, show: isAtLeast("admin") },
        { title: "Donation Settings", href: "/monetization/donation", icon: HeartHandshake, show: isAtLeast("admin") },
      ],
    },
    {
      title: "Gamification",
      items: [
        { title: "Quiz Builder", href: "/gamification/quiz", icon: Gamepad2, show: isAtLeast("editor") },
        { title: "Badge Manager", href: "/gamification/badges", icon: Award, show: isAtLeast("editor") },
        { title: "Leaderboard", href: "/gamification/leaderboard", icon: Trophy, show: isAtLeast("editor") },
      ],
    },
    {
      title: "Notifications",
      items: [
        { title: "Push Notifications", href: "/notifications/push", icon: Bell, show: isAtLeast("editor") },
        { title: "Popups & Notice Bar", href: "/notifications/popups", icon: MessageSquareWarning, show: isAtLeast("editor") },
        { title: "Contact Messages", href: "/notifications/contact", icon: MessageSquare, show: isAtLeast("support") },
      ],
    },
    {
      title: "Analytics",
      items: [
        { title: "Analytics", href: "/analytics", icon: LineChart, show: isAtLeast("content") },
      ],
    },
    {
      title: "Hadith",
      items: [
        { title: "Hadith Manager", href: "/hadith", icon: BookMarked, show: isAtLeast("content") },
      ],
    },
    {
      title: "Settings",
      items: [
        { title: "Feature Flags", href: "/settings/feature-flags", icon: Flag, show: isAtLeast("admin") },
        { title: "Ramadan Mode", href: "/settings/ramadan", icon: Moon, show: isAtLeast("admin") },
        { title: "Guest & Access", href: "/settings/guest-access", icon: UserX, show: role === "super_admin" },
        { title: "Qur'an Settings", href: "/settings/quran", icon: BookOpen, show: role === "super_admin" },
        { title: "Downloads", href: "/settings/downloads", icon: Download, show: role === "super_admin" },
        { title: "XP & Streaks", href: "/settings/xp", icon: Zap, show: role === "super_admin" },
        { title: "Appearance", href: "/settings/appearance", icon: Palette, show: role === "super_admin" },
        { title: "Referral System", href: "/settings/referral", icon: Share2, show: isAtLeast("admin") },
        { title: "OTP Rate Limiting", href: "/settings/rate-limiting", icon: ShieldAlert, show: isAtLeast("admin") },
        { title: "API Sources", href: "/settings/api-sources", icon: Code2, show: isAtLeast("admin") },
      ],
    },
    {
      title: "Admin Panel",
      items: [
        { title: "Admin Users", href: "/staff/users", icon: Shield, show: role === "super_admin" },
        { title: "Activity Log", href: "/staff/activity-log", icon: Activity, show: isAtLeast("admin") },
      ],
    },
  ];

  function isActive(href: string) {
    if (href === "/") return location === "/";
    return location === href || location.startsWith(href + "/");
  }

  const sidebarWidth = collapsed && !isMobile ? "w-[68px]" : "w-64";
  const showFull = !collapsed || isMobile;

  const sidebarContent = (
    <div className={cn(
      "flex h-full flex-col bg-sidebar border-r border-sidebar-border transition-[width] duration-300 ease-in-out",
      isMobile ? "w-72" : sidebarWidth
    )}>
      <div className="flex h-14 items-center border-b border-sidebar-border px-3 shrink-0">
        {showFull ? (
          <Link href="/" className="flex items-center gap-2.5 font-semibold text-sidebar-primary flex-1 min-w-0 group" onClick={handleNavClick}>
            <div className="h-8 w-8 rounded-lg gold-gradient flex items-center justify-center shrink-0 shadow-md group-hover:shadow-primary/30 transition-shadow">
              <span className="text-white text-sm font-bold">SG</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold tracking-wide text-sidebar-foreground truncate">StayGuided</span>
              <span className="text-[10px] text-sidebar-foreground/50 -mt-0.5">Admin Panel</span>
            </div>
          </Link>
        ) : (
          <Link href="/" className="flex items-center justify-center w-full group" onClick={handleNavClick}>
            <div className="h-8 w-8 rounded-lg gold-gradient flex items-center justify-center shadow-md group-hover:shadow-primary/30 transition-shadow">
              <span className="text-white text-sm font-bold">SG</span>
            </div>
          </Link>
        )}
        {isMobile && (
          <button onClick={() => setMobileOpen(false)} className="p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors ml-2 active:scale-95">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <ScrollArea className="flex-1 overflow-y-auto">
        <div className={cn("py-3 space-y-0.5", collapsed && !isMobile ? "px-2" : "px-3")}>
          {navGroups.map((group, i) => {
            const visibleItems = group.items.filter(item => item.show);
            if (visibleItems.length === 0) return null;

            return (
              <div key={i} className="pt-4 first:pt-0">
                {showFull && (
                  <h4 className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/35 select-none">
                    {group.title}
                  </h4>
                )}
                {collapsed && !isMobile && i > 0 && (
                  <div className="h-px bg-sidebar-border mx-1 mb-2" />
                )}
                <div className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const active = isActive(item.href);
                    const btn = (
                      <Link key={item.href} href={item.href} onClick={handleNavClick}>
                        {collapsed && !isMobile ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                              "w-full h-9 transition-all duration-150 relative",
                              active
                                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                            )}
                          >
                            {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-primary" />}
                            <item.icon className="h-4 w-4 shrink-0" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            className={cn(
                              "w-full justify-start gap-2.5 h-9 text-[13px] font-normal transition-all duration-150 relative",
                              active
                                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                                : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                            )}
                          >
                            {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-primary" />}
                            <item.icon className="h-4 w-4 shrink-0" />
                            <span className="truncate">{item.title}</span>
                            {item.badge !== undefined && item.badge > 0 && (
                              <span className="ml-auto bg-destructive text-destructive-foreground text-[10px] px-1.5 py-0.5 rounded-full leading-none">
                                {item.badge}
                              </span>
                            )}
                          </Button>
                        )}
                      </Link>
                    );

                    if (collapsed && !isMobile) {
                      return (
                        <Tooltip key={item.href} delayDuration={0}>
                          <TooltipTrigger asChild>{btn}</TooltipTrigger>
                          <TooltipContent side="right" sideOffset={8} className="text-xs font-medium">
                            {item.title}
                          </TooltipContent>
                        </Tooltip>
                      );
                    }
                    return btn;
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <div className="p-2 border-t border-sidebar-border space-y-1 shrink-0">
        {!isMobile && (
          <Button
            variant="ghost"
            size={collapsed ? "icon" : "default"}
            className={cn(
              "h-8 text-[13px] text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors duration-150",
              collapsed ? "w-full" : "w-full justify-start gap-2.5"
            )}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <><ChevronLeft className="h-4 w-4" /><span>Collapse</span></>}
          </Button>
        )}
        <Button
          variant="ghost"
          size={collapsed && !isMobile ? "icon" : "default"}
          className={cn(
            "h-8 text-[13px] text-sidebar-foreground/60 hover:text-red-400 hover:bg-red-500/10 transition-colors duration-150",
            collapsed && !isMobile ? "w-full" : "w-full justify-start gap-2.5"
          )}
          onClick={handleSignOut}
          title="Sign Out"
        >
          <LogOut className="h-4 w-4" />
          {showFull && <span>Sign Out</span>}
        </Button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 flex">
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
              onClick={() => setMobileOpen(false)}
            />
            <div className="relative z-50 animate-in slide-in-from-left duration-250 ease-out shadow-2xl">
              {sidebarContent}
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <TooltipProvider>
      {sidebarContent}
    </TooltipProvider>
  );
}
