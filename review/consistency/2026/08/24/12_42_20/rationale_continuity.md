# Rationale 연속성 검토 — `node-output-envelope-458f05`

## 검토 범위 및 방법 메모

prompt_file 번들은 컨텍스트 예산 초과로 target 문서 상당수와
`<git diff origin/main...HEAD -- code_areas>` 가 절단돼 있었다. 실제 워크트리
(`/Volumes/project/private/clemvion/.claude/worktrees/node-output-envelope-458f05`, 현재 CWD 와 동일)에서
`git diff origin/main...HEAD` 로 1차 근거를 직접 재확보해 검토했다. 실제 변경 spec 파일은 5개다 —
`spec/5-system/14-external-interaction-api.md`, `spec/5-system/6-websocket-protocol.md`,
`spec/5-system/15-chat-channel.md`, `spec/conventions/chat-channel-adapter.md`,
`spec/conventions/conversation-thread.md` (+ `codebase/backend/.../websocket.service.ts`
및 `.spec.ts`, plan 파일들).

이 세션은 같은 diff 에 대해 오늘 이미 4라운드 (`10_44_28`→`12_02_30`→`12_13_36`→`12_24_55`)
consistency 검토를 거쳤고, 직전 라운드(`12_24_55`)가 낸 cross_spec CRITICAL(`.failed` 의
`error` 필드 서술 오류)은 최신 커밋(`20ec30308`)에서 취소선 보존 + 실측 4곳 전수 + 프런트
결함 인과까지 기록해 해소됐음을 diff 로 직접 확인했다. `12_24_55` rationale_continuity 자체
결과(LOW, INFO 1건)도 대조 확인했다.

## 변경 내용 요약

이 PR 은 `#1208`(선행 작업, 2026-08-23)이 `SSE/fanout waiting_for_input` 표면만 닫고
`execution.node.completed`/`.failed` 의 `envelope.output` 은 *"이종 payload 라 같은
allowlist 를 걸 수 없다"* 며 의도적으로 유예(deny-list 잔존)했던 결정을, 실 DB 조회
(e2e 285건 teardown 전 조회)로 그 유예 근거 자체를 반증하고 같은 allowlist 로 마저 닫는다.
그 과정에서 `.failed` 이벤트의 `error` 필드가 "항상 구조화 객체" 라는 종전 서술이 실측(emit
4곳 전수)에 반증돼 함께 정정됐다.

## 정합성 확인 — 위반 없음으로 판단한 항목

- **`#1208` 유예의 번복 — 새 Rationale 동반 확인**: `spec/5-system/14-external-interaction-api.md`
  §R17 재정정 블록, `spec/5-system/6-websocket-protocol.md` §4.1/§4.4 정정,
  `spec/conventions/conversation-thread.md` §8 정정, `plan/complete/node-output-envelope.md`,
  `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 다섯 곳 모두 **취소선으로
  원문 보존 + 반증 근거(실 DB 조회 표: `meta`83·`config`82·`output`81·`port`20·`status`7·
  `conversationConfig`1, flat record 0행) + "왜 틀렸었나" 교훈**을 동봉했다. 결정 번복이 무근거로
  이뤄지지 않았다.
- **`nodeOutput` 판별자 재도입 여부**: [`6-websocket-protocol.md` Rationale C3](../../../../spec/5-system/6-websocket-protocol.md)
  는 "노드 종류는 상위 `payload.nodeType` 로 식별되므로 `nodeOutput` 내부 `type` 판별자는
  불필요·중복" 이라 명시 기각한 바 있다. 이번 PR 은 기존 `NodeHandlerOutput` 5필드 래퍼
  (`config`/`output`/`meta`/`port`/`status`)를 재확인·재문서화할 뿐 새 판별자를 도입하지
  않는다 — 위반 없음.
- **`llmCalls` strip-only 결정과의 관계**: WS Rationale "`llmCalls` 외부 수신자 strip" 항목은
  *"값-레벨 마스킹으로 대체하지 않는다"* 는 기각을 유지한 채 병존한다고 명시한다. 이번 PR 이
  도입한 `envelope.output` allowlist 는 `meta` 를 통째로 허용하고(그 안의 `llmCalls` strip 은
  별도 필드-단위 strip 유틸이 담당) 그 결정을 건드리지 않는다.
- **R10 단일 sink 원칙**: 변경은 `WebsocketService.toFanoutEnvelope` 단일 chokepoint 안에서만
  이뤄지고 새 emit 경로를 추가하지 않는다 — 유지.
- **R-wontdo-rawws-rest / R-CC-16(chat-channel outbound webhook 화이트리스트 비확장)**: 이번
  diff 는 그 어느 쪽도 재론·재도입하지 않는다(webhook §6.1 화이트리스트 5종 불변, in-band WS
  갱신 미도입 유지).
- **내부 WS 불변 원칙**: `envelope.output` allowlist 는 fanout(외부)에만 적용되고
  `toFanoutEnvelope` 호출 시점에 내부 WS wire 는 이미 나간 뒤라는 기존 설계(strip-only 결정의
  "에디터 디버깅 가치 보존" 근거)가 코드·spec·테스트(`websocket.service.spec.ts` 의 "내부 WS 는
  안 바뀐다" 단언) 세 층에서 일관되게 재확인된다.
- **CONVENTIONS Principle 3.2(`node-output.md`, `output.error` 표준 형태)와의 관계**: 이번
  `.failed` 정정("top-level `error` 는 문자열, 구조화 객체는 `output.output.error` 에만")은
  Principle 3.2 자체(`NodeHandlerOutput.output.error` 의 shape 정의)와 충돌하지 않는다 —
  오히려 WS 문서가 그 Principle 을 잘못된 wire 위치(top-level)에 잘못 인용하던 것을 정정해
  두 문서 간 정합을 회복했다. Principle 3.2 본문은 이번 diff 에서 변경되지 않았고 변경할
  필요도 없다.
- **트래커·plan·코드 삼중 동기화**: `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
  의 해당 항목이 취소선 + "해소(2026-08-24)" + 실측 근거로 갱신돼 있고, 새로 발견된 두 잔여
  (ai-turn-orchestrator flat 폴백 잠재 경로, `system_error` 배너 프런트 결함)는 각각 캐너리
  테스트로 현 동작이 고정된 채 별도 항목(🔴 포함)으로 등재돼 스코프 밖 처리 사유가 남아 있다 —
  "안 고친 이유" 가 은폐가 아니라 명시 기록이다.

