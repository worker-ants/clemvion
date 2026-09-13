# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 모두 전문 확보(success), CRITICAL 발견 0건. WARNING 3건 중 2건은 라운드 1·2 부터 3라운드 연속 동일 상태로 확인된 known-open 항목이며 이미 planner 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md`)에 등재·위임 완료 상태.

## 전체 위험도
**LOW** — 이번 배치는 `spec/conventions/**` 델타 0(코드 전용: `guide-identifier-scan.ts`·`guide-identifier-existence.test.ts`·`logic.mdx`·`logic.en.mdx`)이며, 신규 위반·신규 충돌 없음. 발견된 WARNING 3건 모두 차단 사유 아님.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

> 해당 없음 — 이번 라운드에서 CRITICAL 로 판정된 항목이 없다.

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| — | — | — | — | — |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, rationale_continuity | `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 는 구조화된 에러 코드가 아니라 일반 `Error` 메시지 접두인데(`execution-engine.service.ts:7121,7125,7130`, `.code` 필드 없음), 6개 spec 문서가 여전히 이를 정식 에러 코드처럼 서술하고, `spec/5-system/3-error-handling.md §1.4` 는 형태가 동일한 다른 6종(`MAX_ITERATIONS_EXCEEDED` 등)을 "앵커 없는 카탈로그 코드"로 등재하는 관행을 유지 | `codebase/frontend/src/content/docs/02-nodes/logic.mdx:114`, `logic.en.mdx:103` (이번 PR 이 "코드 아님"으로 정정한 문장) | `spec/5-system/4-execution-engine.md:332-333` §3.0, `spec/3-workflow-editor/2-edge.md:202` §6.1, `spec/3-workflow-editor/0-canvas.md:636` §11.2.2, `spec/4-nodes/1-logic/0-common.md:83`, `7-map.md:179-180`, `9-foreach.md:209-210`, `spec/5-system/3-error-handling.md §1.4` 머리말 | 3라운드 연속 상태 불변 — 신규 조치 불요. `plan/in-progress/spec-draft-nullable-notation-followups.md:3382-3462` 에 이미 등재된 planner 택일((a) §1.4 backfill vs (b) 6파일 anchor-less 표기 정정, 선례=`3-loop.md:189-191`)로 다음 planner 턴에서 처리 |
| 2 | convention_compliance | `review-citations.md §2` "bare `hh_mm_ss` 금지" 위반 — 같은 파일 인접 인용은 전부 전체 경로 형태(`review/code/2026/09/13/19_23_22`) | `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:289` — `` `19_51_33` maintainability WARNING#4 `` | `spec/conventions/review-citations.md §2` 표(날짜 없는 시각 인용 금지) | `19_51_33` → `review/code/2026/09/13/19_51_33` 로 정정 (gate 없음, 리뷰 시점 수정 권장) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec, convention_compliance | `PROJECT.md` 의 SoT 인용이 실제로 `guide-identifier-existence.test.ts` 를 다루지 않는 절을 가리킴 (pre-existing, 이 PR 이 만든 결함 아님) | `PROJECT.md:300` ↔ `spec/conventions/user-guide-evidence.md §2`(표에 3건만 등재, `guide-identifier-*` 없음) | 별건 후속: SoT 표에 4번째 행 추가 또는 `PROJECT.md` 태그 정정 |
| 2 | rationale_continuity | `#1330`/`#1331` "허용목록 없음→도입" 번복 계보가 코드 주석에만 있고 spec `## Rationale` 어디에도 없음 (상태 불변, 이미 트래커 등재) | `guide-identifier-scan.ts` JSDoc | `spec-draft-nullable-notation-followups.md` 처리 턴에서 `user-guide-evidence.md` Rationale 에 존재/방출 두 축 배경 명문화 |
| 3 | plan_coherence | `user-guide-evidence.md §2.1` 미등재 백로그가 이번 배치(발행 축 추가)로 한 겹 더 벌어짐 — developer 권한 밖이라 미처리는 정당 | `spec/conventions/user-guide-evidence.md §2` | 조치 불요 — 재등재 시 planner 가 코드 재확인하면 자동 반영 |
| 4 | plan_coherence | 트래커 L3404(`CONTAINER_MISSING_EMIT`/`MULTIPLE_EMIT`) 해소 확인이 라운드 3 에서도 유효 | `plan/in-progress/spec-draft-nullable-notation-followups.md:3403-3408` | 재확인 완료, 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | `CONTAINER_MISSING_EMIT`/`MULTIPLE_EMIT` 코드-아님 정정 vs 6개 spec 파일 서술 불일치(3라운드 연속, 트래커 등재 완료) + PROJECT.md SoT INFO |
| rationale_continuity | LOW | §1.4 앵커 없는 카탈로그 관행과 가이드 "코드 아님" 서술 간 known-open 불일치(상태 불변); `#1330` 원칙 번복은 정당(계보 명시) |
| convention_compliance | LOW | `review-citations.md §2` bare-timestamp 위반 1건; PROJECT.md SoT 부정확(pre-existing) |
| plan_coherence | NONE | 대상 커밋이 `plan/**`·`spec/**` 미변경, 미해결 결정과의 충돌·선행 plan 미해소·후속 누락 모두 없음 |
| naming_collision | NONE | 신규 식별자 전수 grep 결과 충돌 없음, 등록 토큰 3종은 기존 문자열 재등재 |

## 권장 조치사항
1. (선택, 비차단) `guide-identifier-existence.test.ts:289` 의 bare `19_51_33` 인용을 `review/code/2026/09/13/19_51_33` 전체 경로로 정정.
2. (별건, planner 턴) `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이미 등재된 두 택일 항목 — (a) `spec/5-system/3-error-handling.md §1.4` backfill 또는 (b) 6개 spec 파일의 `CONTAINER_MISSING_EMIT`/`MULTIPLE_EMIT` 표기를 `3-loop.md` 선례대로 "메시지 접두 전문" 형식으로 통일 — 처리.
3. (별건, 비차단) `PROJECT.md:300` SoT 태그와 `user-guide-evidence.md §2` 표의 불일치를 다음 관련 편집 세션에서 정정.