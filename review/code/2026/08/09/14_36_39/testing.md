# 테스트(Testing) Review — auth-guard-reflection-hardening

## 발견사항

- **[WARNING]** `RolesGuard`(실제 전역 `APP_GUARD` — 이번 PR 이 새로 추가한 `resolveRequestWorkspaceContext` 의 `BadRequestException` throw 경로를 프로덕션에서 **가장 먼저** 통과하는 지점)에 대해, 형식이 깨진 `X-Workspace-Id` 헤더가 400 으로 전파되는지 검증하는 테스트가 **하나도 없다**.
  - 위치: `codebase/backend/src/common/guards/roles.guard.spec.ts` (파일 전체 — 이번 diff 는 픽스처를 UUID 형태로 바꾸기만 했고 신규 `describe`/`it` 블록이 없다). 대응 구현: `codebase/backend/src/common/guards/roles.guard.ts:121-127` (`resolveRequestWorkspaceContext(request.headers, ...)` 호출부, `canActivate` 는 `async`).
  - 상세: 같은 헬퍼(`resolveRequestWorkspaceContext`)를 소비하는 두 곳 중 `workspace.decorator.spec.ts` 는 이번 PR 에서 "형식이 깨진 헤더 → 400 VALIDATION_ERROR" 테스트를 명시적으로 추가했고(`workspace.decorator.spec.ts:92-113`), `workspace-context.util.spec.ts` 도 `it.each` 로 5가지 malformed 케이스를 검증했다. 그런데 실제 요청 파이프라인에서 이 값을 **가장 먼저** 만나는 곳은 (파라미터 데코레이터가 아니라) 전역 가드인 `RolesGuard.canActivate` 다. 이 메서드는 `async` 라 내부에서 던진 동기 예외가 reject 된 Promise 로 변환되어 Nest 가드 파이프라인이 이를 정상적으로 예외 필터로 넘길 것이라는 **프레임워크 동작에 대한 암묵적 신뢰**에 의존하는데, 이 신뢰를 직접 검증하는 단위 테스트가 이 diff 에 빠져 있다. `roles.guard.spec.ts` 는 이미 이번 PR 에서 편집된 파일(픽스처 리네임)이라 함께 추가하기 가장 자연스러운 자리였다.
  - 제안: `roles.guard.spec.ts` 에 `makeContext({ headerWorkspaceId: 'not-a-uuid', ... })` 로 `guard.canActivate(ctx)` 가 `BadRequestException`(code `VALIDATION_ERROR`)을 reject 하는지 확인하는 테스트를 추가한다. `@Roles()` 라우트 1건 + `@WorkspaceId()`-only 라우트 1건 두 조합 모두에서 확인하는 것이 권장된다(§아래 두 번째 발견 참조).

- **[WARNING]** "워크스페이스와 무관한 전역 라우트(`@Roles()`·`@WorkspaceId()` 둘 다 미사용)는 헤더가 깨져도 400 을 내지 않는다"는, 이번 PR 이 의도한 정확한 경계(캐너리로 지키는 reflection 스코핑 + 신규 UUID 검증의 상호작용)를 검증하는 테스트가 **vacuous** 하다.
  - 위치: `codebase/backend/src/common/guards/roles.guard.spec.ts` — `describe('@Roles() 도 @WorkspaceId() 도 안 쓰는 라우트는 헤더와 무관하게 통과', ...)` 블록의 첫 번째 `it`("비멤버 워크스페이스로 헤더가 위조돼도(전역 API) 통과").
  - 상세: 이 테스트는 `headerWorkspaceId: '00000000-0000-0000-0000-000000000000'`(nil UUID)를 쓴다. 이 값은 `isUuidShaped` 를 **통과하는** 값이라 애초에 400 을 낼 수 없는 값이다 — 즉 이 테스트는 "early-return 이 검증을 건너뛰는지"와 "검증이 실행됐지만 우연히 통과했는지"를 구분하지 못한다. `roles.guard.ts:114-119` 의 early-return(`handlerConsumesWorkspaceId` false + `@Roles()` 없음)이 `resolveRequestWorkspaceContext` 호출(:121-127)보다 **먼저** 실행되기 때문에 지금은 실제로 올바르게 동작하지만, 이를 뒷받침하는 회귀 테스트가 없다 — 누군가 두 검사의 순서를 바꾸거나 early-return 조건을 좁히는 리팩터를 하면, 전역 API(예: `system-status`)에 진짜 malformed 헤더(`'not-a-uuid'` 등)를 보냈을 때 조용히 400 회귀가 생겨도 이 스위트가 RED 로 잡아내지 못한다.
  - 제안: 같은 `describe` 블록에 `headerWorkspaceId: 'not-a-uuid'`(genuinely malformed) + `GlobalRouteTarget` 조합으로 `canActivate` 가 여전히 `true` 를 resolve 하는(throw 하지 않는) 테스트를 추가해 이 경계를 명시적으로 고정한다.