## 발견사항

이번 라운드에서 신규로 지적할 Rationale 연속성 위반은 없다. 직전 라운드(`12_24_55`)가 남긴
유일한 INFO(provider spec 3곳의 `output.rendered` 미반영)는 이번 diff 에서도 여전히 미반영
상태이나, 이미 트래커(`plan/in-progress/spec-sync-external-interaction-api-gaps.md`)에
"단정하지 않고 등재 — planner 턴 스코프 밖" 으로 명시돼 있어 반복 지적하지 않는다(근거 있는
스코프 분리, 은폐된 drift 아님).

- **[INFO] `.failed` 프런트 결함(`system_error` 배너 미표시)의 spec 정정과 코드 수정 간 시차**
  - target 위치: `spec/5-system/6-websocket-protocol.md` §4.1 `.failed` 행 정정 blockquote
    ("이 문구가 프런트 결함을 낳았다")
  - 과거 결정 출처: 해당 blockquote 자신이 인과를 명시 — 종전 spec 문구를 프런트 코드가
    신뢰해 결함이 발생했다는 자기 진단
  - 상세: spec 은 이미 정정됐고 원인-결과 인과까지 기록했지만, 그 결함을 낳은 프런트 코드
    (`use-execution-events.ts` `extractNodeErrorPayload`)는 이번 PR 범위에서 고치지 않고
    별도 트래커(🔴)로 미뤘다. Rationale 연속성 관점에서 이 자체는 위반이 아니다 — spec 과
    구현이 불일치할 때 spec 을 실측대로 먼저 정정하고 구현 정정은 스코프를 분리한 것은 이
    저장소가 반복적으로 채택해 온 절차와 일치한다(범위 분리 근거도 명시: UI 동작 변경 +
    fixture 교체 동반).
  - 제안: 별도 조치 불필요. 다음 세션이 그 🔴 항목을 집행할 때 이번 PR 이 남긴 착수 지침
    (`extractNodeErrorPayload(payload.error, payload.output)` + `nested` 2단 접근 + `CT-S9`/`CT-S10`
    fixture 교체)을 그대로 따르면 된다.

## 요약

이 PR 은 선행 결정(`#1208`)의 유예를 번복하지만, 취소선 보존 + 실측 근거(실 DB 조회 결과) +
"프록시를 재고 유예 결론을 냈다" 는 명시적 교훈을 다섯 개 문서(spec 3곳 + plan 2곳)에 일관되게
기록했다. 과거 명시 기각 결정(C3 판별자 폐지, R10 단일 sink, `llmCalls` strip-only,
R-wontdo-rawws-rest, R-CC-16)과 충돌하지 않고, 오히려 CONVENTIONS Principle 3.2 와 WS 문서 간의
기존 오정합(top-level `error` shape 오인용)을 함께 바로잡았다. 새로 발견된 두 잔여 위험(flat
폴백 잠재 경로, 프런트 배너 결함)은 캐너리로 현 동작을 고정하고 트래커에 등재한 뒤 스코프 밖으로
분리했다는 사유가 문서에 남아 있어 "무근거 미룸" 에 해당하지 않는다. 신규 CRITICAL/WARNING
없음.

## 위험도

LOW
