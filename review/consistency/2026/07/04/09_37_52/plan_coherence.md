# Plan 정합성 검토 — spec/5-system/4-execution-engine.md (impl-done)

## 검토 대상
- Target: `spec/5-system/4-execution-engine.md` (§Rationale "Graceful Shutdown … under-count 허용" 정정, PR3→PR4 재귀속)
- 관련 코드: `execution-context.service.ts` 클래스 주석, `execution-engine.service.ts` segmentStartMs 주석
- diff-base: origin/main

## 발견사항

- **[WARNING]** `06-concurrency.md` README 요약 행이 C-3 완료를 반영하지 않음 (stale)
  - target 위치: (직접 아님 — target 커밋이 유발한 후속 정합성 요구) `spec/5-system/4-execution-engine.md` §Rationale 정정과 짝을 이루는 plan hygiene 대상
  - 관련 plan: `plan/in-progress/refactor/README.md` 25행, 71행 / `plan/in-progress/refactor/06-concurrency.md`(본문은 이미 갱신됨, commit `47307a5d7`)
  - 상세: 이번 target 커밋(`47307a5d7`)이 `06-concurrency.md` 본문의 C-3 항목을 `[x]` 완료로 갱신하고 "PR3 에서 자연 해소" stale 가정도 정정했으나, 같은 디렉터리의 `README.md` 요약 테이블·체크리스트는 갱신되지 않은 채 남았다:
    - 25행: `06-concurrency.md` 행이 여전히 "잔여(미완) `1 (C-3)`", "미착수 1: C-3(exec-intake PR3 연동)" 로 서술 — 본문(C-3 `[x]` 구현 완료, Option A, spec 정직화)과 불일치. 특히 "exec-intake PR3 연동" 표현은 이번 정정으로 **틀린 것으로 판명**된 옛 가정(PR3 가 세그먼트-start 영속을 해소한다는 전제)을 그대로 반복하고 있어 이중으로 stale.
    - 27행 합계: 잔여 `**2**`(06 의 1 + 03-maintainability M-7 의 1)로 집계 — C-3 완료 반영 시 06 몫이 0 이 되어 총 잔여는 `1`, 완료는 `82`→`83` 으로 재계산돼야 함.
    - 71행 "18. **ExecutionContext 스케일아웃**" 체크리스트 항목도 "*(잔여)*", "exec-intake PR3 연동" 문구 그대로 — 완료 표기(취소선 + 날짜 + Option A 요약)로 갱신 필요.
  - 제안: `plan/in-progress/refactor/README.md` 를 target 커밋과 같은 취지로 동기화 — 06-concurrency 행을 12완료/0잔여로, 합계를 83/1 로, 18번 항목을 완료 취소선으로 갱신. 이 갱신이 되면 `06-concurrency.md` 전체 15항목이 완료+철회로 종결되므로(다른 5개 refactor 문서처럼) `plan/complete/refactor/06-concurrency.md` 로 이동하는 것도 함께 고려할 만하다(`.claude/docs/plan-lifecycle.md` 절차 참고) — 단 이는 본 target PR 의 직접 책임은 아니고 developer/planner 후속 정리로 족하다.

- **[INFO]** `spec-draft-c3-context-drift.md` 는 이미 self-aware
  - target 위치: 없음 (참고용)
  - 관련 plan: `plan/in-progress/spec-draft-c3-context-drift.md` Rationale 마지막 문단
  - 상세: 해당 plan 문서가 스스로 "옛 06-concurrency C-3 plan 의 'PR3 에서 자연 해소' 는 stale … plan hygiene 으로 06-concurrency C-3 + exec-intake PR4 candidate note 를 함께 갱신한다(plan_coherence WARNING 해소)" 라고 명시하고 있다. 실제로 `06-concurrency.md` 본문과 `exec-intake-queue-impl.md` PR4 항목(§66행 "refactor 06 C-3 정직화(2026-07-04)가 이 candidate 를 여기로 이관")은 이미 갱신되어 위 WARNING 을 스스로 해소했다고 주장한다. 그러나 실제 확인 결과 **같은 디렉터리의 `README.md` 는 이 hygiene 범위에서 누락**됐다 — 위 WARNING 항목 참조.
  - 제안: 없음(기록용). README 동기화가 완료되면 이 self-referential 주장이 완전히 성립한다.

- **[INFO]** exec-intake-queue-impl.md PR4 candidate 표기 정합성 확인 — 문제 없음
  - target 위치: spec §Rationale PR3→PR4 재귀속 서술
  - 관련 plan: `plan/in-progress/exec-intake-queue-impl.md` PR4 항목(§58)
  - 상세: PR4 항목이 "세그먼트-start 영속(…) 후속 candidate(미확정) … PR3(#795)는 이를 해소하지 않음(re-scoped=크래시 re-drive). refactor 06 C-3 정직화(2026-07-04)가 이 candidate 를 여기로 이관." 으로 이미 정확히 갱신되어 있어 target 의 spec 정정과 완전히 일치한다. 추가 조치 불요.

## 요약

Target 커밋(`47307a5d7`, C-3 spec 정직화 + segmentStartMs stale 가정 정정)은 `06-concurrency.md` 본문과 `exec-intake-queue-impl.md` PR4 항목을 정확히 동기화했고 새 `spec-draft-c3-context-drift.md` plan 문서로 근거·결정 이력을 잘 남겼다. 다만 같은 refactor 백로그 디렉터리의 상위 인덱스 `README.md`(요약 테이블 25/27행, 체크리스트 71행)는 이번 갱신 범위에서 누락되어 "06-concurrency 잔여 1건(C-3, exec-intake PR3 연동 대기)" 이라는 이제는 틀린 서술을 유지하고 있다. 미해결 결정을 일방적으로 뒤집거나 선행 plan 미해소를 노출하는 CRITICAL 급 문제는 없으며, 순수하게 "본문은 갱신, 인덱스 요약은 미갱신"의 후속 정리 누락이다.

## 위험도
LOW
