import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import { Sidebar, useSidebar } from "./Sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import {
  Sun,
  Moon,
  Menu,
  ChevronRight,
  LogOut,
  Settings,
  User,
  Search,
  Command,
} from "lucide-react";

const ROUTE_LABELS: Record<string, string> = {
  "/": "Dashboard",
  "/content/categories": "Categories",
  "/content/series": "Series",
  "/content/episodes": "Episodes",
  "/content/reciters": "Reciters",
  "/content/reports": "Reports",
  "/journey": "Journey Timeline",
  "/feed": "Feed Manager",
  "/feed/widgets": "Widget Injection",
  "/users": "All Users",
  "/monetization/plans": "Subscription Plans",
  "/monetization/coupons": "Coupon Codes",
  "/monetization/donation": "Donation Settings",
  "/gamification/quiz": "Quiz Builder",
  "/gamification/badges": "Badge Manager",
  "/gamification/leaderboard": "Leaderboard",
  "/notifications/push": "Push Notifications",
  "/notifications/popups": "Popups & Notice Bar",
  "/analytics": "Analytics",
  "/hadith": "Hadith Manager",
  "/settings/feature-flags": "Feature Flags",
  "/settings/guest-access": "Guest & Access",
  "/settings/quran": "Qur'an Settings",
  "/settings/downloads": "Downloads",
  "/settings/xp": "XP & Streaks",
  "/settings/appearance": "Appearance",
  "/settings/referral": "Referral System",
  "/settings/api-sources": "API Sources",
  "/admin/users": "Admin Users",
  "/admin/activity-log": "Activity Log",
  "/profile": "Profile Settings",
};

const ROUTE_SECTIONS: Record<string, string> = {
  "/content": "Content",
  "/journey": "Journey",
  "/feed": "Home Feed",
  "/users": "Users",
  "/monetization": "Monetization",
  "/gamification": "Gamification",
  "/notifications": "Notifications",
  "/analytics": "Analytics",
  "/hadith": "Hadith",
  "/settings": "Settings",
  "/admin": "Admin",
};

function getBreadcrumbs(path: string) {
  if (path === "/") return [{ label: "Dashboard", href: "/" }];
  const crumbs: { label: string; href?: string }[] = [];
  const sectionKey = Object.keys(ROUTE_SECTIONS).find(k => path.startsWith(k));
  if (sectionKey) {
    crumbs.push({ label: ROUTE_SECTIONS[sectionKey] });
  }
  const pageLabel = ROUTE_LABELS[path];
  if (pageLabel) {
    crumbs.push({ label: pageLabel, href: path });
  } else if (path.startsWith("/users/")) {
    crumbs.push({ label: "User Detail", href: path });
  }
  return crumbs;
}

interface SearchItem {
  href: string;
  label: string;
  section: string;
  minRole?: "content" | "admin" | "super_admin";
}

const ALL_SEARCH_ITEMS: SearchItem[] = Object.entries(ROUTE_LABELS).map(([href, label]) => {
  const section = Object.entries(ROUTE_SECTIONS).find(([k]) => href.startsWith(k))?.[1] || "Overview";
  let minRole: SearchItem["minRole"];
  if (href.startsWith("/admin/")) minRole = "super_admin";
  else if (href.startsWith("/settings/guest-access") || href.startsWith("/settings/quran") || href.startsWith("/settings/subscription") || href.startsWith("/settings/downloads") || href.startsWith("/settings/xp") || href.startsWith("/settings/appearance")) minRole = "super_admin";
  else if (href.startsWith("/settings/") || href.startsWith("/analytics")) minRole = "admin";
  return { href, label, section, minRole };
});

const ROLE_LEVELS: Record<string, number> = { content: 1, admin: 2, super_admin: 3 };

