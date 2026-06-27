# Consistency Check 통합 보고서 (--impl-done, fresh — 후속 커밋 커버)

**BLOCK: NO** — Critical 발견 없음. 차단 사유 없음.

검토 모드: `--impl-done spec/7-channel-web-chat/` (spec 영역 + 코드 diff vs origin/main, HEAD=973074062)
일시: 2026-06-27 22:25:49

> push SPEC-CONSISTENCY 가드 충족용 fresh --impl-done — 후속 커밋(973074062: helper 단위테스트·주석)을 postdate 한다.

## 전체 위험도
**LOW** — 구조적 모순 없음. WARNING 1(spec ID prefix 예방적 사용, pre-existing·build-safe) + INFO 다수(전부 pre-existing drift 또는 planner spec polish). Critical 0.

## Critical 위배 (BLOCK 사유)
해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | 처리 |
|---|---------|------|------|
| W-1 | Convention Compliance | spec frontmatter `id: web-chat-X` 가 실제 충돌 없이 예방적 prefix 사용 — `spec-impl-evidence §2.1` "basename 권장; 실제 충돌 시 prefix" 예외조건 미충족 | **pre-existing·spec-side**(본 코드 리팩터 무관), build 차단 없음, "현행 유지 허용". D 검토(I5)에서도 의도적 carve-out 으로 수용됨 → planner 규약 carve-out 명시 followup, 비차단 |

## 참고 (INFO) — 전부 비차단

| # | Checker | 항목 | 처리 |
|---|---------|------|------|
| I-1 | Cross-Spec | `5-admin-console status: implemented` vs NAV-WC-06 🚧 drift | pre-existing, planner 동기화 |
| I-2 | Cross-Spec | `ended` OPEN 유지 동작 `§3.1` 미기술 | planner spec polish (pre-existing 동작) |
| I-3 | Cross-Spec | `isTextInputSurface(null)→true` `§2` 미기술 | planner spec polish |
| I-4 | Cross-Spec | `execution.message` 경로 `§2` 미참조 | planner spec polish (pre-existing) |
| I-5·I-6 | Rationale | isTextInputSurface·teardownSession §R6·§3.1 정합 — 이상 없음 | — |
| I-7·I-8 | Convention | `0-architecture` 파일명·`## Overview` 부재 — 권장사항 | planner carve-out (비차단) |
| I-9 | Convention | EIA wire 필드명 drift plan 미등록 | 선택 추적 메모 |
| I-10 | Plan | `2-sdk §3` localStorage 이연 drift | backlog §A 추적 중 |
| I-11 | Plan | SPEC-DRIFT planner plan 미생성 — backlog §C 추적 | 다음 planner 접점 |
| I-12 | Naming | `id: common` 중복(범위 밖) | 해당 없음 |

## Checker별 위험도

| Checker | 위험도 | 핵심 |
|---------|--------|------|
| Cross-Spec | LOW | 구조 모순 없음. INFO 4(기존 status drift·ended OPEN·isTextInputSurface(null)·execution.message 미참조) |
| Rationale Continuity | NONE | 리팩터 전부 기존 Rationale 정합. 기각 대안 재도입 없음 |
| Convention Compliance | LOW | WARNING 1(ID prefix 예방적, build-safe). INFO 3(파일명·Overview·EIA drift) |
| Plan Coherence | NONE | 미해결 결정 충돌 없음. INFO 2(알려진 이연 drift) |
| Naming Collision | NONE | 신규 식별자 충돌 없음 |

## 권장 조치사항
1. **(BLOCK 해소 불요)** Critical 0 — 현 PR 진행 가능.
2. **(W-1·I-* planner followup, 비차단)** spec ID prefix carve-out 명시, `1-widget-app §3.1·§2` 동작 문서화, NAV-WC-06 동기화 — backlog §C 추적 중.
