---
name: model-config-manager-refactor-followup
worktree: (unstarted)
status: pending
started: 2026-06-11
owner: developer
related_plan:
  - plan/in-progress/unified-model-management.md
---
# Followup — ModelConfigManager SRP 분리 + 모달 접근성

> 분리 사유: Unified Model Management PR3 리뷰(`review/code/2026/06/11/00_30_05`)에서
> 아키텍처 WARNING 2건(W5·W6)이 **대형 리팩토링**으로 분류돼 in-PR fix 에서 이월됐다.
> 기능·정합성에는 영향 없으며(동작 정상), 컴포넌트 구조 품질 개선 항목이다.

## 배경 (현재 상태)

- `codebase/frontend/src/components/models/model-config-manager.tsx` 가 단일 컴포넌트에
  CRUD 전체 + 3 kind(chat/embedding/rerank) 분기 + 폼 다이얼로그 + 삭제 다이얼로그를 모두 수용 (≈560 LOC).
- 모달은 `fixed inset-0` 인라인 DIV 구현. PR3 리뷰 fix 로 **ESC 키 닫기**는 추가됐으나
  focus-trap 완전 구현은 미적용.

## 작업 (이 followup)

1. **W5 — SRP 분리**:
   - `ModelConfigFormDialog` (생성/수정 폼) 서브컴포넌트 추출.
   - `ModelConfigDeleteDialog` (삭제 확인) 서브컴포넌트 추출.
   - `useModelConfigForm` hook 으로 폼 상태·검증 로직 분리.
   - 검증 로직(`handleSave` 분기)을 독립 순수 함수로.
2. **W6 — 모달 접근성**: 인라인 모달을 shadcn/ui `<Dialog>` / `<AlertDialog>` 로 교체해
   focus-trap·포커스 복원·ESC·오버레이 클릭 닫기를 라이브러리에 위임.
3. **테스트 유지**: 기존 `model-config-manager.test.tsx`(PR3 리뷰 fix 로 신설) 가
   리팩토링 후에도 통과하도록 보강.

## 주의

- 기능 변경 금지 — 순수 구조 리팩토링. payload·API 호출·검증 규칙 동작 동일 유지.
- PR4(레거시 제거)와 독립이나, 같은 컴포넌트를 만지므로 **PR4 착수 전 또는 PR4 와 함께** 처리 권장.
