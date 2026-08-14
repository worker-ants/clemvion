# 정식 규약 준수 검토 — spec-draft-eia-62-waiting-payload.md

## 검토 대상
`plan/in-progress/spec-draft-eia-62-waiting-payload.md` (`--spec` 모드). 비교 대상:
`spec/conventions/swagger.md`, `spec/conventions/error-codes.md`,
`spec/conventions/node-output.md`, `spec/conventions/interaction-type-registry.md`
을 직접 열람했고, target이 반복 인용하는 `spec/5-system/2-api-convention.md`(§1·§5.3·
§5.4)도 원문 대조했다(이 파일은 `spec/conventions/**` 바깥이지만 target 인용의 정확성
검증을 위해 열람). 실제 spec 본문(`14-external-interaction-api.md` §6.2~§6.5·§R17,
`6-websocket-protocol.md` §4.4)과 emit 코드 4곳(`button-interaction.service.ts`·
`ai-turn-orchestrator.service.ts`)도 직접 대조했다.

이 문서는 이미 8라운드(`09_38_17`~`15_06_43`)의 checker 피드백을 흡수했고, 직전 라운드
(`15_06_43`)의 convention_compliance WARNING 2건 — (a) `error.code` 부재 표현
(`null` vs 키 생략) 미결정, (b) `turnDebug` 이름 충돌이 landed 될 위험 — 은 현재
target 에서 **모두 명시적으로 해소됐음을 확인**했다: (4)에 "부재 표현은 `null`" 문장이
추가됐고, `turnDebug` 는 "이 draft 의 범위에서 제외로 확정"(별건 재등재)으로 닫혔다.

fresh pass 로 아래 1건의 신규(미보고) 갭을 발견했다.

## 발견사항

- **[WARNING]** `status` 필드가 §6.2 재작성 범위 전체에서 완전히 누락 — gap-analysis 표에도, blockquote 매핑에도, "의도된 스코프 밖" 버킷에도 없음
  - target 위치: `## 실측 — waiting_for_input emit 4곳 전수`의 "공통 8" 목록 vs
    `### 현행 §6.2 와의 대조` 표 vs `### (3) "SSE 필드명 매핑" blockquote 정정`
  - 위반 규약: 명시적으로 `spec/conventions/*.md` 한 항목을 위반하는 것은 아니나,
    같은 문서(`14-external-interaction-api.md`) §6.3/§6.4 가 이미 확립한
    "종결 이벤트의 필드 집합(normative)" 패턴 — "이 표가 전부다. 아래에 없는 필드는
    발송되지 않는다" — 과 `6-websocket-protocol.md:394`의 "WS 내부 부가 식별자
    (waitingNodeType/waitingNodeLabel/nodeExecutionId/startedAt)는 본 §4.4 가
    소유한다"는 명시적 오너십 선언 패턴에 비추면, 이 draft 가 완성한 뒤에도 §6.2 는
    그 두 문서가 실천하는 "실제 wire 필드를 빠짐없이 계정한다"는 관행에서 벗어난
    상태로 남는다. target 자신의 Overview 도 "봉투를 틀리게 적어 두면 그대로 파서를
    짠 쪽이 실패한다"고 선언하는데, 봉투뿐 아니라 **필드 누락**도 같은 문제를 만든다.
  - 상세: target 의 "실측 — waiting_for_input emit 4곳 전수" 절이 스스로 열거한
    "공통 8" 필드는 `status`·`waitingNodeId`·`waitingNodeType`·`waitingNodeLabel`·
    `nodeExecutionId`·`startedAt`·`interactionType`·`conversationThread` 이다. 실제
    코드로 재확인했다 — `button-interaction.service.ts:400`·
    `ai-turn-orchestrator.service.ts:575`(및 `:990`) 모두 emit 객체 최상위에
    `status: ExecutionStatus.WAITING_FOR_INPUT`(`= 'waiting_for_input'`)를 담고,
    `notification-fanout.service.ts:134` 가 `payload: event.payload` 로 변환 없이
    감싸므로 이 필드는 SSE·webhook 양쪽 wire 에 실제로 실린다.
    그런데 target 의 "현행 §6.2 와의 대조" 표는 실측 8개 필드 중 `status` 하나만
    빼고 나머지 7개(`waitingNodeId`·`waitingNodeType`·`interactionType`·
    `conversationThread` = 문서화 대상, `waitingNodeLabel`·`nodeExecutionId`·
    `startedAt` = "의도된 스코프 밖"으로 명시 배정)를 전부 계정한다. `status` 는
    두 버킷 어디에도 배정되지 않고 조용히 표에서 빠졌다. (3)의 blockquote 재작성
    제안도 기존 6개 매핑 화살표(`node.id`→`waitingNodeId` 등)만 다루고 `status` 를
    추가하지 않는다. 결과적으로 이번 정정을 그대로 반영해도 §6.2 문서는 실제로
    발송되는 최상위 필드 하나를 여전히 설명하지 않는 채로 남는다 — §6.3/§6.4 가
    같은 이벤트 계열에서 `status` 를 정본 필드로 명시 취급하는 것과 대비된다.
    (완화 요인: 참조 구현 `channel-web-chat/src/lib/eia-events.ts` `parseWaitingForInput`
    은 이 필드를 소비하지 않으므로 — grep 재확인, 매치 0건 — 즉각적인 파서 실패
    위험은 낮다. 그러나 그 사실 자체가 문서화돼 있지 않다.)
  - 제안: (3)의 blockquote 매핑에 `status`(top-level, 항상 `"waiting_for_input"`
    literal — §6.3/§6.4 의 `completed`/`failed`/`cancelled` 값과 병렬) 행을
    추가하거나, WS §4.4 가 소유한 "내부 전용" 필드로 명시 등재해 "언급 없음" 상태를
    벗어나게 할 것. 어느 쪽이든 "현행 §6.2 와의 대조" 표에 `status` 행을 신설해
    실측 8개 필드가 표에서 전수 계정되도록 한다.

