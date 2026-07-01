import type { AuthUser } from './authApi';

export class ApiError extends Error {
  code: string;
  user?: AuthUser;

  constructor(code: string, message: string, user?: AuthUser) {
    super(message);
    this.code = code;
    this.user = user;
  }
}

const TOKEN_KEY = 'chai-khata-token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}
