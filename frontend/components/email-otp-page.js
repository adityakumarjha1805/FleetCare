"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError } from "../lib/api-client";
import { resendEmailOtp, verifyEmailOtp } from "../lib/auth-api";

const PENDING_CHALLENGE_KEY = "fleetcare.pendingEmailVerification";
const RESEND_COOLDOWN_MS = 60 * 1000;
const challengePattern = /^[A-Za-z0-9_-]{43}$/;

export default function EmailOtpPage() {
  const router = useRouter();
  const [challengeId, setChallengeId] = useState("");
  const [resendAvailableAt, setResendAvailableAt] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [isLoadingChallenge, setIsLoadingChallenge] = useState(true);
  const [isUnavailable, setIsUnavailable] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const pending = JSON.parse(
          sessionStorage.getItem(PENDING_CHALLENGE_KEY) || "null",
        );
        if (!challengePattern.test(pending?.challengeId || "")) {
          setIsUnavailable(true);
          return;
        }

        setChallengeId(pending.challengeId);
        setResendAvailableAt(
          Number.isFinite(pending.resendAvailableAt)
            ? pending.resendAvailableAt
            : Date.now(),
        );
      } catch {
        setIsUnavailable(true);
      } finally {
        setIsLoadingChallenge(false);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!resendAvailableAt) return undefined;
    const updateCountdown = () => {
      setRemainingSeconds(
        Math.max(0, Math.ceil((resendAvailableAt - Date.now()) / 1000)),
      );
    };
    updateCountdown();
    const timer = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(timer);
  }, [resendAvailableAt]);

  function clearPendingChallenge() {
    sessionStorage.removeItem(PENDING_CHALLENGE_KEY);
    setChallengeId("");
    setIsUnavailable(true);
  }

  function storeResendDeadline(deadline) {
    setResendAvailableAt(deadline);
    sessionStorage.setItem(
      PENDING_CHALLENGE_KEY,
      JSON.stringify({ challengeId, resendAvailableAt: deadline }),
    );
  }

  async function handleVerify(event) {
    event.preventDefault();
    if (isVerifying || !challengeId || !/^\d{6}$/.test(otp)) return;

    setIsVerifying(true);
    setError("");
    try {
      await verifyEmailOtp({ challengeId, otp });
      clearPendingChallenge();
      router.replace("/");
    } catch (requestError) {
      if (
        requestError instanceof ApiError &&
        requestError.code === "INVALID_CHALLENGE"
      ) {
        clearPendingChallenge();
        return;
      }
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Unable to verify the code. Please try again.",
      );
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleResend() {
    if (isResending || !challengeId || remainingSeconds > 0) return;

    setIsResending(true);
    setError("");
    try {
      await resendEmailOtp(challengeId);
      storeResendDeadline(Date.now() + RESEND_COOLDOWN_MS);
      setOtp("");
    } catch (requestError) {
      if (requestError instanceof ApiError) {
        if (requestError.code === "INVALID_CHALLENGE") {
          clearPendingChallenge();
          return;
        }
        if (requestError.status === 429 && requestError.retryAfterSeconds) {
          storeResendDeadline(
            Date.now() + requestError.retryAfterSeconds * 1000,
          );
        }
      }
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Unable to resend the code. Please try again.",
      );
    } finally {
      setIsResending(false);
    }
  }

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = String(remainingSeconds % 60).padStart(2, "0");

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="otp-title">
        <Link className="auth-brand" href="/" aria-label="FleetCare">
          <span className="auth-brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M4 16.5h16l-1.7-6.2a2 2 0 0 0-1.9-1.5H7.6a2 2 0 0 0-1.9 1.5L4 16.5Z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
              <path
                d="M6 16.5v2m12-2v2M7.5 13h9"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <span>FleetCare</span>
        </Link>

        <div className="auth-heading">
          <p className="eyebrow">EMAIL VERIFICATION</p>
          <h1 id="otp-title">Check your email</h1>
          <p>
            Enter the six-digit verification code sent to your registered email
            address.
          </p>
        </div>

        {error && (
          <p className="auth-message auth-error" role="alert">
            {error}
          </p>
        )}

        {isLoadingChallenge ? (
          <p className="auth-message" role="status" aria-live="polite">
            Preparing your verification…
          </p>
        ) : isUnavailable ? (
          <div className="auth-form">
            <p className="auth-message auth-error" role="status">
              This verification session is unavailable or has expired. Start
              again to request a new code.
            </p>
            <Link className="auth-submit auth-link-button" href="/login">
              Return to sign in
            </Link>
          </div>
        ) : (
          <>
            <form className="auth-form" onSubmit={handleVerify} noValidate>
              <div className="auth-field">
                <label htmlFor="email-otp">Verification code</label>
                <input
                  autoComplete="one-time-code"
                  autoFocus
                  id="email-otp"
                  inputMode="numeric"
                  maxLength={6}
                  name="otp"
                  onChange={(event) =>
                    setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  pattern="[0-9]{6}"
                  required
                  type="text"
                  value={otp}
                />
              </div>
              <button
                className="auth-submit"
                disabled={isVerifying || isResending || otp.length !== 6}
                type="submit"
              >
                {isVerifying ? "Verifying…" : "Verify email"}
              </button>
            </form>

            <div className="auth-resend">
              <p>
                {remainingSeconds > 0
                  ? `You can request another code in ${minutes}:${seconds}.`
                  : "Didn’t receive the code?"}
              </p>
              <button
                className="auth-resend-button"
                disabled={isResending || isVerifying || remainingSeconds > 0}
                onClick={handleResend}
                type="button"
              >
                {isResending ? "Sending…" : "Resend code"}
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
