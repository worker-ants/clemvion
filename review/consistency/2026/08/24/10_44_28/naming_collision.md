# 신규 식별자 충돌 검토 — `spec/5-system/` (--impl-prep, `node-output-envelope` 작업)

## 조사 범위에 대한 메모

프롬프트 번들은 컨텍스트 예산 초과로 `spec/5-system/6-websocket-protocol.md` 본문만
전달되고, `14-external-interaction-api.md` 를 포함한 나머지 16개 spec/5-system 파일과
`검색 대상 코퍼스`(spec/, plan/, conventions/) 95개 파일이 전부 생략됐다. 이 작업의
실제 spec_impact(`plan/in-progress/node-output-envelope.md`)가 `14-external-interaction-api.md`
를 명시하므로, 그 파일과 관련 convention 문서(`conversation-thread.md`)를 직접 `Read`/`grep`
으로 열어 보완했다(프롬프트 자체가 "여기 없다는 사실을 근거로 삼지 말라"고 지시).

target 은 origin/main 대비 **diff 없음** — 이번 --impl-prep 은 아직 spec 을 고치지 않은
상태에서, 착수하려는 코드 변경(`envelope.output` 을 기존 `allowlistFanoutNodeOutput`/
`allowlistNodeOutputKeys` 에 배선)이 기존 식별자 체계와 충돌하지 않는지 사전 점검하는
것이다. 계획 자체가 **기존 함수·기존 13키 목록을 재사용**할 뿐 새 엔티티·이벤트·엔드포인트·
env var·spec 파일 경로를 하나도 새로 만들지 않으므로, 좁은 의미의 "신규 식별자 vs 기존 사용처"
충돌은 없다. 다만 코드를 직접 대조하는 과정에서, 이번 작업이 정확히 다뤄야 하는 경계선에
**기존 식별자 하나(`output`)의 의미 중첩**이 이미 spec 서술 자체를 오독시키고 있고, 그 오독이
바로 이 작업의 전신인 `#1208` 에서 실제로 한 번 발생했던 실수(plan 문서 자백)와 같은 패턴이라
WARNING 으로 등재한다.

## 발견사항

- **[WARNING]** `output` 식별자가 wire envelope 최상위 필드(전체 `NodeHandlerOutput` 래퍼)와
  그 안의 도메인 값(`NodeHandlerOutput.output`) 두 레벨에서 같은 이름으로 쓰이는데, WS spec 의
  서술 자체가 이 두 레벨을 한 겹으로 뭉뚱그려 이번 작업 대상과 충돌한다.
  - target 신규 식별자: 없음(이번 작업은 기존 `allowlistFanoutNodeOutput`/
    `allowlistNodeOutputKeys` 를 `envelope.output` 이라는 **기존** 필드에 세 번째 위치로
    배선할 뿐) — 단, 그 배선이 정확히 겨냥하는 필드의 의미가 spec 서술과 실제 code 사이에서
    갈린다.
  - 기존 사용처:
    - `spec/5-system/6-websocket-protocol.md:187` — `execution.node.completed` 행:
      "`output` 은 `NodeHandlerOutput` 의 `output` 필드 — `output.error` 가 set 된 경우
      … 도 포함". 문면 그대로 읽으면 **wire `output` === `NodeHandlerOutput.output`
      (도메인 값 그 자체)** 로 읽힌다.
    - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:6103,6120`
      (`.completed`) 및 `:6360,6381` (`.failed`): `nodeExecution.outputData = (output …) ?? {}`
      후 `output: nodeExecution.outputData` — wire `output` 은 **`nodeExecution.outputData`
      전체**, 즉 `NodeHandlerOutput` 객체 그 자체(`{config, output, meta?, port?, status?}`,
      정의는 `codebase/backend/src/nodes/core/node-handler.interface.ts:304-309`)다.
    - `plan/in-progress/node-output-envelope.md` 의 실 DB 프로브(2026-08-24)도 이를 확증한다
      — `NodeExecution.output_data` 의 top-level 키 분포가 `meta`/`config`/`output`/`port`/
      `status`/`conversationConfig` 다. 즉 wire `output` 은 **래퍼**이고, 그 안의 `output`
      서브키가 도메인 값이다.
  - 상세: spec 문면의 "`output` 은 `NodeHandlerOutput` 의 `output` 필드"라는 표현은 wire
    `output` 을 `NodeHandlerOutput.output`(도메인 값) 하나로 좁혀 읽게 만들지만, 실제로는
    wire `output` = `NodeHandlerOutput` 전체(래퍼)이고 `output.error` 는 사실
    `envelope.output.output.error`(한 겹 더 중첩) 를 가리키는 셈이다. 이 정확한 혼동
    ("어떤 객체를 재는가"를 착각) 이 바로 `#1208` 에서 `plan/in-progress/node-output-envelope.md`
    가 자백한 실수와 **같은 클래스**다 — 그 PR 은 버튼 재개 record 를 대상으로 오인해
    `allowlistNodeOutputKeys` 를 걸면 `{}` 가 된다는 잘못된 결론을 냈었다. 이번 작업은
    `envelope.output` 최상위(=`outputData` 래퍼)에 정확히 같은 13키 allowlist 를 거는 것이
    맞는 방향(래퍼 키 집합이 `{meta, config, output, port, status}` 로 이미 allowlist 안에
    들어있음)이지만, spec 문면이 이 래퍼/도메인값 구분을 명시하지 않은 채 남아 있으면 다음
    독자(또는 §R17/§4.4 후속 정정을 쓸 planner 턴)가 같은 착각을 반복할 수 있다.
  - 제안: 이번 작업의 planner 턴(plan 체크리스트의 "WS §4.4 단서 갱신")에서 §4.1 의
    `execution.node.completed`/`.failed` 표 설명도 함께 정정 — 예: "`output` 은
    `NodeExecution.outputData` 전체(= `NodeHandlerOutput` 객체 그 자체)이며, 그 안의
    `output.error` 는 한 겹 더 중첩된 `output.output.error` 를 가리킨다" 식으로 래퍼/도메인값
    두 레벨을 명시적으로 갈라 적는다. (§R17 정정 블록이 이미 "이름이 겹치는 두 쌍을 갈라 둔다"는
    관례를 갖고 있으므로 같은 패턴을 여기에도 적용하면 된다.)

