# 아키텍처(Architecture) 리뷰

## 개요

이번 diff(`origin/main...HEAD`, 7개 커밋)의 실질 코드 변경은 `CHANGELOG.md`·`spec/conventions/*` 를 제외하면 16개 backend 파일이다. 핵심은 `User` 엔티티 컬럼 노출을 막는 **세 개의 정적/런타임 가드**(구조 축 `user-entity-exposure-guard.ts`, 이름 축 `user-secret-absence.ts`, 문서 축 `dto-jsdoc-citation-guard.ts`) 신설과, 그 가드들이 실제로 찾아낸 `WorkflowVersionsService.findOne` 의 `User` 전 컬럼 유출 수정이다. `review/`·`plan/` 하위 파일들은 과거 리뷰 라운드의 산출물이며 이번 아키텍처 평가 대상에서 제외한다(코드 변경 없음).

## 발견사항

- **[WARNING]** 새 구조 가드의 "허용 목록(ratchet baseline)"이 방어 **강도가 다른 두 패턴**을 동일하게 취급한다
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure.spec.ts` — `EXPECTED_USER_RELATION_LOADS` (`'modules/workspaces/workspaces.service.ts#listMembers'` 항목); 대조 대상은 `codebase/backend/src/modules/workspaces/workspaces.service.ts` — `listMembers` 메서드(`relations: ['user']`, DB `select` 없음, JS 단에서 `email`/`name`만 수동 매핑) vs `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` — `findOne`/`findByWorkflow`(`select: { creator: CREATOR_PROJECTION }`, DB 레벨 투영)
  - 상세: 이번 diff 가 고친 Critical 결함(`WorkflowVersionsService.findOne`)의 근본 원인은 "`User` 관계를 투영 없이 통째로 로드한 뒤, 컨트롤러가 가공 없이 반환"하는 패턴이었다. 수정은 **DB 레벨 `select` 투영**(`CREATOR_PROJECTION`)으로 그 관계 자체가 애플리케이션 메모리에 발을 들이지 못하게 막았다 — TypeORM/Postgres 가 컬럼을 아예 안 실어 온다. 반면 새로 세운 구조 가드가 `EXPECTED_USER_RELATION_LOADS` 로 동결한 `workspaces.service.ts#listMembers` 는 정확히 그 원인 패턴("투영 없이 `User` 전체를 로드")을 그대로 가지고 있고, 다만 그 뒤 **JS 코드에서 수동으로 `email`/`name` 두 필드만 골라 새 객체를 만드는 단계**가 있어 오늘은 안전하다. 이 구분(DB 투영 vs 수동 JS 매핑)은 방어 메커니즘의 성격이 근본적으로 다르다: DB 투영은 그 자리를 누가 어떻게 바꿔도(예: 새 소비자가 `return version` 을 그대로 반환) 컬럼 자체가 없어 안전한 반면, 수동 JS 매핑은 그 매핑 코드 자체가 계속 좁게 유지되는지에 전적으로 의존한다. 그런데 이 가드는 "로드 지점에 투영이 있는가"만 검사하고 그 뒤의 수동 매핑이 좁게 유지되는지는 어떤 정적 메커니즘으로도 강제하지 않는다 — `listMembers` 가 나중에 `...m.user` 스프레드나 `user: m.user` 통째 반환으로 바뀌어도 이 구조 가드는 여전히 초록이다(로드 지점의 `relations:['user']` 자체는 최초부터 허용 목록에 있었으므로). 이번 diff 가 신규 e2e(`workspace-rbac.e2e-spec.ts` 케이스 J, `expectNoUserSecrets`)로 그 엔드포인트 하나는 런타임에서 커버했지만, 그 커버리지는 "이 특정 엔드포인트에 이 특정 e2e 가 계속 존재하고 실행되는가"에 의존하는 것이지, `listMembers` 를 재사용하는 **미래의 다른 호출부**까지 구조적으로 보장하지 않는다. 즉 같은 가드 스위트 안에 "결코 못 새는" 방어(DB 투영, `findOne`)와 "지금은 안 새지만 코드가 바뀌면 샐 수 있는" 방어(JS 매핑, `listMembers`)가 같은 등급(허용 목록 통과)으로 섞여 있다.
  - 제안: 허용 목록 항목에 방어 메커니즘 종류(`db-projected` vs `manual-js-projection`)를 태그로 구분해 두거나, `hasProjectionFor` 와 유사하게 "로드 직후 반환/응답 구성 지점에서 실제로 좁은 필드만 참조하는지"까지 보는 2차 술어를 두는 것을 검토한다. 최소한 `EXPECTED_USER_RELATION_LOADS` 주석에 "이 항목은 e2e(`workspace-rbac` J)가 유일한 안전망이다"라는 의존 관계를 명시해, 그 e2e 가 삭제/스킵될 때 구조 가드만으로는 잡히지 않는다는 사실을 다음 사람이 알 수 있게 한다.

