STATUS=success cross_spec review complete — 2 WARNING, 1 INFO, 0 CRITICAL
===REPORT_MARKDOWN_BELOW===
# Cross-Spec 일관성 검토 — `planner-doc-batch.md` (B1~B7)

> 검토 방식: prompt 번들이 `6-websocket-protocol.md`/`14-external-interaction-api.md`/
> `node-output.md`/`egress-masking.md`/`chat-channel-adapter.md`/`conversation-thread.md`
> 를 예산 초과로 절단했으므로(정본 spec_impact 대상 6개 중 4개가 아예 번들에 없음),
> 워크트리의 실제 파일을 `git diff origin/main...HEAD` + `Read` 로 직접 열어 검토했다.
> 아울러 spec 이 인용하는 SoT 코드(`node-output-allowlist.ts`, `websocket.service.ts`)도
> 대조했다 — spec-vs-spec 뿐 아니라 spec 이 스스로 "정본"이라 지목한 코드와도 어긋나면
> 그 순간 새로운 사본이 생기기 때문이다.

## 발견사항

### [WARNING] WS §3.2 신설 `background:run:{runId}` 행이 같은 문서 §3.3·타 spec 의 `{id}` 관례와 어긋난다

- **target 위치**: `spec/5-system/6-websocket-protocol.md` §3.2 채널 패턴 표 (신설 행, line 128) —
  `background:run:{runId}`
- **충돌 대상**:
  - 같은 문서 §3.3 인가 표 (기존 행, line 155) — `background:run:{id}`
  - `spec/conventions/redis-keys.md:84` — `background:run:<id>` (plan 이 B5 판정 근거로 직접 인용한 행)
  - `spec/4-nodes/1-logic/12-background.md:274` — `background:run:<backgroundRunId>`
- **상세**: §3.2 표의 나머지 4행(`execution:{executionId}`·`workflow:{workflowId}`·
  `kb:{documentId}`·`notifications:{userId}`)은 전부 §3.3 인가 표의 **동일 placeholder 이름을
  그대로 재사용**한다 — 이것이 이 문서가 두 표 사이에서 지켜온 관례다. 신설 행만 §3.3 의
  `{id}` 대신 `{runId}` 를 써서 이 관례를 깬다. 더 중요한 것은, target plan 문서 자신이
  B5 판정에서 "**브래킷은 그 문서 컨벤션 `{id}`**" 라고 명시적으로 결정했는데, 실제 diff 는
  `{runId}` 를 썼다 — 계획된 결정과 실제 반영이 어긋난다. 기능적 파손은 없다(문서 표기일
  뿐 코드 바인딩이 아님)지만, 같은 채널을 가리키는 두 표가 다른 이름을 쓰면 §3.2→§3.3
  cross-reference("인가는 §3.3")를 따라가는 독자가 같은 채널인지 재확인해야 하는 마찰이
  생긴다.
- **제안**: `6-websocket-protocol.md` §3.2 의 `{runId}` 를 `{id}` 로 통일(§3.3·redis-keys.md
  와 일치) — 또는 반대로 §3.3 을 `{runId}` 로 올리고 `redis-keys.md:84` 도 함께 갱신. 후자는
  변경 범위가 넓어지므로 전자가 이 PR 의 "코드 변경 0줄·문서만" 성격에 더 맞는다.

### [WARNING] WS §4.4 신설 각주가 EIA §R17 기존 각주와 같은 대상을 다른 이름으로 부른다 — `payload.nodeType` vs `waitingNodeType`

- **target 위치**: `spec/5-system/6-websocket-protocol.md` §4.4, line 509-521 (신설 각주
  "`nodeOutput.nodeType` 과 `payload.nodeType` 은 이름이 같고 계층이 다르다")
- **충돌 대상**: `spec/5-system/14-external-interaction-api.md` §R17, line 1839-1848 (기존 각주
  "이름이 겹치는 두 쌍을 갈라 둔다", `22_26_33` naming W1·W2) — 그리고 §4.4 **자기 자신**의
  wire-caveat 블록쿼트(line 451, 기존)
