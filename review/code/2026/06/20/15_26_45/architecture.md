# 아키텍처(Architecture) 리뷰 — M-5 레이어1 노드 DI 전환

## 발견사항

- **[INFO] SOLID — 단일 책임 원칙: 명백히 준수**
  - 위치: `codebase/backend/src/modules/execution-engine/node-bootstrap.service.ts`
  - 상세: `NodeBootstrapService` 는 "DI 주입 카탈로그를 정렬 후 registry.bootstrap 에 위임" 이라는 단 하나의 책임을 갖는다. 정렬 로직(`sortComponents`)도 private 메서드로 캡슐화되어 있고, 핸들러 의존성 구성(deps.build)·실제 등록(registry.bootstrap) 모두 외부 서비스에 위임한다. 이전 god-class(`ExecutionEngineService`) 에서 이 책임을 분리한 strangler-fig 패턴이 올바르게 적용됐다.
  - 제안: 없음.

- **[INFO] SOLID — 의존성 역전 원칙: 핵심 개선**
  - 위치: `node-bootstrap.service.ts` `@Inject(NODE_COMPONENT)`, `@Inject(WORKFLOW_EXECUTOR)`
  - 상세: 이전에는 구체적인 정적 import(`ALL_NODE_COMPONENTS`)와 자기 참조(`handlerDeps.build(this)`)에 의존했다. 이번 변경으로 `NodeBootstrapService` 는 추상 토큰(`NODE_COMPONENT`, `WORKFLOW_EXECUTOR`)에 의존하고, 실제 구현 공급은 NestJS DI 컨테이너(= `NodeComponentsModule`)가 담당한다. DIP 의 교과서적 적용이다.
  - 제안: 없음.

- **[INFO] SOLID — 개방-폐쇄 원칙: seam 확보 확인**
  - 위치: `codebase/backend/src/nodes/node-components.module.ts`, `nodes/<category>/index.ts` 7개 파일
  - 상세: 신규 노드 추가 시 `<category>/index.ts` 배열 한 줄만 수정하면 되고, `NodeComponentsModule`·`nodes/index.ts` 중앙 파일은 카테고리 추가 시에만 변경된다. 레이어3(동적 등록) 확장도 `NodeComponentRegistry.registerDynamic` seam 위에서 가능하며 `NodeBootstrapService` 수정 불요다. OCP 기준 구조가 올바르다.
  - 제안: 없음.

- **[INFO] 결합도/응집도: 카테고리 배열 단일 출처, 결합도 적절**
  - 위치: `nodes/ai/index.ts`, `nodes/data/index.ts`, `nodes/flow/index.ts`, `nodes/integration/index.ts`, `nodes/logic/index.ts`, `nodes/presentation/index.ts`, `nodes/trigger/index.ts`
  - 상세: 각 카테고리 배열(`AI_COMPONENTS` 등)이 해당 디렉토리 내에서만 노드 컴포넌트를 집계한다. `NodeComponentsModule` 은 `ALL_NODE_COMPONENTS` 한 곳을 통해 카탈로그를 바인딩하므로, 카테고리-중앙 aggregator 간 결합은 단방향·명시적이다. flowise `NodesPool` 패턴과 유사한 구조로 응집도가 높고 결합도가 낮다.
  - 제안: 없음.

- **[INFO] 레이어 책임: 노드 정의(데이터)와 DI 등록(인프라)·부트스트랩(생명주기) 분리**
  - 위치: `nodes/<category>/index.ts` (데이터 레이어), `node-components.module.ts` (인프라 레이어), `node-bootstrap.service.ts` (생명주기 레이어)
  - 상세: 노드 컴포넌트 정의(핸들러·스키마·메타데이터 번들)는 각 카테고리 `index.ts` 에, DI 바인딩은 `NodeComponentsModule` 에, 부팅 시 등록 절차는 `NodeBootstrapService.onModuleInit` 에 각각 격리된다. 레이어 간 의존 방향이 인프라→데이터(단방향)로 올바르다.
  - 제안: 없음.

- **[INFO] 디자인 패턴: Service Locator 안티패턴 제거**
  - 위치: `node-bootstrap.service.ts` (이전 `ALL_NODE_COMPONENTS` 정적 import)
  - 상세: 이전 방식은 `NodeBootstrapService` 가 전역 정적 배열(`ALL_NODE_COMPONENTS`)을 직접 참조하는 Service Locator 패턴에 가까웠다. 이번 변경으로 IoC(제어 역전) 방식의 순수 DI 로 전환됐다. `NodeComponentsModule` 이 단일 `useValue` provider 로 카탈로그를 주입하는 것은 Value Provider 패턴의 정석적 사용이다.
  - 제안: 없음.

