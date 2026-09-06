# API 계약(API Contract) 리뷰

## 개요

이번 diff 의 실질 프로덕션 API 표면 변경은 두 파일뿐이다 — 나머지(가드 3종, fixture, e2e,
`review_guard.py` 파서, `plan/`·`CHANGELOG.md`·과거 리뷰 산출물 사본)는 검출용 테스트
인프라이거나 문서/리뷰 아카이브다.

1. `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` —
   `findOne()`(`GET /api/workflows/:wfId/versions/:versionId`)이 `creator` 관계를
   투영 없이 로드해 `User` 전 컬럼(`passwordHash`·`twoFactorSecret`·복구 코드·계정 탈취용
   토큰 포함)을 그대로 응답에 실었던 것을, 자매 메서드 `findByWorkflow` 와 같은
   `CREATOR_PROJECTION`(`id`/`name`/`email`)으로 좁혔다.
2. `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts` —
   `WorkspaceMemberDto` 에 `joinedAt: string | null` 필드를 추가.

## 발견사항

- **[INFO]** `findOne` 투영 수정은 breaking change 가 아니라 **선언-실제 간극을 닫는
  contract 수정**
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` —
    `findOne()` 함수, `CREATOR_PROJECTION` 상수 선언부
  - 상세: `WorkflowVersionCreatorDto`(`workflow-version-response.dto.ts`)는 이전부터
    `id`/`name`/`email` 3필드만 광고하고 있었다. `findOne` 이 실제로는 `User` 전 컬럼을
    싣고 있었던 쪽이 **선언을 어긴 상태**였고, 이번 수정은 실제 응답을 선언에 맞춘 것이다.
    정상 클라이언트(선언된 3필드만 소비)에는 영향이 없고, 유출됐던 비밀 컬럼에 의존하는
    클라이언트는 애초에 존재해서는 안 된다. `workflow-versions.service.spec.ts` 가
    `CREATOR_PROJECTION` 키 집합을 `WorkflowVersionCreatorDto` 의 OpenAPI 스키마와
    코드로 대조하고, 신규 e2e(`workflow-crud.e2e-spec.ts` 케이스 H)가 `creator` 키가
    정확히 `['email','id','name']` 인지 양성으로 고정해 재발을 잡는다. 응급 보안 패치이자
    올바른 계약 정합화로 판단해 CRITICAL 이 아닌 INFO 로 남긴다(보안 관점 심각도는
    `security` 리뷰어 소관).

- **[INFO]** `WorkspaceMemberDto.joinedAt` 추가는 하위 호환적이며, 이미 wire 에 있던
  필드를 뒤늦게 선언한 것
  - 위치: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts`
    — `WorkspaceMemberDto` 클래스, `joinedAt` 필드
  - 상세: `WorkspacesService.listMembers` 는 이전부터 `joinedAt: m.joinedAt` 을 무조건
    실었으나 DTO 에 선언돼 있지 않았다 — OpenAPI 스키마가 실제 응답보다 좁았던 상태.
    프런트엔드(`codebase/frontend/src/lib/api/workspaces.ts:10`)는 이미
    `joinedAt: string | null` 로 소비 중이었으므로, 이번 추가는 새 필드를 wire 에 얹는
    것이 아니라 **기존 wire 를 계약에 등재**하는 것이다. 필드 추가 자체는 기존
    클라이언트(신규 필드를 모르는 소비자)에게도 안전한 additive 변경이다. `nullable: true`
    선언은 DB 스키마(`joined_at TIMESTAMPTZ`, NOT NULL 없음) 기준이고, 코드 실측(행 생성
    4자리 전부 `new Date()` 즉시 채움)과는 다르다는 점을 필드 주석이 정확히 구분해서
    적어 두었다 — "상시 키 존재 + 값은 스키마상 nullable" 이라는 §5.4 표기가 실제 도달
    가능성과 어긋나지 않는다.

