# 성능(Performance) 리뷰

## 발견사항

- **[INFO]** `WorkflowVersionsService.findOne` 이 `User` 관계를 컬럼 투영 없이 로드하던 것을 `select` 프로젝션으로 좁혀, DB 왕복당 로드되는 컬럼 수를 줄였다 (긍정적 변경)
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:141-166` (`findOne`), 대조군 `:83-87`(`CREATOR_PROJECTION`)·`:128-138`(자매 메서드 `findByWorkflow` — 이미 투영을 갖고 있던 쪽)
  - 상세: 종전엔 `relations: ['creator']` 만 주고 `select` 가 없어 TypeORM 이 조인된 `User` **전 컬럼**(`passwordHash`·2FA secret·복구 코드 등 포함)을 로드해 JS 객체로 구성한 뒤 컨트롤러가 그대로 반환했다. 이번 diff 는 `select.creator`에 `CREATOR_PROJECTION`(`id`/`name`/`email` 3필드)을 지정해 DB 쿼리 자체가 그 컬럼만 SELECT 하도록 좁혔다 — 이는 보안 수정(민감 컬럼 유출 차단)이면서 동시에 성능 개선이다: 네트워크로 오가는 바이트 수와 ORM 이 hydrate 해야 하는 필드 수가 줄어든다. `findByWorkflow`(목록 조회)는 이 PR 이전부터 이미 같은 투영을 갖고 있어 이번 변경으로 두 자매 메서드의 쿼리 형태가 일치했다.
  - 제안: 조치 불요 — 성능 관점에서 순수 개선.

- **[INFO]** 신규 AST 스캔 가드 2종(`user-entity-exposure-guard.ts`, `dto-jsdoc-citation-guard.ts`)이 매 jest 실행마다 `src/modules` 전체를 `ts.createSourceFile` 로 재파싱한다 — 프로덕션 런타임과 무관한 CI 시간 비용
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts:62-81`(`forEachUserTypedProperty` 내부 루프, `entityFiles`/`moduleFiles` 각각에 대해 파일마다 `fs.readFileSync`+`ts.createSourceFile`), `:348-362`(`findUserRelationLoads` 가 `moduleFiles` 전체를 다시 순회하며 재파싱); `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation-guard.ts:85-97`(`findDtoJsDocCitations` 가 응답 DTO 필터를 통과한 파일마다 재파싱)
  - 상세: `user-entity-exposure.spec.ts` 는 module-scope 상수 계산에서 `collectUserRelationNames(entityFiles)`(엔티티 파일만 1회 파싱)와 `findUserRelationLoads(moduleFiles, …)`(전체 모듈 파일 재파싱, 서로 다른 대상이지만 `moduleFiles` 자체는 `entityFiles` 를 포함하는 상위집합이라 엔티티 파일은 두 번 파싱된다)를 각각 한 번씩 부른다. 같은 패턴이 `dto-jsdoc-citation.spec.ts`, 그리고 저장소의 형제 가드(`swagger-dto-contract-guard.ts`, `nullable-type-lie-cast-guard.ts` 등, 이번 diff 대상 아님)에도 이미 존재한다 — 이 PR 은 그 관례를 그대로 따른 것이라 새로운 설계 결함이 아니다. 다만 가드가 늘어날수록 각 가드 spec 이 파싱 결과를 공유하지 않고 독립적으로 `src/modules` 전체를 훑으므로, 총 CI 파싱 비용은 (가드 수) × (모듈 파일 수) 로 선형 누적된다. 알고리즘 자체는 파일당 O(AST 노드 수)로 정상이고 프로덕션 요청 경로에는 전혀 영향이 없다.
  - 제안: 지금 규모에선 조치 불요. 가드 수가 더 늘어나 CI 시간이 체감되면, `ts.createSourceFile` 결과를 파일 경로 기준으로 캐싱해 여러 가드가 재사용하는 공용 파서 유틸리티를 고려할 수 있다(지금은 시기상조).

- **[INFO]** `WorkspacesService.listMembers` 가 `User` 관계를 투영 없이(`relations: ['user']`) 전부 로드한 뒤 JS 단에서 `email`/`name` 만 골라내는 기존 패턴 — 이번 diff 가 만든 문제는 아니고 새 가드가 명시적으로 baseline 처리한 자리
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:213-216`(`listMembers` — 이번 diff 로 수정되지 않은 기존 코드), 새 baseline 등재는 `codebase/backend/src/repo-guards/__tests__/user-entity-exposure.spec.ts:93`
  - 상세: `find({ where: { workspaceId }, relations: ['user'] })` 는 DB 에서 `User` 전 컬럼을 조인해 로드한 뒤 서비스 메서드가 `email`/`name` 두 필드만 뽑아 새 객체를 만든다 — `WorkflowVersionsService` 가 이번에 고친 것과 같은 형태(투영 없는 전체 컬럼 로드)이지만, 응답 유출은 DB select 가 아니라 JS 매핑이 막고 있어 이 diff 의 새 가드(구조 기반)로는 검출되지 않는다(그래서 `user-entity-exposure.spec.ts` 가 이 자리를 "지킬 수 없음" 으로 명시하고 이름 기반 e2e(`workspace-rbac` J)에 방어를 위임한다). 이번 diff 대상 파일 목록(`workspaces.service.ts` 자체)에 포함되지 않아 성능 회귀는 아니지만, `select` 투영으로 좁히면 `WorkflowVersionsService` 와 동일하게 DB 왕복 컬럼 수를 줄일 여지가 남아 있다.
  - 제안: 이번 PR 범위 밖. 후속으로 `select: { user: { id: true, email: true, name: true } }` 투영을 추가하면 보안 방어선과 성능(컬럼 수 감소)을 동시에 얻을 수 있다는 점만 기록.

## 요약

이번 변경은 성능에 부정적 영향을 주는 신규 알고리즘·N+1 쿼리·블로킹 I/O·불필요한 O(n²) 연산을 도입하지 않았다. 오히려 핵심 프로덕션 변경(`WorkflowVersionsService.findOne` 의 `select` 컬럼 투영 추가)은 보안 수정과 동시에 DB 로드 컬럼 수를 줄이는 성능 개선이다. 나머지 변경은 대부분 테스트/가드 인프라(`User` 컬럼 노출 검출용 AST 스캐너 2종, e2e 케이스, fixture)이며, 이들은 프로덕션 요청 경로가 아니라 CI 시점에만 실행되고(`tsconfig.build.json` exclude 로 dist 미포함), 알고리즘 복잡도도 파일 수·AST 노드 수에 선형이라 문제되지 않는다. 유일하게 언급할 만한 것은 가드가 늘어날수록 각 spec 이 독립적으로 `src/modules` 전체를 재파싱해 CI 시간이 누적된다는 점과, 이번에 고치지 않은 자매 자리(`WorkspacesService.listMembers`)가 여전히 투영 없는 전체 컬럼 로드를 쓴다는 점인데, 둘 다 INFO 수준이며 이번 diff 의 회귀가 아니다.

## 위험도

NONE
