# Cross-Spec 일관성 검토 — spec/2-navigation (impl-done)

## 검토 방법

`spec/2-navigation/**` 자체의 diff 는 0개 파일이라(diff-base `origin/main`), "target 문서" 로 볼
신규·변경 spec 이 없다. 대신 이번 PR (`user-entity-column-defense`, HEAD)의 구현 diff 20개
파일 중 `spec/2-navigation/*.md` 가 인용하는 코드 경로와 겹치는 부분을 다음 spec 영역과
대조했다: `spec/1-data-model.md`, `spec/5-system/2-api-convention.md`, `spec/5-system/1-auth.md`,
`spec/5-system/14-external-interaction-api.md`, `spec/5-system/15-chat-channel.md`.

실제 diff 는 `git -C <worktree> diff origin/main...HEAD` 로 직접 확인했다(프롬프트 번들의
diff 블록은 예산 절단으로 미표시). 겹치는 파일:

- `codebase/backend/src/common/db/pg-error.ts` (신규 `pgErrorConstraint`)
- `codebase/backend/src/modules/triggers/triggers.service.ts` (`TRIGGER_ENDPOINT_PATH_CONFLICT` 처리 신설)
- `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` (`creator` 투영 좁힘)
- `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts` (`WorkspaceMemberDto.joinedAt` 추가)
- e2e: `workspace-rbac.e2e-spec.ts` / `workflow-crud.e2e-spec.ts` / `audit-logs.e2e-spec.ts` (User 비밀 컬럼 부재 검증 추가)
- 나머지(다수)는 `User` 엔티티 노출 방지 가드/픽스처(`repo-guards/**`, `shared/testing/user-secret-absence.ts` 등)로 spec/2-navigation 이 인용하는 어떤 표면도 건드리지 않는다.

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO]** `TRIGGER_ENDPOINT_PATH_CONFLICT` 구현이 기존 spec 문서한 계약과 정합
  - target 위치: (spec 변경 없음) — 참고로 `triggers.service.ts` 의 `rethrowEndpointPathConflict`
  - 대조 대상: `spec/2-navigation/2-trigger-list.md §3`("409 `RESOURCE_CONFLICT` (세부 코드 `TRIGGER_ENDPOINT_PATH_CONFLICT`, `details.field='endpoint_path'`)") · `spec/5-system/2-api-convention.md §12.2`(`Trigger.endpoint_path` 워크스페이스 단위 유니크) · `codebase/backend/migrations/V002__indexes.sql`(`idx_trigger_workspace_endpoint`, partial unique)
  - 상세: 이번 diff 는 spec 이 이미 선언해 둔 계약(코드 `TRIGGER_ENDPOINT_PATH_CONFLICT`, `details.field`)을 실제로 던지도록 구현을 좁혔다. 인덱스 이름(`idx_trigger_workspace_endpoint`)도 실제 마이그레이션과 일치하고, 인덱스명 불일치 시 `false` 로 안전하게 폴백해 전역 `RESOURCE_CONFLICT` 로 흡수되는 구조라 다른 UNIQUE 위반과 충돌하지 않는다. 다른 spec 영역(api-convention §12.2)과도 모순 없이 정합적이다. **문제가 아니라 spec-코드 갭이 줄어든 사례**라 별도 조치 불요.
  - 제안: 없음 — 기록용 확인.

- **[INFO]** `WorkspaceMemberDto.joinedAt` 신규 필드는 `spec/1-data-model.md` 의 nullable 선언을 따르되, `2-navigation/9-user-profile.md` 는 이 응답의 필드 목록을 표로 명세하지 않아 대조 대상이 없음
  - target 위치: (spec 변경 없음) — `workspace-response.dto.ts` `WorkspaceMemberDto.joinedAt: string | null`
  - 충돌 대상: `spec/1-data-model.md §2.3 WorkspaceMember`(`joined_at | Timestamp?`) — nullable 스키마와 DTO `nullable: true` 표기가 형식상 일치
  - 상세: 코드 주석은 "스키마상 nullable 이나 실측상 `workspace_member` 생성 경로 4곳이 전부 `joinedAt: new Date()` 로 즉시 채운다"고 명시한다. `spec/1-data-model.md` 의 `Timestamp?` 선언과 모순되지 않는다(DB 컬럼 자체는 nullable — application 이 항상 채울 뿐). `spec/2-navigation/9-user-profile.md §3 API` 는 `GET /api/workspaces/:id/members` 의 응답 필드 목록을 표로 명세하지 않으므로 이 추가와 직접 충돌하는 서술이 없다. 충돌은 아니나, 다른 nav spec(`2-trigger-list.md`)이 필드 권한 매트릭스를 상세히 두는 관례와 대비된다는 점만 참고로 남긴다.
  - 제안: 조치 불요 (해당 없음 시 그대로 유지). 후속으로 `9-user-profile.md` 에 멤버 응답 필드 표를 추가할지는 project-planner 재량.

- **[INFO]** `WorkflowVersionDetail` 타입명이 프런트엔드 손-미러 타입과 동명이나 필드 집합이 갈림 (spec 비대상, 참고용)
  - target 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` 신규 `WorkflowVersionDetail`/`ProjectedCreator`
  - 충돌 대상: `codebase/frontend/src/lib/api/workflows.ts` 의 동명 `WorkflowVersionDetail` (`creator?: { id, name?, email? } | null` — optional)
  - 상세: 이 타입은 어떤 spec 문서에도 SoT 로 등재돼 있지 않아(둘 다 `spec/2-navigation/1-workflow-list.md`·`14-execution-history.md` 에 필드 단위로 문서화되지 않음) **cross-spec 충돌 대상 자체가 없다**. FE 타입이 BE 보다 넓어 런타임 오류는 나지 않으나, grep 으로 "유일 정의" 로 오판할 위험은 코드 리뷰(naming_collision) 영역이지 spec 불일치는 아니다. 이미 코드 주석 자체가 이 사실을 인지하고 있다(`review/consistency/2026/09/06/13_39_25` W3 인용).
  - 제안: cross-spec 관점에서는 조치 불요. FE/BE 타입 동기화는 개발자 진행 중인 별도 관심사.

## 요약

이번 PR 의 실제 코드 변경(20파일)은 대부분 `User` 엔티티 비밀 컬럼의 우발적 노출을 막는
백엔드 방어 계층(가드·픽스처·e2e)이며, `spec/2-navigation/**` 은 diff 0개로 전혀 수정되지
않았다. `spec/2-navigation` 이 인용하는 코드 표면과 실제로 겹치는 세 지점 —
(1) 트리거 `endpoint_path` UNIQUE 충돌 응답(`TRIGGER_ENDPOINT_PATH_CONFLICT`),
(2) 워크스페이스 멤버 DTO 의 `joinedAt` 필드 추가,
(3) 워크플로 버전 `creator` 투영 좁힘 —
을 `spec/1-data-model.md`, `spec/5-system/2-api-convention.md §12`, `spec/2-navigation/2-trigger-list.md §3` 과
대조한 결과 직접적인 데이터 모델·API 계약·상태 전이·RBAC 모순은 발견되지 않았다. 오히려
(1)은 spec 이 이미 선언한 계약을 구현이 뒤늦게 따라잡은 사례로, spec-코드 정합성을
개선하는 방향이다. CRITICAL/WARNING 없음.

## 위험도

NONE
