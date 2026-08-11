import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  X,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from '../i18n';
import { ThemeQuickToggle } from './ThemeQuickToggle';
import { useTheme, cardSurfaceClasses, dividerClasses } from '../theme';
import { AppTheme } from '../types';

type ProfileSource = 'header' | 'bottomNav';

// CUR-108: the profile menu's auth-status chip and local-import card hardcoded
// the Gallery 50-tone palette, so the "Signed In/Out" trust signal and the
// import explanation collapsed against Vault (dark) and Atelier (cream)
// surfaces. These records mirror the per-theme tone mapping established by
// StatusBanner/StatusToast (CUR-81 / CUR-88) so the surfaces feel like one
// system across all three themes.
const authChipSignedInClasses: Record<AppTheme, string> = {
  gallery: 'bg-emerald-50 text-emerald-600',
  vault: 'bg-emerald-500/15 text-emerald-300',
  atelier: 'bg-emerald-100/70 text-emerald-700',
};

const authChipSignedOutClasses: Record<AppTheme, string> = {
  gallery: 'bg-amber-50 text-amber-600',
  vault: 'bg-amber-500/15 text-amber-300',
  atelier: 'bg-amber-100/70 text-amber-800',
};

const authChipUnconfiguredClasses: Record<AppTheme, string> = {
  gallery: 'bg-stone-50 text-stone-400',
  vault: 'bg-white/10 text-white/60',
  atelier: 'bg-[#EDE4D3] text-[#8C7B6B]',
};

const importCardSurfaceClasses: Record<AppTheme, string> = {
  gallery: 'border-amber-100 bg-amber-50/60',
  vault: 'border-amber-500/25 bg-amber-500/10',
  atelier: 'border-amber-300/60 bg-amber-100/70',
};

const importCardTitleClasses: Record<AppTheme, string> = {
  gallery: 'text-amber-900',
  vault: 'text-amber-200',
  atelier: 'text-amber-900',
};

const importCardBodyClasses: Record<AppTheme, string> = {
  gallery: 'text-stone-600',
  vault: 'text-stone-300',
  atelier: 'text-[#3D3530]',
};

const importCardActionClasses: Record<AppTheme, string> = {
  gallery: 'bg-amber-600 text-white hover:bg-amber-700',
  vault: 'bg-[#D4A574] text-stone-950 hover:bg-[#E0B585]',
  atelier: 'bg-[#A86F3C] text-white hover:bg-[#8B5A2B]',
};

const importCardStatusClasses: Record<AppTheme, string> = {
  gallery: 'text-amber-700',
  vault: 'text-amber-200',
  atelier: 'text-amber-900',
};

const importCardErrorClasses: Record<AppTheme, string> = {
  gallery: 'text-red-500',
  vault: 'text-red-300',
  atelier: 'text-red-700',
};

interface LayoutProps {
  children: React.ReactNode;
  onOpenAuth: () => void;
  onSignOut: () => void;
  sampleCollectionId?: string | null;
  onImportLocal?: () => void;
  hasLocalImport?: boolean;
  importState?: 'idle' | 'running' | 'done' | 'error';
  importMessage?: string | null;
  user: User | null;
  isSupabaseConfigured: boolean;
  headerExtras?: React.ReactNode;
  statusBanner?: React.ReactNode;
  onAddItem?: () => void;
  onExploreSamples?: () => void;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  onOpenAuth,
  onSignOut,
  sampleCollectionId = null,
  onImportLocal,
  hasLocalImport = false,
  importState = 'idle',
  importMessage = null,
  user,
  isSupabaseConfigured,
  headerExtras,
  statusBanner,
  onAddItem,
  onExploreSamples,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const location = useLocation();
  const isHome = location.pathname === '/';
  const [profileSource, setProfileSource] = useState<ProfileSource | null>(null);
  const isProfileOpen = profileSource !== null;
  const profileRef = useRef<HTMLDivElement>(null);
  const bottomNavProfileButtonRef = useRef<HTMLButtonElement>(null);
  const previousProfileSourceRef = useRef<ProfileSource | null>(null);
  const closeProfile = useCallback(() => setProfileSource(null), []);

