# Cross-Spec 일관성 검토 결과

검토 범위: `spec/5-system/` (impl-done, diff-base=origin/main)
검토 시각: 2026-06-28

---

## 발견사항

### [INFO] `extractClientIp` vs `extractClientIpFromHeaders` 함수명 불일치 — webhook/hooks 경로 기술

- **target 위치**: `spec/5-system/1-auth.md` §2.3 "클라이언트 IP" 행 (신규 텍스트)
- **충돌 대상**:
  - `spec/1-data-model.md:479` — `Execution.source_ip` 설명: "`hooks.service` 의 `extractClientIp`(CF-Connecting-IP 신뢰 시 → X-Forwarded-For 첫 IP) 결과"
  - `spec/2-navigation/6-config.md:339` — "소스 IP 캡처 경로: `hooks.service` 가 webhook 진입 시 `extractClientIp`(...) 결과를 ..."
  - `spec/5-system/12-webhook.md:358,365` — "`sourceIp`(extractClientIp)·`responseCode`(202) 는 §A.3 호출 이력에 영속"
- **상세**: target(`1-auth.md`) §2.3 변경으로 webhook/rate-limit/ip_whitelist 경로는 `extractClientIpFromHeaders`를 직접 호출하고, `req.ip`/`socket` 폴백을 포함한 4단계 `extractClientIp(req)`는 세션·감사 IP 경로에만 한정된다는 것을 명확히 기술했다. 코드(`hooks.service.ts`)도 이를 반영해 인라인 `extractClientIp` 래퍼를 제거하고 `extractClientIpFromHeaders`를 직접 호출한다. 그러나 `spec/1-data-model.md`, `spec/2-navigation/6-config.md`, `spec/5-system/12-webhook.md`는 여전히 `extractClientIp`라는 이름으로 webhook 경로 IP 추출을 기술하고 있어, 실제 구현 함수명과 어긋난다. 동작 의미("CF-Connecting-IP 신뢰 시 우선, XFF 첫 IP")는 동일하므로 기능 충돌이 아닌 명명 비일관성이다.
- **제안**: `spec/1-data-model.md:479`, `spec/2-navigation/6-config.md:339`, `spec/5-system/12-webhook.md:358,365`의 `extractClientIp` 언급을 `extractClientIpFromHeaders`로 동기화하거나, 함수명 대신 "헤더 기반 IP 추출"로 추상화된 표현으로 통일. `spec/data-flow/1-audit.md:86`의 `extractClientIp` 참조는 감사/세션 경로이므로 정확 — 수정 불필요.

---

### [INFO] `data-flow/1-audit.md` `extractClientIp` 참조 — 감사 경로는 정확, 표기 일관성 주의

- **target 위치**: `spec/5-system/1-auth.md` §2.3 및 Rationale 2.3.B (신규 분기 명시)
- **충돌 대상**: `spec/data-flow/1-audit.md:86` — "`extractClientIp`(`auth/utils/client-ip.ts`, `TRUST_CF_CONNECTING_IP` 신뢰 정책)"
- **상세**: 감사(`user.password_changed` 등) 경로는 `extractClientIp(req)` (req.ip 폴백 포함 4단계)를 사용하는 것이 target 기술과 일치한다. 충돌 없음. 단, 위 INFO 항목과 묶어 함수명 표기의 일관성을 점검할 때 함께 확인하면 좋다.
- **제안**: 현상 유지. 필요 시 `data-flow/1-audit.md`에 "세션·감사 경로는 `extractClientIp(req)` (4단계), webhook/rate-limit 경로는 `extractClientIpFromHeaders` (헤더 전용)"라는 설명을 추가하면 독자 혼선을 줄일 수 있다.

---

### [INFO] `GlobalExceptionFilter` 에러 메시지 상수화 — 스펙 기재 없음 (코드 내부 개선)

- **target 위치**: 코드 `codebase/backend/src/common/filters/http-exception.filter.ts` (UNKNOWN_ERROR_MESSAGE / UNHANDLED_ERROR_MESSAGE 상수 추출)
- **충돌 대상**: `spec/5-system/3-error-handling.md` 에러 메시지 기술
- **상세**: `GlobalExceptionFilter`에 `UNKNOWN_ERROR_MESSAGE = 'An unexpected error occurred'`와 `UNHANDLED_ERROR_MESSAGE = 'An unexpected error occurred. Please try again later.'` 두 상수를 추출해 명명했다. 스펙이 에러 메시지 문자열을 규범적으로 고정하지 않으므로 충돌 없음. 단, 두 메시지가 의미상 다름(비-Error 값 throw vs 매핑 안 된 Error)을 코드 주석이 설명하는데, 스펙에서도 이를 명시할지는 선택 사항.
- **제안**: 스펙 변경 불필요. 코드 내부 개선으로 완결.

---

## 요약

이번 변경은 `spec/5-system/1-auth.md` §2.3에서 클라이언트 IP 추출 경로를 세션·감사(`extractClientIp`, req.ip 폴백 포함)와 webhook/rate-limit/ip_whitelist(`extractClientIpFromHeaders`, 헤더 전용)로 명확히 분리 기술하고, 코드도 이를 반영해 `hooks.service.ts`의 인라인 래퍼를 제거한 것이 핵심이다. 기존 RBAC 매트릭스·API 계약·상태 전이·요구사항 ID와의 충돌은 발견되지 않았다. 유일한 비일관성은 `spec/1-data-model.md`, `spec/2-navigation/6-config.md`, `spec/5-system/12-webhook.md`가 webhook 경로 IP 추출 함수를 구 이름(`extractClientIp`)으로 지칭하는 것으로, 기능 충돌이 아닌 명명 동기화 권장 사항이다.

## 위험도

LOW

---

STATUS: SUCCESS
