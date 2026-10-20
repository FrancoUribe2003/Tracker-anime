import React, { useState } from "react";
import { z } from "zod";
import { authClient } from "../lib/auth-client";
import { authErrorMessage } from "../lib/auth-error";
import type { Dictionary } from "../i18n";

interface RegisterFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

function registerSchema(dict: Dictionary["auth"]) {
  return z
    .object({
      name: z.string().min(2, dict.nameMin),
      email: z.string().min(1, dict.emailRequired).email(dict.emailInvalid),
      password: z.string().min(8, dict.passwordMin),
      confirmPassword: z.string().min(1, dict.confirmPasswordRequired),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: dict.passwordsDontMatch,
      path: ["confirmPassword"],
    });
}

interface RegisterFormProps {
  dict: Dictionary["auth"];
}

export default function RegisterForm({ dict }: RegisterFormProps) {
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

    const validation = registerSchema(dict).safeParse(formData);
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
        setGeneralError(authErrorMessage(error, dict, dict.registerFailed));
        setIsLoading(false);
        return;
      }

      window.location.href = "/";
    } catch {
      setGeneralError(dict.serverError);
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
            aria-label={dict.name}
            value={formData.name}
            onChange={handleChange}
            placeholder={dict.name}
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
            aria-label={dict.email}
            value={formData.email}
            onChange={handleChange}
            placeholder={dict.email}
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
            aria-label={dict.password}
            value={formData.password}
            onChange={handleChange}
            placeholder={dict.password}
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
            aria-label={dict.confirmPassword}
            value={formData.confirmPassword}
            onChange={handleChange}
            placeholder={dict.confirmPassword}
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
              <span>{dict.registerLoading}</span>
            </>
          ) : (
            <span>{dict.registerSubmit}</span>
          )}
        </button>
      </form>
    </div>
  );
}
