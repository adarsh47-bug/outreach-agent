/**
 * Sidebar navigation component — V3.
 * Dark-themed collapsible sidebar with 7 navigation sections.
 */

import { useState } from "react";
import {
  LayoutDashboard,
  FileText,
  Users,
  Megaphone,
  GitBranch,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  LogOut,
  Menu,
  Zap,
} from "lucide-react";
import { User } from "firebase/auth";

export type NavSection =
  | "dashboard"
  | "resume"
  | "contacts"
  | "campaigns"
  | "pipeline"
  | "reports"
  | "settings";

interface NavItem {
  id: NavSection;
  label: string;
  icon: React.ElementType;
  badge?: number | string;
}

interface SidebarProps {
  activeSection: NavSection;
  onNavigate: (section: NavSection) => void;
  user: User | null;
  onSignIn: () => void;
  onSignOut: () => void;
  badges?: Partial<Record<NavSection, number>>;
}

const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "resume", label: "Resume", icon: FileText },
  { id: "contacts", label: "Contacts", icon: Users },
  { id: "campaigns", label: "Campaigns", icon: Megaphone },
  { id: "pipeline", label: "Pipeline", icon: GitBranch },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
];

export default function Sidebar({
  activeSection,
  onNavigate,
  user,
  onSignIn,
  onSignOut,
  badges = {},
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile hamburger */}
      <button
        className="fixed top-4 left-4 z-50 md:hidden bg-slate-900 text-white p-2 rounded-lg shadow-lg"
        onClick={() => setMobileOpen(!mobileOpen)}
        id="sidebar-mobile-toggle"
      >
        <Menu className="w-4 h-4" />
      </button>

      {/* Sidebar */}
      <aside
        className={`sidebar ${collapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}
      >
        {/* Logo */}
        <div className="sidebar-logo">
          <div
            style={{
              background: "linear-gradient(135deg, #6366f1, #818cf8)",
              borderRadius: "10px",
              padding: "7px",
              flexShrink: 0,
            }}
          >
            <Zap className="w-4 h-4 text-white" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="text-white font-bold text-sm font-display leading-none">
                Outreach AI
              </p>
              <p className="text-slate-500 text-[10px] mt-0.5 font-mono">
                Personal Recruiter
              </p>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="ml-auto text-slate-600 hover:text-slate-400 transition-colors p-1 rounded hidden md:flex"
            id="sidebar-collapse-btn"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="w-3.5 h-3.5" />
            ) : (
              <ChevronLeft className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* Nav section label */}
        {!collapsed && (
          <div className="sidebar-section-label">Navigation</div>
        )}

        {/* Nav items */}
        <nav className="flex-1 py-2 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            const badge = badges[item.id];
            return (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                onClick={() => {
                  onNavigate(item.id);
                  setMobileOpen(false);
                }}
                className={`sidebar-nav-item w-full text-left ${isActive ? "active" : ""}`}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="nav-icon" />
                {!collapsed && (
                  <>
                    <span className="flex-1 truncate">{item.label}</span>
                    {badge !== undefined && badge > 0 && (
                      <span className="nav-badge">{badge}</span>
                    )}
                  </>
                )}
                {collapsed && badge !== undefined && badge > 0 && (
                  <span
                    style={{
                      position: "absolute",
                      right: "8px",
                      top: "8px",
                      background: "#6366f1",
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                    }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Divider */}
        <div style={{ borderTop: "1px solid #1e293b", margin: "0 16px" }} />

        {/* User section */}
        <div className="sidebar-user">
          {user ? (
            <>
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || "User"}
                  className="w-8 h-8 rounded-full border border-slate-700 flex-shrink-0"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ background: "linear-gradient(135deg, #6366f1, #818cf8)" }}
                >
                  {user.displayName?.[0] || user.email?.[0] || "A"}
                </div>
              )}
              {!collapsed && (
                <div className="flex-1 overflow-hidden">
                  <p className="text-slate-200 text-xs font-semibold truncate leading-none">
                    {user.displayName || "User"}
                  </p>
                  <p className="text-slate-500 text-[10px] truncate mt-0.5">
                    {user.email}
                  </p>
                </div>
              )}
              <button
                onClick={onSignOut}
                className="text-slate-600 hover:text-red-400 transition-colors p-1 rounded flex-shrink-0"
                title="Sign Out"
                id="sidebar-signout-btn"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <button
              onClick={onSignIn}
              className="btn-primary w-full justify-center text-xs py-2"
              id="sidebar-signin-btn"
            >
              {!collapsed && <Sparkles className="w-3 h-3" />}
              {!collapsed ? "Sign in with Google" : <Sparkles className="w-4 h-4" />}
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
