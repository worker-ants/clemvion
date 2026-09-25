# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `throwOwnerTransferRequired` 의 object-spread 순서가 뒤바뀌면 커스텀 메시지가 조용히 사라진다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:940` (`private throwOwnerTransferRequired(): never`)
  - 상세: `{ code: ROLE_REQUIRED.owner.code, message: '...' }` 를 `{ ...ROLE_REQUIRED.owner, message: '...' }` 로 바꿨다. 현재 순서(스프레드 먼저, `message` 나중)에서는 커스텀 메시지가 `ROLE_REQUIRED.owner.message`(`'Owner 권한이 필요합니다.'`)를 정확히 덮어써 동작이 이전과 동일하다(직접 실측: 결과 객체 `{code:'OWNER_REQUIRED', message:'owner 이양은 현재 owner 만 수행할 수 있습니다.'}` — 변경 전과 동일). 다만 이 형태는 두 줄의 순서에 의미가 실려 있어, 향후 누군가 필드 순서를 바꾸거나(`message` 를 스프레드보다 앞에 두는 식) `ROLE_REQUIRED.owner` 에 필드가 추가되면 같은 파일의 테스트(`workspaces.service.spec.ts:1050-1057`, 이 PR에서 `message` 값까지 단언하도록 강화됨)가 그 회귀를 즉시 잡아준다. 코드 자체의 부작용은 아니고, 향후 편집자가 조심해야 할 latent footgun 정도다.
  - 제안: 조치 불필요(테스트가 이미 회귀를 방어). 리뷰 기록 목적의 참고 사항.

- **[INFO]** `ADMIN_ROLES` 를 `integrations.service.ts` 로컬 상수에서 `workspace-roles.ts` 공유 상수로 교체 — 값 동등성 확인
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:16` (import), 제거된 로컬 선언은 이전 `const ADMIN_ROLES = new Set(['owner', 'admin']);` 자리
  - 상세: 새 `ADMIN_ROLES` 는 `workspace-roles.ts` 에서 `Object.keys(WORKSPACE_ROLE_LEVEL).filter(level >= admin)` 로 계산되며 `WORKSPACE_ROLE_LEVEL = {viewer:1, editor:2, admin:3, owner:4}` 기준 결과 집합은 `{'admin','owner'}` — 기존 하드코딩 `Set(['owner','admin'])` 과 원소가 동일하다. 타입만 `Set<string>` → `ReadonlySet<string>` 로 바뀌었는데, `integrations.service.ts` 안의 유일한 사용처(`ADMIN_ROLES.has(role)`, 1568행)는 읽기 전용 메서드만 쓰므로 컴파일·런타임 모두 영향 없음(grep 으로 `.add`/`.delete` 등 변형 호출 부재 확인).
  - 제안: 없음(정보성 확인).

- **[INFO]** `workspace.decorator.ts` reflection 헬퍼 추출(`routeArgEntriesMatching`) — 두 판별 함수의 관측 동작 동일함을 라인 대 라인으로 대조
  - 위치: `codebase/backend/src/common/decorators/workspace.decorator.ts:64-80` (신규 헬퍼), `:95-107` (`handlerConsumesWorkspaceId`), `:149-160` (`workspaceParamNamesOf`)
  - 상세: `handlerConsumesWorkspaceId` 는 `Object.values(argsMetadata).some(...)` → `routeArgEntriesMatching(...).length > 0` 로, `workspaceParamNamesOf` 는 동일 `.filter().map().filter()` 체인을 공통 헬퍼 뒤로 옮겼을 뿐 필터 조건·early-return(`methodName` 없음/`argsMetadata` 없음 → 각각 `false`/`[]`)이 그대로 보존된다. 두 함수 모두 export 시그니처(`(controllerClass: object, handler: Function) => boolean|string[]`) 불변이라 `roles.guard.ts` 등 기존 호출자에 영향 없음.
  - 제안: 없음(정보성 확인, 순수 리팩터로 판단).

- **[INFO]** Swagger `description` 문자열이 공유 상수(`NOT_A_MEMBER.code`, `ROLE_REQUIRED.*.code`)를 템플릿 리터럴로 보간하도록 바뀜(`auth.controller.ts`, `executions.controller.ts`, `workspaces.controller.ts`)
  - 위치: 예) `codebase/backend/src/modules/auth/auth.controller.ts:431` / `codebase/backend/src/modules/executions/executions.controller.ts:282,311` / `codebase/backend/src/modules/workspaces/workspaces.controller.ts:71-73,396`
  - 상세: 데코레이터 팩토리 인자는 클래스 정의(모듈 평가) 시점에 동기 평가되므로, `workspace-roles.ts` → 각 컨트롤러 순의 정적 import 순서만 지켜지면(순환 참조 없음, 직접 확인) 부작용 없이 OpenAPI 문서 문자열만 바뀐다. 공개 API 응답 바디·상태 코드는 변경되지 않고 Swagger 문서 텍스트만 코드값과 동기화된다.
  - 제안: 없음(정보성 확인).

- **[INFO]** `transferOwnership` 의 트랜잭션-밖 무락 사전 판정은 이 diff 로 새로 추가된 코드가 아니라 기존 동작에 대한 docstring 정정
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:723-734` (docstring 갱신 대상 메서드), 실제 무락 체크(`getMemberRole` → `throwOwnerTransferRequired`)는 728-733행
  - 상세: unified diff 는 JSDoc 블록(708-722)과 `throwOwnerTransferRequired` 본문(938-943)만 건드리고, 트랜잭션 내부의 순차 `findOne` 두 번짜리 락 로직(756-796)은 diff 밖 — 즉 "두 멤버를 단일 IN 쿼리로 락"이라는 옛 주석이 실제로는 처음부터(`eb009f99c`) 순차 `pessimistic_write` 두 번이었음을 바로잡는 정정이며, 락 순서·동시성 보장 자체는 이번 PR 로 바뀌지 않았다. CLAUDE.md 의 "자기-반증형 소정정" 예외 조건(예고 문장 정정, 취소선 없이도 실측 근거를 본문에 병기)과 부합하는 형태.
  - 제안: 없음(문서 정합성 확인 목적).

## 요약

8개 파일 모두 기존 동작을 보존하는 리팩터·상수 통합·문서 정정 범위였다. `integrations.service.ts` 의 로컬 `ADMIN_ROLES` → 공유 상수 교체는 원소 집합이 수학적으로 동일함을 확인했고(`{admin, owner}`), `workspace.decorator.ts` 의 reflection 헬퍼 추출은 두 판별 함수의 관측 가능한 입출력이 라인 단위로 동일하다. 컨트롤러들의 Swagger `description` 보간은 응답 바디·상태코드에 영향을 주지 않는 문서 텍스트 변경이며, 정적 import 순서에 순환 의존성이 없어 모듈 평가 시점 부작용 위험도 없다. `workspaces.service.ts` 의 `transferOwnership` 관련 변경은 새 코드가 아니라 기존 락 순서에 대한 잘못된 주석을 실측(코드 자체)에 맞춰 정정한 것이고, `throwOwnerTransferRequired` 의 object-spread 는 필드 순서가 올바르게 유지되는 한 이전과 동일한 `{code, message}` 를 낸다(테스트가 순서 회귀를 방어). 전역 상태·파일시스템·환경변수·네트워크 호출·이벤트/콜백 표면에 새로운 부작용은 발견되지 않았고, 공개 함수 시그니처도 전부 유지됐다.

## 위험도

NONE
