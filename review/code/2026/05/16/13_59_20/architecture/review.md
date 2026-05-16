# 아키텍처(Architecture) 리뷰

## 발견사항

- **[INFO]** `registerEntityTester` — Mediator/Plugin 패턴 활용으로 단방향 의존성 보존
  - 위치: `integrations.service.ts` +182~+199, `cafe24.module.ts` `onModuleInit`
  - 상세: `IntegrationsModule`이 `nodes/*`를 직접 import하지 않고, `Cafe24Module`이 `onModuleInit` 시점에 역방향으로 tester를 주입하는 구조다. 모듈 경계(modules vs nodes 레이어)를 깨지 않으면서 런타임 wiring을 달성한 점은 아키텍처적으로 올바른 선택이다. 커밋 메시지와 코드 주석이 의도를 명확히 서술하고 있어 유지보수 맥락도 보존된다.
  - 제안: 현행 유지. 향후 `registerEntityTester`를 호출하는 모듈이 늘어날 경우 등록 순서·중복 방지를 위한 명시적 가드(이미 "last registration wins" 정책 문서화됨)를 별도 인터페이스(`IEntityTesterRegistry`)로 추출하면 확장성이 더 명확해진다.

- **[WARNING]** `pingConnection` 내부에서 `integration.credentials` 이중 접근 — 추상화 누수
  - 위치: `cafe24-api.client.ts` +660~+706 (`tokenAfterProactive`, `refreshedToken` 산출 구간)
  - 상세: proactive refresh 이후 갱신된 토큰을 읽기 위해 `((integration.credentials ?? {}) as Cafe24Credentials).access_token` 표현이 두 곳에서 반복된다. `ensureFreshToken`과 `refreshAccessToken`이 `integration` 객체를 in-place 변경한다는 사이드이펙트를 호출자(`pingConnection`)가 직접 알고 있어야 동작하는 구조다. 이는 캡슐화 위반이며, 단일 책임 원칙 관점에서 토큰 추출 로직이 pingConnection 메서드 본문에 분산되어 있다.
  - 제안: `ensureFreshToken`/`refreshAccessToken` 호출 후 현재 유효 토큰을 반환하도록 내부 헬퍼(`private getCurrentAccessToken(integration): string`)를 추출하거나, 두 메서드가 갱신된 토큰을 반환값으로 제공하도록 시그니처를 정리한다. 이렇게 하면 `pingConnection` 본문이 `integration.credentials`의 변이 전제를 직접 인코딩하지 않아도 된다.

- **[WARNING]** `pingConnection`의 반환 타입이 `IntegrationTestResult`와 미정합 — 인터페이스 분리 불완전
  - 위치: `cafe24-api.client.ts` +630~+632
  - 상세: 메서드 반환 타입이 `Promise<{ success: boolean; code?: string; message?: string }>`으로 인라인 리터럴로 선언되어 있다. `EntityAwareTester`가 반환하는 `IntegrationTestResult`(`integrations.service.ts`에서 export됨)와 사실상 같은 구조이지만, `Cafe24ApiClient`가 `IntegrationTestResult`를 직접 참조하면 `nodes → modules` 의존성이 발생하므로 일부러 인라인 타입을 사용한 것으로 보인다. 그러나 이 인라인 타입을 별도 공유 타입 파일(`src/shared/types/integration-test-result.ts` 등)로 추출하지 않아 타입 중복이 발생하고, 향후 `IntegrationTestResult`가 필드를 추가할 때 `pingConnection` 반환 타입과 불일치가 드러날 수 있다.
  - 제안: `IntegrationTestResult` 또는 그 핵심 필드를 `modules/integrations`에 종속되지 않는 공유 레이어(`src/shared/` 또는 `src/common/`)에 선언하고, `Cafe24ApiClient`와 `IntegrationsService` 양쪽에서 해당 공유 타입을 참조하게 한다. 이렇게 하면 의존성 방향은 깨지지 않으면서 타입 일관성을 확보할 수 있다.

