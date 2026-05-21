---
worktree: (별 PR — pending assign)
started: 2026-05-18
owner: developer
---

# Plan: AI Timezone Context — Follow-ups

`impl-ai-timezone-context.md` (PR #191) 의 ai-review consistency-check 에서 식별된 INFO/Warning enhancement 들. 본 PR scope 밖 — 우선순위 낮음, 별 PR 로 처리.

## 항목

- [ ] **schema 중복 헬퍼 추출**: `buildSystemContextSchemaFields(orderStart: number, group: string)` 공통 헬퍼로 3 schema 파일의 `includeSystemContext` / `systemContextSections` 블록 (~30줄 × 3) 통합. (ai-review W5 maintainability)
- [ ] **workspace / node 섹션 라벨 주입**: 현재 `(unnamed)` / `(unlabeled)` 폴백. `__workspaceName` / 노드 라벨도 ExecutionContext 변수로 주입. (ai-review I8 requirement)
- [ ] **`Intl.DateTimeFormat` 캐싱**: `isValidIanaTimezone` / `formatIsoWithTimezone` / `computeOffsetMinutes` 의 module-level `Map<string, T>` 메모이제이션. 멀티테넌트 고부하 환경에서 마이크로 최적화. (ai-review I4 / I5 performance)
- [ ] **config echo default 생략 로직**: `adaptHandlerReturn` boundary 또는 echo 빌드 시점에 default 값과 일치하는 `includeSystemContext` / `systemContextSections` 필드 자동 trim. (spec §11.7 이 명시한 정책의 실 구현)
- [ ] **KST 시나리오 e2e 통합 검증**: 실제 KST 워크스페이스에서 AI Agent 호출 시 LLM 에 전달되는 systemPrompt 가 `+09:00` ISO + `Asia/Seoul (UTC+9)` 라인을 포함하는지 e2e 단언. (ai-review testing)
- [ ] **cafe24 metadata 나머지 date/time 필드 description 보강**: `order.start_date/end_date`, salesreport / mileage / promotion / application / community 의 date 필터 ~30 row. 현재는 `CAFE24_TIMEZONE_SUFFIX` 자동 suffix 가 도구 단위에서 KST 명시를 보강하므로 LLM 회귀는 차단되지만, metadata description 자체에 §5.2 컨벤션 적용 가치 있음.
- [ ] **`renderSection` exhaustive 가드 활용**: 새 섹션 타입 추가 시 컴파일 타임 캐치 (이미 default 케이스에 `_exhaustive: never` 추가됨 — 가드는 동작 중이며 본 항목은 새 섹션 추가 PR 에서 활용).
- [ ] **CAFE24_TIMEZONE_SUFFIX 의 shared/constants 이동**: 소비처가 2곳 이상이 되면 `nodes/integration/cafe24/metadata` 에서 `shared/constants/cafe24.ts` 로 이동. (ai-review I7 architecture)
- [ ] **workspace/node 섹션 활성 시 보안 UI 경고**: "내부 ID 가 LLM 공급자에게 전송됩니다" frontend 안내. (ai-review I1 security)
- [ ] **`execution-engine.service.spec.ts` 의 KST 케이스 mock 추가**: 현재 `workspace.settings: {}` 만 — `Asia/Seoul` 설정 시 `__workspaceTimezone` 이 실제 주입되는지 엔진 레벨 통합 검증. (ai-review I14 testing)
- [ ] **`information-extractor.handler.spec.ts` multi-turn prefix 케이스 추가**: 현재 single-turn 만 검증. (ai-review I15 testing)

## 우선순위

- **HIGH (보안·정확성)**: 없음 (Critical 없음)
- **MEDIUM**: schema 헬퍼 추출, KST 시나리오 e2e
- **LOW (enhancement)**: 나머지

> 본 plan 은 PR #191 머지 후 발생하는 enhancement 추적용. 각 항목은 독립적이라 별 PR 로 분리 가능.
