# 신규 식별자 충돌 검토 — `spec/5-system/` (impl-prep)

## 범위·방법

target: `spec/5-system/1-auth.md` · `2-api-convention.md` · `3-error-handling.md` (구현 착수 전 검토, `--impl-prep`).
컨텍스트 번들에 함께 포함된 `spec/0-overview.md` · `spec/conventions/audit-actions.md` · `plan/in-progress/*` 는 대조군으로만 사용.

3개 target 문서에서 도입되는 식별자(에러 코드·env var·API endpoint·감사 액션·엔티티명·LoginHistory 이벤트명)를 추출한 뒤, 실제 워크트리(`spec/**`, `codebase/backend/.env.example`)를 직접 grep 하여 다른 의미로 이미 쓰이고 있는지 대조했다. 주요 확인 항목:

- 에러 코드: `WEBAUTHN_INVALID`·`CHALLENGE_INVALID`·`RECOVERY_CODE_INVALID`·`REAUTH_NOT_AVAILABLE`·`REAUTH_REQUIRED`·`PASSWORD_INVALID`·`INVALID_PASSWORD`·`PASSWORD_REQUIRED`·`NOT_A_MEMBER`·`TOTP_INVALID`·`WEBAUTHN_DISABLED`·`WEBAUTHN_VERIFY_FAILED`·`INVALID_OPTIONS_TOKEN`·`CANNOT_REMOVE_OWNER`·`ALREADY_A_MEMBER`
- 환경변수: `WEBAUTHN_RP_ID`·`WEBAUTHN_RP_NAME`·`WEBAUTHN_ORIGIN`·`WEBAUTHN_ALLOW_FALLBACK`·`TRUST_CF_CONNECTING_IP`·`COOKIE_SAMESITE`
- 엔티티/이벤트: `LoginHistory` 및 그 event enum(`login_success`/`login_failed`/`totp_failed`/`webauthn_failed`/`logout`/`session_revoked`/`token_reuse_detected`), 감사 액션 `user.email_changed`
- API endpoint: `1-auth.md §5` 전체 표, `2-api-convention.md` 의 RPC-style sub-channel 예시

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO]** 근접 명명 쌍은 target 문서 자체가 이미 명시적으로 구분·주석 처리하고 있음
  - target 신규 식별자: 없음 (신규 도입 아님) — `PASSWORD_INVALID`(재인증/재확인, 401) vs `INVALID_PASSWORD`(비밀번호 변경, 401) vs `PASSWORD_REQUIRED`(재확인 미입력, 401) vs `REAUTH_REQUIRED`(재인증 미충족, 400); 초대 흐름의 lowercase `already_a_member`/`forbidden`/`rate_limited` vs 워크스페이스 직접-추가 흐름의 UPPER_SNAKE `ALREADY_A_MEMBER`/`FORBIDDEN`/`RATE_LIMITED`
  - 기존 사용처: `spec/5-system/3-error-handling.md §1.2.1`·§1.9 Rationale, `spec/5-system/1-auth.md §1.5.4`("historical-artifact 예외" 등재)
  - 상세: 이런 이름들은 문자열이 유사해 도입 당시 충돌 후보였겠지만, 이미 각 절이 "근접 명명 주의" 각주로 서로를 상호 참조하며 의미·HTTP status·발행 헬퍼를 구분해 놓았다(`error-codes.md §3` historical-artifact 레지스트리 포함). 새로 발견된 미문서화 충돌이 아니라, 과거 리뷰 라운드(`review/consistency/2026/07/28/17_21_27`, PR #882/#887/#893/#895)에서 이미 정리된 상태다.
  - 제안: 조치 불필요. 향후 `trigger.rotate*`(plan `spec-sync-auth-gaps.md` 잔여 항목) 등 신규 감사 액션·에러 코드를 도입할 때도 같은 "근접 명명 주의" 각주 패턴을 유지할 것을 권고(이미 관행화됨).

## 상세 대조 결과 (충돌 없음 확인)

- **환경변수** — `WEBAUTHN_RP_ID`/`WEBAUTHN_RP_NAME`/`WEBAUTHN_ORIGIN`/`WEBAUTHN_ALLOW_FALLBACK`/`TRUST_CF_CONNECTING_IP`/`COOKIE_SAMESITE` 는 `codebase/backend/.env.example` 의 정의와 값·의미가 정확히 일치하며, `spec/` 전체에서 다른 의미로 재사용된 사례 없음.
- **에러 코드** — 위 후보 코드들은 `spec/5-system/3-error-handling.md`(SoT 등재) 와 `spec/1-data-model.md`·`spec/2-navigation/9-user-profile.md`·`spec/data-flow/2-auth.md`·`spec/data-flow/12-workspace.md`(참조/인용) 에서만 등장하며 모두 동일한 의미·HTTP status 로 일관됨. 다른 도메인이 같은 이름을 다른 의미로 쓰는 사례 없음.
- **엔티티/이벤트명** — `LoginHistory` 는 `spec/1-data-model.md §2.18.2` 가 유일한 정의이며 target 은 그 정의를 참조만 한다. LoginHistory event enum(`login_success` 등)과 감사 액션(`user.email_changed` 등)·WS 이벤트(`execution.*`/`node.*`)·SSE 이벤트 네임스페이스가 서로 겹치지 않음(스키마·구분자 체계 자체가 다름 — lower_snake DB enum vs dot-namespaced pub/sub).
- **감사 액션 카탈로그** — `1-auth.md §4.1` 의 구현/Planned 액션 목록은 `spec/conventions/audit-actions.md §3` 레지스트리와 1:1 대응하며 두 문서 간 불일치 없음(SoT 책임 분리 명시: 카탈로그=1-auth, 명명규약=audit-actions).
- **API endpoint** — `1-auth.md §5` 표의 모든 endpoint(method+path)는 문서 내부에서만 정의되고, 다른 도메인 spec 이 동일 path 를 다른 의미로 재정의하는 사례 없음. 인접 도메인 endpoint(`/api/users/me/*`, `/api/workspaces/:id/invitations`)는 명시적으로 `9-user-profile.md` 로 위임되어 중복 정의를 피함.
- **파일 경로** — target 3개 파일은 기존 `spec/5-system/N-*.md` 넘버링 컨벤션을 그대로 따르는 기존 파일(신규 파일 아님). 경로 충돌 없음.

## 요약

`spec/5-system/1-auth.md`·`2-api-convention.md`·`3-error-handling.md` 는 여러 차례의 선행 consistency-check 라운드(2026-07-28, #882, #887, #893, #895, #1092)를 거치며 에러 코드·env var·감사 액션·API endpoint 수준의 근접 명명 충돌을 이미 상세히 정리·문서화한 상태다. 이번 --impl-prep 검토에서 실제 워크트리(spec 전체 + `.env.example`)를 대조한 결과 새로 발견된 CRITICAL/WARNING 급 신규 식별자 충돌은 없다. 유일하게 언급할 만한 것은 이미 문서 자신이 각주로 구분해 둔 근접 명명 쌍들이며, 이는 조치가 아니라 확인 사항이다.

## 위험도

NONE
