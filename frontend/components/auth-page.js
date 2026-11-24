"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  getAuthErrorMessage,
  loginUser,
  registerUser,
} from "../lib/auth-api";
import { getSafeReturnPath } from "../lib/safe-return-path";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function passwordByteLength(value) {
  return new TextEncoder().encode(value).length;
}

function getPasswordRequirements(password) {
  return [
    {
      id: "minimum-length",
      label: "At least 8 characters",
      isMet: password.length >= 8,
    },
    {
      id: "maximum-byte-length",
      label: "No more than 72 UTF-8 bytes",
      isMet: passwordByteLength(password) <= 72,
    },
  ];
}

function PasswordVisibilityIcon({ isVisible }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="20"
      viewBox="0 0 24 24"
      width="20"
    >
      <path
        d="M2.5 12s3.3-6 9.5-6 9.5 6 9.5 6-3.3 6-9.5 6-9.5-6-9.5-6Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      {isVisible ? (
        <path
          d="m4 4 16 16M10.6 10.6a2 2 0 0 0 2.8 2.8"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
      ) : (
        <circle
          cx="12"
          cy="12"
          r="2.5"
          stroke="currentColor"
          strokeWidth="1.7"
        />
      )}
    </svg>
  );
}

function PasswordRequirementIcon({ isMet }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="15"
      viewBox="0 0 16 16"
      width="15"
    >
      {isMet ? (
        <path
          d="m3.25 8.25 3 3 6.5-6.5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      ) : (
        <circle cx="8" cy="8" r="5.25" stroke="currentColor" strokeWidth="1.5" />
      )}
    </svg>
  );
}

