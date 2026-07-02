# 부작용(Side Effect) Review

## 발견사항

- **[INFO]** `endMultiTurnConversation` 내부 `state as ResumeState` — 런타임 미검증 캐스트
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:230` (`const s = state as ResumeState;`)
  - 상세: `ResumeState` zod 스키마(`resume-state.schema.ts`)는 문서 주석대로 "behavior-preserving" 목적으로만 쓰이고 `parse`/`safeParse` 를 거치지 않는다. `state as ResumeState` 는 컴파일 타임 타입 단언일 뿐 런타임 형태 검증이 아니므로, 기존 `state.xxx as T` 개별 단언들을 하나의 캐스트로 모은 것과 동일한 위험 수준이다 — 즉 malformed `state`(예: 구버전 checkpoint, `messages` 가 배열이 아닌 경우)가 들어와도 이전과 동일하게 조용히 통과한다. 이는 의도된 behavior-preserving 리팩터이며 회귀는 아니지만, `s.turnCount ?? 0` 처럼 이전에 있던 `(state.turnCount as number) ?? 0` 대비 `?? 0` fallback 은 여전히 유지되어 동작 동일성이 잘 보존됨을 확인.
  - 제안: 변경 없음 — 현재 스코프(M-7, behavior-preserving 명시)에서는 적절. 추후 런타임 검증이 필요해지면 별도 plan 항목으로 분리 권장(이미 스키마 파일 주석에 명시됨).

- **[INFO]** `isRecord`/`toRecord` 신규 테스트만 추가, 프로덕션 로직 변경 없음
  - 위치: `codebase/backend/src/modules/execution-engine/utils/to-record.spec.ts`, `to-record.ts`
  - 상세: `to-record.ts` diff 는 JSDoc 주석(caveat 문서화)만 추가되었고 `isRecord`/`toRecord` 함수 바디는 변경되지 않았다(`typeof value === 'object' && value !== null && !Array.isArray(value)` 그대로). 순수 함수이며 전역 상태·I/O 없음. 부작용 없음.
  - 제안: 없음.

- **[INFO]** `buildMultiTurnFinalOutput` 공개(non-private) 메서드의 파라미터 타입 협소화 (`retryStateSource?: Record<string, unknown>` → `retryStateSource?: ResumeState`)
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:3007`
  - 상세: `ResumeState` 는 `.partial().catchall(z.unknown())` 로 정의되어 있어(구조적으로 `Record<string, unknown>` 의 부분 타입이지만 명시적 키는 optional) 사실상 `Record<string, unknown>` 과 구조적으로 assignable 하다 — `{}` 도 유효한 `ResumeState` 값이다. 유일한 호출부는 동일 파일 내 `endMultiTurnConversation` 에서 `s`(= `state as ResumeState`)를 그대로 전달하는 한 곳이며, `ai-agent.handler.ts` 의 wrapper 는 `Parameters<...>` 로 시그니처를 그대로 위임하므로 타입 불일치가 발생하지 않는다. `information-extractor.handler.ts` 의 동명 메서드는 별개 클래스의 별도 정의라 영향 없음(호출 규약 공유는 `processMultiTurnMessage` 뿐).
  - 제안: 없음 — 유일 호출자 내부 정합 확인됨. 외부 계약(공개 API, WS, DB) 변경 없음.

- **[INFO]** `buildRetryState` private static 메서드 시그니처 변경 (`Record<string, unknown>` → `ResumeState`, 반환 `Record<string, unknown>` → `RetryState`)
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:3124`
  - 상세: `private static` 이며 파일 내 유일 호출부(`buildMultiTurnFinalOutput` 내부)만 존재. 외부 노출 없음. 반환 객체의 필드 구성(`messages`, `turnCount`, `totalInputTokens` 등)은 diff 전후 동일 — credential/context-binding 필드(`llmConfigId`, `workspaceId` 등) 의도적 미동봉 정책도 유지됨.
  - 제안: 없음.

- **[INFO]** 환경 변수 / 네트워크 호출 / 전역 변수 관련
  - 상세: 본 diff 범위에서 `process.env.AI_RETRY_STATE_TTL_MINUTES` 읽기(`resolveRetryStateTtlMinutes`)는 기존 코드 그대로이며 diff 로 신규 추가/변경되지 않았다. 신규 전역 변수·모듈 top-level mutable state 도입 없음. 네트워크 호출·파일시스템 접근·이벤트 emit 로직 변경 없음(순수 타입 레이어 리팩터).

## 요약

이번 변경은 refactor-03 M-7 클러스터의 타입 안전성 개선(behavior-preserving)으로, `isRecord`/`toRecord` 유틸에는 문서화 테스트만 추가되었고 `ai-turn-executor.ts` 는 기존 `as`/`??` 단언들을 `ResumeState`/`RetryState` zod-infer 타입으로 좁히는 리팩터다. 시그니처가 변경된 두 메서드(`buildMultiTurnFinalOutput` 의 `retryStateSource` 파라미터, `private static buildRetryState`)는 각각 파일 내 단일 호출부만 가지며 그 호출부도 함께 갱신되어 있어 외부 API·DB 영속 포맷·WS 프로토콜에 미치는 영향이 없다. `state as ResumeState` 캐스트는 런타임 검증을 추가하지 않는 컴파일 타임 전용 단언으로, 기존 개별 `as` 단언들의 동작과 동등하다(스키마 자체 문서에도 "behavior-preserving, parse 안 함" 이 명시됨). 전역 상태·환경 변수·네트워크·이벤트 콜백 어느 항목에서도 새로운 부작용은 관찰되지 않는다.

## 위험도
NONE
