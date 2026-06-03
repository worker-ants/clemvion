# Architecture Review

## 발견사항

- **[INFO]** `buildHelpers()` 함수 분리 — 단일 책임 원칙 준수
  - 위치: `code.handler.ts` L28–43 (`buildHelpers` 함수)
  - 상세: helper 유틸리티를 `buildSandbox`에서 분리해 별도 함수로 추출한 것은 SRP를 잘 적용한 사례다. sandbox 구성과 helper 구현 책임이 명확히 분리되어 있다.
  - 제안: 현행 유지.

- **[WARNING]** `buildHelpers()`가 매번 새 객체를 생성하는 불필요한 재할당
  - 위치: `code.handler.ts` L28–43, `buildSandbox` L62 (`$helpers: buildHelpers()`)
  - 상세: `buildHelpers()`는 순수 함수이며 내부 클로저들이 상태를 갖지 않는다. `execute()` 호출마다 동일한 객체 구조를 반복 생성하는 것은 불필요하다. 모듈 스코프 상수로 한 번만 생성해도 충분하다. 단, `$helpers` 객체 자체가 sandbox 내에서 변조 가능한 참조로 노출될 수 있으므로 sandbox 격리 우선이면 현행 구조도 방어적으로 유효하다.
  - 제안: `const HELPERS = buildHelpers()` 형태로 모듈 상수화하거나, sandbox에 주입 시 `Object.freeze(buildHelpers())` 로 불변성을 명시. 샌드박스 코드가 `$helpers`를 교체하더라도 host realm에 영향이 없다면 상수 공유도 안전하다.

- **[WARNING]** `buildHelpers()`의 반환 타입이 `Record<string, unknown>`으로 구조 정보 소실
  - 위치: `code.handler.ts` L43 (함수 시그니처)
  - 상세: 반환 타입이 `Record<string, unknown>`이어서 `$helpers.crypto.uuid`, `$helpers.base64.encode` 등의 멤버가 타입 시스템에서 드러나지 않는다. `buildSandbox` 전체도 같은 문제를 공유한다. sandbox는 vm에 주입되는 런타임 컨텍스트이므로 완전한 타입 표현이 어렵다는 제약은 이해되나, 내부 인터페이스로 `HelpersApi` 타입을 선언해 사용하면 유지보수성과 오류 검출 능력이 개선된다.
  - 제안: `interface HelpersApi { date: (v?: unknown) => dayjs.Dayjs; crypto: { hash: (alg: string, data: string) => string; uuid: () => string }; base64: { encode: (d: string) => string; decode: (d: string) => string } }` 를 파일 내 선언하고 `buildHelpers(): HelpersApi`로 시그니처 강화.

- **[INFO]** `nodeMeta` 파라미터 추가로 `buildSandbox` 시그니처 확장 — 의존성 역전 미미하게 악화
  - 위치: `code.handler.ts` L66–68 (`buildSandbox` 파라미터)
  - 상세: `execMeta`에 이어 `nodeMeta`가 별도 파라미터로 추가됐다. 현재는 두 개로 관리 가능하지만, sandbox에 주입할 context 슬라이스가 더 늘어날 때마다 파라미터가 늘어나는 구조다. "Introduce Parameter Object" 패턴으로 묶으면 확장 비용이 낮아진다.
  - 제안: `interface SandboxContextMeta { execMeta: {...}; nodeMeta: {...} }` 형태로 통합하거나, `ExecutionContext`에서 필요한 슬라이스를 직접 넘기는 방식으로 미래 확장에 대비.

- **[INFO]** timeout 검증 이중화 — zod 스키마와 `validateCodeConfig` 두 곳에서 제약이 표현됨
  - 위치: `code.schema.ts` L330–335 (zod `.meta()` ui hint), `code.schema.ts` L354–1373 (`validateCodeConfig`)
  - 상세: zod 필드의 `.meta({ ui: { min: 1, max: 120 } })`는 UI 렌더링 힌트이고, 실제 범위 강제는 `validateCodeConfig`가 담당하는 구조가 주석으로 명시되어 있다. 의도적 설계이며 이중화가 아니라 레이어 분리다. 다만 두 상수(`1`, `120`)가 코드 두 곳에 반복 기재되어 있어 zod meta와 `MIN/MAX_TIMEOUT_SEC` 상수가 drift할 위험이 있다.
  - 제안: `MIN_TIMEOUT_SEC`/`MAX_TIMEOUT_SEC` 상수를 파일 상단으로 올리고 zod `.meta()` 에도 해당 상수를 참조하도록 통일하면 single source of truth가 완성된다.

- **[INFO]** 레이어 책임 분리 — schema/handler 분리 구조 적절
  - 위치: `code.schema.ts` 전체, `code.handler.ts` 전체
  - 상세: config 스키마(선언·기본값·UI 메타)는 `code.schema.ts`, 실행 로직은 `code.handler.ts`, 검증은 `validate()` + schema `warningRules`의 3-layer로 책임이 분리되어 있다. 데이터 계층(sandbox vm), 비즈니스 계층(execute 로직), 설정 계층(schema/metadata)의 경계가 명확하다.
  - 제안: 현행 유지.

- **[INFO]** 순환 의존성 없음
  - 위치: import 그래프 전체
  - 상세: `code.schema.ts` → zod/node interfaces, `code.handler.ts` → node:vm / crypto / dayjs / code.schema / core interfaces. `spec` 파일은 없고, 단방향 의존 그래프가 유지된다.
  - 제안: 현행 유지.

- **[INFO]** timer 셰도잉의 명시적 undefined 할당 — 방어적 설계 적절
  - 위치: `code.handler.ts` L123–126 (`setTimeout: undefined` 등)
  - 상세: vm context가 이미 이들을 미노출하지만, 명시적 shadowing은 계약을 코드 레벨에서 표현한다는 점에서 개방-폐쇄 원칙(계약 명시)을 강화한다. spec §7.3 참조가 주석에 포함되어 추적 가능성도 양호하다.
  - 제안: 현행 유지.

---

## 요약

이번 변경은 Code 노드 sandbox API 갭을 메우는 기능 보강으로, 아키텍처 관점에서 전반적으로 건전하다. `buildHelpers()` 분리·timer 명시 shadowing·schema/handler 레이어 분리 모두 SOLID 원칙에 부합하며 순환 의존성도 없다. 주요 경고는 두 가지다. 첫째, `buildHelpers()`의 반환 타입이 `Record<string, unknown>`으로 지나치게 넓어 내부 API 구조가 타입 시스템에서 사라진다. 둘째, timeout 범위 상수(`1`/`120`)가 zod `.meta()`와 `validateCodeConfig` 두 곳에 리터럴로 중복 기재되어 있어 drift 위험이 있다. 두 이슈 모두 기능 오동작을 유발하지는 않으나 유지보수성을 저하시킨다. `buildSandbox` 파라미터 확장 패턴은 지금은 수용 가능하나, context 슬라이스가 더 추가될 때를 대비해 Parameter Object로 통합을 권장한다.

## 위험도

LOW
