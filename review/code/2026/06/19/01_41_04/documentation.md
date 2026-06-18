# 문서화(Documentation) 리뷰 결과

## 발견사항

### 파일 1: engine-driver.interface.ts

- **[INFO]** `@internal` 태그 패턴 일관성 — 적용
  - 위치: 라인 45, 54, 63, 72, 81 (`@internal` 추가)
  - 상세: `rehydrateContext`, `loadAndBuildGraph`, `runNodeDispatchLoop`, `findActivatedBackEdge`, `clearLlmDefaultConfigCache` 5개 메서드 모두 `@internal` 태그가 추가됐다. 태그 문구도 "EngineDriver 계약(ENGINE_DRIVER)을 통해서만 호출. 모듈 외부 직접 참조 금지."로 완전히 통일돼 있어 접근 제어 의도가 명확하다.
  - 제안: 현 상태 유지. 단, C-1 step2 구간의 `updateExecutionStatus`, `stageDurableResumeSnapshot`, `buildRetryReentryState`, `buildResumeCheckpoint`, `isCheckpointEligibleNodeType`, `contextKeyOf`, `applyPortSelection` 7개 메서드에는 `@internal` 태그가 없다. 이 메서드들이 "모듈 외부 직접 참조 금지" 대상인지 아닌지 명시가 필요하다. 공개 API면 `@public` (또는 태그 없음), 내부 전용이면 `@internal` 추가를 권장한다.

- **[INFO]** import 경로 변경 주석 없음
  - 위치: 라인 35–36 (`from './execution-engine.service'` → `from './types/graph-dispatch.types'`)
  - 상세: 변경 이유(타입 레벨 순환 해소)가 `execution-engine.service.ts` 주석에만 기술돼 있고, `engine-driver.interface.ts` 자체에는 이 변경 이유 주석이 없다. `engine-driver.interface.ts`를 독립적으로 읽는 독자는 왜 service 대신 `types/` 폴더에서 임포트하는지 알 수 없다.
  - 제안: import 블록 위에 한 줄 주석 추가: `// C-1 후속 — engine-driver.interface.ts ↔ execution-engine.service.ts 타입 레벨 순환 해소, 중립 leaf 모듈로 분리 이동`

### 파일 2: execution-engine.service.ts

- **[WARNING]** 잘린 블록 주석이 클래스 독스트링 앞에 삽입
  - 위치: 라인 750–752 (클래스 독스트링 직전)
  - 상세: `/** 워크플로우 실행 엔진의 단일 진입점... */` 독스트링 블록 뒤에 `// ─── Helper Interfaces moved to ./types/graph-dispatch.types.ts ─────────────` 구분선 주석이 붙어 있다. 이 주석이 클래스 독스트링 바로 앞에 위치하지 않고, 독스트링 **끝** 다음에 와서 클래스 선언(`export class ExecutionEngineService`) 사이에 끼어있다. 실제로 독스트링(라인 726–749) 다음 이 주석(라인 750–752), 그 다음 빈 줄, 그 다음 또 다른 `/**` 독스트링(`isAbortError`)이 시작되어 클래스 독스트링이 `ExecutionEngineService`에 실제로 붙지 않고 `isAbortError` 함수를 문서화하는 것처럼 구조가 오인될 수 있다. TypeScript/JSDoc 파서는 `export class ExecutionEngineService`에 가장 인접한 `/** */` 블록을 클래스 독스트링으로 인식한다.
  - 제안: 구분선 주석(`// ─── Helper Interfaces moved...`)을 클래스 선언과 `isAbortError` 함수 독스트링 사이가 아닌, 삭제된 인터페이스 위치 직후(라인 346 영역)로 이동하거나, 클래스 `@JSDoc` 독스트링 내 `@remarks` 섹션에 통합한다. 또는 구분선 주석과 `isAbortError` 독스트링 순서를 바꿔 클래스 선언이 자체 독스트링 바로 뒤에 오도록 재배치한다.

- **[INFO]** 이동된 인터페이스에 대한 tombstone 주석 충분성
  - 위치: 라인 345–347
  - 상세: `// ─── Helper Interfaces moved to ./types/graph-dispatch.types.ts ─────────────` + 2줄 설명으로 기존 위치에 tombstone이 남아있어 삭제 이유와 대상 위치를 알 수 있다. 적절한 처리다.
  - 제안: 현 상태 유지.

