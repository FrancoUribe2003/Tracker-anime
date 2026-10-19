import { useState } from "react";
import LoginForm from "./LoginForm";
import RegisterForm from "./RegisterForm";
import { SITE_NAME } from "../lib/site";

interface AuthCardProps {
  initial?: "login" | "signup";
}

export default function AuthCard({ initial = "login" }: AuthCardProps) {
  const [isRegister, setIsRegister] = useState(initial === "signup");

  return (
    <div className="auth-wrap">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-text">
          {isRegister ? "Crear Cuenta" : "Bienvenido de nuevo"}
        </h1>
        <p className="mt-1.5 text-sm text-text-muted">
          {isRegister ? `Únete a ${SITE_NAME} y organiza tu catálogo` : "Continúa con el seguimiento de tus animes"}
        </p>
      </div>

      <div className="auth-switch">
        <button
          type="button"
          className={`label ${isRegister ? "" : "active"}`}
          onClick={() => setIsRegister(false)}
        >
          Iniciar sesión
        </button>
        <label className="auth-toggle">
          <input
            type="checkbox"
            checked={isRegister}
            onChange={(event) => setIsRegister(event.target.checked)}
            aria-label="Cambiar entre iniciar sesión y crear cuenta"
          />
          <span className="auth-slider" aria-hidden="true" />
        </label>
        <button
          type="button"
          className={`label ${isRegister ? "active" : ""}`}
          onClick={() => setIsRegister(true)}
        >
          Crear cuenta
        </button>
      </div>

      <div className="auth-flip">
        <div className={`auth-flip-inner ${isRegister ? "flipped" : ""}`}>
          <div className="auth-face front" inert={isRegister}>
            <LoginForm />
          </div>
          <div className="auth-face back" inert={!isRegister}>
            <RegisterForm />
          </div>
        </div>
      </div>
    </div>
  );
}
