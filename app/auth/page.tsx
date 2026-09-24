"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "../../lib/supabase/client";

type Mode = "signup" | "signin";
type ToastType = "success" | "error";

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  const [toast, setToast] = useState<{
    title: string;
    text: string;
    type: ToastType;
  } | null>(null);

  const toastTimer = useRef<number | null>(null);
  const supabase = createClient();

  const titles = {
    signup: "Create your LearnMate account",
    signin: "Welcome back to LearnMate",
  };

  const subtitles = {
    signup: "Start your personalized learning journey.",
    signin: "Welcome back. Pick up where you left off.",
  };

  const [typedTitle, setTypedTitle] = useState("");

  useEffect(() => {
    let index = 0;
    setTypedTitle("");

    const timer = window.setInterval(() => {
      index++;
      setTypedTitle(titles[mode].slice(0, index));

      if (index >= titles[mode].length) {
        window.clearInterval(timer);
      }
    }, 42);

    return () => window.clearInterval(timer);
  }, [mode]);

  useEffect(() => {
    const resetLoading = () => {
      setLoading(false);
    };

    window.addEventListener("pageshow", resetLoading);
    window.addEventListener("focus", resetLoading);

    return () => {
      window.removeEventListener("pageshow", resetLoading);
      window.removeEventListener("focus", resetLoading);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current !== null) {
        window.clearTimeout(toastTimer.current);
      }
    };
  }, []);

  /*
   * Google OAuth returns to:
   * /auth?google=success
   *
   * Show the success toast for 3 seconds,
   * then redirect to the dashboard.
   */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.get("google") !== "success") {
      return;
    }

    window.history.replaceState({}, "", "/auth");

    showToast(
      "Google sign in successful",
      "You have successfully signed in with Google.",
      "success"
    );

    const redirectTimer = window.setTimeout(() => {
      window.location.href = "/dashboard";
    }, 3000);

    return () => window.clearTimeout(redirectTimer);
  }, []);

  function showToast(
    title: string,
    text: string,
    type: ToastType = "success"
  ) {
    if (toastTimer.current !== null) {
      window.clearTimeout(toastTimer.current);
    }

    setToast({
      title,
      text,
      type,
    });

    toastTimer.current = window.setTimeout(() => {
      setToast(null);
      toastTimer.current = null;
    }, 3000);
  }

  function isValidName(value: string) {
    const trimmed = value.trim();

    if (!trimmed) {
      return false;
    }

    if (trimmed.length < 3 || trimmed.length > 30) {
      return false;
    }

    // Letters and spaces only.
    return /^[A-Za-z ]+$/.test(trimmed);
  }

  function isValidEmail(value: string) {
    const trimmed = value.trim();

    // Requires a normal email structure ending in .com.
    return /^[^\s@]+@[^\s@]+\.com$/i.test(trimmed);
  }

  function getPasswordStrength(value: string) {
    if (!value) {
      return {
        level: 0,
        label: "",
        hint: "",
      };
    }

    let score = 0;

    if (value.length >= 8) score++;
    if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++;
    if (/\d/.test(value)) score++;
    if (/[^A-Za-z0-9]/.test(value)) score++;
    if (value.length >= 12) score++;

    if (score <= 2) {
      return {
        level: 1,
        label: "Weak",
        hint: "Add numbers & symbols",
      };
    }

    if (score === 3) {
      return {
        level: 2,
        label: "Medium",
        hint: "Good — add more length",
      };
    }

    return {
      level: 3,
      label: "Strong",
      hint: "Great password",
    };
  }

  const strength = getPasswordStrength(password);

  async function signUp() {
    if (loading) return;

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      showToast(
        "Name required",
        "Please enter your name.",
        "error"
      );
      return;
    }

    if (trimmedName.length < 3) {
      showToast(
        "Name too short",
        "Your name must be at least 3 characters.",
        "error"
      );
      return;
    }

    if (trimmedName.length > 30) {
      showToast(
        "Name too long",
        "Your name cannot exceed 30 characters.",
        "error"
      );
      return;
    }

    if (!isValidName(trimmedName)) {
      showToast(
        "Invalid name",
        "Name can only contain letters and spaces.",
        "error"
      );
      return;
    }

    if (!trimmedEmail) {
      showToast(
        "Email required",
        "Please enter your email.",
        "error"
      );
      return;
    }

    if (!isValidEmail(trimmedEmail)) {
      showToast(
        "Invalid email",
        "Please enter a valid .com email address.",
        "error"
      );
      return;
    }

    if (!password) {
      showToast(
        "Password required",
        "Please enter a password.",
        "error"
      );
      return;
    }

    if (password.length < 6) {
      showToast(
        "Password too short",
        "Password must be at least 6 characters.",
        "error"
      );
      return;
    }

    if (password.length > 20) {
      showToast(
        "Password too long",
        "Password cannot exceed 20 characters.",
        "error"
      );
      return;
    }

    if (!confirmPassword) {
      showToast(
        "Confirm your password",
        "Please repeat your password.",
        "error"
      );
      return;
    }

    if (password !== confirmPassword) {
      showToast(
        "Passwords don't match",
        "Please make sure both passwords are the same.",
        "error"
      );
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            full_name: trimmedName,
          },
        },
      });

      if (error) {
        const errorMessage = error.message.toLowerCase();

        if (
          errorMessage.includes("already registered") ||
          errorMessage.includes("already exists") ||
          errorMessage.includes("user already") ||
          errorMessage.includes("already been registered")
        ) {
          showToast(
            "Email already exists",
            "An account with this email already exists.",
            "error"
          );
          return;
        }

        showToast(
          "Unable to create account",
          error.message,
          "error"
        );
        return;
      }

      if (!data.user) {
        showToast(
          "Unable to create account",
          "Something went wrong while creating your account.",
          "error"
        );
        return;
      }

      // Supabase may return a user with no identities
      // when the email already belongs to an account.
      if (
        data.user.identities &&
        data.user.identities.length === 0
      ) {
        showToast(
          "Email already exists",
          "An account with this email already exists.",
          "error"
        );
        return;
      }

      showToast(
        "Account created",
        "Check your email to verify your account.",
        "success"
      );
    } catch {
      showToast(
        "Unable to create account",
        "Something went wrong. Please try again.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  }

  async function signIn() {
    if (loading) return;

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      showToast(
        "Email required",
        "Please enter your email.",
        "error"
      );
      return;
    }

    if (!isValidEmail(trimmedEmail)) {
      showToast(
        "Invalid email",
        "Please enter a valid .com email address.",
        "error"
      );
      return;
    }

    if (!password) {
      showToast(
        "Password required",
        "Please enter your password.",
        "error"
      );
      return;
    }

    if (password.length > 20) {
      showToast(
        "Password too long",
        "Password cannot exceed 20 characters.",
        "error"
      );
      return;
    }

    setLoading(true);

    try {
      const { error } =
        await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });

      if (error) {
        showToast(
          "Sign in failed",
          error.message,
          "error"
        );
        return;
      }

      showToast(
        "Welcome back",
        "You have successfully signed in.",
        "success"
      );

      window.setTimeout(() => {
        window.location.href = "/dashboard";
      }, 3000);
    } catch {
      showToast(
        "Sign in failed",
        "Something went wrong. Please try again.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  }

  async function signInWithGoogle() {
    if (loading) return;

    setLoading(true);

    try {
      const nextPath = encodeURIComponent(
        "/auth?google=success"
      );

      const redirectTo =
        `${window.location.origin}/auth/callback?next=${nextPath}`;

      const { data, error } =
        await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo,
          },
        });

      if (error) {
        showToast(
          "Google sign in failed",
          error.message,
          "error"
        );
        setLoading(false);
        return;
      }

      if (!data.url) {
        showToast(
          "Google sign in failed",
          "Unable to start Google sign-in.",
          "error"
        );
        setLoading(false);
        return;
      }

      window.location.assign(data.url);
    } catch {
      setLoading(false);

      showToast(
        "Google sign in failed",
        "Something went wrong. Please try again.",
        "error"
      );
    }
  }

  async function forgotPassword() {
    if (loading) return;

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      showToast(
        "Email required",
        "Please enter your email first.",
        "error"
      );
      return;
    }

    if (!isValidEmail(trimmedEmail)) {
      showToast(
        "Invalid email",
        "Please enter a valid .com email address.",
        "error"
      );
      return;
    }

    setLoading(true);

    try {
      const { error } =
        await supabase.auth.resetPasswordForEmail(
          trimmedEmail,
          {
            redirectTo: `${window.location.origin}/auth`,
          }
        );

      if (error) {
        showToast(
          "Unable to send reset link",
          error.message,
          "error"
        );
        return;
      }

      showToast(
        "Reset link sent",
        "Check your email to reset your password.",
        "success"
      );
    } catch {
      showToast(
        "Unable to send reset link",
        "Something went wrong. Please try again.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  }

  function switchMode(newMode: Mode) {
    setMode(newMode);
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
    setLoading(false);
    setToast(null);
  }

  return (
    <main
      className={`auth-page ${darkMode ? "dark-mode" : ""}`}
    >
      {toast && (
        <div
          className={`success-toast ${toast.type === "error" ? "error-toast" : ""
            }`}
        >
          <div className="success-toast-icon">
            {toast.type === "success" ? "✓" : "×"}
          </div>

          <div className="success-toast-content">
            <strong>{toast.title}</strong>
            <span>{toast.text}</span>
          </div>
        </div>
      )}

      {/* DARK MODE SWITCH */}
      <label
        className="theme-switch"
        aria-label="Toggle dark mode"
      >
        <input
          type="checkbox"
          className="theme-switch__checkbox"
          checked={darkMode}
          onChange={(e) => setDarkMode(e.target.checked)}
        />

        <div className="theme-switch__container">
          <div className="theme-switch__clouds"></div>

          <div className="theme-switch__stars-container">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 144 55"
              fill="none"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M135.831 3.00688C135.055 3.85027 134.111 4.29946 133 4.35447C134.111 4.40947 135.055 4.85867 135.831 5.71123C136.607 6.55462 136.996 7.56303 136.996 8.72727C136.996 7.95722 137.172 7.25134 137.525 6.59129C137.886 5.93124 138.372 5.39954 138.98 5.00535C139.598 4.60199 140.268 4.39114 141 4.35447C139.88 4.2903 138.936 3.85027 138.16 3.00688C137.384 2.16348 136.996 1.16425 136.996 0C136.996 1.16425 136.607 2.16348 135.831 3.00688ZM31 23.3545C32.1114 23.2995 33.0551 22.8503 33.8313 22.0069C34.6075 21.1635 34.9956 20.1642 34.9956 19C34.9956 20.1642 35.3837 21.1635 36.1599 22.0069C36.9361 22.8503 37.8798 23.2903 39 23.3545C38.2679 23.3911 37.5976 23.602 36.9802 24.0053C36.3716 24.3995 35.8864 24.9312 35.5248 25.5913C35.172 26.2513 34.9956 26.9572 34.9956 27.7273C34.9956 26.563 34.6075 25.5546 33.8313 24.7112C33.0551 23.8587 32.1114 23.4095 31 23.3545ZM0 36.3545C1.11136 36.2995 2.05513 35.8503 2.83131 35.0069C3.6075 34.1635 3.99559 33.1642 3.99559 32C3.99559 33.1642 4.38368 34.1635 5.15987 35.0069C5.93605 35.8503 6.87982 36.2903 8 36.3545C7.26792 36.3911 6.59757 36.602 5.98015 37.0053C5.37155 37.3995 4.88644 37.9312 4.52481 38.5913C4.172 39.2513 3.99559 39.9572 3.99559 40.7273C3.99559 39.563 3.6075 38.5546 2.83131 37.7112C2.05513 36.8587 1.11136 36.4095 0 36.3545ZM56.8313 24.0069C56.0551 24.8503 55.1111 25.2995 54 25.3545C55.1111 25.4095 56.0551 25.8587 56.8313 26.7112C57.6075 27.5546 57.9956 28.563 57.9956 29.7273C57.9956 28.9572 57.6075 28.2513 58.5248 27.5913C58.8864 26.9312 59.3716 26.3995 59.9802 26.0053C60.5976 25.602 61.2679 25.3911 62 25.3545C60.8798 25.2903 59.9361 24.8503 59.1599 24.0069C58.3837 23.1635 57.9956 22.1642 57.9956 21C57.9956 22.1642 57.6076 23.1635 56.8313 24.0069ZM81 25.3545C82.1114 25.2995 83.0551 24.8503 83.8313 24.0069C84.6075 23.1635 84.9956 22.1642 84.9956 21C84.9956 22.1642 85.3837 23.1635 86.1599 24.0069C86.9361 24.8503 87.8798 25.2903 89 25.3545C88.2679 25.3911 87.5976 25.602 86.9802 26.0053C86.3716 26.3995 85.8864 26.9312 85.5248 27.5913C85.172 28.2513 84.9956 28.9572 84.9956 29.7273C84.9956 28.563 84.6076 27.5546 83.8313 26.7112C83.0551 25.8587 82.1114 25.4095 81 25.3545ZM136 36.3545C137.111 36.2995 138.055 35.8503 138.831 35.0069C139.607 34.1635 139.996 33.1642 139.996 32C139.996 33.1642 140.384 34.1635 141.16 35.0069C141.936 35.8503 142.88 36.2903 144 36.3545C143.268 36.3911 142.598 36.602 141.98 37.0053C141.372 37.3995 140.886 37.9312 140.525 38.5913C140.172 39.2513 139.996 39.9572 139.996 40.7273C139.996 39.563 139.607 38.5546 138.831 37.7112C138.055 36.8587 137.111 36.4095 136 36.3545ZM101.831 49.0069C101.055 49.8503 100.111 50.2995 99 50.3545C100.111 50.4095 101.055 50.8587 101.831 51.7112C102.607 52.5546 102.996 53.563 102.996 54.7273C102.996 53.9572 103.172 53.2513 103.525 52.5913C103.886 51.9312 104.372 51.3995 104.98 51.0053C105.598 50.602 106.268 50.3911 107 50.3545C105.88 50.2903 104.936 49.8503 104.16 49.0069C103.384 48.1635 102.996 47.1642 102.996 46C102.996 47.1642 102.607 48.1635 101.831 49.0069Z"
                fill="currentColor"
              />
            </svg>
          </div>

          <div className="theme-switch__circle-container">
            <div className="theme-switch__sun-moon-container">
              <div className="theme-switch__moon">
                <div className="theme-switch__spot"></div>
                <div className="theme-switch__spot"></div>
                <div className="theme-switch__spot"></div>
              </div>
            </div>
          </div>
        </div>
      </label>

      {/* BACKGROUND DECOR */}
      <div className="page-decor">
        <div className="orb orb-one" />
        <div className="orb orb-two" />
      </div>

      <div className="auth-shell">
        {/* DESKTOP LEFT PANEL */}
        <aside className="brand-side">
          <div className="brand-top">
            <span>LEARNMATE</span>
            <span>STUDY COMPANION</span>
          </div>

          <div className="brand-logo">
            <img
              src="/onlylogo.png"
              alt="LearnMate"
              className="desktop-logo"
            />
          </div>

          <div className="brand-copy">
            <h2>
              Turn studying into an interactive journey.
            </h2>

            <p>
              Learn, practice and understand concepts with a
              learning experience built around you.
            </p>
          </div>

          <div className="features">
            <div className="feature">
              <span className="feature-dot">✓</span>
              <span>AI-powered learning</span>
            </div>

            <div className="feature">
              <span className="feature-dot">✓</span>
              <span>Interactive quizzes & tests</span>
            </div>

            <div className="feature">
              <span className="feature-dot">✓</span>
              <span>Track your progress</span>
            </div>
          </div>

          <div className="brand-footer">
            Small steps every day. Big progress over time.
          </div>
        </aside>

        {/* FORM SIDE */}
        <section className="form-side">
          <div className="mobile-brand">
            <img
              src="/onlylogo.png"
              alt="LearnMate"
              className="mobile-only-logo"
            />
          </div>

          <div className="tabs">
            <button
              type="button"
              className={mode === "signin" ? "active" : ""}
              onClick={() => switchMode("signin")}
            >
              Sign In
            </button>

            <button
              type="button"
              className={mode === "signup" ? "active" : ""}
              onClick={() => switchMode("signup")}
            >
              Sign Up
            </button>
          </div>

          <div className="heading">
            <h1>
              {typedTitle}
              <span className="caret" />
            </h1>

            <p>{subtitles[mode]}</p>
          </div>

          <div className="form-area">
            {mode === "signup" && (
              <div className="field">
                <label htmlFor="name">Name</label>

                <div className="input-wrap">
                  <span className="input-icon">◯</span>

                  <input
                    id="name"
                    type="text"
                    placeholder="Your name"
                    value={name}
                    maxLength={30}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                  />
                </div>
              </div>
            )}

            <div className="field">
              <label htmlFor="email">Email</label>

              <div className="input-wrap">
                <span className="input-icon">✉</span>

                <input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>

              <div className="input-wrap">
                <span className="input-icon">⌕</span>

                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={
                    mode === "signup"
                      ? "Create a strong password"
                      : "Enter your password"
                  }
                  value={password}
                  maxLength={20}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={
                    mode === "signup"
                      ? "new-password"
                      : "current-password"
                  }
                />

                <button
                  type="button"
                  className="show-button"
                  onClick={() =>
                    setShowPassword(!showPassword)
                  }
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>

              {mode === "signup" && password && (
                <div className="strength">
                  <div className="strength-bars">
                    {[1, 2, 3].map((bar) => (
                      <span
                        key={bar}
                        className={
                          bar <= strength.level ? "filled" : ""
                        }
                      />
                    ))}
                  </div>

                  <div className="strength-info">
                    <strong>{strength.label}</strong>
                    <span>{strength.hint}</span>
                  </div>
                </div>
              )}
            </div>

            {mode === "signup" && (
              <div className="field">
                <label htmlFor="confirm-password">
                  Confirm Password
                </label>

                <div className="input-wrap">
                  <span className="input-icon">⌕</span>

                  <input
                    id="confirm-password"
                    type={
                      showConfirmPassword
                        ? "text"
                        : "password"
                    }
                    placeholder="Repeat your password"
                    value={confirmPassword}
                    maxLength={20}
                    onChange={(e) =>
                      setConfirmPassword(e.target.value)
                    }
                    autoComplete="new-password"
                  />

                  <button
                    type="button"
                    className="show-button"
                    onClick={() =>
                      setShowConfirmPassword(
                        !showConfirmPassword
                      )
                    }
                  >
                    {showConfirmPassword ? "Hide" : "Show"}
                  </button>
                </div>

                {confirmPassword && (
                  <p
                    className={
                      password === confirmPassword
                        ? "password-match success"
                        : "password-match error"
                    }
                  >
                    {password === confirmPassword
                      ? "Passwords match"
                      : "Passwords do not match"}
                  </p>
                )}
              </div>
            )}

            {mode === "signin" && (
              <button
                type="button"
                className="forgot-button"
                onClick={forgotPassword}
                disabled={loading}
              >
                Forgot password?
              </button>
            )}

            <button
              type="button"
              className="primary-button"
              disabled={loading}
              onClick={
                mode === "signup" ? signUp : signIn
              }
            >
              {loading
                ? "Please wait..."
                : mode === "signup"
                  ? "Create Account"
                  : "Sign In"}{" "}
              {!loading && "→"}
            </button>

            <div className="divider">
              <span>or</span>
            </div>

            <button
              type="button"
              className="google-button"
              disabled={loading}
              onClick={signInWithGoogle}
            >
              <img
                src="/google.png"
                alt="Google"
                className="google-icon"
              />

              <span>Continue with Google</span>
            </button>
          </div>

          <div className="bottom-text">
            {mode === "signup"
              ? "Already have an account?"
              : "Don't have an account?"}{" "}

            <button
              type="button"
              onClick={() =>
                switchMode(
                  mode === "signup" ? "signin" : "signup"
                )
              }
            >
              {mode === "signup" ? "Sign In" : "Sign Up"}
            </button>
          </div>
        </section>
      </div>

      <style jsx>{`
        :global(html),
        :global(body) {
          margin: 0;
          padding: 0;
          width: 100%;
          min-height: 100%;
        }

        :global(body) {
          overflow-x: hidden;
        }

        :global(*) {
          box-sizing: border-box;
        }

        .auth-page {
          min-height: 100vh;
          min-height: 100dvh;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 28px;
          margin: 0;
          background: #7a2f00;
          color: #2a1a0e;
          font-family:
            Inter, ui-sans-serif, system-ui, -apple-system,
            BlinkMacSystemFont, "Segoe UI", sans-serif;
          overflow: hidden;
          position: relative;
          isolation: isolate;
          transition:
            background 0.65s ease,
            color 0.65s ease;
        }

        .auth-page.dark-mode {
          background: #111217;
          color: #f5f5f5;
        }

        .page-decor {
          position: fixed;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
          z-index: 0;
        }

        .orb {
          position: absolute;
          border-radius: 50%;
          opacity: 0.18;
          transition: opacity 0.65s ease;
        }

        .orb-one {
          width: 560px;
          height: 560px;
          left: -160px;
          top: -160px;
          background: #8e4214;
        }

        .orb-two {
          width: 420px;
          height: 420px;
          right: -120px;
          bottom: -120px;
          background: #3e1e05;
        }

        .dark-mode .orb {
          opacity: 0.08;
        }

        .auth-shell {
          position: relative;
          z-index: 2;
          width: min(1060px, 100%);
          display: grid;
          grid-template-columns: 1fr 1.08fr;
          background: #fdf8eb;
          border-radius: 22px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.15);
          box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45);
          animation:
            enter 0.8s cubic-bezier(0.22, 1, 0.36, 1) both;
          transition:
            background 0.65s ease,
            box-shadow 0.65s ease,
            border-color 0.65s ease;
        }

        .dark-mode .auth-shell {
          background: #202126;
          box-shadow: 0 24px 90px rgba(0, 0, 0, 0.7);
          border-color: rgba(255, 255, 255, 0.06);
        }

        @keyframes enter {
          from {
            opacity: 0;
            transform: translateY(18px) scale(0.99);
          }

          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        /* =========================
           TOAST
        ========================== */

        .success-toast {
          position: fixed;
          top: 24px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 9999;
          width: min(430px, calc(100vw - 32px));
          min-height: 76px;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px 18px;
          background: #fdf8eb;
          border: 1px solid rgba(122, 47, 0, 0.14);
          border-radius: 14px;
          box-shadow:
            0 18px 50px rgba(42, 26, 14, 0.22);
          animation:
            toast-in 0.45s cubic-bezier(0.22, 1, 0.36, 1)
            forwards;
        }

        .success-toast-icon {
          width: 40px;
          height: 40px;
          flex: 0 0 40px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: #35b889;
          color: white;
          font-size: 21px;
          font-weight: 700;
        }

        .error-toast .success-toast-icon {
          background: #c94b3c;
          font-size: 26px;
          line-height: 1;
        }

        .success-toast-content {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .success-toast-content strong {
          color: #2a1a0e;
          font-size: 14px;
          font-weight: 700;
        }

        .success-toast-content span {
          color: #8a7059;
          font-size: 12.5px;
          line-height: 1.4;
        }

        .dark-mode .success-toast {
          background: #292a2f;
          border-color: #44454c;
          box-shadow:
            0 18px 50px rgba(0, 0, 0, 0.5);
        }

        .dark-mode .success-toast-content strong {
          color: #f3f3f4;
        }

        .dark-mode .success-toast-content span {
          color: #aaaab0;
        }

        @keyframes toast-in {
          from {
            opacity: 0;
            transform: translate(-50%, -35px);
          }

          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }

        .brand-side {
          background: #7a2f00;
          color: #fff7e8;
          padding: 40px 36px;
          display: flex;
          flex-direction: column;
          position: relative;
          overflow: hidden;
          transition:
            background 0.65s ease,
            color 0.65s ease;
        }

        .dark-mode .brand-side {
          background: #32170a;
        }

        .brand-top {
          display: flex;
          justify-content: space-between;
          gap: 15px;
          font-size: 10px;
          letter-spacing: 0.14em;
          opacity: 0.65;
        }

        .brand-logo {
          display: flex;
          align-items: center;
          margin: 34px 0 24px;
        }

        .desktop-logo {
          width: 400px;
          height: 200px;
          object-fit: contain;
          display: block;
        }

        .brand-copy {
          max-width: 420px;
        }

        .brand-copy h2 {
          margin: 0 0 12px;
          font-family:
            Georgia, "Times New Roman", serif;
          font-size: 30px;
          line-height: 1.15;
          font-weight: 600;
          letter-spacing: -0.7px;
        }

        .brand-copy p {
          margin: 0;
          max-width: 390px;
          font-size: 14.5px;
          line-height: 1.6;
          opacity: 0.82;
        }

        .features {
          margin-top: 28px;
          display: grid;
          gap: 13px;
          font-size: 13.5px;
        }

        .feature {
          display: flex;
          align-items: center;
          gap: 10px;
          opacity: 0.92;
        }

        .feature-dot {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.14);
          display: grid;
          place-items: center;
          flex: none;
          font-size: 11px;
        }

        .brand-footer {
          margin-top: auto;
          padding-top: 32px;
          font-size: 12px;
          opacity: 0.6;
        }

        .form-side {
          padding: 36px 38px 30px;
          position: relative;
          background: #fdf8eb;
          transition:
            background 0.65s ease,
            color 0.65s ease;
        }

        .dark-mode .form-side {
          background: #202126;
        }

        .mobile-brand {
          display: none;
        }

        .tabs {
          display: inline-flex;
          background: #f9eedb;
          border: 1px solid #e7d6b8;
          border-radius: 999px;
          padding: 4px;
          gap: 4px;
          transition:
            background 0.5s ease,
            border-color 0.5s ease;
        }

        .dark-mode .tabs {
          background: #2b2c31;
          border-color: #414249;
        }

        .tabs button {
          border: 0;
          background: transparent;
          padding: 9px 18px;
          border-radius: 999px;
          font-weight: 600;
          font-size: 13.5px;
          color: #8a7059;
          cursor: pointer;
          transition:
            background 0.25s ease,
            color 0.25s ease,
            transform 0.2s ease;
        }

        .dark-mode .tabs button {
          color: #aaaab0;
        }

        .tabs button.active {
          background: #7a2f00;
          color: white;
        }

        .tabs button:active {
          transform: scale(0.97);
        }

        .heading {
          margin-top: 20px;
          margin-bottom: 20px;
        }

        .heading h1 {
          margin: 0 0 7px;
          min-height: 72px;
          font-family:
            Georgia, "Times New Roman", serif;
          font-size: 30px;
          line-height: 1.2;
          letter-spacing: -0.7px;
          font-weight: 600;
          color: #2a1a0e;
          transition: color 0.55s ease;
        }

        .dark-mode .heading h1 {
          color: #f4f4f5;
        }

        .caret {
          display: inline-block;
          width: 2px;
          height: 1.05em;
          margin-left: 3px;
          background: #7a2f00;
          vertical-align: -0.15em;
          animation: blink 1.05s steps(1) infinite;
        }

        @keyframes blink {
          0%,
          55% {
            opacity: 1;
          }

          56%,
          100% {
            opacity: 0;
          }
        }

        .heading p {
          margin: 0;
          color: #8a7059;
          font-size: 14px;
          line-height: 1.5;
          transition: color 0.55s ease;
        }

        .dark-mode .heading p {
          color: #a9a9af;
        }

        .form-area {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .field label {
          font-size: 12.5px;
          font-weight: 600;
          color: #2a1a0e;
          transition: color 0.55s ease;
        }

        .dark-mode .field label {
          color: #eeeeef;
        }

        .input-wrap {
          position: relative;
        }

        .input-wrap input {
          width: 100%;
          height: 48px;
          padding: 0 44px;
          border-radius: 12px;
          border: 1.5px solid #e7d6b8;
          background: white;
          color: #2a1a0e;
          font-size: 14px;
          outline: none;
          transition:
            border-color 0.25s ease,
            box-shadow 0.25s ease,
            background 0.55s ease,
            color 0.55s ease;
        }

        .dark-mode .input-wrap input {
          background: #292a2f;
          border-color: #44454c;
          color: #f3f3f4;
        }

        .input-wrap input:focus {
          border-color: #7a2f00;
          box-shadow:
            0 0 0 4px rgba(122, 47, 0, 0.12);
        }

        .input-wrap input::placeholder {
          color: #b39d84;
          transition: color 0.55s ease;
        }

        .dark-mode .input-wrap input::placeholder {
          color: #777980;
        }

        .input-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          width: 18px;
          text-align: center;
          color: #8a7059;
          opacity: 0.7;
          z-index: 1;
          font-size: 14px;
          transition: color 0.55s ease;
        }

        .dark-mode .input-icon {
          color: #aaaab0;
        }

        .show-button {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          border: 0;
          background: transparent;
          color: #7a2f00;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          padding: 6px;
          transition:
            color 0.3s ease,
            transform 0.2s ease;
        }

        .show-button:hover {
          transform: translateY(-50%) scale(1.04);
        }

        .dark-mode .show-button {
          color: #d98b55;
        }

        .strength {
          overflow: hidden;
          animation: strength-in 0.4s ease both;
        }

        @keyframes strength-in {
          from {
            opacity: 0;
            max-height: 0;
            transform: translateY(-5px);
          }

          to {
            opacity: 1;
            max-height: 80px;
            transform: translateY(0);
          }
        }

        .strength-bars {
          display: flex;
          gap: 6px;
          margin-top: 2px;
        }

        .strength-bars span {
          flex: 1;
          height: 5px;
          border-radius: 99px;
          background: #e9dcc2;
          transition: background 0.3s ease;
        }

        .strength-bars span.filled {
          background: #7a2f00;
        }

        .strength-info {
          display: flex;
          justify-content: space-between;
          margin-top: 6px;
          color: #8a7059;
          font-size: 11px;
        }

        .strength-info strong {
          color: #7a2f00;
        }

        .password-match {
          margin: 0;
          font-size: 11px;
        }

        .password-match.success {
          color: #5a7a3a;
        }

        .password-match.error {
          color: #a84a35;
        }

        .forgot-button {
          align-self: flex-end;
          margin-top: -3px;
          border: 0;
          background: transparent;
          color: #7a2f00;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          padding: 0;
          transition: color 0.3s ease;
        }

        .forgot-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .dark-mode .forgot-button {
          color: #d98b55;
        }

        .primary-button {
          width: 100%;
          height: 50px;
          margin-top: 2px;
          border: 0;
          border-radius: 12px;
          background: #7a2f00;
          color: white;
          font-size: 14.5px;
          font-weight: 700;
          cursor: pointer;
          transition:
            transform 0.2s ease,
            background 0.25s ease,
            box-shadow 0.25s ease;
        }

        .primary-button:hover:not(:disabled) {
          background: #642600;
          transform: translateY(-1px);
          box-shadow:
            0 8px 20px rgba(92, 34, 3, 0.25);
        }

        .primary-button:active:not(:disabled) {
          transform: translateY(0) scale(0.99);
        }

        .primary-button:disabled,
        .google-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .divider {
          display: flex;
          align-items: center;
          gap: 12px;
          color: #8a7059;
          font-size: 12px;
          margin: 2px 0;
          transition: color 0.55s ease;
        }

        .dark-mode .divider {
          color: #888991;
        }

        .divider::before,
        .divider::after {
          content: "";
          height: 1px;
          background: #e7d6b8;
          flex: 1;
          transition: background 0.55s ease;
        }

        .dark-mode .divider::before,
        .dark-mode .divider::after {
          background: #414249;
        }

        .google-button {
          width: 100%;
          height: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          border: 1.5px solid #e7d6b8;
          border-radius: 12px;
          background: white;
          color: #2a1a0e;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition:
            border-color 0.25s ease,
            background 0.55s ease,
            color 0.55s ease,
            transform 0.2s ease;
        }

        .dark-mode .google-button {
          background: #292a2f;
          border-color: #44454c;
          color: #f1f1f2;
        }

        .google-button:hover:not(:disabled) {
          border-color: #8e4214;
          background: #fffefa;
          transform: translateY(-1px);
        }

        .dark-mode .google-button:hover:not(:disabled) {
          background: #323339;
        }

        .google-icon {
          width: 19px;
          height: 19px;
          object-fit: contain;
          display: block;
          flex: 0 0 19px;
        }

        .bottom-text {
          margin: 20px 0 0;
          text-align: center;
          color: #8a7059;
          font-size: 12.5px;
          transition: color 0.55s ease;
        }

        .dark-mode .bottom-text {
          color: #a9a9af;
        }

        .bottom-text button {
          border: 0;
          padding: 0;
          background: transparent;
          color: #7a2f00;
          font-weight: 700;
          cursor: pointer;
          transition: color 0.3s ease;
        }

        .dark-mode .bottom-text button {
          color: #d98b55;
        }

        /* =========================
           UIVERSE DARK MODE SWITCH
        ========================== */

        .theme-switch {
          --toggle-size: 16px;
          --overflow: visible;
          --container-width: 5.625em;
          --container-height: 2.5em;
          --container-radius: 6.25em;
          --container-light-bg: #3d7eae;
          --container-night-bg: #1d1f2c;
          --circle-container-diameter: 3.375em;
          --sun-moon-diameter: 2.125em;
          --sun-bg: #ecca2f;
          --moon-bg: #c4c9d1;
          --spot-color: #959db1;
          --circle-container-offset: calc(
            (
                (
                  var(--circle-container-diameter) -
                  var(--container-height)
                ) / 2
              ) * -1
          );
          --stars-color: #fff;
          --clouds-color: #f3fdff;
          --back-clouds-color: #aacadf;
          --transition:
            0.5s cubic-bezier(0, -0.02, 0.4, 1.25);
          --circle-transition:
            0.3s cubic-bezier(0, -0.02, 0.35, 1.17);

          position: fixed;
          top: 18px;
          right: 20px;
          z-index: 100;
          cursor: pointer;
          display: block;
        }

        .theme-switch,
        .theme-switch *,
        .theme-switch *::before,
        .theme-switch *::after {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
          font-size: var(--toggle-size);
        }

        .theme-switch__container {
          width: var(--container-width);
          height: var(--container-height);
          background-color: var(--container-light-bg);
          border-radius: var(--container-radius);
          overflow: hidden;
          cursor: pointer;
          box-shadow:
            0em -0.062em 0.062em rgba(0, 0, 0, 0.25),
            0em 0.062em 0.125em
              rgba(255, 255, 255, 0.94);
          transition: var(--transition);
          position: relative;
        }

        .theme-switch__container::before {
          content: "";
          position: absolute;
          z-index: 1;
          inset: 0;
          box-shadow:
            0em 0.05em 0.187em
              rgba(0, 0, 0, 0.25) inset,
            0em 0.05em 0.187em
              rgba(0, 0, 0, 0.25) inset;
          border-radius: var(--container-radius);
        }

        .theme-switch__checkbox {
          position: absolute;
          width: 1px;
          height: 1px;
          opacity: 0;
          pointer-events: none;
        }

        .theme-switch__circle-container {
          width: var(--circle-container-diameter);
          height: var(--circle-container-diameter);
          top: var(--circle-container-offset);
          left: var(--circle-container-offset);
          display: flex;
          align-items: center;
          justify-content: center;
          position: absolute;
          transition: var(--circle-transition);
          z-index: 3;
        }

        .theme-switch__sun-moon-container {
          pointer-events: auto;
          position: relative;
          z-index: 2;
          width: var(--sun-moon-diameter);
          height: var(--sun-moon-diameter);
          margin: auto;
          border-radius: var(--container-radius);
          background-color: var(--sun-bg);
          box-shadow:
            0.062em 0.062em 0.062em 0em
              rgba(254, 255, 239, 0.61) inset,
            0em -0.062em 0.062em 0em #a1872a inset;
          filter:
            drop-shadow(
              0.062em 0.125em 0.125em
                rgba(0, 0, 0, 0.25)
            )
            drop-shadow(
              0em 0.062em 0.125em
                rgba(0, 0, 0, 0.25)
            );
          overflow: hidden;
          transition: var(--transition);
        }

        .theme-switch__moon {
          transform: translateX(100%);
          width: 100%;
          height: 100%;
          background-color: var(--moon-bg);
          border-radius: inherit;
          box-shadow:
            0.062em 0.062em 0.062em 0em
              rgba(254, 255, 239, 0.61) inset,
            0em -0.062em 0.062em 0em #969696 inset;
          transition: var(--transition);
          position: relative;
        }

        .theme-switch__spot {
          position: absolute;
          top: 0.75em;
          left: 0.312em;
          width: 0.75em;
          height: 0.75em;
          border-radius: var(--container-radius);
          background-color: var(--spot-color);
          box-shadow:
            0em 0.0312em 0.062em
              rgba(0, 0, 0, 0.25) inset;
        }

        .theme-switch__spot:nth-of-type(2) {
          width: 0.375em;
          height: 0.375em;
          top: 0.937em;
          left: 1.375em;
        }

        .theme-switch__spot:nth-last-of-type(3) {
          width: 0.25em;
          height: 0.25em;
          top: 0.312em;
          left: 0.812em;
        }

        .theme-switch__clouds {
          width: 1.25em;
          height: 1.25em;
          background-color: var(--clouds-color);
          border-radius: var(--container-radius);
          position: absolute;
          bottom: -0.625em;
          left: 0.312em;
          box-shadow:
            0.937em 0.312em var(--clouds-color),
            -0.312em -0.312em var(--back-clouds-color),
            1.437em 0.375em var(--clouds-color),
            0.5em -0.125em var(--back-clouds-color),
            2.187em 0 var(--clouds-color),
            1.25em -0.062em var(--back-clouds-color),
            2.937em 0.312em var(--clouds-color),
            2em -0.312em var(--back-clouds-color),
            3.625em -0.062em var(--clouds-color),
            2.625em 0em var(--back-clouds-color),
            4.5em -0.312em var(--clouds-color),
            3.375em -0.437em var(--back-clouds-color),
            4.625em -1.75em 0 0.437em
              var(--clouds-color),
            4em -0.625em var(--back-clouds-color),
            4.125em -2.125em 0 0.437em
              var(--back-clouds-color);
        }

        .theme-switch__stars-container {
          position: absolute;
          color: var(--stars-color);
          top: -100%;
          left: 0.312em;
          width: 2.75em;
          height: auto;
          transition: var(--transition);
        }

        .theme-switch__stars-container svg {
          width: 100%;
          height: auto;
          display: block;
        }

        .theme-switch__checkbox:checked
          + .theme-switch__container {
          background-color: var(--container-night-bg);
        }

        .theme-switch__checkbox:checked
          + .theme-switch__container
          .theme-switch__circle-container {
          left: calc(
            100% - var(--circle-container-offset) -
            var(--circle-container-diameter)
          );
        }

        .theme-switch__checkbox:checked
          + .theme-switch__container
          .theme-switch__circle-container:hover {
          left: calc(
            100% - var(--circle-container-offset) -
            var(--circle-container-diameter) -
            0.187em
          );
        }

        .theme-switch__circle-container:hover {
          left: calc(
            var(--circle-container-offset) + 0.187em
          );
        }

        .theme-switch__checkbox:checked
          + .theme-switch__container
          .theme-switch__moon {
          transform: translate(0);
        }

        .theme-switch__checkbox:checked
          + .theme-switch__container
          .theme-switch__clouds {
          bottom: -4.062em;
        }

        .theme-switch__checkbox:checked
          + .theme-switch__container
          .theme-switch__stars-container {
          top: 50%;
          transform: translateY(-50%);
        }

        @media (max-width: 900px) {
          .auth-page {
            padding: 16px;
            overflow-y: auto;
            align-items: center;
          }

          .auth-shell {
            grid-template-columns: 1fr;
            max-width: 520px;
          }

          .brand-side {
            display: none;
          }

          .form-side {
            padding: 28px 22px 26px;
          }

          .mobile-brand {
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 24px;
            height: 110px;
          }

          .mobile-only-logo {
            width: 110px;
            height: 110px;
            object-fit: contain;
            display: block;
          }

          .heading h1 {
            font-size: 26px;
            min-height: 62px;
          }

          .theme-switch {
            top: 14px;
            right: 14px;
            --toggle-size: 16px;
          }

          .success-toast {
            top: 16px;
          }
        }

        @media (max-width: 520px) {
          .auth-page {
            padding: 12px;
          }

          .auth-shell {
            border-radius: 18px;
          }

          .form-side {
            padding: 22px 18px 24px;
          }

          .mobile-brand {
            margin-bottom: 22px;
            height: 100px;
          }

          .mobile-only-logo {
            width: 100px;
            height: 100px;
          }

          .tabs button {
            padding: 8px 15px;
          }

          .theme-switch {
            top: 12px;
            right: 12px;
            --toggle-size: 15px;
          }

          .success-toast {
            width: calc(100vw - 24px);
            top: 12px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          *,
          *::before,
          *::after {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>
    </main>
  );
}