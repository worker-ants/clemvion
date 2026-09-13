# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 CRITICAL 0건. 전문 확보 실패 checker 없음(5/5 success + 인라인 전문 확보).

## 전체 위험도
**LOW** — CRITICAL 없음. 신규 코드(harness 확장 + 가이드 문구 정정)는 규약·명명·plan 정합성을 해치지 않으나, 기존부터 이월 중인 spec 서술 불일치(6개 spec 파일이 `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT`를 구조화 에러 코드처럼 서술)와 이번 배치가 그 항목을 등재하며 남긴 두 가지 plan 위생 결함(WARNING)이 있다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT`는 메시지 접두일 뿐(구조화 코드 아님)로 이번 PR이 가이드에서 정정했는데, spec 6개 파일은 여전히 "…에러로 실행 실패/거부" 또는 표의 "코드" 열 값으로 서술해 구조화 에러 코드처럼 읽힌다 (known-open, 이 PR 비차단) | `spec/5-system/4-execution-engine.md:332-333` §3.0, `spec/3-workflow-editor/2-edge.md:202` §6.1, `spec/3-workflow-editor/0-canvas.md:636` §11.2.2, `spec/4-nodes/1-logic/0-common.md:83`, `spec/4-nodes/1-logic/7-map.md:179-180` §6, `spec/4-nodes/1-logic/9-foreach.md:209-210` §6 | `codebase/frontend/.../logic.mdx:114`/`logic.en.mdx:103` 정정 문구 + `guide-identifier-scan.ts`의 `GUIDE_NON_EMITTED_VOCABULARY` 등록(실측: `execution-engine.service.ts:7121·7125·7130·8016`은 일반 `Error` 메시지 접두일 뿐 `code` 필드 없음) | 재등록 불요 — `plan/in-progress/spec-draft-nullable-notation-followups.md`에 이미 planner 소유 항목(미체크)으로 6개 파일 전수 등재됨. 처분 형태는 `3-loop.md §6`이 이미 쓰는 패턴(열 헤더 "메시지" + 발행 문자열 전문 인용)으로 통일 권장 |
| 2 | cross_spec | `3-error-handling.md §1.4`의 "앵커 없는 코드" 축이 "메시지 접두 전용" vs "정상 앵커 없음"을 구분하지 않아, `MAX_ITERATIONS_EXCEEDED`(카탈로그 등재)와 구조적으로 동일한 `CONTAINER_MISSING_EMIT`(카탈로그 미등재)의 차이가 spec 본문에서 설명되지 않음 (known-open, 이 PR 비차단) | `spec/5-system/3-error-handling.md §1.4` | `guide-identifier-scan.ts`의 `isMessagePrefixOnly` 등 판정 로직(카탈로그를 "탈출구"로 사용) | 재등록 불요 — 같은 plan 트래커 항목(미체크)이 택일(a. `CONTAINER_*`를 §1.4에 backfill, b. 앵커-없는 행에 "메시지 접두" 표기 추가)을 이미 제시함 |
| 3 | plan_coherence | 신규 planner 항목이 겨냥한 spec 파일 6개 중 5개가 같은 문서의 `spec_impact` frontmatter에서 빠짐 — 이 문서 자신이 같은 실패를 이미 두 번 자백한 재발 클래스(세 번째 재발) | `plan/in-progress/spec-draft-nullable-notation-followups.md:3446-3458` (신규 항목) vs frontmatter `spec_impact:`(8~52행) | `spec/3-workflow-editor/2-edge.md`·`spec/3-workflow-editor/0-canvas.md`·`spec/4-nodes/1-logic/0-common.md`·`spec/4-nodes/1-logic/7-map.md`·`spec/4-nodes/1-logic/9-foreach.md` 5개가 목록에 없음(`spec/5-system/4-execution-engine.md`만 있음) | `spec_impact` 목록에 위 5개 경로 추가 — 방치 시 다음 `--spec`/`--impl-done` 라운드 번들 스코프에서 조용히 누락됨 |
| 4 | plan_coherence | 신규 §1.4 항목이 같은 절(`3-error-handling.md §1`)을 겨냥하는 기존 "묶어서 처리" 합의(같은 문서 3217-3227행, plan 3건이 §1 하위구조를 각자 제안 중이니 한 턴에 묶으라는 명시적 합의)를 인용하지 않고 네 번째 독립 택일로 등재됨 | `plan/in-progress/spec-draft-nullable-notation-followups.md:3467-3487` (신규 §1.4 항목) | 같은 파일 `:3217-3227`의 "같은 절을 겨냥하는 plan 이 셋이다 — 한 턴에 묶어라" 합의(대상: `spec-update-node-cancellation-shutdown-classification.md:632`, `keyset-cursor-uuid-validation.md:128`, 3208행 통합/LLM 코드 항목) — 둘 다 미해소 상태라 넷이 동시에 살아 있음 | 신규 §1.4 항목에 3217행 합의를 상호 링크하거나, "셋"을 "넷"으로 갱신 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec / convention_compliance | `PROJECT.md:300`의 SoT 꼬리표가 `user-guide-evidence.md §2`를 가리키지만 그 절은 `guide-identifier-existence.test.ts`를 나열하지 않음 (pre-existing, `origin/main` 시점부터, 이 PR 무관) | `PROJECT.md:300` vs `spec/conventions/user-guide-evidence.md §2`(Build-time 가드 3건만 등재) | 이 PR 범위 밖. 다음에 그 절을 편집하는 세션이 4번째 행 추가 또는 SoT 태그 정정 |
| 2 | convention_compliance | 존재/발행 2축 하네스(`GUIDE_EXTERNAL_VOCABULARY`·`GUIDE_NON_EMITTED_VOCABULARY`)가 "정식 규약" 수준으로 성숙했는데 `spec/conventions/**`에 대응 SoT 문서가 없음 (pre-existing, 3라운드 연속 동일 처분) | `guide-identifier-scan.ts` 전체 | 이 PR 범위에서 강제 불요(이미 위임됨). §1.4 backfill 택일이 해소되는 시점과 함께 승격 여부 결정 권고 |
| 3 | rationale_continuity | `GUIDE_NON_EMITTED_VOCABULARY` 신설은 `#1330` "허용목록 없음" 원칙의 두 번째 부분 번복이나, 코드 주석에 사유가 명시돼 은폐형 번복이 아님. 다만 이 원칙 자체가 spec `## Rationale`에 살고 있지 않음 | `guide-identifier-scan.ts` JSDoc | 조치 불필요. 향후 이 패턴이 굳어지면 근거를 spec `## Rationale`로 승격 고려 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | scope(`spec/conventions/`) 델타 0, CRITICAL 없음. WARNING 2건은 known-open이며 이미 planner 트래커(`spec-draft-nullable-notation-followups.md`)에 등재돼 이월 중 |
| rationale_continuity | NONE | spec `## Rationale` 기각 대안 재도입·설계 원칙 위반 없음. §1.4·`review-citations.md §4` 정확히 재확인·준수 |
| convention_compliance | LOW | 라운드 5 순증분(판정 정본 함수화) 규약 위반 없음. 재확인된 pre-existing 공백 2건(INFO)은 이 PR이 만들지 않음 |
| plan_coherence | LOW | spec 레벨 택일을 developer가 직접 결정하지 않고 planner 트랙 등재는 정상(CRITICAL 없음). 다만 등재 과정에서 frontmatter 동기화 누락 + 기존 "묶어라" 합의 미인용(WARNING 2건) |
| naming_collision | NONE | 누적 13개 신규 식별자 전수 grep — 다른 모듈과 동명 충돌 0건. 유일 과거 충돌(`staleEntries`)은 라운드 4에서 이미 해소, 라운드 5는 JSDoc 자기모순 문구만 정정 |

## 권장 조치사항
1. (BLOCK 해소 불요 — BLOCK: NO) 이번 PR 자체는 병합 차단 사유 없음.
2. `plan/in-progress/spec-draft-nullable-notation-followups.md`의 `spec_impact` frontmatter에 신규 항목이 겨냥한 5개 spec 경로(`2-edge.md`·`0-canvas.md`·`0-common.md`·`7-map.md`·`9-foreach.md`)를 추가할 것 — 세 번째 재발 방지.
3. 같은 문서의 신규 §1.4 항목을 3217-3227행 "같은 절 plan 셋 — 한 턴에 묶어라" 합의와 상호 링크하거나 "셋"→"넷"으로 갱신할 것.
4. (planner 턴 권고, 비차단) `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT`를 구조화 코드처럼 서술하는 spec 6개 파일과 `3-error-handling.md §1.4`의 "메시지 접두" 미구분을, 같은 절을 겨냥하는 다른 plan 3건과 함께 한 번의 planner 턴에서 §1 하위구조 정리 시 일괄 처리할 것.