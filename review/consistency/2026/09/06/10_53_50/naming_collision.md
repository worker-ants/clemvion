# 신규 식별자 충돌 검토 — naming_collision

## 검토 범위 요약

- target scope(`spec/5-system/`) 델타: **0개 파일**. 이 브랜치는 spec/5-system 을 변경하지
  않았다(정상 — 코드 전용 PR).
- 실제 변경은 `codebase/` 11개 파일(955줄, `origin/main` 대비 실측)로, `User` 엔티티 컬럼
  과다 노출 방어(가드·테스트·DTO 필드 노출) 관련이다. 워킹트리(`user-entity-column-defense`)
  를 절대경로로 직접 diff 하여 확인했다:
  - `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` (+spec)
  - `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts`
  - `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts` (신규)
  - `codebase/backend/src/repo-guards/__tests__/user-entity-exposure.spec.ts` (신규)
  - `codebase/backend/src/repo-guards/__tests__/fixtures/user-relation-load.fixture.ts` (신규)
  - `codebase/backend/src/shared/testing/user-secret-absence.ts` (신규) / `.spec.ts` (신규)
  - `codebase/backend/test/{audit-logs,workflow-crud,workspace-rbac}.e2e-spec.ts`

이 검토는 위 diff 가 **신규로 도입한 식별자**(함수·상수·인터페이스·엔드포인트·이벤트·env·
파일 경로)가 기존 spec/코드 사용처와 다른 의미로 충돌하는지를 6개 관점으로 대조했다.

## 발견사항

