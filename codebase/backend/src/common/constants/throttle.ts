/**
 * 전역 100 req/min(`ThrottlerModule` `default` tier)보다 타이트한 **남용·비용
 * 민감 인증 라우트 공통 tier** — 분당 10회 (`{ ttl: 60_000ms, limit: 10 }`).
 *
 * 값이 우연히 같은 게 아니라 "전역보다 엄격한 민감 tier" 라는 **공통 정책 의도**를
 * 단일 출처로 둔다 (§api-convention §7 의 tier 모델과 정합). 현재 공유 소비처:
 * - 워크스페이스 초대 발송/재발송 — email-bombing 방지 (`workspaces.controller`,
 *   `INVITATION_THROTTLE` 별칭).
 * - provider probe (`preview-models`·`:id/test`·`:id/models`) — 실시간 과금 provider
 *   호출 비용·속도제한 보호 (`llm-model-config.controller`, `PROVIDER_PROBE_THROTTLE` 별칭).
 * - 2FA 해제 (`POST /auth/2fa/disable`) — 6자리 인증 코드 추측 방지 (`auth.controller`).
 * - 2FA 설정 시작 (`POST /auth/2fa/setup`) — 계정 비밀번호 재확인(bcrypt 비교)에 대한
 *   비밀번호 추측 방지 (`auth.controller`).
 * - 2FA 활성화 검증 (`POST /auth/2fa/verify`) — 대기 secret 의 6자리 코드 추측 방지 (`auth.controller`).
 * - Passkey 등록 옵션 · 복구 코드 재발급 (`POST /auth/2fa/webauthn/register/options`,
 *   `.../recovery-codes/regenerate`) — 계정 비밀번호 추측 방지 (`webauthn.controller`).
 *
 * 계정 비밀번호를 다시 확인하는(`AuthService.verifyPasswordForUser`) 라우트는 모두 이 상수를 건다.
 * `modules/auth/password-recheck-throttle.spec.ts` 가 그 목록을 고정한다(NERV CLE-API-CONV §7, CLE-T-FRCRF7).
 *
 * 정책 SoT: `spec/5-system/2-api-convention.md §7 Rate Limiting`. 특정 라우트의 정책이
 * 갈리면 이 상수를 공유하지 말고 라우트별 자체 `@Throttle` 로 분리한다.
 */
export const SENSITIVE_ACTION_THROTTLE = {
  default: { ttl: 60_000, limit: 10 },
} as const;