- **[INFO] 순환 의존성: 없음**
  - 위치: 변경된 파일 전체
  - 상세: `NodeComponentsModule`(`nodes/`) → `ExecutionEngineModule`(`modules/execution-engine/`) 방향의 단방향 의존만 존재한다. `nodes/core/` 가 `execution-engine/` 에 역으로 의존하는 경로는 이번 변경에 없다. `node-component.interface.ts` 에 `NODE_COMPONENT` 토큰을 co-locate 한 것도 `execution-engine` 이 `nodes/core` 를 참조하는 기존 방향을 유지한다.
  - 제안: 없음.

- **[INFO] 추상화 수준: string 토큰 vs Symbol 토큰**
  - 위치: `codebase/backend/src/nodes/core/node-component.interface.ts` line 568 (`export const NODE_COMPONENT = 'NODE_COMPONENT'`)
  - 상세: 현재 string literal 토큰은 기존 `WORKFLOW_EXECUTOR` 선례를 따른 의도적 선택이다. 레이어1 범위에서는 이 추상화 수준이 적절하다. 단, 레이어3(동적 노드 / 마켓플레이스) 시 string 토큰은 외부 플러그인과의 토큰 충돌 위험이 있어 `Symbol('NODE_COMPONENT')` 또는 네임스페이스 접두사 토큰으로의 전환이 필요하다(이미 RESOLUTION.md 에서 후속 사항으로 명시됨).
  - 제안: 현재 범위에서는 현행 유지. 레이어3 착수 전 Symbol 전환 결정 필요.

- **[INFO] 모듈 경계: `NodeComponentsModule` vs `NodesModule` 이름 공간 명확**
  - 위치: `codebase/backend/src/nodes/node-components.module.ts`
  - 상세: `NodeComponentsModule`(핸들러 카탈로그 DI 등록)과 `modules/nodes/NodesModule`(Node 엔티티 영속 + API 표면)은 명칭·파일 위치 모두 명확히 구분된다. 이전 consistency-check(W3)에서 지적된 명명 충돌이 `NodeComponentsModule` 채택으로 해소됐다. 모듈 경계가 명확하다.
  - 제안: 없음.

- **[INFO] 확장성: 레이어2·레이어3 seam 이 구조적으로 확보됨**
  - 위치: `node-bootstrap.service.ts` (DI 주입 경로), `node-components.module.ts` (`useValue` provider)
  - 상세: 현재 `useValue: ALL_NODE_COMPONENTS` 인 바인딩을 레이어2(workspace entitlement 필터) 에서 `useFactory` + 요청 컨텍스트 주입으로 교체할 수 있고, 레이어3에서는 `NodeComponentRegistry.registerDynamic` 호출로 런타임 등록을 추가할 수 있다. `NodeBootstrapService` 코드를 건드리지 않고 `NodeComponentsModule` 의 provider 정의만 변경하면 되므로 확장에 유연하다.
  - 제안: 없음.

- **[INFO] `ALL_NODE_COMPONENTS` 이중 소비처(정적 spread + DI useValue)에 대한 drift 가드**
  - 위치: `codebase/backend/src/nodes/index.ts`, `node-components.module.ts`, `node-components.module.spec.ts`
  - 상세: `ALL_NODE_COMPONENTS`(정적 소비처 — `ALL_NODE_TYPES` / DTO `@IsIn` 등)와 DI 카탈로그(`NODE_COMPONENT useValue`)가 동일한 카테고리 배열 spread 에서 파생돼 단일 출처를 공유한다. `node-components.module.spec.ts` 가 "DI 주입 집합 == 정적 spread 집합" 을 테스트로 고정해 구조적 drift 가 불가능하다. 이중 소비 자체는 `ALL_NODE_TYPES` 가 모듈 로드 시점 정적 평가를 요구하는 DI 불가 제약을 올바르게 수용한 결과다.
  - 제안: 없음.

## 요약

이번 M-5 레이어1 변경은 god-class에서 분리된 `NodeBootstrapService`의 카탈로그 참조 방식을 정적 import에서 NestJS DI 토큰 주입으로 전환한 behavior-preserving 리팩터다. SOLID 원칙(특히 DIP·OCP·SRP) 적용이 명확하고, 레이어 책임 분리(노드 정의 / DI 등록 / 생명주기)가 올바르며, 순환 의존성이 없다. 카테고리별 단일 출처 배열과 단일 aggregator 모듈의 조합은 flowise `NodesPool` 패턴을 NestJS DI 관용구로 경량화한 것으로 merge-conflict hotspot 해소와 레이어3 seam 확보라는 두 목적을 동시에 달성한다. string 토큰은 기존 선례를 따른 의도적 선택이며 레이어3 착수 전 Symbol 전환이 필요하나 이는 이미 후속 항목으로 추적 중이다. 아키텍처 관점의 신규 Critical/Warning 발견사항은 없다.

## 위험도

NONE

STATUS: SUCCESS
