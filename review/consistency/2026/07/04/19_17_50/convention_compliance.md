# 정식 규약 준수 검토 — priority 3-tier triggerType threading

## 검토 대상

- **spec**: `spec/5-system/4-execution-engine.md` §4/§8/§9.3, `spec/data-flow/10-triggers.md`, `spec/data-flow/3-execution.md` (origin/main → HEAD diff)
- **code**: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`(`ExecuteOptions.triggerType` 신설 + `execute()` 판정), `codebase/backend/src/modules/execution-engine/queues/execution-run.queue.ts`(`ExecutionRunTriggerType`/`EXECUTION_RUN_PRIORITY`/`resolveExecutionRunPriority` — diff 없음, 기존 정의 재사용), `codebase/backend/src/modules/hooks/hooks.service.ts`, `codebase/backend/src/modules/schedules/schedule-runner.service.ts`
- **점검 대상 정식 규약**: `spec/conventions/spec-impl-evidence.md`, `spec/conventions/error-codes.md`, `spec/conventions/execution-context.md`, `spec/conventions/swagger.md`(해당 없음 확인용)

이 payload 의 "Target 문서" 절에는 `spec/5-system/1-auth.md`·`10-graph-rag.md` 전문이 스냅샷으로 포함되어 있었으나, 실제 diff-base(`origin/main`) 대비 변경 파일과 무관한 것으로 확인되어(워크트리 `git diff --stat` 로 직접 재확인) 검토는 실제 변경분(위 3개 spec + 3개 code 파일)을 대상으로 했다.

---

### 발견사항

- **[INFO]** `spec/5-system/4-execution-engine.md` frontmatter `pending_plans:` 에 이미 완료된 plan 경로가 잔존
  - target 위치: `spec/5-system/4-execution-engine.md` frontmatter (라인 9-13)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §2.1 `pending_plans` 정의("미구현 surface 를 책임지는 plan 경로") 의 취지
  - 상세: `pending_plans:` 목록에 `plan/in-progress/exec-intake-queue-impl.md` 가 여전히 남아있으나, 이 plan 은 이미 `plan/complete/exec-intake-queue-impl.md` 로 이동 완료(커밋 `2816ec774`, "#802" — 본 diff 범위 직전). 잔여 후속은 신규 `plan/in-progress/exec-intake-followups.md` 로 분리됐고, 이번 diff 로 완료된 "priority 3-tier" 항목도 그 followups 파일 안에서 `[x]` 체크됐다. 그런데 execution-engine spec frontmatter 는 옛 경로만 가리키고 신규 `exec-intake-followups.md` 를 `pending_plans:` 에 추가하지 않았다.
  - **build-gate 영향**: `spec-pending-plan-existence.test.ts` 는 경로가 `in-progress/` 또는 `complete/`(치환) 어느 쪽이든 실존하면 통과이므로(§4 표) 이 상태는 **가드를 통과**한다 — 즉시 BLOCK 사유는 아니다. 다만 "partial spec 이 실제로 자신의 잔여 작업을 추적하는 plan 을 가리킨다"는 §R-5 의 취지(잘못된/은퇴된 plan 을 가리키는 역방향 링크는 발견을 방해)에서는 벗어난 상태다.
  - 제안: `pending_plans:` 를 `exec-intake-queue-impl.md` → `exec-intake-followups.md` 로 교체(다른 3개 plan 경로는 실제로 유효하므로 유지). 이번 PR 스코프가 아니라면 `plan/in-progress/exec-intake-followups.md` 자체가 이 frontmatter 정합을 후속 항목으로 흡수해도 된다.

- **[INFO]** priority 3-tier 관련 3개 유사 명칭 필드(`__triggerSource`(3종, 노드 input 마커) / `triggerSource`(5종, 실행이력 DTO) / 신규 `ExecuteOptions.triggerType`(3종, priority 계산 전용))의 명명 근접성
  - target 위치: `spec/5-system/4-execution-engine.md` §4.3 코멘트, `spec/data-flow/3-execution.md`, `spec/data-flow/10-triggers.md`
  - 위반 규약: 직접적으로 명시된 conventions 위반은 아님(명명 규약 문서 자체가 이 필드군을 다루지 않음). naming-collision 관점 상세 분석은 별도 `naming_collision.md` 리뷰 파일이 이미 존재하므로 본 리뷰에서는 언급만.
  - 상세: 이번 diff 는 두 곳(`execution-engine.md` §4.3, `data-flow/3-execution.md`)에서 "본 `triggerType` 은 priority 계산 전용 — 실행 이력 표시용 `Execution.triggerSource` 5-way 와는 별개 필드"라고 명시적으로 구별을 문서화했다. 이는 규약 위반이 아니라 오히려 모범적 조치.
  - 제안: 조치 불요. `naming_collision.md` 리뷰 결과와 교차 확인만 권장.

- **[INFO]** 코드 주석의 `ExecutionRunTriggerType` 타입 명명과 spec 어휘 정합
  - target 위치: `codebase/backend/src/modules/execution-engine/queues/execution-run.queue.ts` (라인 20-33, diff 없음 — 기존 PR1 정의를 그대로 재사용)
  - 위반 규약: 없음 — `spec/1-data-model.md §2.8 Trigger.type` enum(`webhook`/`schedule`/`manual`)과 `ExecutionRunTriggerType = keyof typeof EXECUTION_RUN_PRIORITY`(`manual`/`webhook`/`schedule`) 이 값 집합 일치. 이미 코드 주석에 "naming collision 회피" 근거가 명시돼 있다.
  - 상세: 규약 준수 확인 목적의 기록. 문제 없음.
  - 제안: 조치 불요.

### 규약 준수 확인(위반 없음으로 판정한 항목)

- **`spec/conventions/error-codes.md`**: 이번 변경은 신규 에러 코드를 발행하지 않는다(`triggerType` 은 priority 계산 값이며 에러 표면과 무관). 해당 규약 적용 대상 아님.
- **`spec/conventions/execution-context.md`**: `ExecuteOptions.triggerType` 은 `ExecutionContext`(노드 핸들러 주입 객체)의 필드가 아니라 `execute()` 진입점 옵션이며, `ExecutionRunJob` payload 에도 싣지 않는다고 spec·코드 주석 양쪽에서 명시(§9.3 경계). Stable core/Container-specific/`_`-prefix 분류 규칙 자체가 적용될 대상이 아니다 — God Object 우려 없음.
- **`spec/conventions/swagger.md`**: 이번 diff 는 controller/DTO 를 건드리지 않는다(`hooks.service.ts`/`schedule-runner.service.ts`/`execution-engine.service.ts` 내부 로직 + queue 상수만). API 문서 데코레이터 규약 적용 대상 아님.
- **`spec/conventions/spec-impl-evidence.md` §1 (frontmatter 적용 대상)**: `spec/data-flow/10-triggers.md`·`3-execution.md` 는 §1 명시적으로 frontmatter 의무 제외 대상(`spec/data-flow/**`)이라 frontmatter 부재가 규약 위반이 아니다. `spec/5-system/4-execution-engine.md` 는 기존 `status: partial` + `code:` 유지, 이번 diff 로 code glob 을 갱신할 필요도 없다(execution-engine 모듈 전체가 이미 glob 매칭 대상).
- **문서 구조(Overview/본문/Rationale)**: 이번 diff 는 기존 문서의 기존 절(§4 코멘트 블록, 데이터플로우 표 셀) 문구만 갱신했을 뿐 섹션 구조를 신설·변경하지 않았다. 3섹션 구성 위반 없음.
- **금지 패턴**: `spec/conventions/` 전체에서 이번 변경 도메인(트리거 우선순위/큐)에 대한 명시적 금지 항목은 확인되지 않았다.

---

### 요약

이번 변경(priority 3-tier `triggerType` threading)은 spec 문서 문구 갱신 3건 + 호출부 3개 파일의 소규모 로직 추가로, 정식 규약(`spec/conventions/**`) 위반은 발견되지 않았다. `ExecuteOptions.triggerType`/`ExecutionRunTriggerType` 명명은 `Trigger.type`(§2.8) 어휘를 그대로 재사용하고 있고, 기존 유사 명칭 필드(`__triggerSource`, `triggerSource`)와의 구별도 diff 안에서 명시적으로 문서화되어 있어 오히려 모범적이다. 유일한 지적 사항은 `spec/5-system/4-execution-engine.md` frontmatter `pending_plans:` 가 이미 `complete/` 로 이동한 옛 plan(`exec-intake-queue-impl.md`) 경로를 계속 가리키고 신규 `exec-intake-followups.md`(이번 diff 로 완료 표시된 항목을 포함)를 등재하지 않은 stale 참조인데, 이는 build gate(`spec-pending-plan-existence.test.ts`)가 in-progress/complete 어느 쪽이든 실존만 확인하므로 통과하며 CRITICAL/WARNING 이 아닌 INFO 수준의 문서 위생 사안이다.

### 위험도

NONE

BLOCK: NO
STATUS: SUCCESS
