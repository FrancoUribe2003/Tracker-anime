import React, { useState } from "react";
import { z } from "zod";
import { authClient } from "../lib/auth-client";

const registerSchema = z
  .object({
    name: z
      .string()
      .min(2, "El nombre debe tener al menos 2 caracteres"),
    email: z
      .string()
      .min(1, "El correo electrónico es obligatorio")
      .email("Ingresa un correo electrónico válido"),
    password: z
      .string()
      .min(8, "La contraseña debe tener al menos 8 caracteres"),
    confirmPassword: z
      .string()
      .min(1, "Debes confirmar tu contraseña"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterForm() {
  const [formData, setFormData] = useState<RegisterFormData>({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof RegisterFormData, string>>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name as keyof RegisterFormData]) {
      setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
    }
    if (generalError) setGeneralError(null);
  };

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setGeneralError(null);

    const validation = registerSchema.safeParse(formData);
    if (!validation.success) {
      const errors: Partial<Record<keyof RegisterFormData, string>> = {};
      validation.error.issues.forEach((err) => {
        if (err.path[0]) {
          errors[err.path[0] as keyof RegisterFormData] = err.message;
        }
      });
      setFieldErrors(errors);
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await authClient.signUp.email({
        name: formData.name,
        email: formData.email,
        password: formData.password,
      });

      if (error) {
        setGeneralError(
          error.message || "Error al crear la cuenta. Es posible que el correo ya esté registrado."
        );
        setIsLoading(false);
        return;
      }

      window.location.href = "/";
    } catch {
      setGeneralError("Ocurrió un error inesperado al conectar con el servidor.");
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full">
      {generalError && (
        <div className="auth-alert" role="alert">
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{generalError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="auth-form" noValidate>
        <div>
          <input
            name="name"
            type="text"
            autoComplete="name"
            aria-label="Nombre de usuario"
            value={formData.name}
            onChange={handleChange}
            placeholder="Nombre de usuario"
            disabled={isLoading}
            className={`auth-input ${fieldErrors.name ? "has-error" : ""}`}
          />
          {fieldErrors.name && (
            <p className="auth-field-error">{fieldErrors.name}</p>
          )}
        </div>

        <div>
          <input
            name="email"
            type="email"
            autoComplete="email"
            aria-label="Correo electrónico"
            value={formData.email}
            onChange={handleChange}
            placeholder="Correo electrónico"
            disabled={isLoading}
            className={`auth-input ${fieldErrors.email ? "has-error" : ""}`}
          />
          {fieldErrors.email && (
            <p className="auth-field-error">{fieldErrors.email}</p>
          )}
        </div>

        <div>
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            aria-label="Contraseña (mínimo 8 caracteres)"
            value={formData.password}
            onChange={handleChange}
            placeholder="Contraseña"
            disabled={isLoading}
            className={`auth-input ${fieldErrors.password ? "has-error" : ""}`}
          />
          {fieldErrors.password && (
            <p className="auth-field-error">{fieldErrors.password}</p>
          )}
        </div>

        <div>
          <input
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            aria-label="Confirmar contraseña"
            value={formData.confirmPassword}
            onChange={handleChange}
            placeholder="Confirmar contraseña"
            disabled={isLoading}
            className={`auth-input ${fieldErrors.confirmPassword ? "has-error" : ""}`}
          />
          {fieldErrors.confirmPassword && (
            <p className="auth-field-error">{fieldErrors.confirmPassword}</p>
          )}
        </div>

        <button type="submit" disabled={isLoading} className="auth-btn">
          {isLoading ? (
            <>
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Creando...</span>
            </>
          ) : (
            <span>Registrarse</span>
          )}
        </button>
      </form>
    </div>
  );
}
