# 요구사항(Requirement) 충족 리뷰 — llmCalls 외부 fanout depth-1 strip 결함 수정

## 발견사항

- **[WARNING]** 신규 회귀 테스트의 JSDoc 이 "고쳐지기 전" 동작을 "현재형(present tense)"으로 서술해, 같은 diff 가 방금 바꾼 production 코드의 JSDoc 과 자기모순을 일으킨다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.spec.ts:636-639`
  - 상세: `it('waiting_for_input 의 중첩 turnDebug.llmCalls 도 외부 fanout 에 남으면 안 된다', ...)` 바로 위 JSDoc 이 "**strip 은 최상위 전용이다**" · "`stripExternalOnlyFields` 는 ... **depth-1 shallow delete** 한다(그 함수 JSDoc 이 명시)" 라고 현재형으로 단언한다. 그런데 같은 diff 가 바로 그 "함수 JSDoc"(`websocket.service.ts:303` 부근)을 "Strip 은 **깊이 무관**이다" 로 이미 바꿔놓았다. 즉 이 테스트 주석이 인용하는 근거(그 함수 JSDoc)는 이 diff 가 착지하는 순간 더 이상 그 내용을 담고 있지 않다 — production 파일(`websocket.service.ts:305`)은 같은 사실을 "**종전엔** top-level 전용(depth-1)이었고" 로 과거형·역사적 각주로 정확히 처리했는데, 테스트 파일의 동일 서술은 그 처리를 하지 않았다.
  - 제안: `stripExternalOnlyFields 는 ... depth-1 shallow delete 한다(그 함수 JSDoc 이 명시)` → `stripExternalOnlyFields 는 (고치기 전) depth-1 shallow delete 였다` 식으로 과거형으로 정정. 그대로 두면 이 테스트 파일만 따로 읽는 후속 개발자가 "strip 은 여전히 top-level 전용" 이라고 오인하고 새 필드를 top-level 에만 추가하는 재발 패턴을 유발할 수 있다.

- **[WARNING]** `plan/in-progress/spec-draft-eia-62-waiting-payload.md` 의 "다음 (별건)" 체크리스트가 이 diff 가 실제로 완료한 작업을 반영하지 못한 채 전부 미체크로 남아 있고, 문서가 "유력"이라 적어둔 처방과 실제 구현이 다르다.
  - 위치: `plan/in-progress/spec-draft-eia-62-waiting-payload.md:132-137` (`### 다음 (별건)` 체크리스트)
  - 상세: 이 plan 은 "처방 후보: (a) `stripExternalOnlyFields` 를 깊이 우선으로 (b) waiting emit 이 `turnDebug` 를 외부용에서 빼기 (c) 최상위 필드명을 strip 목록에 추가. **(a) 는 비용이 크고 (c) 는 이름 충돌을 고착**시키므로 **(b) 가 유력**" 이라고 명시적으로 결론 내렸다. 그런데 실제 구현(`websocket.service.ts` 의 `stripDeep`)은 정확히 **(a)** 를 택했다 — plan 이 "유력"으로 지목한 (b) 가 아니다. 동시에 체크리스트 3항목("실증 테스트", "처방 적용", "이름 충돌 정리")이 모두 `[ ]` 로 남아 있는데, 첫 항목("실증 테스트: AI turn1 waiting 이벤트의 외부 fanout payload 에 turnDebug.llmCalls 가 남는지 단언")은 이번 diff 의 새 테스트 2건이 정확히 그 일을 이미 수행했다.
  - 제안: (a) 를 택한 이유(클론-온-라이트로 할당 비용은 회피했으나 순회 비용은 여전함 — 아래 INFO 참조)를 plan 에 짧게 기록하고, 완료된 체크박스를 갱신. plan 체크박스가 실제 상태를 반영하지 않으면 이후 세션이 "아직 안 됐다"고 오판해 중복 작업하거나, 반대로 "유력안(b)이 채택됐을 것"이라 오판할 위험이 있다.

