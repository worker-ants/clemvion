# 유지보수성(Maintainability) 리뷰

## 발견사항

### 파일 1: engine-driver.interface.ts

- **[INFO]** JSDoc 내 `@internal` 비대칭 — 인터페이스 본문 JSDoc에 명시된 것처럼 C-1 step4 멤버 5개만 `@internal`을 달고 상위 7개 멤버 중 나머지 2개(`updateExecutionStatus`, `stageDurableResumeSnapshot` 등)는 `@internal`이 없다.
  - 위치: 인터페이스 본문 전체, `@internal`이 없는 상단 멤버들
  - 상세: 클래스 레벨 JSDoc에 "그 외 멤버도 동일 계약상 내부 전용"이라고 서술하지만, 개별 멤버 JSDoc에 `@internal`이 없으면 IDE 자동완성·문서화 도구가 외부 공개 API로 노출한다. 독자는 클래스 레벨 설명을 놓치고 실수로 직접 참조할 수 있다.
  - 제안: 나머지 7개 멤버(step4 비대상)에도 `@internal` 태그를 추가하거나, 클래스 레벨 주석을 그대로 두는 대신 별도 `@remarks` 섹션으로 명확하게 강조.

- **[INFO]** import 인라인 주석 위치 일관성
  - 위치: 89번 라인 (`// C-1 후속 —`)
  - 상세: 해당 주석이 import 블록 바로 위에 위치하며 패턴 자체는 코드베이스 내에서 일관되게 쓰인다. 다만 주석이 길어 `import type { ... }` 블록보다 먼저 눈에 들어오는 구조. 현 파일 규모에서는 문제 없으나 동일 패턴이 지속 누적되면 import 섹션 가독성이 저하될 수 있다.
  - 제안: 현재 수준은 수용 가능. 장기적으로 import 주석은 블록 끝 `// reason` 형태보다 블록 앞 단일 요약 주석으로 통일하는 컨벤션 도입 검토.

---

### 파일 2: execution-engine.service.ts

- **[INFO]** 중복된 JSDoc 블록 — `applyContinuation` 메서드 직전에 빈 JSDoc(`/** ... */`)과 실제 JSDoc이 연속으로 2개 존재한다.
  - 위치: 라인 984–1009 (`/** 다중 인스턴스 환경 ... */` 직후 `/** Phase 2 — BullMQ Worker ...*/`)
  - 상세: 첫 번째 블록(라인 984–991)은 삭제 예정이었던 설명("옛 pendingContinuations 기반 in-memory listener")이며, 두 번째 블록(라인 993–1008)이 실제 현행 설명이다. 두 블록이 동시에 존재하면 TypeDoc/IDE가 첫 번째를 최종 메서드 문서로 채택해 혼란을 준다.
  - 제안: 라인 984–991의 폐기된 첫 번째 JSDoc 블록 제거.

- **[INFO]** `rehydrateAndResume` 의 일본어 주석 혼입
  - 위치: 라인 1271–1273 (`// W19: internal identifiers は structured params へ`)
  - 상세: 코드베이스 전체가 한국어 + 영어 혼합 주석을 사용하는데 이 위치에만 일본어가 섞여 있다. 일관성 위반.
  - 제안: 한국어 또는 영어로 재작성. 예: `// W19: 내부 식별자는 structured params 로 분리 — 로그 집적기에 raw message 노출 방지.`

- **[INFO]** `rehydrateContext` 내 `seenNodeIds` + `seenNodeIdSet` 이중 자료구조
  - 위치: 라인 1401–1407
  - 상세: `seenNodeIdSet`(Set)으로 중복 제거를, `seenNodeIds`(string[])로 삽입 순서를 유지한다. 기능적으로 필요한 패턴이지만 2개의 자료구조가 같은 데이터를 나타내므로 독자가 의도를 즉각 파악하기 어렵다.
  - 제안: 인라인 주석으로 "삽입 순서를 보존하면서 중복 제거 — Set 단독으로는 순서 보장이 ES spec 에 따라 가능하지만 Array 병행으로 명시적 순서 의존성을 문서화"를 추가. 또는 `LinkedHashSet` 패턴 주석 한 줄 추가.

- **[INFO]** `dispatchMeta` 타입 인라인 리터럴
  - 위치: `graph-dispatch.types.ts` 라인 1760 (`dispatchMeta: { startedAt?: string; mode: 'manual' }`)
  - 상세: `dispatchMeta`의 타입이 인터페이스 내 인라인 리터럴로 정의돼 있다. `mode: 'manual'`만 허용하는 리터럴 타입이 추후 'auto' 등 값이 추가될 때 타입 수정 범위가 이 인라인에 숨어 있어 누락되기 쉽다.
  - 제안: `DispatchMeta` 별도 타입(interface 또는 type alias)으로 추출해 이름 부여.

---

### 파일 3: graph-dispatch.types.ts

- **[INFO]** `executionId` 필드 JSDoc 단순성
  - 위치: 라인 1744 (`/** 현재 처리 중인 Execution UUID. */`)
  - 상세: 이번 변경으로 추가된 내용. "Execution UUID"라는 설명은 타입(`string`)과 필드명(`executionId`)으로 이미 자명하다. `savedExecution`과의 관계(단순 id인지 중복 저장인지)를 명시하면 더 유용하다.
  - 제안: `/** 현재 처리 중인 Execution의 기본키(UUID). `savedExecution.id`와 동일값 — loop 내 logger / Map 키 용도로 별도 param 으로 노출. */`

- **[INFO]** `dispatchMeta.mode`가 `'manual'` 리터럴 고정
  - 위치: 라인 1760
  - 상세: 위 파일 2 발견사항과 동일. 현재 코드베이스에서 `mode: 'manual'`만 사용되나 향후 `'automatic'`, `'recovery'` 등이 추가될 가능성이 있을 때 타입 변경 포인트가 인터페이스 인라인에 묻힌다.
  - 제안: 별도 타입 추출 또는 유니온 타입 정의로 확장 지점 가시화.

---

## 요약

이번 변경은 주석만 추가하는 순수 docs 커밋으로 런타임·컴파일 산출물 무변이며, 유지보수성 측면에서 전반적으로 양호하다. 추가된 JSDoc은 순환 해소 이유, EngineDriver 멤버 접근 범위, NodeDispatchLoopParams 필드 목적을 명시해 온보딩 비용을 낮춘다. 다만 (1) `applyContinuation` 앞의 폐기된 JSDoc 블록이 잔류해 IDE 문서가 오염될 위험이 있고, (2) `rehydrateAndResume` 내 일본어 주석 혼입이 코드베이스 주석 언어 일관성을 깨뜨리며, (3) EngineDriver 인터페이스에서 상단 7개 멤버가 `@internal` 없이 클래스 레벨 설명에만 의존하는 점이 세부 개선 여지로 남는다. 이 항목들은 모두 INFO 수준이며 별도 fix 커밋 없이 다음 관련 변경 시 병행 정리해도 무방하다.

## 위험도

LOW
