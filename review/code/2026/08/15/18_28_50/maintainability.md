# 유지보수성(Maintainability) Review — `18_28_50`

## 배경

이 PR 은 이미 `17_54_32` 라운드에서 ai-review(CRITICAL 0 / WARNING 7)를 받았고, 동일 세션 `RESOLUTION.md` 로 W1~W7 전부 조치되었다(클래스 JSDoc 복구, `TYPE_TO_EVENT` 중복 제거, 판별력 회귀 테스트 추가·주석 정정, CHANGELOG 추가, 자매 plan stale 취소선 수정, SoT 표 갱신). 코드(`execution-event-emitter.service.ts`, `retry-turn.service.ts`, `execution-engine.service.ts`, 두 `.spec.ts`)를 직접 열어 그 조치가 실제로 반영됐는지 재확인했고, 아래는 그 결과 남아 있는 잔여 관찰사항이다.

## 발견사항

- **[INFO]** `failRetryExecution` 의 if/else 분기에 `durationMs: resolveTerminalDurationMs(execution)` 한 줄이 그대로 중복된다
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:984`(`cancelled` 분기), `:999`(`failed` 분기) — 함수 `failRetryExecution`
  - 상세: 파사드가 형태별 필수 필드를 강제해 삼항을 두 갈래로 편 것은 타당한 트레이드오프이고 코드에도 그 근거가 적혀 있다. 다만 두 분기가 공통으로 필요로 하는 `durationMs` 계산까지 각 분기에 복붙돼 있다. `resolveTerminalDurationMs` 자신이 `row.durationMs` 가 이미 숫자면 그대로 반환하는 self-memoizing 구조(`terminal-duration.ts:42`)라 값이 갈릴 위험은 없지만(직전 줄 963 에서 `execution.durationMs` 에 이미 채워둠), 소스상 동일한 표현식이 두 곳에 나타나 향후 계산 방식이 바뀌면 두 지점을 함께 고쳐야 한다.
  - 제안: 분기 진입 전에 `const durationMs = resolveTerminalDurationMs(execution);` 로 한 번만 계산해 두 분기에서 재사용하면 한 줄의 중복도 제거되고 "두 분기가 같은 값을 쓴다"는 의도가 코드로 더 명확해진다.

- **[INFO]** `TerminalEventPayload` 의 `cancelled.error` 가 이름 없는 인라인 타입이라 `TerminalErrorPayload` 와의 관계가 타입 시스템에 드러나지 않는다
  - 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts:48` (`error?: { code: string; message: string };`)
  - 상세: JSDoc(44~47줄)이 "시스템/타임아웃 취소만 동행" 이라 근거를 잘 남겼고, `terminal-error-payload.ts` 의 docstring 도 "취소 경로는 아직 `{code, message}` 를 손으로 만든다" 며 이 차이가 의도적임을 명시한다(즉 새 결함이 아니라 기지 상태). 다만 같은 파일에서 `error: TerminalErrorPayload | null`(37줄, `failed` variant)은 이름 있는 export 타입인데 `cancelled` variant 의 에러는 익명 리터럴이라, 이 타입만 보고는 "왜 두 에러 표현이 구조적으로 다른가" 가 타입 이름에서 안 읽힌다.
  - 제안: `{code, message}` 를 `SystemCancelErrorPayload` 등으로 명명해 export 하면(또는 `Pick<TerminalErrorPayload, 'code' | 'message'>` 형태로 관계를 표현하면) 두 에러 형태가 "같은 계열의 축소판"이라는 것이 타입 선언만으로 드러난다. 급하지 않음 — 현재 JSDoc 만으로도 의도는 충분히 전달됨.

- **[INFO]** `retry-turn.service.spec.ts` 에 종결 이벤트 종류를 검증하는 두 가지 스타일이 공존한다
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts:712`(`(c[1] as { type: string }).type` 원시 문자열 비교) vs `:797`·`:964`(`TYPE_TO_EVENT` 를 거쳐 `ExecutionEventType` enum 과 비교)
  - 상세: 전자는 `'cancelled'`/`'failed'` 문자열을 직접 비교하고, 후자 둘은 모듈 스코프 `TYPE_TO_EVENT` 로 매핑해 기존 `ExecutionEventType.EXECUTION_*` enum 값과 비교한다. 두 방식 모두 정확하지만 같은 파일 안에서 "무엇이 나갔는가"를 검증하는 두 관용구가 섞여 있어, 새로 이 파일을 보는 사람은 어느 쪽이 표준인지 헷갈릴 수 있다.
  - 제안: 급하지 않음 — 전자는 옛 원시 `type` 비교가 더 단순해 그대로 둬도 무방하나, 후속에서 이 파일을 다시 만질 일이 있으면 한쪽으로 통일을 고려.

## 요약

핵심 변경(`TerminalEventPayload` 판별 union + `emitTerminalExecution` 파사드, 11개 직접 호출부 이관)은 가독성·네이밍·함수 길이·중첩 깊이 모두 양호하다. 판별 union 각 variant 의 JSDoc 이 "왜 이 필드가 필수인가"를 근거(#1170/#1171/retry-turn 결함)와 함께 명시해 의도가 코드에서 바로 읽히고, `emitTerminalExecution` 자체도 단일 책임(형태 판별 → wire 조립 → 위임)으로 짧고 명확하다. `17_54_32` 라운드가 지적한 클래스 JSDoc 삭제·`TYPE_TO_EVENT` 중복·판별력 미검증 3건은 모두 코드 레벨에서 실제로 해소된 것을 직접 확인했다(클래스 docstring 복구, 모듈 스코프 단일 상수화, `@ts-expect-error` + 타입 래칫 근거 정정). 남은 것은 순수 INFO 3건 — 분기 내 한 줄 표현식 중복, cancelled 에러의 익명 인라인 타입, 테스트 파일 내 두 검증 관용구 공존 — 이며 모두 문서화된 의도적 트레이드오프 위에 놓인 사소한 다듬기 여지라 시급성이 없다. 종결 emit idiom(`if(completed){...}`)이 execution-engine.service.ts 여러 곳에 반복되는 더 큰 중복은 이미 `spec-sync-external-interaction-api-gaps.md` 에 별도 항목(2026-08-15 등재, W5·W6)으로 추적 중이라 이번 라운드의 신규 발견으로 세지 않았다.

## 위험도
LOW
