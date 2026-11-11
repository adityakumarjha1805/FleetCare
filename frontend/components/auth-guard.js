"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchCurrentUser } from "../lib/auth-api";
import { getSafeReturnPath } from "../lib/safe-return-path";

const publicPaths = new Set(["/", "/login", "/signin", "/signup", "/register"]);

export default function AuthGuard({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sessionStatus, setSessionStatus] = useState("checking");
  const [guardError, setGuardError] = useState("");
  const [user, setUser] = useState(null);
  const validationId = useRef(0);
  const isPublicPath = publicPaths.has(pathname);

  const verifySession = useCallback(async () => {
    const requestId = ++validationId.current;
    setSessionStatus("checking");
    setGuardError("");
    try {
      const currentUser = await fetchCurrentUser();
      if (requestId === validationId.current) {
        setUser(currentUser);
        setSessionStatus("authenticated");
      }
    } catch (error) {
      if (requestId !== validationId.current) return;
      if (error.status === 401) {
        setSessionStatus("unauthenticated");
        return;
      }
      setGuardError(error.message || "Unable to verify your session right now.");
      setSessionStatus("error");
    }
  }, []);

  useEffect(() => {
    if (isPublicPath) return undefined;
    const timer = window.setTimeout(verifySession, 0);
    return () => window.clearTimeout(timer);
  }, [isPublicPath, verifySession]);

  useEffect(() => {
    function handleUnauthorized() {
      validationId.current += 1;
      setUser(null);
      setSessionStatus("unauthenticated");
    }
    function handleAuthenticated(event) {
      validationId.current += 1;
      setUser(event.detail?.user || null);
      setSessionStatus("authenticated");
    }
    function handleSessionEnded() {
      validationId.current += 1;
      setUser(null);
      setSessionStatus("unauthenticated");
    }
    window.addEventListener("fleetcare:unauthorized", handleUnauthorized);
    window.addEventListener("fleetcare:session-authenticated", handleAuthenticated);
    window.addEventListener("fleetcare:session-ended", handleSessionEnded);
    return () => {
      window.removeEventListener("fleetcare:unauthorized", handleUnauthorized);
      window.removeEventListener("fleetcare:session-authenticated", handleAuthenticated);
      window.removeEventListener("fleetcare:session-ended", handleSessionEnded);
    };
  }, []);

  useEffect(() => {
    if (sessionStatus === "unauthenticated" && !isPublicPath) {
      const returnPath = getSafeReturnPath(pathname);
      router.replace(returnPath ? `/login?next=${encodeURIComponent(returnPath)}` : "/login");
      return;
    }
    if (sessionStatus === "authenticated" && user && isPublicPath && pathname !== "/") {
      const returnPath = getSafeReturnPath(new URLSearchParams(window.location.search).get("next"));
      router.replace(returnPath || (user.role === "admin" ? "/admin" : "/dashboard"));
    }
  }, [isPublicPath, pathname, router, sessionStatus, user]);

  if (isPublicPath) return children;
  if (sessionStatus === "error") {
    return (
      <main className="auth-route-loading">
        <section className="auth-guard-error" role="alert">
          <h1>Unable to verify your session</h1>
          <p>{guardError}</p>
          <button className="auth-submit" onClick={verifySession} type="button">Try again</button>
          <Link href="/login">Go to sign in</Link>
        </section>
      </main>
    );
  }
  if (sessionStatus !== "authenticated") {
    return (
      <main className="auth-route-loading" role="status" aria-live="polite">
        {sessionStatus === "checking" ? "Checking your session…" : "Redirecting to sign in…"}
      </main>
    );
  }
  return children;
}
