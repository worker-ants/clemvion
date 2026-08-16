# Consistency Check 통합 보고서

**BLOCK: YES** — `redactExecutionErrorValue`(존재하지 않는 옛 함수명)가 spec 에 그대로
patch 될 텍스트("spec 초안 ①")에 남아 있는 CRITICAL(naming_collision·convention_compliance
공동 발견), 그리고 R17 draft 가 "내부 읽기 경로도 같은 마스킹을 적용한다"고 주장하지만
같은 응답의 `nodeExecutions[].error` 로 그대로 우회된다는 CRITICAL(cross_spec) — 총 2건.

## 전체 위험도
**CRITICAL** — `--spec` 게이트를 무수정 통과시키면 (1) spec SoT 에 코드에 존재하지 않는
함수명이 등재되고, (2) 새로 선언되는 R17 보장("내부 읽기 경로 마스킹")이 spec 자신의
데이터 모델 정의(`Execution.error`↔`NodeExecution.error` 복사 관계) 및 실측 동작과 직접
모순된다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | naming_collision, convention_compliance | "spec 초안 ①"(§R17 교체 불릿) 본문이 이미 폐기된 함수명 `redactExecutionErrorValue`를 그대로 담고 있다 — `ExecutionError` 클래스명을 온전한 부분 문자열로 포함하는 충돌을, target 자신이 `## 설계` 절과 실제 구현(`redactStoredErrorForResponse`)에서 이미 해소했다고 명시했음에도 spec 에 실제 patch 될 텍스트만 옛 이름 그대로 | `plan/in-progress/eia-internal-rest-error-masking.md:163` ("spec 초안 ①"의 교체안 본문) | `codebase/backend/src/shared/utils/redact-stored-error.ts:57`(`redactStoredErrorForResponse`), `executions.service.ts:40,875,913`, target 문서 `## 설계`(`:86-92`, "이름을 바꿨다"), `## 조치` 체크리스트 | "spec 초안 ①" 중 `redactExecutionErrorValue` → `redactStoredErrorForResponse` 로 단순 치환(결정 자체는 이미 내려져 있음, find-replace 로 충분) |
| 2 | cross_spec | R17 draft 가 주장하는 "내부 읽기 경로도 같은 마스킹을 적용한다"가 같은 `GET /api/executions/:id` 응답 안에서 형제 필드 `nodeExecutions[].error`로 그대로 우회된다 — `spec/1-data-model.md` 는 이 필드를 `Execution.error`의 "복사본"(동일 값)으로 정의하는데, `findById`(`executions.service.ts:566-618`)는 이 배열을 마스킹 없이 원시 반환하고, 프런트도 노드 상세 Error 탭에서 미마스킹 값을 렌더(`page.tsx:493`) | `plan/in-progress/eia-internal-rest-error-masking.md` §"범위 밖"의 `NodeExecution.error` 불릿 및 "spec 초안 ①"(§R17 교체 텍스트) | `spec/1-data-model.md` §2.14(`:556-563`, 원본/복사 관계), `spec/2-navigation/14-execution-history.md` R-5(`:464-466`), `spec/5-system/6-websocket-protocol.md`(`execution.node.failed`, `:186`, 마스킹 언급 없음) | (a) 이번 PR 의 마스킹 범위를 `nodeExecutions[].error`까지 확장하거나, (b) "spec 초안 ①"에 "`nodeExecutions[].error`는 (데이터 모델상 원본과 동일 내용을) 여전히 원문으로 노출한다"는 캐비엇을 **필수**로 추가하고 정본 트래커(`spec-sync-external-interaction-api-gaps.md:205-210`)의 "같은 클래스의 유출 가능성" 문구를 "`Execution.error`와 동일 값의 복사 원본이 같은 응답에서 미마스킹 병존"으로 격상 정정 |

## planner 인계 (권한 밖 Critical)

(없음) — 이 세션은 `--spec` 모드로 이미 planner 턴 관할(target 자체가 `plan/in-progress/`
문서이며 아직 `spec/` 에 patch 되지 않은 draft). 위 두 CRITICAL 은 target(=이 plan 문서)
자체를 planner 가 `--spec` 게이트 통과 전에 직접 수정하면 해소되는 것으로, 별도 인계 불요.

