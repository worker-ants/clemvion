# 유지보수성(Maintainability) 리뷰

## 발견사항

### [INFO] 카테고리별 index.ts 파일의 구조 반복 패턴
- 위치: `codebase/backend/src/nodes/ai/index.ts`, `data/index.ts`, `flow/index.ts`, `integration/index.ts`, `logic/index.ts`, `presentation/index.ts`, `trigger/index.ts`
- 상세: 7개 카테고리 index 파일이 동일한 구조(import → JSDoc → 배열 export)를 반복한다. 이는 의도된 패턴("노드 추가 = 이 배열에 한 줄" 주석이 모두에 있음)이고, 각 파일이 독립적인 배열을 정의하므로 공통 추상화보다 명시성을 선택한 것으로 적절하다. 반복은 있지만 중복 로직은 없다.
- 제안: 현 상태 유지. 추상화 시 오히려 카테고리 추가 진입점이 모호해진다.

### [INFO] `chartComponent` 네이밍 불일치 (pre-existing)
- 위치: `codebase/backend/src/nodes/presentation/index.ts` — `chartComponent`가 다른 컴포넌트들의 `*NodeComponent` 접미사와 다르다.
- 상세: `aiAgentNodeComponent`, `textClassifierNodeComponent` 등은 `NodeComponent` 접미사를 가지는데 `chartComponent`만 다르다. 이는 본 PR이 도입한 것이 아닌 기존 유입(pre-existing)이다. RESOLUTION.md에도 후속 cleanup PR로 이미 추적 중이다.
- 제안: 후속 cleanup PR에서 `chartNodeComponent`로 통일.

### [INFO] `sortComponents` 에서 `categoryOrder` Map이 매번 재생성됨
- 위치: `codebase/backend/src/modules/execution-engine/node-bootstrap.service.ts` — `sortComponents` 메서드 (라인 394-404)
- 상세: `onModuleInit()`은 부팅 시 1회만 호출되므로 실제 성능 문제는 없다. 다만 `categoryOrder` Map을 정적 캐시나 클래스 필드로 만들면 의도가 더 명확해질 수 있다. 현재 구현은 충분히 명확하고 간결하며 단일 책임에 부합한다.
- 제안: 현 구현 유지(부팅 1회 호출이므로 최적화 불필요). 향후 `sortComponents`가 여러 경로에서 호출될 가능성이 생기면 그때 캐싱 고려.

### [INFO] 테스트 파일의 세 번째 케이스(`build 결과 객체 전달` 가드)에서 `setup()` 헬퍼 미사용
- 위치: `codebase/backend/src/modules/execution-engine/node-bootstrap.service.spec.ts` 라인 285-304
- 상세: 첫 두 케이스는 `setup()` 헬퍼를 사용하나, 세 번째 케이스(`deps 누락 회귀 가드`)는 직접 `NodeBootstrapService`를 생성한다. 이 케이스는 `built` 객체를 커스텀 값(`{ llmService: {} }`)으로 만들어야 하므로 `setup()`의 시그니처로는 수용하기 어려운 것이 이유로 보인다. 그러나 `setup(components, built?)` 식의 선택적 매개변수를 추가하면 일관성이 높아진다. 현재 상태도 읽기에 큰 문제는 없다.
- 제안: 반드시 수정할 수준은 아님(INFO). 향후 테스트 케이스 추가 시 `setup()` 헬퍼를 확장해 일관성 유지 고려.

### [INFO] `bootstrapArgs()` 헬퍼가 첫 번째 `bootstrap` 호출만 추출한다는 암묵적 가정
- 위치: `codebase/backend/src/modules/execution-engine/node-bootstrap.service.spec.ts` 라인 230-237
- 상세: `mock.calls[0]`으로 첫 번째 호출을 추출한다. `onModuleInit()`이 `bootstrap`을 정확히 1회 호출한다는 것은 테스트에서 `toHaveBeenCalledTimes(1)`으로 명시 검증되므로 안전하다. 다만 `calls[0]` 대신 `calls.at(-1)` 또는 `mock.lastCall`을 쓰면 "가장 최근 호출"이라는 의미를 더 명확히 표현할 수 있다.
- 제안: 선택적 개선. 현 구현도 명확하고 `toHaveBeenCalledTimes(1)` 검증이 있어 안전하다.

### [INFO] `NodeComponentsModule` JSDoc 분량이 모듈 크기 대비 과다
- 위치: `codebase/backend/src/nodes/node-components.module.ts`
- 상세: 모듈 코드 자체는 3줄(`@Module` 데코레이터)인데 JSDoc이 20줄이다. 설계 근거·참조·미래 계획이 상세히 기술되어 있어 "왜 이렇게 했는가"를 이해하기 좋지만, 동일 내용이 plan 문서(`refactor-m5-node-di-layer1.md`)·RESOLUTION.md에도 중복 존재한다. 필요한 정보는 담겨 있으나 향후 변경 시 동기화 부담이 생길 수 있다.
- 제안: 핵심 계약만 JSDoc에 남기고 상세 설계 근거는 plan/spec으로 참조 위임하는 것을 고려. 현 수준도 허용 가능.

### [INFO] `node-component.interface.ts`의 `NODE_COMPONENT` 토큰 JSDoc도 인터페이스 파일 기준 분량 과다
- 위치: `codebase/backend/src/nodes/core/node-component.interface.ts` 라인 552-568
- 상세: DI 토큰 1개의 정의에 15줄 JSDoc이 붙어 있다. 토큰의 목적·사용 경로·설계 결정을 기술하는 것은 좋으나, 중요한 계약(무엇에 바인딩되고 누가 주입받는지)은 첫 2-3줄에 담겨 있고 나머지는 배경 설명이다. 주석이 길수록 코드 변경 시 주석 동기화 누락 위험이 높아진다.
- 제안: 선택적 개선. 현 수준도 이해에 도움이 되므로 강제 수정 불요.

## 요약

M-5 레이어1 DI 리팩터는 유지보수성 관점에서 전반적으로 우수한 변경이다. 핵심 개선 — 단일 81줄 정적 import 목록을 7개 카테고리별 단일 출처 배열로 분산하고 `ALL_NODE_COMPONENTS`는 spread 집계만 담당하게 한 것 — 은 "노드 추가 = 카테고리 배열 1줄"이라는 명확한 규칙을 만들어 merge-conflict hotspot을 구조적으로 해소한다. `NodeBootstrapService`의 `sortComponents` 메서드는 짧고 단일 책임이며 주석도 충분하다. 테스트 리팩터(`setup()`/`bootstrapArgs()` 헬퍼 추출)로 테스트 코드의 가독성도 높아졌다. 발견된 항목은 모두 INFO 수준으로, `chartComponent` 네이밍 불일치(pre-existing·후속 PR 추적 중)·JSDoc 분량·테스트 헬퍼 일관성 등의 소소한 개선 여지이며, 현 구현을 차단하거나 즉각 수정해야 할 사항은 없다.

## 위험도

NONE
