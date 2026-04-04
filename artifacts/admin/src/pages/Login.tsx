import { useState, useEffect, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Lock, Mail, ArrowRight } from "lucide-react";

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30_000;
const LOCKOUT_STORAGE_KEY = "stayguided-admin-lockout";
const ATTEMPTS_STORAGE_KEY = "stayguided-admin-attempts";

function getStoredLockout(): { attempts: number; lockedUntil: number | null } {
  try {
    const attempts = parseInt(sessionStorage.getItem(ATTEMPTS_STORAGE_KEY) || "0", 10);
    const until = sessionStorage.getItem(LOCKOUT_STORAGE_KEY);
    const lockedUntil = until ? parseInt(until, 10) : null;
    if (lockedUntil && Date.now() >= lockedUntil) {
      sessionStorage.removeItem(LOCKOUT_STORAGE_KEY);
      sessionStorage.removeItem(ATTEMPTS_STORAGE_KEY);
      return { attempts: 0, lockedUntil: null };
    }
    return { attempts, lockedUntil };
  } catch {
    return { attempts: 0, lockedUntil: null };
  }
}

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
}

function FloatingParticles() {
  const particles = useMemo<Particle[]>(() =>
    Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
      duration: Math.random() * 15 + 10,
      delay: Math.random() * -20,
      opacity: Math.random() * 0.3 + 0.1,
    })),
    []
  );

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full bg-primary particle-float"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            opacity: p.opacity,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            "--random-x": (Math.random() - 0.5) * 80,
            "--random-y": (Math.random() - 0.5) * 80,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { signIn, accessDenied, profile } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(() => getStoredLockout().attempts);
  const [lockedUntil, setLockedUntil] = useState<number | null>(() => getStoredLockout().lockedUntil);
  const [lockCountdown, setLockCountdown] = useState(0);
  const lockTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [mounted, setMounted] = useState(false);

  const isLocked = lockedUntil !== null && Date.now() < lockedUntil;

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (profile) {
      setLocation("/");
    }
  }, [profile, setLocation]);

  useEffect(() => {
    if (accessDenied) {
      toast({
        variant: "destructive",
        title: "Access denied",
        description: "No admin profile found for this account. Contact your administrator.",
      });
    }
  }, [accessDenied, toast]);

  useEffect(() => {
    if (!lockedUntil) return;
    const update = () => {
      const remaining = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
      setLockCountdown(remaining);
      if (remaining <= 0) {
        setLockedUntil(null);
        setFailedAttempts(0);
        try {
          sessionStorage.removeItem(LOCKOUT_STORAGE_KEY);
          sessionStorage.removeItem(ATTEMPTS_STORAGE_KEY);
        } catch {}
        if (lockTimerRef.current) clearInterval(lockTimerRef.current);
      }
    };
    update();
    lockTimerRef.current = setInterval(update, 1000);
    return () => { if (lockTimerRef.current) clearInterval(lockTimerRef.current); };
  }, [lockedUntil]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) return;
    setIsLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);

      try {
        sessionStorage.setItem(ATTEMPTS_STORAGE_KEY, String(newAttempts));
      } catch {}

      if (newAttempts >= MAX_ATTEMPTS) {
        const until = Date.now() + LOCKOUT_MS;
        setLockedUntil(until);
        try { sessionStorage.setItem(LOCKOUT_STORAGE_KEY, String(until)); } catch {}
        toast({
          variant: "destructive",
          title: "Too many failed attempts",
          description: `Login disabled for ${LOCKOUT_MS / 1000} seconds.`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Login failed",
          description: error,
        });
      }
      setIsLoading(false);
      return;
    }

    setFailedAttempts(0);
    setLockedUntil(null);
    try {
      sessionStorage.removeItem(ATTEMPTS_STORAGE_KEY);
      sessionStorage.removeItem(LOCKOUT_STORAGE_KEY);
    } catch {}
    setLocation("/");
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast({
        title: "Enter your email",
        description: "Please enter your email address above, then click Forgot password.",
      });
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      toast({ title: "Check your email", description: "A password reset link has been sent if the account exists." });
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-background relative overflow-hidden p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-primary/8 via-transparent to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-primary/8 via-transparent to-transparent rounded-full blur-3xl" />
        <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-primary/5 rounded-full blur-3xl animate-pulse" style={{ animationDuration: "4s" }} />
        <div className="absolute bottom-1/3 left-1/4 w-48 h-48 bg-primary/3 rounded-full blur-3xl animate-pulse" style={{ animationDuration: "6s", animationDelay: "2s" }} />
      </div>

      <FloatingParticles />

      <div
        className={`w-full max-w-[420px] space-y-8 relative z-10 transition-all duration-700 ease-out ${
          mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
        }`}
      >
        <div className="text-center space-y-3">
          <div className="flex justify-center mb-5">
            <div className="h-16 w-16 md:h-18 md:w-18 rounded-2xl gold-gradient flex items-center justify-center shadow-xl shadow-primary/25 login-logo-pulse">
              <span className="text-xl md:text-2xl font-bold text-white">SG</span>
            </div>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">StayGuided Me</h1>
          <p className="text-sm text-muted-foreground">Admin Control Panel</p>
        </div>

        <div className="bg-card/80 backdrop-blur-xl border border-border/60 rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-5 sm:p-6 md:p-8">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-foreground">Welcome back</h2>
              <p className="text-sm text-muted-foreground mt-1">Sign in to manage your platform</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">Email address</Label>
                <div className="relative group">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@stayguided.me"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-background/50 pl-10 h-11 border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                    autoComplete="email"
                    disabled={isLocked}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-xs text-primary hover:text-primary/80 transition-colors font-medium"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative group">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="bg-background/50 pl-10 pr-10 h-11 border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                    autoComplete="current-password"
                    disabled={isLocked}
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {isLocked && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-center animate-in fade-in duration-300">
                  <p className="text-xs text-destructive font-medium">
                    Too many failed attempts. Try again in {lockCountdown}s
                  </p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-11 gold-gradient text-white font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:opacity-95 transition-all duration-200 group active:scale-[0.98]"
                disabled={isLoading || isLocked}
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Signing in...
                  </div>
                ) : isLocked ? (
                  `Locked (${lockCountdown}s)`
                ) : (
                  <span className="flex items-center gap-2">
                    Sign in
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                )}
              </Button>
            </form>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground/60">
          Secure admin access &middot; StayGuided Me
        </p>
      </div>
    </div>
  );
}
