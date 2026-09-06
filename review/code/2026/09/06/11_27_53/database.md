# 데이터베이스(Database) 리뷰

## 개요

이번 diff 의 실질 목적은 `User` 엔티티 컬럼이 관계 로드를 통해 통째로 wire 로 새는 것을 막는
검출 인프라(정적 AST 가드 + 런타임 이름 기반 부재 단언)를 세우는 것이고, 그 과정에서 직전
라운드(`review/code/2026/09/06/10_13_22`)가 찾은 실제 DB 쿼리 결함(`WorkflowVersionsService
.findOne` 이 `creator` 관계를 투영 없이 로드) 을 닫는 수정이 포함돼 있다. DB 관점에서 실질적으로
평가할 대상은 `workflow-versions.service.ts`/`.spec.ts` 의 TypeORM 쿼리 옵션 변경과, 그
쿼리 패턴을 스캔하는 `user-entity-exposure-guard.ts`/fixture/spec 이다. 나머지(응답 스캔
헬퍼, e2e, DTO 필드 추가, plan/CHANGELOG 문서)는 DB 쿼리 자체를 바꾸지 않는다. 마이그레이션
파일은 이번 diff 에 없다.

## 발견사항

- **[INFO]** `WorkflowVersionsService.findOne` / `findByWorkflow` 의 `creator` 컬럼 투영이
  공유 상수로 통합되고, `select` 옵션으로 SQL 레벨에서 실제로 좁혀짐 — 긍정적 변경
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:35-39`
    (`CREATOR_PROJECTION` 정의), `:77-86`(`findByWorkflow`), `:96-113`(`findOne`)
  - 상세: `WorkflowVersion.creator` 는 `@ManyToOne(() => User)` 이고(entity 확인:
    `codebase/backend/src/modules/workflow-versions/entities/workflow-version.entity.ts`),
    이전에는 `findOne` 이 `relations: ['creator']` 만 쓰고 같은 옵션 객체에 `select` 투영이
    없어 TypeORM 이 JOIN 시 `User` 테이블의 **전 컬럼**을 SELECT 절에 실었다(그중
    `passwordHash`·`twoFactorSecret`·복구 코드·토큰류가 실제로 wire 로 나갔다 — 직전
    라운드 Critical 1). 이번 diff 는 `relations: { creator: true }` + `select: { …,
    creator: CREATOR_PROJECTION }` 형태로, `id`/`name`/`email` 세 컬럼만 SQL 레벨에서
    선택하도록 고쳤다. 이는 애플리케이션 레이어 필터링이 아니라 **DB 로 보내는 SELECT 절
    자체를 좁힌 것**이라 응답 노출 방지뿐 아니라 불필요한 컬럼 전송(대형 JSONB 는 없지만
    `passwordHash`·recovery code 등 여러 text 컬럼)을 줄이는 성능상 이점도 있다.
    `CREATOR_PROJECTION` 을 두 메서드가 공유하고, `workflow-versions.service.spec.ts` 가
    이 상수의 키를 `WorkflowVersionCreatorDto` 의 OpenAPI 스키마와 대조하는 테스트를 둬(파일
    2, 게이트 38-49) 투영 상수와 DTO 선언이 다시 갈리는 것을 원천 차단한다. 이전 Critical
    의 근본 원인(같은 리터럴이 두 곳에 손으로 복제돼 한쪽만 옳았던 것)을 구조적으로 해소한
    좋은 패턴이다.
  - 제안: 없음(조치 완료). 참고로 이 구조(공유 투영 상수 + DTO 스키마 대조 테스트)는 향후
    `User` 를 관계로 싣는 다른 자리에도 재사용할 만한 템플릿이다.

- **[INFO]** `user-entity-exposure-guard.ts` 의 검출 대상은 TypeORM 의 실제 오버페치
  동작과 정확히 일치한다 — DB 관점에서 술어가 타당함을 직접 확인
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts:222-306`
    (`findUserRelationLoads`), `:198-220`(`hasProjectionFor`)
  - 상세: TypeORM 은 `relations` 로 관계를 로드하되 같은 옵션에 `select` 투영이 없으면
    관계 엔티티의 전 컬럼을 JOIN 결과에 포함시키고, `leftJoinAndSelect`/`innerJoinAndSelect`
    도 동일하게 alias 의 전 컬럼을 싣는다(반면 `leftJoin`+`addSelect` 는 명시한 컬럼만
    싣는다) — 가드의 세 형태 분류(`relations` 배열/객체, `*JoinAndSelect`)와 예외 처리
    (`select` 로 좁힌 자리, `leftJoin`(AndSelect 없음))가 이 실제 동작과 부합한다.
    `hasProjectionFor` 가 같은 옵션 객체 안의 `select.<relation>` 존재만으로 위반 여부를
    가르는 것도 TypeORM 시맨틱과 일치한다. fixture(`user-relation-load.fixture.ts`)의 준수
    대조군 1(`leftJoin`+`addSelect`)·2(`relations`+`select`)가 실제 프로덕션 정상 형태
    (`audit-logs.service.ts`, `findByWorkflow`)를 그대로 반영하고 있어 오탐 가능성도 낮다.
  - 제안: 없음. 다만 이 가드는 명시적으로 "관계로 싣는" 경로만 다룬다 — `usersRepository`
    를 **주 엔티티**로 직접 조회하는 46개 호출지점(CHANGELOG 가 별도로 전수 열거한 그
    "공유 깔때기")은 이 AST 가드의 스캔 대상이 아니다. CHANGELOG 가 이를 별도 축으로
    이미 인지하고 있어 누락이 아니라 설계상 분리이지만, 두 검출 축(관계 가드 vs 공유
    깔때기)의 경계가 코드 주석에는 있어도 `spec/` 문서에는 없다는 점은 문서화 리뷰
    영역과 겹치므로 여기서는 참고만 남긴다.

