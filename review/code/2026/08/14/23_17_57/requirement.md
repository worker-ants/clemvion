# 요구사항(Requirement) 리뷰 — EIA §6.4 종결 `error` payload 객체화

## 발견사항

- **[WARNING]** `[SPEC-DRIFT]` §6 필드 표(`error` 행)는 이번 diff로 "전 경로 object" 로 갱신됐는데, 바로 아래 §6.4 payload 블록의 캐비엇은 갱신되지 않아 같은 문서 안에서 자기모순이 남았다.
  - 위치: `spec/5-system/14-external-interaction-api.md:572`(갱신됨: "`failed` 는 **전 경로 object** 다 … 종전의 '일부 경로는 string' 캐비엇 해소") vs 같은 파일 `:792-793`(미갱신: "**`error` 는 현행 일부 경로에서 string 이다** — 위 객체 형태가 목표이고, 수신자는 당분간 양쪽을 방어해야 한다. 필드 집합 표의 `error` 행 참조.")
  - 상세: 이번 PR은 §6.4 payload 블록 바로 위 콜아웃(`code` nullable 근거, `:782-785`)은 정정했지만, 그 여덟 줄 아래에 있는 두 번째 캐비엇(`:792-793`, "현행 일부 경로에서 string")은 손대지 않았다. 그런데 그 문장은 자신이 "필드 집합 표의 `error` 행 참조" 라고 명시적으로 스스로를 그 표에 묶어 두었고, 정작 그 표(`:572`)는 이번 diff로 "전 경로 object" 로 바뀌어 정반대를 말한다. 실제 코드(본 리뷰에서 `execution-engine.service.ts`/`retry-turn.service.ts` 의 4개 `EXECUTION_FAILED` emit 지점 전부가 `toTerminalErrorPayload` 를 거치는 것을 확인)는 표(`:572`)가 맞다 — 즉 "코드가 틀린" 게 아니라 **spec 본문 내부의 두 서술이 서로 어긋난 채로 남은 것**이다. `git log -S` 로 확인한 결과 `:792-793` 문장은 이 PR 이전(2026-08-13, `9a4d3e32b`)부터 있던 캐비엇이고, 이번 PR이 정확히 그 문장이 가리키는 갭을 닫으면서도 그 문장 자신은 갱신하지 않았다 — 이 저장소가 반복 등재해 온 "절반만 잡았다" 패턴의 재발이다.
  - 제안: 코드 fix 대상이 아니라 spec 정정 대상(권한 밖) — `project-planner` 턴에서 `:792-793` 을 삭제하거나 `:572` 와 같은 문구("failed 는 전 경로 object")로 교체할 것. planner 는 같은 문서 안에서 `error` 필드를 서술하는 다른 지점(§6 필드 표, §6.4 콜아웃 2개, 필요하면 §11/§12)을 전수 grep 해 재발을 막을 것.

- **[INFO]** 핵심 기능(4개 `EXECUTION_FAILED` emit 지점의 `toTerminalErrorPayload` 정규화)은 spec §6.4·타입·런타임 세 층위가 실측상 정확히 일치한다.
  - 위치: `codebase/backend/src/modules/execution-engine/terminal-error-payload.ts:36-82`(`TerminalErrorPayload`/`toTerminalErrorPayload`), 호출부 `execution-engine.service.ts:664`·`:3314`·`:4872`, `retry-turn.service.ts:966`(grep 으로 4곳 전수 확인), 소비 타입 `chat-channel/types.ts:395-408`(`EiaFailedEvent.error` — `code: string | null`, `message: string`, `nodeId?: string | null`, `details?: unknown`), spec `spec/5-system/14-external-interaction-api.md:765-780`(§6.4 jsonc 예시 — 동일 4필드).
  - 상세: `Execution.error` 엔티티 컬럼이 실제로 `@Column({ type: 'jsonb', nullable: true }) error: Record<string, unknown>` (`codebase/backend/src/modules/executions/entities/execution.entity.ts:80-81`)로 nullable jsonb 임을 확인했고, 헬퍼의 `null`/`undefined` 조기 처리가 이와 정합한다. `chat-channel/shared/execution-failure-classifier.ts:105-143` 을 직접 읽어 `code: null` → `event.error?.code ?? ''` → 어느 `*_CODES` Set 에도 `''` 가 없어 unknown-fallback(`executionFailedInternal` + warn 로그)으로 떨어지는 것을 확인했다 — 이전 `'INTERNAL_ERROR'` 도 동일하게 세 Set 에 없어 같은 분류 결과였음을 대조 확인, dispatcher/헬퍼 주석의 주장과 실제 동작이 일치한다.

