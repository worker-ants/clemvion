# 부작용(Side Effect) 리뷰

## 개요

리뷰 대상은 refactor-03 M-7 클러스터의 후속 diff: `resume-state.schema.ts`
기반 `ResumeState`/`ResumeCheckpoint`/`RetryState` 타입 도입(`ai-turn-orchestrator.service.ts`
/ `execution-engine.service.ts` / `retry-turn.service.ts` / `handler-output.adapter.ts`)과,
직전 리뷰 세션(`review/code/2026/07/02/11_59_12`)에서 지적된 WARNING(W-1:
non-strict `safeParse` 로 인한 항상-참 drift-guard)에 대한 수정
(`execution-engine.service.spec.ts` 의 `.strict()` 적용), 그리고 해당 리뷰
세션의 프로세스 산출물(RESOLUTION.md/SUMMARY.md/meta.json 등) 추가로 구성된다.

## 발견사항

- **[INFO]** 타입 전용 임포트 — 런타임 부작용 없음
  - 위치: `ai-turn-orchestrator.service.ts:21`, `execution-engine.service.ts:78`,
    `retry-turn.service.ts:15`
  - 상세: `ResumeState`/`ResumeCheckpoint`/`RetryState` 는 세 프로덕션 파일
    모두 `import type` 으로만 참조됨을 `grep -rn "import.*resume-state.schema"`
    로 재확인(3건 전부 `import type`). 대응하는 zod 스키마 객체
    (`resumeCheckpointSchema`/`retryStateSchema`/`resumeStateSchema`)는
    `resume-state.schema.spec.ts` 와 `execution-engine.service.spec.ts` 에서만
    `safeParse`/`.strict()` 로 호출되며 프로덕션 실행 경로에서 인스턴스화되지
    않는다. 기존 `as Record<string, unknown>` 단언을 새 타입 단언으로 바꾼 것은
    순수 컴파일 타임 변경으로, §7.5 rehydration 의 graceful-reset(부분/손상
    checkpoint 에 대한 관대한 처리) 행위에 영향 없음.
  - 제안: 없음.

- **[INFO]** `handler-output.adapter.ts` 의 `isRecord` 치환은 동치 리팩토링
  - 위치: `handler-output.adapter.ts` `wrapBareAsNodeHandlerOutput`
  - 상세: 기존 인라인 조건(`obj._resumeState !== null && typeof === 'object' &&
    !Array.isArray(...)`)과 신규 `isRecord(obj._resumeState)` 는 논리적으로
    동일 판정을 내린다. 반환 값 대입도 동일 객체 참조를 그대로 사용해 데이터
    형태·시점에 변화 없음.
  - 제안: 없음.

- **[INFO]** 직전 리뷰 WARNING(W-1) 수정 — 테스트 강화, 프로덕션 무영향
  - 위치: `execution-engine.service.spec.ts:5433-5439`, `:5555-5561`
  - 상세: 직전 세션에서 지적된 `resumeCheckpointSchema.safeParse(checkpoint)`
    (non-strict — 알 수 없는 키를 조용히 strip 해 항상 `success:true`) 문제가
    본 diff 에서 `.strict()` 추가로 수정됐다. 부작용 관점에서는 순수 assertion
    강화이며 프로덕션 코드·mock 동작을 변경하지 않는다. RESOLUTION.md 에
    `.strict()` 적용 후 335 tests PASS 로 기록돼 실행 검증도 확인됨.
  - 제안: 없음.

- **[INFO]** 신규 export(스키마 3종 + `CREDENTIAL_CONTEXT_FIELDS`)는 additive,
  mutable 전역 상태 아님
  - 위치: `utils/resume-state.schema.ts` (신규 파일)
  - 상세: 모듈 스코프 `const` 로 정의된 불변 zod 스키마·상수 배열(`as const`)이며
    가변 공유 상태가 아니다. 기존 export 를 제거·변경하지 않는 순수 추가.
  - 제안: 없음.

- **[INFO]** 시그니처 변경 없음 — 지역 변수 타입 단언만 교체
  - 위치: `ai-turn-orchestrator.service.ts` (`resumeState`, `nextResumeState`),
    `execution-engine.service.ts` (`resumeCheckpoint`), `retry-turn.service.ts`
    (두 곳 `retryState`)
  - 상세: 모두 함수 본문 내부 지역 변수의 `as` 캐스트 대상 타입만 바뀌었고,
    함수 매개변수·반환 타입은 diff 범위에서 변경되지 않음. 새 타입은
    `.partial().catchall(z.unknown())` 또는 전 필드 optional 구조라 기존
    `Record<string, unknown>` 캐스트가 허용하던 모든 필드 접근 패턴이 타입
    체크상 계속 유효 — 호출자 영향 없음.
  - 제안: 없음.

- **[INFO]** 새로 추가된 review 프로세스 산출물
  - 위치: `review/code/2026/07/02/11_59_12/*` (RESOLUTION.md, SUMMARY.md,
    meta.json, 이전 세션 reviewer 출력 등)
  - 상세: 소스 코드가 아닌 이전 리뷰 세션 산출물이며, 프로젝트 컨벤션
    (`review/**` 커밋 대상)에 부합하는 문서 파일 생성일 뿐 런타임 부작용과
    무관.
  - 제안: 없음.

## 확인한 항목 (부작용 없음으로 판정)

- **전역 변수**: 신규 mutable 전역 상태 없음. 모든 export 는 불변 스키마
  정의/타입/상수 배열.
- **파일시스템 부작용**: 소스 diff 자체는 파일시스템 접근 없음. 리뷰 산출물
  파일 추가는 컨벤션에 따른 의도된 문서 생성.
- **환경 변수**: 읽기/쓰기 없음.
- **네트워크 호출**: 없음.
- **이벤트/콜백**: emit 페이로드 shape·호출 시점 변경 없음 — 동일 런타임
  객체(`adaptedNext._resumeState` 등)에서 값을 읽되 타입 애노테이션만 변경.
- **인터페이스 변경**: `AiTurnOrchestrator`/`RetryTurnService`/
  `ExecutionEngineService` 의 public 메서드 시그니처는 diff 범위에서 변경되지
  않았다. 신규 export 는 additive.

## 요약

이번 diff 는 refactor-03 M-7 클러스터의 타입 인프라 도입(zod-infer 기반
`ResumeState`/`ResumeCheckpoint`/`RetryState` 로 `as Record<string, unknown>`
단언 치환) 및 직전 리뷰에서 지적된 non-strict 검증 결함(W-1)의 수정으로
구성된다. 세 zod 스키마 값은 프로덕션에서 `import type` 으로만 참조되어
런타임에 전혀 인스턴스화되지 않고, `isRecord` 치환도 기존 로직과 완전히
동치이며, 함수 시그니처·공개 인터페이스·전역 상태·파일시스템·환경변수·
네트워크·이벤트 흐름 어디에도 실질적 변경이 없는 behavior-preserving
리팩토링이다. 부작용 관점에서 우려할 사항은 발견되지 않았다.

## 위험도

NONE
