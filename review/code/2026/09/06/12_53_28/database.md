# 데이터베이스(Database) 리뷰

## 개요

이번 diff(`origin/main...HEAD`, 125개 파일)에서 실제로 DB 쿼리를 바꾸는 코드는
`codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` /
`.spec.ts` 뿐이다. `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts`
는 DTO 필드(`joinedAt`) 선언만 추가하며 쿼리를 바꾸지 않는다. 나머지(정적 AST 가드
`user-entity-exposure-guard.ts`, 응답 스캔 헬퍼 `user-secret-absence.ts`, e2e, CHANGELOG/plan
문서, 그리고 대부분을 차지하는 `review/**` 산출물 100여 개)는 DB 쿼리 자체와 무관하다.
이 diff 에 스키마 마이그레이션 파일은 없다.

`git log`로 확인한 결과 이 브랜치는 이미 4라운드의 코드 리뷰(`10_13_22`→`10_53_48`→
`11_27_53`→`11_55_36`→`12_28_02`)를 거쳤고, `workflow-versions.service.ts` 의 핵심 DB 결함
(Critical 1: `findOne` 이 `creator` 관계를 투영 없이 로드)은 `10_13_22`/`10_53_48` 라운드에서
이미 고쳐졌다. 이번 라운드까지 남은 것은 타입 정제(`UnloadedRelations`, `Object.freeze`)뿐이며
쿼리 자체(`where`/`select`/`relations` 옵션)는 `11_27_53` 라운드 이후 변경이 없다. 직전
DB 리뷰(`review/code/2026/09/06/11_27_53/database.md`)의 결론을 실제 파일을 다시 열어 확인했고
동일하다.

## 발견사항

- **[INFO]** `creator` 관계의 컬럼 투영이 SQL 레벨에서 실제로 좁혀짐 — 긍정적 변경(이미 적용됨)
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:69-73`
    (`CREATOR_PROJECTION` 정의), `:107-122`(`findByWorkflow`), `:124-156`(`findOne`)
  - 상세: `WorkflowVersion.creator` 는 `@ManyToOne(() => User)` 다. 이전에는 `findOne` 이
    `relations: ['creator']` 만 쓰고 같은 옵션 객체에 `select` 투영이 없어 TypeORM 이 JOIN 시
    `User` 테이블의 전 컬럼을 SELECT 절에 실었다(`passwordHash`·`twoFactorSecret`·복구
    코드·토큰류가 실제로 wire 로 나갔던 것이 `10_13_22` Critical 1). 지금은
    `relations: { creator: true }` + `select: { …, creator: CREATOR_PROJECTION }` 로 `id`/
    `name`/`email` 세 컬럼만 SQL 레벨에서 SELECT 하도록 고쳐져 있다. 애플리케이션 레이어
    필터링이 아니라 DB 로 보내는 SELECT 절 자체를 좁힌 것이라 응답 노출 방지뿐 아니라
    불필요한 컬럼 전송을 줄이는 효과도 있다. `CREATOR_PROJECTION` 을 두 메서드(`findByWorkflow`
    /`findOne`)가 공유하고, `workflow-versions.service.spec.ts` 가 이 상수의 키를
    `WorkflowVersionCreatorDto` 의 OpenAPI 스키마와 대조하는 테스트를 둬(동일 파일 상단
    `describe('CREATOR_PROJECTION ↔ WorkflowVersionCreatorDto', …)`) 상수와 DTO 선언이 다시
    갈리는 것을 원천 차단한다. 원래 Critical 의 원인(같은 리터럴이 두 곳에 손으로 복제돼 한쪽만
    옳았던 것)을 "공유 상수 + 계약 대조 테스트" 로 구조적으로 해소한 패턴이다.
  - 제안: 없음(조치 완료). 이 패턴(공유 투영 상수 + DTO 스키마 대조 테스트)은 `User` 를
    관계로 싣는 다른 자리에도 재사용할 만하다.

- **[INFO]** `WorkspacesService.listMembers` 는 여전히 `User` 전 컬럼을 SQL 레벨에서
  오버페치한다 — 이번 diff 범위 밖이나 같은 문제 클래스
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` `listMembers`
    (`relations: ['user']`, `select` 없음, `.map()` 으로 `email`/`name` 만 사후 추출) —
    diff 밖 기존 코드. 이번 diff 는 이 자리에 처음 e2e(`workspace-rbac.e2e-spec.ts` 케이스
    `J`)를 붙였을 뿐 쿼리는 바꾸지 않았다.
  - 상세: 애플리케이션 레벨에서 `email`/`name` 만 재구성하므로 응답 노출은 없지만, DB 로
    보내는 SQL 자체는 `User` 의 모든 컬럼(`passwordHash`·`twoFactorSecret`·복구 코드·토큰류
    포함)을 여전히 SELECT 한다 — 불필요한 바이트를 DB→앱으로 전송하는 낭비다. 이 PR 이 신설한
    `user-entity-exposure-guard.ts` 는 이 호출지점을 "투영 없이 통째로 싣는" 자리 중 하나로
    의도적으로 동결(래칫)해 두었을 뿐 고치지는 않았다 — `.map()` 재투영이 실수로(예: 스프레드로)
    사라지면 응답 계층에서 유출이 재발할 수 있는 구조적 여지가 남는다. 이미 이전 라운드
    (`11_27_53/database.md`, `RESOLUTION.md` 남긴 것 표 "INFO#2")가 같은 항목을 "PR 범위 밖
    후속 과제"로 처분했으므로 새 지적이 아니라 확인·재기록이다.
  - 제안: 이 PR 범위 밖 후속 과제로, `listMembers` 에도 `findOne`/`findByWorkflow` 와 같은
    `relations`+`select` 투영(또는 `leftJoin`+`addSelect`)을 적용해 SQL 레벨에서 컬럼을 좁히면
    이 자리도 가드의 "준수" 쪽으로 옮길 수 있다.