- **[INFO]** 프런트엔드 소비자(`use-execution-events.ts`)가 실제로 갱신돼 있고, 캐스팅이 아니라 타입 내로잉으로 object/string 양쪽을 안전하게 처리한다 — 직전 라운드(22_55_51)의 CRITICAL(side_effect.md)이 실측상 해소됨.
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:253-279`(`handleExecutionFailed`) — `payload.error` 를 `string | { message?: string } | null` 로 타이핑하고 `typeof payload.error === "string" ? payload.error : payload.error?.message` 로 내로잉한 뒤 `failExecution`/`flushPendingToolItemsAsError` 에 항상 `string | undefined` 만 전달한다. 대응 회귀 테스트 `codebase/frontend/src/lib/websocket/__tests__/use-execution-events.test.ts:1140-1159` 가 object 입력 시 스토어에 문자열만 들어가는 것을 고정한다.
  - 상세: `handleExecutionCancelled`(`:281-284`)는 서버 payload 를 전혀 파싱하지 않고 고정 문자열만 쓰므로, 아직 헬퍼 미적용인 `execution.cancelled` 의 `error` object shape 은 이 경로에 영향을 주지 않는다 — 스코프 제외가 실제로 안전함을 확인.

- **[INFO]** `execution.cancelled` 미커버 범위가 코드·plan·spec 세 층위에서 일관되게 문서화돼 있다(SPEC-DRIFT 아님 — 의도된 범위 축소이고 spec 표(`:572`)에도 그 상태 그대로 반영돼 있다).
  - 위치: `terminal-error-payload.ts:1-9`(JSDoc이 명시적으로 "현재 호출부는 EXECUTION_FAILED 4곳뿐" 이라 스코프를 좁혀 둠), `plan/in-progress/eia-terminal-payload.md`(재판정 ③-c, durationMs 와 같은 비용 그룹으로 이연), spec `:572`("cancelled 는 아직 {code, message}를 손으로 만들어 nodeId/details 가 없다").
  - 상세: `EiaCancelledEvent.error`(`chat-channel/types.ts:421`, `{ code: string; message?: string }`)가 §6.4 목표 형태보다 좁은 것은 실측 확인했으나 이번 PR 스코프 밖으로 명시적으로 이연됐고 세 문서가 일치해 오도 위험이 낮다. 조치 불요.

## 요약

핵심 요구사항(EIA `execution.failed` 의 `error` 를 문자열에서 spec §6.4 object 계약으로 통일)은 4개 emit 지점 전부·소비 타입·프런트엔드 소비자·회귀 테스트까지 실측으로 일관되게 구현돼 있고, 직전 라운드(22_55_51)가 찾은 CRITICAL(프런트 미갱신으로 인한 React 렌더 크래시)도 같은 diff 안에서 실제로 해소된 것을 코드 레벨에서 재확인했다. TODO/FIXME/HACK 류 미완성 마커는 없다. 유일하게 남는 새 발견은 spec 자체의 내부 불일치다 — §6 필드 표(`:572`)는 "failed 는 전 경로 object" 로 이번 PR로 정정됐지만, 같은 문서 §6.4 payload 블록의 두 번째 캐비엇(`:792-793`, "현행 일부 경로에서 string")은 정정되지 않은 채 남아 서로 모순된 서술이 공존한다. 실제 구현은 표(`:572`)가 맞으므로 코드 결함은 아니고, spec 정정(권한 밖, planner 턴)이 필요한 documentation 결함이다.

## 위험도

LOW
