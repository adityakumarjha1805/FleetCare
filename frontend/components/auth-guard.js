"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchCurrentUser } from "../lib/auth-api";

const publicPaths = new Set(["/login", "/signup", "/verify-email"]);

export default function AuthGuard({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sessionStatus, setSessionStatus] = useState("checking");
  const [guardError, setGuardError] = useState("");
  const validationId = useRef(0);
  const isPublicPath = publicPaths.has(pathname);

  const verifySession = useCallback(async () => {
    const requestId = ++validationId.current;
    setSessionStatus("checking");
    setGuardError("");

    try {
      await fetchCurrentUser();
      if (requestId === validationId.current) {
        setSessionStatus("authenticated");
      }
    } catch (error) {
      if (requestId !== validationId.current) return;
      if (error.status === 401) {
        setSessionStatus("unauthenticated");
        return;
      }
      setGuardError(
        error.message || "Unable to verify your session right now.",
      );
      setSessionStatus("error");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(verifySession, 0);
    return () => window.clearTimeout(timer);
  }, [verifySession]);

  useEffect(() => {
    function handleUnauthorized() {
      validationId.current += 1;
      setGuardError("");
      setSessionStatus("unauthenticated");
    }

    function handleAuthenticated() {
      validationId.current += 1;
      setGuardError("");
      setSessionStatus("authenticated");
    }

    function handleSessionEnded() {
      validationId.current += 1;
      setGuardError("");
      setSessionStatus("unauthenticated");
    }

    window.addEventListener("fleetcare:unauthorized", handleUnauthorized);
    window.addEventListener("fleetcare:session-authenticated", handleAuthenticated);
    window.addEventListener("fleetcare:session-ended", handleSessionEnded);
    return () => {
      window.removeEventListener("fleetcare:unauthorized", handleUnauthorized);
      window.removeEventListener(
        "fleetcare:session-authenticated",
        handleAuthenticated,
      );
      window.removeEventListener("fleetcare:session-ended", handleSessionEnded);
    };
  }, []);

  useEffect(() => {
    if (sessionStatus === "authenticated" && isPublicPath) {
      router.replace("/");
    } else if (sessionStatus === "unauthenticated" && !isPublicPath) {
      router.replace("/login");
    }
  }, [isPublicPath, pathname, router, sessionStatus]);

  if (isPublicPath) {
    return children;
  }

  if (sessionStatus === "error") {
    return (
      <main className="auth-route-loading">
        <section className="auth-guard-error" role="alert">
          <h1>Unable to verify your session</h1>
          <p>{guardError}</p>
          <button
            className="auth-submit"
            onClick={verifySession}
            type="button"
          >
            Try again
          </button>
          <Link href="/login">Go to sign in</Link>
        </section>
      </main>
    );
  }

  if (sessionStatus !== "authenticated") {
    return (
      <main className="auth-route-loading" role="status" aria-live="polite">
        {sessionStatus === "checking"
          ? "Checking your session…"
          : "Redirecting to sign in…"}
      </main>
    );
  }

  return children;
}
