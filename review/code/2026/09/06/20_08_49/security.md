# 보안(Security) 리뷰

## 개요

`git diff origin/main...HEAD` 는 358개 파일(대부분 과거 리뷰 라운드의 산출물 `review/**`, `plan/**` 문서)을 포함하지만, 실질적인 코드 변경은 아래 25개 파일로 좁혀진다. 이번 변경의 핵심은 **실제로 존재했던 `User` 엔티티 컬럼 유출 취약점의 수정**과, 같은 유출 클래스의 재발을 막는 **검출용 정적 가드 2종 신설**이다.

- `.claude/hooks/_lib/review_guard.py`, `.claude/tests/test_review_guard.py` — 리뷰 게이트의 YAML frontmatter 파서 버그 수정 (dev-tooling, 저장소 로컬 markdown만 파싱, 외부 입력 없음)
- `codebase/backend/src/common/db/pg-error.ts`/`.spec.ts`, `.../pg-error-fixtures.ts` — Postgres 에러의 SQLSTATE/제약 이름 추출 헬퍼
- `codebase/backend/src/modules/triggers/{triggers.controller,triggers.service,triggers.service.spec}.ts` — `endpoint_path` UNIQUE 충돌을 문서화된 409 응답 형태로 변환
- `codebase/backend/src/modules/workflow-versions/{workflow-versions.service,workflow-versions.service.spec}.ts` — **`findOne` 이 `User` 전 컬럼을 그대로 반환하던 실제 취약점 수정**
- `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts`, `.../workspaces.service.spec.ts` — `WorkspaceMemberDto.joinedAt` 선언 추가 + `listMembers` 투영 단위 테스트
- `codebase/backend/src/repo-guards/__tests__/{user-entity-exposure-guard,user-entity-exposure.spec,dto-jsdoc-citation-guard,dto-jsdoc-citation.spec}.ts` + fixtures — 신규 정적 검출 가드 2종
- `codebase/backend/src/shared/testing/{user-secret-absence,user-secret-absence.spec}.ts` — 응답 본문 깊이 훑기 기반 비밀 컬럼 부재 단언 헬퍼
- `codebase/backend/test/{audit-logs.e2e-spec,workflow-crud.e2e-spec,workspace-rbac.e2e-spec}.ts` — 위 헬퍼를 배선한 e2e
- `codebase/frontend/src/lib/api/workflows.ts` — 주석 추가만(타입 미러 경고)

## 발견사항

- **[INFO]** 실제 존재했던 정보 노출(Critical) 취약점이 이 diff 안에서 수정됨 — `WorkflowVersionsService.findOne`
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` — `findOne` 메서드(신규 `select: { … creator: CREATOR_PROJECTION }` 절)
  - 상세: 수정 전에는 `relations: ['creator']` 로 `WorkflowVersion.creator`(`@ManyToOne(() => User)`)를 투영 없이 로드했고, 컨트롤러가 가공 없이 그대로 반환했다. 즉 `GET /api/workflows/:wfId/versions/:versionId` 가 워크스페이스 멤버(viewer 포함)에게 버전 작성자의 `passwordHash`·`twoFactorSecret`·`totpRecoveryCodes`·`webauthnRecoveryCodes`·`passwordResetToken`·`emailVerifyToken`·`emailChangeToken` 7개 비밀 컬럼을 전부 노출했다(CWE-200 / OWASP API3:2023 Broken Object Property Level Authorization 성격). 자매 메서드 `findByWorkflow` 는 처음부터 `select` 투영이 있었던 반면 `findOne` 만 누락돼 있었다. 이번 diff 는 두 메서드가 공유하는 `CREATOR_PROJECTION` 상수를 도입해 `id`/`name`/`email` 3필드로 컬럼 레벨 투영을 걸었고, `WorkflowVersionCreatorDto` 의 OpenAPI 스키마와 상수 키를 대조하는 테스트(`workflow-versions.service.spec.ts`)로 두 자리가 다시 갈리는 것을 막았다. 신규 e2e(`workflow-crud.e2e-spec.ts` "H." 케이스)가 이름 축(`expectNoUserSecrets`) + 계약 축(`assertMatchesContract`) + 양성 축(정확히 3필드) 세 그물로 회귀를 봉인한다.
  - 제안: 조치 불요 — 이미 수정·테스트·문서화(CHANGELOG "영향: 이미 나간 것은 회수되지 않는다")까지 완료됨. 실서비스에 배포된 적이 있다면(과거 커밋 이력 확인 필요) 유출 시점 이후 발급된 워크플로우 버전 작성자 전원의 비밀번호 해시·2FA 시크릿 로테이션을 별도 운영 작업으로 검토할 것을 권고.

- **[INFO]** 새 정적 가드 2종이 `User` 엔티티 컬럼 노출 재발을 방지하는 방어 계층으로 신설됨
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts` (구조 축 — `User` 타입 관계를 투영 없이 통째로 로드하는 자리를 AST 로 탐지), `codebase/backend/src/shared/testing/user-secret-absence.ts` (값 축 — 응답 본문을 재귀적으로 훑어 `USER_SECRET_KEYS` 7개 + snake_case 변형의 부재를 단언)
  - 상세: 구조 축은 `relations` 배열/객체·`leftJoinAndSelect`/`innerJoinAndSelect` 세 형태를 다루고, 관계 이름 집합을 손으로 나열하지 않고 엔티티 타입 주석에서 파생시켜 `creator`/`executor`/`owner`(이름이 `user` 가 아닌 `User` 타입 관계)까지 커버한다. `@ManyToOne(..., { eager: true })` 처럼 호출부에 흔적이 남지 않는 형태는 별도 축(`findEagerUserRelations`)으로 엔티티 데코레이터를 직접 검사해 보완한다. 값 축은 `select: false`/`@Exclude()`/전역 `ClassSerializerInterceptor` 가 전무한 이 저장소에서 "선언과 무관하게" 실제 응답 값을 훑으므로, 감사 로그 유출처럼 DTO 미선언 유출뿐 아니라 실수로 비밀 필드를 DTO 에 선언까지 한 경우도 잡는다. 양쪽 다 mutation 검증(술어를 무력화한 뮤턴트로 실패 확인)을 거쳤다고 문서화되어 있고 실제 fixture 로 확인했다.
  - 제안: 조치 불요. `listMembers`(수동 JS 매핑이라 구조 축이 원리적으로 못 보는 유일한 자리)에 대한 안전망이 e2e 하나(`workspace-rbac.e2e-spec.ts` "J.")에만 의존한다는 점은 코드 주석·이번 리뷰 라운드의 `maintainability`/`scope` 리뷰가 이미 명시적으로 disclose 하고 있으므로 신규 지적 아님.

