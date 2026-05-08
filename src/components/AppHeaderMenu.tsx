"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

type AppHeaderMenuProps = {
  isSignedIn?: boolean;
};

type MenuPosition = {
  top: number;
  left: number;
};

const MENU_WIDTH = 238;
const MENU_GAP = 10;
const TABLET_BREAKPOINT = 1120;
const MOBILE_BREAKPOINT = 760;

function getViewportMode() {
  if (typeof window === "undefined") return "desktop";

  if (window.innerWidth <= MOBILE_BREAKPOINT) return "mobile";
  if (window.innerWidth <= TABLET_BREAKPOINT) return "tablet";

  return "desktop";
}

function getMenuWrapStyle(viewportMode: "desktop" | "tablet" | "mobile"): CSSProperties {
  if (viewportMode === "mobile") {
    return {
      position: "static",
      width: "fit-content",
      marginTop: "16px",
    };
  }

  if (viewportMode === "tablet") {
    return {
      position: "absolute",
      top: "28px",
      right: "28px",
      zIndex: 12,
    };
  }

  return {
    position: "absolute",
    top: "38px",
    right: "320px",
    zIndex: 12,
  };
}

const menuButtonStyle: CSSProperties = {
  position: "static",
  minWidth: "92px",
  minHeight: "38px",
  padding: "8px 16px",
};

export default function AppHeaderMenu({ isSignedIn = true }: AppHeaderMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition>({ top: 0, left: 0 });
  const [viewportMode, setViewportMode] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const menuRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  function updatePosition() {
    const button = buttonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const preferredTop = rect.bottom + MENU_GAP;
    const estimatedMenuHeight = isSignedIn ? 264 : 312;
    const wouldOverflowBottom = preferredTop + estimatedMenuHeight > viewportHeight - 16;

    const top = wouldOverflowBottom
      ? Math.max(16, rect.top - estimatedMenuHeight - MENU_GAP)
      : preferredTop;

    const centeredLeft = rect.left + rect.width / 2 - MENU_WIDTH / 2;
    const left = Math.min(Math.max(16, centeredLeft), viewportWidth - MENU_WIDTH - 16);

    setPosition({ top, left });
  }

  useEffect(() => {
    function syncViewportMode() {
      setViewportMode(getViewportMode());
    }

    syncViewportMode();

    window.addEventListener("resize", syncViewportMode);

    return () => {
      window.removeEventListener("resize", syncViewportMode);
    };
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) return;

    updatePosition();
  }, [isOpen, isSignedIn, viewportMode]);

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
  }, [isOpen, isSignedIn, viewportMode]);

  function closeMenu() {
    setIsOpen(false);
  }

  return (
    <div className="app-header-menu-wrap" style={getMenuWrapStyle(viewportMode)}>
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
    </div>
  );
}
