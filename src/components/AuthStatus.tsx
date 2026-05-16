"use client";

import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import AdminDebugMenu from "@/components/AdminDebugMenu";
import CreditsPill from "@/components/CreditsPill";

type MenuPosition = {
  top: number;
  left: number;
};

const MENU_WIDTH = 238;
const MENU_GAP = 10;

const accountCardStyle: CSSProperties = {
  overflow: "visible",
  position: "relative",
};

const floatingIdentityStyle: CSSProperties = {
  position: "absolute",
  top: "-198px",
  right: "8px",
  zIndex: 20,
  minWidth: "220px",
  textAlign: "right",
  pointerEvents: "none",
};

const floatingIdentityKickerStyle: CSSProperties = {
  display: "block",
  color: "#fca5a5",
  fontSize: "0.68rem",
  fontWeight: 1000,
  letterSpacing: "0.13em",
  textTransform: "uppercase",
  textShadow: "0 0 14px rgba(248, 113, 113, 0.22)",
};

const floatingIdentityEmailStyle: CSSProperties = {
  display: "block",
  overflow: "hidden",
  maxWidth: "260px",
  color: "#ffffff",
  fontSize: "0.82rem",
  fontWeight: 950,
  lineHeight: 1.2,
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  textShadow: "0 2px 14px rgba(0, 0, 0, 0.42)",
};

const actionRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(118px, 1fr))",
  gap: "12px",
  alignItems: "end",
  width: "100%",
};

const actionCellStyle: CSSProperties = {
  minWidth: 0,
  position: "relative",
};

const creditsCellStyle: CSSProperties = {
  ...actionCellStyle,
  paddingTop: "46px",
};

const menuButtonWrapStyle: CSSProperties = {
  position: "absolute",
  top: "0",
  left: "0",
  right: "0",
};

const menuButtonStyle: CSSProperties = {
  position: "static",
  width: "100%",
  minHeight: "34px",
  padding: "7px 12px",
  borderRadius: "12px",
  fontSize: "0.8rem",
};

