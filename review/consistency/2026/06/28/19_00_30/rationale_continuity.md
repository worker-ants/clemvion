# Rationale 연속성 검토 결과

검토 대상: `spec/5-system/` (impl-done, diff-base=origin/main)
변경 커밋: `2e5cb2837` — refactor(hooks): extractClientIp 단일 구현 통합 + filter/guard 정리

---

## 발견사항

### 발견 없음 (NONE)

검토한 변경 파일:

- `codebase/backend/src/modules/hooks/hooks.service.ts`
- `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts`
- `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.spec.ts`
- `codebase/backend/src/modules/auth/utils/client-ip.spec.ts`
- `codebase/backend/src/common/filters/http-exception.filter.ts`
- `codebase/backend/src/common/filters/http-exception.filter.spec.ts`
- `plan/in-progress/webhook-hardening-cleanup.md`
- `plan/in-progress/webhook-public-ip-failopen-hardening.md`

---

### 상세 분석

#### 1. hooks.service.ts — 로컬 `extractClientIp` 래퍼 제거

**변경 내용**: `hooks.service.ts` 하단의 모듈-로컬 함수 `extractClientIp(headers)` 를 제거하고 `extractClientIpFromHeaders(headers) ?? undefined` 를 직접 호출로 대체했다.

**Rationale 정합성**: 제거된 래퍼는 `extractClientIpFromHeaders(headers) ?? undefined` 한 줄이었다 — 동작이 동일한 순수 위임이므로 동작 변경이 없다. 더 중요한 것은, 이 래퍼는 기존부터 `req.ip` / `req.socket.remoteAddress` 폴백을 포함하지 않았다. 이는 `spec/5-system/1-auth.md § Rationale 2.3.B` 의 명시적 결정과 일치한다:

> **`ip_whitelist`/rate-limit 의 IP 추출이 헤더 기반(CF-gated → XFF 첫 IP)인 것은 의도된 결정**이다 — `req.ip`(Express `trust proxy 1`) 를 우선/대체로 쓰자는 안은 **기각**한다: CF Tunnel 배포에서는 `req.ip` 가 cloudflared/CF edge 주소라 실제 클라이언트가 아니어서 `ip_whitelist` 를 오히려 깨뜨린다.

변경 후 `hooks.service.ts` 의 주석도 이 결정을 명시적으로 참조한다: "req.ip(trust-proxy) 폴백을 whitelist 경로에도 적용하려면 req 전달이 필요하므로 별도 후속으로 남긴다 (plan/in-progress/webhook-public-ip-failopen-hardening.md). 현재는 헤더 기반 동작 유지." — 기각된 대안을 재도입하지 않고 오히려 기각 이유를 재확인하며 유지했다.

#### 2. public-webhook-throttle.guard.ts — `PublicWebhookReqShape` 인터페이스 추출

**변경 내용**: 가드 내부의 인라인 익명 타입을 `PublicWebhookReqShape` 로 export 해 테스트 파일과 공유하도록 했다.

**Rationale 정합성**: 순수 타입 공유 리팩터링이며, 동작·설계 원칙에 변경 없음. 관련 Rationale 항목(Rationale 2.3.B의 헤더 기반 IP 추출 원칙)에 영향이 없다.

#### 3. client-ip.spec.ts / public-webhook-throttle.guard.spec.ts — env 스냅샷·spy 복원 패턴

**변경 내용**: 개별 테스트의 `try/finally` + `mockRestore()` 수작업을 `beforeEach`/`afterEach` 의 `jest.restoreAllMocks()` + env 스냅샷/복원 패턴으로 일원화했다.

**Rationale 정합성**: 테스트 격리 품질 개선이며, 어떤 설계 결정도 번복하지 않는다. `TRUST_CF_CONNECTING_IP` 환경변수의 기본 off 정책 및 CF 신뢰 원칙(Rationale 2.3.B)은 테스트 어서션 내용에서 동일하게 검증된다.

#### 4. http-exception.filter.ts — 오류 메시지 상수 추출

**변경 내용**: 인라인 문자열 리터럴 `'An unexpected error occurred'`, `'An unexpected error occurred. Please try again later.'` 를 `private static readonly` 상수로 추출했다.

**Rationale 정합성**: 순수 코드 품질 개선(CWE-209 — 내부 원문 미노출 원칙은 유지됨). 관련 spec Rationale 항목 없음.

---

### 미결 사항 기록 (INFO)

- **INFO**: `plan/in-progress/webhook-public-ip-failopen-hardening.md` 에 기록된 "IP 미식별 fail-open" 강화는 현재 미결이며 사용자/보안 결정이 필요하다. 이 계획은 기존 Rationale 2.3.B 의 `req.ip` 기각 결정을 번복할 가능성이 있어, 결정 확정 후 `spec/5-system/12-webhook.md §6·WH-SC-05·Rationale 2.3.B` 를 함께 갱신해야 한다. 단, 이 계획은 본 PR 범위 밖이므로 현재 변경에 대한 차단 이슈가 아니다.

---

## 요약

이번 변경(커밋 `2e5cb2837`)은 `hooks.service.ts` 의 일회용 로컬 래퍼 제거, 타입 공유 목적의 인터페이스 export, 테스트 격리 패턴 일원화, 오류 메시지 상수 추출로 구성된 순수 리팩터링이다. 변경 전 코드도 이미 헤더 기반 IP 추출(Rationale 2.3.B 의 `req.ip` 기각 결정을 준수)로 동작하고 있었으며, 이번 변경은 그 동작을 바꾸지 않는다. `spec/5-system/` 의 어떤 Rationale 에서도 기각된 대안을 재도입하거나, 합의 원칙을 위반하거나, 무근거 번복이 발생하지 않았다.

---

## 위험도

NONE
