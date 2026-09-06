# 보안(Security) 리뷰

## 개요

이 changeset(`96d3856a9`→`72c0bcc13`, feat 1 + fix 4 커밋)은 `User` 엔티티 민감 컬럼(7종:
`passwordHash`·`twoFactorSecret`·`totpRecoveryCodes`·`webauthnRecoveryCodes`·
`emailVerifyToken`·`passwordResetToken`·`emailChangeToken`) 노출을 잡는 검출 인프라 2축
(구조 AST 가드 `user-entity-exposure-guard.ts` + 값 기반 재귀 스캐너 `user-secret-absence.ts`)
을 신설하고, 그 과정에서 실제로 살아있던 유출(`WorkflowVersionsService.findOne` 이
`GET /api/workflows/:wfId/versions/:versionId` 로 버전 작성자의 `User` 전 컬럼을 투영 없이
반환)을 발견해 닫은 결과물이다. 이미 4개의 선행 리뷰 라운드(`10_13_22`→`11_55_36`)가 이
Critical 을 포함해 다수의 WARNING 을 처분했고, 이번은 그 누적 diff 전체에 대한 최종 라운드다.

## 검증 방법

저장소를 뮤테이션하지 않고 확인했다(`git status --short` 최종 확인 — 세션 산출물
디렉터리 2개만 untracked, 소스 변경 없음):

- `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` 를 직접 열어
  `findOne`/`findByWorkflow` 둘 다 `select: { …, creator: CREATOR_PROJECTION }` 로
  `{ id, name, email }` 세 필드만 투영함을 확인.
- `npx jest --config jest.config.ts user-entity-exposure user-secret-absence` — 25/25 통과.
- `grep -rn "relations:"` 로 `src/modules/**` 전체에서 `User` 타입 관계(`user`·`creator`·
  `owner`·`executor`)를 로드하는 자리를 전수 확인하고, 가드의 화이트리스트
  (`EXPECTED_USER_RELATION_LOADS` — `auth.service.ts#logout`·`#refresh`·
  `workspaces.service.ts#listMembers`)와 대조:
  - `auth.service.ts` 의 두 곳(`logout`/`refresh`) — `stored.user` 를 `user.id`/`user.email`
    로만 내부 소비(로그인 이력 기록), 응답으로 반환되지 않음. 안전.
  - `workspaces.service.ts#listMembers` — 로드 후 `{ id, userId, email, name, role,
    joinedAt }` 로 재매핑해 반환, `User` 원본 객체는 새지 않음. 안전.
  - `workflow-versions.service.ts` 의 두 자리 — 이번 diff 로 투영 추가돼 화이트리스트에서
    빠짐(이제 위반 목록에 없음). 확인됨.
- `grep -rn "JoinAndSelect"` — `User` 타입 관계에 대해 저장소 전체 **0건**. 구조 가드가
  이 형태의 래칫을 0으로 고정하는 것과 일치.