- **상세**: EIA §R17 의 기존 각주는 정확히 같은 주제 — "`nodeOutput.nodeType`(카드 렌더
  서브타입) 은 wire top-level **`waitingNodeType`**(= `node.type`) 과 다른 필드다" — 를 이미
  다루고 있고, `waitingNodeType` 이라는 이름을 쓴다. 그런데 이번 PR 이 WS §4.4 에 새로 단
  각주는 같은 개념을 **`payload.nodeType`** 이라는 다른 이름으로 부른다. §4.4 도입부의
  기존 wire-caveat 블록쿼트(line 451)는 "§4.4 의 JSON 예시는 §2.1 논리 구조 표기이고, 실제
  평면 wire 는 `nodeId` 대신 `waitingNodeId`, 그리고 `waitingNodeType` 등을 평면 병합한다"
  고 명시한다 — 즉 이번 새 각주가 인용하는 표의 `payload.nodeType`(JSON 예시상의 논리
  표기)은 실제 wire 에서 정확히 `waitingNodeType` 이 된다. 새 각주는 이 사실을 언급하지도,
  EIA §R17 의 기존 각주와 연결하지도 않는다. 결과적으로 "대기 표면의 노드-종류 식별자"
  라는 같은 대상이 이제 spec 안에서 `payload.nodeType`(§4.4 신설) / `waitingNodeType`
  (EIA §R17 기존, §4.4 자신의 wire-caveat) 두 이름으로 갈린다 — 이 문서 시리즈가 여러
  차례 스스로 지적해 온 "표현이 갈리면 그 자체로 세 번째 사본" 패턴이 이번 신설 각주에서
  재현됐다.
- **제안**: WS §4.4 신설 각주에 한 줄 추가 — "이 `payload.nodeType` 은 §4.4 도입부
  wire-caveat 의 실제 wire 필드 `waitingNodeType` 과 같은 값이며, EIA §R17 의
  '이름이 겹치는 두 쌍' 각주가 이미 이 구분을 다룬다"는 취지의 상호 참조. 또는 신설 각주의
  표 1행 라벨을 `payload.nodeType` 대신 `waitingNodeType`(실제 wire 이름)으로 바꿔 EIA §R17
  과 동일 어휘를 쓰는 편이 더 근본적인 해소다.

### [INFO] `wire 전용` 갈래 라벨이 spec(장문형) 과 소스 코드 주석(단문형) 사이에서 완전히 일치하지 않는다 — 이번 PR 범위 밖

- **target 위치**: `spec/conventions/node-output.md` line 52-55 (신설), `spec/5-system/
  6-websocket-protocol.md` line 511-514 (신설) — 둘 다 `wire 전용 (위젯 파서)` /
  `wire 전용 (chat-channel 렌더러)` 라벨 사용
- **충돌 대상**: `codebase/backend/src/shared/utils/node-output-allowlist.ts` 의 JSDoc 표
  (line 47-48, 73, 78) — `wire 전용 (위젯)` / `wire 전용 (chat-channel)` (짧은 형)을 4곳에서
  쓰고, `chat-channel 렌더러`(긴 형)는 단 1곳(line 88)에만 등장, `위젯 파서`는 그룹 라벨로는
  전혀 등장하지 않는다(서술문에만 등장)
- **상세**: node-output.md 신설 각주는 "갈래 라벨은 그 상수의 주석과 **같은 문구를 쓴다**"
  고 적지만, 실제로는 `EIA §R17` 의 기존 표(line 1828-1829, 이번 PR 이전부터 존재)와는
  일치하고 소스 코드 주석의 **다수** 표기와는 불일치한다 — 즉 "세 번째 표현을 금지"한다는
  plan 의 의도와 달리, spec 내부(EIA §R17 vs node-output.md/WS 신설)는 이제 통일됐지만
  코드 주석과는 여전히 두 형태가 공존한다. 다만 이는 이번 PR 이 새로 만든 불일치가
  아니라 `#1209` 가 남긴 기존 코드 주석의 표기 편차이고, `node-output-allowlist.ts` 는
  `developer` 권한 영역이라 이번 planner 턴의 수정 대상이 아니다.
