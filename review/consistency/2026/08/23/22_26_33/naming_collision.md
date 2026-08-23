# 신규 식별자 충돌 검토 — `spec/5-system/14-external-interaction-api.md` (SSE/fanout `nodeOutput` allowlist)

## 컨텍스트 요약

이번 작업(`plan/in-progress/sse-nodeoutput-allowlist.md`)은 `NODE_OUTPUT_ALLOWED_KEYS`
(`codebase/backend/src/shared/utils/node-output-allowlist.ts`, 기존 상수)에 4개 wire 키
(`payload` · `title` · `rendered` · `nodeType`)를 추가하고, `toFanoutEnvelope` 두 위치에
`allowlistNodeOutputKeys` 를 적용해 SSE/webhook fanout 의 `nodeOutput` 방어를 REST
`getStatus` 와 동일한 fail-closed allowlist 로 맞추는 작업이다. 계획상 후속 planner 턴이
`spec/5-system/14-external-interaction-api.md` §Rationale R17 의 allowlist 표
(`getStatus waiting nodeOutput` / `getStatus terminal result` / `getStatus terminal error` /
`SSE/fanout emit (toFanoutEnvelope)` 4행)를 갱신해 SSE 행을 flip 하고 "REST 와 SSE 의 방어
강도가 다르다" 서술을 제거한다.

신규 요구사항 ID·엔티티/DTO·API endpoint·env var·spec 파일 경로는 이번 작업으로 추가되지
않는다(전부 기존 식별자의 재사용/확장). 다만 **allowlist 에 새로 추가되는 4개 wire 키 이름
자체**가 같은 spec 문서(§6, §6.2, §R17) 안에서 이미 다른 의미로 쓰이고 있는 동명 식별자와
충돌할 소지가 있어 아래에 기록한다.

## 발견사항

### [WARNING] `nodeOutput.nodeType` (신규 allowlist 키) vs. 같은 문서가 "외부 소비 매핑 없음"으로 못박은 `node.type`/`waitingNodeType`

- **target 신규 식별자**: `NODE_OUTPUT_ALLOWED_KEYS` 에 추가되는 wire 키 `nodeType`
  (= `nodeOutput.nodeType`, buttons 대기에서는 `buttonConfig.nodeOutput.nodeType`). 실제 코드
  근거: `codebase/backend/src/modules/chat-channel/providers/telegram/telegram-message.renderer.ts:416`
  (`const visualKind = nodeOutput?.nodeType;`), `.../discord/discord-message.renderer.ts:322`,
  `.../slack/slack-message.renderer.ts:307` (`buttonConfig.nodeOutput?.nodeType`) — 카드/시각
  fallback 렌더 종류(`'chart'|'table'|'carousel'`)를 고르는 데 쓰이며, 이번 작업으로 SSE/webhook
  fanout 에서도 명시적으로 통과가 허용된다.
