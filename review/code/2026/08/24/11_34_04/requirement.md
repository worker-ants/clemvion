# 요구사항(Requirement) 충족 검토 — `envelope.output` allowlist 확장 (`node-output-envelope-458f05`)

## 검토 범위 및 방법

32개 변경 파일 중 실질 코드는 `websocket.service.ts`(구현)·`websocket.service.spec.ts`(테스트)
2개뿐이고, 나머지는 CHANGELOG·plan·이전 라운드(`11_05_39` 코드리뷰·`10_44_28` consistency-check)
산출물·spec(EIA §R17, WS §4.1/§4.4, `conventions/conversation-thread.md`)이다. 이번 diff 는
**이미 한 라운드의 코드리뷰(`11_05_39`, W1 JSDoc / W2 CHANGELOG 비대칭 / W3 emit 개수 오류)가
지적하고 그 RESOLUTION(커밋 `990a61e61`)이 처리한 결과물**까지 포함한 누적 diff다.

프롬프트 예산 절단으로 전체 컨텍스트가 실리지 않아, 다음을 저장소에서 직접 `Read`/`Grep`/실행으로
독립 재검증했다:

- `codebase/backend/src/modules/websocket/websocket.service.ts` 전체 — `narrowTopLevelNodeOutput`/
  `allowlistFanoutNodeOutput`/`toFanoutEnvelope`/`emitExecutionEvent`/`emitNodeEvent` 배선.
- `codebase/backend/src/shared/utils/node-output-allowlist.ts` 전체 — 13키 allowlist, 컴파일타임
  `assertAllowlistCoversHandlerContract` 결속.
- emit 사이트 6곳 실측: `grep -rn "output: nodeExec"` 로 `execution-engine.service.ts:6120,6381` ·
  `form-interaction.service.ts:344` · `button-interaction.service.ts:581` ·
  `ai-turn-orchestrator.service.ts:1541,1636` 확인 — **정확히 6곳**, 문서(spec/plan/JSDoc) 전체에
  `"5곳"` 잔존 문자열 없음(`grep` 0건) — W3 정정이 다섯 자리(코드 JSDoc 2 · spec 1 · plan 2)에
  전부 반영됨.
- 버튼 재개 record 분석 재현: `button-interaction.service.ts:503` `setNodeOutput(...)` 은
  in-memory `nodeOutputCache` 만 갱신하고, `nodeExec.outputData`(line 542)에는
  `buildResumedStructuredOutput(...)` 반환값이 대입됨을 직접 확인 — 그 함수 시그니처(line 250)의
  반환 타입은 `NodeHandlerOutput`(`{config, output, port, status, meta?}`), 전부 allowlist 안.
  plan/spec 의 실 DB 조회 근거(`node_execution.output_data` 93행 중 84 object, top-level 키
  `meta`/`config`/`output`/`port`/`status`/`conversationConfig` 뿐)와 코드상 도달 가능한 shape 이
  일치한다.
- `execution.completed`/`.failed`/`.cancelled`(execution-level 종결 이벤트, node-level 아님)는
  `execution-event-emitter.service.ts` 의 `emitTerminalExecution` 이 조립하며 `output` 키를 전혀
  쓰지 않음(`status`/`durationMs`/`error`/`result.cancelledBy` 뿐)을 확인 — 새 `output` 필터가
  이 표면과 충돌하거나 의도치 않게 걸릴 위험 없음.
- 내부 WS 불변 확인: `emitExecutionEvent`/`emitNodeEvent` 모두 `broadcastToChannel(wireEnvelope)`
  가 `toFanoutEnvelope(...)` 호출(및 그 안의 `allowlistFanoutNodeOutput`) **이전**에 실행됨을
  코드 순서로 재확인(line 334-353, 408-420).
- `npx jest websocket.service.spec.ts` 직접 4회 실행 → **62/62 통과**(1회차만 stale jest 캐시로
  추정되는 2건 실패가 있었으나 `--clearCache` 후 재실행 포함 3연속 62/62 GREEN, 재현 불가 —
  코드 결함으로 보지 않음, 발견사항에 포함하지 않음).
- `grep -rn "TODO\|FIXME\|HACK\|XXX"` — 두 코드 파일 모두 0건.

## 발견사항

