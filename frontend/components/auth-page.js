"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  getAuthErrorMessage,
  loginUser,
  registerUser,
} from "../lib/auth-api";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PENDING_CHALLENGE_KEY = "fleetcare.pendingEmailVerification";
const RESEND_COOLDOWN_MS = 60 * 1000;

function passwordByteLength(value) {
  return new TextEncoder().encode(value).length;
}

export default function AuthPage({ mode }) {
  const isSignup = mode === "signup";
  const router = useRouter();
  const [values, setValues] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setError("");
  }

  function validate() {
    const email = values.email.trim();
    if (isSignup && !values.name.trim()) return "Enter your name.";
    if (isSignup && values.name.trim().length > 100) {
      return "Name must be 100 characters or fewer.";
    }
    if (!emailPattern.test(email) || email.length > 254) {
      return "Enter a valid email address.";
    }
    if (!values.password) return "Enter your password.";
    if (isSignup) {
      const passwordLength = passwordByteLength(values.password);
      if (passwordLength < 8 || passwordLength > 72) {
        return "Password must be 8–72 UTF-8 bytes.";
      }
      if (values.confirmPassword !== values.password) {
        return "Passwords do not match.";
      }
    }
    return "";
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      let challenge;
      if (isSignup) {
        challenge = await registerUser({
          name: values.name.trim(),
          email: values.email.trim().toLowerCase(),
          password: values.password,
        });
      } else {
        challenge = await loginUser({
          email: values.email.trim().toLowerCase(),
          password: values.password,
        });
      }

      sessionStorage.setItem(
        PENDING_CHALLENGE_KEY,
        JSON.stringify({
          challengeId: challenge.challengeId,
          resendAvailableAt: Date.now() + RESEND_COOLDOWN_MS,
        }),
      );
      router.push("/verify-email");
    } catch (requestError) {
      setError(getAuthErrorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
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
          <p className="eyebrow">FLEET OPERATIONS WORKSPACE</p>
          <h1 id="auth-title">{isSignup ? "Create your account" : "Welcome back"}</h1>
          <p>
            {isSignup
              ? "Set up your FleetCare account to manage your vehicles."
              : "Sign in to continue to your FleetCare dashboard."}
          </p>
        </div>

        {error && (
          <p className="auth-message auth-error" role="alert">
            {error}
          </p>
        )}
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {isSignup && (
            <div className="auth-field">
              <label htmlFor="auth-name">Name</label>
              <input
                autoComplete="name"
                id="auth-name"
                maxLength={100}
                name="name"
                onChange={updateField}
                required
                value={values.name}
              />
            </div>
          )}
          <div className="auth-field">
            <label htmlFor="auth-email">Email</label>
            <input
              autoComplete="email"
              id="auth-email"
              name="email"
              onChange={updateField}
              required
              type="email"
              value={values.email}
            />
          </div>
          <div className="auth-field">
            <label htmlFor="auth-password">Password</label>
            <input
              autoComplete={isSignup ? "new-password" : "current-password"}
              id="auth-password"
              name="password"
              onChange={updateField}
              required
              type="password"
              value={values.password}
            />
            {isSignup && (
              <small className="auth-field-hint">
                Use at least 8 characters.
              </small>
            )}
          </div>
          {isSignup && (
            <div className="auth-field">
              <label htmlFor="auth-confirm-password">Confirm password</label>
              <input
                autoComplete="new-password"
                id="auth-confirm-password"
                name="confirmPassword"
                onChange={updateField}
                required
                type="password"
                value={values.confirmPassword}
              />
            </div>
          )}
          <button
            className="auth-submit"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting
              ? isSignup
                ? "Creating account…"
                : "Signing in…"
              : isSignup
                ? "Create account"
                : "Sign in"}
          </button>
        </form>

        <p className="auth-switch">
          {isSignup ? "Already have an account?" : "New to FleetCare?"}{" "}
          <Link href={isSignup ? "/login" : "/signup"}>
            {isSignup ? "Sign in" : "Create an account"}
          </Link>
        </p>
      </section>
    </main>
  );
}
