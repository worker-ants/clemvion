# 신규 식별자 충돌 검토 (naming_collision)

검토 모드: `--impl-done` / scope=`spec/5-system` (1-auth.md, 10-graph-rag.md, 11-mcp-client.md)
diff-base: origin/main

---

## 발견사항

### [WARNING] `audit-action.const.ts` 주석의 old 명칭이 target spec 신규 명칭과 불일치

- **target 신규 식별자**: `user.password_changed`, `user.2fa_enabled`, `user.2fa_disabled`
  (`spec/5-system/1-auth.md` §4.1 Planned 감사 액션 + §Rationale 4.1.A)
- **기존 사용처**:
  `/Volumes/project/private/clemvion/codebase/backend/src/modules/audit-logs/audit-action.const.ts` 15번째 줄 주석
  `"llm_config.* · rerank_config.* · password_change · 2fa_*)은 미구현이라 본 const 에 없다"`
  — 여기서 `password_change`, `2fa_*` 는 target spec 이 이번에 폐기·정정하는 구 표기다.
- **상세**: target spec §Rationale 4.1.A 는 구 표기(`password_change`·`2fa_enable/disable`, dot-prefix 없음)를 `user.password_changed`·`user.2fa_enabled`·`user.2fa_disabled` 로 확정한다. 그러나 코드베이스 `audit-action.const.ts` 의 주석은 아직 구 표기를 참조하고 있어, 구현자가 주석을 보고 구 이름으로 액션을 추가할 우려가 있다. 이미 `data-flow/1-audit.md` §1.1(line 69)는 신규 명칭으로 갱신됐으므로 단순 주석 미동기화다.
- **제안**: `audit-action.const.ts` 주석 15번째 줄의 `password_change · 2fa_*` 를 `user.password_changed · user.2fa_enabled · user.2fa_disabled` 로 갱신한다.

---

### [INFO] `TRUST_CF_CONNECTING_IP` 환경변수 — spec 에만 존재, 코드/env.example 미동기화

- **target 신규 식별자**: `TRUST_CF_CONNECTING_IP`
  (target spec §2.3 `클라이언트 IP` 항목, §Rationale 2.3.B — m-3 항목)
- **기존 사용처**: 코드베이스 어디에도 `TRUST_CF_CONNECTING_IP` 가 없다.
  `/Volumes/project/private/clemvion/codebase/backend/src/modules/auth/utils/client-ip.ts` 는 `CF-Connecting-IP` 헤더를 조건 없이 1순위로 신뢰한다.
  `.env.example` 에도 해당 변수가 없다.
- **상세**: target spec 이 새로 도입하는 이 ENV var 는 `client-ip.ts` 의 기존 동작(무조건 CF-Connecting-IP 우선)과 의미 충돌이다. 현재 코드는 `TRUST_CF_CONNECTING_IP=false` 일 때의 동작(= 우선순위 제외)을 구현하지 않는다. spec 에 선언만 하고 구현이 누락되면 spec 과 코드 간 CF-Connecting-IP 신뢰 정책이 실질적으로 다른 상태가 된다.
- **제안**: 식별자 충돌 자체는 아니나(기존 선점 없음), 구현 누락으로 인한 혼선이므로 `client-ip.ts` 및 `.env.example` 동기화가 필요함을 별도 플래닝 항목으로 추적 권장.

---

### [INFO] `COOKIE_SAMESITE` 환경변수 — spec 에만 존재, 코드/env.example 미동기화

- **target 신규 식별자**: `COOKIE_SAMESITE`
  (target spec §2.3 `Refresh 쿠키 SameSite` 항목, §Rationale 2.3.B — M-5 항목)
- **기존 사용처**: 코드베이스 어디에도 `COOKIE_SAMESITE` 가 없다.
  `/Volumes/project/private/clemvion/codebase/backend/src/modules/auth/utils/refresh-cookie.ts` 4번째 줄은 `sameSite: 'none'` 을 하드코딩한다.
  `.env.example` 에도 해당 변수가 없다.
