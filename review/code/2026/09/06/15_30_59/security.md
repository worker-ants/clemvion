# 보안(Security) 리뷰

## 개요

이 diff(`origin/main...HEAD`, `User` 엔티티 컬럼 노출 방어 3축 + `WorkflowVersionsService`/
`TriggersService` 수정)의 핵심은 **기존에 실재하던 Critical 정보 유출을 이 diff 자신이
고친 것**이다. `origin/main` 기준 `WorkflowVersionsService.findOne`(`codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts`)은
`relations: ['creator']` 로 `User` 관계를 투영 없이 로드하고, 컨트롤러
(`workflow-versions.controller.ts:72`)가 그 값을 가공 없이 그대로 반환하고 있었다. `User`
엔티티(`codebase/backend/src/modules/users/entities/user.entity.ts`)에는 `select: false`도
`@Exclude()`도 없으므로, `GET /api/workflows/:wfId/versions/:versionId`가 버전 작성자의
`passwordHash`·`twoFactorSecret`·`totpRecoveryCodes`·`webauthnRecoveryCodes`·
`emailVerifyToken`·`passwordResetToken`·`emailChangeToken`을 해당 워크스페이스의 **viewer
포함 전 멤버**에게 노출했다. 이 diff는 `select: { …, creator: CREATOR_PROJECTION }`을
추가해 이를 닫았고(`workflow-versions.service.ts` 신설 `CREATOR_PROJECTION` 상수, `id`/
`name`/`email` 3필드), 새 e2e(`workflow-crud.e2e-spec.ts` 케이스 `H.`)와 단위 테스트가
`creator` 키 집합을 3개로 고정해 회귀를 막는다. 컨트롤러·엔티티를 직접 열어 수정이 실제로
적용됐음을 확인했다.

## 발견사항

- **[INFO]** (수정 확인됨) `WorkflowVersionsService.findOne`의 `User` 전 컬럼 노출은 이
  diff 안에서 해결되어 있다
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts`
    (신설 `CREATOR_PROJECTION` 상수 및 `findOne`의 `select` 절), `codebase/backend/test/workflow-crud.e2e-spec.ts`(신규 `it('H. …')`)
  - 상세: `origin/main`의 `findOne`은 `relations: ['creator']`만 있고 `select`가 없어
    `User` 전 컬럼이 로드·반환됐다(직접 확인). 이 diff는 `findByWorkflow`가 이미 갖고
    있던 것과 동일한 투영(`CREATOR_PROJECTION = { id, name, email }`)을 `findOne`에도
    적용했고, `WorkflowVersionListItem`/`WorkflowVersionDetail` 타입도 `creator:
    ProjectedCreator`로 좁혔다. 새 e2e가 응답 봉투 전체에 대해 `expectNoUserSecrets`(이름
    기반, 선언과 무관)와 `assertMatchesContract`(DTO 선언 대조) 두 축을 걸고, `creator`
    키가 정확히 `['email','id','name']`인지도 양성으로 고정한다. 별도 조치 불요 — 이미
    닫혔음을 확인 차 기록.

- **[WARNING]** `WorkspacesService.listMembers`는 여전히 `User`를 투영 없이 통째로 로드하며,
  안전장치가 정적 가드가 아니라 런타임 테스트뿐이다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` — `listMembers`
    메서드(`relations: ['user']`로 조회 후 `m.user?.email`/`m.user?.name`으로 수동 매핑)
  - 상세: 이 diff가 새로 도입한 구조 기반 가드(`user-entity-exposure-guard.ts`)는
    TypeORM 쿼리 옵션(`relations`/`select`/`joinAndSelect`)만 AST로 검사한다. `listMembers`는
    `relations: ['user']`로 `User` 전 컬럼을 로드한 뒤, TypeORM 투영이 아니라 **JS 레벨
    수동 매핑**으로 `email`/`name`만 골라 새 객체를 만든다. 이 매핑이 나중에
    `...m.user`로 넓어지거나 필드가 하나 늘어도, 구조 가드는 계속 통과한다 — 가드가
    보는 것은 로드 형태이지 반환 형태가 아니기 때문이다. 지금 유일한 안전망은 이번 diff가
    새로 추가한 단위 테스트(`workspaces.service.spec.ts` — `listMembers — 수동 투영이
    좁은지`)와 e2e(`workspace-rbac.e2e-spec.ts`의 `J.` 케이스)뿐이며, 둘 다 "누가 테스트를
    돌리고 통과시키는가"에 의존하는 검출(detection) 통제이지 컴파일/런타임 강제
    (enforcement)가 아니다. PR 자신의 주석(`workspaces.service.spec.ts:1124-1131`)도 이
    자리를 "가드가 지키지 못하는 유일한 자리"로 명시하고 있다. 이 갭은 이 diff가 새로
    만든 것은 아니고(pre-existing) diff가 테스트로 보강한 것이지만, 구조적 강제가 없다는
    점은 여전히 남아 있다.
  - 제안: 장기적으로 `memberRepository.find` 호출부에 TypeORM `select` 투영
    (`relations: { user: true }, select: { user: { id: true, email: true, name: true } }`)을
    적용해 구조 가드의 보호 범위 안으로 들여오는 것을 고려한다 — 그러면 정적 AST 가드가
    이 자리도 래칫으로 고정할 수 있다.

