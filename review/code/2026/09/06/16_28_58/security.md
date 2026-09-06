# 보안(Security) 리뷰

## 개요

이번 diff(`origin/main...HEAD`, 25개 실코드 파일 + 대량의 `review/`·`plan/` 산출물)는
"`User` 엔티티 컬럼 노출" 이라는 단일 보안 주제를 중심으로 구성된다. 핵심은 실제로
발견·수정된 Critical 하나(`WorkflowVersionsService.findOne` 의 `User` 전체 유출)와, 같은
결함 클래스의 재발을 막는 검출 장치 3종(구조 축 `user-entity-exposure-guard.ts`, 이름 축
`user-secret-absence.ts`, DTO JSDoc 인용 축 `dto-jsdoc-citation-guard.ts`), 그리고
`TriggersService` 의 UNIQUE 위반 에러 계약 정합화다. `.claude/hooks/_lib/review_guard.py`
는 애플리케이션 코드가 아니라 리뷰/컨시스턴시 게이트가 참조하는 spec `code:` 파서이며,
이번 수정은 그 파서가 YAML 주석·빈 줄 때문에 entry 를 조용히 떨궈 **감사 대상 파일이
게이트 스코프에서 빠지는** 커버리지 결함을 닫는다 — 런타임 앱 보안은 아니지만 "보안 검토가
스스로를 못 보는" 부류의 결함이라 언급해 둔다.

## 발견사항

- **[INFO]** (조치 불요, 확인용 기록) `WorkflowVersionsService.findOne` 의 `User` 전체 컬럼 유출이 이번 diff 로 실제로 닫혔다
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` — `findOne` 메서드(`select: { … creator: CREATOR_PROJECTION }` 추가)
  - 상세: 수정 전에는 `relations: ['creator']` 만으로 `WorkflowVersion.creator`(`@ManyToOne(() => User)`)를 투영 없이 로드하고 컨트롤러가 그대로 반환해, `GET /api/workflows/:wfId/versions/:versionId` 가 워크스페이스 멤버(viewer 포함) 권한으로 버전 작성자의 `passwordHash`·`twoFactorSecret`·`totpRecoveryCodes`·`webauthnRecoveryCodes`·`passwordResetToken`·`emailVerifyToken`·`emailChangeToken` 을 전부 내보내고 있었다. 자매 메서드 `findByWorkflow` 는 처음부터 `select` 투영이 있었고 `findOne` 만 없었던 것이 원인이다. 이번 diff 가 `CREATOR_PROJECTION`(`id`·`name`·`email`) 을 두 메서드가 공유하도록 상수화하고, `findOne` 의 `select` 에도 동일 투영을 넣어 컬럼 자체가 DB 레벨에서 로드되지 않게 막았다. 이 상수는 `WorkflowVersionCreatorDto` 의 OpenAPI 스키마와 정확히 일치하는지를 `workflow-versions.service.spec.ts` 가 실제 스키마 추출로 대조하며, `workflow-crud.e2e-spec.ts` 의 신규 `H.` 케이스가 이름 축(`expectNoUserSecrets`)·계약 축(`assertMatchesContract`)·`creator` 필드 양성 확인(3필드 정확히) 세 겹으로 e2e 검증한다. 실제 코드를 읽어 투영이 `select` 절 안에 정확히 들어가 있음을 확인했다.
  - 제안: 없음 — 수정이 올바르고 검증도 3중이다.

- **[INFO]** 구조 기반 검출 가드(`user-entity-exposure-guard.ts`)는 TypeORM 관용구 3형태(`relations` 배열/객체, `*JoinAndSelect`, `eager` 데코레이터)만 보는 태생적으로 좁은 정적 스캔이며, 이 사실이 문서와 보완 통제(`listMembers`)로 이미 disclose 되어 있다
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts` (`findUserRelationLoads`/`findEagerUserRelations`), 화이트리스트 주석 `codebase/backend/src/repo-guards/__tests__/user-entity-exposure.spec.ts:79`("`listMembers` … 이 가드는 **여전히 초록**이다")
  - 상세: 이 가드는 AST 로 `relations`/`select`/`*JoinAndSelect`/`eager` 형태만 판정하므로, raw SQL(`query()`) 이나 QueryBuilder 의 동적 `.addSelect([...])` 로 `users` 테이블 컬럼을 조인해 오는 경로, 혹은 로드 후 JS 단에서 손으로 필드를 매핑하다가 그 매핑이 넓어지는 경우(`workspaces.service.ts#listMembers` 가 정확히 이 형태)는 원리적으로 못 잡는다. PR 스스로 이 갭을 정확히 인지하고 있고(JSDoc·CHANGELOG 명시), `listMembers` 하나에 대해서만 이번 diff 가 단위 테스트(`workspaces.service.spec.ts` 신규 `describe('listMembers — 수동 투영이 좁은지')`)와 e2e(`workspace-rbac.e2e-spec.ts` `J.`)로 이름 축(`findUserSecretLeaks`/`expectNoUserSecrets`) 보완 통제를 걸었다. 다만 `UsersService.findById`/`findByEmail` 공유 깔때기를 지나는 나머지 서비스 파일 19곳·호출지점 46곳 전체가 이런 이름-축 e2e/unit 로 개별적으로 커버되는지는 이번 diff 범위 밖이며(문서상 "select:false 는 fail-silent 위험이라 기각, 검출로 대체" 로 명시), 즉 새 코드가 그 46곳 각각에 `User` 를 통째로 실었다가 응답에 넣어도 **그 특정 엔드포인트에 `expectNoUserSecrets`/`findUserSecretLeaks` 가 배선돼 있지 않으면** 검출되지 않는다.
  - 제안: 새로 발견된 결함은 아니며 팀이 이미 인지·수용한 잔여 위험(검출 전략의 태생적 한계)이므로 조치 불요. 다만 향후 `User` 를 응답 경로에 새로 노출하는 지점이 생길 때마다 이름 축 e2e/unit 배선을 강제하는 체크리스트(예: PR 템플릿·리뷰 규약)가 있는지 확인해 두면 이번 라운드에서 닫은 것과 같은 형태의 재발을 줄일 수 있다.

