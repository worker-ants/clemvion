# 보안(Security) 리뷰

## 개요

이번 변경(브랜치 `user-entity-column-defense`)의 실질 코드 스코프는 `meta.json` 기준 20개
소스/테스트 파일이다(그 외 `plan/**`·`review/**` 는 이전 리뷰 라운드의 산출물이 재커밋된
문서로, 실행되는 코드가 아니다). 핵심은 `User` 엔티티의 민감 7컬럼
(`passwordHash`·`twoFactorSecret`·`totpRecoveryCodes`·`webauthnRecoveryCodes`·
`emailVerifyToken`·`passwordResetToken`·`emailChangeToken`)이 응답으로 새는 것을 막는
검출 인프라 신설이며, 그 과정에서 실제로 살아 있던 Critical 유출 하나를 발견해 같은 커밋에서
고쳤다.

## 발견사항

- **[INFO]** (수정 완료, 회귀 아님) `WorkflowVersionsService.findOne` 이 `User` 전 컬럼을
  투영 없이 로드해 `GET /api/workflows/:wfId/versions/:versionId` 로 내보내고 있었다 —
  이번 커밋이 직접 고쳤다.
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts`
    (`findOne` 메서드, `CREATOR_PROJECTION` 상수) — diff 상 `relations: { creator: true }`
    뒤에 `select: { …, creator: CREATOR_PROJECTION }` 를 추가한 지점.
  - 상세: 종전 코드는 `relations: ['creator']` 만 주고 `select` 투영이 없어 TypeORM 이
    `User` 테이블 전 컬럼을 로드했고, 컨트롤러가 이를 가공 없이 반환했다. 자매 메서드
    `findByWorkflow` 는 처음부터 `creator: { id, name, email }` 투영을 갖고 있었다 —
    두 메서드 중 하나만 옳았던 전형적인 "복제된 정책이 한쪽만 갱신됨" 결함이다. 실측
    (커밋 메시지 인용): 도달 권한은 해당 워크스페이스 멤버(viewer 포함)이고, 이미 나간
    응답은 회수 불가 — 저장·로깅·캐시한 소비자가 있었다면 비밀번호 해시·2FA 복구 코드가
    남아 있을 수 있다는 것이 CHANGELOG 에 명시돼 있다.
  - 처리: 이미 이번 diff 안에서 `CREATOR_PROJECTION` 투영 + 단위테스트(3중: 옵션 전체
    비교, 투영 단독 비교, DTO 스키마 대조) + e2e(`workflow-crud.e2e-spec.ts` `H.`)로 닫혔다.
    추가 조치 불요 — 새 유출이 아니라 이번 PR 이 잡아 고친 항목이므로 재조치 대상 아님.
    다만 **이미 노출된 값 자체**(과거 응답을 저장했을 수 있는 로그·캐시·APM)의 사후
    로테이션(비밀번호 해시 재발급은 불가하나 2FA 복구 코드·토큰류는 무효화 가능) 여부는
    이 diff 범위 밖이라 별도 확인이 필요하다면 그 결정은 이 리뷰 밖에서 내려야 한다.

- **[INFO]** 응답 DTO JSDoc 을 통한 내부 리뷰 경로/일시 노출 — 기존 2건, 이번 PR 은
  검출만 하고 수정하지 않음(의도적으로 동결)
  - 위치: `codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts`
    (`ScheduleTriggerWorkflowRefDto` 클래스 JSDoc, `review/consistency/2026/09/06/00_48_52`
    문자열 포함), `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts`
    (`TriggerWorkflowRefDto` 클래스 JSDoc, 같은 문자열).
  - 상세: 두 클래스의 `/** */` JSDoc 은 `@nestjs/swagger` 의 `introspectComments` 로
    공개 OpenAPI `description` 이 되므로, 내부 리뷰 폴더 경로·타임스탬프(`review/consistency/
    2026/09/06/00_48_52`)가 Swagger 문서를 열람할 수 있는 누구에게나 노출된다. 직접 실측
    (`Read` 로 두 파일 확인)해 이번 PR 이 새로 신설한 `dto-jsdoc-citation.spec.ts` 의
    `EXPECTED_DTO_JSDOC_CITATIONS` 베이스라인(정확히 이 두 항목)과 일치함을 확인했다 —
    새로 생긴 것이 아니라 `#1291` 부터 있던 기존 상태를 이번 PR 이 처음으로 계량화(래칫)한
    것이다. 노출되는 내용은 자격증명이 아니라 "내부 리뷰 프로세스가 존재하고 언제
    실행됐는가" 라는 메타정보라 심각도는 낮다. 완화 요인: `codebase/backend/src/main.ts`
    가 `SwaggerModule.setup('docs', …)` 를 `ENABLE_SWAGGER_IN_PROD` opt-in 뒤에 게이팅해
    프로덕션 기본값은 비공개다.
  - 제안: 이번 PR 스코프는 아니다(`review-citations.md §4` 가 "기존 인용은 소급 정리
    대상이 아니다" 로 명시). 다음에 이 두 DTO 를 건드릴 때 인용을 `//` 로 옮기면 된다 —
    이미 이 규약과 회피처가 문서화돼 있어 별도 조치 불필요.

- **[INFO]** 신규 방어 계층은 검출(detect) 전용이며 실행 시점 차단(prevent)이 아님 —
  설계 문서에 이미 명시된 트레이드오프, 결함 아님
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts`,
    `codebase/backend/src/shared/testing/user-secret-absence.ts` 헤더 주석.
  - 상세: `select: false`/`@Exclude()`/전역 `ClassSerializerInterceptor` 를 채택하지 않고
    (CI 시점 AST 정적 스캔 + e2e 런타임 단언)만 도입했다. 이는 CHANGELOG 에 실측 근거
    (19개 호출지점 공유 깔때기, 46개 호출부, fail-silent 인증 회귀 위험)와 함께 명시된
    의도적 선택이라 결함으로 보지 않는다. 다만 **다음 PR 이 CI 를 우회하고 직접 배포**하는
    경로가 있다면(예: 긴급 hotfix 로 테스트 스킵) 이 방어선은 무력화된다는 한계는 남아
    있다 — 이 diff 의 스코프는 아니고 CHANGELOG 자신도 "실행 시점에 막지 않는다" 로 이미
    disclose 했으므로 재지적하지 않는다.

- **[INFO]** `TriggersService.rethrowEndpointPathConflict` 가 노출하는 에러 정보는
  안전한 수준
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts`
    (`rethrowEndpointPathConflict` 메서드).
  - 상세: DB 인덱스명(`idx_trigger_workspace_endpoint`)이나 SQLSTATE 는 클라이언트로
    나가지 않고 소스에만 있다. 클라이언트에는 일반화된 한국어 메시지와 계약된
    `code`/`details.field`/`details.subCode` 만 실린다 — 내부 구현 세부(인덱스명, 쿼리
    형태)의 에러 메시지 유출 없음. `isEndpointPathUniqueViolation` 이 인덱스명으로
    좁혀 다른 UNIQUE 위반과 혼동하지 않는 것도 단위테스트(반대 방향 대조군 포함)로
    확인했다.

## 요약

이번 변경은 새로운 취약점을 도입하지 않았고, 오히려 실제로 살아 있던 Critical 정보노출
(워크플로우 버전 상세 API 가 `User` 전 컬럼 — 비밀번호 해시·2FA 시크릿·복구 코드·계정
탈취 토큰 — 을 반환하던 결함)을 이번 커밋에서 직접 발견·수정했고, 같은 클래스의 재발을
막는 AST 기반 정적 가드(구조 축)와 응답 바디 깊이 순회 런타임 단언(이름 축) 두 겹을
신설했다. `USER_SECRET_KEYS` 목록은 `user.entity.ts` 의 실제 컬럼과 정확히 일치함을 직접
대조해 확인했고, 프로덕션 `leftJoin`/`select` 사용 지점(`listMembers`, `auth.service.ts`
의 `logout`/`refresh`)도 직접 읽어 실제로 필드를 선별 매핑하거나 응답에 싣지 않음을
확인했다. 유일한 잔여 사항은 두 응답 DTO 의 JSDoc 에 남아 있는 내부 리뷰 경로/일시
노출(낮은 심각도, 기존 부채, 의도적으로 동결·문서화됨)이며 이번 PR 의 책임 범위가 아니다.
하드코딩된 시크릿, 인젝션 벡터, 인증/인가 우회, 안전하지 않은 암호화는 발견되지 않았다.

## 위험도

NONE
