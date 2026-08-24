# 신규 식별자 충돌 검토 — `plan/in-progress/planner-doc-batch.md`

## 방법 노트

`_prompts/naming_collision.md` 번들은 target 의 `spec_impact` 9개 중 5개
(`spec/conventions/node-output.md`·`egress-masking.md`·`conversation-thread.md`,
`spec/5-system/6-websocket-protocol.md`·`14-external-interaction-api.md`) 의 본문을
"컨텍스트 예산 초과" 로 담지 못했다. 이 checker 는 대신 워크트리의 실제 파일과 관련
코드(`node-output-allowlist.ts`, `websocket.service.ts`, 세 provider renderer)를 직접
읽어 분석했다 — 아래 발견사항은 번들이 아니라 실 파일 대조 결과다.

## 발견사항

- **[WARNING]** `nodeType` 이 두 계층에서 같은 이름으로 쓰이며 문서화된 금지 규칙과 표면 충돌
  - target 신규 식별자: 없음(target 은 기존 상황을 설명하는 각주만 추가 — B3)
  - 기존 사용처:
    - `spec/5-system/6-websocket-protocol.md:503` — `buttonConfig.nodeOutput` 행: *"노드
      종류는 상위 `payload.nodeType` 로 식별 — `nodeOutput` 에 `type` 판별자 래퍼는 두지
      않는다"* (Principle 1.1.4, 판별자 래퍼 **금지** 규칙)
    - `codebase/backend/src/shared/utils/node-output-allowlist.ts:78-83` — `NODE_OUTPUT_ALLOWED_KEYS`
      의 "wire 전용 (chat-channel)" 그룹에 **`nodeType`** 이 top-level 키로 포함 (2026-08-23
      SSE 작업 추가, `spec/5-system/14-external-interaction-api.md:1826` 도 동일하게 등재)
  - 상세: envelope-level `payload.nodeType`(WS §4.1/§4.4, 노드 종류 식별의 공식 채널)과
    `NodeHandlerOutput` wire 래퍼 안에 새로 얹힌 `nodeOutput.nodeType`(chat-channel 렌더러가
    flat legacy shape 로 읽는 별개 carve-out)이 **같은 이름·다른 위치**다. WS §4.4 가 바로
    옆 문장에서 "판별자 래퍼 금지" 를 선언하고 있어, 이 carve-out 을 처음 읽는 사람은
    규칙 위반으로 오독하기 쉽다.
  - 제안: target B3 가 계획한 WS §4.4 각주는 **"동일 이름·다른 계층"** 임을 명시하고
    `EIA §R17`(§14, wire 전용 chat-channel 그룹 표) · `node-output.md` Principle 0 의
    wire-only 각주(B1 산출물) · `chat-channel-adapter.md` §(c) `renderPresentationByType`
    로 3중 교차 참조할 것. 단순히 "legacy carve-out 이다" 라고만 적으면 같은 오독이 재발한다.

- **[WARNING]** B7 판정 범위가 provider 표의 `template` 행에만 좁혀져, 표 안에서 `output.X`
  표기 깊이가 행마다 달라질 위험
  - target 신규 식별자: 없음(target 은 `output.rendered` 가 wire 래퍼 기준인지 **판정만** 함,
    B7 — 코드 변경 없이 문서 판정만일 수도 있음)
  - 기존 사용처: `telegram.md:160`·`slack.md:233`·`discord.md:256` 의 "노드타입 × enum × 버전
    매트릭스" 표는 `template` 행(`output.rendered`)뿐 아니라 `chart` 행(`output.payload.
    {title, series, labels}`)·`carousel` 행(`output.items[]`)·`table` 행(`output.{rows,
    columns}`) 도 **동일한 얕은 `output.X` 표기**를 쓴다. 실제 렌더러 코드
    (`telegram-message.renderer.ts` `extractRendered`(183-193) ·
    `normalizePresentationNodeOutput`(199-227))는 `template` 뿐 아니라 `chart`/`carousel`/
    `table` 에도 **동일한 `payload` → `output` → `config` → flat 4단 폴백**을 적용한다
    (`normalizePresentationNodeOutput` 의 `payloadFromOutput = nodeOutput.output` 이 그
    한 후보).
  - 상세: B7 이 "노드가 무엇을 만드나(도메인 값)" 대신 "렌더러가 어디서 읽나(wire 래퍼)" 로
    판정해 `template` 행만 `output.output.rendered` 로 고치면, 바로 옆 `chart`/`carousel`/
    `table` 행은 여전히 `output.X` 얕은 표기로 남아 **같은 표 안에서 같은 `output.X` 표기가
    행마다 다른 깊이를 의미**하게 된다 — 이건 target 이 새로 만드는 표기 불일치이자,
    B1(wire-only 각주)·B7 이 서로 다른 스코프로 같은 문제를 반쪽만 건드리는 형태다.
  - 제안: B7 판정을 `template` 행에 국한하지 말고 같은 표의 4행 전체(`chart`/`carousel`/
    `table`/`template`)에 동일 논리를 적용하거나, 반대로 "이 표의 `output.X` 는 렌더러
    진입점(CCH-MP-01/06)에 따라 실제 경로가 달라지는 **일반화 표기**이지 리터럴 경로가
    아니다" 라는 취지의 각주를 표 상단에 한 번 달아 4행 전체를 커버하는 편이 target 이
    의도한 "판정 근거를 남긴다" 원칙에 더 맞는다.

- **[INFO]** `spec/5-system/6-websocket-protocol.md` 안에 `### 4.4` 헤딩이 두 번 존재
  (pre-existing, target 원인 아님)
  - 기존 사용처: line 446 `### 4.4 사용자 입력 대기 이벤트 상세 (execution.waiting_for_input)`
    / line 815 `### 4.4 알림 이벤트 (Server → Client)`. 절 번호 순서도
    4.1→4.2→**4.4**→4.3→**4.4**(다시)→4.5→4.6 으로 어긋나 있다.
  - 상세: target 의 B3 체크리스트 항목이 "WS §4.4 `nodeType` carve-out 각주" 로만 절 번호를
    지칭한다. 본문 문맥("`buttonConfig.nodeOutput` 행")으로 어느 §4.4 인지는 명확하지만,
    절 번호만으로 인용하면 다음에 이 표를 옮기는 사람에게 모호할 수 있다.
  - 제안: target 이 이번에 §4.4 를 편집하지 않기로(다음 라운드로 미룸) 했으므로 지금 당장
    고칠 필요는 없다. 다만 향후 이 절을 열 때 두 `### 4.4` 를 구분되는 번호(예: 기존 4.3
    KB 이벤트 뒤로 알림 이벤트를 4.6 으로 재배치하거나 앵커에 괄호 설명을 유지)로 정리할
    것을 함께 적어 두면 좋다 — target 의 `spec_impact` 밖이라 이번 PR 의 책임은 아니다.