- **[INFO]** `User` 엔티티에 컬럼 수준 DB 방어(`select: false`)가 여전히 없음 — 이번 diff 가
  스스로 실측·공개한 기존 상태, 근본 해법은 미해결
  - 위치: `codebase/backend/src/modules/users/entities/user.entity.ts` — 직접 확인:
    `passwordHash`(:27)·`twoFactorSecret`(:50)·`totpRecoveryCodes`(:62)·
    `webauthnRecoveryCodes`(:75)·`emailVerifyToken`(:86)·`passwordResetToken`(:101)·
    `emailChangeToken`(:133) 전부에 `select` 데코레이터 옵션이 없다(`grep -n "select"` 결과
    0건). `CHANGELOG.md` 도 같은 사실("실측(2026-09-06): `select: false` 0건")을 명시한다.
  - 상세: `@Column({ select: false })` 는 관계로 로드되든 주 엔티티로 로드되든 해당 컬럼을
    기본 쿼리에서 항상 제외하는 스키마 레벨 방어다. 이번 diff 는 이를 도입하지 않고 정적
    가드(`user-entity-exposure-guard.ts`) + 런타임 이름 기반 부재 단언(`user-secret-absence.ts`)
    으로 "검출만" 하는 전략을 택했다. CHANGELOG 가 그 이유(민감 7컬럼을 읽는 자리가 19곳 공유
    로더를 지나므로 `select:false` 도입 시 그 로더에 `addSelect` 를 안 넣으면
    `comparePassword(x, undefined)` 가 되어 인증이 예외 없이 조용히 실패하는 위험)를 실측과
    함께 근거로 들고 있어 이번 diff 단독으로는 타당한 판단이다. 다만 이 전략은 미래의 새
    호출지점(가드가 아직 모르는 새 서비스·새 관계)에서 같은 유출이 나는 것은 막지 못하고,
    이미 알려진 호출지점 집합에 대한 회귀만 잡는다 — 정적 가드는 코드 리뷰 시점에 새 위반을
    잡지만, `select:false` 는 쿼리를 새로 짜는 개발자가 가드의 존재를 몰라도 스키마가 기본값
    으로 막아 준다.
  - 제안: 조치 불요(이번 diff 범위 밖, CHANGELOG 가 트레이드오프를 명시적으로 disclose 함).
    `select:false` 전환은 19곳 공유 로더 재배선을 전제로 한다는 조건이 plan 트래커에 남아
    있는지만 확인 권장.

