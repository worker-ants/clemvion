# ai-review SUMMARY — priority 3-tier triggerType threading

- 세션: `review/code/2026/07/04/19_02_17`
- 대상 커밋: `1eefcca12 feat(06-concurrency): priority 3-tier triggerType threading (§4.3)`
- diff base: `origin/main`
- router 활성 reviewer 10/14: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, concurrency, api_contract
  - skip: performance, dependency, database, user_guide_sync (변경 성격 무관 — 순수 값 매핑 + 타입 확장 + 문서)

## 전체 위험도: LOW

## Critical: 0

## Warning: 4 (전부 조치 완료)

| # | reviewer | 파일:라인 | 내용 | 조치 |
| --- | --- | --- | --- | --- |
| W1 | maintainability | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3245` | 2줄 주석의 후반부만 교체돼 앞줄 끝에 `webhook` 조각이 매달리고 바로 새 `3-tier(§4.3)` 문단이 이어지는 merge-artifact 가독성 회귀 | 매달린 `webhook` 조각 제거, `priority 3-tier(§4.3):` 로 단일 문단화 |
| W2 | documentation | `spec/5-system/4-execution-engine.md:1090` | §8 admission-gate 본문이 여전히 "priority 3-tier 는 본 PR 스코프 아님 … 현 2-tier 유지" — 같은 파일의 flip 된 배너(:379/:1071)와 모순 | "구현 완료 — manual(1)>webhook(2)>schedule(3), executedBy 우선(§4.3)" 로 갱신 |
| W3 | documentation | `spec/data-flow/3-execution.md:68` | 미변경 상태로 옛 2-tier "의도된 임시 처리, PR2 threading 후속" 서술 | triggerType threading 구현 완료 서술로 갱신 |
| W4 | documentation | `spec/data-flow/10-triggers.md:182` | 큐 카탈로그 표가 동일한 옛 "2-tier·임시·threading 후속" 서술 | 구현 완료 서술로 갱신 |

## INFO (비차단 — 조치/기록)

- **plan 체크박스** (documentation INFO) — `plan/in-progress/exec-intake-followups.md:13` priority 3-tier 항목 `[x]` 체크 (본 PR 이 구현). → 조치.
- **env-var 표 `(PR2)` 잔재** (documentation INFO) — `spec/5-system/4-execution-engine.md:1246` `§8 동시성 cap(PR2)` 는 **동시성 cap PR 을 가리키는 pre-existing 라벨**(priority 3-tier 와 무관). scope creep 회피 위해 유지.
- **fallback 비대칭** (side_effect·testing·requirement INFO) — `execute()` 의 `?? 'webhook'` fallback 과 `resolveExecutionRunPriority` 내부 `undefined → schedule` fallback 이 다름. `execute()` 가 유일 호출자이고 항상 resolved 값을 넘기므로 **현재 dead path**, 기능 영향 없음. 기록만.
- **discriminated union 컴파일 강제 한계** (requirement·architecture INFO) — `triggerId` variant 의 `triggerType` 타입이 `ExecutionRunTriggerType`(‘manual’ 포함)이라 인접 JSDoc(‘webhook’/‘schedule’)보다 넓음. 3개 호출부 모두 안전 리터럴 전달이라 런타임 무해. JSDoc 경계로 완화됨.
- **테스트명 PR 번호** (maintainability INFO) — 테스트명에 `(PR2)` 하드코딩. 무해.
- **XFF chat-channel 테스트 비대칭** (testing INFO) — 두 번째 chat-channel 테스트가 `triggerType` 미assert. 형제 테스트가 커버하므로 회귀 갭 경미.

## 조치 후 재검증

- 코드 변경(주석 1줄) + spec/plan 문서 3+2건. 코드 로직 무변경 → 재 ai-review 는 clean 기대.
- TEST WORKFLOW 재수행 필요(lint·unit·build·e2e).