export default function AuthPage({ mode }) {
  const isSignup = mode === "signup";
  const router = useRouter();
  const passwordInputRef = useRef(null);
  const confirmPasswordInputRef = useRef(null);
  const [values, setValues] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const [passwordSubmitAttempted, setPasswordSubmitAttempted] = useState(false);
  const [confirmSubmitAttempted, setConfirmSubmitAttempted] = useState(false);
  const unmetPasswordRequirements = getPasswordRequirements(values.password)
    .filter((requirement) => !requirement.isMet);
  const confirmPasswordMessage = isSignup
    ? values.confirmPassword
      ? values.confirmPassword === values.password
        ? ""
        : "Those passwords do not match yet. Please check and try again."
      : confirmSubmitAttempted
        ? "Please enter your password again to confirm."
        : ""
    : "";

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
    if (isSignup) {
      if (unmetPasswordRequirements.length > 0) {
        return { field: "password" };
      }
      if (!values.confirmPassword) return { field: "confirmPassword" };
      if (values.confirmPassword !== values.password) {
        return { field: "confirmPassword" };
      }
    } else if (!values.password) {
      return { field: "password", message: "Enter your password." };
    }
    return null;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError.message || "");
      if (validationError.field === "password") {
        if (isSignup) setPasswordSubmitAttempted(true);
        passwordInputRef.current?.focus();
      } else {
        setConfirmSubmitAttempted(true);
        confirmPasswordInputRef.current?.focus();
      }
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      const returnPath = getSafeReturnPath(
        new URLSearchParams(window.location.search).get("next"),
      );
      if (isSignup) {
        await registerUser({
          name: values.name.trim(),
          email: values.email.trim().toLowerCase(),
          password: values.password,
        });
        router.replace(
          returnPath
            ? `/login?next=${encodeURIComponent(returnPath)}`
            : "/login",
        );
        return;
      }

      const user = await loginUser({
        email: values.email.trim().toLowerCase(),
        password: values.password,
      });
      router.replace(returnPath || (user.role === "admin" ? "/admin" : "/dashboard"));
    } catch (requestError) {
      setError(
        !isSignup && requestError?.code === "INVALID_CREDENTIALS"
          ? "We couldn't sign you in with those details. Check your email and password, then try again."
          : getAuthErrorMessage(requestError),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <Link className="auth-brand" href="/" aria-label="Telfay">
          <span className="auth-brand-mark" aria-hidden="true" />
          <span className="new-brand-wordmark">
            <b>tel</b>
            <i>fay</i>
          </span>
        </Link>

        <div className="auth-heading">
          <p className="eyebrow">FLEET OPERATIONS WORKSPACE</p>
          <h1 id="auth-title">{isSignup ? "Create your account" : "Welcome back"}</h1>
          <p>
            {isSignup
              ? "Set up your Telfay account to manage your vehicles."
              : "Sign in to continue to your Telfay dashboard."}
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
            <div className="auth-password-control">
              <input
                aria-describedby={
                  isSignup
                    ? [
                        "auth-password-requirements",
                        passwordSubmitAttempted &&
                        unmetPasswordRequirements.length > 0
                          ? "auth-password-guidance"
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" ")
                    : undefined
                }
                aria-invalid={
                  isSignup &&
                  passwordSubmitAttempted &&
                  unmetPasswordRequirements.length > 0
                    ? "true"
                    : undefined
                }
                autoComplete={isSignup ? "new-password" : "current-password"}
                id="auth-password"
                name="password"
                onChange={updateField}
                ref={passwordInputRef}
                required
                type={isPasswordVisible ? "text" : "password"}
                value={values.password}
              />
              <button
                aria-label={isPasswordVisible ? "Hide password" : "Show password"}
                aria-pressed={isPasswordVisible}
                className="auth-password-toggle"
                onClick={() => setIsPasswordVisible((visible) => !visible)}
                type="button"
              >
                <PasswordVisibilityIcon isVisible={isPasswordVisible} />
              </button>
            </div>
            {isSignup && (
              <>
                <ul
                  aria-label="Password requirements"
                  className="auth-password-checklist"
                  id="auth-password-requirements"
                >
                  {getPasswordRequirements(values.password).map(
                    (requirement) => (
                      <li
                        aria-label={`${requirement.label}: ${requirement.isMet ? "satisfied" : "not yet satisfied"}`}
                        className={requirement.isMet ? "is-satisfied" : ""}
                        key={requirement.id}
                      >
                        <span className="auth-password-requirement-icon">
                          <PasswordRequirementIcon isMet={requirement.isMet} />
                        </span>
                        <span>{requirement.label}</span>
                        <span className="auth-sr-only">
                          {requirement.isMet ? "Satisfied" : "Not yet satisfied"}
                        </span>
                      </li>
                    ),
                  )}
                </ul>
                {passwordSubmitAttempted &&
                  unmetPasswordRequirements.length > 0 && (
                    <p
                      className="auth-password-guidance"
                      id="auth-password-guidance"
                      role="alert"
                    >
                      Your password needs a little more work. Please complete
                      the remaining requirements below:{" "}
                      {unmetPasswordRequirements
                        .map((requirement) => requirement.label)
                        .join("; ")}
                      .
                    </p>
                  )}
              </>
            )}
          </div>
          {isSignup && (
            <div className="auth-field">
              <label htmlFor="auth-confirm-password">Confirm password</label>
              <div className="auth-password-control">
                <input
                  aria-describedby={
                    confirmPasswordMessage
                      ? "auth-confirm-password-feedback"
                      : undefined
                  }
                  aria-invalid={confirmPasswordMessage ? "true" : undefined}
                  autoComplete="new-password"
                  id="auth-confirm-password"
                  name="confirmPassword"
                  onChange={updateField}
                  ref={confirmPasswordInputRef}
                  required
                  type={isConfirmPasswordVisible ? "text" : "password"}
                  value={values.confirmPassword}
                />
                <button
                  aria-label={
                    isConfirmPasswordVisible
                      ? "Hide password"
                      : "Show password"
                  }
                  aria-pressed={isConfirmPasswordVisible}
                  className="auth-password-toggle"
                  onClick={() =>
                    setIsConfirmPasswordVisible((visible) => !visible)
                  }
                  type="button"
                >
                  <PasswordVisibilityIcon
                    isVisible={isConfirmPasswordVisible}
                  />
                </button>
              </div>
              {confirmPasswordMessage && (
                <small
                  className="auth-confirm-password-feedback"
                  id="auth-confirm-password-feedback"
                  role="status"
                >
                  {confirmPasswordMessage}
                </small>
              )}
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
          {isSignup ? "Already have an account?" : "New to Telfay?"}{" "}
          <Link href={isSignup ? "/login" : "/signup"}>
            {isSignup ? "Sign in" : "Create an account"}
          </Link>
        </p>
      </section>
    </main>
  );
}