- **[INFO]** `TriggersService.rethrowEndpointPathConflict` 의 에러 응답은 원문 DB 에러(SQLSTATE·제약명·드라이버 메시지)를 클라이언트에 노출하지 않는다 — 확인 완료
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `rethrowEndpointPathConflict` 메서드
  - 상세: 매치되면 사람이 읽는 한국어 메시지와 `details: { field, code }` 만 담아 `ConflictException` 을 던지고, 매치되지 않는 오류(다른 UNIQUE 인덱스, 기타 예외)는 그대로 재던져 전역 필터가 처리하도록 넘긴다 — 원본 PG 에러 객체(제약명·드라이버 스택)를 봉투에 직접 싣지 않는다. `triggers.service.spec.ts` 가 두 wrap 표면(`driverError`/`top`) × 두 메서드(`create`/`update`) 전 조합과, 매치 안 되는 경우 원본 에러가 그대로 전파되는지를 모두 테스트한다.
  - 제안: 없음.

- **[INFO]** 신규 검출 가드 3종·수정 코드의 테스트 fixture 에 나타나는 자격증명류 문자열은 전부 명백한 가짜 값이며 실제 시크릿이 아니다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts`(`passwordHash: '$2b$10$x'`, `twoFactorSecret: 's'`, `totpRecoveryCodes: ['r1']`, `emailChangeToken: 't'`), `codebase/backend/src/shared/testing/pg-error-fixtures.ts`
  - 상세: 자릿수·형식이 실제 bcrypt 해시/토큰과 다르고(`'$2b$10$x'` 는 salt+hash 부분이 한 글자), 값 자체가 "이 필드에 아무 값이나 있으면 됨" 을 나타내는 placeholder 다. `git log`/커밋 이력상 실제 운영 자격증명이 노출된 흔적 없음.
  - 제안: 없음(오탐 방지 차원의 확인 기록).

- **[INFO]** `.claude/hooks/_lib/review_guard.py` 의 YAML frontmatter `code:` 파서 수정은 애플리케이션 보안이 아니라 **감사 게이트 자체의 커버리지 결함**을 닫는 것 — 성격상 언급
  - 위치: `.claude/hooks/_lib/review_guard.py` — `_parse_frontmatter_code`/`_strip_comment`
  - 상세: 종전 파서는 블록 리스트 안의 주석·빈 줄을 만나면 리스트 파싱을 중단(`break`)해, 그 뒤에 등재된 `code:` glob 이 spec-linked 판정에서 조용히 빠졌다. 실측(diff 내 CHANGELOG 인용)으로 spec 387개 중 7개 파일·41개 entry 가 유실 중이었고, 그중 하나가 이 PR 자신이 수정한 `workspace-response.dto.ts` 를 감사 스코프에서 빼고 있었다. 즉 이 결함이 남아 있었다면 이번 PR 의 `--impl-done` 게이트 자체가 자신의 변경을 보지 못했을 것이다. 수정은 인용 부호 유무로 갈라 트레일링 주석을 제거하고, 회귀 테스트(`test_review_guard.py`)가 언쿼트/인용/인라인 리스트/블록 리스트 조합과 반대 방향 대조군(`#` 앞 공백 없음, 닫는 따옴표 없음, 다음 키에서는 여전히 멈춤)을 전부 커버한다. 애플리케이션 런타임에는 영향이 없다.
  - 제안: 없음 — 이미 검증(731 대 731, 두 파서 일치)됐고 회귀 테스트도 충분하다.

## 요약

이번 diff 의 핵심은 실제로 존재했던 심각한 정보 노출(워크스페이스 멤버 권한만으로 `passwordHash`·2FA 복구 코드·계정 탈취 토큰이 포함된 `User` 전체가 `GET /api/workflows/:wfId/versions/:versionId` 응답에 실리던 것)을 DB 레벨 컬럼 투영으로 막고, 그 투영이 DTO 계약과 어긋나지 않음을 스키마 대조 테스트로 고정한 것이다. 여기에 더해 같은 결함 클래스(`User` 관계를 투영 없이 로드)를 정적 AST 스캔으로 잡는 구조 축, 응답 본문을 이름으로 깊이 훑는 값 축, 내부 리뷰 인용이 공개 OpenAPI 설명으로 새는 것을 막는 JSDoc 인용 축까지 3중 검출 장치가 추가됐고, 각 축의 한계(정적 스캔이 못 보는 JS 단 수동 매핑·eager 관계)를 스스로 문서화하며 해당 자리(`listMembers`)에는 별도의 이름-축 유닛/e2e 테스트로 보완했다. 트리거 UNIQUE 위반 처리도 원본 DB 에러를 클라이언트에 노출하지 않고 문서화된 안전한 형태로만 응답하도록 정리됐다. 하드코딩된 시크릿, 인젝션, 인증/인가 우회, 안전하지 않은 암호화 사용은 발견되지 않았다. 유일하게 짚어둘 것은 구조 축 가드가 태생적으로 TypeORM 의 알려진 관용구만 포착하는 좁은 정적 스캔이라는 점인데, 이는 새로 도입된 취약점이 아니라 팀이 이미 인지하고 개별 보완 통제로 메운, 문서화된 잔여 설계 한계다.

## 위험도

NONE
