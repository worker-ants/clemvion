# 요구사항(Requirement) 코드 리뷰

## 리뷰 범위 및 방법

핵심 기능 변경은 EIA 종결 이벤트(`execution.failed`)의 `error.message`/`error.details` 를 WS/SSE/outbound
webhook 으로 내보내기 전 `deepRedactSecrets` 로 값-패턴 secret 마스킹하는 하드닝이다(`redactTerminalError`
신설, `toTerminalErrorPayload` 의 4개 반환 지점 전부에 배선). 나머지 파일 대부분(`review/code/2026/08/16/09_51_00/**`,
`review/code/2026/08/16/10_19_30/**`, `review/consistency/2026/08/16/{09_25_29,10_19_31}/**`)은 이 변경에
대한 **선행 리뷰·consistency-check 라운드의 산출물**이며 이번 라운드의 대상 코드가 아니다. 다음을 직접
`Read`/`Grep`/`Bash` 로 실측해 프롬프트의 주장을 독립 검증했다:

- `codebase/backend/src/shared/utils/terminal-error-payload.ts`, `.spec.ts`,
  `codebase/backend/src/modules/execution-engine/sanitize-error-message.ts`, `sanitize-error-message.ts`(shared) 전문 Read
- `npx jest terminal-error-payload.spec.ts` — **26/26 PASS** (plan 의 "26/26" 주장과 일치)
- `npx tsc --noEmit` — 두 대상 파일 관련 신규 타입 오류 없음
- `grep -rn "toTerminalErrorPayload("` 전체 저장소 — 호출부 정확히 5곳(`execution-engine.service.ts:668,3400,5030`
  · `retry-turn.service.ts:1001` · `chat-channel.dispatcher.ts:551`), JSDoc 의 "5곳 전부 emit 쪽, DB write 0" 주장과 일치
- `grep -rn "sanitizeErrorMessage("` 전체 저장소 — 호출부 정확히 3곳(모두 `channel: 'in_app'|'email'|'both'` 알림 조립 지점), JSDoc 의 "3곳뿐, webhook 0건" 주장과 일치
- `spec/5-system/14-external-interaction-api.md` §6.4·R17 본문 직접 대조
- `emitCancellationEvent` 5개 호출부(execution-engine.service.ts) 직접 열람 — `error: {code, message}` 가 전부 **고정 리터럴**(`'Execution cancelled: queue wait time exceeded'` 등)이지 raw 예외 텍스트가 아님을 확인. security.md 의 "취소 경로는 현재 안전, 향후 raw 메시지 유입 시 우회 표면" INFO 주장이 정확함을 재확인
- `websocket.service.ts` — WS emit 이 SSE/`NotificationDispatcher`(outbound webhook)의 단일 fanout 관문임을 확인, 마스킹된 payload 가 세 표면 모두에 동일하게 전달됨(내부 신뢰 채널도 같은 값 공유)
- `CHANGELOG.md`/`plan/in-progress/eia-terminal-error-sanitize.md` 현재 상태 — 두 곳 모두 "§3.1" 로 정정 완료(이전 라운드가 지적한 "§3.3" 오표기는 이번 diff 시점에 이미 해소됨을 확인)
- `plan/in-progress/eia-terminal-error-sanitize.md:153`, `plan/in-progress/spec-sync-external-interaction-api-gaps.md:164` — 잔여 갭·R17 카탈로그 후속 항목이 실제로 등재돼 있음을 확인

## 발견사항