- **[INFO]** `TriggersService` 의 UNIQUE 충돌 처리에서 다른 UNIQUE 위반 오류를 원본 그대로 재던짐
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `rethrowEndpointPathConflict` 메서드
  - 상세: `isEndpointPathUniqueViolation` 이 아닌 다른 Postgres 오류는 `throw err;` 로 원본 그대로 전역 예외 필터에 위임한다. 전역 필터의 처리 방식은 이 diff 범위 밖이라 직접 확인하지 않았으나, TypeORM `QueryFailedError` 는 종종 원본 SQL 쿼리 문자열을 포함하므로 그 필터가 `err.message`/`err.query` 를 클라이언트 응답에 그대로 노출하는 형태라면 정보 노출로 이어질 수 있다. 다만 이 자리는 그 필터 동작을 바꾸지 않고 기존 계약(전역 `RESOURCE_CONFLICT` 매핑)을 그대로 위임하는 것이므로 이번 diff 가 새로 만든 위험이 아니다.
  - 제안: 별도 확인 필요 시 `GlobalExceptionFilter` 가 `QueryFailedError`/`Error` 를 클라이언트에 매핑할 때 `message`/`query`/`parameters` 를 그대로 wire 로 내보내는지 점검(이번 diff 범위 밖).

- **[INFO]** `TriggersService.rethrowEndpointPathConflict` 의 에러 메시지·`details` 는 SQL 스키마 세부(제약 이름·컬럼명)를 클라이언트에 노출하지 않음
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:rethrowEndpointPathConflict`
  - 상세: `ConflictException` 의 `message`/`details.field`/`details.code` 는 모두 도메인 용어(`endpoint_path`, `TRIGGER_ENDPOINT_PATH_CONFLICT`)이고 실제 인덱스 이름(`idx_trigger_workspace_endpoint`)이나 원본 SQL 예외를 그대로 노출하지 않는다. 양호.

- **[INFO]** 하드코딩된 시크릿·자격증명 없음
  - 위치: 변경된 25개 실 코드 파일 전체(`git diff origin/main...HEAD` 대상)
  - 상세: 추가된 라인 전체를 `(api_key|secret|password|token)\s*[:=]\s*['"]<8자 이상>` 패턴으로 스캔했으나 매치 없음. `USER_SECRET_KEYS` 등 테스트 fixture 의 값은 전부 `'x'`·`'$2b$10$x'` 같은 플레이스홀더이고 실제 자격증명이 아니다.

## 요약

이번 diff 의 실질 코드 변경분(25개 파일)은 신규 취약점을 도입하지 않았고, 오히려 실재했던 정보 노출 Critical 취약점(`WorkflowVersionsService.findOne` 이 `GET /api/workflows/:wfId/versions/:versionId` 를 통해 워크스페이스 멤버 누구에게나 버전 작성자의 비밀번호 해시·2FA 복구 코드·계정 탈취 토큰을 노출)을 수정하고, 같은 클래스의 재발을 막는 이중 검출 가드(구조 축 AST 스캔 + 값 축 응답 본문 깊이 훑기)를 신설했다. 각 방어 로직은 mutation 검증(술어를 무력화해 실패를 확인)을 거쳤고, e2e 3건이 실제 응답 wire 를 대조한다. 인젝션·인증/인가 우회·하드코딩 시크릿·안전하지 않은 암호화·평문 전송 등 다른 OWASP Top 10 항목에서는 이번 diff 범위 내 신규 결함을 발견하지 못했다. 유일한 열린 질문(에러 필터가 원본 SQL 예외를 그대로 노출하는지)은 이번 diff 가 만든 것이 아니라 diff 범위 밖의 기존 전역 필터 동작에 관한 것이라 INFO 로만 기록한다.

## 위험도

NONE