- **[INFO]** 알려진 잔여 위험(`finalAdapted ?? nodeOutputCache` flat 폴백)은 이번 PR 스코프 밖으로
  적절히 분리·추적됨 — 조치 불요
  - 위치: `plan/in-progress/spec-sync-external-interaction-api-gaps.md:190-202`(게이트, 신규 등재
    항목), `codebase/backend/src/modules/websocket/websocket.service.spec.ts:994-1029`(게이트,
    `[잔여 고정]` 캐너리)
  - 상세: `ai-turn-orchestrator.service.ts` 의 `finalAdapted ?? context.nodeOutputCache[node.id]`
    폴백이 `outputData` 에 flat view(`{parameters: {}}` 류)를 쓰면 이 PR 이 건 allowlist 가 그
    목록 밖 키(`parameters`/`items` 등)를 조용히 떨어뜨린다. e2e 285건 실측에서는 미발현이지만
    코드 경로로는 살아 있다. "그 shape 이 오면 떨어지는 것이 fail-closed 의 정의"라는 현재 동작을
    캐너리로 명시 고정하고, "flat view 를 `outputData` 로 영속하는 것이 옳은가"라는 더 근본적인
    질문(영속 계약 변경)은 별건 트래커 항목으로 정확히 분리했다. 요구사항 관점에서 스코프 판단이
    타당하다 — 이 PR 의 목적(egress 강도 통일)과 그 별건(영속 계약)을 섞지 않았다.
  - 제안: 없음(이미 적절히 처리).

- **[INFO]** API 계약 spec(EIA §R17 / WS §4.1·§4.4) 을 developer 소유 plan 커밋 안에서 직접
  수정한 절차적 쟁점은 같은 세션의 `/consistency-check --impl-prep`(`10_44_28`)이 이미 CRITICAL
  로 잡아 `RESOLUTION.md`(반박+수용)로 처분했고, 실질 spec 본문은 구현과 line-level 로 일치함을
  위 "검토 범위 및 방법"에서 독립 재확인했다
  - 위치: `plan/in-progress/node-output-envelope.md:8-20`(frontmatter `spec_impact` 두 블록),
    `review/consistency/2026/08/24/10_44_28/RESOLUTION.md`
  - 상세: `spec_impact` 는 (1) API 계약 문서 2개(`14-external-interaction-api.md`,
    `6-websocket-protocol.md`) — "(planner 턴)"으로 plan 체크리스트에 명시해 같은 PR 안에서
    처리(`#1204`·`#1208` 선례), (2) `conversation-thread.md` — CLAUDE.md 자기-반증형 소정정 예외
    (developer 자신이 쓴 상태 예고 문장을 실측으로 반증)로 나뉘어 있다. 커밋 이력상
    `e6a017a18`(구현)→`970cac5cf`(spec 갱신 — planner 턴 처리)→`990a61e61`(코드리뷰 W1~W3 fix)
    로 분리돼 있어 관심사가 커밋 단위로 나뉘어 있다. 절차 판단 자체는 이미 별도 게이트에서
    검토됐으므로 이 requirement 리뷰가 다시 여는 사안은 아니고, 다만 spec 내용이 실제로 코드와
    일치하는지(9번 관점)는 이 리뷰의 소관이라 직접 대조했다 — EIA §R17 정정 블록의 실 DB 조회
    표(6행), 6곳 emit breakdown, WS §4.1 의 래퍼/도메인값 구분 서술 모두 코드 실측과 정확히
    일치한다.
  - 제안: 조치 불요.