- **[INFO]** 동일한 "User 관계 안전 투영(`id`/`name`/`email`)" 개념이 서로 다른 문법으로 최소 두 곳에 독립 구현되어 있다 — 공유 원시 타입/상수 없음
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:69`(`export const CREATOR_PROJECTION = Object.freeze({ id: true, name: true, email: true })`) vs `codebase/backend/src/modules/audit-logs/audit-logs.service.ts`(`.addSelect(['user.id', 'user.name', 'user.email'])`, 이번 diff 밖의 기존 코드)
  - 상세: 두 서비스가 같은 의도("`User` 관계에서 안전한 3필드만 wire 로 내보낸다")를 각자 다른 API 형태(Repository `select` 객체 리터럴 vs QueryBuilder 문자열 배열)로 손으로 다시 적었다. `workflow-versions.service.ts` 쪽은 이번 diff 에서 `CREATOR_PROJECTION` 상수화 + 스키마 대조 테스트(`workflow-versions.service.spec.ts`)로 "선언-투영 일치"를 회귀 방지했지만, 그 보호는 이 파일 안에서만 유효하고 `audit-logs.service.ts` 의 동일 개념과는 연결되어 있지 않다. 이번 PR 자신의 근본 원인(*"같은 리터럴이 두 곳에 손으로 복제돼 있었기 때문"*, `workflow-versions.service.ts:60` 주석)이 서비스 파일 내부에서는 해소됐지만, 서비스 파일 간에는 같은 형태의 잠재적 drift(한쪽만 필드가 늘거나 줄어드는 것)가 여전히 가능하다 — 예컨대 `User` 에 안전하게 노출 가능한 필드가 하나 추가되면 두 자리를 각각 손으로 갱신해야 하고, 자동으로 서로를 검증하는 장치는 없다.
  - 제안: 급하지 않음(현재 필드 3개로 소규모, 각자 자기 자리에서 회귀 테스트를 갖춤). 다만 `User` 관계 투영이 세 번째 자리에 또 필요해지면, 이번에 두 자리에 손 복제됐던 실패를 반복하기 전에 `shared/` 아래 공용 상수(`SAFE_USER_RELATION_FIELDS` 등)로 승격하는 것을 고려할 시점이다.

- **[INFO]** `repo-guards/__tests__/` 안에서 "순수 스캔 로직(`*-guard.ts`) / 소비 spec(`*.spec.ts`) 분리" 관례가 3번째 가드(`dto-jsdoc-citation-guard.ts`)에도 일관되게 적용됐고, 새 가드가 기존 가드의 판정 함수(`isResponseDtoFile`)를 재사용해 판정 기준을 한 곳에 묶었다
  - 위치: `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation-guard.ts:12`(`import { isResponseDtoFile } from './swagger-dto-contract-guard'`)
  - 상세: 두 가드가 "이 파일이 응답 DTO 파일인가"라는 동일 판정을 각자 재구현했다면 한쪽만 바뀌었을 때 조용히 갈렸을 것(diff 자체의 주석이 이를 명시). 대신 단방향 의존(`dto-jsdoc-citation-guard.ts → swagger-dto-contract-guard.ts`)으로 SoT 를 하나로 묶었고, 역방향 참조나 순환은 없음을 확인했다(`swagger-dto-contract-guard.ts` 는 `dto-jsdoc-citation-guard.ts` 를 import 하지 않음). 좋은 설계 결정이라 기록만 남긴다.
  - 제안: 없음.

- **[INFO]** `WorkflowVersionsService.findOne`/`findByWorkflow` 의 반환 타입 좁히기(`WorkflowVersionDetail`/`ProjectedCreator`)는 컴파일 타임 계약이지 런타임 캐스트가 아니다 — 문서화된 의도와 실제 메커니즘이 정확히 일치한다
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:124-152`(`findOne`)
  - 상세: TypeORM 의 `Repository.findOne` 은 `select` 옵션과 무관하게 컴파일 타임엔 항상 전체 엔티티 타입(`WorkflowVersion | null`)을 반환하므로, `return version;` 이 `Promise<WorkflowVersionDetail>` 로 구조적으로 호환되는 것은 `WorkflowVersionDetail` 이 `WorkflowVersion` 보다 넓은 상위 집합(Pick 관계)이기 때문이며 별도 캐스트가 필요 없다. 이 서비스 메서드가 만드는 실질적 보호는 "이 메서드를 호출하는 **외부 코드**의 타입 체크"에 있다 — 컨트롤러나 `workflows.service.ts#restoreVersion` 이 `.creator.passwordHash` 또는 `.workflow` 에 접근하면 그 자리에서 컴파일 오류가 난다. 실제로 `restoreVersion`(`workflows.service.ts:666`)이 `target.snapshot` 만 참조함을 확인했고, `.workflow` 필드에 의존하는 다른 소비처는 저장소 전체에 없음을 확인했다. 의도한 대로 동작하는 설계라 결함은 아니며, 다만 "컴파일 타임 차단"의 근거가 반환값 자체의 캐스트가 아니라 **함수 시그니처가 만드는 공개 계약**이라는 점을 다음에 이 패턴을 확장할 사람이 알아 두면 좋다(예: 이 서비스 안에서 `this.workflowVersionRepository.findOne(...)` 을 또 다른 메서드가 직접 호출하면 그 메서드의 반환 타입 선언에 따라 같은 보호가 재적용되지 않을 수 있다).
  - 제안: 없음 — 기록 목적.

