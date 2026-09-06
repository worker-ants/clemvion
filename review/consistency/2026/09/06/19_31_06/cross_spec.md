# Cross-Spec 일관성 검토 — cross_spec

- 검토 모드: `--impl-done` (scope=`spec/2-navigation/`, diff-base=`origin/main`)
- target spec 영역(`spec/2-navigation/`) 자체의 파일 델타: **0** — 이 브랜치는 해당 spec 영역을 고치지 않았다. 실제 코드 변경(23파일/2765줄)은 대부분 `spec/2-navigation/` 밖(트리거 백엔드 컨트롤러/서비스, `WorkflowVersion.creator` 투영, `WorkspaceMemberDto`, `pg-error` 공용 유틸, `User` 엔티티 노출 방지 가드/테스트)에 있으며, 그 중 `spec/2-navigation/2-trigger-list.md` 가 이미 문서화한 계약(§3 `endpointPath` UNIQUE 충돌 409)을 뒤늦게 구현·정합화하는 성격이다.
- 코드 존재 확인은 워크트리(`/Volumes/project/private/clemvion/.claude/worktrees/user-entity-column-defense`) `git diff origin/main...HEAD` 절대경로 실측으로 수행했다.

## 발견사항

- **[WARNING]** 409 `RESOURCE_CONFLICT` 세부 코드 표현이 두 패턴으로 갈렸다 (`details.code` 신설 vs 기존 top-level `code` 치환)
  - target 위치: `spec/2-navigation/2-trigger-list.md` §3 (`PATCH /api/triggers/:id` 하단 note, `(workspace_id, endpoint_path) UNIQUE 위반 시 409 RESOURCE_CONFLICT (세부 코드 TRIGGER_ENDPOINT_PATH_CONFLICT, details.field='endpoint_path')`) — 이번 커밋에서 `codebase/backend/src/modules/triggers/triggers.service.ts` 의 `rethrowEndpointPathConflict` 가 실제로 `{ code: 'RESOURCE_CONFLICT', details: { field: 'endpoint_path', code: 'TRIGGER_ENDPOINT_PATH_CONFLICT' } }` 를 던지도록 구현됐다 (해당 함수의 인라인 주석이 이 결정을 직접 설명).
  - 충돌 대상: `spec/5-system/2-api-convention.md` §5.3 (`details`: "검증 오류 항목은 `{ field, message, code: "INVALID_FIELD" }` 구조" — **배열**), `spec/5-system/3-error-handling.md §4.2`/`conventions/error-codes.md §4.2` (도메인 세부 사유는 top-level `code` 자체를 특화 코드로 **치환**하는 패턴, 예: `AUTH_CONFIG_NOT_FOUND`, `TRIGGER_ENDPOINT_PATH_CONFLICT` 자매격 다른 409들 — `spec/2-navigation/1-workflow-list.md` 의 폴더 이름 중복(409), `spec/5-system/1-auth.md` 의 이메일 중복(409)은 둘 다 `details` 없이 top-level `RESOURCE_CONFLICT` 만 반환).
  - 상세: 지금 저장소에는 "409/400 의 도메인 세부 사유를 어디에 싣는가"에 대해 최소 두 가지 표현이 공존한다 — (a) top-level `code` 를 특화 코드로 치환(7건 선례, 개발자 주석이 직접 언급), (b) `code` 는 generic 값(`RESOURCE_CONFLICT`)을 유지하고 세부는 `details.code`(단일 객체, 배열 아님)에 얹는 신설 방식. api-convention.md §5.3 은 `details` 를 **배열**(검증 실패 항목 다건)로만 정의하고 있어, 이번에 신설된 "`details` 가 단일 객체이며 `code` 키를 추가로 갖는" 형태는 그 정의 어디에도 없다. 클라이언트/SDK 가 `error.details` 를 항상 배열로 파싱하도록 짜여 있다면 이 신설 형태에서 오동작할 수 있다.
  - 다만 이 항목은 **개발자 자신이 이미 인지·등재**했다 — 구현 커밋의 주석이 "표현 방식의 정식화는 planner 항목으로 등재했다" 고 명시하며, 실제로 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 `TRIGGER_ENDPOINT_PATH_CONFLICT`/`details.code` 관련 후속 항목이 존재함을 확인했다. 즉 **새로 발견된 미인지 충돌이 아니라, 추적 중인 알려진 이원화**다.
  - 제안: `spec-draft-nullable-notation-followups.md` 의 해당 후속 항목에서 (a)/(b) 중 하나로 `conventions/error-codes.md §4` 또는 `2-api-convention.md §5.3` 에 정식 규칙을 추가하고, 그 규칙이 정해지면 `2-trigger-list.md §3` 문구(`details.code` 표현)를 그 규칙에 맞춰 갱신. 신규 사례를 늘리기 전에 두 패턴 중 하나로 수렴시킬 것.

- **[INFO]** `WorkspaceMemberDto.joinedAt` 신규 응답 필드가 `spec/2-navigation/9-user-profile.md` 멤버 목록 UI 서술에는 아직 반영되지 않음
  - target 위치: (target 영역 밖) `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts` — `WorkspaceMemberDto` 에 `joinedAt: string | null` 신설.
  - 충돌 대상: `spec/2-navigation/9-user-profile.md` §4.1 "현재 멤버" 목록 서술(멤버 이름/role 등 언급) — `joinedAt` 필드 노출은 이 문서 어디에도 언급이 없다.
  - 상세: `spec/1-data-model.md §2.3 WorkspaceMember.joined_at`(Timestamp?, 합류 시각) 과 타입은 정합(nullable timestamp)하고 데이터 모델 모순은 없다. 다만 `GET /api/workspaces/:id/members` 응답에 새 필드가 추가됐는데 `2-navigation/9-user-profile.md §4` API/화면 절이 이를 아직 언급하지 않아 문서-구현 간 약간의 지연(doc-sync)이 있다. 충돌이라기보다 동기화 권장 수준.
  - 제안: 다음 `2-navigation/9-user-profile.md` 편집 시 멤버 목록/API 절에 `joinedAt` 노출 여부·표시 위치를 추가.

## 요약

이번 브랜치는 `spec/2-navigation/` 문서 자체를 변경하지 않았고(스코프 델타 0), 실제 코드 변경은 대부분 `spec/2-navigation/` 밖(트리거 서비스의 `endpointPath` UNIQUE 충돌 처리, `WorkflowVersion.creator`/`WorkspaceMemberDto` 응답 투영, `User` 엔티티 전체 노출 방지 정적 가드 신설)에 있다. 트리거 변경은 `2-trigger-list.md §3` 이 이미 문서화해 둔 409 계약을 뒤늦게 구현한 것으로 데이터 모델·API 계약·RBAC·상태 전이 어느 축에서도 새로운 CRITICAL 모순은 발견되지 않았다. 다만 그 구현이 택한 에러 응답 세부 코드 표현(`details.code`, 단일 객체)이 `api-convention.md §5.3` 이 정의한 `details` 배열 구조 및 다른 409 사례들과 형태가 달라 잠재적 계약 모호성이 남아 있으며, 이는 이미 팀이 planner 후속 항목으로 등재해 추적 중인 사안이다. `WorkspaceMemberDto.joinedAt` 신규 필드는 데이터 모델과는 정합하나 네비게이션 UI 문서에는 아직 반영되지 않아 경미한 doc-sync 항목으로 남는다.

## 위험도

LOW
