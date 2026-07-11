# Plan 정합성 검토 — `variables.__*` 예약 네임스페이스 3계층 강제 (task_7f283553, `--impl-done`)

diff base: `git diff origin/main...HEAD` (HEAD `e252c5718`, 핵심 커밋 `d8ce7693f` + resolution `6e08fe425` + fresh review `e252c5718`).

## 검토 범위

1. `plan/in-progress/node-output-redesign/{variable-declaration,variable-modification}.md` 의 "7차 갱신" 라인-참조 정정을 현재 코드와 대조(스팟체크).
2. `plan/in-progress/**` 전체를 `variable_declaration`/`variable_modification`/`workflows\.service`/`ExecutionContext`/`reserved`/`__` 키워드로 grep, 이 PR 이 건드리는 노드·파일과의 충돌 여부 확인.
3. task_7f283553(task chip)가 자체 `plan/in-progress/` 문서 없이 원자적 spec+code PR 로 종결되는 것이 `plan-lifecycle.md §2`(미해결 follow-up 존재 시 in-progress 분류) 기준에 부합하는지 확인.
4. `variable-declaration.md`/`variable-modification.md` 의 기존 미해결 항목(array/object `coercionWarnings` 테스트, `recordValues` echo)이 이 PR 로 우연히 해소되거나 잘못 종결 처리되지 않았는지, "7차 갱신" 노트가 이를 PENDING 으로 보존하는지 확인.

## 발견사항

0건 (CRITICAL/WARNING 없음). 검토 세부는 아래 확인 내역 참조.

### [Info] "7차 갱신" 라인-참조는 현재 코드와 완전 일치 (질문 1)

- target 위치: `plan/in-progress/node-output-redesign/variable-declaration.md:3`, `plan/in-progress/node-output-redesign/variable-modification.md:3`
- 관련 코드: `codebase/backend/src/nodes/logic/variable-declaration/variable-declaration.schema.ts`, `.../variable-declaration.handler.ts`, `.../variable-modification/variable-modification.schema.ts`, `.../variable-modification.handler.ts`
- 상세: 두 "7차 갱신" 노트가 인용한 5+2개 라인 번호를 전수 대조했다.
  - `variable-declaration.schema.ts`: `varDefSchema:11`✓, `variableDeclarationNodeConfigSchema:57`✓, `validateVariableDeclarationConfig:87`✓, `executionMetadata.kind:118`✓, `warningRules:125`✓.
  - `variable-declaration.handler.ts`: `validate:28`✓, `execute:43`✓ (`async` 전환 확인 — `variable-declaration.handler.ts:43`).
  - `variable-modification.schema.ts`: `variableModificationNodeConfigSchema:65`✓, `validateVariableModificationConfig:115`✓, `warningRules:170`✓.
  - `variable-modification.handler.ts`: `execute:67`✓ (`async` 전환 확인 — `variable-modification.handler.ts:67`).
  전부 일치, stale 라인 없음. 이 결과는 `review/code/2026/07/11/01_24_20/SUMMARY.md`("W3 node-output-redesign 라인 refs → 해소... 전수 대조, 전부 일치")의 독립 재검증과도 부합한다.
- 제안: 조치 불요.

### [Info] 다른 in-progress plan 과의 실질 충돌 없음, 단 1건 벤치마크 케이스는 무관 확인 필요 (질문 2)

