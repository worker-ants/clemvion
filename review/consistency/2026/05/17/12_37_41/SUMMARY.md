# Consistency Check 통합 보고서 (impl-prep)

**BLOCK: YES** (초기) → **BLOCK: NO** (정정 후) — CRITICAL 2건은 spec drift 정정 + impl phase parser 수정으로 해소

세션: `review/consistency/2026/05/17/12_37_41/`
모드: `--impl-prep spec/conventions/`

---

## Critical 위배

| # | Checker | 위배 | 해소 |
|---|---------|------|------|
| C-1 | Convention Compliance | `_overview.md §2` 컬럼 정의 순서(paginated→restricted)와 실제 4 catalog 파일 헤더 순서(scope→restricted→paginated) 역전 | spec drift 정정 commit 에서 _overview §2 표 순서를 실제 파일 기준으로 통일 |
| C-2 | Naming Collision | `catalog-sync.spec.ts parseCatalogFile()` 9-cell 하드코딩 — 10-column 표 파싱 깨짐 | impl phase 1단계 — `CatalogRow.restricted` 필드 + 헤더 기반 동적 인덱싱 + 규칙 8 검증 실제 구현 |

## 경고 (WARNING) — spec drift fix commit 에서 함께 흡수

| # | 항목 | 처리 |
|---|------|------|
| W-1 | `requiresCafe24Approval` 교집합 범위 §1 vs 명단 전체 표현 불일치 | §9.4 본문에 §1·§2 구분 명시 |
| W-2 | 동일 | W-1 과 함께 |
| W-3 | §6 상태 전이 다이어그램 `pending_install → pending_install` 에 `oauth_invalid_scope` 누락 | 다이어그램 행에 추가 |
| W-4 | Coverage Matrix 날짜 미갱신 | 2026-05-16 → 2026-05-17 |
| W-5 | `cafe24-restricted-scopes.md` 도입부 비섹션화 | `## Overview` 로 감싸기 |
| W-6 | 4 catalog 파일에 `## Rationale` 섹션 없음 | 각 파일 하단에 `_overview.md` cross-reference 한 줄 |
| W-7 | `store.md` `privacy_*` planned operation id 혼동 소지 | **별도 follow-up plan 분리** — 본 작업 의도와 거리 있음 (planned 라 비차단) |
| W-8 | `restrictedApproval.category` ↔ `Cafe24Resource.category` 명명 충돌 | `category` → `approvalGroup` 재명명 (backend 미반영, 비용 낮음) |
| W-9 | catalog `op` ↔ metadata `level='operation'` 표기 비일관성 | catalog 값도 `operation` 으로 통일 + parser 가 새 값 인식 (C-2 와 한 묶음) |

## 참고 (INFO)

| # | 항목 | 처리 |
|---|------|------|
| I-1 | 작업 추적 plan 부재 (cafe24-restricted-scopes-a1b2c3.md) | 이미 `plan/in-progress/cafe24-restricted-scopes.md` 가 frontmatter `worktree: cafe24-restricted-scopes-a1b2c3` 포함 — 충족 |
| I-2 | cafe24-backlog-residual cross-reference | 이미 W-8 (--spec 세션) 으로 양쪽 plan 에 추가됨 |
| I-3 | full-review-fixes-a1b2c3 머지 여부 | 머지 완료 확인 (앞 단계에서) |
| I-4 | 규칙 8 의 `category` 필드 검증 여부 모호 | impl phase parser 구현 시 명확화 |
| I-5 | `level='program'` 제외 정책 중복 | INFO — canonical 위치 추후 정리 |
| I-6 | store.md `paymentmethods_list` 빈칸 | 이미 store.md 안내문 + cafe24-restricted-scopes.md §2 trade-off 에 양쪽 명시 |
| I-7 | `_overview.md` 파일명 컨벤션 불일치 | 본 PR 범위 외 (기존 파일) |
| I-8 | `_overview.md` Rationale 없음 | CHANGELOG 가 결정 기록 담당 — 본 PR 범위 외 |
| I-9 | `oauth_invalid_scope` 와 `insufficient_scope` 의미 구분 | backend 구현 시 주석 추가 |
| I-10 | `requiresCafe24Approval` details 키 충돌 없음 | — |

## 처리 결과

- spec drift fix commit 으로 BLOCK 해소 (C-1, W-1~W-6, W-8, W-9 흡수, W-7 분리)
- impl phase 1단계로 C-2 (`parseCatalogFile` 갱신 + 규칙 8 검증 구현) 해소
- W-7 은 `plan/in-progress/cafe24-store-privacy-prefix-rename.md` follow-up 으로 분리
