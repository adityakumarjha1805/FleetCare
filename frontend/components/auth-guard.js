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
  const [onboardingFlowStarted, setOnboardingFlowStarted] = useState(false);
  const validationId = useRef(0);
  const isPublicPath = publicPaths.has(pathname);
  const isOnboardingPath = pathname === "/onboarding";

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
      setGuardError(
        error.message || "Unable to verify your session right now.",
      );
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
      setGuardError("");
      setUser(null);
      setOnboardingFlowStarted(false);
      setSessionStatus("unauthenticated");
    }

    function handleAuthenticated(event) {
      validationId.current += 1;
      setGuardError("");
      setUser(event.detail?.user || null);
      setSessionStatus("authenticated");
    }

    function handleOnboardingCompleted(event) {
      validationId.current += 1;
      setGuardError("");
      setUser(event.detail?.user || null);
      setSessionStatus("authenticated");
    }

    function handleOnboardingStarted() {
      setOnboardingFlowStarted(true);
    }

    function handleSessionEnded() {
      validationId.current += 1;
      setGuardError("");
      setUser(null);
      setOnboardingFlowStarted(false);
      setSessionStatus("unauthenticated");
    }

    window.addEventListener("fleetcare:unauthorized", handleUnauthorized);
    window.addEventListener("fleetcare:session-authenticated", handleAuthenticated);
    window.addEventListener(
      "fleetcare:onboarding-completed",
      handleOnboardingCompleted,
    );
    window.addEventListener(
      "fleetcare:onboarding-started",
      handleOnboardingStarted,
    );
    window.addEventListener("fleetcare:session-ended", handleSessionEnded);
    return () => {
      window.removeEventListener("fleetcare:unauthorized", handleUnauthorized);
      window.removeEventListener(
        "fleetcare:session-authenticated",
        handleAuthenticated,
      );
      window.removeEventListener(
        "fleetcare:onboarding-completed",
        handleOnboardingCompleted,
      );
      window.removeEventListener(
        "fleetcare:onboarding-started",
        handleOnboardingStarted,
      );
      window.removeEventListener("fleetcare:session-ended", handleSessionEnded);
    };
  }, []);

  useEffect(() => {
    if (sessionStatus === "unauthenticated" && !isPublicPath) {
      const returnPath = getSafeReturnPath(pathname);
      router.replace(
        returnPath ? `/login?next=${encodeURIComponent(returnPath)}` : "/login",
      );
      return;
    }

    if (sessionStatus !== "authenticated" || !user) return;

    if (isPublicPath) {
      if (pathname !== "/") {
        const returnPath = getSafeReturnPath(
          new URLSearchParams(window.location.search).get("next"),
        );
        router.replace(
          user.onboardingCompleted
            ? returnPath || "/dashboard"
            : "/onboarding",
        );
      }
    } else if (user.onboardingCompleted && isOnboardingPath) {
      router.replace("/dashboard");
    } else if (
      !user.onboardingCompleted &&
      !isOnboardingPath &&
      !onboardingFlowStarted
    ) {
      router.replace("/onboarding");
    }
  }, [
    isOnboardingPath,
    isPublicPath,
    onboardingFlowStarted,
    pathname,
    router,
    sessionStatus,
    user,
  ]);

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

  if (
    user?.onboardingCompleted === false &&
    !isOnboardingPath &&
    !onboardingFlowStarted &&
    !isPublicPath
  ) {
    return (
      <main className="auth-route-loading" role="status" aria-live="polite">
        Redirecting to onboarding…
      </main>
    );
  }

  return children;
}
