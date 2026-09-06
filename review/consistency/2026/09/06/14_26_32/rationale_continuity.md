# Rationale 연속성 검토 — spec/2-navigation/

## 검토 범위 확인

- scope(`spec/2-navigation/`) 델타: 0개 파일 (정상 — 코드 전용 PR).
- 실제 구현 diff(15개 파일/2005줄)는 `git diff origin/main...HEAD --stat` 로 직접 확인한 결과 아래 영역에 한정된다:
  - `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts`(+.spec.ts) — `WorkflowVersion.creator` `User` 관계 projection(`CREATOR_PROJECTION`) 도입, `WorkflowVersionListItem`/`WorkflowVersionDetail` 타입 강화, `findOne` 에 `select` 추가
  - `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts` — `WorkspaceMemberDto.joinedAt` 필드 추가 (§5.4 nullable 표기 실측 근거 포함)
  - `codebase/backend/src/shared/testing/**` — `user-entity-exposure-guard`, `user-secret-absence`, `dto-jsdoc-citation-guard` 등 신규 방어 테스트/가드
  - `codebase/backend/test/*.e2e-spec.ts` — 위 가드에 대응하는 e2e 보강
  - `.claude/hooks/_lib/review_guard.py`, `spec/conventions/review-citations.md`, `spec/conventions/spec-impl-evidence.md`, `plan/**`, `review/**`, `CHANGELOG.md` — 하네스/규약/plan 메타

- `spec/2-navigation/*.md` 의 `code:` frontmatter 글로브(트리거: `triggers.*.ts`, `dto/**`; 스케줄:
  `schedules.*.ts`, `schedule-runner.service.ts`, `workspaces.service.ts`, `update-workspace-settings.dto.ts`,
  `timezone.ts`; 프론트 `webhook-url.ts`/`cron-to-visual.ts` 등)와 위 diff 파일 목록을 대조한 결과
  **교집합 0건**이다. `workspace-response.dto.ts` 는 멤버 **목록**(`WorkspaceMemberDto`) 응답 DTO이지만
  워크스페이스 **설정**(`update-workspace-settings.dto.ts`) 이 아니며, `9-user-profile.md` §4.1 멤버 관리
  화면 서술(이름/이메일/역할/삭제 액션만 서술, 가입일 미노출)과도 직접 충돌하지 않는다 — `joinedAt` 은
  현재 스펙 본문이 언급하지 않는 필드의 순수 추가다.

## 발견사항

- **[INFO]** `WorkspaceMemberDto.joinedAt` 필드가 `spec/2-navigation/9-user-profile.md` §4.1/§4.2 어디에도 언급되지 않음
  - target 위치: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts` (`WorkspaceMemberDto.joinedAt`)
  - 과거 결정 출처: 해당 없음(신규 필드, 폐기된 결정 재도입 아님)
  - 상세: 필드 추가 자체는 `spec/2-navigation` 의 어떤 Rationale 도 위반하지 않는다. §4.1 멤버 관리 표는 이름/이메일/역할/삭제 액션만 서술하고 가입일 컬럼을 다루지 않으므로 이 diff 는 기존 서술과 모순되지 않는, 단순 미기술 API 확장이다. Rationale 연속성 관점에서 문제는 없으나 spec-impl coverage 관점에서 참고할 만하다.
  - 제안: 이 필드를 UI 에 노출할 계획이 있다면 추후 `9-user-profile.md` §4.1 표에 "가입일" 열을 추가하는 별도 planner 턴에서 다룬다. 지금 당장 spec 수정을 요구할 근거는 없다(현재는 API 전용 확장).

- **[INFO]** `WorkflowVersionsService` 의 `User` 관계 projection 강화는 `spec/2-navigation` 범위 밖의 사전(User entity 방어) 결정에 근거
  - target 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` (`CREATOR_PROJECTION`, `ProjectedCreator`, `UnloadedRelations`)
  - 과거 결정 출처: 해당 diff 주석이 인용하는 `select:false` 기각 결정은 `spec/2-navigation/` 밖(User 엔티티/보안 관련 spec 또는 이번 PR 자체의 선행 라운드 Rationale)에 있다 — `spec/2-navigation/*.md` Rationale 에는 이 결정에 대응하는 항목이 없다.
  - 상세: `spec/2-navigation/2-trigger-list.md`·`3-schedule.md` 의 Rationale(R-1~R-16)은 트리거/스케줄 UI·API 계약을 다루며 `WorkflowVersion.creator` 투영과 무관하다. 이 diff 가 spec/2-navigation 이 규정한 어떤 원칙(단일 편집 경로, drawer 카드 분리, authConfigId 단일화 등)도 건드리지 않는다.
  - 제안: 조치 불필요. 참고용으로만 기록.

## 요약

`spec/2-navigation/` 스코프의 Rationale(트리거 목록 R-1~R-16, 스케줄 관리의 sort/order·딥링크 비대칭 등)과 이번 PR 의 실제 구현 diff(`WorkflowVersion.creator` User 컬럼 노출 방어, `WorkspaceMemberDto.joinedAt` 추가, User 엔티티 노출 방지 테스트 가드 신설) 사이에는 코드·문서 교집합이 없다. `code:` frontmatter 글로브 대조로 확인한 결과 트리거·스케줄·config·user-profile 화면의 구현 파일 중 어느 것도 이번 diff 에 포함되지 않았고, 두 spec 문서(`2-trigger-list.md`, `3-schedule.md`)에서 실제로 읽은 Rationale 항목 중 이번 diff 가 재도입·번복·우회하는 결정은 발견되지 않았다. `WorkspaceMemberDto.joinedAt` 필드 추가는 §4.1 멤버 관리 UI 서술과 모순되지 않는 단순 미기술 확장이라 INFO 로만 남긴다. 이 검토는 "델타 0" 을 근거로 CRITICAL 을 내지 않았으며, 실제 diff 내용을 절대경로로 직접 대조해 결론에 도달했다.

## 위험도

NONE
