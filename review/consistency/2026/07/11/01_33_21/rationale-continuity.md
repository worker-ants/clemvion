# Rationale 연속성 검토 — `variables.__*` 3계층 강제 (--impl-done)

## 대상
- diff: `git diff origin/main...HEAD` (base `cc3dafa8c`, HEAD `e252c5718`)
- 핵심 변경: `spec/conventions/execution-context.md` 원칙 5 "강제 갭"→"강제 (3계층)" 전환 + `## Rationale` 3개 신설(3계층 이유·breaking 수용 이유·Code 노드 범위 밖 이유), `spec/4-nodes/1-logic/{4,5}-*.md` §6 갱신, `spec/5-system/3-error-handling.md` §1.3 `RESERVED_VARIABLE_NAME` 등재, 구현(`reserved-variable-name.util.ts`, 두 노드 handler/schema, `WorkflowsService.validateReservedVariableNames`).

## 조사 방법
- `git log -1 d2b4590a2`(원칙 5 최초 도입 커밋, PR #889) 커밋 메시지 확인.
- 선행 산출물 대조: `review/consistency/2026/07/11/00_03_30/{SUMMARY,rationale-continuity}.md`(spec 단계 Critical 1건 차단→재설계 확정 근거), `review/code/2026/07/11/{00_59_29,01_24_20}/SUMMARY.md`(코드 리뷰 2라운드, W1~W8 처리 및 fresh 재검증).
- 코드 직접 대조: `filterUserVariables`(execution-engine.service.ts:7554-7562), `variable-declaration.handler.ts`(meta.skipped/coercionWarnings), `reserved-variable-name.util.ts`, `code.handler.ts:429,464-476,543`($vars atomic replace), `integration-handler-base.ts:41-42`(`__workspaceId` 신뢰 경계 소비처), 및 신규 L0(`workflows.service.ts` `validateReservedVariableNames`)·L1(두 `*.schema.ts`)·L2(두 `*.handler.ts`) 구현.

## 발견사항

0건 (Critical / Warning 없음). 아래는 근거와 함께 확인된 INFO 항목이다.

### [Info] "강제 갭"→강제 전환은 결정 번복이 아니라 예고된 후속 작업의 완결

- target 위치: `spec/conventions/execution-context.md:66` "강제 (3계층)" 및 `## Rationale` "왜 `variables.__*` 예약을 3계층으로 강제하는가 (2026-07-11)" 단락
- 과거 결정 출처: 원칙 5 도입 커밋 `d2b4590a2`(PR #889, `docs(spec): execution-engine·conventions ...`) 커밋 메시지 — "노드 레벨 미강제 '강제 갭' 잔여 리스크 명시 (스키마 가드 하드닝은 별도 task)."
- 상세: 원저자가 이미 "강제하지 않기로 결정"이 아니라 "아직 안 했고 별도 task 로 한다"고 명문화해 뒀다. 본 PR 은 그 예고된 task를 수행한 것이므로 합의 원칙의 번복이 아니다. 도입 커밋이 지정한 선례(carousel `__item_` schema-level reject)도 그대로 채택돼 연속성이 유지된다.
- 제안: 조치 불요.

### [Info] "명시적 실패 > 조용한 손실" vs §6 silent skip/fallback — 구분이 실제 코드로 뒷받침됨

- target 위치: `spec/conventions/execution-context.md` `## Rationale` "왜 breaking 을 감수하는가" 단락; `spec/4-nodes/1-logic/4-variable-declaration.md` §6 "⚠ silent fallback"
- 과거 결정 출처: `variable-declaration.md` §6 이 채택한 **의도적** silent skip(중복 이름 무시)/silent fallback(coerce 실패 시 `null`)
- 상세: 두 silent 은 `variable-declaration.handler.ts` (diff 확인, `skipped`/`coercionWarnings` 배열 → `meta.skipped`/`meta.coercionWarnings` 로 출력에 노출)로 **관찰 가능**하다. 반면 park 시 `filterUserVariables`(`execution-engine.service.ts:7554-7562`)는 `!key.startsWith('__')` 필터만 있고 `logger` 호출도 meta 노출도 전혀 없어 **관찰 불가능한(opaque) silent drop**이다. 새 Rationale 이 주장하는 "관찰 가능 vs 관찰 불가" 구분은 코드로 실증되며, 같은 노드 계열 안에서 "silent 자체를 금지"가 아니라 "관찰 불가능한 silent만 금지"라는 정합된 단일 원칙으로 읽힌다. 표면적 충돌처럼 보였던 부분(선행 `review/consistency/.../00_03_30` 의 Warning W2)이 본 최종 diff 에서는 해당 구분 문장으로 이미 해소돼 있다.
- 제안: 조치 불요. (선행 impl-prep 단계 Warning 이 최종본에서 해소됨을 재확인.)

### [Info] Code 노드 범위 밖 근거 — 원칙적 경계이며 blast radius 주장도 코드로 확인됨

- target 위치: `spec/conventions/execution-context.md:71` "강제 범위 밖 (잔여 리스크 — Code 노드)" 항목 + `## Rationale` "왜 Code 노드는 강제 범위 밖인가"
- 과거 결정 출처: `spec/4-nodes/5-data/2-code.md` §7.1(격리 방식) — `$vars` 는 isolate 안에서 자유 read/write 후 "원자적으로 동기화"가 기존 설계로 이미 명시돼 있다(`code.handler.ts:429,464-476,543` 대조, `context.variables = (...) as ...` 전체 교체, 필터 없음). 새 Rationale 은 이 기존 동작을 뒤집는 게 아니라 그 잔여 리스크를 처음으로 문서화한 것이다.
- 상세: (1) 경계의 원칙성 — "폼으로 이름을 직접 지정하는 두 선언형 노드(리터럴/필드 검증 가능)" vs "임의 코드 출력 전체를 스캔해야 하는 Code 노드(격리·계약이 다른 별개 결정)"라는 구분은 스키마 검증 가능성 차이에 근거해 임의적이지 않다. (2) blast radius 주장("Integration 자격증명 조회·LLM config 해소·sub-workflow dispatch 의 워크스페이스 스코프 신뢰 경계") 도 `integration-handler-base.ts:41-42`(`resolveIntegration` 이 `getWorkspaceId()`→`context.variables.__workspaceId` 로 워크스페이스 스코프 자격증명 조회)로 확인된다 — 과장이 아니다. (3) 코드 리뷰 라운드(`review/code/2026/07/11/00_59_29/SUMMARY.md` W5)가 이미 security reviewer 로 독립 검증했고, 근본 하드닝은 `task_d04bb348` 로 별도 스폰돼 있어 "정직하게 남긴 잔여 리스크"라는 서술과 일치한다.
- 제안: 조치 불요.

### [Info] L0/L1/L2 3계층 구현이 새 Rationale 의 서술과 diff 상에서 정확히 일치

- target 위치: `spec/conventions/execution-context.md:67-69` L0/L1/L2 서술 vs `codebase/backend/src/modules/workflows/workflows.service.ts`(`validateReservedVariableNames`), `*.schema.ts`(`validateVariableDeclarationConfig`/`validateVariableModificationConfig`), `*.handler.ts`(`execute` 내 `isReservedVariableName` 가드)
- 과거 결정 출처: 선행 `review/consistency/2026/07/11/00_03_30/SUMMARY.md` Critical("schema-level reject 단독은 `{{ }}` 표현식으로 우회된다") — 이 Critical 이 3계층 설계를 강제한 원인.
- 상세: L0(저장 시점, 리터럴, 400)·L1(pre-flight, 리터럴, `INVALID_NODE_CONFIG`)·L2(런타임, 해석 후, throw) 가 정확히 diff 에 구현돼 있고, 두 handler 모두 `execute` 를 `async` 로 전환한 이유(동기 throw 가 `Promise` 반환 계약에서 호출부 `.catch` 를 우회하는 것 방지)도 주석으로 남아 있다. `review/code/2026/07/11/00_59_29/SUMMARY.md`(mutation 실험으로 L2 제거 시 관련 테스트만 실패 확인) 및 `01_24_20/SUMMARY.md`(fresh 재검증, Warning 0)로 이미 독립 검증됐다.
- 제안: 조치 불요.

## 요약

이 PR 은 `spec/conventions/execution-context.md` 원칙 5가 PR #889 커밋 메시지에서 이미 "스키마 가드 하드닝은 별도 task"로 예고해 둔 후속 작업을 정확히 완결하는 것으로, 기각된 대안의 재도입이나 합의 원칙의 무근거 번복에 해당하지 않는다. 신설된 3개 Rationale 단락은 (1) 3계층이 필요한 이유(단일 계층으로는 `{{ }}` 표현식 우회 불가)를 선행 impl-prep 단계에서 실증된 Critical 로부터 직접 도출하고, (2) "명시적 실패 > 조용한 손실" breaking 정당화가 `variable-declaration.md` §6 의 기존 silent skip/fallback 채택과 충돌하는 것처럼 보였던 지점을 "관찰 가능한 silent(meta 노출) vs 관찰 불가능한 opaque silent(park drop, 로그·meta 전무)"라는 코드로 뒷받침되는 구분으로 정합화했으며, (3) Code 노드를 강제 범위 밖으로 둔 경계는 "폼-검증 가능 필드 vs 임의 코드 출력"이라는 원칙적 기준에 근거하고 그 잔여 리스크(`__workspaceId` 워크스페이스 신뢰 경계 우회 가능성)도 실제 소비 코드로 확인된다. 세 주장 모두 코드 직접 대조로 실증됐고, 선행 spec 단계 consistency-check(Critical 1건 → 재설계) 및 2라운드 code review(Warning 8건 전부 fix/defer 근거 첨부, fresh 재검증 Warning 0)가 같은 지점들을 이미 순차적으로 점검·해소했다. Rationale 연속성 관점에서 차단 요소를 발견하지 못했다.

## 위험도
NONE

STATUS: DONE