- **상세**: `TRUST_CF_CONNECTING_IP` 와 같은 패턴 — spec 도입 목적은 이해되나, 현재 코드는 `COOKIE_SAMESITE` env 분기를 구현하지 않아 spec 과 실 동작이 괴리된다. 충돌 자체는 없으나 구현 누락 상태다.
- **제안**: `refresh-cookie.ts` 에 `COOKIE_SAMESITE` 처리 로직 추가 및 `.env.example` 문서화가 필요. 별도 impl 플래닝 추적 권장.

---

### [INFO] Refresh 쿠키 Path 정책 — target spec `/api/auth` vs 코드 `'/'`

- **target 신규 식별자**: Refresh 쿠키 `Path = /api/auth` (target spec §2.3 `Refresh 쿠키 Path` 항목 + Rationale 2.3.B)
- **기존 사용처**: `/Volumes/project/private/clemvion/codebase/backend/src/modules/auth/utils/refresh-cookie.ts` 4번째 줄
  `const COOKIE_PATH = '/';`
- **상세**: target spec 이 새로 선언하는 `Path=/api/auth` 는 기존 코드 `COOKIE_PATH='/'` 와 다르다. 식별자 충돌은 없으나 spec vs 구현 간 값 불일치다. `clearRefreshTokenCookie` 도 동일 Path 를 사용해야 하므로 양쪽 함수를 함께 변경해야 한다.
- **제안**: `refresh-cookie.ts` 의 `COOKIE_PATH = '/'` 를 `/api/auth` 로 변경 필요. 별도 구현 추적 확인 권장.

---

### [INFO] `audit-action.const.ts` 주석 — 구 Planned 명칭 `llm_config.*`/`rerank_config.*` 잔존

- **target 신규 식별자**: 해당 없음 (이번 target 은 1-auth.md 주도)
- **기존 사용처**: `/Volumes/project/private/clemvion/codebase/backend/src/modules/audit-logs/audit-action.const.ts` 15번째 줄 주석: `"llm_config.* · rerank_config.*"`
  그러나 `data-flow/1-audit.md` §1.1 (line 69) 에서는 이미 `model_config.*`(구 `llm_config.*`/`rerank_config.*` 통합)로 갱신됐다.
- **상세**: `audit-action.const.ts` 의 주석은 구 명칭을 그대로 보유해 새로운 개발자가 구 명칭으로 액션을 추가할 가능성이 있다. 이미 data-flow 쪽은 `model_config.*` 로 확정됐으므로 주석 미동기화다.
- **제안**: 주석을 `model_config.*` 로 갱신해 단일 진실과 일치시킨다.

---

## 요약

`spec/5-system/1-auth.md` target 이 도입하는 신규 식별자들 — WebAuthn 관련 오류 코드(`WEBAUTHN_DISABLED`, `WEBAUTHN_VERIFY_FAILED`, `INVALID_OPTIONS_TOKEN`, `CHALLENGE_INVALID`, `RECOVERY_CODE_INVALID`, `WEBAUTHN_COUNTER_REGRESSION`), 환경변수(`WEBAUTHN_RP_ID`/`WEBAUTHN_RP_NAME`/`WEBAUTHN_ORIGIN`/`WEBAUTHN_ALLOW_FALLBACK`), JWT kind(`webauthn_register`/`webauthn_auth`/`mfa_challenge`), 복구 코드 필드(`webauthn_recovery_codes`), `assertProductionConfig`, `production-guards.ts`, Planned 감사 액션 등 — 은 기존 spec 및 코드베이스에서 이미 동일한 의미로 사용되고 있으므로 실질적 충돌이 없다. 주요 발견사항은 세 가지 미구현 신규 식별자(`TRUST_CF_CONNECTING_IP`, `COOKIE_SAMESITE`, Refresh 쿠키 Path `/api/auth`)가 코드베이스에 아직 반영되지 않아 spec-vs-impl 괴리를 유발하는 점과, `audit-action.const.ts` 주석이 target spec 이 확정한 신규 감사 액션 명칭(`user.password_changed`, `user.2fa_enabled`, `user.2fa_disabled`) 및 `model_config.*` 통합 명칭과 불일치하는 점이다. CRITICAL 충돌(동일 식별자를 다른 의미로 선점 사용)은 없다.

## 위험도

LOW
