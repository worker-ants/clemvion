---
worktree: brand-refresh-7a3f12
started: 2026-05-15
owner: developer (proposing to project-planner)
---

# Spec Update Proposal: Brand Refresh Followup

본 plan 은 `developer` 가 Stage 2 구현 중 spec 수정이 필요하다고 판단한 항목을 `project-planner` 로 위임하기 위한 노트다. 출처: `review/consistency/2026/05/15/18_49_57/SUMMARY.md` (impl-prep 검토).

## 제안 항목

### P-1. `spec/6-brand.md` 제목에서 `PRD:` prefix 제거

**현재**: `# PRD: 브랜드 가이드 — Clemvion`

**제안**: `# 브랜드 가이드 — Clemvion`

**근거**: docs-consolidation (2026-05-12) 이후 *옛 PRD* 라는 표현은 흡수 시점에만 사용하고, 현행 문서 제목에는 두지 않는 것이 CLAUDE.md "정보 저장 위치" 규약 정신. 다른 spec 들(`spec/0-overview.md`, `spec/2-navigation/_layout.md` 등) 은 모두 `PRD:` prefix 없는 평이한 제목.

**영향**: 제목 한 줄 수정. 내부 링크는 깨지지 않음 (앵커는 본문 헤딩 기반).

### P-2. `spec/0-overview.md §3.4` 상태 색상 매핑을 brand 토큰으로 명시

**현재**: §3.4 에서 success/active/error 상태 배지의 색을 일반 단어("초록", "주황" 등) 로만 기술.

**제안**: 각 상태 색이 어느 brand 토큰에 대응하는지 각주 또는 인라인으로 명시 (예: success → `vine-400`).

**근거**: developer 가 상태 배지 구현 시 즉흥 색상 선택을 피하기 위해. 단일 진실은 `spec/6-brand.md §8.2.1`.

**영향**: §3.4 표·텍스트에 토큰명 추가. brand spec §8.4.6 의 노출 자리 매트릭스에도 "상태 배지 색" 행 추가 검토.

### P-3. `spec/2-navigation/10-auth-flow.md §1` HEX 하드코딩 제거

**현재** (Stage 1 에서 본인이 추가한 행):

```
- 배경: `soil-50` (`#f7f8f6`) 단색. 그라데이션 금지...
```

**제안**: HEX 부분 제거.

```
- 배경: `soil-50` 단색. 그라데이션 금지. HEX 정의는 `spec/6-brand.md §8.2.2`...
```

**근거**: 토큰명만 두면 brand spec 의 HEX 변경 시 자동 동기화. HEX 를 라우트 spec 에 박으면 단일 진실 원칙 위반 위험.

**영향**: 한 줄 수정.

## 우선순위

세 항목 모두 비차단 (BLOCK: NO 확인됨). Stage 2 구현 진행 후 PR 단계에서 함께 처리하거나, 별도 작은 spec PR 로 분리 가능. project-planner 가 정함.