## 경고 (WARNING)

(없음) — cross_spec 의 CRITICAL #2 상세에 담긴 "같은 문제의 다른 각도" 서술만 있고, 별도
등재된 독립 WARNING 은 없음 (naming_collision·convention_compliance 가 CRITICAL #1 과 동일
사안을 각자 시각에서 지적했으나 위 표로 통합됨).

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | convention_compliance | `## 설계` 절 함수 시그니처가 실제 구현보다 좁음(`\| undefined` 누락) | target `## 설계` 코드 블록 | 시그니처에 `\| undefined` 추가(선택) |
| 2 | convention_compliance | `14-external-interaction-api.md` frontmatter `code:` 가 `redact-stored-error.ts`/`executions.service.ts` 를 아직 안 가리킴 | spec frontmatter `code:` 목록 | §R17 교체와 같은 커밋에서 두 경로 추가 권장(필수 아님, `/spec-coverage` 소관) |
| 3 | convention_compliance, plan_coherence | "정본 트래커 신규 잔여 2건 등재" 체크박스가 `[ ]`이지만 실측상 이미 등재 완료(`spec-sync-external-interaction-api-gaps.md:205,212`) | target `## 조치` 마지막 두 항목 | `[x]` 로 갱신하거나 "닫기와 같은 커밋에서 체크" 방침을 한 줄 명시 |
| 4 | rationale_continuity | `interaction.triggerToken` 비대상 근거가 직전 라운드 WARNING을 정확히 반영해 독립 근거((a)(b)(c))로 해소됨 (확인, 조치 불요) | target `## D`, `### ② secret-store.md §1` | planner 턴에서 옮길 때 (a)(b)(c) 축약 금지 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | CRITICAL | R17 "내부 읽기 경로 마스킹" 보장이 `nodeExecutions[].error` 형제 필드로 우회됨(spec 데이터 모델 정의와 자기모순) |
| rationale_continuity | NONE | 위반 없음. 직전 라운드 WARNING(triggerToken 근거 재사용)을 교과서적으로 해소한 사례로 확인 |
| convention_compliance | MEDIUM | spec 초안에 폐기된 함수명 잔존(CRITICAL) + 완결성 INFO 3건 |
| plan_coherence | NONE | 결정 충돌·선행 plan 미해소 없음. 체크박스 self-staleness 1건(INFO) |
| naming_collision | CRITICAL | spec 초안 텍스트에 `ExecutionError` 부분 문자열 충돌을 일으키는 옛 함수명 `redactExecutionErrorValue` 잔존 |

## 권장 조치사항

1. (BLOCK 해소 최우선) `plan/in-progress/eia-internal-rest-error-masking.md:163` "spec 초안 ①"
   본문의 `redactExecutionErrorValue` 를 `redactStoredErrorForResponse` 로 치환한다 — 단순
   find-replace, 결정 자체는 이미 내려져 있다.
2. (BLOCK 해소 필수) "spec 초안 ①"에 `nodeExecutions[].error`의 마스킹 여부를 명시하는 캐비엇을
   추가한다 — 마스킹 범위를 확장하거나(권장 아님, 이번 PR 스코프 밖일 수 있음), "최상위 `error`만
   마스킹하며 `nodeExecutions[].error`는 데이터 모델상 동일 내용을 원문으로 유지한다"는 명시적
   한계 서술을 필수로 넣는다. 정본 트래커(`spec-sync-external-interaction-api-gaps.md:205-210`)의
   `NodeExecution.error` 항목 문구도 "동일 값의 복사 원본이 미마스킹 병존"으로 격상 정정한다.
3. `spec/2-navigation/14-execution-history.md` R-5 를 (b) 캐비엇 경로로 갈 경우, "이 불변식은
   현재 `Execution.error` 한 필드에만 적용되고 `NodeExecution.error`는 잔여 갭"이라는 각주를
   함께 남긴다.
4. (선택) `## 조치` 체크리스트의 "정본 트래커 신규 잔여 2건 등재" 항목을 실측(이미 등재됨)에
   맞춰 `[x]`로 갱신하거나 취지를 한 줄 남긴다. frontmatter `code:` 경로 보강(INFO #2)도
   같은 커밋에서 권장.