- **[INFO]** B5 택일 판정 — 플레이스홀더 토큰 표기 스타일이 두 후보 문서 사이에서 다르다
  - 기존 사용처: `spec/5-system/6-websocket-protocol.md` §3.2/§3.3 은 curly-brace 스타일
    (`{executionId}`·`{workflowId}`·`{documentId}`·`{userId}`, §3.3 의 `background:run:{id}`
    행도 동일)을 쓰는 반면, `spec/conventions/redis-keys.md` §4 와
    `spec/4-nodes/1-logic/12-background.md` §8.5 는 angle-bracket 스타일(`background:run:
    <id>` / `background:run:<backgroundRunId>`)을 쓴다.
  - 상세: B5 가 §3.2 표에 새 행을 추가하는 쪽을 택하면 WS 문서 컨벤션(`{id}`)을 따라야
    다른 4행과 스타일이 맞는다 — angle-bracket 을 그대로 옮기면 같은 표 안에서 표기가
    섞인다. 참고로 `12-background.md` §8.5 는 이미 이 채널의 lifecycle 이벤트
    (`execution.background_run.started` 등)까지 표로 상세히 문서화하고 있어, `redis-keys.md`
    §4 포인터를 그쪽으로 돌리는 안이 **정보 원본성** 측면에서 근거가 더 있다(§3.2 표는
    "채널 패턴" 목록이지 이벤트 상세 SoT 가 아니므로).
  - 제안: 최종 판단은 planner 몫이지만, 어느 쪽을 택하든 **목적지 문서의 기존 브래킷
    컨벤션**을 유지할 것.

- **[INFO]** B1 "wire-only" 용어는 이미 정착된 taxonomy 재사용 확인
  - 기존 사용처: `spec/5-system/14-external-interaction-api.md:1825-1826` (`wire 전용
    (위젯 파서)` / `wire 전용 (chat-channel 렌더러)`) · `node-output-allowlist.ts:38-40`
    JSDoc 표(동일 레이블).
  - 상세: target 의 B1 각주가 새로 만드는 용어가 아니라 이미 EIA §R17·코드 JSDoc 에 있는
    동일 taxonomy 를 node-output.md Principle 0 에도 반영하는 것 — 충돌이 아니라 일치.
  - 제안: 각주 문구를 쓸 때 "위젯 4 + chat-channel 4" 같은 새 표현 대신 위 두 곳과
    **동일한 그룹 레이블**("wire 전용 (위젯 파서)" / "wire 전용 (chat-channel 렌더러)")을
    그대로 재사용해 세 번째로 살짝 다른 표현의 사본이 생기지 않게 할 것.

## 요약

target 은 새 요구사항 ID·엔티티·API endpoint·이벤트명·환경변수·spec 파일 경로를 도입하지
않는 순수 문서 정합화 작업이라, 이 검토 관점(카테고리 1·3·4·5·6)에서 직접적인 CRITICAL 은
없다. 다만 target 이 다루는 두 항목(B3 의 `nodeType` carve-out 각주, B7 의 `output.rendered`
판정)은 **이미 코드에 존재하는 동일 이름·다른 계층/깊이 구조**를 문서화하는 작업이라,
각주·판정의 범위를 좁게 잡으면 오히려 새로운 표기 불일치(같은 표 안에서 `output.X` 가
행마다 다른 의미)를 만들 위험이 있다 — 위 두 WARNING 이 그 지점이다. 또한 이 checker 에게
전달된 입력 번들 자체가 target 이 직접 편집할 5개 파일의 본문을 예산 절단으로 담지 못했다는
점은 이 배치 작업의 다른 관점 checker 산출물에도 동일하게 영향을 줄 수 있어 별도로
기록해 둔다.

## 위험도

MEDIUM
