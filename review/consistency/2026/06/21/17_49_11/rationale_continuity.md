# Rationale 연속성 검토 결과

검토 모드: `--impl-done`  
검토 범위: `spec/4-nodes/4-integration` (diff-base: origin/main)  
대상 변경: M-2 IntegrationOAuthService provider 별 OAuthProviderStrategy 분리 (codebase 전용 refactor)

---

## 발견사항

발견된 CRITICAL 또는 WARNING 항목 없음.

### [INFO] target spec 문서 변경 없음 — Rationale 연속성 검토 범위 정상

- target 위치: `spec/4-nodes/4-integration/` 전체 (0-common, 1-http-request, 2-database-query, 3-send-email, 4-cafe24, 5-makeshop)
- 과거 결정 출처: `spec/2-navigation/4-integration.md` Rationale (line 1311)
- 상세: M-2 는 `IntegrationOAuthService` 내부 구조를 provider 별 `OAuthProviderStrategy` 5개로 분리하는 순수 codebase refactor 다. target spec(`spec/4-nodes/4-integration`) 파일들은 origin/main 대비 변경이 없다. 핵심 Rationale 항목인 `spec/2-navigation/4-integration.md` line 1311 — "컨트롤러 구현이 provider 별 분리 (3개) 인지 파라메트릭 (1개) 인지는 구현 세부 사항" — 이 정확히 이 refactor 를 구현 재량으로 허용하고 있다. plan(`refactor/02-architecture.md` §M-2)도 이 항목을 명시 인용하며 "spec 갱신: 불요 (facade 유지 시)" 로 확인했다.
- 제안: 별도 조치 불필요. facade 명(`IntegrationOAuthService`) 을 유지한 구현이 data-flow 다이어그램 participant 불변을 보장하고 있으므로 Rationale 정합 상태 유지.

### [INFO] `refreshToken` 인터페이스 제외 — spec Rationale 와 충돌 없음

- target 위치: 구현 코드 `integrations/oauth-providers/oauth-provider-strategy.ts` (OAuthProviderStrategy 인터페이스 — `begin`/`exchangeCode` 만 포함, `refreshToken` 제외)
- 과거 결정 출처: `spec/2-navigation/4-integration.md` §10.5 (Cafe24 자동 갱신 흐름), `spec/4-nodes/4-integration/4-cafe24.md` §6.1
- 상세: spec 은 refreshToken 책임을 `*-api.client.ts` 와 `cafe24-token-refresh` 큐 processor 에 위치시키며, 이를 oauth begin/exchange 흐름과 분리된 독립 갱신 계층으로 정의한다. 커밋 메시지도 "refreshToken 은 본 서비스에 없음(*-api.client.ts·expiry-scanner 담당) → 인터페이스 제외" 로 명시한다. spec Rationale 의 기각된 대안 중 "refreshToken 을 oauth begin 흐름과 통합"하는 안은 없으며, 현 분리가 spec 구조와 정합한다.
- 제안: 별도 조치 불필요.

### [INFO] D4 결정 / SSRF 가드 / 5필드 invariant 등 spec 본문 결정 — 구현 무변

- target 위치: `spec/4-nodes/4-integration/0-common.md` §4.2 D4 결정, `1-http-request.md` §8.2, `2-database-query.md` Rationale, `3-send-email.md` §8.0
- 과거 결정 출처: 각 파일의 `## Rationale` 및 `§5.8 (D4)` 절
- 상세: M-2 refactor 의 scope 는 OAuth 인증 흐름(`begin`/`callback`/`exchangeCode`) 의 내부 구조 분리에 한정된다. D4 에러 포트 라우팅 결정, SSRF 전 인증 방식 공통 적용 결정(2026-06-11), `meta.durationMs` 명명 통일, `DB_HOST_BLOCKED` 전용 코드 신설, to/cc/bcc array-only 정준화 등 spec Rationale 에 기록된 모든 기각 결정들은 M-2 의 변경 범위와 교차하지 않는다.
- 제안: 별도 조치 불필요.

---

## 요약

M-2 는 `spec/4-nodes/4-integration` 문서를 일체 변경하지 않는 codebase-only refactor 다. `spec/2-navigation/4-integration.md` Rationale line 1311 이 "provider 별 분리인지 파라메트릭인지는 구현 세부 사항" 으로 명시하여 이 refactor 를 사전에 허용했고, 기각된 대안(파라메트릭 단일 서비스 — Option B)은 plan 내부에서만 검토돼 폐기됐으며 spec 에 채택 근거가 기록되지 않았다. 합의된 설계 원칙(D4 에러 포트 통일, SSRF 공통 플래그, 5필드 invariant, facade 명 유지 등)은 모두 보존되어 있으며, Rationale 연속성 관점에서 충돌·번복·기각 대안 재도입 사례가 발견되지 않았다.

---

## 위험도

NONE
