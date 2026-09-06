# 보안(Security) 리뷰

## 개요

이번 diff(`origin/main...HEAD`, 7개 커밋)의 핵심은 `User` 엔티티 컬럼 노출 방어다.

1. **실제 취약점 수정** — `WorkflowVersionsService.findOne`(`GET /api/workflows/:wfId/versions/:versionId`)이 `relations: ['creator']` 를 투영 없이 로드해 `User` 전 컬럼(`passwordHash`·`twoFactorSecret`·`totpRecoveryCodes`·`webauthnRecoveryCodes`·`emailVerifyToken`·`passwordResetToken`·`emailChangeToken`)을 컨트롤러가 가공 없이 그대로 반환하고 있었다. 이번 diff 가 `select: CREATOR_PROJECTION`(`id`/`name`/`email`)을 추가해 닫았다.
2. **검출 가드 3종 신설** — 구조 축(`user-entity-exposure-guard.ts`, `@ManyToOne(() => User)` 형태의 관계를 투영 없이 싣는 자리 AST 스캔 + eager 관계 축), 이름 축(`user-secret-absence.ts`, 응답 본문을 깊이 훑어 7개 민감 키 이름의 부재를 단언), 문서 축(`dto-jsdoc-citation-guard.ts`, 응답 DTO JSDoc 에 내부 리뷰 경로가 공개 OpenAPI description 으로 유출되는 것을 검출).
3. 신규 e2e 3건(`workflow-crud.e2e-spec.ts` H, `workspace-rbac.e2e-spec.ts` J, `audit-logs.e2e-spec.ts` 보강)이 위 검출 축을 실제 엔드포인트에 배선했다.

## 검증한 것

- `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` 를 직접 열어 `findOne`/`findByWorkflow` 두 메서드 모두 `creator: CREATOR_PROJECTION`(`{ id, name, email }`)으로 투영됨을 확인. 컨트롤러(`workflow-versions.controller.ts`)는 서비스 반환값을 가공 없이 그대로 리턴하므로, 이 투영이 유일한 방어선이고 실제로 걸려 있다.
- `USER_SECRET_KEYS`(7개)를 `codebase/backend/src/modules/users/entities/user.entity.ts` 의 `@Column` 전체와 대조 — 자격증명·토큰류 컬럼(`passwordHash`, `twoFactorSecret`, `totpRecoveryCodes`, `webauthnRecoveryCodes`, `emailVerifyToken`, `passwordResetToken`, `emailChangeToken`) 7개와 정확히 일치. 나머지 컬럼(`oauthProviderId`, `pendingEmail`, `lockedUntil` 등)은 자격증명이 아니라 이 목록에서 제외된 것이 타당하다.
- `grep -rln`으로 `User` 타입 관계(`creator`/`user`/`owner`/`executor`)를 투영 없이 싣는 자리를 저장소 전체에서 재탐색 — `auth.service.ts`(logout/refresh, `stored.user.id`/`email` 만 내부 소비), `workspaces.service.ts`(`listMembers`, 응답 전 수동 재투영), `workflow-versions.service.ts`(이번에 고침) 세 자리뿐이며, 가드의 화이트리스트(`EXPECTED_USER_RELATION_LOADS`)·investigate 결과와 일치. `executions.service.ts` 의 `executor` 관계는 `leftJoin`+`addSelect(['executor.id','executor.name'])` 로 이미 안전하게 투영되어 가드 대상 밖(정상)임을 확인.
- `CREATOR_PROJECTION` ↔ `WorkflowVersionCreatorDto` OpenAPI 스키마 대조 테스트(`workflow-versions.service.spec.ts`)가 신설되어, 향후 DTO 필드 추가/투영 상수 변경 중 한쪽만 바뀌는 회귀를 자동으로 잡는다.
- diff 전체에서 하드코딩된 시크릿·API 키·실 자격증명 패턴 검색 — 발견 없음(테스트 fixture 의 더미 값 제외).
- SQL/커맨드 인젝션 벡터 — 이번 diff 는 TypeORM `select`/`relations` 옵션 객체에 정적 리터럴만 사용하고, 사용자 입력이 쿼리 구조에 도달하는 경로는 없음.

## 발견사항