- **[WARNING]** `Cafe24Module`이 `IntegrationsModule`을 import — 레이어 순방향은 유지되나 결합도 상승
  - 위치: `cafe24.module.ts` +837 (`imports: [..., IntegrationsModule]`)
  - 상세: `nodes/integration/cafe24` → `modules/integrations` 방향 임포트는 `nodes → modules` 허용 방향이므로 순환 의존성을 유발하지는 않는다. 그러나 `Cafe24Module`이 `IntegrationsModule` 전체를 소비함으로써 두 모듈 간 결합도가 높아진다. 현재 목적은 `IntegrationsService.registerEntityTester` 단일 메서드 호출인데, 전체 모듈을 import함으로써 `IntegrationsModule`이 노출하는 모든 provider에 암묵적으로 의존하게 된다.
  - 제안: NestJS의 `forwardRef`/custom provider 패턴 대신, `registerEntityTester`만 노출하는 작은 인터페이스 토큰(`INTEGRATION_TESTER_REGISTRY`)을 정의하고 DI 토큰으로 주입받으면 `IntegrationsModule` 전체 결합을 피할 수 있다. 다만 현재 규모에서는 수용 가능한 결합도이므로 즉각 리팩토링보다 향후 확장 시 고려 항목으로 등록하는 것이 적합하다.

- **[INFO]** `rawPing` private 메서드 — 단일 책임 분리 양호
  - 위치: `cafe24-api.client.ts` +728~+761
  - 상세: 부작용 없는 순수 HTTP 호출을 `rawPing`으로 분리하고, `pingConnection`이 상태 전이 로직(retry, markAuthFailed 결정)을 담당하게 나눈 설계는 단일 책임 원칙에 부합한다. 테스트 관점에서도 `rawPing`만 독립적으로 검증 가능한 구조다.
  - 제안: 현행 유지.

- **[INFO]** `entityTesters` Map에 대한 동시성 가드 부재
  - 위치: `integrations.service.ts` +182 (`private readonly entityTesters = new Map<string, EntityAwareTester>()`)
  - 상세: NestJS 의 단일 스레드 Node.js 이벤트 루프 환경에서 `onModuleInit` 시점 등록은 사실상 직렬이므로 실질적 경쟁 조건은 없다. 그러나 `registerEntityTester`가 `public` 메서드로 노출되어 있어 향후 동적 등록(테스트·플러그인)에서 예상치 못한 덮어쓰기가 발생할 수 있다. "last registration wins" 정책은 문서화되었지만 코드상 명시적 경고가 없다.
  - 제안: 이미 등록된 `serviceType`에 재등록 시 `Logger.warn`을 출력하는 가드를 추가하면 의도치 않은 덮어쓰기를 조기에 발견할 수 있다.

- **[INFO]** spec §5.8과 구현 엔드포인트(`/apps`) 불일치 — 알려진 기술 부채
  - 위치: 커밋 메시지, `plan/in-progress/cafe24-test-connection.md` §Spec 갱신
  - 상세: spec §5.8이 아직 `GET /store`를 명시하고 있고 구현은 `GET /api/v2/admin/apps`를 사용한다. 커밋과 plan 모두 이 불일치를 인지하고 직렬화 의존성(3개 in-flight worktree 머지 후 spec 갱신)을 명시적으로 기록했다. 아키텍처 관점에서 "코드가 spec을 앞서는" 상태는 SDD 원칙 위배이나, 의사결정 근거(scope 충돌 위험, 운영 사례)와 대기 조건이 plan에 문서화되어 있어 즉각적 위험은 낮다.
  - 제안: spec 머지가 완료되는 즉시 project-planner에 spec-update-cafe24-test-connection.md 위임을 실행하고, plan 체크리스트를 클리어한다.

## 요약

이번 변경의 핵심 아키텍처 결정인 `registerEntityTester` 패턴은 `IntegrationsModule → nodes/*` 역방향 의존성을 허용하지 않으면서 cafe24 특화 프로브를 런타임에 연결하는 합리적인 접근이다. 레이어 방향성(`nodes → modules`)은 유지되며 순환 의존성도 없다. 다만 `pingConnection` 내부에서 `integration.credentials`의 in-place 변이를 직접 참조하는 추상화 누수, `pingConnection` 반환 타입과 `IntegrationTestResult`의 타입 중복, `IntegrationsModule` 전체를 import해 발생하는 불필요한 결합도 상승이 향후 유지보수 부담으로 누적될 수 있다. 전체 구조는 의도와 제약이 충분히 문서화된 양호한 수준이나, 공유 타입 레이어 도입과 토큰 추출 헬퍼 정리로 응집도와 캡슐화를 개선할 여지가 있다.

## 위험도

LOW
