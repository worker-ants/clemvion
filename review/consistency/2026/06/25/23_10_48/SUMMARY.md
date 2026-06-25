# Consistency Check 통합 보고서 (impl-done)

**BLOCK: NO** — Critical 발견 없음. 차단 사유 없음.

> **WARNING 2건 처분 (main 보강)**:
> - **W1 (plan 체크박스·README 미갱신)** = **false positive**. checker 가 git baseline(미커밋 시점)을 읽어 `[ ]` 로 봤으나, 실제로는 커밋 **17d36fb0** 이 정확히 권고대로 갱신 완료 — m-3 `[x]` 완료(커밋·검증·배치 결정·`useDraftRestore` 미구현 명기), README 03행 완료 5→6·잔여 9→8, 합계 66/22. `git show HEAD:plan/...` 으로 반증됨. (memory `consistency_check_main_baseline_fp` 패턴.)
> - **W2 (openOAuthPopup DRY)** = impl-prep W1 과 동일한 **의도된 scope 결정**(use-oauth-popup-return.ts 내 module-private 유지로 `[id]/open-oauth-popup.ts` 충돌 회피, `[id]` 통합은 후속 PR). checker 도 "m-3 scope 밖이면 후속 태스크" 인정. impl-prep SUMMARY·RESOLUTION 문서화.

## 전체 위험도
**LOW** — WARNING 2건(위 처분) 모두 구현 정확성·spec 준수에 영향 없음.

## Critical 위배 (BLOCK 사유)
해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | 처분 |
|---|---------|------|------|
| 1 | Plan Coherence | m-3 `[ ] 미착수`·README 미동기화 | **false positive** — 커밋 17d36fb0 이 `[x]`·README 66/22 로 갱신 완료(checker 는 미커밋 baseline 조회). |
| 2 | Naming Collision | `openOAuthPopup` module-private vs `[id]/open-oauth-popup.ts` DRY | 의도된 scope 결정(impl-prep W1) — `[id]` 통합 후속 PR. |

## 참고 (INFO) — 처분

| # | Checker | 항목 | 처분 |
|---|---------|------|------|
| 1 | Cross-Spec | `OAuthCallbackPayload.mode` spec §9.2 `request-scopes`(하이픈) vs 코드 `request_scopes`(언더스코어) | **사전존재** 혼용(m-3 미도입) — planner spec-sync 후속. |
| 2 | Cross-Spec | `integrationPreviewId`(spec §3.5) vs `previewToken`(코드/§9.2) | **사전존재** — planner spec-sync 후속. |
| 3 | Rationale | 컴포넌트 라우트-로컬 배치(impl-prep I1) | 완료 기록에 명기됨(17d36fb0). |
| 4 | Rationale | `useUnsavedChangesWarning` 명명이 §3.6 행위 정확 반영 | 변경 불필요. |
| 5 | Rationale | `openOAuthPopup` module-private(impl-prep W1) | 변경 불필요. |
| 6·7 | Convention | `"use client"` peer 패턴 준수 | 변경 불필요. |
| 8·9 | Plan Coherence | impl-prep I1 배치·`useDraftRestore` 미구현 기록 | 17d36fb0 에 명기됨. |
| 10·11 | Naming | `OAuthCallbackPayload`·`AuthStepProps`/`TestStepProps` 충돌 없음 | 조치 불필요. |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | 신규 spec 모순 없음. 기존 표기 혼용 2건(INFO). |
| Rationale Continuity | NONE | invariant 보존. plan 용어 차이 3건 INFO. |
| Convention Compliance | NONE | 규약 위반 없음. peer 패턴 준수. |
| Plan Coherence | LOW | 체크박스/집계표 — 커밋 17d36fb0 으로 해소(checker baseline FP). |
| Naming Collision | LOW | openOAuthPopup DRY — 의도된 scope 결정. |

**최종: BLOCK: NO — 구현 완료 정합 확인.**
