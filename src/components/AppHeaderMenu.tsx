"use client";

import Link from "next/link";
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

export default function AppHeaderMenu({ isSignedIn = true }: AppHeaderMenuProps) {
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
  }, [isOpen]);

  function closeMenu() {
    setIsOpen(false);
  }

  return (
    <div className="app-header-menu-wrap">
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="app-header-menu-button"
        onClick={() => setIsOpen((value) => !value)}
        ref={buttonRef}
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