const menuPortalStyle: CSSProperties = {
  position: "fixed",
  zIndex: 2147483647,
  width: `${MENU_WIDTH}px`,
  padding: "12px",
  border: "1px solid rgba(248, 113, 113, 0.34)",
  borderRadius: "16px",
  background:
    "radial-gradient(circle at top left, rgba(37, 99, 235, 0.12), transparent 42%), linear-gradient(135deg, rgba(8, 8, 10, 0.98), rgba(0, 0, 0, 0.98))",
  boxShadow:
    "0 28px 70px rgba(0, 0, 0, 0.72), 0 0 0 1px rgba(255, 255, 255, 0.04), 0 0 34px rgba(248, 113, 113, 0.12)",
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const menuLinkStyle: CSSProperties = {
  display: "block",
  padding: "12px 12px",
  borderRadius: "10px",
  color: "#ffffff",
  fontSize: "0.95rem",
  fontWeight: 950,
  textDecoration: "none",
};

const actionButtonStyle: CSSProperties = {
  width: "100%",
  minHeight: "42px",
};

const signedOutCardStyle: CSSProperties = {
  ...accountCardStyle,
  minHeight: "104px",
};

function AccountMenuButton({ isSignedIn }: { isSignedIn: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [position, setPosition] = useState<MenuPosition>({ top: -9999, left: -9999 });
  const menuRef = useRef<HTMLElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  function updatePosition() {
    const button = buttonRef.current;
    if (!button || typeof window === "undefined") return;

    const rect = button.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const estimatedMenuHeight = isSignedIn ? 300 : 350;
    const preferredTop = rect.bottom + MENU_GAP;
    const wouldOverflowBottom = preferredTop + estimatedMenuHeight > viewportHeight - 16;

    const top = wouldOverflowBottom
      ? Math.max(16, rect.top - estimatedMenuHeight - MENU_GAP)
      : preferredTop;

    const leftAlignedLeft = rect.left;
    const left = Math.min(Math.max(16, leftAlignedLeft), viewportWidth - MENU_WIDTH - 16);

    setPosition({ top, left });
  }

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) return;

    updatePosition();
  }, [isOpen, isSignedIn]);

  useEffect(() => {
    if (!isOpen) return;

    function handleDocumentPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      const menu = menuRef.current;
      const button = buttonRef.current;

      if (menu?.contains(target) || button?.contains(target)) {
        return;
      }

      setIsOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    function handleReposition() {
      updatePosition();
    }

    document.addEventListener("pointerdown", handleDocumentPointerDown);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);

    return () => {
      document.removeEventListener("pointerdown", handleDocumentPointerDown);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [isOpen, isSignedIn]);

  function closeMenu() {
    setIsOpen(false);
  }

  const menuMarkup = (
    <nav
      aria-label="QAtalyst menu"
      ref={menuRef}
      role="menu"
      style={{
        ...menuPortalStyle,
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
    >
      <Link href="/brain" role="menuitem" onClick={closeMenu} style={menuLinkStyle}>
        Project Brain
      </Link>
      <Link href="/buy-credits" role="menuitem" onClick={closeMenu} style={menuLinkStyle}>
        Buy Credits
      </Link>
      <Link href="/reports" role="menuitem" onClick={closeMenu} style={menuLinkStyle}>
        Saved Reports
      </Link>
      <Link href="/jira/settings" role="menuitem" onClick={closeMenu} style={menuLinkStyle}>
        Settings
      </Link>
      <Link href="/account" role="menuitem" onClick={closeMenu} style={menuLinkStyle}>
        Account
      </Link>
      <Link href="/donate" role="menuitem" onClick={closeMenu} style={menuLinkStyle}>
        Donate
      </Link>

      {!isSignedIn ? (
        <Link href="/api/auth/signin" role="menuitem" onClick={closeMenu} style={menuLinkStyle}>
          Sign in
        </Link>
      ) : null}
    </nav>
  );

  return (
    <>
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="app-header-menu-button hero-menu-button"
        onClick={() => setIsOpen((value) => !value)}
        ref={buttonRef}
        style={menuButtonStyle}
        type="button"
      >
        Menu
      </button>

      {isOpen && isMounted ? createPortal(menuMarkup, document.body) : null}
    </>
  );
}

function FloatingSignedInIdentity({ label, value }: { label: string; value: string }) {
  return (
    <div className="qa-floating-signed-in" style={floatingIdentityStyle}>
      <span style={floatingIdentityKickerStyle}>{label}</span>
      <strong style={floatingIdentityEmailStyle} title={value}>
        {value}
      </strong>
    </div>
  );
}

export default function AuthStatus() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <aside className="qa-auth-widget" aria-label="Account status">
        <div className="qa-auth-card qa-auth-card-loading" style={accountCardStyle}>
          <span className="qa-auth-dot" />
          <span>Loading account…</span>
        </div>
      </aside>
    );
  }

  if (!session?.user) {
    return (
      <aside className="qa-auth-widget" aria-label="Account status">
        <div className="qa-auth-card qa-auth-card-signed-out" style={signedOutCardStyle}>
          <FloatingSignedInIdentity label="Account" value="Not signed in" />

          <div className="qa-auth-action-row account-action-row" style={actionRowStyle}>
            <div style={creditsCellStyle}>
              <div style={menuButtonWrapStyle}>
                <AccountMenuButton isSignedIn={false} />
              </div>
            </div>

            <div style={actionCellStyle} />

            <div style={actionCellStyle}>
              <button
                className="qa-auth-primary-button"
                style={actionButtonStyle}
                type="button"
                onClick={() => signIn("google")}
              >
                Sign in
              </button>
            </div>
          </div>
        </div>
      </aside>
    );
  }

  const displayName = session.user.email ?? session.user.name ?? "QA user";

  return (
    <>
      <aside className="qa-auth-widget" aria-label="Account status">
        <div className="qa-auth-card qa-auth-card-signed-in" style={accountCardStyle}>
          <FloatingSignedInIdentity label="Signed in" value={displayName} />

          <div className="qa-auth-action-row account-action-row" style={actionRowStyle}>
            <div style={creditsCellStyle}>
              <div style={menuButtonWrapStyle}>
                <AccountMenuButton isSignedIn />
              </div>
              <CreditsPill />
            </div>

            <div style={actionCellStyle}>
              <Link className="qa-auth-secondary-button" href="/account" style={actionButtonStyle}>
                Account
              </Link>
            </div>

            <div style={actionCellStyle}>
              <button
                className="qa-auth-ghost-button"
                style={actionButtonStyle}
                type="button"
                onClick={() => signOut()}
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </aside>

      <AdminDebugMenu userEmail={session.user.email} />
    </>
  );
}
