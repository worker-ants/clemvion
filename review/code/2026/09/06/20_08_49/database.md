# 데이터베이스(Database) 리뷰

## 발견사항

- **[WARNING]** `WorkspacesService.listMembers` 가 `User` 관계를 컬럼 프로젝션 없이 전체 로드 — DB 레벨 과다 조회(over-fetch)가 이 PR 이후에도 남아 있음
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` (`listMembers`, 약 213~216행) — `this.memberRepository.find({ where: { workspaceId }, relations: ['user'] })`. 이 파일 자체는 이번 diff 의 변경 대상이 아니고, `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` 신규 테스트(`describe('listMembers — 수동 투영이 좁은지', …)`)가 이 동작을 처음으로 고정했다.
  - 상세: `relations: ['user']` 는 TypeORM 이 `workspace_member` ↔ `user` 를 JOIN 하며 `select` 프로젝션이 없으므로 `User` 테이블의 **전 컬럼**(`passwordHash`·`twoFactorSecret`·`totpRecoveryCodes`·`webauthnRecoveryCodes` 등)을 DB 에서 애플리케이션 프로세스까지 가져온다. 응답에는 `m.user?.email`/`m.user?.name` 만 JS 단에서 수동으로 골라 담아 API 유출은 없지만, 이는 이번 PR 이 `WorkflowVersionsService.findOne` 에서 정확히 같은 패턴("투영 없는 관계 로드 → 컨트롤러가 그대로 반환")을 실유출로 확인하고 `CREATOR_PROJECTION` 상수로 고친 것과 **같은 클래스의 DB 쿼리**다. 차이는 여기선 애플리케이션 레이어의 수동 매핑이 우연히 안전망 역할을 하고 있다는 점뿐이며, 이는 정적 가드(`user-entity-exposure-guard.ts`)가 원리적으로 포착하지 못하는 형태로 이 PR 이 명시적으로 문서화했다(`EXPECTED_USER_RELATION_LOADS` 의 `listMembers` 항목 주석: "안전망은 e2e `workspace-rbac` J. 뿐"). 즉 DB 쿼리 자체는 여전히 민감 컬럼을 물리적으로 가져오고 있고, 그 안전성은 쿼리가 아니라 응답 직전의 수동 매핑 코드 한 줄에 전적으로 의존한다.
  - 제안: `findOne`/`findByWorkflow` 에 적용한 것과 같은 패턴으로 `select: { user: { id: true, email: true, name: true } }` (또는 `QueryBuilder` 의 `addSelect`)를 `listMembers` 쿼리 자체에 추가해 DB 레벨에서부터 컬럼을 제한한다. 이번 PR 은 이 자리를 "검출(테스트)"로만 덮었다고 스스로 명시했으므로, 다음 PR 에서 "방지(쿼리 레벨 프로젝션)"로 승격하는 후속 작업을 권장한다.

- **[INFO]** 트리거 `endpoint_path` UNIQUE 충돌 처리가 DB 제약 기반의 동시성 안전 패턴을 올바르게 사용
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `create`/`update` 의 `this.triggerRepository.save(trigger).catch(...)`, `isEndpointPathUniqueViolation`, `rethrowEndpointPathConflict`.
  - 상세: 사전 `SELECT` 로 중복을 확인한 뒤 `INSERT`/`UPDATE` 하는 TOCTOU 취약 패턴 대신, DB 의 파티셜 UNIQUE 인덱스(`V002__indexes.sql`: `CREATE UNIQUE INDEX idx_trigger_workspace_endpoint ON trigger (workspace_id, endpoint_path) WHERE endpoint_path IS NOT NULL`)가 원자적으로 막고, 애플리케이션은 `23505` + 인덱스명으로 그 결과만 해석한다. 이 자리는 새 마이그레이션 없이 기존 인덱스를 그대로 활용하므로 무중단 배포 관점에서도 추가 lock 위험이 없다. `pgErrorConstraint` 가 `err.constraint ?? err.driverError?.constraint` 두 wrap 표면을 모두 흡수하고, 다른 UNIQUE 인덱스 위반은 그대로 흘려보내(`idx_trigger_workspace_name` 등 대조군 테스트로 확인) 전역 예외 매핑을 가로채지 않는 것도 적절하다.
  - 제안: 조치 불요. 다만 이전 라운드(`review/code/2026/09/06/19_31_04`)의 side_effect 리뷰어가 이미 지적한 대로, 같은 서비스 내 다른 `save()`/`update()` 호출 지점(schedule 역동기화, secret 마이그레이션, chatChannel setup 등)은 이 `.catch` 래핑 대상이 아니다. 현재는 그 경로들이 `endpointPath` 를 다루지 않아 안전하지만, 향후 그 경로로 `endpointPath` 변경이 흘러들면 같은 위반이 가공되지 않은 500 으로 노출될 수 있다는 비대칭은 남아 있다(기존 지적 재확인, 신규 아님).

- **[INFO]** `WorkflowVersionsService.findOne` 의 컬럼 프로젝션 신설은 과다 조회·데이터 유출을 동시에 닫는 정확한 수정
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` — `CREATOR_PROJECTION`, `findOne`(`select` 절 신설), `findByWorkflow`(기존 리터럴을 같은 상수로 교체).
  - 상세: `findOne` 이 `relations: ['creator']` 만 지정하고 `select` 없이 로드해 `User` 전 컬럼을 그대로 응답에 실었던 것을, 자매 메서드 `findByWorkflow` 가 이미 갖고 있던 것과 동일한 3필드 프로젝션(`id, name, email`)으로 좁혔다. 두 메서드가 이제 리터럴이 아니라 공유 상수를 참조하므로, 한쪽만 옳고 다른 쪽이 미러 복제로 어긋나는 재발(이번 PR 이 실제로 겪은 원인)을 구조적으로 차단한다. `workflow-versions.service.spec.ts` 가 이 상수의 키를 `WorkflowVersionCreatorDto` 의 OpenAPI 스키마와 대조하는 테스트로 두 SoT 를 동기화한다.
  - 제안: 조치 불요.