- **[SPEC-DRIFT]** EIA §R17 "표면 제약(보안)" 마스킹 카탈로그와 §6.4 페이로드 절이 이번에 신설된 5번째 egress 마스킹 지점(`execution.failed`/시스템 `execution.cancelled`/chat-channel 종결 `error.message`·`error.details`, `toTerminalErrorPayload` → `redactTerminalError`)을 아직 반영하지 않는다
  - 위치: `spec/5-system/14-external-interaction-api.md` R17 "표면 제약(보안)" 불릿 목록(1414행 부근, `conversationThread`/`execution.ai_message`/`nodeOutput.conversationConfig`+terminal `result`/`error`/`nodeOutput` 일반 키 4항목만 열거) 및 §6.4 `error` 필드 정의(770~786행, 마스킹 언급 없음). 코드 측 대응: `codebase/backend/src/shared/utils/terminal-error-payload.ts` 함수 `redactTerminalError`(게이트 107)
  - 상세: R17 은 이 spec 파일 안에서 "egress 시점에 어떤 필드가 어떤 마스킹을 강제로 거치는가"를 카탈로그화하는 정본 인벤토리 역할을 해 왔고, 실제로 이 PR 이 도입한 마스킹은 아키텍처상 완전히 같은 계열(egress-only, `SECRET_LEAK_PATTERNS`/`deepRedactSecrets` 기반)의 네 번째가 아니라 **다섯 번째 인스턴스**다. `spec_impact: none` 판단(§6.4 가 새니타이즈를 애초에 "요구"하지 않으므로 계약 위반이 아니다)은 그 자체로는 타당하지만, "계약 위반이 아니다"와 "R17 카탈로그가 완전하다"는 서로 다른 주장이다 — 코드는 spec 본문과 모순되지 않지만(따라서 CRITICAL 은 아니다), spec 이 실제 구현이 강제하는 보안 불변식을 아직 열거하지 않는다는 점에서 코드가 spec 보다 앞서 있다.
  - 판정 근거: 이는 실수가 아니라 의도된 아키텍처 선택(egress 초크포인트 재사용)이 만든 정당한 확장이며, plan(`eia-terminal-error-sanitize.md:153`)이 이미 "planner 턴 — EIA §R17 마스킹 카탈로그에 5번째 항목 등재" 로 정확히 이 gap 을 등재해 두었다. developer 는 `spec/` 쓰기 권한이 없어 코드에서 되돌릴 항목도 아니다.
  - 제안: 코드 변경 불필요. `project-planner` 턴에서 `spec/5-system/14-external-interaction-api.md` R17 불릿에 다섯 번째 항목("`execution.failed`/시스템 `execution.cancelled`/chat-channel 종결 `error.message`·`error.details`, `toTerminalErrorPayload`, 자격증명 패턴 한정, 잔여 갭은 `spec-sync-external-interaction-api-gaps.md` 참조")을 추가하고, §6.4 페이로드 절에도 "2026-08-16 부터 값-패턴 마스킹 적용(형태 불변)" note 를 붙일 것. 이미 `plan/in-progress/eia-terminal-error-sanitize.md` "후속" 섹션에 등재돼 있으므로 별도 조치 없이 그 항목을 그대로 집행하면 된다.

- **[INFO]** `execution.cancelled`(시스템 취소) 의 `error` 는 여전히 `toTerminalErrorPayload`/마스킹 경로를 거치지 않는다 — 현재는 안전하나 구조적으로 열려 있는 우회 표면
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `emitCancellationEvent` 5개 호출부(예: `markQueueWaitTimeout`, `markWebChatIdleTimeout`, `markExecutionCancelled`) 모두 `error: { code, message }` 를 손으로 조립. 대응 JSDoc: `codebase/backend/src/shared/utils/terminal-error-payload.ts:8-9`
  - 상세: 직접 5개 호출부를 열어 확인한 결과 `message` 는 전부 `'Execution cancelled: queue wait time exceeded'` 류의 **고정 문자열**이거나 `code` 파생 값이지 `err.message` 원문이 아니다. 따라서 이번 마스킹 미적용이 오늘 시점에 실제 secret 유출로 이어지지 않는다는 코드 리뷰의 결론(이미 security.md INFO 로 등재)이 실측과 일치한다. 다만 이 취소 경로에 향후(취소 사유를 상세화하는 리팩터 등) raw 예외 메시지가 흘러들면, 그 즉시 이번에 막은 것과 동일한 클래스의 유출이 마스킹 없이 재발한다 — `toTerminalErrorPayload` 를 거치지 않는 구조 자체가 남아 있기 때문이다.
  - 제안: 이번 PR 의 범위(plan "범위 밖" 절이 명시적으로 취소 경로를 제외)를 벗어나므로 차단 사유 아님. 이미 알려진 후속(비용 그룹이 다른 별건, `durationMs` 취소 통일과 동일 그룹)이라 별도 조치 불필요.

