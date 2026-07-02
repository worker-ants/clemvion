# 부작용(Side Effect) Review

## 대상
- `codebase/backend/src/modules/execution-engine/utils/resume-state.schema.ts`
- `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts`

## 발견사항

- **[INFO]** `z.custom<T>()` 무인자 호출은 런타임 검증을 추가하지 않음 (의도된 설계, 확인됨)
  - 위치: `resume-state.schema.ts:49,133,134` (`messages`/`turnDebugHistory`/`allPresentations`)
  - 상세: `z.custom<T>()` 를 predicate 없이 호출하면 항상 `true` 를 반환하는 검증기가 생성되어 모든 값을 통과시킨다(zod 표준 동작). 즉 `z.array(z.custom<ChatMessage>())` 는 배열 여부만 검사하고 원소는 완전히 미검증이며, `turnDebugHistory`/`allPresentations` 는 `z.custom<T>()` 단독이라 타입 검사조차 없다(이전 `z.unknown()` 과 런타임 강도 동일). 파일 상단 주석과 diff 주석 모두 이 사실을 명시하고 있어 의도된 behavior-preserving 변경으로 판단된다. §7.5 graceful-reset 계약(malformed 허용 semantics)에 영향 없음.
  - 제안: 없음 — 현재 상태 적절. 다만 이 스키마가 향후 실제 `parse`/`safeParse` 검증 목적으로 오용되지 않도록(즉 "타입만 sharpen, 검증 아님"이라는 계약이 향후 리팩터에서 잊히지 않도록) 파일 헤더 주석에 이미 강하게 명시되어 있어 리스크 낮음.

- **[INFO]** `state as ResumeState` 캐스트 도입 — 런타임 형태 불변, 컴파일 타임 전용
  - 위치: `ai-turn-executor.ts` 여러 지점 (예: 2110행 부근 `const resumeState = state as ResumeState;`, 2452행 부근, 2930행 부근)
  - 상세: 새로 도입된 `resumeState` 지역 변수는 `state`(런타임 객체)를 재할당하지 않고 단순 타입 캐스트 별칭이다. diff 주석에서도 "state 는 재할당되지 않음"을 명시. `state.turnDebugHistory as unknown[]` → `resumeState.turnDebugHistory`, `state.allPresentations as PresentationPayload[] | undefined` → `resumeState.allPresentations` 등은 순수하게 캐스트 위치를 스키마 레벨로 이동한 것으로, 런타임에 읽는 값·fallback(`|| []`, `?? []`) 로직이 diff 전후 동일하다. 부작용 없음.
  - 제안: 없음.

- **[INFO]** 세 곳에서 지역 변수 `resumeState` 가 서로 다른 스코프(메서드)에 각각 선언됨 — 이름 충돌 없음
  - 위치: `ai-turn-executor.ts` (executeMultiTurn 계열 최소 2곳 + `buildMultiTurnFinalOutput` 호출부 1곳, 기존 `s` 변수를 `resumeState` 로 rename)
  - 상세: 각각 별개 메서드의 지역 스코프이므로 충돌 없음. 세 번째 지점은 기존 `const s = state as ResumeState;` 를 `const resumeState = ...` 로 rename 한 것뿐이며 이후 사용처(`s.messages` → `resumeState.messages` 등) 전부 동일하게 치환되어 있어 참조 누락 없음(diff 확인 완료).
  - 제안: 없음.

- **[INFO]** 함수 시그니처/공개 인터페이스 변경 없음
  - 위치: 전체 diff
  - 상세: `AiTurnExecutor` 의 public/private 메서드 시그니처, `ResumeState`/`ResumeCheckpoint`/`RetryState` export 타입의 필드 키 집합, `resumeCheckpointSchema`/`retryStateSchema`/`resumeStateSchema` 의 object shape(zod schema 구조) 는 변경되지 않았다. 오직 3개 필드(`messages`, `turnDebugHistory`, `allPresentations`)의 zod validator 타입만 `z.unknown()`/`z.array(z.unknown())` → `z.custom<T>()` 계열로 바뀌었고, 이는 `z.infer` 산출 TS 타입만 좁힌다. DB 영속 스키마(`resumeCheckpointSchema`/`retryStateSchema`)의 키 구성·closed/partial/catchall 속성도 불변이라 직렬화·역직렬화 동작(§7.5 rehydration, checkpoint/retryState persistence)에 영향 없다.
  - 제안: 없음.

- **[INFO]** 전역 상태·환경 변수·파일시스템·네트워크·이벤트/콜백 변경 없음
  - 위치: 전체 diff
  - 상세: 두 파일 모두 순수 타입 레벨 리팩터(zod validator 교체 + as 캐스트 위치 이동)이며, 전역 변수 도입/수정, `process.env` 접근 패턴 변경, 파일 I/O, 외부 서비스 호출, `eventEmitter`/`conversationThreadService` 호출 인자·타이밍 변경이 전혀 없다. `eventEmitter?.emitExecution`, `conversationThreadService` push 호출부는 diff 범위 밖(비변경).
  - 제안: 없음.

## 요약
이번 변경은 `resume-state.schema.ts` 의 3개 zod 필드(`messages`/`turnDebugHistory`/`allPresentations`)를 `z.unknown()` 계열에서 `z.custom<T>()` 로 교체해 `z.infer` 타입만 domain 타입으로 sharpen 하고, `ai-turn-executor.ts` 에서 이에 대응하는 `as ChatMessage[]`/`as PresentationPayload[]` 류 도메인 캐스트를 제거해 `resumeState` 별칭으로 대체한 순수 컴파일 타임 리팩터다. `z.custom<T>()` 무인자 호출은 런타임 검증을 추가하지 않는다는 zod 표준 동작과 diff 자체 주석이 일치하며, `state` 객체 재할당·시그니처 변경·전역 상태·I/O·네트워크·이벤트 발생 경로 어디에도 손을 대지 않았다. 부작용 관점에서 리스크가 확인되지 않는 behavior-preserving 변경이다.

## 위험도
NONE