function CommandPalette({ open, onClose, role }: { open: boolean; onClose: () => void; role: string | null }) {
  const [query, setQuery] = useState("");
  const [, setLocation] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const userLevel = ROLE_LEVELS[role || ""] || 0;
  const searchItems = ALL_SEARCH_ITEMS.filter(item => {
    if (!item.minRole) return true;
    return userLevel >= (ROLE_LEVELS[item.minRole] || 999);
  });

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  const filtered = query.trim()
    ? searchItems.filter(
        (item) =>
          item.label.toLowerCase().includes(query.toLowerCase()) ||
          item.section.toLowerCase().includes(query.toLowerCase())
      )
    : searchItems;

  const navigate = (href: string) => {
    setLocation(href);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[99998] flex items-start justify-center pt-[15vh]">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl animate-in fade-in slide-in-from-top-3 duration-200 overflow-hidden">
        <div className="flex items-center gap-3 px-4 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages..."
            className="flex-1 h-12 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "Enter" && filtered.length > 0) navigate(filtered[0].href);
            }}
          />
          <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-border px-1.5 text-[10px] text-muted-foreground">
            ESC
          </kbd>
        </div>
        <div className="max-h-[300px] overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">No results found</div>
          ) : (
            filtered.map((item) => (
              <button
                key={item.href}
                onClick={() => navigate(item.href)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-accent/50 transition-colors text-left"
              >
                <span className="text-foreground font-medium">{item.label}</span>
                <span className="text-[11px] text-muted-foreground ml-auto">{item.section}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function LoadingSpinner() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
      <div className="relative">
        <div className="w-12 h-12 border-2 border-primary/20 rounded-full" />
        <div className="absolute inset-0 w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
      <p className="text-sm text-muted-foreground animate-pulse">Loading admin panel...</p>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile, role, loading, accessDenied, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [location, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const { setMobileOpen } = useSidebar();
  const [profileOpen, setProfileOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const profileBtnRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 });

  const updateDropdownPos = useCallback(() => {
    if (profileBtnRef.current) {
      const rect = profileBtnRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 6,
        right: Math.max(8, window.innerWidth - rect.right),
      });
    }
  }, []);

  const closeDropdown = useCallback(() => setProfileOpen(false), []);

  useEffect(() => {
    function handleCmdK(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen((o) => !o);
      }
    }
    document.addEventListener("keydown", handleCmdK);
    return () => document.removeEventListener("keydown", handleCmdK);
  }, []);

  useEffect(() => {
    if (!profileOpen) return;

    updateDropdownPos();

    function handleClick(e: MouseEvent) {
      if (
        profileBtnRef.current && !profileBtnRef.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) {
        setProfileOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setProfileOpen(false);
    }

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", updateDropdownPos);
    window.addEventListener("scroll", closeDropdown, true);

    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", updateDropdownPos);
      window.removeEventListener("scroll", closeDropdown, true);
    };
  }, [profileOpen, updateDropdownPos, closeDropdown]);

  useEffect(() => {
    if (!loading && accessDenied) {
      signOut().then(() => {
        toast.error("Access denied — no admin profile found for this account.");
        setLocation("/login");
      });
    }
  }, [loading, accessDenied, signOut, setLocation]);

  if (loading) return <LoadingSpinner />;
  if (accessDenied || !profile) return <LoadingSpinner />;

  const breadcrumbs = getBreadcrumbs(location);
  const initials = (profile.display_name || profile.email || "A")
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <header className="flex h-14 items-center justify-between border-b border-border bg-card/80 backdrop-blur-md px-3 md:px-6 shrink-0 gap-2">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            {isMobile && (
              <button
                onClick={() => setMobileOpen(true)}
                className="p-2 -ml-1 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors active:scale-95"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
            )}
            <nav className="hidden md:flex items-center gap-1.5 text-sm min-w-0">
              {breadcrumbs.map((crumb, i) => (
                <span key={i} className="flex items-center gap-1.5 min-w-0">
                  {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />}
                  <span className={i === breadcrumbs.length - 1 ? "text-foreground font-medium truncate" : "text-muted-foreground truncate"}>
                    {crumb.label}
                  </span>
                </span>
              ))}
            </nav>
            {isMobile && breadcrumbs.length > 0 && (
              <span className="text-sm font-medium text-foreground truncate">
                {breadcrumbs[breadcrumbs.length - 1].label}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 md:gap-2 shrink-0">
            <button
              onClick={() => setCmdOpen(true)}
              className="hidden md:flex items-center gap-2 h-8 px-3 rounded-lg border border-border bg-secondary/50 hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors text-xs"
            >
              <Search className="h-3.5 w-3.5" />
              <span>Search...</span>
              <kbd className="flex items-center gap-0.5 ml-2 text-[10px] text-muted-foreground/60">
                <Command className="h-2.5 w-2.5" />K
              </kbd>
            </button>
            {isMobile && (
              <button
                onClick={() => setCmdOpen(true)}
                className="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground active:scale-95"
                aria-label="Search"
              >
                <Search className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground active:scale-95"
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <div className="hidden md:block h-6 w-px bg-border mx-1" />
            <button
              ref={profileBtnRef}
              onClick={() => setProfileOpen(p => !p)}
              className="flex items-center gap-2 md:gap-2.5 pl-1 pr-1 py-1 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer active:scale-[0.97]"
              aria-haspopup="true"
              aria-expanded={profileOpen}
            >
              <div className="h-8 w-8 rounded-full gold-gradient flex items-center justify-center text-xs font-bold text-white shrink-0 ring-2 ring-primary/20">
                {initials}
              </div>
              <div className="hidden md:flex flex-col min-w-0">
                <span className="text-sm font-medium text-foreground truncate max-w-[140px] text-left">
                  {profile.display_name || profile.email}
                </span>
                <span className="text-[10px] text-primary font-medium uppercase tracking-wide -mt-0.5 text-left">
                  {role}
                </span>
              </div>
            </button>
            {profileOpen && createPortal(
              <div
                ref={dropdownRef}
                className="fixed w-56 bg-card border border-border rounded-xl shadow-2xl py-1.5 animate-in fade-in slide-in-from-top-2 duration-150"
                style={{ zIndex: 99999, top: dropdownPos.top, right: dropdownPos.right }}
              >
                <div className="px-3 py-2.5 border-b border-border">
                  <div className="text-sm font-medium text-foreground truncate">{profile.display_name || "Admin"}</div>
                  <div className="text-xs text-muted-foreground truncate">{profile.email}</div>
                </div>
                <button
                  onClick={() => { setProfileOpen(false); setLocation("/profile"); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-accent/50 transition-colors"
                >
                  <User className="h-4 w-4 text-muted-foreground" />
                  Profile Settings
                </button>
                <button
                  onClick={() => { setProfileOpen(false); setLocation("/settings/appearance"); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-accent/50 transition-colors"
                >
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  App Settings
                </button>
                <div className="border-t border-border mt-1 pt-1">
                  <button
                    onClick={() => { setProfileOpen(false); signOut(); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </div>
              </div>,
              document.body
            )}
          </div>
        </header>

        <main className="flex-1 overflow-auto scroll-smooth">
          <div className="p-3 md:p-6 lg:p-8 max-w-[1600px] animate-fade-in">
            {children}
          </div>
        </main>
      </div>

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} role={role} />
    </div>
  );
}