- **[INFO]** SQL 인젝션·트랜잭션·마이그레이션 — 이번 diff 범위에서 특이사항 없음
  - 상세: 이번 diff 는 TypeORM `Repository` API(`find`/`findOne`/`save`)만 사용하고 raw SQL 문자열 조립은 없어 파라미터화 우회 경로가 없다. 스키마 변경(신규 마이그레이션 파일)도 이번 diff 에 포함되지 않았으므로 lock/무중단 배포 리스크는 해당 없다. `TriggersService.create`/`update` 의 `save()` 호출과 그 직후 감사 로그 기록은 이전 라운드에서 이미 검토된 "커밋 직후 기록" 설계를 그대로 유지하며 이번 diff 가 그 순서를 바꾸지 않았다.

## 요약

이번 diff 의 핵심 DB 관련 변경은 두 가지다 — (1) `WorkflowVersionsService.findOne` 이 `creator` 관계를 투영 없이 로드해 `User` 민감 컬럼을 그대로 반환하던 실제 과다조회/유출을 `CREATOR_PROJECTION` 공유 상수로 닫았고, (2) 트리거 `(workspace_id, endpoint_path)` UNIQUE 위반을 DB 제약에 기대는 안전한 `catch` 기반 패턴으로 문서화된 409 계약에 매핑했다. 둘 다 인덱스 사용·동시성·SQL 인젝션 관점에서 적절하고 두터운 테스트(unit 양성/음성/대조군 + e2e)로 뒷받침된다. 유일하게 남은 지적은 `WorkspacesService.listMembers` 가 여전히 `User` 를 컬럼 프로젝션 없이 통째로 로드한다는 점이다 — 이번 PR 이 그 사실을 스스로 발견해 테스트로 고정했지만("검출"), 쿼리 자체의 방어("방지")로는 승격하지 않았다. 애플리케이션 레이어의 수동 매핑이 현재는 안전망 역할을 하고 있으나, `findOne` 에서 같은 패턴이 실유출로 이어졌던 선례를 감안하면 다음 스텝으로 `select` 프로젝션을 이 자리에도 적용할 것을 권장한다. 마이그레이션·트랜잭션·SQL 인젝션·페이지네이션 관점에서는 이번 diff 가 새로 도입한 위험이 없다.

## 위험도

LOW
