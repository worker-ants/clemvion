### 발견사항

- **[INFO]** `sortComponents` 가 `[...components].sort(...)` 로 입력 배열 복사 후 정렬 — 공유 배열 불변 유지
  - 위치: `codebase/backend/src/modules/execution-engine/node-bootstrap.service.ts` `sortComponents()` 메서드
  - 상세: `this.components`(주입된 `ALL_NODE_COMPONENTS` 참조)를 직접 정렬하지 않고 spread 복사본을 정렬한다. `NodeComponentsModule`의 `useValue: ALL_NODE_COMPONENTS` 배열과 `nodes/index.ts`의 `ALL_NODE_COMPONENTS` 정적 참조 모두 원본 순서가 보존되어, `ALL_NODE_TYPES` 파생·DTO `@IsIn` 비교·metadata 불변 테스트 등 정적 소비처에 순서 변경 부작용 없음.
  - 제안: 없음. 현행 구현 올바름.

- **[INFO]** `NODE_COMPONENT` 토큰이 string literal(`'NODE_COMPONENT'`) — 외부 충돌 가능성
  - 위치: `codebase/backend/src/nodes/core/node-component.interface.ts` 라인 568
  - 상세: 현재 코드베이스에 동명 토큰 없음(consistency 검토 I3 확인). 레이어3(마켓플레이스 동적 등록) 도입 시 외부 모듈이 동일 string으로 등록하면 provider 오버라이드가 무음으로 발생할 수 있음. 레이어1 범위에서는 단일 `useValue` + `NodeComponentsModule` export 고정이라 충돌 경로 없음.
  - 제안: 레이어3 시 `Symbol('NODE_COMPONENT')` 전환 권장(현재 불요).

- **[INFO]** `NodeComponentsModule`이 `ExecutionEngineModule`에 import 추가됨 — 모듈 의존 그래프 변경
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.module.ts` 라인 46
  - 상세: `NodeBootstrapService`가 기존에는 `ALL_NODE_COMPONENTS` 정적 import로 직접 참조하던 것을, 이제 `NodeComponentsModule`을 거쳐 `NODE_COMPONENT` 토큰으로 받는다. Nest 모듈 그래프에 새 edge가 추가되지만 `NodeComponentsModule`은 `providers`/`exports`만 갖고 DB·네트워크·이벤트 발생이 없으므로 사이드 이펙트 없음. e2e 부팅 스모크 205건 통과로 실부팅 검증됨.
  - 제안: 없음.

- **[INFO]** `ALL_NODE_COMPONENTS`가 두 곳에서 소비됨 — 이중 소비 drift 위험 평가
  - 위치: `codebase/backend/src/nodes/node-components.module.ts`(`useValue` 주입) 및 `codebase/backend/src/nodes/index.ts`(`ALL_NODE_TYPES` 파생·정적 소비처)
  - 상세: 두 소비처 모두 `nodes/<category>/index.ts` 카테고리 배열에서 spread 파생된 동일 `ALL_NODE_COMPONENTS`를 사용하므로 단일 출처 원칙 유지. `node-components.module.spec.ts`의 DI 배선 + spread 집합 동등성 테스트가 drift를 런타임 이전에 탐지. 구조적으로 두 값이 달라질 수 없음.
  - 제안: 없음.

- **[INFO]** 카테고리 배열(예: `LOGIC_COMPONENTS`, `AI_COMPONENTS` 등) 신규 도입 — 모듈 초기화 순서 부작용 없음
  - 위치: `codebase/backend/src/nodes/{trigger,logic,flow,ai,integration,data,presentation}/index.ts` (신규 파일 7개)
  - 상세: 각 파일은 해당 카테고리의 노드 컴포넌트 객체(이미 정의된 상수)를 배열로 모아 export만 하며, 초기화 시점에 네트워크·파일시스템·이벤트 발생 없음. `nodes/index.ts`의 spread 집계도 기존 flat import를 카테고리 배열 spread로 재구성한 것으로, 포함 집합이 동일함.
  - 제안: 없음.

### 요약

이번 변경은 `NodeBootstrapService`의 노드 카탈로그 수급 방식을 정적 import에서 NestJS DI(`NODE_COMPONENT` 토큰, 단일 `useValue` 배열)로 전환하는 behavior-preserving 리팩터다. 부작용 관점의 핵심 위험인 공유 배열 변형은 `sortComponents`의 spread 복사 정렬로 차단되어 있고, `ALL_NODE_TYPES`·DTO·metadata 불변 테스트 등 정적 소비처에 순서 변경 영향 없다. 전역 상태 변경·파일시스템 접근·환경 변수 읽기/쓰기·네트워크 호출·이벤트 발생 모두 없다. 시그니처 변경(`NodeBootstrapService` 생성자에 `components` 파라미터 추가)은 프로덕션 코드에서 Nest DI가 자동 해소하며, 테스트에서도 `[...ALL_NODE_COMPONENTS]` 전달로 명시 처리되어 기존 호출자 영향 없다. `NODE_COMPONENT` string 토큰의 레이어3 충돌 가능성은 현 범위(레이어1)에서 비현실적이며 INFO 수준 메모로 충분하다.

### 위험도

NONE