- target 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:30-40, 646-708` (`validateReservedVariableNames` 신설 + `skipParamSchemaValidation` → `skipLegacyDataGates` 파라미터 rename/일반화)
- 관련 plan: `plan/in-progress/manual-trigger-default-param.md`(전체 항목 `[x]` 완료 상태, `workflows.service.ts validateManualTrigger` 언급), `plan/in-progress/spec-update-manual-trigger-save-time-error-code.md:22-25, 33`(같은 파일의 `restoreVersion` 게이트-skip 비대칭을 spec Rationale 로 문서화 예정)
- 상세: `workflows.service.ts` 를 참조하는 in-progress plan 은 이 둘뿐이다. 둘 다 파라미터의 **개념**(저장 시점 게이트, `restoreVersion` 예외)만 서술하고 리터럴 파라미터명(`skipParamSchemaValidation`)을 인용하지 않아 rename 으로 텍스트가 깨지지 않는다. 다만 `skipLegacyDataGates` 로의 일반화는 이제 그 플래그가 Manual Trigger 파라미터 스키마 게이트 *와* 신규 예약 이름 게이트 두 개를 함께 skip 한다는 뜻이라, `spec-update-manual-trigger-save-time-error-code.md` 가 향후 "왜 `restoreVersion` 이 게이트를 skip 하는가" Rationale 을 작성할 때 참고할 배경 사실이 하나 늘었다(차단 사유는 아님).
- 나머지 `variable`/`__`/`reserved-variable`/`ExecutionContext` 키워드로 전체 `plan/in-progress/**` grep 결과, `node-output-redesign/{variable-declaration,variable-modification}.md` 외 실질 충돌 후보는 없음:
  - `node-output-redesign/workflow.md:172` 의 `context.variables.__workspaceId` 인용은 시스템 주입 키(엔진 내부 설정) 참조로, 이 PR 이 거부하는 대상(사용자 config 의 `varDefSchema.name`/`modDefSchema.variable`)과 무관.
  - `node-output-redesign/carousel.md:69,158` 의 `__item_` schema-level reject 는 이미 구현 완료로 기록된 선례일 뿐, 대조해도 충돌 없음.
  - `parallel-p2-followups.md §7`(ExecutionContext God Object 잔여 Warning)이 참조하는 `execution-context.md` Rationale 기존 단락(`ParallelBranchContext`/`abortSignal`/`ExecutionOptions` 기각)은 이 PR 이 그 뒤에 3개 신규 단락을 **추가**만 했을 뿐 순서·내용 변경 없음(`spec/conventions/execution-context.md:96-104`) — §7 참조 무결.
  - `exec-intake-followups.md`, `execution-engine-residual-gaps.md`, `spec-sync-*-gaps.md`, `node-cancellation-inflight-followups.md` 등은 매칭 0건.
- 제안: 조치 불요(INFO). `spec-update-manual-trigger-save-time-error-code.md` 착수 시 `skipLegacyDataGates` 일반화 사실을 참고하면 됨 — 지금 갱신을 요구하지는 않음.

### [Info] task_7f283553 를 별도 `plan/in-progress/` 문서 없이 종결한 판단은 적절 (질문 3)

- target 위치: 이 PR 전체(spec+code+test 원자 커밋), `review/consistency/2026/07/11/00_03_30/plan-coherence.md`(선행 impl-prep 검토)
- 상세: `plan-lifecycle.md §2` 의 분류 기준은 "미체크 체크박스·TODO·결정 필요 항목이 하나라도 있으면 in-progress" 다. 이 PR 이 유발한 모든 미해결 항목은 **같은 PR 안에서** 닫혔다:
  - 선행 impl-prep 검토(00_03_30 세션)의 WARNING 3건 — (a) 저장 시점 게이트 부재 → `workflows.service.ts` L0 게이트로 해소, (b) CHANGELOG Breaking changes 누락 → `CHANGELOG.md:3-16` 신설로 해소, (c) node-output-redesign 서브 plan 라인 stale → "7차 갱신" 노트로 해소.
  - code-review(00_59_29 세션) Warning 8건 — 6 fix(같은 PR 안에서 처리) + 2 defer. defer 중 하나(W7 아키텍처 중복)는 근거와 재검토 트리거를 `RESOLUTION.md` 에 명시한 accept-risk, 다른 하나(W5 후속 — Code 노드 `__workspaceId` 위조 하드닝)는 **본 PR 범위 밖**으로 명시하고 `task_d04bb348` chip 으로 durable 등록했다(같은 방식으로 chip 기반 후속 추적).
  - 따라서 이 PR 종료 시점에 남는 "처리할 항목"이 없어 `plan/in-progress/` 최상위 문서를 신설할 필요가 없다는 선행 검토의 결론(00_03_30 INFO 항목)과 이번 최종 상태가 일치한다.
- 제안: 조치 불요. 다만 `task_d04bb348`(Code 노드 신뢰 경계 하드닝)이 향후 실제 작업으로 착수될 때는 통상적인 `plan/in-progress/<name>.md` 로 승격해야 한다(현재는 chip 상태로 durable, 즉시 위반 아님).

### [Info] 기존 미해결 항목(coercionWarnings 테스트, recordValues echo) 오종결 없음 — PENDING 보존 확인 (질문 4)

- target 위치: `plan/in-progress/node-output-redesign/variable-declaration.md:117`, `plan/in-progress/node-output-redesign/variable-modification.md:133,135`
- 상세:
  - `variable-declaration.md:117` (`type='array'+defaultValue='not-json'` coercionWarnings 테스트)은 `- [ ]` 로 유지되고 "7차 갱신" 노트(`:3`)가 "이 PR 과 무관하게 여전히 PENDING" 이라 명시. 실제로 이 PR 의 `variable-declaration.handler.spec.ts` diff(`git diff origin/main...HEAD -- .../variable-declaration.handler.spec.ts`)는 예약 이름 가드 테스트 4건만 추가했고 array/object coercion 케이스는 건드리지 않음 — 클레임과 diff 가 일치.
  - `variable-modification.md:133`(spec §5.1 `recordValues` echo 필드 미기재)·`:135`(`handler.spec.ts` 의 default-echo assert 부재)도 `- [ ]` 로 유지되고 "7차 갱신" 노트가 "나머지 잔여 2건... 이 PR 과 무관하게 유지"라 명시. 이 PR 의 `variable-modification.handler.spec.ts` diff 역시 예약 이름 가드 테스트만 추가(6-operation `it.each` 포함)했고 `recordValues` 기본 echo 어설션은 추가하지 않음 — 클레임과 diff 일치.
- 제안: 조치 불요.

## 요약

이 PR 은 `variables.__*` 예약 네임스페이스를 L0(저장)·L1(pre-flight)·L2(런타임) 3계층으로 강제하며, 선행 impl-prep 검토(00_03_30)가 지적한 저장 시점 게이트·CHANGELOG·서브 plan 라인-stale 3개 WARNING 을 모두 같은 PR 안에서 해소했다. "7차 갱신" 노트의 라인-참조 6+2건을 스팟체크한 결과 현재 코드와 전부 일치했고, 두 서브 plan 의 기존 미해결 항목(coercionWarnings 테스트, recordValues echo 2건)은 diff 상으로도 실제로 손대지 않아 PENDING 보존 클레임이 정확하다. `plan/in-progress/**` 전체 grep 에서 이 PR 과 충돌하는 미해결 결정·선행 미해소 plan 은 발견되지 않았다(유일하게 스쳐가는 접점은 `workflows.service.ts` 파라미터 rename 인데, 개념 서술만 하는 두 manual-trigger plan 의 텍스트를 깨뜨리지 않는다). task_7f283553 이 자체 plan 문서 없이 원자적으로 종결된 것은 `plan-lifecycle.md §2` 기준상 타당하며, 유일한 실질 후속(Code 노드 신뢰 경계)은 chip 으로 durable 등록되어 있다.

## 위험도

NONE

STATUS: DONE
