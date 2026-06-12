# 아키텍처(Architecture) 리뷰 결과

## 발견사항

### [INFO] `production-guards.ts` — 단일 책임 원칙 준수, 순수 함수 분리 양호
- 위치: `codebase/backend/src/common/config/production-guards.ts`
- 상세: `isSwaggerEnabled` 함수가 `assertProductionConfig` 와 같은 `production-guards.ts` 모듈에 위치하나 역할이 다르다. `assertProductionConfig`는 fail-closed(throw)이고 `isSwaggerEnabled`는 boolean 반환(conditional render). 둘 다 "production 환경 게이팅" 계열로 볼 수 있으므로 응집도는 적절하다. 환경변수 맵을 주입(의존성 역전)해 순수 함수로 유지한 것은 OCP/DIP 관점에서 바람직하다. `isFlagOn`을 재사용해 코드 중복을 제거한 점도 적절하다.
- 제안: 현재 구조 유지. 향후 게이팅 함수가 더 늘어난다면 `production-flags.ts`(bool 반환)와 `production-asserts.ts`(throw) 두 파일로 책임 분리를 고려할 수 있다.

### [INFO] `main.ts` — `setupSwagger` 추출로 SRP 개선
- 위치: `codebase/backend/src/main.ts`
- 상세: Swagger 설정 블록을 `setupSwagger(app: INestApplication): void`로 추출해 `bootstrap` 함수의 응집도를 높였다. `isSwaggerEnabled(process.env)` 호출이 `main.ts`에 두 번(mount, log) 등장하는 것은 중복이지만 양이 미미해 큰 문제는 아니다. `INestApplication` 타입을 import해 파라미터 타입을 명시한 점은 인터페이스 분리(ISP) 관점에서 적절하다.
- 제안: `isSwaggerEnabled(process.env)` 결과를 한 번만 평가해 변수로 저장하면 `process.env` 두 번 읽기를 제거할 수 있다(부수 효과는 없으나 명시성 향상).

### [WARNING] `websocket.module.ts` — 순환 의존성 누적 (forwardRef 4개)
- 위치: `codebase/backend/src/modules/websocket/websocket.module.ts`
- 상세: `WebsocketModule`이 이미 `ExecutionEngineModule`, `ExecutionsModule`, `KnowledgeBaseModule`에 대해 `forwardRef`를 사용 중이며, 이번 변경으로 `WorkflowsModule`까지 추가되어 4개 forwardRef가 병존한다. forwardRef는 NestJS의 DI 그래프에서 순환 의존을 해결하는 방편이지만, 개수가 늘어날수록 초기화 순서 버그와 undefined 주입 위험이 커진다. `WebsocketGateway`가 `WorkflowsService`, `KnowledgeBaseService`, `ExecutionsService`, `BackgroundRunsService`를 직접 주입받아 채널 인가를 수행하는 구조는 Gateway 클래스의 책임이 과중하다. 인가 로직이 Gateway 생성자 배열(channelAuthorizers)에 집중되어 있어 새 채널마다 Gateway + Module 두 파일을 동시에 수정해야 한다(OCP 위반 조짐).
- 제안: 중기적으로 `ChannelAuthorizationService`(또는 `WsAuthorizationModule`) 를 별도 경량 모듈로 추출하고, Gateway는 이 서비스에만 의존하는 구조로 리팩터링을 고려한다. WorkflowsModule과 WebsocketModule 간 실제 양방향 순환 여부는 e2e 부팅으로 확인이 필요하다(plan 문서에 잔여 검증 메모 기재됨).

