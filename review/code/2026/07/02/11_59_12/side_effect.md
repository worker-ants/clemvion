# 부작용(Side Effect) 리뷰

## 개요

리뷰 대상은 refactor-03 M-7 클러스터: `resume-state.schema.ts`(신규) 도입 및
`ai-turn-orchestrator.service.ts` / `execution-engine.service.ts` /
`retry-turn.service.ts` / `handler-output.adapter.ts` 에서 `as Record<string, unknown>`
구조 단언을 새 zod-infer 타입(`ResumeState` / `ResumeCheckpoint` / `RetryState`)으로
치환한 것. 신규 테스트 2건 추가(`resume-state.schema.spec.ts`, 기존
`execution-engine.service.spec.ts` 에 drift-guard assertion 추가).

## 발견사항

- **[INFO]** `import type` 전용 사용 — 런타임 부작용 없음 확인
  - 위치: `ai-turn-orchestrator.service.ts:21`, `execution-engine.service.ts:78`,
    `retry-turn.service.ts:15`
  - 상세: `ResumeState`/`ResumeCheckpoint`/`RetryState` 는 세 프로덕션 파일 모두
    `import type { ... }` 로만 참조되고, `resumeCheckpointSchema` /
    `retryStateSchema` / `resumeStateSchema` 실 zod 객체(runtime value)는
    `.spec.ts` 두 파일에서만 `safeParse`/`parse` 로 호출된다
    (`grep -rn "resume-state.schema"` 로 프로덕션 임포트 3건 모두 `import type` 확인).
    파일 주석에 명시된 "behavior-preserving, 런타임 경계에서 parse 하지 않는다"는
    설계 의도가 실제 코드와 일치한다. 컴파일 타임 타입 단언 교체일 뿐이므로
    §7.5 rehydration 의 graceful-reset semantics(부분/손상 checkpoint 허용)에
    영향 없음.
  - 제안: 없음 — 확인 목적의 기록.

- **[INFO]** `handler-output.adapter.ts` 의 `isRecord` 로의 치환은 순수 동등 리팩토링
  - 위치: `handler-output.adapter.ts` (`wrapBareAsNodeHandlerOutput` 내부
    `_resumeState` 판별부)
  - 상세: 기존 인라인 조건 `obj._resumeState !== null && typeof === 'object' &&
    !Array.isArray(...)` 와 신규 `isRecord(obj._resumeState)`
    (`typeof value === 'object' && value !== null && !Array.isArray(value)`)
    는 논리적으로 완전히 동일 — 순서만 다르고 판정 결과가 모든 입력에 대해
    일치한다. 반환 타입도 `adapted._resumeState = obj._resumeState as
    Record<string, unknown>` → `isRecord` 타입가드로 얻은 narrowed 타입 그대로
    할당이라 동일. 부작용 없음.
  - 제안: 없음.

- **[INFO]** `resume-state.schema.ts` 의 `CREDENTIAL_CONTEXT_FIELDS` 신규 export 도입
  - 위치: `resume-state.schema.ts:3148-3160` (신규 파일)
  - 상세: 새 공개 상수/스키마 3종(`resumeCheckpointSchema`, `retryStateSchema`,
    `resumeStateSchema`)과 상수 1개(`CREDENTIAL_CONTEXT_FIELDS`)가 모듈에
    추가됐다. 이들은 전역 상태가 아니라 순수 정적 값(모듈 스코프 `const`)이며
    가변 공유 상태를 갖지 않는다. 신규 공개 API 추가이지만 기존 소비자에게
    영향 없는 additive 변경(누구도 이 심볼들을 아직 프로덕션 런타임에서
    소비하지 않음 — 테스트 전용).
  - 제안: 없음.