- **[INFO]** `finalAdapted` 폴백 외에, execution-level 종결 이벤트(`execution.completed`/`.failed`/
  `.cancelled`)에 `output` 이 실리지 않아 새 필터와 충돌 여지가 없음을 코드로 재확인 — 확인만
  - 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts`
    의 `emitTerminalExecution`(`TerminalEventPayload`/`TERMINAL_SHAPE` 정의부)
  - 상세: `wire = {status, durationMs}` 에 `failed` 는 `error`, `cancelled` 는
    `result: {cancelledBy}`(+선택적 `error`)만 추가되고 `output` 키는 어떤 분기에도 없다. `getStatus`
    REST 의 terminal `result`(작성자 정의 워크플로 출력, deny-list 의도적 유지)와도 다른 표면이라,
    이번에 확장된 `envelope.output` allowlist 가 의도치 않게 이 종결 이벤트를 건드릴 위험은 없다.
  - 제안: 조치 불요(회귀 없음의 근거로 기록).

## 관점별 결론

1. **기능 완전성**: `23_29_27` cross_spec CRITICAL(잔여 `envelope.output` deny-list)이 정확히
   닫혔다 — `narrowTopLevelNodeOutput(envelope, 'output')` 배선이 `toFanoutEnvelope` 단일
   chokepoint 안에서 실행되므로 `emitExecutionEvent`/`emitNodeEvent` 두 경로 모두 커버된다.
2. **엣지 케이스**: `value === null || typeof value !== 'object'` 가드로 결측·`null`·원시값·배열을
   그대로 통과시킨다(억지 좁힘으로 렌더가 비는 것을 방지) — 확인됨.
3. **TODO/FIXME**: 두 변경 파일에 0건.
4. **의도와 구현 간 괴리**: 없음 — 이전 라운드(`11_05_39`)가 지적한 stale JSDoc(리팩터 후 옛
   함수 설명이 새 헬퍼 위에 남은 것)은 현재 코드에서 두 개의 독립 JSDoc(`narrowTopLevelNodeOutput`
   전용/`allowlistFanoutNodeOutput` 전용)으로 이미 분리돼 반영돼 있다.
5. **에러 시나리오**: 해당 없음(순수 in-memory 필터, throw 경로 없음) — 적절.
6. **데이터 유효성**: `allowlistNodeOutputKeys` 가 객체 여부·배열 여부를 먼저 판별해 잘못된
   억지 강제(`{}` 로 뭉개기)를 하지 않는다.
7. **비즈니스 로직**: fail-closed egress 정책(REST `getStatus` 와 SSE/fanout 강도 통일)이 정확히
   구현됐고, `NODE_OUTPUT_ALLOWED_KEYS` 가 `NodeHandlerOutput` 공개 키에 컴파일타임 결속돼 있어
   향후 핸들러 공개 키 추가 시 자동으로 이 목록의 재검토를 강제한다(구조적 안전망).
8. **반환값**: `narrowTopLevelNodeOutput`/`allowlistFanoutNodeOutput` 모두 모든 경로에서
   `Record<string, unknown>` 을 반환하며(copy-on-change), undefined 반환 경로 없음.
9. **spec fidelity**: EIA §R17 정정 블록(6행 실측 표·6곳 emit breakdown·"외부 수신자에게는 동작
   변경" 고지), WS §4.1(`execution.node.completed`/`.failed` 양쪽에 래퍼/도메인값 구분 + `.failed`
   행 `output` 열 신규 추가), WS §4.4(잔여 문장 취소선+2026-08-24 해소 정정),
   `conventions/conversation-thread.md` §8.4(자기-반증형 소정정, 조건 1~5 형식 충족) 전부를
   코드 실측과 대조해 **line-level 로 일치**함을 확인했다. 불일치 발견 없음.

## 이전 라운드 이후 상태 변화 확인 (재검증)

`11_05_39` 코드리뷰의 W1(JSDoc 분리 누락)·W2(CHANGELOG breaking-change 고지 비대칭)·W3("emit
5곳"→실제 6곳) 3건 모두, 그 RESOLUTION.md 의 서술대로 커밋 `990a61e61` 에서 실제 소스/문서에
반영됐음을 이번 라운드에서 **직접 파일을 열어** 재확인했다(추정이 아니라 실측) — `narrowTopLevelNodeOutput`
전용 JSDoc 존재, CHANGELOG 2026-08-24 블록에 "외부 수신자에게는 동작 변경이다" 문구 존재, 전체
저장소에 `"emit 5곳"` 잔존 0건.

## 요약

`execution.node.completed`/`.failed` 의 `envelope.output` 을 기존 fail-closed allowlist 로 닫는
이번 변경은 대상 요구사항(`23_29_27` cross_spec CRITICAL 해소)을 완전히 충족한다. 핵심 기술
주장(버튼 재개 flat record 는 `nodeOutputCache` 에만 남고 `outputData` 에는 `NodeHandlerOutput`
shape 만 대입된다)을 소스 레벨에서 직접 재검증했고 사실과 일치했다. 이전 코드리뷰 라운드가 지적한
3건(WARNING)이 이번 diff 시점에는 전부 코드/문서에 반영돼 있음을 재확인했고, spec(EIA §R17,
WS §4.1/§4.4, conversation-thread.md)과 코드가 line-level 로 어긋나는 지점을 발견하지 못했다.
`npx jest websocket.service.spec.ts` 직접 실행으로 62/62 GREEN 을 확인했다(1회 관측된 2건 실패는
캐시 재현 불가 — 코드 결함 아님). 남은 것은 이미 캐너리+트래커로 적절히 격리된 잔여 위험
(`nodeOutputCache` flat 폴백) 뿐이며 이번 PR 스코프 밖 판단이 타당하다. CRITICAL/WARNING 급
결함을 발견하지 못했다.

## 위험도

LOW
