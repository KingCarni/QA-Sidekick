"use client";

type AppHeaderMenuProps = {
  isSignedIn?: boolean;
};

/**
 * The header menu now lives inside AuthStatus so it can sit directly above
 * the Sign out / Sign in action in the account card.
 *
 * Keep this component as a no-op for backwards compatibility because the app
 * page still imports/renders it in the hero area.
 */
export default function AppHeaderMenu(_props: AppHeaderMenuProps) {
  return null;
}