- **제안**: 액션 불필요 — 후속 developer 턴에서 `node-output-allowlist.ts` 의 그룹 라벨을
  spec 쪽 긴 형(`위젯 파서`/`chat-channel 렌더러`)으로 통일하면 완전히 해소된다. 기록만
  남긴다.

## 실측 검증 (참고 — 발견사항 아님)

다음은 target 의 주장을 코드/타 spec 과 대조해 **일치를 확인**한 항목이다(문제 없음):

- `WebsocketService.toFanoutEnvelope` 의 실제 호출 순서 = `maskWireEnvelope` →
  `stripExternalOnlyFields` → `allowlistFanoutNodeOutput` → `attachRoutingContext` (egress-masking.md
  §2 신설 서술과 일치, `websocket.service.ts:507-514` 확인)
- `allowlistFanoutNodeOutput` 이 좁히는 세 자리 = `nodeOutput` / `buttonConfig.nodeOutput` /
  `output` (egress-masking.md 신설 각주와 일치, `websocket.service.ts:190-231` 확인)
- `NODE_OUTPUT_ALLOWED_KEYS` 8키(`formConfig`·`conversationConfig`·`buttonConfig`·
  `interactionType`·`payload`·`title`·`rendered`·`nodeType`) = node-output.md 신설 각주의
  "현재 8키" 주장과 정확히 일치
- B4 won't-do 판정의 근거(`spec-impl-evidence.md` §2.1 `code:` = "구현 경로", 인용 추적성
  아님)는 실제 정의와 일치, `conversation-thread.md` 의 `code:` 16항목도 실제로 전부
  conversation-thread 도메인 파일(확인 결과 `websocket.service.ts` 미포함 유지)
  — won't-do 판정 근거가 견고함
- B7 판정(provider 표 `output.X` = 도메인 값)은 `5-template.md` 의 `output.rendered` 정의와
  일치 — "경로는 현행 유지" 판정이 다른 노드 spec 과 모순되지 않음
- B6 "미전환 3곳"(`chat-channel-adapter.md`·`conversation-thread.md`·
  `14-external-interaction-api.md`) 은 diff 상 정확히 3개 파일에 동일 문구의 인용 각주로
  반영됨. WS §4.1-a(line 259-260)는 실제로 기존 링크가 있어 "손대지 않는다" 판정과 일치

## 요약

target 문서(`planner-doc-batch.md`)가 반영한 B1~B7 편집은 핵심 데이터 모델(`NODE_OUTPUT_ALLOWED_KEYS`
8키, allowlist 3자리, egress masking 4단계 파이프라인)과 API 계약(provider 표의 `output.X`
경로) 측면에서 실제 코드·타 spec 과 정확히 일치하며, 이번에 CRITICAL 급 모순은 발견되지
않았다. 다만 신설 각주 2건이 **문서 자신이 반복적으로 경계해 온 "동일 대상의 세 번째
표현" 패턴을 재현**한다 — WS §3.2 의 `background:run:{runId}` 가 같은 문서 §3.3 및
`redis-keys.md`/`12-background.md` 의 `{id}` 관례(및 plan 자신의 결정문)와 어긋나고, WS §4.4
신설 각주의 `payload.nodeType` 이 EIA §R17 기존 각주의 `waitingNodeType` 과 같은 대상을
다른 이름으로 지칭한다. 둘 다 기능적 파손이 아닌 문서 내부 명명 일관성 문제이므로 WARNING
으로 등급을 매겼고, 코드 주석(`node-output-allowlist.ts`)과의 잔여 라벨 편차는 이번 PR
범위 밖이라 INFO 로만 기록했다.

## 위험도

LOW
