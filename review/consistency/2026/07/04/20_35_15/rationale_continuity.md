# Rationale 연속성 검토

## 검토 방법 노트

전달받은 payload(`_prompts/rationale_continuity.md`)는 `spec/5-system/` 전체(1-auth.md, 10-graph-rag.md 등 다수 무관 문서)를 번들링했을 뿐, "PR2b §8 admission regression tests" 라는 실제 변경 내용에 대응하는 diff 를 포함하지 않았다(payload 내 `admission`/`advisory lock`/`§8 admission` 관련 매치가 전무). 이는 mis-scoped payload 로 판단해 지시된 절차대로 `git -C <worktree> diff origin/main...HEAD` 로 폴백해 실제 변경분을 직접 확인했다.

**실제 diff (`origin/main...HEAD`, `codebase/` 범위)**:
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — unit 테스트 2건 추가/보강
- `codebase/backend/test/execution-concurrency-cap.e2e-spec.ts` — e2e 테스트 1건 추가 + helper 파라미터화
- **production 코드(비-테스트 `.ts`) 변경 0건** — `git diff --stat` 확인: 변경 파일 전부 `.spec.ts` / `.e2e-spec.ts`.

대조 대상 Rationale: `spec/5-system/4-execution-engine.md` §8 본문(L1071–L1090) 및 `## Rationale` "동시성 cap admission gate — consumer-side + cancelled(timeout) (PR2b, 2026-07-04)" (L1528–L1537).

## 발견사항

없음.

신규 테스트가 고정(lock-in)하는 4개 불변식을 spec Rationale 과 1:1 대조한 결과, 전부 기존에 명시적으로 채택된 결정과 일치하며 재도입·번복·우회가 없다.

1. **advisory-lock 기반 admission 직렬화** — 테스트(`원자 UPDATE 파라미터 순서·cap 매핑 회귀`)가 `pg_advisory_xact_lock('exec-cap:ws-X')` 호출 + 조건부 UPDATE 순서를 검증. Rationale "TOCTOU 원자화" 항목이 "조건부 UPDATE 단독은 불충분...advisory lock 이 같은 scope 를 순차화" 라고 명시한 결정과 정확히 일치. 새 테스트는 이 결정을 뒤집는 것이 아니라 회귀 방지로 고정하는 것.
2. **raw-SQL 파라미터 순서·workspace/workflow cap 교차 오염 방지** — 테스트가 `[executionId, workspaceId, wsCap, workflowId, wfCap]` 순서를 assert. §8 본문(L1085)의 "workspace·workflow **양쪽** 검증" 요구사항과 부합, 새로운 설계 도입 아님.
3. **`deferred`/`cancelled` → `runExecution` 미호출** — 3건의 신규 테스트(`deferred`/`cancelled`/`admitted` 분기)가 admission 결과별 후속 분기를 고정. Rationale "admission gate 는 PENDING→RUNNING 최초 진입에만" 및 "`cancelled`(+`error.code`) vs `failed`" 항목과 일치 — cancelled 는 `markQueueWaitTimeout` 이 routing 해제를 전담한다는 기존 설계(§8 큐 대기 타임아웃 경로)를 그대로 반영.
4. **workspace-cap 이 다른 workflow 의 running 도 카운트** — 신규 e2e 테스트가 서로 다른 workflow A/B 간 workspace-level cap gating 을 검증. §8 본문(L1075) "워크스페이스당 동시 Execution 수...intake 큐 + admission gate 카운트" 설계와 일치 — workspace COUNT 가 workflow 경계를 넘어 집계되는 것은 스펙이 이미 전제한 동작이며 테스트는 이를 실증할 뿐 새 정책을 도입하지 않는다.

새 Rationale 신설이 필요한 "결정 번복"도 없다 — 테스트만 추가됐고 admission 로직·정책 자체는 변경되지 않았다(diff 상 production 코드 0건).

## 요약

실제 변경은 `spec/5-system/4-execution-engine.md` 의 PR2b Rationale(consumer-side gate·advisory-lock TOCTOU 해법·PENDING→RUNNING 한정 적용·workspace/workflow 이중 cap)을 그대로 실증하는 순수 회귀 테스트 추가이며, production 코드·설계·정책 변경이 전혀 없다. 기각된 대안의 재도입, 합의 원칙 위반, 무근거 결정 번복, invariant 우회 중 어느 것도 관찰되지 않았다. 전달된 검토 payload 자체가 대상 diff 를 담지 않은 mis-scope 였으나, `origin/main...HEAD` 폴백으로 실제 코드 diff 를 직접 대조해 결론의 근거를 확보했다.

## 위험도

NONE

BLOCK: NO

STATUS: SUCCESS