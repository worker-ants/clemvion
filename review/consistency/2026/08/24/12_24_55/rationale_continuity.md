# Rationale 연속성 검토 — `node-output-envelope-458f05`

## 검토 범위 및 방법 메모

prompt_file 의 번들은 컨텍스트 예산 초과로 target 문서(`spec/conventions/node-output.md`)
본문과 `<git diff origin/main...HEAD -- code_areas>` 가 모두 절단돼 있었다. 대신 실제
워크트리(`/Volumes/project/private/clemvion/.claude/worktrees/node-output-envelope-458f05`,
현재 CWD 와 동일)에서 `git diff origin/main...HEAD` 로 1차 근거를 직접 확보해 검토했다.
실제 변경 파일은 5개다: `spec/5-system/14-external-interaction-api.md`,
`spec/5-system/6-websocket-protocol.md`, `spec/conventions/chat-channel-adapter.md`,
`spec/conventions/conversation-thread.md`, `spec/5-system/15-chat-channel.md`
(+ `codebase/backend/src/modules/websocket/websocket.service.ts` 및 `.spec.ts`).
`spec/conventions/node-output.md` 자체는 이번 diff 에 포함되지 않았다(태스크명과 달리
실제 변경 범위는 SSE/fanout envelope 쪽).

## 변경 내용 요약

이 PR 은 `#1208`(선행 작업)이 2026-08-23 에 `SSE/fanout waiting_for_input` 표면만 닫고
`execution.node.completed`/`.failed` 의 `envelope.output` 은 "이종 payload 라 같은
allowlist 를 걸 수 없다"며 의도적으로 유예(deny-list 잔존)했던 결정을, 실 DB 조회
(e2e 285건 teardown 전 조회)로 그 유예 근거 자체를 반증하고 같은 allowlist 로 마저 닫는다.

## 발견사항

### [INFO] provider spec 3곳(`output.rendered`)이 이번 PR 의 "래퍼/도메인값 재정정"을 아직 반영하지 않음

- target 위치: 이번 PR 범위 밖 — `spec/4-nodes/7-trigger/providers/telegram.md:160`,
  `discord.md:256`, `slack.md:233` (CCH-MP-06 fallback 행, `output.rendered`)
- 과거 결정 출처: 이번 PR 이 `spec/conventions/chat-channel-adapter.md` §1.3 JSDoc·§3
  매핑표와 `spec/5-system/15-chat-channel.md` CCH-MP-06 행에 새로 박아 넣은 정정 —
  "wire 최상위 `output` 은 `NodeHandlerOutput` 래퍼 전체이고 도메인 값은 한 겹 아래인
  `output.output`이다" (`spec/5-system/6-websocket-protocol.md` §4.1 2026-08-24 정정,
  `12_02_30` cross_spec W1)
- 상세: 같은 CCH-MP-06 규약을 구현하는 세 provider 문서가 여전히 구 표현(`output.rendered`)
  을 쓴다. 실제로는 `extractRendered` 헬퍼가 `rendered → payload.rendered → output.rendered`
  세 후보를 순회해 동작 자체는 어느 shape 이든 깨지지 않지만, 이 세 문서의 문장이 "정정 전
  이해"(래퍼 언랩 이전)를 그대로 담고 있어 정정된 시스템 불변식과 문면상 불일치한다. 이는
  이번 세션이 `RESOLUTION.md`(`12_13_36`)에서 스스로 인정한 "같은 파일/형제 문서 미러 스윕
  누락" 결함군의 연장선에 있는 표면이다(세 라운드 연속 발생 이력 자기-기록).
- 완화 사실 확인: 이 갭은 은폐되지 않고 `plan/in-progress/spec-sync-external-interaction-api-gaps.md:204-210`
  에 "provider spec 3곳의 `output.rendered` 가 wire 래퍼 기준인지 미확정" 항목으로 명시
  등재돼 있고, `RESOLUTION.md` INFO 1 이 "단정하지 않고 등재 — 표의 다른 행과 함께 봐야
  갈리므로 이 PR 의 `spec_impact` 밖" 이라 명확히 이유를 남겼다. 즉 **결정의 무근거 번복이
  아니라 근거 있는 스코프 분리**다.
