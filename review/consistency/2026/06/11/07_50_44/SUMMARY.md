# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다

## 전체 위험도
**CRITICAL** — Plan 의 미결 정책 결정을 plan 합의 없이 spec 이 단독 확정; 차단 해소 전 spec 변경 커밋 금지

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Plan Coherence | `kb-model-change-reembed-followup.md` 가 "착수 전 project-planner spec 선갱신 의무 + 세 선택지 모두 미결"로 명시 유보한 상태에서, target spec 이 plan 합의 없이 선택지 ③(배너 강화)을 구현 명세 수준으로 확정·서술 — plan→spec 단일 진실 원칙의 역방향 우회 | `spec/2-navigation/5-knowledge-base.md` §2.4.1 "검색 불가 배너" 신규 단락 + `## Rationale §R-3` | `plan/in-progress/kb-model-change-reembed-followup.md` — "검토할 선택지 (비용·UX 정책 결정 필요)" 절, 어느 선택지도 결정 미기재 | (권장) `kb-model-change-reembed-followup.md` 에 `## 결정` 절 추가, 선택지 ③ 채택을 명기한 뒤 spec 변경을 그 결정의 산출물로 재처리. (대안) plan 의 "착수 전 spec 선갱신 의무" 체크박스에 consistency-check --spec BLOCK:NO 결과를 등재 |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Plan Coherence | 동일 파일(`spec/2-navigation/5-knowledge-base.md`) 의 frontmatter 를 active OPEN PR `kb-unsearchable-groom-cbe34e` 가 `status: implemented` + `pending_plans` 제거 방향으로 변경 중 — merge 시 frontmatter 충돌 확실 | `spec/2-navigation/5-knowledge-base.md` frontmatter (`status`, `pending_plans` 필드) | `kb-unsearchable-groom-cbe34e` 브랜치 커밋 `a696281d` — 같은 필드를 반대 방향으로 변경 | 두 브랜치 merge 순서 사전 조율. target 이 먼저 merge 되면 groom 브랜치 rebase 후 `status: partial` 유지·본문 보존 필요. groom 브랜치가 먼저 merge 되면 target rebase 전에 충돌 처리 |
| 2 | Convention Compliance | `POST /api/knowledge-bases/:id/documents/:docId/re-embed` 및 `POST /api/knowledge-bases/:id/documents/:docId/re-extract` 가 `spec/5-system/2-api-convention.md §2.2` "중첩 2단계까지" 규칙 초과 — RPC-style sub-channel 예외 미해당 (`documents` 는 리소스 자체) | `spec/2-navigation/5-knowledge-base.md` §3 API 표 | `spec/5-system/2-api-convention.md §2.2` 중첩 제한 규칙 | `POST /api/knowledge-base-documents/:docId/re-embed` 형태로 최상위 분리, 또는 `docId` 를 body 파라미터로 2단계 이하 조정. 또는 규약 §2.2 에 "document action" 패턴을 sub-channel 예외로 명시 추가 |
| 3 | Convention Compliance | `## Overview` 섹션 누락 — CLAUDE.md 권장 3섹션(Overview / 본문 / Rationale) 에서 Overview 미존재 | `spec/2-navigation/5-knowledge-base.md` 문서 전체 구조 | CLAUDE.md "Spec 문서 3섹션 구성" 권장 | 문서 상단 또는 §1 앞에 `## Overview` 섹션 추가 — 기존 `> 관련 문서:` 인용줄을 재구성해 화면 목적·범위 1~3문장 요약 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `§3 API` 표의 `POST /api/knowledge-bases/:id/re-embed` 에 RBAC(editor) 및 Throttle(3회/분) 미기재 — 인접 행 및 `8-embedding-pipeline.md` Rationale 과 표기 비일관성 | §3 API 표 해당 행 | "editor, Throttle 3회/분" 추가로 표기 일관성 유지 |
| 2 | Cross-Spec | `POST /api/knowledge-bases/:id/documents/:docId/re-embed` 행에도 RBAC 미기재 | §3 API 표 해당 행 | 권한 명시 권장 (우선순위 낮음) |
| 3 | Cross-Spec | §2.4.1 배너의 X 버튼 유무 미명시 — `spec/0-overview.md §3.4` Inline Alert 원칙상 명시 dismiss 없이 자동 갱신 권고 | §2.4.1 검색 불가 배너 | 구현 시 §3.4 Inline Alert 생존 주기(X 버튼 없이 자동 갱신) 준수 확인 |
| 4 | Rationale Continuity | R-3 가 plan 문서를 근거 출처로 인용 — plan 이 `complete/` 로 이동해도 R-3 의 인라인 서술이 자급자족하므로 연속성 문제 없음 | `## Rationale §R-3` | plan complete 이동 후 링크 유효성 확인 (선택 사항) |
| 5 | Plan Coherence | `kb-model-change-reembed-followup.md` 의 `worktree: (unstarted)` 상태가 target 변경 이후에도 미착수 sentinel — spec 이 plan 결정 인용하며 순환 참조 구조 발생 | `plan/in-progress/kb-model-change-reembed-followup.md` frontmatter | plan 의 "비고" 절에 "선택지 ③ 이 spec §2.4.1·R-3 에 spec-draft 반영됨(kb-reembed-banner-ecfe2b PR). 착수 시 해당 spec 을 SoT 로 삼아 구현 착수 가능" 한 줄 추가 |
| 6 | Convention Compliance | `KB_REEMBED_IN_PROGRESS`, `KB_REEXTRACT_IN_PROGRESS`, `EMBEDDING_PROBE_FAILED` 에러 코드 — `UPPER_SNAKE_CASE` 및 의미 기반 명명 규약 준수 확인 | §3 API 표 | 없음 (현행 유지) |
| 7 | Convention Compliance | frontmatter `status: partial` + `pending_plans` 기재 — `spec/conventions/spec-impl-evidence.md §3` 요건 충족 확인 | frontmatter | 없음 |
| 8 | Naming Collision | 신규 도입 식별자 없음 — R-3, "검색 불가 배너", CTA endpoint, DTO 필드, 에러 코드 모두 기존 재사용 또는 파일 로컬 레이블 | 전체 | 없음 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | 데이터 모델·API 계약·상태 전이 충돌 없음. API 표 RBAC 표기 누락(INFO) 2건 |
| Rationale Continuity | NONE | 관련 spec Rationale 의 모든 주요 결정과 완전 정합. INFO 1건 |
| Convention Compliance | LOW | API 중첩 2단계 초과(WARNING) 2 endpoint, Overview 섹션 누락(WARNING). 에러 코드·frontmatter·URL 명명 규약 준수 |
| Plan Coherence | CRITICAL | plan 미결 정책 결정을 spec 이 단독 확정 — BLOCK 사유. active worktree frontmatter 충돌(WARNING) 1건 |
| Naming Collision | NONE | 신규 식별자 충돌 없음 |

