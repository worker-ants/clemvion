# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음, 구현 착수 가능

## 전체 위험도
**LOW** — Warning 1건(naming_collision: `client.ts` fallback 3001 vs 3011 불일치)이 있으나 M-2 자체가 해소 대상으로 식별한 핵심 버그이며, 구현 시 3011 을 canonical 로 채택하면 해소됨. Spec 본문 또는 Rationale 과의 직접 모순 없음.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | naming_collision | `client.ts` fallback 포트 `3001` 이 다른 3개 파일(`auth-providers.ts`, `login-form.tsx`, `register-form.tsx`)과 `.env.example` 의 `3011` 과 의미 불일치 — 중앙 상수 통합 시 `3001` 을 그대로 가져가면 버그 영속 | `codebase/frontend/src/lib/api/client.ts:4` | `.env.example:27` (`NEXT_PUBLIC_API_URL="http://localhost:3011/api"`), `auth-providers.ts:18`, `login-form.tsx:32`, `register-form.tsx:32` | `.env.example` 의 `3011` 을 canonical SoT 로 삼아 `constants.ts` 의 `API_BASE_URL` fallback 을 `"http://localhost:3011/api"` 로 단일 채택, `3001` 완전 제거 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | 신규 `lib/api/constants.ts` 가 spec frontmatter `code:` 글로브에 미등재 | `codebase/frontend/src/lib/api/constants.ts` (계획) | 구현 후 planner 위임으로 관련 spec frontmatter `code:` 에 추가 검토 (M-2 "spec 변경 불요" 판정과 즉시 충돌 없음) |
| 2 | cross_spec | `ws-client.ts` WS fallback 포트 3001 이 `.env.example:28`(`NEXT_PUBLIC_WS_URL="http://localhost:3011"`) 과 불일치 — M-2 scope 에 포함됨 | `codebase/frontend/src/lib/websocket/ws-client.ts:4` | `constants.ts` 에 `WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL \|\| "http://localhost:3011"` 함께 정의하거나 직접 3011 로 정정 |
| 3 | cross_spec | `API_BASE_URL` fallback 의 `/api` suffix 와 webhook URL 도출 로직(`webhook-url.ts` `getWebhookBaseUrl()`) 간 간접 연결 — spec 규칙 유지되므로 모순 없음 | `codebase/frontend/src/lib/utils/webhook-url.ts` | 이번 M-2 에서 `webhook-url.ts` 수정 불필요, 현행 유지 권장 |
| 4 | rationale_continuity | `getServerApiBaseUrl()` 분리 export 에 대한 Rationale 미기재 — spec 정합하며 번복 아님 | `plan/in-progress/refactor/03-maintainability.md` §M-2 개선 방안 2 | 구현 시 JSDoc 으로 우선순위(`INTERNAL_API_URL` → `NEXT_PUBLIC_API_URL` → fallback) 명시 |
| 5 | convention_compliance | plan §M-2 검증 기준 "grep -rn '3001' frontend/src 0건 확인" 이 WS fallback(`ws-client.ts:4` 3001) 잔류 시 0건 미달 — WS URL 은 API URL 과 성격 다름 | `plan/in-progress/refactor/03-maintainability.md` §M-2 개선 방안 3 | (a) grep 범위를 `'3001/api'` 로 API URL 한정 표현으로 수정하거나, (b) ws-client.ts WS fallback 도 정포트로 교정해 grep 범위 유지 |
| 6 | plan_coherence | 구현 완료 후 `plan/in-progress/refactor/README.md` P1 #12 와 `03-maintainability.md` §M-2 체크박스 갱신 필요 | `plan/in-progress/refactor/README.md:60` | 구현 완료 후 표준 plan 갱신 절차 수행 — 착수 차단 아님 |
| 7 | naming_collision | `lib/api/constants.ts` 신규 경로 vs 기존 `lib/constants/` 디렉터리 — 경로 충돌 없으나 상수 위치 관행 분기 가능 | `codebase/frontend/src/lib/api/constants.ts` (계획) vs `codebase/frontend/src/lib/constants/` | 파일 상단 주석으로 "API URL 관련 상수는 lib/api/constants.ts, 비-API 전역 상수는 lib/constants/" 분리 의도 명시 |
| 8 | naming_collision | 4개 파일의 모듈-로컬 `API_BASE_URL` const 가 중앙화 후 잔류 시 혼용 위험 | `client.ts:4`, `auth-providers.ts:18`, `login-form.tsx:32`, `register-form.tsx:32` | 4개 파일 모두에서 로컬 `const API_BASE_URL` 완전 제거, 중앙 import 로 전환 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | spec 본문과 직접 모순 없음. 포트 fallback 값 미규정 영역. `constants.ts` spec frontmatter 미등재는 planner 후속 사항 |
| rationale_continuity | NONE | M-2 방향을 기각한 과거 Rationale 결정 없음. 순수 drift 교정 리팩터 |
| convention_compliance | LOW | `spec/conventions/**` 직접 위반 없음. plan 내 grep 검증 목표와 WS fallback scope 불명확성 |
| plan_coherence | NONE | plan 기재와 구현 범위 1:1 일치, 선행 조건 없음, 범위 충돌 없음 |
| naming_collision | LOW | `client.ts` `3001` fallback 불일치(M-2 핵심 버그). 중앙화 후 로컬 const 잔류 주의 |

## 권장 조치사항

1. **(WARNING 해소 — 구현 시 필수)** `constants.ts` 의 `API_BASE_URL` fallback 을 `"http://localhost:3011/api"` 로 명시 채택. `.env.example:27` 이 canonical SoT. `3001` 은 어떤 파일에도 잔류하지 않도록 6파일 교체 완료 후 `grep -rn "3001" frontend/src` 로 검증.
2. **(구현 시 권장)** `ws-client.ts:4` WS fallback 도 `3011` 로 정정해 plan grep 검증 기준을 충족하거나, plan 검증 표현을 `'3001/api'` 로 범위 한정.
3. **(구현 시 권장)** 4개 파일의 모듈-로컬 `const API_BASE_URL` 완전 제거 확인.
4. **(구현 시 권장)** `getServerApiBaseUrl()` 에 JSDoc 으로 우선순위 명시(`INTERNAL_API_URL` → `NEXT_PUBLIC_API_URL` → fallback).
5. **(구현 후 후속)** `plan/in-progress/refactor/03-maintainability.md` §M-2 체크박스 및 README P1 #12 완료 갱신.
6. **(구현 후 선택적)** planner 위임으로 `spec/5-system/` frontmatter `code:` 에 `codebase/frontend/src/lib/api/constants.ts` 추가 검토.
