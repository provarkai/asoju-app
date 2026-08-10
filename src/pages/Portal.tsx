import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import {
  Bell,
  FilePlus2,
  LayoutDashboard,
  LogOut,
  Menu,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { HomeView } from "./portal/HomeView";
import { NewRequestView } from "./portal/NewRequestView";
import { CaseDetailView } from "./portal/CaseDetailView";
import { ProfileView } from "./portal/ProfileView";

const NAV = [
  { key: "home", label: "My cases", path: "/dashboard", icon: LayoutDashboard },
  { key: "new", label: "New request", path: "/dashboard/new", icon: FilePlus2 },
  { key: "profile", label: "Profile", path: "/dashboard/profile", icon: UserRound },
];

export default function Portal() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const params = useParams();
  const caseId = params.caseId;

  const dashboard = useQuery(api.cases.getDashboard);
  const ensureOnboarded = useMutation(api.profile.ensureOnboarded);
  const markRead = useMutation(api.profile.markNotificationsRead);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const onboardingStarted = useRef(false);

  useEffect(() => {
    // ensureOnboarded is idempotent — creates the profile + seeds the demo
    // portfolio once, on first authenticated visit.
    if (!onboardingStarted.current) {
      onboardingStarted.current = true;
      ensureOnboarded({}).catch(() => {});
    }
  }, [ensureOnboarded]);

  const activeKey = caseId
    ? "case"
    : window.location.pathname === "/dashboard/new"
      ? "new"
      : window.location.pathname === "/dashboard/profile"
        ? "profile"
        : "home";

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const notifications = dashboard?.notifications ?? [];
  const unread = dashboard?.unread ?? 0;

  const openNotifications = () => {
    setNotifOpen(true);
    if (unread > 0) markRead();
  };

  return (
    <div className="flex min-h-screen bg-ivory">
      {/* ------------------------------- Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-forest text-ivory lg:flex">
        <div className="flex h-16 items-center gap-2.5 border-b border-ivory/10 px-5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-gold/20 font-display text-lg font-bold text-gold-light">
            A
          </span>
          <div>
            <p className="font-display text-lg font-semibold leading-none">ASOJU</p>
            <p className="mt-0.5 text-[10px] text-ivory/50">Customer portal</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-4">
          {NAV.map((item) => (
            <button
              key={item.key}
              onClick={() => {
                navigate(item.path);
                setMenuOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all",
                activeKey === item.key
                  ? "bg-gold/15 text-gold-light shadow-inner"
                  : "text-ivory/65 hover:bg-ivory/8 hover:text-ivory",
              )}
            >
              <item.icon className="size-4.5" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="space-y-1 border-t border-ivory/10 p-4">
          <button
            onClick={openNotifications}
            className="relative flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-ivory/65 transition-all hover:bg-ivory/8 hover:text-ivory"
          >
            <Bell className="size-4.5" />
            Notifications
            {unread > 0 && (
              <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-gold text-[10px] font-bold text-forest-deep">
                {unread}
              </span>
            )}
          </button>
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-ivory/65 transition-all hover:bg-ivory/8 hover:text-ivory"
          >
            <LogOut className="size-4.5" />
            Sign out
          </button>
        </div>
      </aside>

      {/* ------------------------------- Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-forest/10 bg-ivory/90 px-4 backdrop-blur lg:hidden">
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-2"
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-forest font-display text-base font-bold text-gold-light">
            A
          </span>
          <span className="font-display text-lg font-semibold text-forest">ASOJU</span>
        </button>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={openNotifications} className="relative">
            <Bell className="size-5 text-forest" />
            {unread > 0 && (
              <span className="absolute right-1 top-1 size-4 rounded-full bg-gold text-[9px] font-bold text-forest-deep flex items-center justify-center">
                {unread}
              </span>
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Menu"
          >
            {menuOpen ? <X className="size-5 text-forest" /> : <Menu className="size-5 text-forest" />}
          </Button>
        </div>
      </div>

      {menuOpen && (
        <div className="fixed inset-x-0 top-14 z-30 border-b border-forest/10 bg-ivory p-3 shadow-lg lg:hidden">
          <div className="grid gap-1">
            {NAV.map((item) => (
              <button
                key={item.key}
                onClick={() => {
                  navigate(item.path);
                  setMenuOpen(false);
                }}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium",
                  activeKey === item.key
                    ? "bg-forest text-gold-light"
                    : "text-forest hover:bg-forest/5",
                )}
              >
                <item.icon className="size-4.5" />
                {item.label}
              </button>
            ))}
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-forest hover:bg-forest/5"
            >
              <LogOut className="size-4.5" />
              Sign out
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------- Notifications panel */}
      {notifOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/40 lg:hidden"
          onClick={() => setNotifOpen(false)}
        >
          <NotifPanel
            notifications={notifications}
            onClose={() => setNotifOpen(false)}
          />
        </div>
      )}
      {notifOpen && (
        <div className="fixed inset-y-0 right-0 z-50 hidden lg:block" onClick={() => setNotifOpen(false)}>
          <NotifPanel
            notifications={notifications}
            onClose={() => setNotifOpen(false)}
          />
        </div>
      )}

      {/* ------------------------------- Main */}
      <main className="flex-1 px-4 pb-16 pt-[4.5rem] sm:px-6 lg:px-10 lg:pt-8">
        <div className="mx-auto max-w-5xl">
          {caseId ? (
            <CaseDetailView caseId={caseId} />
          ) : activeKey === "new" ? (
            <NewRequestView />
          ) : activeKey === "profile" ? (
            <ProfileView />
          ) : (
            <HomeView />
          )}
        </div>
      </main>
    </div>
  );
}

function NotifPanel({
  notifications,
  onClose,
}: {
  notifications: { _id: string; title: string; body: string; readAt?: number; createdAt: number }[];
  onClose: () => void;
}) {
  return (
    <div
      className="flex h-full w-80 flex-col border-l border-forest/10 bg-white shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between border-b border-forest/10 px-5 py-4">
        <p className="font-display text-lg font-semibold text-forest">Notifications</p>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {notifications.length === 0 && (
          <p className="py-10 text-center text-sm text-forest/50">
            You're all caught up.
          </p>
        )}
        {notifications.map((n) => (
          <div
            key={n._id}
            className={cn(
              "rounded-xl border p-3.5 transition-colors hover:border-forest/25",
              n.readAt ? "border-forest/8 bg-white" : "border-gold/40 bg-gold/5",
            )}
          >
            <p className="text-sm font-semibold text-forest">{n.title}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-forest/60">{n.body}</p>
            <p className="mt-1.5 text-[10px] text-forest/40">
              {new Date(n.createdAt).toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