- **[INFO]** `stripDeep` 도입으로 `emitExecutionEvent`/`emitNodeEvent` 매 호출마다 payload 전체를 무조건 재귀 순회하게 됐다 — 이전엔 top-level 키 존재 여부만 `O(1)` 로 확인했다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:336-374` (`stripExternalOnlyFields` → `stripDeep`)
  - 상세: JSDoc 의 clone-on-write 설명("제거할 게 없으면 새 객체를 만들지 않고 입력을 그대로 반환")은 **할당(allocation)** 비용만 없앤다 — 트리 전체를 실제로 방문하는 **순회(traversal)** 비용은 여전히 발생한다. 같은 파일에 `SANITIZE_CACHE`(WeakMap)가 "ForEach 가 같은 config 를 5,000회 emit" 하는 케이스의 CPU 비용을 명시적으로 신경 쓰고 있는데, `stripDeep` 은 이미 `sanitizePayloadForWs` 가 한 번 순회한 뒤에도 매 이벤트마다 envelope 전체를 한 번 더 순회한다(node 이벤트가 고빈도인 대형 ForEach 시나리오 포함). plan 자체가 "(a) 는 비용이 크다"고 이미 지목했던 지점이라, 실측/벤치마크 근거가 diff 어디에도 없는 점이 아쉽다.
  - 제안: 필수 fix 는 아니지만, 고빈도 node 이벤트 경로(대형 ForEach)에서 실측 프로파일링 권장. 문제 없으면 그대로 두어도 됨 — correctness 결함은 아님.

- **[INFO]** 필드명 기반 깊이-무관 strip 은 payload 트리 어디든 키 이름이 우연히 `llmCalls` 인 값을 전부 제거한다 — 워크플로 사용자가 변수명을 `llmCalls` 로 지정한 노드 출력(예: Set Variable, HTTP 응답 바디)이 있으면 그 값도 조용히 사라진다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:349-374` (`stripDeep`)
  - 상세: 이는 코드 자체 JSDoc(`:313`)에서 "필드명 자체가 문서화된 비밀 마커이므로, 위치를 열거하는 대신 이름으로 막는다"고 의식적으로 받아들인 트레이드오프라 결함은 아니다. 다만 향후 `result.outputs`(같은 worktree 의 `plan/in-progress/eia-terminal-payload.md` 가 추적 중인 종결 payload 확장)가 실제 노드 출력을 외부로 노출하기 시작하면 이 충돌 표면이 실질적으로 열린다는 점을 남겨둔다.
  - 제안: 조치 불요(현행 트레이드오프 수용 가능). `result.outputs` 노출 작업 착수 시 재점검 권장.

## Spec 정합성 검증 (긍정 확인)

`stripDeep` 이 구현하는 "깊이 무관 strip" 은 spec 세 곳과 line-level 로 일치를 직접 확인했다 — 수정 전 코드는 이 세 spec 문서의 선언을 위반하고 있었고(코드가 틀림, spec 이 권위), 이번 diff 가 정확히 그 위반을 해소한다. SPEC-DRIFT 아님.

- `spec/5-system/6-websocket-protocol.md:519` — "`llmCalls` 는 ... **모든 외부 fanout 수신자** — external-interaction SSE ... notification webhook, chat-channel 아웃바운드 ... — 에서는 strip 된다." (주석의 `:519` 인용과 실제 줄 번호 일치 확인)
- `spec/5-system/14-external-interaction-api.md:754` (§6.5) — "debug 전용 `llmCalls` 필드 ... fanout seam 에서 제거되어 외부 수신자(본 SSE 스트림 포함)에는 전달되지 않는다."
- `spec/5-system/15-chat-channel.md:76` (CCH-MP-01) — "debug 전용 `llmCalls` 필드는 ... fanout seam 에서 strip 되어 어댑터(`ChatChannelDispatcher`)에 도달하지 않는다."

세 문서 모두 "예외 없이 strip" 을 선언하는데, 수정 전 `stripExternalOnlyFields` 는 top-level 키만 검사해 `turnDebug.llmCalls.llmCalls[].requestPayload`(`ai-turn-orchestrator.service.ts:615-617`)와 `nodeOutput.meta.turnDebug[].llmCalls[]`(`ai-conversation-helpers.ts:97` `buildConversationMetaFromResumeState` — 직접 열어 `turnDebug: state.turnDebugHistory ?? []` 확인)두 경로 모두 새고 있었다. `stripDeep` 은 두 경로 모두 이름 매칭으로 제거한다 — 코드로 직접 확인(아래 검증 방법 참조).