- **[INFO]** `WorkspacesService.listMembers` 는 이번 diff 로 처음 e2e 커버리지가 붙었지만,
  DB 쿼리 자체는 여전히 `User` 전 컬럼을 오버페치한다 — 알려진 베이스라인으로 남음
  - 위치: `codebase/backend/test/workspace-rbac.e2e-spec.ts:602-639`(신규 e2e, 파일 12) —
    대상 쿼리는 diff 밖의 `codebase/backend/src/modules/workspaces/workspaces.service.ts`
    `listMembers`(`relations: ['user']`, `select` 없음, `.map()` 으로 `email`/`name` 만
    사후 추출)
  - 상세: 이 쿼리는 애플리케이션 레벨에서 응답을 `email`/`name` 로만 재구성하므로 이번
    e2e(`expectNoUserSecrets`)는 통과하지만, **DB 로 보내는 SQL 자체는 `User` 의 모든
    컬럼(`passwordHash`·`twoFactorSecret`·복구 코드·토큰류 포함)을 여전히 SELECT 한다.**
    이는 (a) 불필요한 바이트를 DB→앱으로 전송하는 성능 낭비이고, (b) 이번 PR 이 신설한
    `user-entity-exposure-guard.ts` 의 `EXPECTED_USER_RELATION_LOADS` 화이트리스트가
    이 호출지점을 정확히 "투영 없이 통째로 싣는 3곳" 중 하나로 **의도적으로 동결**하고
    있어(가드 목적이 "늘지 않게" 이지 "줄이게" 가 아님), 앞으로 이 `.map()` 재투영을
    누군가 실수로 지우면(예: 스프레드로 바꾸면) 응답 계층에서 다시 유출이 재발할 수 있는
    구조적 여지가 여전히 남아 있다. 이번 diff 의 범위(검출 인프라 신설)에서는 정당한
    선택이지만, DB 관점에서는 "쿼리 자체를 좁히는" 근본 수정이 아니라는 점을 기록해 둔다.
  - 제안: 이 PR 범위 밖 후속 과제로, `listMembers` 에도 `findOne`/`findByWorkflow` 와
    같은 `relations`+`select` 투영 패턴(또는 `leftJoin`+`addSelect`)을 적용해 SQL
    레벨에서 컬럼을 좁히면, 애플리케이션 레벨 재투영에 대한 의존을 제거하고 이 자리도
    가드의 "준수" 쪽으로 옮길 수 있다.

- **[INFO]** `User` 엔티티에 컬럼 수준 DB 방어(`select: false`)가 전혀 없다는 사실은
  이번 diff 가 스스로 실측·공개한 기존 상태이며, 근본 해법은 여전히 미해결로 남음
  - 위치: `CHANGELOG.md:64-66`("실측(2026-09-06): `select: false` 0건"),
    `codebase/backend/src/modules/users/entities/user.entity.ts` (직접 확인: `passwordHash`
    `:27`, `twoFactorSecret` `:50` 등 민감 컬럼에 `select: false` 데코레이터 옵션 없음)
  - 상세: TypeORM 의 `@Column({ select: false })` 는 관계로 로드되든 주 엔티티로 로드되든
    해당 컬럼을 기본 쿼리에서 항상 제외하는 컬럼 수준(스키마 레벨) 방어다. 이번 diff 는
    이를 도입하지 않고 "검출만" 하는 전략을 택했는데, CHANGELOG 가 그 이유(19곳 공유
    로더 재배선 필요·`comparePassword(x, undefined)` 로 인증이 예외 없이 조용히 실패할
    위험)를 실측과 함께 충분히 근거로 들고 있어 이번 diff 단독으로는 타당한 판단이다.
    다만 DB 리뷰어 관점에서 짚어 둘 것은, 이 전략은 **미래의 새 호출지점**(가드가 아직
    모르는 새 서비스·새 관계)에서 같은 클래스의 유출이 나는 것을 막지 못하고 오직
    **이미 알려진 호출지점 집합**에 대한 회귀만 잡는다는 점이다 — 정적 가드는 향후
    코드 리뷰 시점에 새 위반을 잡아 주지만, `select: false` 는 쿼리를 새로 짜는 개발자가
    가드의 존재를 몰라도 스키마가 기본값으로 막아 준다. 이번 diff 가 "런타임 위험 0"을
    이유로 스키마 레벨 방어를 배제한 것은 단기적으로는 합리적이나, 근본 해법(로더 분리 후
    `select:false` 적용)이 여전히 열려 있는 항목이라는 점은 plan 후속 항목으로 남겨 둘
    가치가 있다(이미 CHANGELOG 가 이를 인지하고 있으므로 새 지적이 아니라 확인·강조).
  - 제안: 조치 불요(이번 diff 범위 밖, 이미 CHANGELOG 가 트레이드오프를 명시). 다만
    plan 트래커에 "`select:false` 전환은 19곳 로더 재배선을 전제로 한다" 는 조건이
    명시돼 있는지 확인 권장.

