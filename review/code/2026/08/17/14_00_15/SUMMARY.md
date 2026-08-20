# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 없음. 핵심 프로덕션 마스킹 자체(값-축·키-축·MCP 흡수)는 올바르나, "의도된 미러"로 스스로 선언한 `websocket.service.ts` 의 `CREDENTIAL_KEY_PATTERN` 확장에 대응 회귀 테스트가 전무함이 뮤테이션 검증(옛 정규식 복원해도 48개 전원 GREEN)으로 실증됐다 — 이 저장소가 반복 겪어 온 "자매 중 하나만 테스트 누락" 결함 클래스와 정확히 일치. 여기에 JSDoc 자기모순·CHANGELOG 관행 이탈·plan 문서 수치 불일치 등 문서 계열 WARNING 이 겹쳐 MEDIUM 으로 판정.

forced 화이트리스트(router_safety) 7명(security, requirement, scope, side_effect, maintainability, testing, documentation) 전원 결과 확보됨 — 강제 이행 미비 없음.

## Critical 발견사항

_없음_

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `websocket.service.ts` 의 `CREDENTIAL_KEY_PATTERN` 이 `sanitize-error-message.ts` 와 "의도된 미러"라고 스스로 선언하지만 대응 회귀 테스트가 없다. 뮤테이션 검증(옛 정규식 `/^(password\|...\|token\|access[_-]?token\|refresh[_-]?token\|...)$/i` 로 되돌림)으로 실증: `websocket.service.spec.ts` 48개 테스트 전원 GREEN — 이번 수정이 되돌려져도 이 spec 은 전혀 신호를 못 준다. (side_effect 리뷰어도 동일 갭을 INFO 로 독립 관측) | `codebase/backend/src/modules/websocket/websocket.service.ts:74-75`, 대응 테스트 부재: `codebase/backend/src/modules/websocket/websocket.service.spec.ts` | `sanitize-error-message.spec.ts:367-417` 의 `FAMILY` 배열과 동일한 형태로 `websocket.service.spec.ts` 에 `it.each(FAMILY)` 회귀 테스트 추가(오탐 캐너리 포함) |
| 2 | Documentation | `CREDENTIAL_KEY_PATTERN`(공용) JSDoc 이 자기모순 — 기존 문단(86-87행)은 "`x-api-key`/`x-auth-token` 모두 WS 에는 없고 공용에만 추가된다"고 단언하는데, 이번 diff 가 추가한 다음 문단(89-92행)은 `[a-z0-9_-]*token` 이 `x-auth-token` 도 잡는다고 설명한다. 그런데 이 대안은 WS 쪽 `CREDENTIAL_KEY_PATTERN` 에도 이번 diff 로 동일하게 추가돼 `x-auth-token` 은 이제 WS 도 커버 — 86-87행 주장이 이 diff 자체로 거짓이 됐는데 정정되지 않았다. 실제로 공용에만 있고 WS 에 없는 것은 `x-api-key` 하나뿐 | `codebase/backend/src/shared/utils/sanitize-error-message.ts:86-92` | 86-87행을 "additionally covers `x-api-key`" 로 좁히고(`x-auth-token` 제거), 89-92행에 "`x-auth-token` 은 양쪽이 이미 공유" 를 명시 |
| 3 | Documentation | 직전 4개 커밋(`107c8038f`/`f5351e9c2`/`89c3f3c53`/`c9cc2a923`)이 전부 `CHANGELOG.md` 에 "Unreleased" 섹션을 남기며 확립한 관행이 이번 동일 성격(egress 마스킹 살아있는 갭 수정) 커밋에서만 빠졌다 | `CHANGELOG.md` (이번 diff 미포함) | 직전 항목과 동일 포맷으로 "Unreleased" 절 추가 — 3축 결함 요약 + 범위 결정(#4 `maskSensitiveFields` 미포함) 명시 |
| 4 | Maintainability | `websocket.service.ts` 의 `CREDENTIAL_KEY_PATTERN` 선언 위에 기존 `/** JSDoc */` 블록이 있는데, 이번 diff 가 그 바로 아래 별도의 `/* plain block comment */` 를 추가해 같은 선언을 설명하는 두 인접 블록이 다른 컨벤션을 쓴다. 자매 파일(`sanitize-error-message.ts`)은 동일 성격의 설명을 기존 JSDoc 블록 안에 문단으로 병합해 하나의 블록을 유지 | `codebase/backend/src/modules/websocket/websocket.service.ts:59-75` (신규 67-73행) vs `codebase/backend/src/shared/utils/sanitize-error-message.ts:79-98` | 신규 `/* ... */` 블록을 기존 `/** ... */` JSDoc 블록에 병합해 형식 통일 |
| 5 | Requirement | plan 체크리스트가 완료 근거로 "키-축 되돌리면 8 RED" 라고 기록했으나 재실행하면 5 RED(`id_token`/`csrf_token`/`csrfToken`/`session_token` 4건 + 캐너리 `nextPageToken` 1건). `token`/`access_token`/`refresh-token`/`x-auth-token` 4건은 옛 정규식도 이미 잡고 있어 되돌려도 RED 가 되지 않음. 코드 자체는 정확 — self-report 수치만 부정확 | `plan/in-progress/eia-secret-pattern-token-family.md:118` | plan 체크리스트의 "8 RED" 를 "5 RED" 로 정정하거나 셈법 근거 보완 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security / Documentation | WS↔공용 `CREDENTIAL_KEY_PATTERN` 의 `x-api-key` 비대칭 — WS 쪽엔 `x[_-]api[_-]?key` 대안이 없음(이번 diff 이전부터 존재, 이미 `13_31_57` consistency 리뷰 INFO#2 로 등재됨). 새 "함께 갱신한다" 주석이 "미러"의 정확한 범위를 명시하지 않아 이 유일한 비대칭까지 동기화 대상으로 오독될 소지 | `codebase/backend/src/modules/websocket/websocket.service.ts:67-75` vs `codebase/backend/src/shared/utils/sanitize-error-message.ts:100` | REST 전용 확장이 확정이면 주석에 "x-api-key 등 REST 전용 확장은 미러 대상 아님" 한 줄 추가 |
| 2 | Security | `maskSensitiveFields`(`mask-sensitive-fields.util.ts` `DEFAULT_SENSITIVE_KEYS`)는 이번 PR 범위 밖으로, 로깅·workflow-assistant 표면에서 접두 `token` 계열이 여전히 키 축에서 평문 통과. 의도적 범위 제외이며 `spec-sync-external-interaction-api-gaps.md` 트래커에 증거로 이미 첨부됨 | `codebase/backend/src/common/utils/mask-sensitive-fields.util.ts` (diff 밖) | 별도 트래커 진행 시 동일 `[a-z0-9_-]*token` 형태 적용 검토 |
| 3 | Scope | `mcp-error-codes.ts`/`11-mcp-client.md` 흡수가 원 티켓("bare `token=` 미탐지")보다 범위가 넓다 — `MCP_EXTRA_SECRET_PATTERNS` 를 통째로 비움. plan 에 근거(2026-07-10 URL-userinfo 흡수와 동일 절차, 무수정 프로브 검증) 기록됨 — 정당한 sibling 확장 | `codebase/backend/src/modules/mcp/mcp-error-codes.ts:41`, `spec/5-system/11-mcp-client.md` §8.3 | 조치 불필요 |
| 4 | Scope | 보안 패턴 수정과 인과관계 없는 EIA spec 문서 정정 3건(`hmacAlgorithm` 출처, §11 won't-do 각주, §2.2 인증 family)이 같은 PR 에 번들 — plan 제목·섹션에 착수 전부터 명시된 사전 승인 번들링 | `spec/5-system/14-external-interaction-api.md:64,1124-1125,1324-1329`, `spec/5-system/2-api-convention.md:54` | 조치 불필요 |
| 5 | Side Effect | 공유 정규식 SoT(`SECRET_LEAK_PATTERNS`, `CREDENTIAL_KEY_PATTERN` ×2) 확장은 10+ 소비 지점(웹소켓 emit, 스레드 렌더러, 종결 에러 페이로드, MCP 에러, execution-engine 등) 전체의 출력을 동시에 바꾸는 이 diff 최대 blast radius. `nextPageToken` 등 불투명 커서도 마스킹됨(accepted false positive, 캐너리로 문서화). plan 이 427 suites/8,811 tests GREEN 실측 기록 | `codebase/backend/src/shared/utils/sanitize-error-message.ts:42,100`, `codebase/backend/src/modules/websocket/websocket.service.ts:75` | 조치 불필요 — 향후 확장 시 동일 전수 소비자 재확인 |
| 6 | Side Effect / Maintainability | `MCP_EXTRA_SECRET_PATTERNS` 가 빈 배열이 되어 `redactMcpSecrets` 의 for 루프가 상시 no-op. 선언부 JSDoc 은 의도를 설명하지만 소비 지점(루프 자체)엔 설명이 없어 정적 분석/차후 정리 시 dead code 로 오판될 소지 | `codebase/backend/src/modules/mcp/mcp-error-codes.ts:54` 및 `redactMcpSecrets` 루프 | (선택) 루프 옆에 "JSDoc 참조 — 현재 no-op, 훅 유지" 한 줄 추가 |
| 7 | Maintainability | plan "설계" 절의 정규식(`(?:[A-Za-z0-9]+[_-]?)?token`)이 실제 shipped 코드(`[A-Za-z0-9_-]*token`/`[a-z0-9_-]*token`)와 동치가 아님(예: `___token` 은 shipped 코드에만 매칭) — 문서-코드 drift | `plan/in-progress/eia-secret-pattern-token-family.md:86` | plan 코드 블록을 실제 반영 정규식으로 정정하거나 "구현 시 단순화" 한 줄 추가 |
| 8 | Testing | 값-축 쿼리스트링 테스트(`redactSecrets('cb?token=sk-live-abc123&state=x')`)가 `state=x` 보존을 단언하지 않음. 자매 테스트(`mcp-error-codes.spec.ts`)는 `foo=bar` 보존을 명시적으로 단언 | `codebase/backend/src/shared/utils/sanitize-error-message.spec.ts` (`값 축: 따옴표·쿼리스트링 형태도 잡는다`) | `.toContain('state=x')` 단언 한 줄 추가 |
| 9 | Testing | ReDoS 벤치마크(2배씩 늘려 배율 정확히 2배)가 plan 에만 수기 기록되고 자동 회귀 테스트로 커밋되지 않음 | `plan/in-progress/eia-secret-pattern-token-family.md` 체크리스트, 대응 코드 `sanitize-error-message.ts` `SECRET_LEAK_PATTERNS` | (선택) 서브프로세스+timeout 기반 처리시간 상한 캐너리 추가 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 3축(값-패턴/키-패턴 ×2) 마스킹 결함 정확히 해소, ReDoS 선형성·매칭 상위집합 확인. INFO 2건(x-api-key 비대칭, maskSensitiveFields 범위 밖) |
| requirement | LOW | 기능 요구사항 전 항목 충족(31 suites/591 tests GREEN, spec 3건 line-level 일치). WARNING 1건(plan 뮤테이션 수치 8 RED가 실측 5 RED와 불일치, 문서만) |
| scope | NONE | 핵심 변경이 티켓 범위와 정확히 대응, MCP 흡수·spec 3건 번들 모두 plan 에 사전 선언돼 은닉 추가 아님 |
| side_effect | LOW | 공유 정규식 SoT 확장의 blast radius 는 크지만 의도적·실측 뒷받침. MCP no-op 루프·WS 회귀 테스트 부재를 INFO 로 선제 관측(testing 이 WARNING 으로 승격) |
| maintainability | LOW | WARNING 1건(WS 신규 주석 스타일이 JSDoc 형식과 불일치). INFO 2건(plan 설계 정규식 drift, MCP no-op 루프 설명 부재) |
| testing | MEDIUM | WARNING 1건 — WS `CREDENTIAL_KEY_PATTERN` 미러에 대응 회귀 테스트 전무를 뮤테이션으로 실증(48개 전원 GREEN). INFO 2건(보존 단언 누락, ReDoS 벤치마크 미자동화) |
| documentation | LOW | WARNING 2건(JSDoc 자기모순, CHANGELOG 관행 이탈). 핵심 spec 문서 3건은 코드와 line-level 일치, 품질 저장소 평균 상회로 평가 |

## 발견 없는 에이전트

_없음 — 전 에이전트가 최소 INFO 이상 발견_

## 권장 조치사항

1. `websocket.service.spec.ts` 에 `sanitize-error-message.spec.ts` 의 `FAMILY` 배열과 동일한 `it.each` 회귀 테스트(+ 오탐 캐너리)를 추가해 "의도된 미러"라고 스스로 선언한 `CREDENTIAL_KEY_PATTERN` 확장의 안전망을 실제로 확보한다 (WARNING #1, 가장 중요 — 뮤테이션으로 회귀 무방비가 실증됨).
2. `sanitize-error-message.ts:86-92` 의 JSDoc 자기모순을 정정 — "additionally covers" 를 `x-api-key` 로 좁히고 `x-auth-token` 은 양쪽 공유임을 명시한다 (WARNING #2).
3. `CHANGELOG.md` 에 이 이니셔티브의 관행대로 "Unreleased" 항목을 추가한다 (WARNING #3).
4. `websocket.service.ts` 의 신규 `/* ... */` 주석 블록을 기존 JSDoc 블록에 병합해 자매 파일과 문서 스타일을 통일한다 (WARNING #4).
5. `plan/in-progress/eia-secret-pattern-token-family.md:118` 의 "키-축 8 RED" 를 실측치 "5 RED" 로 정정하거나 셈법 근거를 보완한다 (WARNING #5).
6. (선택) INFO 항목 정리 — WS↔공용 `x-api-key` 비대칭 주석 보강, 쿼리스트링 보존 단언 추가, ReDoS 벤치마크 자동화, MCP no-op 루프 인라인 설명 추가.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation (7명)
  - **제외**: 아래 표 (7명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명 전원 — 실행된 reviewer 전체가 router_safety 화이트리스트에 의해 강제 포함되었고, 결과 전원 확보됨)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단 — 이번 diff(정규식 상수 확장·JSDoc/spec 정정)와 무관한 카테고리 |
  | architecture | router 판단 — 아키텍처 변경 없음 |
  | dependency | router 판단 — 의존성 변경 없음 |
  | database | router 판단 — DB 스키마/쿼리 변경 없음 |
  | concurrency | router 판단 — 동시성 로직 변경 없음 |
  | api_contract | router 판단 — 공개 API 시그니처 변경 없음 |
  | user_guide_sync | router 판단 — 사용자 가이드 문서 대상 변경 없음 |
