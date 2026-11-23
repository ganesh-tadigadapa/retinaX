"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  BookHeart, ChartColumn, ClipboardCheck, Eye, FileText, Globe, House, Info, LogOut,
  MapPin, Menu, ScanEye, ShieldAlert, User, X, type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { getHealth, type Health } from "@/lib/api";
import { ROLE_LABEL } from "@/lib/auth";
import { useCareBridge } from "@/components/carebridge/CareBridgeProvider";
import LanguageControl from "@/components/carebridge/LanguageControl";
import ThemeToggle from "@/components/ThemeToggle";
import type { StringKey } from "@/lib/i18n";

type Item = { href: string; key: StringKey; icon: LucideIcon };

// Public links: the top navigation on every page.
const TOP: Item[] = [
  { href: "/", key: "nav.overview", icon: House },
  { href: "/how-it-works", key: "nav.howItWorks", icon: Info },
  { href: "/hospitals", key: "nav.hospitals", icon: MapPin },
  { href: "/carebridge", key: "nav.carebridge", icon: Globe },
];

// The signed-in workspace: the dark sidebar.
const MINE: Item[] = [
  { href: "/passport", key: "nav.passport", icon: BookHeart },
  { href: "/screen", key: "nav.screen", icon: ScanEye },
  { href: "/hospitals", key: "nav.hospitals", icon: MapPin },
  { href: "/carebridge", key: "nav.carebridge", icon: Globe },
];
const CLINICAL: Item[] = [
  { href: "/review", key: "nav.review", icon: ClipboardCheck },
  { href: "/dashboard", key: "nav.evidence", icon: ChartColumn },
];
// The Reports entry is a convenience for verified doctors; the API protects the page.
const REPORTS: Item = { href: "/reports", key: "nav.reports" as StringKey, icon: FileText };
const LEARN: Item[] = [
  { href: "/", key: "nav.overview", icon: House },
  { href: "/how-it-works", key: "nav.howItWorks", icon: Info },
  { href: "/limitations", key: "nav.limitations", icon: ShieldAlert },
];

const APP_ROUTES = ["/screen", "/passport", "/review", "/dashboard", "/reports"];

const isActive = (path: string, href: string) =>
  href === "/" ? path === "/" : path === href || path.startsWith(href + "/");

function Logo() {
  return (
    <Link href="/" className="rx-logo" aria-label="RETINEX home">
      <span className="rx-logomark" aria-hidden="true"><Eye size={22} strokeWidth={2} /></span>
      <span className="rx-wordmark">RETINEX</span>
    </Link>
  );
}

