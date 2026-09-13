# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 CRITICAL 0건. 모든 발견은 WARNING/INFO 수준이며, 근본 원인은 모두 `spec/` 쓰기 권한 밖(developer 스코프 외) 또는 이미 planner 트래커에 등재된 known-open 항목이다.

## 전체 위험도
**LOW** — cross_spec/rationale_continuity/convention_compliance/naming_collision 은 LOW, plan_coherence 는 NONE. 5개 checker 모두 CRITICAL 없음.

## Critical 위배 (BLOCK 사유)

(없음 — 5개 checker 전원 CRITICAL 0건)

## planner 인계 (권한 밖 Critical)

> Critical 이 없으므로 이 표는 해당 없음. 다만 아래 WARNING 다수가 근본적으로 `spec/` 쓰기
> 권한 밖(developer 스코프 외) 항목이며, 전부 `plan/in-progress/spec-draft-nullable-notation-followups.md`
> 에 planner 소유 항목으로 **이미 등재**돼 있어 재등록이 불필요함을 checker 들이 확인했다.

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` — 가이드는 "코드 아님"으로 정정했는데 spec 6파일은 여전히 에러 코드로 서술 | `logic{,.en}.mdx`, `guide-identifier-scan.ts` `GUIDE_NON_EMITTED_VOCABULARY` | `spec/5-system/4-execution-engine.md:332-333`, `spec/3-workflow-editor/2-edge.md:202`, `spec/3-workflow-editor/0-canvas.md:636`, `spec/4-nodes/1-logic/0-common.md:83`, `7-map.md:179-180`, `9-foreach.md:209-210` | planner 턴에서 6파일을 `3-loop.md` 형태(발행 문자열 전문 인용)로 통일하거나 "메시지 접두" 표기 명시. 이미 `spec-draft-nullable-notation-followups.md` 등재, 재등록 불요. 이 PR 비차단 |
| 2 | cross_spec | `3-error-handling.md §1.4` "앵커 없는 코드" 7종이 카탈로그 등재 여부로 "코드/메시지접두"를 실질 구분하지만 §1.4 자체엔 그 축이 명시 안 됨 | `guide-identifier-scan.ts` `collectQuotedLiterals`/`collectMessagePrefixes` JSDoc | `spec/5-system/3-error-handling.md §1.4` (`MAX_ITERATIONS_EXCEEDED` 등) | (a) `CONTAINER_*` §1.4 backfill 또는 (b) 앵커-없는 행에 "메시지 접두" 표기 추가. 이미 등재, 재등록 불요 |
| 3 | rationale_continuity | 위 1·2 와 동일 모순 — Rationale 계보 관점, 3라운드 연속 known-open, 이번 라운드 상태 불변 | `logic.mdx:114`, `logic.en.mdx:103`, plan §D | `spec/5-system/3-error-handling.md §1.4` 머리말 vs 표 | 직전 라운드 제안 유지 (a)/(b) 택일. spec 자체가 이번 diff 로 수정되지 않아 "기각 대안 재도입" 없음 |
| 4 | convention_compliance | "발행 축" 하네스(`GUIDE_EXTERNAL_VOCABULARY`/`GUIDE_NON_EMITTED_VOCABULARY`)가 `user-guide-evidence.md` 동형 자매 하네스와 달리 `spec/conventions/` 에 대응 SoT 문서 없음 | `guide-identifier-scan.ts` 전역 | `spec/conventions/user-guide-evidence.md` §2 (자매 3건은 등재, 이 가드는 미등재) | planner 트래커 처리 시 `error-codes.md` 또는 신설 문서에 존재/발행 2축 하네스를 SoT 로 승격 권고. 최소 `error-codes.md` §1 각주 추가 |
| 5 | naming_collision | 신규 `staleEntries`(test-local, non-export)가 기존 `internal-package-registration-guard.ts` 의 export `staleEntries` 와 동명, 시그니처 상이 | `guide-identifier-existence.test.ts:64-69` | `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration-guard.ts:129` | (a) 신규 쪽 `staleGuideEntries` 로 개명 (권장, 최소 수정) 또는 (b) 제네릭으로 통합 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `PROJECT.md` 의 SoT 참조(`user-guide-evidence.md §2`)가 가리키는 절에 `guide-identifier-existence.test.ts` 가 없음 (선재 상태, 이 diff 로 악화 안 됨) | `PROJECT.md` | planner 턴에서 §2 표·`code:` frontmatter 에 4번째 가드로 추가 또는 SoT 참조 정정 |
| 2 | rationale_continuity | `GUIDE_NON_EMITTED_VOCABULARY` 신설(허용목록 없음 원칙의 2번째 번복)이 spec Rationale 등재 대상 트래커 항목에서 "이름으로" 지목 안 됨(1번째 번복만 지목) | `spec-draft-nullable-notation-followups.md` ~line 3255-3290 | 해당 트래커 항목 문구에 `GUIDE_NON_EMITTED_VOCABULARY` 를 2번째 번복 사례로 명시 추가 |
| 3 | plan_coherence | `user-guide-evidence.md §2` 미등재 백로그 3라운드째 누적, developer 권한 밖이라 위반 아님 | 위 WARNING#4 와 동일 대상 | 조치 불요, pending 처리 시 자동 반영 |
| 4 | plan_coherence | 트래커 L3404 (`CONTAINER_MISSING_EMIT`/`MULTIPLE_EMIT`) 해소 라운드 3 이후 유효, 재확인 | `logic.mdx`/`.en.mdx` | 조치 불요 |
| 5 | plan_coherence | spec 6파일·§1.4 택일 항목이 여전히 `spec/conventions/` 스코프 밖이며 이번 라운드 미침범 | (해당 없음) | 조치 불요 |
| 6 | convention_compliance | 인용 형식 `review-citations.md` §2/§3 정확 준수 (위반 아님, 준수 사례) | `guide-identifier-scan.ts`/`.test.ts` 전역 인용 | 없음 |
| 7 | convention_compliance | 등록 토큰 3종 명명 `error-codes.md` §1 규율과 정합 (§1 적용범위 밖이라 위반도 아님) | `GUIDE_NON_EMITTED_VOCABULARY` 등록 3종 | 없음 |
| 8 | convention_compliance | spec 경계 준수 — developer 가 카탈로그 backfill 여부를 직접 결정 않고 트래커 위임 | `error-code-emission-axis.md` §impl-prep | 없음 |
| 9 | naming_collision | 등록 토큰 3종은 신규 발급이 아니라 기존 문자열 재등재, `error-codes.md` §3/§4 카탈로그와 이름 미충돌 | `GUIDE_NON_EMITTED_VOCABULARY` 등록 3종 | 없음 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | spec 6파일 + §1.4 의 "코드 vs 메시지접두" 서술 불일치, 이미 planner 트래커 등재된 known-open, 이 PR 비차단 |
| rationale_continuity | LOW | 동일 불일치를 Rationale 계보로 재확인(3라운드 연속 무변화 이월), `GUIDE_NON_EMITTED_VOCABULARY` 는 근거 명시된 정상 번복 |
| convention_compliance | LOW | `spec/conventions/` 델타 0, 규약 위반 없음. "발행 축" 하네스가 SoT 문서 부재라는 구조적 공백만 WARNING |
| plan_coherence | NONE | 신규 커밋은 가드 코드+자기 plan 파일만 수정, 3개 INFO 모두 재확인·조치 불요 |
| naming_collision | LOW | 신규 spec ID/API/이벤트 없음. `staleEntries` 동명이지만 시그니처 상이(실질 충돌 아님, 개명 권장) |

## 권장 조치사항
1. (선택, 비차단) `guide-identifier-existence.test.ts:64-69` 의 신규 `staleEntries` 를 `staleGuideEntries` 로 개명해 `internal-package-registration-guard.ts` 의 동명 export 함수와의 혼동 제거.
2. (planner 턴, 이미 등재됨) `spec-draft-nullable-notation-followups.md` 처리 시 (a) spec 6파일의 `CONTAINER_*` 서술을 `3-loop.md` 형태로 통일, (b) `3-error-handling.md §1.4` 앵커-없는 코드 표기 택일, (c) `GUIDE_NON_EMITTED_VOCABULARY` 를 2번째 번복 사례로 트래커 문구에 명시 추가.
3. (planner 턴, 낮은 우선순위) `user-guide-evidence.md §2` 표·`code:` frontmatter 에 `guide-identifier-existence.test.ts`/`guide-identifier-scan.ts` 를 4번째 가드로 등재하거나 `PROJECT.md` SoT 참조 정정.
4. 이 PR 은 위 항목 어느 것도 착수 조건이 아니므로 현재 상태로 push 가능.