- **[INFO]** `findByWorkflow` 는 워크플로당 버전 전체를 페이지네이션 없이 조회 — 이번
  diff 가 손댄 라인(투영 추가)과 같은 메서드지만 사전 존재 동작이라 비차단
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:73-88`
  - 상세: `this.workflowVersionRepository.find({ where: { workflowId }, … })` 가 `take`/
    `skip` 없이 해당 워크플로의 모든 버전 행을 반환한다. `@Unique(['workflowId','version'])`
    복합 유니크 인덱스가 `workflowId` 를 선두 컬럼으로 가지므로 `WHERE workflow_id = ?`
    자체의 인덱스 사용은 문제없다(인덱스 누락 아님). 다만 매우 활발히 편집·저장되는
    워크플로우는 버전 행이 계속 누적되므로, 장기적으로 응답 크기가 무한정 커질 수 있는
    구조다. 이번 diff 는 이 메서드의 `select`/`relations` 절만 바꿨고 페이지네이션 로직은
    건드리지 않았으므로 회귀는 아니다.
  - 제안: 이번 PR 범위 밖. 버전 이력이 실제로 무제한 증가하는 사용 패턴이 관측되면
    `take`/`skip` 또는 커서 기반 페이지네이션 도입을 후속 과제로 고려.

- **[INFO]** SQL 인젝션·트랜잭션·커넥션 관리·마이그레이션 안전성 — 해당 diff 범위에서
  이슈 없음
  - 상세: 변경된 쿼리는 전부 TypeORM `Repository.find`/`findOne` 의 파라미터화된
    `where`/`select`/`relations` 옵션만 사용하며 문자열 결합 raw SQL 이 없다(SQL
    인젝션 해당 없음). `createVersion` 의 `pessimistic_write` 락 기반 트랜잭션 로직은
    이번 diff 로 변경되지 않았고 그대로 유지된다. 커넥션 풀 설정을 바꾸는 코드가 없다.
    이번 diff 에 스키마 마이그레이션 파일(`migrations/**`)이 포함돼 있지 않다.

## 요약

이번 변경의 DB 쿼리 관련 핵심은 `WorkflowVersionsService.findOne`/`findByWorkflow` 가
`creator`(`User`) 관계를 로드할 때 SQL 레벨에서 `id`/`name`/`email` 세 컬럼만 SELECT 하도록
공유 상수(`CREATOR_PROJECTION`)로 통합·강제한 것이다 — 직전 라운드가 찾은 실제 컬럼 오버페치
결함(투영 없는 `relations: ['creator']`)을 근본적으로 닫았고, DTO 스키마 대조 테스트로 상수와
선언이 다시 갈리는 재발을 구조적으로 막았다. 이를 지원하는 정적 가드(`user-entity-exposure
-guard.ts`)의 위반/준수 판정 로직은 TypeORM 의 실제 오버페치 시맨틱(관계 투영 없는 `relations`
/`*JoinAndSelect` vs `select`/`leftJoin`+`addSelect`)과 정확히 일치함을 코드·엔티티를 직접
대조해 확인했다. 인덱스·트랜잭션·마이그레이션·SQL 인젝션·커넥션 관리 관점에서 이번 diff 가
새로 만드는 위험은 없다. 다만 `WorkspacesService.listMembers` 는 여전히 `User` 전 컬럼을
SQL 레벨에서 오버페치한 뒤 애플리케이션에서 재투영하는 구조이고(이번 PR 은 이를 테스트로
고정만 하고 쿼리 자체는 고치지 않음), `User` 엔티티 자체에 `select:false` 같은 컬럼 수준 DB
방어가 없다는 상태도 그대로 남아 있다 — 둘 다 CHANGELOG 가 스스로 인지·근거를 든 의도적
범위 제외이므로 이번 diff 의 결함으로 잡지 않고 INFO 로 기록한다.

## 위험도

LOW