- **[INFO]** 검출 가드 3종은 실행 시점 방어가 아니라 정적/테스트 시점 검출이다
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts`, `codebase/backend/src/shared/testing/user-secret-absence.ts`
  - 상세: `select: false`(공유 로더 19곳/46개 호출 지점 재배선 필요, 실수 시 `comparePassword(x, undefined)` fail-silent 위험)와 전역 `ClassSerializerInterceptor`(응답 직렬화 최초 도입으로 wire 전체 변경)를 실측 근거로 명시적으로 기각하고 검출 방식을 택했다고 CHANGELOG·가드 JSDoc 에 투명하게 밝히고 있다. 즉 이번 방어는 "새 코드가 CI/리뷰를 통과하지 못하게 막는" 래칫이지, 런타임에 이미 배포된 코드나 가드를 우회한 경로(예: raw query, 다른 스캔 범위 밖 파일)를 막지는 못한다.
  - 제안: 조치 불요(설계 근거가 실측되어 있고 대안의 위험이 더 큼을 이미 확인함). 다만 향후 `select: false`/직렬화 인터셉터 도입 시점을 결정할 트리거 조건(예: 공유 로더 리팩터링 계기)을 plan 에 남겨 두면 이 트레이드오프가 "영구 방치"로 굳어지지 않는다.

- **[INFO]** 이름 축(`user-secret-absence.ts`)의 배선이 아직 일부 엔드포인트에만 존재
  - 위치: `codebase/backend/test/audit-logs.e2e-spec.ts`, `codebase/backend/test/workspace-rbac.e2e-spec.ts`(J), `codebase/backend/test/workflow-crud.e2e-spec.ts`(H) — 3개 e2e 파일에만 `expectNoUserSecrets` 호출
  - 상세: 구조 축 가드가 확인한 "`User` 관계를 투영 없이 싣는 자리 3곳"(logout/refresh/listMembers) 중 실제로 응답에 실리는 자리(listMembers→`GET /:id/members`)와, 이번에 고친 `findOne`에는 이름 축이 배선됐지만, 향후 새 엔드포인트가 구조 축을 통과(투영 있음)한 채로 다른 형태(예: raw SQL alias, 구조 축 스캔 범위 `src/modules` 밖)로 유출하면 이름 축도 못 잡는다. 이는 이번 PR 이 명시적으로 "완결"이 아니라 "3축 중 실측된 자리부터 배선"이라고 밝힌 점진적 확장이므로 새로운 결함은 아니다.
  - 제안: 조치 불요 — 이미 plan(`spec-draft-nullable-notation-followups.md`)에 후속 등재됨.

- **[INFO]** DTO JSDoc 인용 가드의 베이스라인에 남은 두 자리는 여전히 내부 리뷰 경로를 공개 OpenAPI description 으로 노출한다
  - 위치: `codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts#ScheduleTriggerWorkflowRefDto`, `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts#TriggerWorkflowRefDto` (가드 spec `dto-jsdoc-citation.spec.ts` 의 `EXPECTED_DTO_JSDOC_CITATIONS` 로 동결)
  - 상세: 정보 노출 자체의 민감도는 낮다(내부 리뷰 경로/날짜 문자열이며 자격증명이 아니다) — API 문서를 읽는 외부 소비자에게 저장소 내부 작업 이력의 존재를 알려주는 수준. 이번 PR 이 만든 문제가 아니고(`#1291` 이 만든 기존 자리), `review-citations.md §4`(소급 정리 대상 아님)에 따라 의도적으로 동결한다고 명시돼 있다. 새 위반은 가드가 즉시 잡으므로 확대되지는 않는다.
  - 제안: 조치 불요 — 이미 규약이 동결을 명시하고, 그 자리를 다음에 건드릴 때 함께 정리하는 정책이 문서화됨.

## 요약

핵심 변경은 실제로 존재했던 Critical 취약점(워크스페이스 멤버라면 누구나 `GET /api/workflows/:wfId/versions/:versionId` 로 버전 작성자의 `passwordHash`·2FA 시크릿·복구 코드·계정 탈취용 토큰을 전부 열람 가능했던 것)을 `select` 투영으로 닫은 보안 수정이며, 직접 코드를 열어 수정이 완전함(양쪽 조회 메서드 모두 투영, 컨트롤러가 가공 없이 반환)을 확인했다. 이와 함께 신설된 검출 가드 3종(구조/이름/문서 축)은 향후 같은 클래스의 결함이 재발하는 것을 정적·테스트 단계에서 막는 방어 심화(defense-in-depth)이고, 설계 근거(왜 `select:false`·전역 인터셉터를 기각했는지)가 실측과 함께 투명하게 문서화돼 있다. 하드코딩된 시크릿, 인젝션 벡터, 인증/인가 우회, 안전하지 않은 암호화는 발견되지 않았다. 남은 항목은 전부 이미 문서화·plan 등재된 점진적 확장/트레이드오프이며 이번 라운드에서 새로 발견한 Critical/Warning 은 없다.

## 위험도

NONE