- **[INFO]** 프런트엔드 `WorkflowVersionDetail` 타입이 백엔드 `creator` 계약보다 넓게
  남아 있음 (이미 코드 주석으로 disclose, 이번 PR 범위 밖)
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:46-60`
    (`WorkflowVersionDetail` 타입 선언부 JSDoc) — 대응 프런트엔드 선언은
    `codebase/frontend/src/lib/api/workflows.ts` 의 동명 타입(공유 타입 패키지 미경유,
    손 미러)
  - 상세: 백엔드는 이번 PR 로 `creator` 를 `{ id, name, email }` 3필드 **고정**으로
    좁혔는데, 프런트엔드의 손-미러 선언은 `creator?: { id, name?, email? } | null` 로 각
    필드가 옵셔널이다. 현재는 프런트엔드가 더 넓은 타입이라 런타임 오류로 이어지지는
    않지만, 두 선언이 이름은 같고 내용은 다른 상태가 유지되면 향후 어느 한쪽만 좁히거나
    넓힐 때 grep 이 "유일 정의" 로 오판하게 만든다 — 이미 이 브랜치 자체가 그 오판을
    3라운드 연속 겪었다고 주석에 실측돼 있다. 개명·공유 패키지화는 이번 PR 범위 밖으로
    명시돼 있으므로 새 지적이 아니라 확인 기록으로 남긴다.
  - 제안: 별도 후속 작업으로 `WorkflowVersionDetail`/`WorkflowVersionListItem` 을 공유
    타입 패키지로 옮기거나 최소한 이름을 분리해 두 선언이 독립적으로 검색되게 한다(이미
    plan/코드 주석에 인지돼 있으므로 강제 사항 아님).

- **[INFO]** 신설 가드 3종·헬퍼는 런타임 API 표면을 바꾸지 않는 정적/테스트 도구
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts`,
    `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation-guard.ts`,
    `codebase/backend/src/shared/testing/user-secret-absence.ts`
  - 상세: 세 파일 모두 AST 정적 스캔이거나 e2e 응답 본문을 사후에 훑는 단언 헬퍼로, 실제
    엔드포인트 URL·상태 코드·요청 검증·페이지네이션·인증/인가 로직을 변경하지 않는다.
    API 계약 관점에서는 "계약을 지키는지 검사하는 도구가 늘었다" 는 사실만 해당되며,
    계약 자체의 변경은 없다.

에러 응답 형식(`NotFoundException({ code, message })`)·URL 설계(`GET /:id/members`,
`GET /:wfId/versions/:versionId`)·인증/인가(두 엔드포인트 모두 기존 `Authorization`/
`X-Workspace-Id` 가드를 그대로 사용, 신규 e2e 는 기존 가드 통과 전제 위에서 응답 *형태*만
추가로 검증)·버전 관리(API 버전 접두어·스키마 버전 변경 없음)·페이지네이션(두 대상 모두
워크스페이스 단위로 자연히 소수인 목록이라 기존과 동일하게 비페이징 유지, 이번 PR 이 새로
도입하거나 변경한 페이지네이션 없음)에는 이번 diff 로 인한 변경이 없다.

## 요약

이번 변경의 API 계약 표면은 매우 좁다 — 실제 프로덕션 응답 스키마에 영향을 준 파일은
`workflow-versions.service.ts`(투영 누락으로 `User` 전 컬럼이 새던 것을 선언된 3필드로
좁힘)와 `workspace-response.dto.ts`(이미 wire 에 있던 `joinedAt` 을 뒤늦게 선언)
둘뿐이며, 둘 다 breaking change 가 아니라 **선언과 실제 응답 사이의 기존 간극을 닫는**
방향의 수정이다. 나머지 대부분(구조/이름 기반 노출 검출 가드 2종, JSDoc 인용 가드,
다수의 e2e 케이스, `review_guard.py` frontmatter 파서 수정, 방대한 `plan/`·`review/`
아카이브)은 계약 위반을 검출·회귀 방지하는 테스트·툴링이거나 이 저장소 리뷰 프로세스의
산출물이라 런타임 API 표면과 무관하다. URL 설계·에러 응답 형식·인증/인가·버전 관리·
페이지네이션은 이번 diff 로 변화가 없고, 유일하게 남는 관찰은 프런트엔드의 손-미러
`WorkflowVersionDetail` 타입이 백엔드보다 느슨하게 남아 있다는 점인데 이미 코드 주석으로
disclose 되어 있고 이번 PR 의 명시적 범위 밖이다.

## 위험도

LOW