- `audit-logs.service.ts` 를 열어 선행 PR(#1288)이 고친 26키 유출(`leftJoinAndSelect`)이
  지금은 `leftJoin` + `addSelect(['user.id','user.name','user.email'])` 로 교체돼 있음을
  재확인 — 이번 diff 의 대상은 아니지만 새 가드가 이 자리를 계속 준수 형태로 인식하는지
  교차 확인차 열었다.
- `executions.service.ts`/`dashboard.service.ts` 의 `executor`(`Execution.executor: User |
  null`) 관계도 전부 `leftJoin` + `addSelect(['executor.id','executor.name'])` 로 투영돼
  있음을 확인 — CHANGELOG 가 주장하는 "타입 파생이 grep 보다 넓어 `executor` 를 추가로
  찾았다"는 서술과 실측이 일치한다.
- `user-entity-exposure.spec.ts` 를 열어 스캔 범위가 `src/modules`(프로덕션 코드) 전체이고,
  화이트리스트가 정확히 3자리(`toEqual` 로 정확 일치, 초과분도 실패로 잡음)임을 확인 —
  이는 문서상 주장이 아니라 **CI 로 강제되는 회귀 게이트**다.

## 발견사항

- **[WARNING]** 이 방어선은 검출(테스트 시점)이며 런타임 방지(요청 시점) 가 아니다 —
  구조적으로 인지된 residual risk
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts`
    (파일 전체) · `codebase/backend/src/shared/testing/user-secret-absence.ts` (파일 전체)
  - 상세: `User` 엔티티 자체에는 여전히 `select: false`·`@Exclude()`·`@Expose()`·전역
    `ClassSerializerInterceptor` 가 **0건**이다(CHANGELOG·가드 JSDoc 이 스스로 명시).
    즉 이번에 신설된 두 가드는 **테스트 스위트 실행 시점**에만 개입한다 — `npx jest` 를
    건너뛰거나(hook 우회), 스캔 범위 밖(`src/modules` 밖의 스크립트·raw query·향후
    admin/CLI 툴링·마이그레이션)에서 `User` 를 통째로 로드하는 코드가 생기면 이 두 가드
    어느 쪽도 실행 시점에 그 요청을 막지 못한다 — 응답이 나간 뒤에야(또는 CI 가 도는
    시점에야) 잡힌다. 이 자체는 이번 PR 이 스스로 "이것은 방어가 아니라 검출이다" 라고
    명시하며 `select: false`(fail-silent 인증 실패 위험, 19곳 공유 깔때기 재배선 필요)와
    전역 인터셉터(298개 e2e 가 보는 wire 전체 동작 변경) 를 실측 근거로 명시적으로
    기각한 **의도된 트레이드오프**다. 다만 보안 리뷰 관점에서는 "탐지 커버리지가 높다"는
    것과 "런타임에 방어선이 있다"는 것은 다른 주장이므로, 다음에 이 저장소가 커지면(특히
    `src/modules` 밖에서 `User` 를 다루는 새 표면 — 예: 배치 스크립트, 관리자 콘솔,
    GraphQL 리졸버 등) 이 갭이 재론의 대상이 되어야 한다는 점을 기록한다.
  - 제안: 현재 결정을 뒤집을 필요는 없다(이미 세 축 검토 후 실측 근거로 명시적 결정됨).
    다만 (a) CI 에서 이 가드 spec 이 required check 로 걸려 있는지, (b) `src/modules` 밖
    표면이 늘어나는 시점에 스캔 범위를 재검토할 트리거를 plan 에 남겨 두는 것을 권한다.

- **[INFO]** `expectNoUserSecrets` 의 실패 메시지는 위반 **경로**만 노출하고 값은 노출하지
  않는다 — 확인, 안전
  - 위치: `codebase/backend/src/shared/testing/user-secret-absence.ts` (`expectNoUserSecrets`)
  - 상세: `findUserSecretLeaks` 가 반환하는 `hits` 는 키 **경로**(`data.user.passwordHash`)
    뿐이고, 그 값 자체(예: 실제 bcrypt 해시)는 에러 메시지에 담기지 않는다. 이 헬퍼는
    테스트 실패 시 CI 로그에 노출되므로, 값까지 실었다면 CI 로그가 새로운 유출 경로가
    됐을 것이다. 지금 구현은 그 함정을 피해 간다.
  - 제안: 조치 불요 — 현재 설계가 안전한 형태임을 기록.

- **[INFO]** 신규 정적 가드(`user-entity-exposure-guard.ts`)는 로컬 소스 파일만 `fs.readFileSync`
  로 읽어 TypeScript AST 로 파싱한다 — 사용자 입력이나 네트워크 데이터를 다루지 않으므로
  인젝션·경로 탐색 표면이 없다
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts`
    (`forEachUserTypedProperty`, `findUserRelationLoads`)
  - 상세: 파일 경로는 `collectTsFiles(SRC_ROOT)` 로 저장소 내부 고정 루트에서만 파생되고,
    외부 입력이 경로 조합에 들어가지 않는다. `tsconfig.build.json` 의 `exclude` 에
    `src/repo-guards/**` 가 이미 있어(사전 리뷰 라운드가 확인) 이 devDependency(`typescript`
    패키지 API 사용)가 프로덕션 dist 로 새어 나가지 않는다.
  - 제안: 조치 불요.

## 확인된 항목 (재확인, 새 결함 아님 — 이전 라운드가 이미 처분)

- `WorkflowVersionsService.findOne`/`findByWorkflow` — `CREATOR_PROJECTION`(단일 상수,
  `Object.freeze`) 으로 통합돼 있고, `WorkflowVersionCreatorDto` 의 OpenAPI 스키마와의
  일치를 `workflow-versions.service.spec.ts` 가 스키마 파생 방식으로 강제한다(손으로 두
  목록을 나열해 비교하는 방식이 아님 — 둘 다 같이 틀리는 경우를 잡는다).
  `workflow-crud.e2e-spec.ts` 케이스 `H` 가 실제 HTTP 응답으로 이름 축(`expectNoUserSecrets`)
  · 계약 축(`assertMatchesContract`) · `creator` 3필드 양성을 모두 검증.
- `findEagerUserRelations` — eager 관계는 호출부에 텍스트를 안 남기므로 별도 엔티티
  데코레이터 스캔 축을 뒀고, 양성/음성 fixture(`user-eager-relation.fixture.ts`)로 검출력이
  실제로 있음을 확인(리뷰어가 `hasEagerDecorator`→`false` 뮤턴트로 15/15→1 failed 확인한
  이력이 RESOLUTION 에 기록돼 있고, 이번 세션에서 재실행한 25/25 GREEN 도 이 fixture 를
  포함한다).
- `hasProjectionFor` — `select: { creator: true }` 처럼 "겉은 투영, 실은 오버페치" 인 형태를
  값(불리언)까지 봐서 걸러낸다.
- `USER_SECRET_KEYS` 7개는 `user.entity.ts` 의 실제 민감 컬럼과 대조해 누락이 없음을
  확인했다(`oauthProviderId`·`pendingEmail`·`loginAttempts`·`lockedUntil`·`*ExpiresAt` 류는
  자격증명/토큰이 아니므로 이 목록의 대상이 아니다 — 판단 근거 타당).

## 요약

이 changeset 의 핵심은 실제 데이터 유출(워크플로우 버전 작성자의 `passwordHash`·2FA 비밀·
복구 코드·계정 탈취용 토큰이 워크스페이스 멤버 누구에게나 노출)을 찾아 닫은 보안 수정이며,
그 수정은 DTO 스키마 파생 테스트 + e2e 3중 검증(이름 축·계약 축·양성 값 축)으로 뒷받침된다.
새로 만든 두 검출 가드(구조 AST + 값 재귀 스캔)는 인젝션·시크릿 하드코딩·인가 우회 같은
전통적 결함이 없고, 저장소 전체를 대상으로 독립 검증한 결과(`relations`/`JoinAndSelect`
전수 grep, `auth.service.ts`·`workspaces.service.ts`·`executions.service.ts`·
`dashboard.service.ts`·`audit-logs.service.ts` 의 모든 `User`-타입 관계 로드 지점)도
가드의 화이트리스트·주장과 정확히 일치했다. 유일하게 짚을 것은 이 방어선이 **런타임
방지가 아니라 테스트 시점 검출**이라는 아키텍처적 성격인데, 이는 PR 이 스스로 실측
근거(select:false 의 fail-silent 인증 실패 위험, 전역 인터셉터의 광범위 wire 변경)와 함께
명시적으로 선택한 트레이드오프이고 CI 로 강제되는 화이트리스트 정확 일치 테스트라
회귀는 실제로 막는다 — 다만 스캔 범위(`src/modules`) 밖의 미래 표면에는 적용되지 않는다는
점을 잔여 리스크로 기록해 둔다. 신규 Critical/실행 가능한 보안 결함은 없다.

## 위험도

LOW
