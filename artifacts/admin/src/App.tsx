import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import { SidebarProvider } from "@/components/Sidebar";
import { SUPABASE_KEY_MISSING } from "@/lib/supabase";
import { Suspense, lazy } from "react";
import type { AdminRole } from "@/lib/types";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

const LoginPage = lazy(() => import("@/pages/Login"));
const AdminLayout = lazy(() => import("@/components/AdminLayout"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));

const Categories = lazy(() => import("@/pages/content/Categories"));
const Series = lazy(() => import("@/pages/content/Series"));
const Episodes = lazy(() => import("@/pages/content/Episodes"));
const Reciters = lazy(() => import("@/pages/content/Reciters"));
const ContentReports = lazy(() => import("@/pages/content/ContentReports"));
const PlayCounts = lazy(() => import("@/pages/content/PlayCounts"));

const JourneyTimeline = lazy(() => import("@/pages/journey/JourneyTimeline"));

const FeedManager = lazy(() => import("@/pages/feed/FeedManager"));
const WidgetInjection = lazy(() => import("@/pages/feed/WidgetInjection"));

const UsersList = lazy(() => import("@/pages/users/UsersList"));
const UserDetail = lazy(() => import("@/pages/users/UserDetail"));

const Transactions = lazy(() => import("@/pages/monetization/Transactions"));
const SubscriptionPlans = lazy(() => import("@/pages/monetization/SubscriptionPlans"));
const Coupons = lazy(() => import("@/pages/monetization/Coupons"));
const DonationSettings = lazy(() => import("@/pages/monetization/DonationSettings"));

const QuizBuilder = lazy(() => import("@/pages/gamification/QuizBuilder"));
const BadgeManager = lazy(() => import("@/pages/gamification/BadgeManager"));
const Leaderboard = lazy(() => import("@/pages/gamification/Leaderboard"));

const PushNotifications = lazy(() => import("@/pages/notifications/PushNotifications"));
const PopupsNoticeBar = lazy(() => import("@/pages/notifications/PopupsNoticeBar"));
const ContactMessages = lazy(() => import("@/pages/notifications/ContactMessages"));

const Analytics = lazy(() => import("@/pages/analytics/Analytics"));

const FeatureFlags = lazy(() => import("@/pages/settings/FeatureFlags"));
const AppSettingsGuest = lazy(() => import("@/pages/settings/AppSettingsGuest"));
const AppSettingsQuran = lazy(() => import("@/pages/settings/AppSettingsQuran"));
const AppSettingsDownloads = lazy(() => import("@/pages/settings/AppSettingsDownloads"));
const AppSettingsXP = lazy(() => import("@/pages/settings/AppSettingsXP"));
const AppSettingsAppearance = lazy(() => import("@/pages/settings/AppSettingsAppearance"));
const RamadanMode = lazy(() => import("@/pages/settings/RamadanMode"));
const ReferralSettings = lazy(() => import("@/pages/settings/ReferralSettings"));
const ApiSources = lazy(() => import("@/pages/settings/ApiSources"));
const RateLimiting = lazy(() => import("@/pages/settings/RateLimiting"));

const HadithManager = lazy(() => import("@/pages/hadith/HadithManager"));

const AdminUsers = lazy(() => import("@/pages/admin/AdminUsers"));
const ActivityLog = lazy(() => import("@/pages/admin/ActivityLog"));
const ProfileSettings = lazy(() => import("@/pages/ProfileSettings"));

const NotFound = lazy(() => import("@/pages/not-found"));

function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, accessDenied } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (profile) return <>{children}</>;
  if (!user || accessDenied) return <Redirect to="/login" />;
  return <>{children}</>;
}

