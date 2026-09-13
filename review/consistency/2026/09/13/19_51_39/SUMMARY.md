# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 success, 전문 확보 완료, CRITICAL 발견 0건.

## 전체 위험도
**LOW** — `spec/conventions/` 델타 0(모든 checker 확인), 실제 diff(4 codebase 파일: `guide-identifier-scan.ts`/`.test.ts`/`logic{,.en}.mdx`)는 이미 planner 트래커에 등재된 known-open 항목(CONTAINER_MISSING_EMIT/MULTIPLE_EMIT spec-vs-가이드 서술 불일치)을 새로 만들지 않고 정확히 우회했으며, 신규로 지적할 사항은 규약(review-citations.md) 국소 위반 1건뿐.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — CRITICAL 발견 자체가 없어 인계 대상 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, rationale_continuity (중복 통합) | `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT`를 "코드 아님"으로 정정한 이번 가이드 문장과, 여전히 이를 구조화된 에러 코드처럼 서술하는 spec 6개 파일(`5-system/4-execution-engine.md:332-333`, `3-workflow-editor/{0-canvas:636,2-edge:202}.md`, `4-nodes/1-logic/{0-common:83,7-map:179-180,9-foreach:209-210}.md`)이 정면으로 어긋남 | `codebase/frontend/src/content/docs/02-nodes/logic.mdx:114`, `logic.en.mdx:103` | 위 6개 spec 파일 + `spec/5-system/3-error-handling.md §1.4`(앵커 없는 카탈로그 코드 관행) | 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md:3419` planner 항목으로 등재·위임됨. 신규 조치 불요 — 다음 planner 턴에서 (a) 6파일 서술 정정 또는 (b) §1.4 backfill 중 택일만 남음 |
| 2 | convention_compliance | `review-citations.md §2` 위반 — bare `hh_mm_ss` 인용(날짜 누락), 같은 파일 내 다른 4곳은 전체 경로로 정확히 인용 | `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:203` (`` `19_23_22` ``) | `spec/conventions/review-citations.md §2/§3` (codebase/** 적용 대상, bare 시각 명시 금지) | `` `19_23_22` `` → `` `review/code/2026/09/13/19_23_22` `` 전체 경로로 1줄 보강 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `CHANGELOG.md` Unreleased 항목이 라운드 2에서 스스로 반증한 "카탈로그 탈출구 덕에 `MAX_ITERATIONS_EXCEEDED` 통과" 서술을 그대로 남김(실제로는 소비자-인용 경로 때문) | `CHANGELOG.md` (커밋 `65256a109`) | 해당 단락을 `plan/in-progress/error-code-emission-axis.md §E` 의 실제 결론으로 교체 |
| 2 | cross_spec, plan_coherence (중복) | `PROJECT.md:300` SoT 꼬리표가 `user-guide-evidence.md §2`를 가리키나 그 표(3행)에 `guide-identifier-existence.test.ts` 없음 — PR 이전부터의 별건, 이번 PR이 악화 안 시킴 | `PROJECT.md:300` ↔ `spec/conventions/user-guide-evidence.md §2` | 이미 `spec-draft-nullable-notation-followups.md`에 (a) Overview 스코프 확장 vs (b) 신규 §6 택일 대기로 등재됨. 재등재 불요 |
| 3 | rationale_continuity | `#1330`(허용목록 없음)→`#1331`(번복) 계보가 코드 주석에만 있고 `spec/**`의 `## Rationale`에 없음 | `guide-identifier-scan.ts` JSDoc | 후속 planner 턴에서 `user-guide-evidence.md` `## Rationale`에 존재/방출 두 축 구분 명문화 |
| 4 | convention_compliance | 가이드 식별자 가드 family(`guide-identifier-*`)가 어떤 `spec/conventions/*.md`의 `code:`에도 미등재 | `guide-identifier-scan.ts` 최상단 SoT 주석 ↔ `user-guide-evidence.md §2` 표 | 후속으로 §2 표에 4번째 가드로 편입하거나 별도 spec 신설 |
| 5 | naming_collision | 신규 `MESSAGE_PREFIX`(비export)와 기존 `WC_MESSAGE_PREFIX`(export, 별개 패키지 `packages/web-chat-sdk`)가 부분 문자열로만 겹침 — 실질 충돌 아님 | `guide-identifier-scan.ts:263` ↔ `packages/web-chat-sdk/src/types.ts:52` | 조치 불요(선택적으로 `ERROR_MESSAGE_PREFIX`로 개명해 grep 노이즈 축소 가능) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | spec 델타 0. CONTAINER_*/코드 서술 불일치는 known-open+이미 위임(WARNING). CHANGELOG 자기반증 잔존(INFO). PROJECT.md SoT drift 별건(INFO) |
| rationale_continuity | LOW | §1.4 앵커없는 카탈로그 관행과 "코드 아님" 서술 충돌 지속하나 developer가 spec 미수정·planner 항목 2건으로 정확히 위임(WARNING, 신규 아님). 허용목록 원칙 계보가 spec Rationale 밖(INFO) |
| convention_compliance | LOW | conventions 델타 0. review-citations.md §2 bare 인용 국소 위반 1건(WARNING, 수정 용이). 가드 family spec 미등재(INFO, 기존 gap) |
| plan_coherence | NONE | 라운드1 WARNING(체크박스 미갱신) 해소 확인. 신규 비정합 0건. 미해결 결정 우회 방식 정상 |
| naming_collision | LOW | 신규 식별자 7종+라운드1 추가 `collectMatches` 전수 재확인, 충돌 0건. `MESSAGE_PREFIX` 부분일치는 실질 충돌 아님(INFO) |

## 권장 조치사항
1. (선택, 저비용) `guide-identifier-existence.test.ts:203`의 bare `19_23_22` 인용을 `review/code/2026/09/13/19_23_22` 전체 경로로 보강 — `review-citations.md §2` 정합화.
2. WARNING #1(CONTAINER_MISSING_EMIT/MULTIPLE_EMIT vs spec 6파일)은 이미 planner 트래커에 등재·위임되어 이번 PR을 막지 않음 — 다음 planner 턴에서 (a) spec 6파일 서술 정정 또는 (b) `§1.4` backfill 택일 시 처리.
3. INFO 항목들(CHANGELOG 자기반증 잔존, PROJECT.md SoT drift, Rationale 계보 공백, 가드 spec 미등재, MESSAGE_PREFIX 개명)은 이번 PR을 막을 사유 아님 — 후속 세션에서 반영 권장.