## 권장 조치사항

1. **(BLOCK 해소 필수)** `plan/in-progress/kb-model-change-reembed-followup.md` 에 `## 결정` 절 추가 — 선택지 ③(배너 강화) 채택과 기각 사유(① 자동 트리거: 비용 부담, ② 저장 차단: UX 마찰)를 명기. 이후 consistency-check --spec BLOCK:NO 결과를 plan 에 등재하고 spec 변경을 그 결정의 산출물로 재확인.
2. **(BLOCK 해소 대안)** plan 갱신 없이 spec 선갱신이 의도였다면, plan 의 "착수 전 spec 선갱신 의무" 체크박스를 충족하고 현재 consistency-check 결과(BLOCK:NO 아닐 경우 CRITICAL 재처리 후)를 plan 에 등재.
3. **(WARNING — merge 전 필수)** `kb-unsearchable-groom-cbe34e` 브랜치 담당자와 merge 순서 조율. 선행 merge 완료 후 후행 브랜치를 rebase 하여 frontmatter 충돌 처리.
4. **(WARNING — spec 수정 권장)** API 중첩 규약 위반 endpoint 2건(`documents/:docId/re-embed`, `documents/:docId/re-extract`) — `spec/5-system/2-api-convention.md §2.2` 에 예외 조항 추가하거나 endpoint 경로 재설계. 어느 쪽이든 spec 과 규약의 정합성 확보 후 구현 착수.
5. **(WARNING — spec 수정 권장)** `## Overview` 섹션 추가 — 기존 인용줄 재구성으로 충분.
6. **(INFO — 구현 전 확인)** `§3 API` 표의 `POST /api/knowledge-bases/:id/re-embed` 행에 "editor, Throttle 3회/분" 추가.
7. **(INFO — 구현 시 확인)** §2.4.1 배너 구현 시 `spec/0-overview.md §3.4` Inline Alert 생존 주기 적용(X 버튼 없이 자동 갱신).

---

## 호출자(main Claude) 사후 판정 — 2026-06-11

> 본 절은 SUMMARY persist 후 main Claude 가 git 실측으로 각 발견을 재검증한 결과다.

**BLOCK 재판정: NO (Critical = baseline-read false positive 확정).**

- **Critical #1 (FP 확정)**: checker 가 인용한 충돌 텍스트 `## 검토할 선택지 (비용·UX 정책 결정 필요)` 는 `git show origin/main:plan/in-progress/kb-model-change-reembed-followup.md` 의 **baseline(옛) 버전에만** 존재한다. 본 변경분(worktree)의 plan 은 이미 `## 검토한 선택지` 로 heading 을 바꾸고 `## 결정 (사용자 confirm 2026-06-11)` 절에서 **선택지 ③ 채택 + ①·② 기각 사유**를 명기한다. plan-coherence checker 가 NEW spec(프롬프트 임베드) 과 OLD plan(checker 의 origin/main baseline read) 을 비대칭 비교해 "plan 미결정" 으로 오판한 것 — 메모리 `reference_consistency_check_main_baseline_fp` 의 알려진 FP 패턴. 실제로는 plan→spec 단일 진실 원칙 충족(사용자 confirm 정책 결정이 plan 에 선기록되고 spec 은 그 산출물).
- **WARNING #1 (FP)**: `#528`(커밋 `a696281d`) 은 5-knowledge-base.md 를 **건드리지 않는다**(9-rag-search.md·8-embedding-pipeline.md·plan 이동 3파일뿐). 따라서 frontmatter merge 충돌 없음 — checker 의 #513 역사 변경 오귀속.
- **WARNING #2 (pre-existing, 범위 밖)**: `documents/:docId/re-embed`·`re-extract` 중첩 endpoint 는 본 변경 이전부터 존재(#516 이전). 본 PR 이 도입하지 않았고 별건 규약 정리 사안이라 본 PR 범위 밖.
- **WARNING #3 (systemic, 범위 밖)**: navigation spec 18개 중 16개가 `## Overview` 없음(14-execution-history 만 보유). 본 변경이 도입한 갭이 아니며 nav 영역 전반의 확립된 패턴 — 단일 파일만 고치면 오히려 비일관.
- **INFO**: 구현 단계 체크리스트에 반영(§2.4.1 배너 X 버튼 없는 auto-dismiss 준수, re-embed 행 RBAC 표기 등).

결론: 진행 차단 없음. spec PR 진행.