### [INFO] `websocket.gateway.ts` — 채널 authorizer 컨텍스트 구조 확장 (OCP 준수)
- 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts`
- 상세: `authorize` 시그니처를 `(channel, workspaceId: string)` → `(channel, ctx: { workspaceId: string; userId: string })`로 확장했다. 기존 authorizer들은 destructuring으로 `{ workspaceId }`만 취해 이전 동작을 유지한다. 이 패턴은 OCP에 부합하며, 향후 ctx 확장(예: roles, tenantId)도 authorizer 시그니처 변경 없이 수용 가능하다.
- 제안: `ctx` 타입을 인라인 대신 named interface(`WsAuthContext`)로 export하면 향후 확장 시 타입 체인이 명확해진다.

### [INFO] `condition-evaluator.util.ts` — 단일 초크포인트(Single Chokepoint) 패턴 적용
- 위치: `codebase/backend/src/nodes/core/condition-evaluator.util.ts`
- 상세: `compileUserRegex`가 길이 검사 → safe-regex 위험성 → 문법 오류 순서로 3단계 게이트를 하나의 함수에서 담당하고 세 평가 사이트(condition-evaluator/filter/transform)가 모두 이 함수를 경유한다. 결과 타입 `RegexCompileResult`를 discriminated union으로 정의해 거부 사유를 명시적으로 표현한 점은 타입 안전성 측면에서 우수하다. `compileRegexCache`가 `compileUserRegex` 위임으로 단순화된 것도 DRY 관점에서 개선이다.
- 제안: 없음. 현재 구조 적절.

### [INFO] `condition-eval.util.ts` (logic/_shared) — 레이어 재-익스포트 경계 적절
- 위치: `codebase/backend/src/nodes/logic/_shared/condition-eval.util.ts`
- 상세: `compileUserRegex`를 core에서 re-export하는 패턴이 일관되게 적용됐다. logic 레이어 소비자(filter, transform)는 `core/`를 직접 참조하지 않고 `_shared/condition-eval.util`을 경유한다. 이 중간 레이어가 core와 logic 소비자 간 결합을 완충한다.
- 제안: 없음. 레이어 경계 유지.

### [INFO] `safe-html.ts` — 모듈 레벨 상수로 DOMPurify 설정 응집
- 위치: `codebase/channel-web-chat/src/lib/safe-html.ts`
- 상세: `ALLOWED_TAGS`, `ALLOWED_ATTR`, `ALLOWED_URI_REGEXP`를 모듈 레벨 상수로 선언하고 `renderTemplateHtml` 호출 시 전달하는 구조는 설정과 실행 로직을 분리해 가독성과 유지보수성을 높인다. 블랙리스트에서 화이트리스트로의 전환이 `renderTemplateHtml` 함수 내부를 변경하지 않고 상수 교체만으로 이루어진 점은 OCP에 부합한다.
- 제안: 없음. 현재 구조 적절.

### [INFO] `safe-regex` 런타임 의존성 위치 적절
- 위치: `codebase/backend/package.json`
- 상세: `safe-regex`가 `dependencies`(런타임)에, `@types/safe-regex`가 `devDependencies`(빌드 전용)에 올바르게 배치됐다. `safe-regex`는 노드 실행 중 `compileUserRegex`가 호출될 때 필요하므로 런타임 의존성이 맞다.
- 제안: 없음.

### [INFO] `transform.handler.ts` — 로컬 MAX_REGEX_LENGTH 상수 제거로 SSOT 달성
- 위치: `codebase/backend/src/nodes/data/transform/transform.handler.ts`
- 상세: 기존에 `transform.handler.ts`가 별도로 `MAX_REGEX_LENGTH = 200`을 선언하던 것을 제거하고 `compileUserRegex`로 위임했다. 이로써 길이 상수의 단일 진실 위치(core)가 보장된다. `safeCompileRegex` 래퍼 함수가 한 줄(`return compileUserRegex(pattern, flags).regex`)로 단순화된 것은 코드 냄새 제거 측면에서 긍정적이다.

---

## 요약

이번 변경은 refactor-04-security 작업의 M-1(Swagger 게이팅), M-3(ReDoS), M-6(WebSocket IDOR), m-1(HTML sanitize 화이트리스트) 항목을 구현한다. 아키텍처 관점에서 주요 강점은 세 가지다: (1) `compileUserRegex`의 단일 초크포인트 패턴으로 regex 보안 정책이 분산되지 않고 core 한 곳에서 관리된다; (2) `isSwaggerEnabled`/`isFlagOn`의 순수 함수 설계와 환경변수 주입이 의존성 역전 원칙을 준수한다; (3) DOMPurify 화이트리스트 상수를 모듈 레벨로 분리해 설정과 실행 로직이 명확히 구분된다. 유의할 점은 `WebsocketModule`의 forwardRef 의존성이 4개로 누적된 것으로, 현재 기능 범위에서는 허용 가능하나 Gateway 클래스의 책임 과중(채널 인가 로직 집중)이 장기적으로 OCP 위반으로 발전할 수 있어, 중기 리팩터링 시 `ChannelAuthorizationService` 분리를 검토할 것을 권장한다.

## 위험도

LOW