- **[INFO]** `main.ts` 의 `assertWorkspaceIdReflectionWorks(app)` 배선(부팅 시점 위치: `assertProductionConfig` 이후, body parser 등록 이전)을 직접 검증하는 단위/통합 테스트가 없다.
  - 위치: `codebase/backend/src/main.ts:161-168` (`bootstrap` 함수는 export 되지 않고 `void bootstrap()` 으로만 호출됨 — line 239).
  - 상세: `bootstrap()` 이 export 되지 않아 직접 단위 테스트가 어렵고, 검증은 전적으로 e2e 스위트 통과(261건)에 대한 간접 추론("캐너리가 던졌다면 실제 서버 프로세스가 listen 하지 못해 261건이 전부 연결 실패했을 것")에 의존한다. 이 추론 자체는 `plan/in-progress/auth-guard-reflection-hardening.md` 체크리스트에 이미 명시적으로 근거와 함께 기록돼 있고(자체 인지된 한계), e2e 인프라가 실제로 `main.ts` 빌드 산출물을 구동하는 Docker 컨테이너(`backend-e2e:3011`)임을 `system-status.e2e-spec.ts` 로 확인했다 — 근거 자체는 타당하다. 다만 이 안전장치의 유일한 테스트 신호가 e2e 스위트 전체 통과 여부이므로, e2e 가 스킵되거나 flaky 처리되는 환경에서는 캐너리 배선 자체의 회귀를 잡을 방법이 없다(캐너리 로직 자체는 `workspace-reflection-canary.spec.ts` 로 잘 커버되지만, "main.ts 가 실제로 그 함수를 부팅 경로의 올바른 지점에서 호출하는가"는 별개 관측 지점이다).
  - 제안: 필수는 아니나, `bootstrap` 함수를 export 하거나 `main.ts` 에서 순수 배선 부분을 별도 함수로 추출해 "assertWorkspaceIdReflectionWorks 가 app 생성 직후·body parser 등록 이전에 호출된다"를 화이트박스로 고정하는 경량 단위 테스트를 고려할 수 있다(테스트 용이성 개선 여지).

- **[INFO]** `workspace-reflection-canary.spec.ts` 의 `assertWorkspaceIdReflectionWorks` 성공 케이스는 커스텀 `logger` 를 항상 주입해서 테스트한다 — 기본 파라미터(`new Logger('WorkspaceIdReflection')`)로 성공 경로(`logger.log(...)` 실제 호출)를 거치는 테스트는 없다.
  - 위치: `codebase/backend/src/common/decorators/workspace-reflection-canary.spec.ts` — `it('소비 라우트를 인식하면 개수를 돌려준다', ...)` (69-76).
  - 상세: 실패 경로(throw)만 기본 로거로 호출되는데 그 경로는 `logger.log()` 에 도달하기 전에 throw 하므로 기본 로거는 사실상 인스턴스화만 검증된다. `Logger` 는 NestJS 내장 클래스라 위험은 매우 낮다.
  - 제안: 우선순위 낮음 — 필요시 기본 파라미터로 성공 케이스 1건 추가.

## 잘 된 점 (참고)

- `workspace-reflection-canary.ts`/`.spec.ts` 는 TDD 로 신설된 모듈답게 fail-closed(0건 throw) / 빈 컨트롤러 목록 throw / 비-함수·비-클래스 값 스킵(throw 안 함) / 에러 메시지 내용(원인 후보·진입점) 까지 촘촘히 고정했고, 판별 로직을 캐너리 내부에서 재구현하지 않고 `handlerConsumesWorkspaceId` 를 그대로 재사용해 "자기 복제본만 검사" 하는 함정을 피했다.
- `uuid.spec.ts` 는 `isValidUuid`/`isUuidShaped` 두 술어의 **경계값**(nil UUID·v7·비-RFC variant)을 "한쪽은 승인, 한쪽은 거부"로 명시적으로 교차 단언해, 두 술어가 실수로 합쳐지거나 어느 한쪽이 다른 쪽의 상위집합이 아니게 되는 회귀를 잘 잡는다.
- `workspace-context.util.spec.ts` 는 `it.each` 로 malformed 헤더 5종을 파라미터화했고, "토큰 클레임은 검증하지 않는다"(서버 버그를 400 으로 오분류하지 않기 위함) · "중복 헤더는 채택된 첫 값만 검증한다"(양방향 — 첫 값 유효/두번째 값 유효 각각 다른 결과) 등 이전 세션 교훈("멀티암 연산자는 순서별로 다른 값을 넣어야 관측 가능")을 정확히 반영했다.
- 기존 스위트(`workspace.decorator.spec.ts`, `roles.guard.spec.ts`, `workspace-context.util.spec.ts`)의 픽스처를 임의 문자열에서 실제 UUID 형태로 일괄 치환한 것은 회귀가 아니라 **픽스처 자체의 결함**(프로덕션에서 존재할 수 없는 값)을 새 형식 검증이 드러낸 것이며, 이름의 의미(`OWN`/`VICTIM`/`OTHER` 등)를 상수명으로 그대로 보존해 가독성 손실이 없다.

## 요약

새로 신설된 캐너리 모듈(`workspace-reflection-canary`)과 UUID 형태 검증(`isUuidShaped`, `workspace-context.util`)은 TDD 로 작성돼 fail-closed 분기·경계값·에러 메시지까지 테스트 커버리지가 매우 촘촘하다. 다만 이 신규 400 throw 경로를 실제로 가장 먼저 통과하는 지점인 `RolesGuard`(전역 `APP_GUARD`)에는 대응 테스트가 하나도 추가되지 않았고, 유일하게 그 근처를 다루는 기존 테스트(전역 API 는 헤더 위조에도 통과)는 UUID-shaped 값(nil UUID)만 사용해 "검증이 건너뛰어졌다"와 "검증이 통과했다"를 구분하지 못하는 vacuous 형태다 — 즉 early-return 순서가 바뀌는 리팩터가 있어도 이 스위트는 잡아내지 못한다. `main.ts` 배선 자체는 export 되지 않은 `bootstrap()` 구조상 단위 테스트가 어렵고 e2e 통과에만 의존하는데, 이는 이미 plan 문서에 근거와 함께 명시적으로 인지된 한계다.

## 위험도

MEDIUM
