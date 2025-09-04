export interface VerificationData {
  code: string;
  timestamp: number;
}

export interface ResetPasswordPayload {
  email: string;
  code: string;
  newPassword: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface EmailVerificationPayload {
  email: string;
}

export interface VerifyEmailPayload {
  email: string;
  code: string;
}

export interface ApiResponse {
  message?: string;
  error?: string;
  autoLogin?: boolean;
  autoLoginToken?: string;
  email?: string;
}

export interface AutoLoginTokenData {
  email: string;
  timestamp: number;
  used: boolean;
}