const ROLE_INITIALS: Record<string, string> = { user: "U", doctor: "DR", admin: "AD" };
const ROLE_NAME: Record<string, string> = { user: "User account", doctor: "Doctor", admin: "Administrator" };

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname() || "/";
  const [health, setHealth] = useState<Health | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { authenticated, account, doctorVerificationPending, signOut } = useAuth();
  const { t } = useCareBridge();

  useEffect(() => {
    getHealth().then(setHealth).catch((e) => setErr(String(e.message || e)));
  }, []);
  useEffect(() => { setDrawer(false); setMenu(false); }, [path]);
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [menu]);

  const signedIn = authenticated && !!account;
  const appMode = signedIn && APP_ROUTES.some((r) => isActive(path, r));
  const clinical = account?.can_read_reports ? [...CLINICAL, REPORTS] : CLINICAL;
  const roleLabel = account ? ROLE_LABEL[account.role] || account.role : "";
  const apiState = err ? "down" : health ? "up" : "pending";

  const navLink = ({ href, key, icon: Icon }: Item, cls: string) => (
    <Link
      key={cls + href}
      href={href}
      className={`${cls}${isActive(path, href) ? " on" : ""}`}
      aria-current={isActive(path, href) ? "page" : undefined}
    >
      <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
      <span>{t(key)}</span>
    </Link>
  );

  return (
    <div className={`rx-app${appMode ? " is-app" : ""}`} data-drawer={drawer || undefined}>
      {/* ---- dark sidebar: the signed-in workspace on desktop, the menu on a phone ---- */}
      <aside className="rx-side" aria-label="Main navigation">
        <div className="rx-sidehead">
          <Logo />
          <button className="rx-sideclose" onClick={() => setDrawer(false)} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        {signedIn && account && (
          // A role indicator, and nothing else about the person. No name, no number.
          <div className="rx-profile">
            <span className="rx-avatar lg" aria-hidden="true">{ROLE_INITIALS[account.role] ?? "U"}</span>
            <div>
              <div className="rx-profilerole">{ROLE_NAME[account.role] ?? roleLabel}</div>
              {account.role === "doctor" ? (
                <span className={`rx-verified${account.doctor_verified ? "" : " pending"}`}>
                  {account.doctor_verified ? "Verified" : "Verification pending"}
                </span>
              ) : (
                <span className="rx-verified">Signed in</span>
              )}
            </div>
          </div>
        )}

        <nav className="rx-sidenav">
          {signedIn ? (
            <>
              <div className="rx-sidegroup">{MINE.map((i) => navLink(i, "rx-sidelink"))}</div>
              <div className="rx-sidelabel">Clinical</div>
              <div className="rx-sidegroup">{clinical.map((i) => navLink(i, "rx-sidelink"))}</div>
            </>
          ) : (
            <div className="rx-sidegroup">{TOP.map((i) => navLink(i, "rx-sidelink"))}</div>
          )}
          <div className="rx-sidelabel">Learn</div>
          <div className="rx-sidegroup">
            {LEARN.filter((i) => signedIn || i.href !== "/").map((i) => navLink(i, "rx-sidelink"))}
          </div>
          {signedIn ? (
            <button className="rx-sidelink" onClick={signOut}>
              <LogOut size={18} strokeWidth={1.8} aria-hidden="true" />
              <span>{t("nav.logout")}</span>
            </button>
          ) : (
            <div className="rx-sideauth">
              <Link href="/login" className="cta line">{t("nav.login")}</Link>
              <Link href="/signup" className="cta solid">{t("nav.signup")}</Link>
            </div>
          )}
        </nav>

        <div className="rx-sidecard">
          <span className="rx-sidecardicon" aria-hidden="true"><Eye size={20} /></span>
          <div>
            <strong>Your vision matters</strong>
            <span>Keep screening regularly.</span>
          </div>
        </div>
        <div className={`rx-sidestatus s-${apiState}`}>
          <i aria-hidden="true" />
          {apiState === "down" ? "API unreachable" : health
            ? `API ${health.status} · ${health.model_loaded ? health.model_id : "no model loaded"}`
            : "Connecting…"}
        </div>
      </aside>
      <div className="rx-scrim" onClick={() => setDrawer(false)} aria-hidden="true" />

      <div className="rx-main">
        {health?.synthetic_demo_model && (
          <div className="synthbar">
            Demo model trained on synthetic images — predictions are meaningless and no
            number here may be quoted as a result.
          </div>
        )}
        {authenticated && doctorVerificationPending && (
          <div className="pendingbar">
            Doctor verification pending. Screening is available; the reports area opens
            once a programme administrator confirms your registration.
          </div>
        )}

        <header className="rx-top">
          <button className="rx-iconbtn rx-burger" onClick={() => setDrawer(true)} aria-label="Open menu">
            <Menu size={20} />
          </button>
          <div className="rx-toplogo"><Logo /></div>

          <nav className="rx-topnav" aria-label="Site">
            {TOP.map(({ href, key }) => (
              <Link key={href} href={href} className={isActive(path, href) ? "on" : ""}
                    aria-current={isActive(path, href) ? "page" : undefined}>
                {t(key)}
              </Link>
            ))}
          </nav>

          <div className="rx-topright">
            <LanguageControl />
            <ThemeToggle />
            {signedIn && account ? (
              <div className="rx-menuwrap" ref={menuRef}>
                <button
                  className="rx-avatar"
                  onClick={() => setMenu((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={menu}
                  aria-label={`Account menu (${roleLabel})`}
                >
                  <User size={17} aria-hidden="true" />
                </button>
                {menu && (
                  <div className="rx-menu" role="menu">
                    <div className="rx-menuhead">
                      <span className={`rolechip role-${account.role}`}>
                        {roleLabel.toUpperCase()}
                        {account.role === "doctor" && !account.doctor_verified && " · PENDING"}
                      </span>
                    </div>
                    {[...MINE.slice(0, 2), ...clinical].map(({ href, key, icon: Icon }) => (
                      <Link key={href} href={href} role="menuitem" className="rx-menuitem">
                        <Icon size={16} aria-hidden="true" /> {t(key)}
                      </Link>
                    ))}
                    <button role="menuitem" className="rx-menuitem" onClick={signOut}>
                      <LogOut size={16} aria-hidden="true" /> {t("nav.logout")}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link href="/login" className="rx-iconbtn rx-hide-sm" aria-label={t("nav.login")} title={t("nav.login")}>
                  <User size={18} aria-hidden="true" />
                </Link>
                <Link href="/signup" className="cta solid rx-getstarted">Get Started</Link>
              </>
            )}
          </div>
        </header>

        <main className="rx-content">{children}</main>

        <footer className="rx-foot">
          <span>A student-led initiative for accessible eye care · Screening triage aid, not a diagnostic device</span>
          <span className="rx-footlinks">
            <Link href="/how-it-works">{t("nav.howItWorks")}</Link>
            <Link href="/limitations">{t("nav.limitations")}</Link>
            <Link href="/dashboard">{t("nav.evidence")}</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </span>
        </footer>
      </div>
    </div>
  );
}