- **기존 사용처**: `spec/5-system/14-external-interaction-api.md` §6.2 이후 wire 매핑 blockquote
  (라인 763~772, 현재 커밋 기준 동일 라인대):
  > `**`node.type` 은 외부 소비 매핑이 없다.** wire 에 `waitingNodeType` 이 평면으로 실리기는
  > 하지만 그것은 **WS 내부 부가 식별자**(에디터 타임라인 관측용)이고, 외부 클라이언트는
  > 노드 타입이 아니라 **`interactionType` 으로 분기한다**...
  > `waitingNodeType` · `waitingNodeLabel` · `nodeExecutionId` · `startedAt` 은 평면으로
  > 실리지만 위 이유로 **WS 내부 부가 식별자**라 [WS §4.4] 가 소유한다 — 본 절은 외부
  > 클라이언트 소비 필드만 다룬다(의도된 스코프 분리).
- **상세**: 같은 문서 안에서 "노드 타입"을 가리키는 필드가 두 층에 따로 존재한다 — (a) wire
  top-level `waitingNodeType`(= 논리 `node.type`, 대기 중인 노드 자체의 타입, 예:
  `form`/`carousel`/`ai_agent`)와 (b) `nodeOutput` 내부의 `nodeType`(= 핸들러가 만든 렌더용
  visual 서브타입, 예: `chart`/`table`/`carousel`, 값 공간이 (a)와 상당 부분 겹친다). 문서는 이미
  (a)를 "외부 소비 매핑이 없다"고 명시적으로 못박아 뒀는데, 이번 작업은 (b)를 REST 뿐 아니라
  SSE/webhook 으로도 **명시적으로 노출**한다. 두 필드는 실제로는 다른 객체(wire 최상위 vs.
  `nodeOutput` 내부)에 있어 런타임 키 충돌은 없지만, 이름이 동일("nodeType")하고 값 도메인이
  겹쳐서 §R17 표만 보고 "이 문서가 nodeType 외부 노출 없음을 선언했다"고 오독하기 쉽다 —
  실제로 이번 작업의 존재 이유 자체가 "REST 에는 이미 나가고 있었는데 SSE 는 막혀 있었다"는
  **비대칭 발견**이었다는 점을 감안하면, 이름의 근접성이 이런 비대칭을 실제로 만들어 온 근본
  원인 중 하나로 보인다.
- **제안**: planner 턴이 §R17 표를 갱신할 때, allowlist 4키 나열 옆(또는 §6.2 wire 매핑
  blockquote)에 "`nodeOutput.nodeType`(카드 렌더 서브타입, 외부 노출 대상)은 wire top-level
  `waitingNodeType`(= `node.type`, 외부 비노출)과 **다른 필드**"라는 한 줄 disambiguation 을
  §6.2 blockquote 의 기존 관례(같은 절이 `payload` 봉투에 대해 이미 "이름만 비슷할 뿐 서로
  참조하지 않는다"는 각주를 붙인 것과 동일 패턴)로 남기길 권장한다.

### [WARNING] `nodeOutput.payload` (신규 allowlist 키) vs. §6 이 SoT 로 소유한 webhook 봉투 키 `payload`

- **target 신규 식별자**: `NODE_OUTPUT_ALLOWED_KEYS` 에 추가되는 wire 키 `payload`
  (= `nodeOutput.payload`). 실제 코드 근거:
  `codebase/backend/src/modules/chat-channel/providers/telegram/telegram-message.renderer.ts:207`
  (`const payloadFromPayload = nodeOutput.payload;`), `.../slack/slack-message.renderer.ts:176,181`,
  `.../discord/discord-message.renderer.ts:187,192` — carousel/chart/table 의 legacy flat
  handler 출력에서 렌더용 원본 데이터를 담는 필드.
- **기존 사용처**: 같은 문서 §6 "채널별 봉투" (라인 628~646) 이 **normative** 로 정의하는
  webhook 전용 최상위 wrapper 키 `payload`:
  > `payload` 래퍼는 **webhook 전용**이다 … webhook (본 절): `{ type, executionId, triggerId,
  > workflowId, seq, timestamp, payload: { …SSE 와 같은 flat 객체 } }` … **`payload` 봉투는
  > §5 REST 응답의 `data` 봉투와 별개 표면**이다 — 이름만 비슷할 뿐 서로 참조하지 않는다.
- **상세**: webhook 채널에서는 실제 wire 가 `<envelope>.payload.<...>.nodeOutput.payload` 형태로
  **`payload` 라는 동일 키가 서로 다른 두 레벨에 중첩**될 수 있다 — 바깥은 §6 이 정의하는
  이벤트 봉투 wrapper, 안쪽은 handler 가 만든 legacy 카드 렌더 payload 로 의미가 완전히
  다르다. 문서는 이미 "webhook `payload` 봉투 vs. REST `data` 봉투"의 혼동은 명시적으로
  경계 지었지만(§6 라인 644), **`nodeOutput.payload` 와의 3중 동명 충돌**은 아직 어디에도
  언급이 없다. §R17 allowlist 표에 4키를 나열할 때 이 항목만 별도 각주 없이 지나가면, 문서가
  스스로 세워둔 "이름 근접 → 별개 표면임을 명시" 관례가 이번 항목에서만 깨진다.
- **제안**: §R17 allowlist 표(또는 §6 blockquote 확장)에 "`nodeOutput.payload` 는 §6 이 정의하는
  webhook 봉투 `payload` 와 **동일 키명이지만 중첩 레벨이 다른 별개 필드**"라는 한 줄을
  추가해 §6 의 기존 disambiguation 패턴을 이 신규 allowlist 키까지 확장하길 권장한다. 기능
  변경은 불필요(코드는 이미 올바르게 서로 다른 객체를 다룬다) — 순수 문서 명확화 항목이다.

### [INFO] 신규 allowlist 4키 중 `title` / `rendered` 는 문서 내 동명 충돌 없음 (참고)

- `title` · `rendered` 는 `spec/5-system/14-external-interaction-api.md` 전체에서 이번
  allowlist 표 기재(및 plan 문서) 외에 다른 의미로 쓰인 자리가 없다(grep 확인). §5.2
  `PresentationPayload` 의 `renderedAt` 과 표기가 근접하지만 별개 문자열 키라 실질 충돌은
  아니다. 추가 조치 불필요.

## 요약

이번 작업은 신규 요구사항 ID·엔티티·API endpoint·이벤트명·env var·spec 파일 경로를 새로
도입하지 않는다 — 기존 `NODE_OUTPUT_ALLOWED_KEYS`/`toFanoutEnvelope`/§R17 표를 확장하는
범위다. 다만 새로 allowlist 에 편입되는 4개 wire 키 중 `nodeType` 과 `payload` 두 개는, 같은
spec 문서가 이미 다른 레벨·다른 의미로 명시적 서술을 갖고 있는 동명 필드(`waitingNodeType`/
`node.type` 의 "외부 비노출" 선언, §6 이 SoT 인 webhook `payload` 봉투)와 이름이 겹쳐 향후
독자·구현자가 §R17 표만 보고 오독할 위험이 있다. 둘 다 실제 런타임 키 충돌은 아니며(중첩
레벨이 달라 기술적으로는 안전), 이 문서가 이미 확립한 "이름 근접 시 별개 표면임을 각주로
명시" 관례를 신규 allowlist 항목에도 적용하면 해소되는 문서 명확화 수준의 사안이다.

## 위험도

LOW
