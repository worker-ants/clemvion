## 의존성 리뷰

### 발견사항

- **[INFO]** `OnApplicationBootstrap` 신규 import — 기존 패키지 내 인터페이스 추가
  - 위치: `execution-engine.service.ts` line 4
  - 상세: `@nestjs/common` 은 이미 프로젝트 의존성에 존재하며, `OnApplicationBootstrap` 은 해당 패키지의 일부. 새 외부 패키지는 전혀 추가되지 않았고, 번들 크기·빌드 시간에 미치는 영향 없음.
  - 제안: 현재 구현 유지. 이미 사용 중인 패키지의 인터페이스를 활용하는 올바른 방식.

- **[INFO]** `publisher!: Redis` 비-null 단언과 런타임 `!this.publisher` 가드의 의미론적 불일치
  - 위치: `continuation-bus.service.ts` — `private publisher!: Redis` 선언 vs 각 메서드 진입부의 `if (!this.publisher)` 가드
  - 상세: TypeScript `!` 는 컴파일-타임 non-null 단언이므로 타입 시스템 관점에서는 "항상 정의됨"으로 간주하지만, 런타임에서는 `undefined` 가 가능하다. 이 패턴 자체는 의존성 문제가 아니라 설계 선택이며, 현재 가드 추가로 올바르게 방어하고 있음. 단, 추후 IDE의 null-safety 경고나 strict 옵션에서 `!this.publisher` 분기가 "항상 false" 오탐을 유발할 수 있음.
  - 제안: 필요 시 `private publisher: Redis | undefined` 로 타입을 명시하면 타입 시스템과 런타임 동작이 일치하나, 현재 코드의 기능 정확성에는 영향 없음.

- **[INFO]** 내부 의존 방향 (`ExecutionEngineService → ContinuationBusService`) 변경 없음
  - 위치: 전체 diff
  - 상세: 기존 단방향 의존 관계를 그대로 유지하면서 호출 시점만 `onModuleInit` → `onApplicationBootstrap` 으로 이동. NestJS 의 `onApplicationBootstrap` 은 모든 모듈의 `onModuleInit` 완료 이후 실행이 보장되므로, `ContinuationBusService.publisher` 초기화 완료가 선행되는 것이 공식 생명주기 계약으로 보장됨.
  - 제안: 현재 구현이 이 문제를 해결하는 가장 관용적이고 올바른 방법.

### 요약

이번 변경에서 새로운 외부 패키지는 단 하나도 추가되지 않았다. `@nestjs/common` 의 `OnApplicationBootstrap` 인터페이스 하나를 추가로 import 한 것이 전부이며, 이 패키지는 이미 프로젝트에 존재한다. 내부 모듈 간 의존 방향(`ExecutionEngineService → ContinuationBusService`)도 기존과 동일하고, `private publisher!: Redis` 선언 vs `if (!this.publisher)` 가드의 타입-런타임 불일치는 기능 정확성에는 문제 없으나 선택적으로 타입 선언을 `Redis | undefined` 로 개선할 수 있다. 의존성 관점에서 리스크가 없는 변경이다.

### 위험도

**NONE**