- **[INFO]** `import type` 추가에 주석 없음
  - 위치: 라인 264–267 (새 `import type { ExecutionGraphState, NodeDispatchLoopParams }`)
  - 상세: 기존의 로컬 정의가 삭제되고 외부 모듈에서 임포트하는 형태로 바뀌었는데, 임포트 블록에 변경 이유 주석이 없다. 같은 파일의 다른 임포트 블록들은 C-1 step 번호와 이유를 주석으로 남기는 패턴을 일관되게 따르고 있다.
  - 제안: `// C-1 후속 — graph-dispatch 타입들을 leaf 모듈로 이동 (engine-driver.interface.ts 타입 순환 해소)` 주석 한 줄 추가.

### 파일 3: types/graph-dispatch.types.ts (신규 파일)

- **[INFO]** 모듈 레벨 독스트링 구조 — 2개 블록 중복
  - 위치: 라인 14–23과 라인 25–33
  - 상세: 파일 최상단에 모듈 목적을 설명하는 독스트링 블록(라인 14–23)이 있고, 바로 이어서 `ExecutionGraphState` 인터페이스 독스트링(라인 25–33)이 온다. 모듈 레벨 설명이 별도 `/** */` 블록으로 파일 최상단에 위치하는 것은 좋은 관행이나, 해당 블록이 어느 선언에도 붙지 않는 "부유(floating)" 독스트링 형태라 일부 TSDoc 파서는 무시할 수 있다. 파일 레벨 모듈 문서는 `@module` 태그와 함께 작성하는 것이 표준이다.
  - 제안: 모듈 레벨 독스트링에 `@module` 태그 추가: `/** @module graph-dispatch.types — ... */` 또는 일반 행 주석(`// ...`)으로 전환. 현 코드베이스의 다른 leaf 파일 관행을 따른다.

- **[INFO]** `NodeDispatchLoopParams.dispatchMeta` 타입 리터럴 문서화 미흡
  - 위치: 라인 86–87 (`dispatchMeta: { startedAt?: string; mode: 'manual' }`)
  - 상세: 필드 주석이 "executeNode 의 meta — startedAt + mode"로만 기술돼 있다. `mode: 'manual'`이 현재 단일 리터럴 타입인 이유(다른 mode가 없는 이유, 혹은 향후 확장 계획)에 대한 설명이 없다. 소비자가 왜 항상 `'manual'`만 가능한지 이해하기 어렵다.
  - 제안: 주석에 `mode 는 현재 'manual' 단일값 — 수동 트리거 전용 dispatch loop 이므로` 정도의 설명 추가.

- **[INFO]** `executionId` 필드 JSDoc 누락
  - 위치: 라인 74 (`executionId: string`)
  - 상세: `NodeDispatchLoopParams`의 `executionId` 필드에만 인라인 주석이 없다. 다른 필드들은 모두 `/** ... */` 주석이 있다.
  - 제안: `/** 현재 처리 중인 Execution UUID. */` 추가.

### 파일 4: workflow-errors.ts

- **[INFO]** `@internal` 태그 추가 — 적절
  - 위치: 라인 288–289 (`ExecutionCancelledError` 독스트링에 `@internal` 추가)
  - 상세: 기존 독스트링이 이미 "모듈 내부 cancel 전파 전용 sentinel"임을 산문으로 설명하고 있었고, 여기에 `@internal` JSDoc 태그가 추가됐다. 중복처럼 보이지만, 산문 설명과 기계 판독 가능한 JSDoc 태그가 공존하는 것은 정확한 관행이다.
  - 제안: 현 상태 유지. 산문 설명은 사람을 위한 것이고, `@internal` 태그는 IDE/문서 생성기를 위한 것이므로 둘 다 가치 있다.

## 요약

이번 변경(C-1 step4 완료 후 타입 분리 + `@internal` 태그 일괄 추가)에서 문서화 품질은 전반적으로 높다. `EngineDriver` 계약의 5개 내부 메서드에 일관된 `@internal` 태그가 추가됐고, 신규 `graph-dispatch.types.ts` 파일은 각 필드마다 인라인 주석을 갖추고 있으며 이동 이유를 설명하는 모듈 독스트링도 있다. 주요 관심사는 세 가지다: (1) `engine-driver.interface.ts`의 C-1 step2 구간 메서드들에 대한 접근 제어 의도가 명시되지 않았다, (2) `execution-engine.service.ts`에서 구분선 주석이 클래스 독스트링과 클래스 선언 사이에 끼어 JSDoc 파서 입장에서 클래스 독스트링 귀속이 모호해질 수 있다, (3) 새 `import type` 추가 위치에 C-1 step 주석 관행이 적용되지 않았다. 이 중 (2)번이 실제 문서 생성이나 IDE 호버 정보 표시에 영향을 줄 수 있어 가장 주목할 사항이다.

## 위험도

LOW
