# Cross-Spec 일관성 검토 — `spec/5-system/` (--impl-prep, node-output-envelope)

## 컨텍스트 (검토자가 확인한 사실)

- 이번 impl-prep 대상은 `spec/5-system/` 이지만, 실제 워크트리에는 이미
  `codebase/backend/src/modules/websocket/websocket.service.ts` 에 코드 diff 가 존재하고
  (`allowlistFanoutNodeOutput` 이 `nodeOutput` 뿐 아니라 `output` 최상위 키에도
  `allowlistNodeOutputKeys` 를 적용하도록 확장), `plan/in-progress/node-output-envelope.md`
  가 그 작업의 plan 이다.
- plan 은 "#1208(§R17 waiting 표면 fail-closed 화)이 남긴 `envelope.output` 유예의 근거가
  실측(285 e2e + 실 DB 조회)으로 반증됐다"고 주장하며, `plan_impact` 로
  `spec/5-system/14-external-interaction-api.md`·`spec/5-system/6-websocket-protocol.md`
  두 파일만 "planner 턴에서 갱신"으로 등재해 두었다(아직 미집행 — 체크박스 미체크).
- 즉 지금 시점의 `spec/5-system/**`(target) 은 **아직 옛 유예 근거를 그대로 담고 있다** —
  이 상태와 이번에 배선되는 코드 사이의 정합성이 이 리뷰의 핵심이다.

---

## 발견사항

### [CRITICAL] target 문서(WS §4.4) + EIA §R17 이 현재 문서화한 `envelope.output` 계약이 배선 예정 코드와 정면 충돌

- **target 위치**: `spec/5-system/6-websocket-protocol.md` §4.4 "실제 wire 필드명 주의 (fanout envelope)" 캐비엇 —
  > "**`execution.node.*` 의 `envelope.output` 은 이 좁히기 대상이 아니다** — 같은 `outputData` 를
  > 다른 키로 싣는 잔여 표면이며, 그쪽은 이종 payload 라 같은 목록을 걸 수 없다(§R17 정정 블록)."
