# 유지보수성(Maintainability) 리뷰 결과

## 발견사항

- **[INFO]** `@internal` JSDoc 태그 일관성 — 부분 적용
  - 위치: `engine-driver.interface.ts` — `rehydrateContext`, `loadAndBuildGraph`, `runNodeDispatchLoop`, `findActivatedBackEdge`, `clearLlmDefaultConfigCache` (5개 메서드)
  - 상세: C-1 step4 에서 추가된 5개 하위 메서드에는 `@internal` 태그가 추가됐으나, 인터페이스 상단의 `updateExecutionStatus`, `stageDurableResumeSnapshot`, `buildRetryReentryState`, `buildResumeCheckpoint`, `isCheckpointEligibleNodeType`, `contextKeyOf`, `applyPortSelection` 등 기존 메서드에는 없다. 인터페이스 전체가 `ENGINE_DRIVER` DI 토큰을 통해서만 소비되어야 한다면 경계 정책이 메서드별로 달라 보여 혼란을 줄 수 있다.
  - 제안: 기존 메서드들에도 동일한 `@internal` 태그를 추가하거나, 인터페이스 클래스 레벨 JSDoc에 "모든 멤버는 ENGINE_DRIVER 토큰을 통해서만 사용" 문구를 추가해 개별 태그를 생략하는 방식을 선택한다.

- **[INFO]** 주석 배치 이중화 — `execution-engine.service.ts`
  - 위치: `execution-engine.service.ts` 라인 750~752 (헬퍼 이동 안내 주석)와 라인 345~346 (diff 내 동일 주석)
  - 상세: 타입 이동 안내 블록 주석 (`// ─── Helper Interfaces moved to ./types/graph-dispatch.types.ts ─────────────`)이 `@Injectable()` 데코레이터 바로 위(라인 750)와 클래스 본문 시작 위(diff 기준 라인 345) 두 곳에 동일하게 위치한다. 하나는 불필요한 중복이다.
  - 제안: `@Injectable()` 위의 주석 블록(라인 750~752) 하나만 남기고 diff 345 위치의 중복 블록을 제거한다.

- **[INFO]** `dispatchMeta` 필드 타입 인라인 리터럴
  - 위치: `graph-dispatch.types.ts` — `NodeDispatchLoopParams.dispatchMeta` 필드
  - 상세: `dispatchMeta: { startedAt?: string; mode: 'manual' }` 가 인라인 익명 객체 타입으로 정의됐다. 이 타입은 `execution-engine.service.ts` 내에서 실제 객체를 구성할 때도 동일 shape 이 반복된다. 추후 `mode` 에 새 값이 추가되면 두 곳을 동기화해야 한다.
  - 제안: `NodeDispatchLoopParams` 파일 내에 `export type DispatchMeta = { startedAt?: string; mode: 'manual' }` 을 별도 타입으로 선언하고 필드에서 참조한다.

- **[INFO]** `graph-dispatch.types.ts` 파일 레벨 JSDoc과 개별 인터페이스 JSDoc 중 도입 경위 설명 중복
  - 위치: `graph-dispatch.types.ts` 라인 1~12 (파일 레벨 주석)과 각 인터페이스 JSDoc 첫 단락
  - 상세: 파일 레벨 주석이 "C-1 후속 — 타입 레벨 순환 해소를 위해 분리" 경위를 설명하고, `ExecutionGraphState` JSDoc 첫 문장("Graph rebuild 결과를 한 번에 운반하는 구조체")은 해당 타입의 의미를 설명하므로 중복이 없다. 다만 파일 레벨 주석 블록이 두 개의 별개 단락(`import` 사이 빈 블록 + 실질 설명 블록)으로 나뉘어 렌더링 도구(TypeDoc 등)가 두 블록을 독립 모듈 주석으로 처리할 수 있다.
  - 제안: 두 단락을 하나의 `/** ... */` 블록으로 합친다.

## 요약

이번 변경은 `ExecutionGraphState` / `NodeDispatchLoopParams` 타입을 독립 leaf 모듈(`types/graph-dispatch.types.ts`)로 분리하고, C-1 step4 추가 EngineDriver 메서드에 `@internal` 접근 경계 JSDoc을 보강하며, `ExecutionCancelledError` 에 내부 전용 sentinel 명시를 추가한 구조 개선이다. 순환 의존 해소라는 핵심 목적이 명확하게 반영되어 있고 타입 정의·JSDoc·상수 배치 모두 코드베이스 기존 패턴을 충실히 따른다. 지적 사항은 모두 INFO 수준으로, `@internal` 태그의 부분 적용 범위 불일치와 사소한 주석 중복이 있으나 기능·아키텍처·가독성에 실질적인 영향을 주지 않는다.

## 위험도

NONE
