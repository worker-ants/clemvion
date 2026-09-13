# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원(cross_spec / rationale_continuity / convention_compliance / plan_coherence / naming_collision) 전문 확보, Critical 0건.

## 전체 위험도
**LOW** — 신규 Critical·차단 사유 없음. spec 6파일의 `CONTAINER_*` 표기 drift 와 `§1.4` 카탈로그 정책 미정이 라운드 1부터 열려 있는 known-open WARNING 으로 유지 중이며, `spec/conventions/**` 자체는 이번 브랜치에서 델타 0(코드 전용 PR).

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — Critical 자체가 없으므로 인계 대상 없음. 단, 아래 WARNING#1·#2는 근본 해결이 `spec/5-system/**`·`spec/3-workflow-editor/**`·`spec/4-nodes/**` 쓰기 권한(=planner 전유)에 걸려 있어 참고용으로 표기한다.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, rationale_continuity | `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` — 유저 가이드는 이번 diff 로 "전용 코드 없음, 메시지 접두일 뿐"으로 정정됐는데 spec 6파일은 여전히 정식 에러 코드처럼 서술 (실측: `execution-engine.service.ts` `nodeExec.error = { message }`, `code` 필드 없음) | `codebase/frontend/src/content/docs/02-nodes/logic.mdx` / `logic.en.mdx` (diff, 정정 완료) | `spec/5-system/4-execution-engine.md:332-333` · `spec/3-workflow-editor/{0-canvas.md:636, 2-edge.md:202}` · `spec/4-nodes/1-logic/{0-common.md:83, 7-map.md:179-180, 9-foreach.md:209-210}` (6파일, 대조: `3-loop.md:189-191`은 이미 올바른 선례) | planner 턴에서 택일: (a) `3-error-handling.md §1.4`에 `CONTAINER_*` backfill, (b) 6파일 표기를 `3-loop.md` 선례(발행 문자열 인용)로 통일. `plan/in-progress/spec-draft-nullable-notation-followups.md`에 이미 등재·"한 턴에 묶으라" 합의 있음 — 신규 아님, 재확인 |
| 2 | cross_spec | `§1.4` 카탈로그가 "앵커 없는 맨 문자열" 7종(`MAX_ITERATIONS_EXCEEDED` 등)은 정식 코드로 등재하면서 구조적으로 동형인 `CONTAINER_*` 2종만 배제 — 포함/제외 기준 자체가 문서 내 미정의 | `guide-identifier-scan.ts` JSDoc (`collectCatalogCodes`) | `spec/5-system/3-error-handling.md §1.4` 카탈로그 표 | WARNING#1과 같은 planner 턴에서 §1.4 표기 정책(코드 vs 메시지-접두 구분 기준)을 함께 결정. 결정에 따라 `GUIDE_NON_EMITTED_VOCABULARY` 등록 내용도 재검토 대상 |
| 3 | plan_coherence | 라운드 9 "줄번호 인용 전수 정정"이 콜론(`파일:줄`) 형식만 훑어, 같은 파일 안 괄호/나열형 인용 2건을 놓침 — 현재 시점 기준 거짓 위치 정보 | `plan/in-progress/error-code-emission-axis.md:188` (`트래커 3404`), `:404-405` (`(3394)`, `(3404)`) | `plan/in-progress/spec-draft-nullable-notation-followups.md` — 실제 항목은 현재 `:3459`(구 `:3404`)/`:3422`(구 `:3386`)로 이동, 현재 `:3404` 자리엔 다른 항목이 위치 | `:188`을 라운드 9가 다른 5건에 쓴 것과 같은 앵커 문구(예: `` `CONTAINER_MISSING_EMIT`·`CONTAINER_MULTIPLE_EMIT` 도 방출 코드가 아니다 ``)로 교체. `:404-405`는 과거형 이력 서술이라 필수는 아니나 고친다면 동일 방식 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec, convention_compliance | `guide-identifier-existence.test.ts`(+`guide-identifier-scan.ts`) 가드 패밀리가 `user-guide-evidence.md §2` build-time 가드 표(현재 3건: `impl-anchor-existence`/`integrations-coverage`/`triggers-coverage`)에 미등재 (grep 0건) | `spec/conventions/user-guide-evidence.md §2` | planner가 §2 표에 4번째 행 추가 (별건, 급하지 않음). 이미 트래커에 등재된 사안, 재발견 아님 |
| 2 | rationale_continuity | "허용목록 없음" 원칙(`#1330`)의 2차 번복(`GUIDE_NON_EMITTED_VOCABULARY`)이 code JSDoc·plan 양쪽에 계보는 명시됐으나 spec `## Rationale` 착지는 아직 미래 과제 (위치도 미결: `user-guide-evidence.md` 확장 vs 신설 절) | `guide-identifier-scan.ts` JSDoc, `plan/in-progress/spec-draft-nullable-notation-followups.md` (~3259-3308) | 다음 planner 턴에서 WARNING#1·#2 택일과 함께 1·2차 번복 계보를 `## Rationale`로 이관 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | `spec/conventions/` 델타 0, 신규 충돌 없음. `CONTAINER_*` spec 6파일 drift + §1.4 카탈로그 정책 공백은 known-open, 이미 트래커 등재 |
| rationale_continuity | LOW | `spec/` 전체 델타 0이라 "기각된 대안 재도입" 발생 자리 없음. §1.4 구조적 불일치는 9라운드째 상태 불변(known-open). 허용목록 2차 번복은 계보 명시로 무근거 아님 |
| convention_compliance | NONE | 신규 CRITICAL/WARNING 없음. `error-codes.md`·`review-citations.md`·i18n 페어·역할 경계 전부 준수 확인. 라운드 9가 직전 라운드 INFO(오기 표기) 해소 |
| plan_coherence | LOW | 핵심 결정 축은 새 결함 없음. 라운드 9 "전수 판정"이 콜론 형식만 훑어 같은 파일 내 괄호형 인용 2건 누락 |
| naming_collision | NONE | 신규 식별자 전수 grep, 실질 충돌 0건. 과거 지적(`staleEntries`)은 `staleGuideEntries`로 개명되어 이미 해소 확인 |

## 권장 조치사항
1. (BLOCK 해소 우선 — 해당 없음, BLOCK:NO)
2. planner 턴에서 WARNING#1·#2를 한 번에 처리: `3-error-handling.md §1.4` 카탈로그 정책(코드 vs 메시지-접두 구분 기준) 결정 → 그 결정에 따라 spec 6파일(`4-execution-engine.md`, `0-canvas.md`, `2-edge.md`, `0-common.md`, `7-map.md`, `9-foreach.md`) 표기 정정 또는 §1.4 backfill.
3. 같은 planner 턴에서 INFO#2(허용목록 원칙 1·2차 번복 계보)를 spec `## Rationale`로 이관하고, INFO#1(`guide-identifier-*` 가드 패밀리)을 `user-guide-evidence.md §2` 표에 등재.
4. developer 턴(선택, 급하지 않음)에서 WARNING#3 — `error-code-emission-axis.md:188`, `:404-405`의 괄호형 스테일 인용을 앵커 문구로 교체.