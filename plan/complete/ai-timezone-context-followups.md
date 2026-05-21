---
worktree: ai-tz-followups-batch1
started: 2026-05-18
owner: developer
---

# Plan: AI Timezone Context — Follow-ups

`impl-ai-timezone-context.md` (PR #191) 의 ai-review consistency-check 에서 식별된 INFO/Warning enhancement 들. 본 PR scope 밖 — 우선순위 낮음, 별 PR 로 처리.

## 항목

- [x] **schema 중복 헬퍼 추출**: `buildSystemContextSchemaFields(orderStart: number, group: string)` 공통 헬퍼로 3 schema 파일의 `includeSystemContext` / `systemContextSections` 블록 (~30줄 × 3) 통합. (ai-review W5 maintainability) — `codebase/backend/src/nodes/ai/shared/system-context-schema.ts` 신설.
- [x] **workspace / node 섹션 라벨 주입**: ExecutionContext 에 `nodeLabel?`/`nodeType?` 필드 추가, createContext 에 `__workspaceName` 주입. `(unnamed)`/`(unlabeled)` 폴백 대신 실제 이름 노출. (ai-review I8 requirement)
- [x] **`Intl.DateTimeFormat` 캐싱**: `isValidIanaTimezone` / `getPartsInTimezone` / `computeOffsetMinutes` 의 module-level `Map<string, T>` 메모이제이션. (ai-review I4 / I5 performance)
- [x] **config echo default 생략 로직**: `pickNonDefaultSystemContext(rawConfig)` 헬퍼 — default 일치 시 echo 생략, 명시 변경 시 spread. 3 AI 핸들러의 single-turn + multi-turn echo 빌더에 적용. (spec §11.7 이 명시한 정책의 실 구현)
- [ ] **KST 시나리오 e2e 통합 검증**: 실제 KST 워크스페이스에서 AI Agent 호출 시 LLM 에 전달되는 systemPrompt 가 `+09:00` ISO + `Asia/Seoul (UTC+9)` 라인을 포함하는지 e2e 단언. (ai-review testing) — **별 plan 분리 권고**: e2e 인프라에 LLM stub provider 추가가 선결 (현재 e2e suite 에 AI agent 노드 실행 시나리오 미수록). 본 batch 의 unit-level `execution-engine.service.spec.ts` KST mock + `system-context-prefix.spec.ts` 27 case + `information-extractor.handler.spec.ts` multi-turn prefix 가 wiring 회귀 차단 안전망으로 동작.
- [x] **cafe24 metadata 나머지 date/time 필드 description 보강**: `date-descriptions.ts` 신설 (4 상수). order/salesreport/mileage/promotion/application 의 ~20 row 에 §5.2 컨벤션 적용. (community.ts 에는 date 필터 없음.) 기존 `metadata.spec.ts §5.2` 가드 통과.
- [x] **`renderSection` exhaustive 가드 활용**: 이미 default 케이스에 `_exhaustive: never` 추가됨 — 가드는 동작 중. 본 항목은 새 섹션 추가 PR 에서 자동 발동되는 passive 가드로 별도 작업 불요.
- [x] **CAFE24_TIMEZONE_SUFFIX 의 shared/constants 이동**: 외부 소비처 1곳 (cafe24-mcp-tool-provider.ts) 만 — 조건 (2곳 이상) 미충족이라 본 batch 에서는 skip. 향후 2번째 소비처 추가 시 함께 이동.
- [x] **workspace/node 섹션 활성 시 보안 UI 경고**: `system-context-schema.ts` 의 multiselect hint 로 "Selecting Workspace/Node sends internal ids and labels to the LLM provider as plain text" 노출. frontend 자동 폼이 schema hint 그대로 렌더링 + i18n 번역 추가. (ai-review I1 security)
- [x] **`execution-engine.service.spec.ts` 의 KST 케이스 mock 추가**: `runExecution — workspace timezone injection` describe 블록 신설 — `Asia/Seoul` workspace mock + 빈 settings fallback 케이스. (ai-review I14 testing)
- [x] **`information-extractor.handler.spec.ts` multi-turn prefix 케이스 추가**: `System Context Prefix (spec §11)` describe 에 multi-turn 첫 진입 prefix 포함/제외 2 케이스 추가. (ai-review I15 testing)

## 우선순위

- **HIGH (보안·정확성)**: 없음 (Critical 없음)
- **MEDIUM**: schema 헬퍼 추출, KST 시나리오 e2e
- **LOW (enhancement)**: 나머지

> 본 plan 은 PR #191 머지 후 발생하는 enhancement 추적용. 각 항목은 독립적이라 별 PR 로 분리 가능.

## 처리 요약 (2026-05-21)

11 항목 중 9 항목 완료 + 2 항목 skip (조건 미충족 또는 passive) + 1 항목 별 plan 분리 권고.

- 2 commit (worktree `ai-tz-followups-batch1`):
  - **commit 1** (backend refactor + 8 항목): M1 schema 헬퍼, L1 workspace/node 라벨, L2 Intl 캐싱, L3 §11.7 trim 실 구현, L4 cafe24 metadata description, L5 passive, L6 skip, L8 engine KST mock, L9 IE multi-turn prefix spec
  - **commit 2** (L7 frontend hint): backend schema hint + frontend i18n
- backend 4085/4085 unit 통과, frontend 4/4 i18n parity 통과, lint 신규 위반 없음, **e2e 93/93 통과** (`_test_logs/e2e-20260521-091635.log`).
- **잔여 1 항목 (M2 KST e2e)**: e2e 인프라에 LLM stub provider 추가가 선결 — 본 plan 의 후속 별 plan 으로 분리 권고. unit-level 회귀 안전망은 본 batch 에서 모두 보강 완료. 본 plan 의 다른 모든 항목이 완료되었으므로 본 plan 머지 시점에 `git mv plan/in-progress/ → plan/complete/` 와 함께 M2 단독 plan (`plan/in-progress/ai-timezone-kst-e2e.md`) 을 별도로 작성하면 추적성 보존됨.
