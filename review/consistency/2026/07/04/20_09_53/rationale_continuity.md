# Rationale 연속성 검토 — §8 admission gate 회귀 테스트 (TEST-ONLY)

## 검토 대상 재확인

프롬프트 payload(`_prompts/rationale_continuity.md`)에 실제 번들된 target 문서는 `spec/5-system/1-auth.md` 등(인증/세션/RBAC/audit) 다수 spec 조각이며, 지시된 "planned work"(§8 admission gate advisory-lock TOCTOU 회귀 테스트)와 직접 대응하는 본문은 포함되어 있지 않았다. 이는 payload 조립 단계의 스코프 불일치로 보인다(별건 이슈로 orchestrator 에 보고 권장). 검토자는 실제 관련 SoT 인 `spec/5-system/4-execution-engine.md` §8 + `## Rationale`(특히 "동시성 cap admission gate — consumer-side + cancelled(timeout) (PR2b, 2026-07-04)" 항목)과 구현 코드(`execution-engine.service.ts` `admitExecutionOrDefer`), 그리고 `plan/in-progress/exec-intake-followups.md` 의 "admission 회귀 보강 (ai-review testing INFO)" 항목을 직접 대조해 분석했다.

## 계획된 작업 요약

TEST-ONLY. `execution-engine.service.spec.ts`(unit) 및/또는 e2e 에 §8 admission gate 회귀 테스트를 추가한다. 코드 변경 없음. 대상 불변식:
- consumer-side(PENDING→RUNNING 직전) 원자 admission, producer-side 아님
- per-workspace `pg_advisory_xact_lock` 트랜잭션 + 조건부 UPDATE(RETURNING) 조합 — 조건부 UPDATE 단독 불충분(TOCTOU)
- admission 은 PENDING→RUNNING 최초 진입에만 적용, stalled 재배달·park 재개는 재심사 안 함
- 큐 대기 5분 초과 → `cancelled` + `error.code='EXECUTION_QUEUE_WAIT_TIMEOUT'` (not `failed`)
- priority 3-tier 는 스코프 밖

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO]** payload 스코프 불일치 — target 문서 미포함
  - target 위치: `_prompts/rationale_continuity.md` 전체 (실제로는 `spec/5-system/1-auth.md`, `8-embedding-pipeline.md`/`10-graph-rag.md`, `12-webhook.md` 등 다른 영역 spec 조각들이 번들됨)
  - 과거 결정 출처: 해당 없음 (스코프 문제이지 Rationale 충돌 아님)
  - 상세: "TEST-ONLY §8 admission gate regression coverage" 라는 planned work 설명과 실제 첨부된 target 본문(인증/세션/audit/KB/cafe24 spec)이 대응하지 않는다. 검토자가 실제 SoT(`spec/5-system/4-execution-engine.md`)를 별도로 조회해 검증을 완료했으나, orchestrator 의 payload 조립 로직에 스코프 필터링 버그가 있을 가능성이 있다.
  - 제안: orchestrator 측에서 `--impl-prep` 대상 문서 선택 로직을 점검. 본 검토 결과 자체는 실제 SoT 대조로 유효하다.

- **[INFO]** 테스트 추가가 Rationale 명시 불변식과 정합함 (확인 사항, 조치 불요)
  - target 위치: (예정) `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` 및/또는 e2e
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` `## Rationale` → "동시성 cap admission gate — consumer-side + cancelled(timeout) (PR2b, 2026-07-04)" + §8 본문 인라인 각주("admission gate TOCTOU")
  - 상세: 계획된 회귀 테스트 범위(advisory-lock 직렬화, 조건부 UPDATE 단독 불충분 실증, PENDING→RUNNING 한정 적용, `cancelled`+`EXECUTION_QUEUE_WAIT_TIMEOUT` 코드)는 모두 기존 Rationale 이 이미 확정한 설계를 **검증**하는 방향이며, 어떤 항목도 재도입·번복·우회를 시도하지 않는다. 실제 구현(`admitExecutionOrDefer`, 2613~2692행)도 문서화된 설계와 1:1 대응한다. `plan/in-progress/exec-intake-followups.md` 의 "admission 회귀 보강" 항목이 정확히 이 작업을 후속으로 예정해두었다.
  - 제안: 테스트 작성 시 다음 두 가지만 주의 — (1) advisory lock 이 없는 순진한 "조건부 UPDATE 단독" 구현으로 되돌아가는 방향의 리팩터를 유도하는 테스트를 쓰지 말 것(과거 CRITICAL 로 기각된 대안), (2) stalled 재배달/park 재개 경로에도 admission 재심사를 강제하는 assertion 을 넣지 말 것 — "PENDING→RUNNING 최초 진입에만 적용" 원칙(§4.2 dedup 불변식 근거)과 충돌한다. 두 항목은 회귀 테스트가 "의도된 비대칭"을 깨뜨리지 않도록 하는 가드레일이며, 현재 계획 설명(TEST-ONLY, 커버리지 보강)과 이미 일치한다.

## 요약

계획된 작업은 이미 shipped 되고 spec Rationale 에 명시적으로 근거가 기록된 §8 admission gate(advisory-lock TOCTOU) 설계에 대한 순수 회귀 테스트 추가이며, 코드/설계 변경이 없다. 과거 기각된 대안(조건부 UPDATE 단독, producer-side gate, stalled/park 경로 재심사)을 재도입하는 요소가 없고, 오히려 그 기각을 회귀로 고정하는 성격이다. Rationale 연속성 관점에서 충돌 없음. 유일한 이슈는 검토 payload 에 실제 target 문서 본문이 누락된 스코프 불일치이며, 이는 별도로 orchestrator 에 보고할 사안이다.

## 위험도
NONE

BLOCK: NO
STATUS: SUCCESS