- **[INFO]** `execution.node.failed` 의 실제 emit payload 는 `output` 필드를 포함하지만
  WS spec §4.1 표는 이를 나열하지 않는다.
  - target 신규 식별자: 없음(기존 필드의 문서 누락).
  - 기존 사용처: `spec/5-system/6-websocket-protocol.md` §4.1 표 — `execution.node.failed`
    행이 `{ executionId, nodeId, nodeExecutionId, nodeLabel, error }` 로만 정의(=`output`
    미열거). 반면 `execution-engine.service.ts:6373-6385` 의 `NODE_FAILED` emit 은
    `error`**와** `output: nodeExecution.outputData` 를 **함께** 싣는다.
  - 상세: 이번 작업이 배선하려는 대상(plan 표: "`node.completed`/`.failed` → `envelope.output`")
    은 정확히 이 undocumented 필드다 — 개발 관점에서는 문제 없이 진행 가능하지만(코드가
    권위이고 plan 이 이미 code 를 근거로 두 이벤트 모두를 대상 삼음), spec 표 자체는 실제
    wire shape 보다 좁다.
  - 제안: WS §4.4 단서 갱신 시 §4.1 `execution.node.failed` 행에도 `output` 열을 추가해
    표를 code 와 맞춘다(§R17 §4.4 정정과 같은 커밋에서 처리 가능).

- **[INFO]** "`envelope.output` 은 아직 deny-list(잔여)" 라는 동일 사실이 세 SoT 에
  분산 기술돼 있고, plan 체크리스트는 그중 두 곳만 언급한다.
  - target 신규 식별자: 없음(정정 대상 서술의 소재 파악).
  - 기존 사용처: `spec/5-system/14-external-interaction-api.md:1751,1757-1771`(§R17 표 +
    정정 블록), `spec/5-system/6-websocket-protocol.md:425`(§4.4 caveat 마지막 문장),
    `spec/conventions/conversation-thread.md:392`("잔여로 남은 것은 …envelope.output 하나다").
  - 상세: `plan/in-progress/node-output-envelope.md` 의 planner 턴 체크리스트는
    "§R17 표의 잔여 행 flip + … 유예 근거를 취소선으로 정정, WS §4.4 단서 갱신" 두 곳만
    명시한다. `conversation-thread.md:392` 는 언급되지 않는다 — 구현 완료 후 이 세 번째
    SoT 만 "잔여"로 stale 남을 위험이 있다(동일 사실을 여러 곳에 적어 두면 한 곳만 고쳐지고
    어긋난다는 패턴이 이 리포지토리에 반복 기록돼 있다).
  - 제안: 구현 완료 후 §R17 표/§4.4 caveat 정정과 함께 `conversation-thread.md:392` 문장도
    취소선 정정 대상에 포함한다.

- **참고(회귀 아님)**: 직전 naming_collision 리뷰(세션 `22_26_33`)가 이미 이 구역에서 두 건의
  이름 충돌을 발견해 spec 에 반영해 두었다 — `nodeOutput.nodeType`(카드 렌더 서브타입) vs wire
  top-level `waitingNodeType`(W1), `nodeOutput.payload`(레거시 카드 렌더 데이터) vs webhook
  봉투 최상위 `payload`(W2) — 둘 다 `spec/5-system/14-external-interaction-api.md:1793-1802`
  에 "이름이 겹치는 두 쌍을 갈라 둔다" 블록으로 명시돼 있고 이번 조사에서 퇴행이 확인되지 않았다.

## 요약

이번 --impl-prep 대상 코드 변경(`envelope.output` 을 기존 `allowlistFanoutNodeOutput`/
`allowlistNodeOutputKeys` 에 세 번째 위치로 배선)은 새 엔티티·이벤트·엔드포인트·env var·spec
경로를 도입하지 않으므로 좁은 의미의 "신규 식별자 충돌"은 없다. 다만 코드-스펙 대조 과정에서
`output` 식별자가 wire envelope 래퍼(전체 `NodeHandlerOutput`)와 그 안의 도메인 값
(`NodeHandlerOutput.output`) 두 레벨에서 같은 이름으로 쓰이는데 spec §4.1 표 서술이 이를
구분하지 않고 있음을 확인했다 — 이는 바로 이 작업의 전신(`#1208`)이 "잰 객체를 착각"해 틀린
결론을 냈던 것과 같은 종류의 함정이라 WARNING 으로 등재한다. 부수적으로 `execution.node.failed`
의 undocumented `output` 필드와, "envelope.output 잔여" 사실이 세 SoT(§R17·§4.4·
conversation-thread.md)에 흩어져 있어 planner 턴 정정 체크리스트가 한 곳을 놓칠 위험도 INFO
로 남긴다. 프롬프트 번들의 대규모 컨텍스트 예산 초과로 자동 조립된 코퍼스는 사실상 비어 있었고,
위 발견은 EIA/conversation-thread/backend 소스를 직접 열어 보완한 결과다.

## 위험도

LOW