- **[INFO]** `chat-channel.dispatcher.ts:551` 은 이미 마스킹된 payload 를 `toTerminalErrorPayload` 로 재정규화해 이중 마스킹이 발생하나, 기능적으로는 no-op(멱등)이다
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts:551`(`toTerminalErrorPayload(errorRaw)`) — `errorRaw` 는 엔진이 emit 시점에 이미 `redactTerminalError` 를 거친 `event.payload.error` 값
  - 상세: `SECRET_LEAK_PATTERNS`/`CREDENTIAL_KEY_PATTERN` 이 마스킹 결과 문자열 `***` 자체에 재매칭될 형태가 아니므로(Bearer/JWT/URI-userinfo/`key=value` 어느 패턴도 `***` 를 다시 잡지 않음) 두 번째 통과는 값을 바꾸지 않는다 — 기능적 결함 없음, 순수 재계산 비용만 존재. 이미 이전 라운드(side_effect.md)가 "이중 마스킹 idempotent"로 언급하고 무조치 처리한 것과 같은 결이다.
  - 제안: 조치 불요.

## 확인한 항목 (문제 없음, 실측 기준)

- `toTerminalErrorPayload` 의 4개 반환 분기(문자열 레거시 / 스칼라(number·boolean·bigint) / non-object / 객체) **전부**가 `redactTerminalError()` 를 거친다 — 소스 레벨 직접 확인, 코드 리딩상 "한 곳만 빠뜨린다"는 이 저장소의 반복 실패 형태가 이번엔 발생하지 않음.
- `code`/`nodeId` 는 spread 로만 전달되고 `deepRedactSecrets` 를 거치지 않는다 — §6.4 "값 공간이 닫혀 있다"는 설계 근거와 일치. `details === null`(명시적)과 `details === undefined`(부재)를 구분해 §6.4 optional 표현을 정확히 지킨다(`p.details === undefined` 엄격 비교이므로 `false`/`0`/`''`/`null` 등 falsy-but-defined 값도 올바르게 보존).
- DB write 경로(execution-engine.service.ts / retry-turn.service.ts 의 `row.error =` / `savedExecution.error =` 대입부)는 이번 diff 로 변경되지 않았다 — 마스킹은 emit 5곳에만 적용되고 DB 원본은 보존된다(EIA §R17 egress-only 원칙과 일치, spec 본문과 모순 없음).
- `TerminalErrorPayload` 인터페이스·`toTerminalErrorPayload` 시그니처 불변 — 기존 5개 호출부가 재컴파일·타입 오류 없이 그대로 동작.
- 테스트 26/26 PASS(직접 실행 확인), `null`/`undefined`/falsy `details`/JSON 형태 `message`/스칼라 3종/타입 불일치 `code`·`nodeId`·`message` 등 엣지 케이스가 실측 코드 동작과 일치하는 값으로 단언됨.
- `sanitize-error-message.ts`(execution-engine) 변경은 docstring 정정뿐이며 로직·정규식·호출부 무변경 — 문서 서술(적용 범위 3곳/알림 채널 한정)이 실제 3개 호출부의 `channel` 값과 일치함을 직접 확인.
- CHANGELOG/plan 의 "§3.3" 오표기(선행 리뷰 라운드가 지적)는 이번 diff 최종 상태에서 이미 "§3.1"로 정정 완료됨을 확인 — 재지적 대상 아님.
- TODO/FIXME/HACK/XXX 마커 없음(변경 대상 3개 소스 파일 grep 확인).

## 요약

핵심 변경(`redactTerminalError` 도입, `toTerminalErrorPayload` egress 초크포인트에 배선)은 5라운드에 걸친 선행 코드 리뷰·2라운드의 consistency-check 가 이미 매우 촘촘히 검증했고, 이번 라운드에서 소스·테스트·spec 본문을 직접 열어 독립 재검증한 결과 JSDoc·CHANGELOG·plan 의 정량적 주장(호출부 수·테스트 통과·§ 인용·마스킹 대상 등) 전부가 실제 코드와 정확히 일치했다. 기능 완전성·엣지 케이스(§6.4 부재 표현 null/키생략 구분, details null vs undefined, falsy 값 보존)·반환값·에러 시나리오는 모두 코드에 반영돼 있고 테스트로 고정돼 있다. 유일하게 남는 것은 이미 developer 권한 밖(spec/ 쓰기 불가)으로 plan 에 정확히 등재된 SPEC-DRIFT 하나(R17 카탈로그·§6.4 note 가 이번 신규 마스킹 지점을 아직 열거하지 않음, "코드가 맞고 spec 이 뒤처짐"에 해당하며 planner 후속으로 이미 추적 중)와, 현재는 안전하지만 구조적으로 열려 있는 취소 경로 비대칭(INFO, 이미 문서화·범위 밖 처리됨)뿐이다. 코드를 되돌리거나 이번 턴에서 추가로 고쳐야 할 CRITICAL/WARNING 급 기능 결함은 발견되지 않았다.

## 위험도
LOW