## 요약

핵심 설계(구조 축·이름 축·문서 축 3중 가드, `순수 스캔/소비 spec` 분리, `CREATOR_PROJECTION` 상수화 + 스키마 대조 테스트)는 SRP·낮은 결합도·명확한 레이어 책임을 잘 지킨다 — 각 가드는 단일 관심사만 검사하고, 서로 참조가 필요한 곳(DTO 파일 판정)은 단방향 의존으로 SoT 를 통일했으며, 순환 참조는 없다. 유일하게 지적할 아키텍처 수준 결함은 새 구조 가드의 허용 목록(ratchet)이 "DB 레벨 투영"과 "전체 로드 후 JS 수동 매핑"이라는 방어 강도가 다른 두 메커니즘을 같은 등급으로 통과시켜, 이번 PR 이 고친 Critical 결함과 구조적으로 동일한 패턴(`workspaces.service.ts#listMembers`)이 e2e 하나에만 의존한 채 허용 목록에 동결되어 있다는 점이다 — 오늘은 안전하지만 그 안전성을 지키는 메커니즘이 다른 항목들과 이질적이다. 그 외에는 `User` 안전 투영 리터럴이 두 서비스 파일에 각자 다른 문법으로 존재하는 사소한 추상화 누락과, 몇 가지 견고한 설계 선택을 확인 차 기록했다. 확장성 관점에서 세 번째 유사 결함이 생겼을 때 재사용 가능한 공유 프리미티브는 아직 없지만, 회귀 방지 테스트가 각 지점에서 개별적으로 강하게 걸려 있어 즉각적인 리스크는 낮다.

## 위험도

LOW
