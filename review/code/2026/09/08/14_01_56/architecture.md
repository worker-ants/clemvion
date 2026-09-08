# 아키텍처(Architecture) 코드 리뷰

## 발견사항

- **[WARNING]** "안전한 User 투영" 형태가 서로 다른 바운디드 컨텍스트에 이름 없는 리터럴로 또 중복됐다 — 이 PR 자신이 세운 SoT 원칙(`pg-error.ts`)과 반대 방향
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:225-231` (`select: { …, user: { id: true, email: true, name: true } }`) vs `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:92-96` (기존 `export const CREATOR_PROJECTION = Object.freeze({ id: true, name: true, email: true })`)
  - 상세: 이번 diff 가 도입한 `WorkspacesService.listMembers` 의 DB 레벨 `select` 투영은 `{ id, email, name }` 세 키를 인라인 객체 리터럴로 적었다. 그런데 정확히 같은 집합·같은 목적(“User 엔티티에서 민감 컬럼을 걷어내고 안전한 3필드만 로드”)을 가진 상수가 같은 저장소의 `workflow-versions.service.ts` 에 이미 `CREATOR_PROJECTION` 이라는 이름으로 존재하고, 그 파일 자신의 JSDoc 은 "이 목록의 항목들이 지향할 형태"라고 `listMembers` 를 정확히 지목하고 있었다(같은 diff 의 `user-entity-exposure.spec.ts` 주석). 즉 이번 diff 는 "지향할 형태"로 옮겨가면서 **이미 존재하는 이름 있는 SoT 를 재사용하지 않고 같은 값을 다시 손으로 적었다** — 이 PR 의 다른 절반(B-3: `http-exception.filter.ts`/`integration-oauth.service.ts` 가 각자 손으로 짠 `isUniqueViolation`/constraint 추출을 `pg-error.ts` 단일 헬퍼로 통합)이 보여주는 것과 정반대 방향의 판단이다. `CREATOR_PROJECTION` 은 `workflow-versions.service.spec.ts` 가 대응 DTO(`WorkflowVersionCreatorDto`) 의 OpenAPI 스키마와 키를 대조해 드리프트를 막는데, `workspaces.service.ts` 의 인라인 리터럴은 그런 앵커가 없어 두 자리 중 하나가 나중에 필드를 추가/삭제해도 서로 알아채지 못한다. `notifications.service.ts:449` 의 `{ id: true, email: true }` 까지 포함하면 이미 세 번째 변형이 저장소에 흩어져 있어("세 번째 자리에서야 접었다"는 이 PR 자신의 다른 커밋 패턴과 같은 형태로) 다음 콜사이트가 컬럼 하나를 빠뜨릴 위험이 구조적으로 열려 있다.
  - 제안: `CREATOR_PROJECTION` 을 `workflow-versions` 모듈 밖(예: `common/db/user-projection.ts` 또는 `modules/users`)으로 승격해 `SAFE_USER_PROJECTION` 같은 이름의 공용 상수로 export 하고, `workspaces.service.ts`(및 향후 콜사이트)가 그것을 import 해서 쓰도록 한다. `workflow-versions` 모듈의 상수를 `workspaces` 가 직접 import 하는 것은 무관한 바운디드 컨텍스트 간 결합을 만들므로, 공용 홈을 새로 두는 편이 모듈 경계를 지키면서 SoT 를 확보하는 방법이다.

- **[INFO]** 프런트/백엔드 wire 타입 미러가 개명으로 이름 충돌만 해소됐고, 두 선언을 자동으로 동기화하는 경계 계약은 여전히 없다
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:70`(`WorkflowVersionDetailProjection`), `codebase/frontend/src/lib/api/workflows.ts:123`(`WorkflowVersionDetail`)
  - 상세: 개명 자체는 타당하다 — 같은 이름 때문에 `grep` 이 두 선언을 하나로 착각해 세 라운드 연속 "유일 정의" 오판을 냈다는 근거가 문서(JSDoc)에 구체적으로 남아 있다. 다만 이것은 **증상**(이름 충돌)을 없앤 것이지, **원인**(공유 타입 패키지를 거치지 않는 손-미러이고, 둘의 형태가 실제로 갈려 있음에도 그 사실을 강제하는 계약 테스트가 없음)은 그대로다. 두 파일 모두 JSDoc 으로 "저쪽을 열어라"고 사람에게 요청할 뿐, 어느 쪽도 필드가 실제로 동기화됐는지 자동으로 검증하지 않는다. 문서 자체가 "개명이나 공유 패키지화는 이 PR 범위 밖"이라고 명시하고 있어 의도된 축소 범위이므로 CRITICAL/WARNING 으로 올리지 않으나, 모듈 경계(백엔드 wire 계약 ↔ 프런트 소비 타입) 를 강제하는 장치가 여전히 부재하다는 사실은 남는다.
  - 제안: 지금 조치 불요(범위 밖으로 명시됨). 다음에 이 타입을 다시 열 때는, 최소한 백엔드 e2e 응답 스냅샷이나 프런트 zod 스키마 검증 등으로 "두 선언이 실제로 같은 wire 형태를 가리키는가"를 자동으로 확인하는 장치를 함께 검토할 것.

