# Plan 정합성 Check — node-config-required-defaults-sweep

## 발견사항

- **[INFO]** 후속 follow-up 항목과 기존 in-progress plan 간 명시적 연결 없음
  - target 위치: `## 후속 follow-up (별 plan/PR)` 섹션 전체
  - 관련 plan: `plan/in-progress/cafe24-test-spec-guard-cleanup-followups.md` W-2/W-10 (`http-safety.spec.ts`), `plan/in-progress/cafe24-backlog-residual.md` B-5-8
  - 상세: target plan 의 follow-up 중 "테스트 패턴 통일 — 공유 `getUiMeta` 헬퍼 추출" 항목은 신규 spec 파일 추가 없이 `codebase/backend/src/nodes/` 하위 spec 파일들만 건드린다. `cafe24-test-spec-guard-cleanup-followups.md` 는 `http-safety.spec.ts` 등 인접 파일을 동시 손댈 수 있으나 직접 충돌 영역은 다르다. 다만 두 follow-up plan 이 각각 독립적으로 worktree 를 배정받게 되면 같은 `*.spec.ts` 디렉토리에서 인접 충돌이 생길 수 있어 추적 메모가 권장된다.
  - 제안: 후속 follow-up plan 생성 시 `cafe24-test-spec-guard-cleanup-followups.md` 의 W-4/W-5 worktree 와 겹치지 않도록 frontmatter `worktree` 및 의존성 절에 명시.

- **[INFO]** `0-unimplemented-overview.md` plan 목록에 target plan 미등재
  - target 위치: 해당 없음 (target plan 자체의 문제 아님)
  - 관련 plan: `plan/in-progress/0-unimplemented-overview.md` §plan 문서 목록
  - 상세: `0-unimplemented-overview.md` 의 `plan/in-progress/` 트리(2026-05-18 정리 후 목록)에 `node-config-required-defaults-sweep.md` 가 누락되어 있다. 해당 문서는 "큰 미구현 덩어리" 카테고리보다 "follow-up · 정합화 묶음" 성격이나, 동일 목록에 나열된 다른 정합화 plan 들과 일관성이 없다.
  - 제안: `0-unimplemented-overview.md` 의 plan 목록에 `node-config-required-defaults-sweep.md` 를 "follow-up · 정합화 묶음" 항목으로 추가하거나, PR merge 후 complete 이동과 함께 인덱스 동기화.

### 요약

target plan(`node-config-required-defaults-sweep`)은 다른 진행 중 plan 들과 수정 대상 파일 영역이 명확히 분리된다. zod 스키마 자체는 건드리지 않고 `.meta({ ui: {...} })` 메타데이터만 추가하는 좁은 범위라, `ai-agent-tool-connection-rewrite`(ai-agent.schema.ts), `cafe24-*` plan 들(integration/cafe24 영역), `harness-i18n-userguide-gap`(SKILL.md/i18n) 과의 실질적 worktree 충돌이 없다. 미해결 결정 사항을 일방적으로 우회하는 항목도 없으며, 후속 follow-up 들은 명시적으로 "별 worktree·plan" 으로 분리 예약되어 있다. 발견된 두 건은 모두 INFO 등급의 추적 편의 개선 사항이며 작업 직렬화나 결정 합의를 선행 요구하지 않는다.

### 위험도

LOW
