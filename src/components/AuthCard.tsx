import { useState } from "react";
import LoginForm from "./LoginForm";
import RegisterForm from "./RegisterForm";
import { SITE_NAME } from "../lib/site";
import type { Dictionary } from "../i18n";

interface AuthCardProps {
  initial?: "login" | "signup";
  dict: Dictionary["auth"];
}

export default function AuthCard({ initial = "login", dict }: AuthCardProps) {
  const [isRegister, setIsRegister] = useState(initial === "signup");

  return (
    <div className="auth-wrap">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-text">
          {isRegister ? dict.registerTitle : dict.loginTitle}
        </h1>
        <p className="mt-1.5 text-sm text-text-muted">
          {isRegister
            ? dict.registerSubtitle.replace("{site}", SITE_NAME)
            : dict.loginSubtitle}
        </p>
      </div>

      <div className="auth-switch">
        <button
          type="button"
          className={`label ${isRegister ? "" : "active"}`}
          onClick={() => setIsRegister(false)}
        >
          {dict.tabLogin}
        </button>
        <label className="auth-toggle">
          <input
            type="checkbox"
            checked={isRegister}
            onChange={(event) => setIsRegister(event.target.checked)}
            aria-label={dict.switchLabel}
          />
          <span className="auth-slider" aria-hidden="true" />
        </label>
        <button
          type="button"
          className={`label ${isRegister ? "active" : ""}`}
          onClick={() => setIsRegister(true)}
        >
          {dict.tabRegister}
        </button>
      </div>

      <div className="auth-flip">
        <div className={`auth-flip-inner ${isRegister ? "flipped" : ""}`}>
          <div className="auth-face front" inert={isRegister}>
            <LoginForm dict={dict} />
          </div>
          <div className="auth-face back" inert={!isRegister}>
            <RegisterForm dict={dict} />
          </div>
        </div>
      </div>
    </div>
  );
}