  // Restore focus to the bottom-nav profile trigger after the sheet closes,
  // so keyboard and screen-reader users land back where they invoked it.
  useEffect(() => {
    const prev = previousProfileSourceRef.current;
    if (profileSource === null && prev === 'bottomNav') {
      bottomNavProfileButtonRef.current?.focus();
    }
    previousProfileSourceRef.current = profileSource;
  }, [profileSource]);

  // Click-outside applies only to the header-anchored dropdown.
  // The mobile bottom sheet has its own backdrop.
  useEffect(() => {
    if (profileSource !== 'header') return;
    const handleClick = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        closeProfile();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [profileSource, closeProfile]);

  // Escape closes either surface.
  useEffect(() => {
    if (!isProfileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeProfile();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isProfileOpen, closeProfile]);
  const isAuthenticated = Boolean(user);
  const showSignInAffordance = isSupabaseConfigured && !isAuthenticated;
  const statusLabel = !isSupabaseConfigured
    ? t('cloudRequiredStatus')
    : isAuthenticated
      ? t('authStatusSignedIn')
      : t('authStatusSignedOut');
  const statusDesc = !isSupabaseConfigured
    ? t('cloudRequiredDesc')
    : isAuthenticated
      ? t('authDescSignedIn', { email: user?.email })
      : t('authDescSignedOut');
  const statusIcon = !isSupabaseConfigured ? <CloudOff size={18} /> : <Cloud size={18} />;
  const statusBadgeIcon = !isSupabaseConfigured ? (
    <CloudOff size={12} />
  ) : isAuthenticated ? (
    <Cloud size={12} />
  ) : (
    <CloudOff size={12} />
  );
  const statusColor = !isSupabaseConfigured
    ? theme === 'vault'
      ? 'text-stone-400'
      : 'text-stone-400'
    : isAuthenticated
      ? theme === 'vault'
        ? 'text-emerald-300'
        : 'text-emerald-600'
      : theme === 'vault'
        ? 'text-amber-200'
        : 'text-amber-600';
  const shellClass = theme === 'vault' ? 'text-white' : 'text-stone-800';
  const headerSurface =
    theme === 'vault'
      ? 'bg-stone-900/80 border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.35)]'
      : theme === 'atelier'
        ? 'bg-[#F5EFE4]/85 border-[#D4C9B8] shadow-sm'
        : 'bg-white/85 border-stone-200/70 shadow-sm';
  const navGhost =
    theme === 'vault'
      ? 'hover:bg-white/10 text-white/70 hover:text-white'
      : 'hover:bg-stone-100 text-stone-500 hover:text-stone-900';
  const dropdownSurface = cardSurfaceClasses[theme];
  const borderClass = theme === 'vault' ? 'border-white/10' : 'border-stone-100';
  const footerGradient =
    theme === 'vault'
      ? 'from-stone-950 via-stone-950 to-transparent'
      : theme === 'atelier'
        ? 'from-[#F5EFE4] via-[#F5EFE4] to-transparent'
        : 'from-stone-50 via-stone-50 to-transparent';
  const bottomNavSurface =
    theme === 'vault'
      ? 'bg-stone-900/95 border-white/10'
      : theme === 'atelier'
        ? 'bg-[#F5EFE4]/95 border-[#D4C9B8]'
        : 'bg-white/95 border-stone-200/70';
  const bottomNavMuted = theme === 'vault' ? 'text-white/60' : 'text-stone-400';
  const bottomNavAddPill =
    theme === 'vault'
      ? 'bg-[#D4A574]/20 text-[#D4A574]'
      : theme === 'atelier'
        ? 'bg-[#A86F3C]/15 text-[#A86F3C]'
        : 'bg-amber-100 text-amber-700';
  const statusBadgeSurface =
    theme === 'vault' ? 'bg-stone-900 border-white/10' : 'bg-white border-stone-200';
  const exploreTo = sampleCollectionId ? `/collection/${sampleCollectionId}` : null;
  const isExploreActive =
    location.pathname === '/explore' ||
    (sampleCollectionId
      ? location.pathname.startsWith(`/collection/${sampleCollectionId}`)
      : false);

  // CUR-127: the menu was a single flat grab-bag (status, theme, legal, import,
  // sign-out). Theme moved out to the header ThemeQuickToggle; the rest is
  // grouped into scannable sections: Account / About / Data.
  const profileMenuBody = (
    <>
      <div data-testid="profile-account-section" className={`border-b ${borderClass} mb-1`}>
        <div className="p-4">
          <p className="text-[12px] font-bold uppercase tracking-[0.14em] opacity-70 mb-1">
            {t('authStatus')}
          </p>

          <div className="flex items-start gap-3 mt-3">
            <div
              data-testid="profile-auth-chip"
              className={`p-2 rounded-xl ${
                !isSupabaseConfigured
                  ? authChipUnconfiguredClasses[theme]
                  : isAuthenticated
                    ? authChipSignedInClasses[theme]
                    : authChipSignedOutClasses[theme]
              }`}
            >
              {statusIcon}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-bold">{statusLabel}</p>
              <p className="text-[12px] opacity-80 leading-snug">{statusDesc}</p>
            </div>
          </div>
        </div>

        {isAuthenticated ? (
          <div className="px-2 pb-2">
            <button
              onClick={() => {
                onSignOut();
                closeProfile();
              }}
              className={`w-full flex items-center gap-2 px-4 py-3 text-sm rounded-xl transition-colors font-medium ${theme === 'vault' ? 'text-white/70 hover:text-red-200 hover:bg-white/5' : 'text-stone-400 hover:text-red-500 hover:bg-red-50'}`}
            >
              <LogOut size={16} />
              {t('signOut')}
            </button>
          </div>
        ) : (
          <div className="px-2 pb-2">
            <button
              onClick={() => {
                onOpenAuth();
                closeProfile();
              }}
              className={`w-full flex items-center justify-between px-4 py-3 text-sm rounded-xl transition-all font-bold ${theme === 'vault' ? 'bg-amber-500 text-stone-950 hover:bg-amber-400' : 'bg-stone-900 text-white hover:bg-stone-800'}`}
            >
              <div className="flex items-center gap-2">
                <Zap size={16} />
                {t('login')}
              </div>
              <ArrowUpRight size={16} className="opacity-50" />
            </button>
          </div>
        )}
      </div>

      <div data-testid="profile-about-section" className="px-4 pb-3 pt-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] opacity-70 mb-2">
          {t('profileSectionAbout')}
        </p>
        <div
          data-testid="profile-legal-links"
          className={`flex items-center gap-3 text-[12px] ${
            theme === 'vault' ? 'text-white/60' : 'text-stone-500'
          }`}
        >
          <a
            href="#/legal/terms"
            target="_blank"
            rel="noopener noreferrer"
            onClick={closeProfile}
            className={`underline-offset-4 hover:underline transition-colors ${
              theme === 'vault' ? 'hover:text-white' : 'hover:text-stone-900'
            }`}
          >
            {t('termsOfService')}
          </a>
          <span aria-hidden="true" className="opacity-40">
            ·
          </span>
          <a
            href="#/legal/privacy"
            target="_blank"
            rel="noopener noreferrer"
            onClick={closeProfile}
            className={`underline-offset-4 hover:underline transition-colors ${
              theme === 'vault' ? 'hover:text-white' : 'hover:text-stone-900'
            }`}
          >
            {t('privacyPolicy')}
          </a>
        </div>
      </div>

      {hasLocalImport && isAuthenticated && onImportLocal && (
        <div data-testid="profile-data-section" className={`p-2 border-t ${dividerClasses[theme]}`}>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] opacity-70 mb-2 px-2 pt-2">
            {t('profileSectionData')}
          </p>
          <div
            data-testid="profile-import-card"
            className={`p-3 rounded-xl border ${importCardSurfaceClasses[theme]}`}
          >
            <p
              className={`text-[12px] font-bold uppercase tracking-[0.18em] mb-1 ${importCardTitleClasses[theme]}`}
            >
              {t('importLocalTitle')}
            </p>
            <p className={`text-[12px] leading-snug mb-3 ${importCardBodyClasses[theme]}`}>
              {t('importLocalDesc')}
            </p>
            <button
              onClick={onImportLocal}
              disabled={importState === 'running'}
              className={`w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold rounded-lg disabled:opacity-60 ${importCardActionClasses[theme]}`}
            >
              <Download size={14} />
              {importState === 'running' ? t('importing') : t('importLocalAction')}
            </button>
            {importMessage && (
              <p
                className={`text-[12px] mt-2 ${
                  importState === 'error'
                    ? importCardErrorClasses[theme]
                    : importCardStatusClasses[theme]
                }`}
              >
                {importMessage}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );

  return (
    <div
      className={`min-h-screen min-h-[100dvh] font-sans selection:bg-amber-200 transition-colors ${shellClass}`}
    >
      <header
        className={`sticky top-0 z-20 backdrop-blur-md border-b pt-[env(safe-area-inset-top,0px)] ${headerSurface}`}
      >
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2 group">
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center font-serif font-bold text-xl transition-colors ${theme === 'vault' ? 'bg-white text-stone-900 group-hover:bg-amber-400' : 'bg-stone-900 text-white group-hover:bg-amber-600'}`}
            >
              C
            </div>
            <span className="font-serif text-xl font-bold tracking-tight leading-none">
              {t('appTitle')}
            </span>
          </Link>

          <nav className="flex items-center gap-2 justify-end">
            {headerExtras}

            <ThemeQuickToggle />

            <div className="relative hidden sm:block" ref={profileRef}>
              <button
                onClick={() => setProfileSource((prev) => (prev === 'header' ? null : 'header'))}
                aria-label={t('account')}
                aria-describedby="header-status-badge"
                title={showSignInAffordance ? t('login') : statusLabel}
                aria-haspopup="menu"
                aria-expanded={profileSource === 'header'}
                className={`${showSignInAffordance ? 'pl-3 pr-4 py-2 rounded-full flex items-center gap-2' : 'p-2 rounded-full'} transition-colors ${navGhost} ${statusColor}`}
              >
                {/* CUR-158 / CUR-153: anchor the status badge to the account
                    icon itself, not the button box. Positioning it on the box
                    (bottom-0 right-0) kept it beside the glyph in the compact
                    icon-only button, but once CUR-49 widened the signed-out
                    control into a labelled "Sign In" pill, that same corner
                    landed outside the pill's rounded edge and read as a stray
                    orange glyph. Wrapping the icon in a positioning context
                    keeps the badge on the glyph in both layouts. Screen
                    readers flatten a button's descendants, so the status
                    reaches them via the button's aria-describedby -> this
                    badge's aria-label; the title covers hover. Both reuse the
                    profile menu's status vocabulary so every surface uses one
                    consistent term. */}
                <span className="relative flex items-center justify-center">
                  <User size={20} />
                  <span
                    id="header-status-badge"
                    data-testid="header-status-badge"
                    role="img"
                    aria-label={statusLabel}
                    title={statusLabel}
                    className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border flex items-center justify-center ${statusBadgeSurface}`}
                  >
                    <span className={statusColor}>{statusBadgeIcon}</span>
                  </span>
                </span>
                {showSignInAffordance && (
                  <span
                    data-testid="header-sign-in-label"
                    className="font-mono text-[11px] uppercase tracking-[0.2em] font-bold"
                  >
                    {t('login')}
                  </span>
                )}
              </button>

              {profileSource === 'header' && (
                <div
                  data-testid="profile-dropdown"
                  role="menu"
                  className={`absolute right-0 mt-2 w-72 max-w-[calc(100vw-2rem)] ${dropdownSurface} rounded-[1.5rem] shadow-2xl border p-2 animate-in slide-in-from-top-2 duration-200 z-50`}
                >
                  {profileMenuBody}
                </div>
              )}
            </div>

            {!isHome && (
              <Link to="/">
                <button
                  className={`p-2 rounded-full transition-colors ${navGhost}`}
                  aria-label={t('navHome')}
                  title={t('navHome')}
                >
                  <Home size={20} />
                </button>
              </Link>
            )}
          </nav>
        </div>
      </header>

      {statusBanner && <div className="max-w-4xl mx-auto px-4 pt-4 sm:pt-5">{statusBanner}</div>}

      {/* CUR-97: reserve clearance for the bottom nav only where it actually
          renders (< sm). On desktop the nav is `sm:hidden`, so `sm:pb-8` drops
          the ~5.5rem of dead space back to the standard `py-8` rhythm. */}
      <main
        id="main-content"
        className="max-w-4xl mx-auto px-4 py-8 pb-[calc(var(--bottom-nav-height,5.5rem)+env(safe-area-inset-bottom,0px))] sm:pb-8"
      >
        {children}
      </main>

      <nav
        className={`fixed bottom-0 left-0 right-0 z-40 border-t ${bottomNavSurface} sm:hidden`}
        aria-label="Primary"
        style={{ height: 'var(--bottom-nav-height, 5.5rem)' }}
      >
        <div className="mx-auto max-w-4xl h-full px-2 pb-[env(safe-area-inset-bottom,0px)] pt-2 flex items-center">
          <div className={`grid ${exploreTo ? 'grid-cols-4' : 'grid-cols-3'} items-center w-full`}>
            <Link
              to="/"
              aria-current={location.pathname === '/' ? 'page' : undefined}
              className={`flex flex-col items-center gap-1 text-[11px] font-semibold transition-colors ${location.pathname === '/' ? 'text-amber-500' : bottomNavMuted}`}
            >
              <Home size={22} />
              {t('navHome')}
            </Link>

            {exploreTo && (
              <Link
                to={exploreTo}
                onClick={onExploreSamples}
                aria-current={isExploreActive ? 'page' : undefined}
                className={`flex flex-col items-center gap-1 text-[11px] font-semibold transition-colors ${isExploreActive ? 'text-amber-500' : bottomNavMuted}`}
              >
                <Compass size={22} />
                {t('exploreSample')}
              </Link>
            )}

            <button
              onClick={onAddItem}
              className={`flex flex-col items-center gap-1 text-[11px] font-semibold transition-colors ${bottomNavMuted}`}
            >
              <div
                data-testid="bottom-nav-add-pill"
                className={`p-1 rounded-full -mt-1 ${bottomNavAddPill}`}
              >
                <Plus size={20} strokeWidth={2.5} />
              </div>
              {t('add')}
            </button>

            <button
              ref={bottomNavProfileButtonRef}
              onClick={() => setProfileSource('bottomNav')}
              aria-haspopup="dialog"
              aria-expanded={profileSource === 'bottomNav'}
              aria-label={showSignInAffordance ? t('login') : t('profile')}
              className={`flex flex-col items-center gap-1 text-[11px] font-semibold transition-colors ${profileSource === 'bottomNav' ? 'text-amber-500' : bottomNavMuted}`}
            >
              <User size={22} />
              {showSignInAffordance ? t('login') : t('profile')}
            </button>
          </div>
        </div>
      </nav>

      {profileSource === 'bottomNav' && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center sm:hidden"
          data-testid="profile-bottom-sheet"
        >
          <button
            type="button"
            onClick={closeProfile}
            aria-label={t('close')}
            data-testid="profile-bottom-sheet-backdrop"
            className="absolute inset-0 bg-black/40 backdrop-blur-sm motion-overlay"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t('account')}
            className={`relative w-full ${dropdownSurface} rounded-t-[2.5rem] shadow-2xl border max-h-[85vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-200 pb-[env(safe-area-inset-bottom,0px)]`}
          >
            <div className="relative flex items-center justify-center pt-3 pb-1">
              <span
                className={`${theme === 'vault' ? 'bg-white/20' : 'bg-stone-300'} h-1.5 w-12 rounded-full`}
              />
              <button
                type="button"
                onClick={closeProfile}
                aria-label={t('close')}
                data-testid="profile-bottom-sheet-close"
                className={`absolute right-2 top-1.5 p-2 rounded-full transition-colors ${theme === 'vault' ? 'hover:bg-white/5 text-stone-300 hover:text-white' : 'hover:bg-stone-100 text-stone-400 hover:text-stone-800'}`}
              >
                <X size={20} />
              </button>
            </div>
            <div className="overflow-y-auto p-2">{profileMenuBody}</div>
          </div>
        </div>
      )}

      {/* CUR-97: the fade only reads as intentional above the bottom nav, so it
          rides the same `sm:hidden` breakpoint and is not drawn on desktop. */}
      <footer
        className={`fixed bottom-0 left-0 w-full bg-gradient-to-t ${footerGradient} pointer-events-none h-12 z-10 sm:hidden`}
      />
    </div>
  );
};
