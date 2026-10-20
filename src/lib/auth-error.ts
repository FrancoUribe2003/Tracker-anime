import type { Dictionary } from "../i18n";

type AuthError = { code?: string; error?: { code?: string } } | null;

export function authErrorMessage(
  error: unknown,
  dict: Dictionary["auth"],
  fallback: string
): string {
  const value = error as AuthError;
  const code = value?.code ?? value?.error?.code;

  switch (code) {
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return dict.emailAlreadyExists;
    case "PASSWORD_TOO_SHORT":
      return dict.passwordTooShort;
    case "PASSWORD_TOO_LONG":
      return dict.passwordTooLong;
    case "INVALID_EMAIL":
      return dict.emailInvalid;
    case "INVALID_EMAIL_OR_PASSWORD":
      return dict.invalidCredentials;
    default:
      return fallback;
  }
}
