"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { useState } from "react";

type AppHeaderMenuProps = {
  isAdmin?: boolean;
};

export default function AppHeaderMenu({ isAdmin = false }: AppHeaderMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="app-header-menu">
      <button className="app-header-menu-button" onClick={() => setIsOpen((value) => !value)} type="button">
        Menu
      </button>

      {isOpen ? (
        <div className="app-header-menu-panel">
          <Link href="/reports">Saved Reports</Link>
          <Link href="/jira/settings">Settings</Link>
          <Link href="/account">Account</Link>
          <Link href="/donate">Donate</Link>
          {isAdmin ? <Link href="/jira/settings#admin-debug">Admin Debug</Link> : null}
          <button onClick={() => signOut({ callbackUrl: "/" })} type="button">
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
