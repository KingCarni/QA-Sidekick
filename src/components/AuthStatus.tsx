"use client";

import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import CreditsPill from "@/components/CreditsPill";

type MenuPosition = {
  top: number;
  left: number;
};

const MENU_WIDTH = 238;
const MENU_GAP = 10;

const menuButtonStyle: CSSProperties = {
  position: "static",
  width: "100%",
  minHeight: "34px",
  padding: "7px 12px",
  borderRadius: "12px",
  fontSize: "0.8rem",
};

const signOutColumnStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  minWidth: 0,
};

const accountCardStyle: CSSProperties = {
  overflow: "visible",
};

const signedInIdentityStyle: CSSProperties = {
  justifyContent: "flex-end",
  textAlign: "right",
};

function AccountMenuButton({ isSignedIn }: { isSignedIn: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition>({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  function updatePosition() {
    const button = buttonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const estimatedMenuHeight = isSignedIn ? 264 : 312;
    const preferredTop = rect.bottom + MENU_GAP;
    const wouldOverflowBottom = preferredTop + estimatedMenuHeight > viewportHeight - 16;

    const top = wouldOverflowBottom
      ? Math.max(16, rect.top - estimatedMenuHeight - MENU_GAP)
      : preferredTop;

    const rightAlignedLeft = rect.right - MENU_WIDTH;
    const left = Math.min(Math.max(16, rightAlignedLeft), viewportWidth - MENU_WIDTH - 16);

    setPosition({ top, left });
  }

  useLayoutEffect(() => {
    if (!isOpen) return;

    updatePosition();
  }, [isOpen, isSignedIn]);

  useEffect(() => {
    if (!isOpen) return;

    function handleDocumentClick(event: MouseEvent) {
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

    document.addEventListener("mousedown", handleDocumentClick);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);

    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [isOpen, isSignedIn]);

  function closeMenu() {
    setIsOpen(false);
  }

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

      {isOpen ? (
        <nav
          aria-label="QAtalyst menu"
          className="app-header-menu-popover app-header-menu-floating"
          ref={menuRef}
          role="menu"
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`,
          }}
        >
          <Link href="/buy-credits" role="menuitem" onClick={closeMenu}>
            Buy Credits
          </Link>
          <Link href="/reports" role="menuitem" onClick={closeMenu}>
            Saved Reports
          </Link>
          <Link href="/jira/settings" role="menuitem" onClick={closeMenu}>
            Settings
          </Link>
          <Link href="/account" role="menuitem" onClick={closeMenu}>
            Account
          </Link>
          <Link href="/donate" role="menuitem" onClick={closeMenu}>
            Donate
          </Link>

          {!isSignedIn ? (
            <Link href="/api/auth/signin" role="menuitem" onClick={closeMenu}>
              Sign in
            </Link>
          ) : null}
        </nav>
      ) : null}
    </>
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
        <div className="qa-auth-card qa-auth-card-signed-out" style={accountCardStyle}>
          <div className="qa-auth-copy qa-auth-copy-under account-identity-row" style={signedInIdentityStyle}>
            <div>
              <span className="qa-auth-kicker account-kicker">Account</span>
              <strong className="signed-in-email">Not signed in</strong>
            </div>
          </div>

          <div className="qa-auth-action-row account-action-row">
            <span />
            <span />
            <div style={signOutColumnStyle}>
              <AccountMenuButton isSignedIn={false} />
              <button className="qa-auth-primary-button" type="button" onClick={() => signIn("google")}>
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
    <aside className="qa-auth-widget" aria-label="Account status">
      <div className="qa-auth-card qa-auth-card-signed-in" style={accountCardStyle}>
        <div className="qa-auth-copy qa-auth-copy-under account-identity-row" style={signedInIdentityStyle}>
          <div>
            <span className="qa-auth-kicker account-kicker">Signed in</span>
            <strong className="signed-in-email" title={displayName}>
              {displayName}
            </strong>
          </div>
        </div>

        <div className="qa-auth-action-row account-action-row">
          <CreditsPill />
          <Link className="qa-auth-secondary-button" href="/account">
            Account
          </Link>
          <div style={signOutColumnStyle}>
            <AccountMenuButton isSignedIn />
            <button className="qa-auth-ghost-button" type="button" onClick={() => signOut()}>
              Sign out
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
