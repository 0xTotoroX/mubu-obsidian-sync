/** True when Mubu's response indicates that the saved login session is no longer valid. */
export function isAuthenticationMessage(message: string): boolean {
  return /token|jwt|登录|认证|未授权|expired|expire|session|login\s+(?:expired|inspired|invalid)/i.test(message);
}