- **[INFO]** 신규 게이트 상수 `USER_SECRET_KEYS` / `findUserSecretLeaks` / `expectNoUserSecrets` — 기존 `assertMatchesContract`(선언 vs 값)와 이름·역할이 겹치지 않음, 의도된 3축 분리
  - target 신규 식별자: `codebase/backend/src/shared/testing/user-secret-absence.ts` 의 `USER_SECRET_KEYS`, `findUserSecretLeaks`, `expectNoUserSecrets`
  - 기존 사용처: `codebase/backend/src/shared/testing/response-contract.ts` 의 `assertMatchesContract`/`contractForDto` (#1288 에서 도입, "응답 값 vs DTO 선언" 대조), `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` (선언 vs 선언, 정적)
  - 상세: 세 검증자가 이름은 다르지만 개념적으로 인접(모두 "민감 정보 노출 방지")하다. 그러나 target 문서 자신의 주석(`user-secret-absence.ts` 헤더, `user-entity-exposure-guard.ts` 헤더)이 세 검증자의 경계를 명시적으로 구분해 놓았고("이 도구는 이름만 보고 판정하므로 배선 여부와 독립"), 실제 식별자 문자열도 겹치지 않는다. `MEMORY` 교훈("`response-contract`(값 vs 선언, 런타임) ≠ `swagger-dto-contract-guard`(선언 vs 선언, 정적)")에 이번 3번째 축("이름 기반 값 스윕, 선언 무관")이 자연스럽게 추가되는 형태라 혼동 위험은 낮다.
  - 제안: 조치 불요. 단, 세 검증자가 늘어나는 추세이므로 추후 `spec/conventions/` 에 "응답 노출 방어 3축(계약 대조/선언 대조/이름 스윕)" 표를 만들면 다음 사람이 어떤 걸 언제 쓰는지 더 빨리 찾을 수 있다(제안일 뿐, 이번 PR 범위는 아님).

- **[INFO]** e2e 테스트 레터 ID `J.` 가 알파벳 순서를 깨고 `D.`와 `E.` 사이에 물리적으로 삽입됨
  - target 신규 식별자: `workspace-rbac.e2e-spec.ts` 의 `it('J. GET /:id/members — …')`
  - 기존 사용처: 같은 파일의 `A, S, B, C, D, E, F, G, H, I` (레터 자체는 유일하며 충돌 없음. `S` 도 이미 알파벳 밖에 있어 선례가 있다)
  - 상세: 레터 문자열 자체는 기존 어떤 테스트와도 겹치지 않아 **식별자 충돌은 아니다**. 다만 물리적 위치가 논리적 순서(`D → J → E`)를 깨서, 다음 사람이 "다음 사용 가능한 레터"를 정할 때 파일을 끝까지 훑어야 한다.
  - 제안: 조치 불요(비차단). 여유가 있으면 `J.` 테스트를 파일 끝(`I.` 뒤)으로 옮기면 레터-위치 일치가 회복된다.

- **[INFO]** 신규 fixture 경로 `repo-guards/__tests__/fixtures/user-relation-load.fixture.ts` — 같은 디렉토리에 두 가지 fixture 명명 컨벤션이 공존
  - target 신규 식별자: `codebase/backend/src/repo-guards/__tests__/fixtures/user-relation-load.fixture.ts` (중첩 `fixtures/` 디렉토리 + `.fixture.ts` 접미)
  - 기존 사용처: 같은 `repo-guards/__tests__/` 아래 `audit-action-binding-fixture.ts` · `engine-error-code-anchor-fixture.ts` · `eslint-unicorn-peer-fixture.ts` (평면 배치, `-fixture.ts` 접미, 점 없음) — 반면 `fixtures/dto/responses/optional-nullable.fixture.ts` 는 target 과 동일한 중첩+점 패턴
  - 상세: 두 컨벤션은 이 PR 이전부터 이미 공존했다(`optional-nullable.fixture.ts` 선례). target 은 기존 두 패턴 중 하나를 그대로 따랐을 뿐 새 충돌을 만들지 않았다 — 다만 어느 쪽이 정본인지 명시된 규약 문서가 없어 세 번째 패턴이 또 생길 여지는 있다.
  - 제안: 조치 불요(이번 PR 책임 밖). `spec/conventions/` 또는 개발자 SKILL 에 repo-guards fixture 배치 규칙을 한 줄 명문화하면 다음 분기를 막을 수 있다.

신규 요구사항 ID·엔티티/타입명·API endpoint·이벤트/메시지명·환경변수는 이번 diff 에서 **하나도 새로 생기지 않았다** — 전부 기존에 이미 존재하던 엔드포인트(`GET /api/workflows/:wfId/versions/:versionId`, `GET /api/workspaces/:id/members`, `GET /api/audit-logs`)·기존 엔티티 필드(`workspace_member.joined_at` ↔ 신규 노출 `WorkspaceMemberDto.joinedAt`, `spec/1-data-model.md:109` 와 의미 일치)·기존 클래스(`WorkflowVersionDto`/`WorkflowVersionCreatorDto`, diff 밖에서 이미 존재)에 대한 **방어 강화(투영 좁힘 + 테스트 추가)** 였다. `SRC_ROOT` 모듈-스코프 상수 중복 선언은 이미 3개 형제 가드 파일이 쓰던 기존 관용구(각 파일에서 독립적으로 재선언, `path.resolve(__dirname, '..', '..')`)를 새 4번째 가드가 그대로 따른 것이라 충돌이 아니다.

## 요약

target 은 `spec/5-system/` 을 전혀 건드리지 않았고(델타 0), 실제 변경은 `User` 엔티티 컬럼 과다 노출을 막는 코드 전용 PR(가드·테스트·DTO 필드 1개 추가)이다. 새로 도입된 식별자(`UserRelationLoad`, `collectUserRelationNames`, `findUserRelationLoads`, `USER_SECRET_KEYS`, `findUserSecretLeaks`, `expectNoUserSecrets`, DTO 필드 `joinedAt`, 파일 경로 2건)는 모두 고유하며 기존 spec 의 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수와 의미 충돌을 일으키지 않는다. 새 API endpoint·webhook/queue 이벤트·ENV var 는 도입되지 않았다. 발견된 3건은 전부 INFO 등급(검증자 3축 분리 안내, 테스트 레터 물리 순서, fixture 배치 컨벤션 이원화)이며 차단 사유가 아니다.

## 위험도

NONE