- **[INFO]** 시그니처 변경 없음 — 타입 애노테이션만 교체
  - 위치: `ai-turn-orchestrator.service.ts:211-212` (`resumeState` 지역 변수),
    `:757` (`nextResumeState`), `execution-engine.service.ts:1726-1729`
    (`resumeCheckpoint`), `retry-turn.service.ts:2013-2016`, `:2024-2027`
    (`retryState`)
  - 상세: 모두 함수/메서드 시그니처가 아닌 함수 **본문 내부** 지역 변수의 `as`
    단언 대상 타입만 변경됐다. 함수의 매개변수·반환 타입은 diff 범위에서
    변경되지 않았으므로 호출자(caller) 영향 없음. `ResumeState`/`RetryState`/
    `ResumeCheckpoint` 는 모두 `.partial().catchall(z.unknown())` 또는
    필드 전체가 optional 로 정의돼 있어(schema 상 `Record<string, unknown>`
    보다 좁아지지 않음 — 오히려 명시 필드는 optional, 미지 키는 catchall 로
    허용) 기존 `Record<string, unknown>` 캐스트가 허용하던 모든 접근 패턴
    (`resumeState.rawConfig`, `resumeState.turnDebugHistory`,
    `nextResumeState.model` 등)이 타입 체크상 계속 유효하다.
  - 제안: 없음.

- **[INFO]** 테스트 파일의 신규 assertion — 프로덕션 부작용 없음, 검증 강화만
  - 위치: `execution-engine.service.spec.ts:5429-5434`, `:5547-5552`
  - 상세: 두 테스트 케이스에 `resumeCheckpointSchema.safeParse(checkpoint)` +
    `CREDENTIAL_CONTEXT_FIELDS` 순회 `not.toHaveProperty` 단언이 추가됐다.
    이는 기존 `buildResumeCheckpoint` 산출물을 검증만 할 뿐 프로덕션 코드
    경로나 mock 동작을 변경하지 않는다. 순수 검증 강화.
  - 제안: 없음.

## 확인한 항목 (부작용 없음으로 판정)

- **전역 변수**: 신규 전역 mutable 상태 없음. `resume-state.schema.ts` 의
  export 는 모두 불변 스키마 정의/타입/상수 배열(`as const`)이다.
- **파일시스템 부작용**: 해당 없음 — diff 는 순수 TS 타입/스키마 정의와 그
  사용처 캐스트 교체.
- **환경 변수**: 읽기/쓰기 없음.
- **네트워크 호출**: 없음.
- **이벤트/콜백**: `eventEmitter.emitExecution` / `emitNode` 호출부는 diff 범위
  밖(기존 코드 그대로) — 이번 변경으로 emit 페이로드 shape 이나 호출 시점이
  달라지지 않는다. `nextResumeState.model` / `.totalInputTokens` 등 emit
  페이로드에 쓰이는 필드 접근은 타입 애노테이션만 바뀌었을 뿐 런타임 값 자체는
  기존과 동일한 객체(`adaptedNext._resumeState`)에서 그대로 읽는다.
- **인터페이스 변경**: `AiTurnOrchestrator`/`RetryTurnService`/
  `ExecutionEngineService` 의 public 메서드 시그니처는 diff 범위에서 변경되지
  않았다. `resumeCheckpointSchema` 등 신규 export 는 추가적(additive)이며
  기존 export 를 제거/변경하지 않는다.

## 요약

이번 diff 는 refactor-03 M-7 클러스터의 "타입 인프라 도입" 단계로, 기존
`as Record<string, unknown>` 구조 단언을 새로 정의한 `ResumeState` /
`ResumeCheckpoint` / `RetryState` (zod-infer) 타입으로 치환하는 순수 컴파일
타임 변경이다. 세 zod 스키마 값 자체는 프로덕션 코드에서 `import type` 으로만
참조되어 런타임에 전혀 인스턴스화·호출되지 않으며(`safeParse`/`parse` 호출은
신규·기존 테스트 파일에서만 발생), `handler-output.adapter.ts` 의 `isRecord`
치환도 기존 인라인 조건과 논리적으로 완전히 동등함을 확인했다. 함수 시그니처
변경, 전역 상태 도입, 파일시스템/네트워크/환경변수 접근, 이벤트 발생 패턴
변경 등 부작용 관점에서 우려할 사항은 발견되지 않았다.

## 위험도

NONE