- **[INFO]** `User` 엔티티는 데이터 계층 방어(`select: false`/`@Exclude()`/전역
  직렬화 인터셉터)가 여전히 0건이며, 이 diff가 세운 3축은 모두 탐지(detection)이지
  방지(prevention)가 아니다
  - 위치: `codebase/backend/src/modules/users/entities/user.entity.ts`(7개 민감 컬럼에
    `select: false` 없음), `codebase/backend/src/shared/testing/user-secret-absence.ts`,
    `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts`
  - 상세: `CHANGELOG.md`(신설 절)와 `plan/in-progress/spec-draft-nullable-notation-followups.md`가
    `select: false`를 검토했으나 로그인/2FA/비밀번호 재설정 등 19곳이 지나는 공유
    로더(`UsersService.findById`/`findByEmail`, 46개 호출지점)를 깨뜨릴 위험 때문에
    기각하고, 대신 정적 AST 스캔(`user-entity-exposure-guard`) + JSDoc 인용 가드
    (`dto-jsdoc-citation-guard`) + 런타임 이름 기반 스캔(`user-secret-absence`) 3축의
    검출 전략을 택했다는 근거를 실측 수치와 함께 명시하고 있다. 트레이드오프 자체는
    합리적으로 보이나(대안 시나리오가 "조용한 인증 실패"라는 더 심각한 회귀를 낳을 수
    있음을 실측으로 뒷받침), 결과적으로 이 저장소의 `User` 컬럼 노출 방지는 여전히
    **실행 시점에 아무것도 막지 않고**, CI에서 이 가드들의 spec이 실제로 돌고 있다는
    전제에 전적으로 의존한다. 이 결정 자체는 이번 diff의 새 결함이 아니라 명시적으로
    disclose된 아키텍처 선택이므로 조치를 요구하지는 않지만, 이후 새 서비스 파일이
    `User` 관계를 로드할 때마다 "가드가 그 형태를 실제로 커버하는가"를 사람이 계속
    확인해야 한다는 잔여 리스크로 기록한다.
  - 제안: 조치 불요(디자인 결정으로 이미 근거와 함께 채택됨). 다만 `USER_SECRET_KEYS`
    (7컬럼)에 없는 `pendingEmail`·`oauthProviderId` 같은 PII성 필드도 향후 유출 후보가
    될 수 있음을 염두에 두고, 필요 시 이름 축의 키 목록을 넓히는 것을 고려할 수 있다.

- **[INFO]** `TriggersService`의 새 UNIQUE 위반 처리 경로는 정보 노출 없이 안전하게
  구현되어 있다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` —
    `isEndpointPathUniqueViolation`, `rethrowEndpointPathConflict`
  - 상세: SQLSTATE(`23505`) + 인덱스 이름(`idx_trigger_workspace_endpoint`)을 함께 확인한
    뒤 사용자에게는 일반화된 한국어 메시지("같은 워크스페이스에 그 엔드포인트 경로를 쓰는
    트리거가 이미 있어요.")와 `details: { field, code }`만 반환한다 — SQL 원문·제약
    이름·스택트레이스 등 내부 구현 정보는 wire에 노출되지 않는다. 매칭되지 않는 다른
    UNIQUE 위반은 그대로 재throw해 전역 예외 필터에 위임하므로, 이 분기가 다른 종류의
    충돌까지 삼켜 오탐 메시지를 주는 일도 없다. 문제 없음.

- **[INFO]** `.claude/hooks/_lib/review_guard.py`의 신규 YAML frontmatter 주석 파싱 로직에
  실질적 인젝션/ReDoS 위험 없음
  - 위치: `.claude/hooks/_lib/review_guard.py` — `_parse_frontmatter_code._strip_comment`,
    관련 정규식 3개
  - 상세: 정규식(`\s+#`, `^code:\s*(.*)$`, `^\s*-\s*(.+)$`)은 모두 선형 시간이며 중첩
    정량자가 없어 파국적 백트래킹 경로가 보이지 않는다. 이 코드는 저장소 내부 `spec/`
    마크다운 파일(신뢰된 콘텐츠, 사용자 입력이 아님)만 읽으므로 공격 표면도 아니다.
    harness 내부 도구라 프로덕션 런타임에 배포되지 않는다. 문제 없음.

- **[INFO]** 신규 테스트 파일들의 비밀값처럼 보이는 리터럴은 전부 명백한 더미
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts:1153` 등
    (`passwordHash: '$2b$10$x'`, `twoFactorSecret: 's'`, `totpRecoveryCodes: ['r1']`,
    `emailChangeToken: 't'`)
  - 상세: 형식상 bcrypt 해시처럼 보이는 `'$2b$10$x'`도 길이·엔트로피가 실제 해시와
    무관한 플레이스홀더이고, 실제 자격증명이나 유효한 시크릿이 아니다. 하드코딩된
    시크릿 우려 없음.

## 요약

이 diff는 신규 취약점을 도입하지 않았고, 오히려 `origin/main`에 실재하던 Critical 등급
정보 노출(워크플로우 버전 작성자의 `User` 인증 관련 컬럼 전체가 워크스페이스 뷰어에게까지
노출)을 직접 확인 가능한 형태로 수정했다. 수정은 자매 메서드가 이미 쓰던 투영 패턴을
동일하게 적용하는 국소적이고 안전한 변경이며, 계약 대조·이름 기반 스캔·양성 값 확인 세
축의 회귀 테스트로 뒷받침된다. `TriggersService`의 새 오류 처리 경로도 정보 노출 없이
안전하다. 유일하게 남는 구조적 우려는 (1) `WorkspacesService.listMembers`가 여전히 `User`를
투영 없이 로드하고 오직 런타임 테스트만으로 보호되고 있다는 점과 (2) `User` 엔티티 자체에는
데이터 계층 강제가 없어 이번 PR이 세운 3축이 모두 "탐지"이지 "방지"가 아니라는 점인데,
둘 다 이 diff가 새로 만든 결함이 아니라 사전에 존재했고 이번 diff가 실측 근거와 함께
명시적으로 문서화·보강한 상태다.

## 위험도

LOW
