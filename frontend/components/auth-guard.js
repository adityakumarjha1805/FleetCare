"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchCurrentUser } from "../lib/auth-api";
import Link from "next/link";

const publicPaths = new Set(["/login", "/signup", "/verify-email"]);

export default function AuthGuard({ children }) {
  const pathname = usePathname();
  const [checkedPath, setCheckedPath] = useState("");
  const [guardError, setGuardError] = useState("");
  const [retryVersion, setRetryVersion] = useState(0);
  const isPublicPath = publicPaths.has(pathname);

  useEffect(() => {
    let active = true;

    async function verifySession() {
      try {
        await fetchCurrentUser();
        if (!active) return;
        if (isPublicPath) {
          window.location.replace("/");
        } else {
          setCheckedPath(pathname);
        }
      } catch (error) {
        if (!active) return;
        if (error.status === 401) {
          if (!isPublicPath) window.location.replace("/login");
          return;
        }
        if (!isPublicPath) {
          setGuardError({
            pathname,
            message:
              error.message || "Unable to verify your session right now.",
          });
        }
      }
    }

    verifySession();
    return () => {
      active = false;
    };
  }, [pathname, retryVersion, isPublicPath]);

  useEffect(() => {
    function handleUnauthorized() {
      if (!publicPaths.has(window.location.pathname)) {
        window.location.replace("/login");
      }
    }
    window.addEventListener("fleetcare:unauthorized", handleUnauthorized);
    return () =>
      window.removeEventListener("fleetcare:unauthorized", handleUnauthorized);
  }, []);

  if (
    !isPublicPath &&
    guardError?.pathname === pathname &&
    checkedPath !== pathname
  ) {
    return (
      <main className="auth-route-loading">
        <section className="auth-guard-error" role="alert">
          <h1>Unable to verify your session</h1>
          <p>{guardError.message}</p>
          <button
            className="auth-submit"
            onClick={() => {
              setGuardError(null);
              setRetryVersion((version) => version + 1);
            }}
            type="button"
          >
            Try again
          </button>
          <Link href="/login">Go to sign in</Link>
        </section>
      </main>
    );
  }

  if (!isPublicPath && checkedPath !== pathname) {
    return (
      <main className="auth-route-loading" role="status" aria-live="polite">
        Checking your session…
      </main>
    );
  }

  return children;
}