- **[INFO]** 동일한 테스트 픽스처(`raceErrorSurfaces`, flat/wrapped 두 표면)가 provider 두 스펙 파일에 문자 그대로 중복됐다 — 같은 PR 이 옆에 만든 공유 픽스처 패턴과 다른 선택
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.cafe24.spec.ts:602-632`, `codebase/backend/src/modules/integrations/integration-oauth.service.makeshop.spec.ts:508-538`
  - 상세: 이 저장소는 provider 간 구조적 미러 중복(`cafe24-api.client.ts`/`makeshop-api.client.ts`)을 의도로 확정한 선례가 있지만, 그 근거는 "3번째 provider 가 인증·rate-limit·envelope 에서 어떻게 발산할지 예측 불가"라는 **provider 고유 로직**에 대한 것이다. 여기서 중복되는 `raceErrorSurfaces` 는 provider 와 무관한 **Postgres 에러 모양**(raw/wrapped 두 표면)을 흉내 내는 순수 테스트 픽스처라 같은 근거가 그대로 적용되는지 분명치 않다. 같은 PR 이 정확히 이 문제(값은 같은데 두 자리에 손으로 반복)를 `endpoint-path-save.fixture.ts` 라는 **공유 fixture 파일**로 뽑아 해결하는 패턴을 이미 보여주고 있어, 두 접근이 같은 diff 안에서 공존한다.
  - 제안: 지금 당장 조치 불요(26줄, 두 자리, 기능 영향 없음). 다음에 이 배열을 만질 기회가 있으면 `common/db/__tests__/pg-race-error-surfaces.fixture.ts` 류로 뽑아 두 spec 이 import 하도록 정리할 만하다.

- **[INFO]** 신규 AST 가드가 기존 `repo-guards` 아키텍처 관례(스캔 로직/소비 spec 분리, `source-scan.ts` 공용 유틸 재사용)를 정확히 따르고, 형제 가드의 중복 로직을 공용 함수로 승격한 점은 긍정적
  - 위치: `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts` (신규), `codebase/backend/src/common/__test-utils__/source-scan.ts:101-127`(`enclosingScopeName` 신설), `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts`(자체 `enclosingName` 제거 후 공용 함수로 교체)
  - 상세: `user-entity-exposure-guard.ts` 와 신규 `endpoint-path-conflict-wrap-guard.ts` 가 각자 구현하던 "노드를 감싸는 스코프 이름 찾기" AST 워커를 `source-scan.ts` 의 `enclosingScopeName` 하나로 승격했다. 판정 순서(메서드 → 함수-초기자 변수 → 아무 변수 → `<module>`)를 문서화하고, 이전 두 구현이 서로 달라 한쪽에 버그(변수가 메서드보다 먼저 매칭)가 있었다는 사실까지 주석에 남겨 향후 재발을 막는다. 가드 모듈(순수 스캔)과 spec 모듈(도메인별 기대값 목록)의 분리, `SRC_ROOT`/`CONFLICT_WRAPPER`/`TRIGGER_REPOSITORY` 같은 매직 문자열의 명명 상수화도 형제 가드와 일관된다. 조치 불요 — 참고용 긍정 기록.

## 요약

이번 배치는 대체로 응집도를 높이고 결합을 낮추는 방향의 리팩터다 — `pg-error.ts` 를 Postgres 에러 판정의 단일 진실로 통합해 `http-exception.filter.ts`(전역 예외 필터, 프레젠테이션 경계)와 `integration-oauth.service.ts`(비즈니스 레이어)가 각자 손으로 짜던 사본을 제거했고, AST 기반 구조 가드(`endpoint-path-conflict-wrap-guard.ts`)는 기존 `repo-guards` 아키텍처(스캔/소비 분리, 공용 AST 유틸)를 정확히 따르며 공용 `enclosingScopeName` 승격으로 형제 가드의 중복까지 줄였다. `WorkspacesService.listMembers` 를 JS 단 매핑에서 DB 레벨 `select` 투영으로 옮긴 것은 "검출에서 강제로" 방어 계층을 데이터 레이어에 정확히 배치한 좋은 판단이다. 다만 그 전환 과정에서, 이미 `workflow-versions.service.ts` 에 이름 있는 SoT(`CREATOR_PROJECTION`, DTO 대조 테스트까지 갖춤)로 존재하는 "안전한 User 투영" 형태를 재사용하지 않고 인라인 리터럴로 다시 적었다 — 이 PR 이 다른 곳에서 실천한 SoT 원칙과 반대 방향이며, 세 번째 변형(`notifications.service.ts`)까지 이미 존재해 다음 콜사이트가 컬럼을 빠뜨릴 구조적 위험을 남긴다. 그 외 백엔드/프런트 타입 미러 개명과 provider 스펙 픽스처 중복은 범위가 명시적으로 제한된 기존 부채이며 이번 diff 가 악화시키지 않았다. 순환 의존성이나 레이어 경계 위반은 발견되지 않았다.

## 위험도

LOW