function RequirePermission({ children, minRole, exactRole }: {
  children: React.ReactNode;
  minRole?: AdminRole;
  exactRole?: AdminRole;
}) {
  const { isAtLeast, role, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (exactRole && role !== exactRole) return <Redirect to="/" />;
  if (minRole && !isAtLeast(minRole)) return <Redirect to="/" />;
  return <>{children}</>;
}

function DashboardOrRedirect() {
  const { isAtLeast, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!isAtLeast("content")) return <Redirect to="/notifications/contact" />;
  return <Dashboard />;
}

function Router() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Switch>
        <Route path="/login" component={LoginPage} />

        <Route path="/">
          <RequireAuth>
            <AdminLayout>
              <DashboardOrRedirect />
            </AdminLayout>
          </RequireAuth>
        </Route>

        <Route path="/content/categories">
          <RequireAuth>
            <AdminLayout>
              <Categories />
            </AdminLayout>
          </RequireAuth>
        </Route>

        <Route path="/content/series">
          <RequireAuth>
            <AdminLayout>
              <Series />
            </AdminLayout>
          </RequireAuth>
        </Route>

        <Route path="/content/episodes">
          <RequireAuth>
            <AdminLayout>
              <Episodes />
            </AdminLayout>
          </RequireAuth>
        </Route>

        <Route path="/content/reciters">
          <RequireAuth>
            <AdminLayout>
              <Reciters />
            </AdminLayout>
          </RequireAuth>
        </Route>

        <Route path="/content/reports">
          <RequireAuth>
            <AdminLayout>
              <ContentReports />
            </AdminLayout>
          </RequireAuth>
        </Route>

        <Route path="/content/play-stats">
          <RequireAuth>
            <AdminLayout>
              <PlayCounts />
            </AdminLayout>
          </RequireAuth>
        </Route>

        <Route path="/journey">
          <RequireAuth>
            <AdminLayout>
              <JourneyTimeline />
            </AdminLayout>
          </RequireAuth>
        </Route>

        <Route path="/feed">
          <RequireAuth>
            <AdminLayout>
              <FeedManager />
            </AdminLayout>
          </RequireAuth>
        </Route>

        <Route path="/feed/widgets">
          <RequireAuth>
            <AdminLayout>
              <WidgetInjection />
            </AdminLayout>
          </RequireAuth>
        </Route>

        <Route path="/users">
          <RequireAuth>
            <RequirePermission minRole="admin">
              <AdminLayout>
                <UsersList />
              </AdminLayout>
            </RequirePermission>
          </RequireAuth>
        </Route>

        <Route path="/users/:id">
          {(params) => (
            <RequireAuth>
              <RequirePermission minRole="admin">
                <AdminLayout>
                  <UserDetail userId={params.id} />
                </AdminLayout>
              </RequirePermission>
            </RequireAuth>
          )}
        </Route>

        <Route path="/monetization/transactions">
          <RequireAuth>
            <RequirePermission minRole="admin">
              <AdminLayout>
                <Transactions />
              </AdminLayout>
            </RequirePermission>
          </RequireAuth>
        </Route>

        <Route path="/monetization/plans">
          <RequireAuth>
            <RequirePermission minRole="admin">
              <AdminLayout>
                <SubscriptionPlans />
              </AdminLayout>
            </RequirePermission>
          </RequireAuth>
        </Route>

        <Route path="/monetization/coupons">
          <RequireAuth>
            <RequirePermission minRole="admin">
              <AdminLayout>
                <Coupons />
              </AdminLayout>
            </RequirePermission>
          </RequireAuth>
        </Route>

        <Route path="/monetization/donation">
          <RequireAuth>
            <RequirePermission minRole="admin">
              <AdminLayout>
                <DonationSettings />
              </AdminLayout>
            </RequirePermission>
          </RequireAuth>
        </Route>

        <Route path="/gamification/quiz">
          <RequireAuth>
            <AdminLayout>
              <QuizBuilder />
            </AdminLayout>
          </RequireAuth>
        </Route>

        <Route path="/gamification/badges">
          <RequireAuth>
            <AdminLayout>
              <BadgeManager />
            </AdminLayout>
          </RequireAuth>
        </Route>

        <Route path="/gamification/leaderboard">
          <RequireAuth>
            <AdminLayout>
              <Leaderboard />
            </AdminLayout>
          </RequireAuth>
        </Route>

        <Route path="/notifications/push">
          <RequireAuth>
            <AdminLayout>
              <PushNotifications />
            </AdminLayout>
          </RequireAuth>
        </Route>

        <Route path="/notifications/popups">
          <RequireAuth>
            <AdminLayout>
              <PopupsNoticeBar />
            </AdminLayout>
          </RequireAuth>
        </Route>

        <Route path="/notifications/contact">
          <RequireAuth>
            <AdminLayout>
              <ContactMessages />
            </AdminLayout>
          </RequireAuth>
        </Route>

        <Route path="/analytics">
          <RequireAuth>
            <RequirePermission minRole="content">
              <AdminLayout>
                <Analytics />
              </AdminLayout>
            </RequirePermission>
          </RequireAuth>
        </Route>

        <Route path="/hadith">
          <RequireAuth>
            <AdminLayout>
              <HadithManager />
            </AdminLayout>
          </RequireAuth>
        </Route>

        <Route path="/settings/feature-flags">
          <RequireAuth>
            <RequirePermission minRole="admin">
              <AdminLayout>
                <FeatureFlags />
              </AdminLayout>
            </RequirePermission>
          </RequireAuth>
        </Route>

        <Route path="/settings/guest-access">
          <RequireAuth>
            <RequirePermission minRole="super_admin">
              <AdminLayout>
                <AppSettingsGuest />
              </AdminLayout>
            </RequirePermission>
          </RequireAuth>
        </Route>

        <Route path="/settings/quran">
          <RequireAuth>
            <RequirePermission minRole="super_admin">
              <AdminLayout>
                <AppSettingsQuran />
              </AdminLayout>
            </RequirePermission>
          </RequireAuth>
        </Route>

        <Route path="/settings/downloads">
          <RequireAuth>
            <RequirePermission minRole="super_admin">
              <AdminLayout>
                <AppSettingsDownloads />
              </AdminLayout>
            </RequirePermission>
          </RequireAuth>
        </Route>

        <Route path="/settings/xp">
          <RequireAuth>
            <RequirePermission minRole="super_admin">
              <AdminLayout>
                <AppSettingsXP />
              </AdminLayout>
            </RequirePermission>
          </RequireAuth>
        </Route>

        <Route path="/settings/appearance">
          <RequireAuth>
            <RequirePermission minRole="super_admin">
              <AdminLayout>
                <AppSettingsAppearance />
              </AdminLayout>
            </RequirePermission>
          </RequireAuth>
        </Route>

        <Route path="/settings/ramadan">
          <RequireAuth>
            <RequirePermission minRole="admin">
              <AdminLayout>
                <RamadanMode />
              </AdminLayout>
            </RequirePermission>
          </RequireAuth>
        </Route>

        <Route path="/settings/referral">
          <RequireAuth>
            <RequirePermission minRole="admin">
              <AdminLayout>
                <ReferralSettings />
              </AdminLayout>
            </RequirePermission>
          </RequireAuth>
        </Route>

        <Route path="/settings/rate-limiting">
          <RequireAuth>
            <RequirePermission minRole="admin">
              <AdminLayout>
                <RateLimiting />
              </AdminLayout>
            </RequirePermission>
          </RequireAuth>
        </Route>

        <Route path="/settings/api-sources">
          <RequireAuth>
            <RequirePermission minRole="admin">
              <AdminLayout>
                <ApiSources />
              </AdminLayout>
            </RequirePermission>
          </RequireAuth>
        </Route>

        <Route path="/staff/users">
          <RequireAuth>
            <RequirePermission minRole="super_admin">
              <AdminLayout>
                <AdminUsers />
              </AdminLayout>
            </RequirePermission>
          </RequireAuth>
        </Route>

        <Route path="/staff/activity-log">
          <RequireAuth>
            <RequirePermission minRole="admin">
              <AdminLayout>
                <ActivityLog />
              </AdminLayout>
            </RequirePermission>
          </RequireAuth>
        </Route>
        <Route path="/profile">
          <RequireAuth>
            <AdminLayout>
              <ProfileSettings />
            </AdminLayout>
          </RequireAuth>
        </Route>

        <Route path="/settings">
          <Redirect to="/settings/feature-flags" />
        </Route>

        <Route path="/monetization/subscriptions">
          <Redirect to="/monetization/plans" />
        </Route>

        <Route path="/monetization">
          <Redirect to="/monetization/plans" />
        </Route>

        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function ThemedSonner() {
  const { theme } = useTheme();
  return <SonnerToaster position="top-right" richColors theme={theme} />;
}

function MissingKeyScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#080F1C] text-white p-8">
      <div className="max-w-md text-center space-y-4">
        <div className="w-16 h-16 bg-[#D4A030] rounded-full flex items-center justify-center mx-auto text-2xl">⚠️</div>
        <h1 className="text-xl font-bold">Supabase Configuration Required</h1>
        <p className="text-gray-400 text-sm">
          The <code className="text-[#D4A030]">EXPO_PUBLIC_SUPABASE_ANON_KEY</code> secret is not set.
          Please add your Supabase anon key in the Secrets tab, then reload this page.
        </p>
        <p className="text-gray-500 text-xs">
          Find this key in your Supabase dashboard → Settings → API → anon/public key.
        </p>
      </div>
    </div>
  );
}

function App() {
  if (SUPABASE_KEY_MISSING) return <MissingKeyScreen />;
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <AuthProvider>
            <SidebarProvider>
              <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                <Router />
              </WouterRouter>
            </SidebarProvider>
          </AuthProvider>
          <Toaster />
          <ThemedSonner />
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