- **충돌 대상**:
  - `spec/5-system/14-external-interaction-api.md` §R17 표 — `SSE/fanout execution.node.completed/.failed 의 envelope.output | deny-list 유지 (잔여)` 및 그 아래 상세 근거
    ("버튼 재개 record 를 정본 `allowlistNodeOutputKeys` 에 넣으면 `{}` 가 된다… `envelope.output` 은
    `NodeHandlerOutput` 하나가 아니라 이종 payload").
  - `codebase/backend/src/modules/websocket/websocket.service.ts` 의 현재 diff —
    `narrowTopLevelNodeOutput(envelope, 'output')` 을 `allowlistFanoutNodeOutput` 안에서 호출해
    정확히 `envelope.output` 을 `allowlistNodeOutputKeys` 로 좁힌다.
- **상세**: 두 spec 문서(WS §4.4 / EIA §R17)는 서로는 일관되지만(둘 다 "지금은 안 좁힌다"에 합의),
  실측(e2e 285건 + 실 postgres 조회 결과: 93행 전부 `{meta,config,output,port,status,conversationConfig}`
  집합 안, flat record 0건)으로 원래 유예 근거("버튼 재개 flat record 가 `outputData` 가 된다")가
  반증됐다는 것이 이 plan 의 핵심 주장이다. **이 반증이 옳다면** target spec 의 §4.4 캐비엇과
  EIA §R17 표 행은 이제 **틀린 API 계약을 문서화하고 있는 상태**이고, 코드가 먼저 구현을 바꾸면
  그 순간부터 `spec/5-system/**` 는 실제 동작과 어긋나는 문서가 된다.
  CLAUDE.md 의 developer 자기-반증형 소정정 예외(§0)는 "제품 정의·요구사항·**API 계약**은
  해당 없음"이라 명시하므로, 이 정정은 developer 단독으로 할 수 없고 반드시 **planner 턴**이
  필요하다 — plan 이 이미 이를 인지하고 체크리스트에 "(planner 턴) §R17 표의 잔여 행 flip +
  틀린 유예 근거를 취소선으로 정정, WS §4.4 단서 갱신"을 넣어 둔 것은 올바른 처리다.
  다만 **그 planner 턴이 실행되기 전까지는, target 문서(spec/5-system/**)가 곧 배선될 코드와
  모순된 계약을 담은 채로 남는다** — 이 gate 가 통과된 뒤에도 코드 커밋과 spec 정정 사이에
  간극이 남지 않도록(같은 PR 안에서, 혹은 즉시 후속 planner 턴으로) 반드시 닫아야 한다.
- **제안**: 이 작업의 완료 조건에 "코드 병합 전 또는 병합과 동시에 planner 턴으로 §R17 표 flip +
  WS §4.4 캐비엇 정정"을 **하드 게이트**로 유지할 것. 코드만 먼저 머지되고 spec 정정이 뒤로
  밀리는 시나리오(다른 세션이 먼저 머지, 리뷰 지연 등)를 피할 것 — 그 창 동안 `spec/5-system/**`
  전체가 §Cross-Spec 관점에서 자기 모순 상태가 된다.

### [WARNING] spec_impact 누락 — `spec/conventions/conversation-thread.md` §8.4 도 동일한 (이제 반증된) 서술을 갖고 있으나 정정 대상 목록에 없음

- **target 위치**: `plan/in-progress/node-output-envelope.md` frontmatter `spec_impact:`
  (`spec/5-system/14-external-interaction-api.md`, `spec/5-system/6-websocket-protocol.md` 만 등재)
- **충돌 대상**: `spec/conventions/conversation-thread.md` §8.4 (line 392) —
  > "**잔여로 남은 것은 `execution.node.completed`/`.failed` 의 `envelope.output` 하나다** —
  > 같은 `NodeExecution.outputData` 를 **다른 키**로 싣는 표면이고, 이종 payload 라 같은
  > 목록을 걸 수 없다(버튼 재개 record 에 적용하면 `{}` 가 된다, 정본 구현으로 실측)."
- **상세**: 이 문장은 EIA §R17 / WS §4.4 와 **동일한, 이제 이 plan 이 반증한 근거를 그대로
  복제**하고 있다. `conversation-thread.md` §8.4 는 이미 2026-08-23 에 developer 자기-반증형
  소정정으로 한 차례 갱신된 이력이 있는 자리(바로 위 "정정 (2026-08-23, 자기-반증형 소정정)"
  블록)라, 같은 절이 또 한 번 stale 해질 후보라는 신호가 이미 문서 안에 있다. 그럼에도 이번
  plan 의 spec_impact 3항목 요구(§EIA, §WS)에는 이 파일이 빠져 있다 — planner 턴이 plan 에
  적힌 두 파일만 고치면, `conversation-thread.md` §8.4 는 정정된 EIA §R17/WS §4.4 와
  또 어긋나는 **3번째 spec 파일의 잔존 drift**로 남는다("정본 범위 표는 계속 EIA §R17이다"라고
  스스로 위임하고 있어 실질 피해는 크지 않지만, 근거 문장 자체는 여전히 틀린 채로 남는다).
- **제안**: `spec_impact` 에 `spec/conventions/conversation-thread.md` 를 추가하고, planner 턴에서
  §8.4 의 해당 문장도 동일한 취소선 정정 패턴으로 함께 갱신할 것.

### [WARNING] 정정 문구가 "완전히 안전"으로 과잉 서술되지 않도록 — plan 자신이 인정한 잔여 위험(`nodeOutputCache` 폴백)을 spec 정정에도 반영해야 함

- **target 위치**: (예정) planner 턴이 고칠 `spec/5-system/14-external-interaction-api.md` §R17 /
  `spec/5-system/6-websocket-protocol.md` §4.4 / `spec/conventions/conversation-thread.md` §8.4
- **충돌 대상**: `plan/in-progress/node-output-envelope.md` "남은 위험 — `finalAdapted ??
  nodeOutputCache` 폴백" 절
- **상세**: plan 은 `ai-turn-orchestrator.service.ts:1451` 의 `finalAdapted ?? nodeOutputCache`
  폴백이 flat view(`{parameters: {}}` 류)를 `outputData` 로 쓸 수 있는 코드 경로가 **여전히
  살아 있음**을 스스로 인정하고, "285건에서 한 번도 안 나타났다"는 관측적 증거로만 덮은 채
  "캐너리로 현 동작을 고정"하고 별건으로 미룬다. 이는 이 저장소의 알려진 실패 패턴
  ("문서한 보장이 구현보다 넓으면 안 된다" — 안 되는 방향을 먼저 확인해야 한다)에 정확히
  해당하는 상황이다. 만약 planner 턴이 §R17 표 행을 단순히
  "fail-closed allowlist (완전 해소)" 로만 flip 하고 이 잔여 폴백 경로를 언급하지 않으면,
  §R17 은 실제 구현보다 넓은 보장을 다시 약속하게 된다 — 정확히 `envelope.output` 항목이
  겪은 것과 같은 종류의 오류가 같은 절에서 재발하는 셈이다.
- **제안**: planner 턴 정정문에 "`nodeOutputCache` 폴백 경로는 관측(e2e 285건)상 미도달이나
  코드 경로로는 열려 있고, 캐너리(`[잔여]` 테스트)로 고정돼 있다"는 caveat 을 반드시
  동봉할 것 — §R17 의 "적용 범위는 총칭이 아니라 열거다" 원칙과도 부합한다.

### [INFO] WS §4.1 이벤트 필드 표가 `execution.node.failed` 의 실제 `output` 필드를 누락 — 이번 narrowing 대상 범위가 문서만으로는 드러나지 않음

- **target 위치**: `spec/5-system/6-websocket-protocol.md` §4.1 이벤트 목록 표 —
  `execution.node.failed` 행의 payload 는 `{ executionId, nodeId, nodeExecutionId, nodeLabel, error }`
  로만 문서화됨 (`output` 필드 없음)
- **충돌 대상**: 실제 구현 — `execution-engine.service.ts` (error-port 종결 분기, ~line 6372)와
  `ai-turn-orchestrator.service.ts` (~line 1532)의 `NODE_FAILED` emit 은 `error` 와 함께
  `output: nodeExecution.outputData` 를 **함께** 싣는다(EIA §R17 이 언급하는 "5 emit 곳" 중 일부).
- **상세**: 이 필드 자체가 WS §4.1 표에 없다 보니, "`.completed`/`.failed` 의 `envelope.output`"
  이라는 이번 작업·EIA §R17 의 서술이 무엇을 가리키는지 WS 스펙 본문만 봐서는 확인할 수 없다
  (표를 보면 `.failed` 는 `output` 을 안 싣는 것처럼 보인다). 코드 동작과 다른 문서 갭이며,
  이번 PR 이 직접 깨는 계약은 아니지만 같은 §4.4/§R17 을 고치는 planner 턴 김에 §4.1 표에도
  `output` 필드를 추가하는 것이 이 시점의 drift 를 줄인다.
- **제안**: planner 턴 스코프에 WS §4.1 `execution.node.failed` 행 필드 목록 보정을 함께 담을 것
  (필수는 아니나 같은 자리를 두 번 열지 않기 위한 권장).

---

## 확인했지만 문제 없음 (참고)

- **레이어 책임 분리는 유지된다**: 코드 diff 는 `toFanoutEnvelope` 이 만드는 **fanout 전용
  clone** 에만 `allowlistFanoutNodeOutput` 을 적용하고, `gateway.broadcastToChannel` 로 나가는
  내부 WS wire envelope 은 그대로 둔다 — WS §4.4 / EIA §R17 이 명시한
  "내부 WS(에디터)는 대상이 아니다" 불변식과 정합한다.
- **종결 3종(`execution.completed`/`.failed`/`.cancelled`)에 대한 오적용 없음**: 그 3종의
  필드 집합은 EIA §"종결 이벤트의 필드 집합" 에 따라 `result`/`error`/`durationMs`/`status`
  이며 최상위 키 이름이 `output` 이 아니다(`result.cancelledBy`, `result.outputs` 등 항상
  `result` 로 nest). 따라서 이번에 추가된 `narrowTopLevelNodeOutput(envelope, 'output')` 이
  EIA §R17 이 "의도적 제외"로 명시한 `Execution.outputData`(작성자 정의 워크플로 출력,
  terminal `result`)를 오적용해 자를 위험은 없다 — 키 이름 충돌이 구조적으로 없다.

---

## 요약

이번 impl-prep 대상 `spec/5-system/**` 는 현재 그 자신의 §R17/§4.4 텍스트로 "`envelope.output`
은 fail-closed allowlist 대상이 아니다"라고 명시하고 있는데, 같은 워크트리에 이미 그 반대로
동작하도록 배선된 코드 diff 가 존재한다. plan 문서는 이 모순을 스스로 인지하고 실측(e2e+DB
조회)으로 원래 유예 근거를 반증했다고 주장하며, 정정을 "다음 planner 턴"으로 미뤄 두었다 —
이는 developer 가 API 계약을 단독 수정할 수 없다는 프로젝트 규약과 부합하는 올바른 처리다.
다만 (1) 그 planner 턴이 실행되기 전까지 `spec/5-system/**` 전체는 곧 배선될 코드와 정면
모순된 상태로 남으므로 코드 병합과 spec 정정 사이에 간극을 두지 말아야 하고, (2) 정정 대상
목록(spec_impact)에 동일한 반증 대상 문장을 담고 있는 세 번째 파일
(`spec/conventions/conversation-thread.md` §8.4)이 누락돼 있으며, (3) 정정문 자체가 plan 이
이미 인정한 잔여 위험(`nodeOutputCache` 폴백 미해소)을 함께 담지 않으면 "문서한 보장이
구현보다 넓다"는 이 프로젝트가 반복적으로 겪은 함정을 같은 절에서 재현할 위험이 있다.
그 외 레이어 책임 분리·종결 이벤트 필드 충돌 여부는 확인 결과 문제가 없었다.

## 위험도

HIGH