## 다른 항목 — 재확인만 (신규 이슈 아님, 이미 해소됨)

- (4) `error.code` 부재 표현 = `null`(형제 `nodeId` 관례 일치) — `15_06_43` W6 해소 확인.
  `2-api-convention.md §5.4` 원문("기본은 `null`. 필드별로 근거가 있어야 한다")과
  일치.
- `turnDebug` 이름 충돌 — 이 draft 범위에서 명시적으로 제외("범위 확정형" 처분),
  "spec 반영 7항목" 카운트 밖으로 분리 유지. `15_06_43` W7/naming_collision CRITICAL
  해소 확인.
- (2) URL 예시 상대경로 정정 — `2-api-convention.md §1`("버전은 URL 경로에 포함하지
  않음") 및 §4.1 실제 스타일(`/api/external/executions/{id}/...`)과 정합. 정확.
- (5) `1-data-model.md §2.14` — 현재 `{ nodeId: "uuid", code: "ERROR_CODE", message }`
  로 nullable 미반영 확인(직접 열람, line 562) — target 의 정정 제안이 정확.
- swagger.md §1-4 "닫힌 union vs 열린 map" 원칙과 (2)의 `interaction` 블록 Planned
  표기·(3)의 caveat 유지 방향이 상충하지 않음 — `context`/`nodeOutput` 을 열어 두는
  것은 §1-4 의 "SoT 이중화 회피" 예외 취지와 일치.
- 문서 구조(Overview → 실측/변경 제안 → Rationale → 체크리스트) + frontmatter
  (`worktree`/`started`/`owner` 필수 3필드 + `spec_impact` 리스트 형식)는
  CLAUDE.md·plan-lifecycle.md §4 그대로 준수. `spec_impact` 3경로
  (`14-external-interaction-api.md`/`1-data-model.md`/`6-websocket-protocol.md`)
  모두 실존 확인.

## 요약

target 은 정식 규약을 정면 위반하는 신규 패턴을 도입하지 않으며, 직전 라운드가
지적한 convention_compliance WARNING 2건을 모두 명시적으로 해소했다. 이번 fresh
pass 에서 새로 찾은 것은 1건 — `status` 최상위 필드가 target 자신의 실측 데이터에
등장함에도 gap-analysis 표·blockquote 재작성 어느 쪽에도 반영되지 않아, (3) 적용
후에도 §6.2 문서가 실제 wire 필드 하나를 계속 설명하지 못하는 상태로 남는다는
점이다. 참조 구현이 그 필드를 소비하지 않아 즉각적 파괴력은 낮지만, 이 PR 의 목표
("봉투를 틀리게 적으면 파서가 실패한다")와 §6.3/§6.4 가 실천하는 완전 열거 관행에
비추면 문서화 공백으로 남겨두지 않는 편이 안전하다.

## 위험도
LOW