- 제안: 별도 조치 불필요(이미 트래커에 등재·추적 중). 다음에 이 트래커 항목을 처리할 때
  "노드가 무엇을 만드나" vs "렌더러가 어디서 읽나" 두 해석 중 어느 쪽을 문서 문장의 주어로
  삼을지 provider 코드(`extractRendered` 호출부)를 먼저 확인해 갈래를 특정할 것.

## 정합성 확인 — 위반 없음으로 판단한 항목들

- **`nodeOutput` `type` 판별자 재도입 여부**: [`6-websocket-protocol.md` Rationale C3](../../../../spec/5-system/6-websocket-protocol.md)
  는 "노드 종류는 상위 `payload.nodeType` 로 식별되므로 `nodeOutput` 내부 `type` 판별자는
  불필요·중복(Presentation 공통 Principle 1.1.4 위반이라 기각)"이라 명시 기각했다. 이번 PR 은
  `output`/`nodeOutput` 필드가 **이미 존재하던** `NodeHandlerOutput` 5필드 래퍼(`config`,
  `output`, `meta?`, `port?`, `status`)임을 재확인·재문서화할 뿐, 새 판별자 필드를 도입하지
  않는다 — C3 결정과 충돌 없음(오히려 그 결정을 강화).
- **결정 번복 시 새 Rationale 동반 여부**: `#1208` 의 "이종 payload 라 같은 목록을 걸 수
  없다" 유예를 뒤집으면서, `spec/5-system/14-external-interaction-api.md` §R17 재정정
  블록·`spec/5-system/6-websocket-protocol.md` §4.4 캐비엇·`spec/conventions/conversation-thread.md`
  §8 정정 블록 세 곳 모두 **취소선으로 원문을 보존**하고 반증 근거(실 DB 조회 결과 표)를
  동봉했다. 이는 CLAUDE.md 규약 및 이 저장소 관례(과거 결정을 삭제하지 않고 취소선+사유로
  덮어씀)를 정확히 따른다 — 위반 없음.
- **단일 sink(R10) 원칙**: 변경은 `WebsocketService.toFanoutEnvelope` 단일 chokepoint 안에서만
  이뤄지고 새 emit 경로를 추가하지 않는다 — 원칙 유지.
- **정본 트래커 동기화**: `plan/in-progress/spec-sync-external-interaction-api-gaps.md:136-191`
  의 해당 항목이 취소선 + "해소(2026-08-24)"로 갱신돼 있고, spec 본문의 잔여 표(§R17)·코드
  주석(`websocket.service.ts`)·plan(`plan/complete/node-output-envelope.md`) 세 갈래가
  서로 모순 없이 같은 결론(6곳 emit, 전부 allowlist 안, `ai-turn-orchestrator` 캐시 폴백만
  잔여 위험으로 캐너리 고정)을 가리킨다.
- **자기-반증형 소정정 절차 준수**: `conversation-thread.md` 정정은 developer 자신이
  `#1208`에서 쓴 예고 문장을 실측으로 반증한 경우에 한정되고(CLAUDE.md 5조건), 나머지
  4개 spec 파일은 명시적으로 "planner 턴" 취급되어 `plan/complete/node-output-envelope.md`
  frontmatter `spec_impact` 에 그 구분이 정확히 주석으로 남아 있다.

## 요약

이번 diff 는 선행 결정(`#1208`)의 유예를 번복하지만, 번복 사유(실 DB 조회로 반증된 전제)를
취소선 보존 + 새 Rationale 로 3개 문서(EIA §R17, WS §4.4, conversation-thread §8)에 일관되게
기록했고, 정본 트래커·코드 주석·plan 문서가 서로 어긋나지 않는다. 과거 명시 기각 결정
(C3 판별자 폐지, R10 단일 sink)과도 충돌하지 않으며 오히려 강화한다. 유일하게 남는 것은
provider spec 3곳(`telegram.md`/`discord.md`/`slack.md`)이 이번 정정을 아직 반영하지 못한
문면상 지연인데, 이는 은폐된 drift 가 아니라 근거를 남기고 별도 트래커에 명시 등재된
의도적 스코프 분리다.

## 위험도

LOW
