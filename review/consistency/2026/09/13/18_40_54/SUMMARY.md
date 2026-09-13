# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 success, 전문 확보 완료)

## 전체 위험도
**MEDIUM** — CRITICAL 없음. WARNING 3건 중 2건은 이번 impl-prep 세션의 consistency-check 인프라 자체 갭(SoT 문서 예산 초과 누락), 1건은 이번 작업 범위 밖 spec 문서군의 기존 drift(메시지-접두 vs 구조화 error.code 혼동) 후속 권고. target(`error-code-emission-axis` plan, `spec_impact: none`)의 실제 변경 범위(harness 가드 + guide mdx 문장 정정)는 착수해도 무방.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — Critical 자체가 없으므로 인계 대상 없음. 단, 아래 WARNING #2·#3 은 근본적으로 `spec/` 문서(4-nodes, 5-system) 수정을 요구하므로 실제 착수 시점에는 `project-planner` 소관이 될 사안임을 참고로 남긴다(BLOCK 사유는 아님).

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, convention_compliance | consistency-check 프롬프트 번들이 컨텍스트 예산 초과로 이번 작업의 SoT 문서(`error-codes.md`, `user-guide-evidence.md`)를 본문 생략시킴 — `--impl-prep` 모드에서도 재현(기존엔 `--spec` 한정 결함으로 기록됨). 두 checker 모두 직접 `Read`로 우회해 실제로는 충돌 없음을 확인했으나, 우회하지 않았다면 거짓 "충돌 없음" 판정이 나갈 뻔했다 | `_prompts/{cross_spec,convention_compliance}.md` "컨텍스트 예산 초과로 생략된 파일 268개" 목록 | `spec/conventions/error-codes.md`(17,742자), `spec/conventions/user-guide-evidence.md` | 번들러가 plan 본문/헤더 주석에 명시된 "SoT: …" 경로를 알파벳 순보다 우선 적재하도록 정렬 로직 변경을 harness 백로그에 등재 검토(`feedback_consistency_spec_mode_budget.md` 갱신 또는 `--impl-prep` 전용 후속 항목 분리) |
| 2 | cross_spec | `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 이 "메시지"인지 "코드"인지 spec 영역마다 표기가 갈린다 — 이번 plan(§D)이 가이드 mdx 에서 바로잡으려는 것과 **같은 결함 클래스**가 conventions 밖 spec 문서에 잔존 | `spec/4-nodes/1-logic/9-foreach.md §6` 열 제목 "메시지 / 코드"(모호), `spec/4-nodes/1-logic/0-common.md`·`spec/3-workflow-editor/{0-canvas,2-edge}.md`·`spec/5-system/4-execution-engine.md §3.0`(무구분 서술) | `spec/4-nodes/1-logic/{3-loop,7-map}.md §6`(정확히 "메시지"로 표기), `spec/5-system/3-error-handling.md §1.4`(같은 상황을 `RESERVED_VARIABLE_NAME` 행에서 명시 각주로 처리한 선례) | 이번 PR 스코프 확장은 불필요. 완료 후 별도 plan 항목으로 (a) `9-foreach.md §6` 열 제목을 "메시지"로 통일, (b) `3-error-handling.md §1` 또는 `execution-engine.md §3.0`에 `RESERVED_VARIABLE_NAME`과 동형의 각주("CONTAINER_* 4종은 message-prefix, 구조화 error.code 없음") 추가를 등재 |
| 3 | rationale_continuity | plan §D의 "가이드가 «코드»라고 적은 것이 코드가 아니다"라는 전제가, `§1.4`가 이미 앵커 없는 엔진 수준 코드 6종(`MAX_ITERATIONS_EXCEEDED` 등, 실측상 방출 형태가 `CONTAINER_MISSING_EMIT`와 동형)을 정식 카탈로그 항목으로 취급해 온 기존 관행과 암묵적으로 어긋난다 | `plan/in-progress/error-code-emission-axis.md §D` | `spec/5-system/3-error-handling.md §1.4`(카탈로그 표 머리말 — "나머지 7종은 앵커 없는 맨 문자열") | (a) §D 결론(문장만 정정, 동작 불변)은 유지하되 서술을 "코드가 아니다" 대신 "§1.4 형태의 앵커-없는 엔진 수준 코드, error.code 필드로는 방출 안 됨"으로 정정. (b) `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT`을 §1.4 카탈로그에 형제 6종과 나란히 backfill 등재하는 것을 별도 체크리스트 항목으로 남길 것(엔진 동작 변경 아닌 문서 완결성 pass) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | `GUIDE_NON_EMITTED_VOCABULARY`는 `#1330` "허용목록 없음" 원칙의 두 번째 번복(`GUIDE_EXTERNAL_VOCABULARY`에 이어). plan §C는 두 목록이 서로 다른(정반대) 축을 덮는다는 것을 정확히 자기진단함 | `guide-identifier-scan.ts` 신규 선언부 | 선언부 주석에 "`GUIDE_EXTERNAL_VOCABULARY` 도입 시 번복한 `#1330` 원칙의 두 번째 적용"이라는 계보 한 줄 추가 |
| 2 | naming_collision | `GUIDE_NON_EMITTED_VOCABULARY`와 `GUIDE_EXTERNAL_VOCABULARY`는 이름이 한 토큰만 다르고 제약은 정반대(있을 것 vs 없을 것) — 실질 충돌은 grep 0건으로 없으나 대조표가 지금 plan 문서에만 있음 | `guide-identifier-scan.ts` | 구현 시 `GUIDE_EXTERNAL_VOCABULARY` JSDoc 옆에 plan §C의 대조표를 그대로 이식 — plan이 `complete/`로 이동하면 근거가 사라지므로 |
| 3 | plan_coherence | `guide-identifier-scan.ts`의 `lastIndex` 리셋 보일러플레이트 중복(기존 4곳, `spec-draft-nullable-notation-followups.md` WARNING#2가 "새 축 추가 시 다섯 번째를 빠뜨릴 표면이 늘어난다"고 예견)이, 이번 방출 축 추가로 정확히 실현된다. 어느 plan 체크리스트에도 교차 기록 안 됨 | `guide-identifier-scan.ts:258,263,274,277,296,300,338,345,353` | `error-code-emission-axis.md` 체크리스트의 "뮤테이션 — 술어를 지우면 RED인가" 항목에 "새 스캔 함수의 lastIndex 리셋 누락 뮤턴트" 명시 포함 + 완료 시 `spec-draft-nullable-notation-followups.md`의 "4곳" 숫자 갱신을 교차 기록(merge 단계 반영) |
| 4 | naming_collision | `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT`이 정식 에러 코드처럼 backtick 인용된 7개 spec 문서(`0-common.md`·`7-map.md`·`9-foreach.md`·`3-loop.md`·`2-edge.md`·`0-canvas.md`·`4-execution-engine.md`)와의 drift는 target 이전부터 있던 것이며 이번 target이 만들지도 건드리지도 않음 | 위 7개 spec 문서 | §D가 예고한 (B)(엔진 전용 코드 방출) 착수 시, 기존 이름 재사용 여부를 `error-codes.md §2`(rename=breaking) 정책에 비추어 먼저 판단할 것을 후속 plan에 남겨 둘 가치 있음 |
| 5 | convention_compliance | `cafe24-api-catalog/_overview.md §2`의 `id` 컬럼 정의("`<resource>_<verb>`")에서 `<resource>`가 "카탈로그 파일 대표 resource"인지 "Cafe24 API 경로 그룹명"인지 정의문만으로 안 갈림(실제 표는 후자로 일관) | `spec/conventions/cafe24-api-catalog/_overview.md §2` | `<resource>`는 endpoint가 속한 Cafe24 API 경로 그룹명이며 카탈로그 파일 대표 resource와 다를 수 있다는 문장 추가 |
| 6 | convention_compliance | 카탈로그 최상위 index 파일(`category.md`/`store.md`/`translation.md` 등)이 Overview/Rationale 섹션 없이 표만 담음 — 일관된 패턴이라 의도된 설계로 보이나 명문화된 예외 규정 없음 | 위 파일들 구조 | `_overview.md` 또는 CLAUDE.md에 "카탈로그 index 파일은 3섹션 구조 예외" 한 줄 명문화(조치 불필요, 참고용) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | MEDIUM | target 자체는 spec 직접 모순 없음(`spec_impact: none` 타당). 단 (a) 프롬프트 번들이 SoT 문서 2건을 예산 초과로 누락, (b) 이번 작업이 고치는 결함 클래스(메시지 vs 코드 혼동)가 다른 spec 문서 7곳에 잔존 |
| rationale_continuity | LOW | §D 결론(가이드 문장만 정정)은 유지 가능하나 "코드 아니다"라는 서술이 §1.4 기존 카탈로그 관행과 어긋남. AST 축 폐기·MAKESHOP 인용·"존재 vs 방출" 신규 축 도입은 모두 정당 |
| convention_compliance | LOW | frontmatter·명명·문서구조 규약 위반 없음(CRITICAL/WARNING 0). 번들 예산 갭 1건(WARNING), 문서 명확성 INFO 2건 |
| plan_coherence | LOW | plan이 인접 미해결 결정(cafe24/makeshop 카탈로그 등재, 양방향 가드)을 올바르게 범위 밖으로 유지. lastIndex 리셋 5번째 복제 지점 교차기록 누락(INFO) |
| naming_collision | LOW | 신규 식별자 `GUIDE_NON_EMITTED_VOCABULARY`·`ACTION_ROW` 전수 grep 결과 실질 충돌 0건. 자매 목록 이름 유사성·CONTAINER_* spec drift는 참고용 |

## 권장 조치사항
1. (착수 가능) target(`error-code-emission-axis`) 그대로 착수 — CRITICAL 없음, `spec_impact: none` 판단 타당.
2. 구현 시 `guide-identifier-scan.ts`의 `GUIDE_NON_EMITTED_VOCABULARY` 선언부에 plan §C 대조표 + `#1330` 계보 한 줄 이식(WARNING 아님, plan 소실 대비).
3. 새 방출-축 스캔 함수에 `lastIndex` 리셋 누락 뮤테이션 테스트 포함, 완료 시 `spec-draft-nullable-notation-followups.md`의 "4곳" 표기 갱신 교차 기록.
4. 별도 후속 plan(이번 PR 범위 밖)으로 `spec/4-nodes/1-logic/9-foreach.md §6` 열 제목 통일 + `spec/5-system/3-error-handling.md §1.4`에 `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` backfill 등재, 그리고 plan §D 서술을 "앵커 없는 카탈로그 코드"로 정정하는 것을 검토.
5. (harness 백로그) `--impl-prep` 컨텍스트 번들이 plan 헤더에 명시된 SoT 문서를 우선 적재하도록 정렬 로직 개선 검토.