import React, { useState } from "react";
import {
  Home,
  User,
  LogOut,
  Cloud,
  CloudOff,
  Zap,
  ArrowUpRight,
  Download,
  Compass,
  Plus,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "../i18n";
import { ThemePicker } from "./ThemePicker";
import { useTheme, cardSurfaceClasses } from "../theme";

interface LayoutProps {
  children: React.ReactNode;
  onOpenAuth: () => void;
  onSignOut: () => void;
  onAddItem?: () => void;
  onExploreSamples?: () => void;
  sampleCollectionId?: string | null;
  onImportLocal?: () => void;
  hasLocalImport?: boolean;
  importState?: "idle" | "running" | "done" | "error";
  importMessage?: string | null;
  user: any | null;
  isSupabaseConfigured: boolean;
  headerExtras?: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  onOpenAuth,
  onSignOut,
  onAddItem,
  onExploreSamples,
  sampleCollectionId = null,
  onImportLocal,
  hasLocalImport = false,
  importState = "idle",
  importMessage = null,
  user,
  isSupabaseConfigured,
  headerExtras,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const location = useLocation();
  const isHome = location.pathname === "/";
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const isAuthenticated = Boolean(user);
  const statusLabel = !isSupabaseConfigured
    ? t("cloudRequiredStatus")
    : isAuthenticated
      ? t("authStatusSignedIn")
      : t("authStatusSignedOut");
  const statusDesc = !isSupabaseConfigured
    ? t("cloudRequiredDesc")
    : isAuthenticated
      ? t("authDescSignedIn", { email: user?.email })
      : t("authDescSignedOut");
  const statusIcon = !isSupabaseConfigured ? (
    <CloudOff size={18} />
  ) : (
    <Cloud size={18} />
  );
  const statusColor = !isSupabaseConfigured
    ? theme === "vault"
      ? "text-stone-400"
      : "text-stone-400"
    : isAuthenticated
      ? theme === "vault"
        ? "text-emerald-300"
        : "text-emerald-600"
      : theme === "vault"
        ? "text-amber-200"
        : "text-amber-600";
  const shellClass = theme === "vault" ? "text-white" : "text-stone-800";
  const headerSurface =
    theme === "vault"
      ? "bg-stone-900/80 border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.35)]"
      : theme === "atelier"
        ? "bg-[#f8f6f1]/85 border-[#e6e1d5] shadow-sm"
        : "bg-white/85 border-stone-200/70 shadow-sm";
  const navGhost =
    theme === "vault"
      ? "hover:bg-white/10 text-white/70 hover:text-white"
      : "hover:bg-stone-100 text-stone-500 hover:text-stone-900";
  const dropdownSurface = cardSurfaceClasses[theme];
  const borderClass =
    theme === "vault" ? "border-white/10" : "border-stone-100";
  const footerGradient =
    theme === "vault"
      ? "from-stone-950 via-stone-950 to-transparent"
      : theme === "atelier"
        ? "from-[#f8f6f1] via-[#f8f6f1] to-transparent"
        : "from-stone-50 via-stone-50 to-transparent";
  const bottomNavSurface =
    theme === "vault"
      ? "bg-stone-900/95 border-white/10"
      : theme === "atelier"
        ? "bg-[#f8f6f1]/95 border-[#e6e1d5]"
        : "bg-white/95 border-stone-200/70";
  const bottomNavMuted = theme === "vault" ? "text-white/60" : "text-stone-400";
  const isExploreActive = sampleCollectionId
    ? location.pathname.startsWith(`/collection/${sampleCollectionId}`)
    : false;
  const handleAddItem = onAddItem ?? (() => {});
  const handleExploreSamples = onExploreSamples ?? (() => {});
  const addLabelClass = theme === "vault" ? "text-white" : "text-stone-900";

  return (
    <div
      className={`min-h-screen min-h-[100dvh] font-sans selection:bg-amber-200 transition-colors ${shellClass}`}
    >
      <header
        className={`sticky top-0 z-20 backdrop-blur-md border-b pt-[env(safe-area-inset-top,0px)] ${headerSurface}`}
      >
        <div className="max-w-4xl mx-auto px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <Link to="/" className="flex items-center gap-2 group">
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center font-serif font-bold text-xl transition-colors ${theme === "vault" ? "bg-white text-stone-900 group-hover:bg-amber-400" : "bg-stone-900 text-white group-hover:bg-amber-600"}`}
            >
              C
            </div>
            <span className="font-serif text-xl font-bold tracking-tight leading-none">
              {t("appTitle")}
            </span>
          </Link>

          <nav className="flex items-center gap-2 flex-wrap justify-end">
            {headerExtras}

            <div className="relative">
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className={`p-2 rounded-full transition-colors ${navGhost} ${statusColor}`}
              >
                <User size={20} />
              </button>

              {isProfileOpen && (
                <div
                  className={`absolute right-0 mt-2 w-72 max-w-[calc(100vw-2rem)] ${dropdownSurface} rounded-[1.5rem] shadow-2xl border p-2 animate-in slide-in-from-top-2 duration-200 z-50`}
                >
                  <div className={`p-4 border-b ${borderClass} mb-1`}>
                    <p className="text-[12px] font-bold uppercase tracking-[0.14em] opacity-70 mb-1">
                      {t("authStatus")}
                    </p>

                    <div className="flex items-start gap-3 mt-3">
                      <div
                        className={`p-2 rounded-xl ${isSupabaseConfigured ? (isAuthenticated ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600") : theme === "vault" ? "bg-white/10 text-white/60" : "bg-stone-50 text-stone-400"}`}
                      >
                        {statusIcon}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <p className="text-sm font-bold">{statusLabel}</p>
                        <p className="text-[12px] opacity-80 leading-snug">
                          {statusDesc}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="px-4 pb-3 pt-1">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] opacity-70 mb-2">
                      {t("themeSelection")}
                    </p>
                    <div className="w-full">
                      <ThemePicker layout="stacked" />
                    </div>
                  </div>

                  {isAuthenticated ? (
                    <button
                      onClick={() => {
                        onSignOut();
                        setIsProfileOpen(false);
                      }}
                      className={`w-full flex items-center gap-2 px-4 py-3 text-sm rounded-xl transition-colors font-medium ${theme === "vault" ? "text-white/70 hover:text-red-200 hover:bg-white/5" : "text-stone-400 hover:text-red-500 hover:bg-red-50"}`}
                    >
                      <LogOut size={16} />
                      {t("signOut")}
                    </button>
                  ) : (
                    <div className="p-2">
                      <button
                        onClick={() => {
                          onOpenAuth();
                          setIsProfileOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-4 py-3 text-sm rounded-xl transition-all font-bold ${theme === "vault" ? "bg-amber-500 text-stone-950 hover:bg-amber-400" : "bg-stone-900 text-white hover:bg-stone-800"}`}
                      >
                        <div className="flex items-center gap-2">
                          <Zap size={16} />
                          {t("login")}
                        </div>
                        <ArrowUpRight size={16} className="opacity-50" />
                      </button>
                    </div>
                  )}

                  {hasLocalImport && isAuthenticated && onImportLocal && (
                    <div className="p-2 border-t border-stone-50">
                      <div className="p-3 rounded-xl border border-amber-100 bg-amber-50/60">
                        <p className="text-[12px] font-bold text-amber-900 uppercase tracking-[0.18em] mb-1">
                          {t("importLocalTitle")}
                        </p>
                        <p className="text-[12px] text-stone-600 leading-snug mb-3">
                          {t("importLocalDesc")}
                        </p>
                        <button
                          onClick={onImportLocal}
                          disabled={importState === "running"}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-60"
                        >
                          <Download size={14} />
                          {importState === "running"
                            ? t("importing")
                            : t("importLocalAction")}
                        </button>
                        {importMessage && (
                          <p
                            className={`text-[12px] mt-2 ${importState === "error" ? "text-red-500" : "text-amber-700"}`}
                          >
                            {importMessage}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {!isHome && (
              <Link to="/">
                <button
                  className={`p-2 rounded-full transition-colors ${navGhost}`}
                >
                  <Home size={20} />
                </button>
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 pb-[calc(7rem+env(safe-area-inset-bottom,0px))]">
        {children}
      </main>

      <nav
        className={`fixed bottom-0 left-0 right-0 z-[60] border-t ${bottomNavSurface} sm:hidden`}
        aria-label="Primary"
      >
        <div className="mx-auto max-w-4xl px-6 pb-[env(safe-area-inset-bottom,0px)] pt-2">
          <div className="grid grid-cols-4 items-end">
            <Link
              to="/"
              className={`flex flex-col items-center gap-1 text-[11px] font-semibold transition-colors ${location.pathname === "/" ? "text-amber-500" : bottomNavMuted}`}
            >
              <Home size={18} />
              {t("navHome")}
            </Link>

            {sampleCollectionId ? (
              <Link
                to={`/collection/${sampleCollectionId}`}
                onClick={handleExploreSamples}
                className={`flex flex-col items-center gap-1 text-[11px] font-semibold transition-colors ${isExploreActive ? "text-amber-500" : bottomNavMuted}`}
              >
                <Compass size={18} />
                {t("exploreSample")}
              </Link>
            ) : (
              <button
                type="button"
                onClick={handleExploreSamples}
                className={`flex flex-col items-center gap-1 text-[11px] font-semibold transition-colors ${bottomNavMuted}`}
              >
                <Compass size={18} />
                {t("exploreSample")}
              </button>
            )}

            <button
              type="button"
              onClick={handleAddItem}
              className={`flex flex-col items-center gap-1 text-[11px] font-semibold ${addLabelClass}`}
            >
              <span className="-mt-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500 text-stone-900 shadow-lg shadow-amber-500/30">
                <Plus size={20} />
              </span>
              {t("addItem")}
            </button>

            <button
              type="button"
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className={`flex flex-col items-center gap-1 text-[11px] font-semibold transition-colors ${isProfileOpen ? "text-amber-500" : bottomNavMuted}`}
            >
              <User size={18} />
              {t("profile")}
            </button>
          </div>
        </div>
      </nav>

      <footer
        className={`fixed bottom-0 left-0 w-full bg-gradient-to-t ${footerGradient} pointer-events-none h-12 z-10`}
      />
    </div>
  );
};