- **[INFO]** `findByWorkflow` 는 워크플로당 버전 전체를 페이지네이션 없이 조회 — 사전 존재
  동작, 이번 diff 는 `select`/`relations` 절만 바꿈
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:107-122`
  - 상세: `this.workflowVersionRepository.find({ where: { workflowId }, … })` 가 `take`/`skip`
    없이 해당 워크플로의 모든 버전 행을 반환한다. `@Unique(['workflowId','version'])` 복합
    유니크 인덱스가 `workflowId` 를 선두 컬럼으로 가지므로 `WHERE workflow_id = ?` 자체의
    인덱스 사용은 문제없다(인덱스 누락 아님). 다만 매우 활발히 저장되는 워크플로우는 버전 행이
    계속 누적되므로 응답 크기가 장기적으로 커질 수 있는 구조다. 이번 diff 는 이 메서드의
    `select`/`relations` 절만 바꿨고 페이지네이션 로직은 건드리지 않았으므로 회귀는 아니다.
  - 제안: 이번 PR 범위 밖. 버전 이력이 실제로 무제한 증가하는 사용 패턴이 관측되면 `take`/
    `skip` 또는 커서 기반 페이지네이션을 후속 과제로 고려.

- **[INFO]** N+1·트랜잭션·SQL 인젝션·커넥션 관리·마이그레이션 안전성 — 이번 diff 범위에서
  이슈 없음
  - 상세: 변경된 두 쿼리(`findByWorkflow`/`findOne`)는 각각 단일 `find`/`findOne` 호출로
    `creator` 관계를 조인해 로드하며 반복문 안에서 개별 쿼리를 실행하지 않는다(N+1 아님).
    사용된 옵션은 전부 TypeORM `Repository.find`/`findOne` 의 파라미터화된 `where`/`select`/
    `relations` 이며 문자열 결합 raw SQL 이 없다(SQL 인젝션 해당 없음). 버전 생성
    (`createVersion`)의 `pessimistic_write` 락 기반 트랜잭션 로직(동시 저장 시 버전 번호
    충돌을 유니크 제약+ advisory 성격의 row lock 으로 처리)은 이번 diff 로 변경되지 않고
    그대로 유지된다. 커넥션 풀 설정을 바꾸는 코드가 없다. 이번 diff 에 `migrations/**` 파일이
    없어 무중단 배포 관점의 신규 위험도 없다.

## 요약

이번 diff 의 DB 쿼리 관련 핵심은 `WorkflowVersionsService.findOne`/`findByWorkflow` 가
`creator`(`User`) 관계를 로드할 때 SQL 레벨에서 `id`/`name`/`email` 세 컬럼만 SELECT 하도록
공유 상수(`CREATOR_PROJECTION`)로 통합·강제한 것이며, 이는 앞선 라운드가 찾은 실제 컬럼
오버페치 Critical(투영 없는 `relations: ['creator']`)을 근본적으로 닫고 DTO 스키마 대조
테스트로 재발까지 구조적으로 막은, 이미 완료된 조치다. 이번 라운드에서 그 파일에 남은 변경은
타입 정제(`UnloadedRelations`)와 상수 `Object.freeze` 뿐으로 쿼리 시맨틱에 새 위험을 만들지
않는다. 인덱스·N+1·트랜잭션·마이그레이션·SQL 인젝션·커넥션 관리 관점에서 이번 diff 가 새로
만드는 위험은 없다. 다만 `WorkspacesService.listMembers` 의 SQL 레벨 오버페치와 `User`
엔티티의 컬럼 수준 방어(`select:false`) 부재는 이번 diff 가 스스로 인지·근거를 든 의도적
범위 제외로 남아 있어 결함이 아니라 INFO 로 기록한다(이전 라운드에서도 동일하게 처분됨).

## 위험도

LOW
