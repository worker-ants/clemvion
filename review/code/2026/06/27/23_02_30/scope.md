# 변경 범위(Scope) 리뷰

## 발견사항

### [WARNING] 현재 작업 주제와 무관한 e2e 테스트 변경
- 위치: `codebase/backend/test/system-status.e2e-spec.ts` L34
- 상세: `workspace-invitations-pruner` 큐를 `EXPECTED_QUEUE_NAMES`에 추가했다. 이것은 W7(WorkspaceInvitationsPrunerService 신설) 완료에 따른 동기화이며, 현재 PR의 핵심 주제(AgentMemoryAdminService SRP 분리 + 프론트엔드 컴포넌트 분해 + X-Deleted-Count UX)와 독립적인 기능에 해당한다. WorkspaceInvitationsPruner의 실제 구현 소스(서비스 파일, 모듈 등록, 단위테스트)는 이 PR 변경셋에 포함되어 있지 않고, e2e 목록 한 줄만 추가된 형태다. plan 파일(파일 18)에서 W7이 2026-06-27 완료로 기록되어 있으므로 구현이 이미 별도 커밋에 있을 수 있으나, 이 PR 범위로 보면 구현 없이 e2e 기대값만 변경된 것이다.
- 제안: W7 구현 커밋이 이 PR에 포함되어 있는지 확인할 것. 포함되어 있지 않다면 이 항목은 W7 구현 PR에서 처리하거나, 해당 커밋이 이 PR에 포함되어 있음을 명시적으로 확인해야 한다.

### [WARNING] 다른 worktree의 완료 plan 파일 수정
- 위치: `plan/complete/trigger-review-deferred-fixes.md` L2-8
- 상세: `worktree: trigger-review-w1-w7`로 지정된 다른 worktree의 완료된 plan 파일에 `spec_impact` frontmatter를 추가했다. 이 파일은 현재 작업(worktree: `ai-mem-admin-frontend`)의 범위 밖이며, W7 완료 기록을 위한 것으로 보이나 현재 작업의 주제(AgentMemory admin + 프론트엔드 분해)와 무관하다.
- 제안: 다른 worktree의 plan 파일 수정은 해당 worktree에서 처리하거나, 별도 커밋으로 분리하는 것이 바람직하다.

### [INFO] page.tsx의 포맷팅 전용 변경 1건
- 위치: `codebase/frontend/src/app/(main)/agent-memory/page.tsx` L172-L174
- 상세: `deleteMemoryTarget && deleteMemoryMutation.mutate(deleteMemoryTarget)` 두 줄을 한 줄로 합쳤다. 의미 변경은 없으며 컴포넌트 분해 과정에서 자연스럽게 발생한 포맷팅 조정이다. 차단 대상이 아니다.
- 제안: 무시 가능.

## 요약

변경의 핵심 세 축(AgentMemoryAdminService SRP 분리, 프론트엔드 ScopeListPanel/MemoryListPanel 컴포넌트 분해, clearScope X-Deleted-Count 헤더 + 0건 중립 토스트)은 A1 backlog에 명시된 작업 항목을 그대로 구현한 것으로 범위 내에 있다. 테스트 이관·신규 작성, API 클라이언트 반환 타입 변경, i18n 키 추가도 각 구현과 직접 연결된다. 다만 두 가지 이탈이 식별된다: (1) `system-status.e2e-spec.ts`에 W7(WorkspaceInvitationsPruner) 관련 큐 이름이 추가되었으나 그 구현 파일이 이 변경셋에 없어 e2e 기대값과 구현이 같은 PR에 있는지 불명확하다. (2) 다른 worktree에 속한 완료 plan 파일(`trigger-review-deferred-fixes.md`)에 현재 작업과 무관한 frontmatter가 추가되었다. 두 항목 모두 기능 로직에 영향을 주지 않는 수준이지만 단일 PR의 변경 경계를 흐린다.

## 위험도

LOW