## 기능/엣지 케이스 검증

- **배열**: `stripDeep` 이 배열은 `map` 으로 재귀하고 변경 없으면 원본 참조 반환 — identity 보존 확인.
- **null / 비-object**: `value === null || typeof value !== 'object'` 조기 반환 — 정상.
- **순환 참조**: 명시적으로 다루지 않음(JSDoc 이 인정) — 다만 `stripDeep` 은 `sanitizePayloadForWs`(선행 호출, `MAX_SANITIZE_DEPTH=10` 로 깊이 상한)이 만든 결과에 대해서만 호출되므로 실질적으로 깊이가 이미 유계 상태에서 진입한다. 진짜 순환이면 `sanitizePayloadForWs` 단계에서 이미 깊이 상한에 걸려 끊긴다 — 실사용 경로에서 stack overflow 위험은 낮음.
- **자매 함수 전수 확인**: `executionEventSubject.next(...)` 호출은 `emitExecutionEvent` / `emitNodeEvent` 둘뿐이고 둘 다 `stripExternalOnlyFields` 를 거친다 (`:524`, `:595`). 외부 소비자 3곳(`sse-adapter.service.ts`, `notification-fanout.service.ts`, `chat-channel.dispatcher.ts`) 모두 동일한 `executionEvents$` 단일 스트림만 구독 — 강 chokepoint 확인, 새는 자매 경로 없음.
- **반환값**: `stripDeep` 모든 분기(배열/null/비객체/객체)가 값을 반환 — 반환 누락 경로 없음.
- **TODO/FIXME**: diff 내 없음.

## 테스트 실행 검증

`npx jest src/modules/websocket/websocket.service.spec.ts` 전체 실행 — **32/32 통과** (신규 2건 포함). 논리적으로도 구 코드(top-level 키만 검사)라면 두 신규 테스트의 `SECRET PROMPT A/B` 문자열이 wire 에 남아 실패했을 것임을 코드 추적으로 확인.

(리뷰 중 이 워크트리에서 `websocket.service.ts` 가 순간적으로 구버전(depth-1)으로 변경된 상태를 한 번 관측했으나, 뒤이은 `git status`/`git diff` 재확인에서 즉시 clean 상태로 복귀했다 — 동일 워크트리를 공유하는 별도 프로세스의 뮤테이션 테스트 왕복으로 보이며, 최종 커밋 상태(`81f2c60d6`)와는 무관해 별도 finding 으로 등재하지 않음.)

## 요약

핵심 변경(`websocket.service.ts` 의 `stripExternalOnlyFields`/`stripDeep`)은 실제로 존재했던 CRITICAL 급 정보 유출(에디터 전용 raw LLM system prompt/대화이력이 `turnDebug.llmCalls.llmCalls[]` 및 `nodeOutput.meta.turnDebug[].llmCalls[]` 두 중첩 경로로 SSE/webhook/chat-channel 외부 수신자에게 도달)을 정확히 해소하며, WS §4.4·EIA §6.5·chat-channel CCH-MP-01 세 spec 문서의 기존 선언과 line-level 로 일치한다(코드가 틀렸던 것을 spec 에 맞게 고침, SPEC-DRIFT 아님). 자매 emit 경로·외부 소비자 3곳 전수 확인 결과 새는 곳 없음, 테스트 32/32 실제 통과 확인. 다만 (1) 신규 테스트의 JSDoc 이 고치기 전 동작을 현재형으로 서술해 production 파일과 자기모순을 일으키는 점, (2) 연관 plan 문서가 "유력"으로 지목한 처방과 실제 구현이 다른데 체크리스트·근거가 갱신되지 않은 점은 WARNING 으로 수정 권장. 순회 비용 증가와 필드명 충돌 리스크는 문서화된 트레이드오프로 INFO 수준.

## 위험도
LOW
