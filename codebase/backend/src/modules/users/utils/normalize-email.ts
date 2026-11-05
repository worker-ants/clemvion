/**
 * 새로 저장하는 이메일 값을 정규화한다. 앞뒤 공백을 지우고 소문자로 바꾼다.
 *
 * 일반 가입 · 초대 가입 · OAuth 새 계정 · 이메일 변경이 저장 직전에 쓴다. 이미 저장된 행은
 * 바꾸지 않는다. 조회 쪽 규칙은 `UsersService.lookupByEmail` 이 맡는다
 * (CLE-ACCT-DATA 「User」 이메일 규칙, CLE-T-SFWX84).
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
