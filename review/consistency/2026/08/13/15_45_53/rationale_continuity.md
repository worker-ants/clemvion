# Rationale 연속성 검토 — `spec-draft-eia-notification-payload-contract.md`

## 발견사항

- **[WARNING]** §6.2 의 기존 "SSE 스트림 wire 형태 주의" caveat 이 새 `payload` 봉투 도입으로 stale 해질 위험 — 캐비엇 자체 갱신이 계획에 명시 안 됨
  - target 위치: 계획 §0 "봉투 규칙" 마지막 문장 — "§6.1(헤더/서명)·§6.2 의 wire 서술도 이 봉투에 맞춘다"
  - 과거 결정 출처: `spec/5-system/6-websocket-protocol.md` `## Rationale` "§4.4 wire 필드 caveat — 직접 재작성 대신 caveat + 오너십 분리 (2026-07-14, PR #945)" — 이 결정은 "논리 구조 JSON + 구현현실 caveat blockquote" 패턴을 EIA §6.2 에도 이미 적용해 두었다고 명시한다. 이 caveat(현재 `spec/5-system/14-external-interaction-api.md` §6.2, "SSE 스트림 wire 형태 주의")는 `node.id → waitingNodeId`, `context.buttonConfig → buttonConfig` 등 **현재(비-`payload`-nested) 캐노니컬 JSON 경로를 기준으로** 필드명을 매핑한다.
  - 상세: target 이 §6.2 의 캐노니컬 JSON 을 `payload` 아래로 재중첩하면, 그 직후에 붙어있는 SSE caveat 의 매핑 항목(`node.id`, `context.buttonConfig`, `context.formConfig` 등)은 더 이상 캐노니컬 JSON 트리 상의 실제 경로와 일치하지 않는다(실제로는 `payload.node.id` 위치가 됨). caveat 자체를 `payload.` 프리픽스로 갱신하거나 "SSE 는 `event.payload` 를 그대로(unwrapped) 보내고, notification 은 그 위에 `payload` 로 한 번 더 감싼다"는 설명을 추가하지 않으면, 이 문서가 이미 두 차례(`15_15_08`, `15_28_10`) BLOCK: YES 를 받은 것과 **같은 계열의 결함**(규칙을 일부 절에만 적용)이 §6.2 에서 재발한다. target 의 "영향 범위" 표(§ "무엇이 어긋났나")에도 §6.2 는 애초에 등재돼 있지 않아 grep 기반 재검증 대상에서 빠져 있었을 가능성이 있다.
  - 제안: §0 또는 §6.2 항목에 "SSE caveat 매핑 표의 좌변 경로를 `payload.` 프리픽스로 동반 갱신(또는 '두 채널의 unwrap 여부' 를 명시)"을 체크리스트 항목으로 명시 추가.

- **[WARNING]** §6.5 가 `execution.cancelled`(봉투 대상)와 `execution.ai_message`(비목표)를 공유하는데, 후자의 기존 envelope 서술이 새 §0 규칙과 충돌 가능
  - target 위치: 계획 §3 (`execution.cancelled` 결정) — §6.5 를 수정 대상으로 지정
  - 과거 결정 출처: `spec/5-system/14-external-interaction-api.md` §6.5 본문 — "`execution.ai_message` 는 [Spec WS §4.4] 의 payload 를 포함하며, **본 spec 의 표준 envelope(`triggerId`/`workflowId`/`timestamp`/`seq`)만 추가로 wrap 한다**" (즉 `payload` 키 없이 flat merge 라고 **명시적으로** 기술돼 있다).
  - 상세: 실측(`notification-fanout.service.ts` `FANOUT_EVENTS`)에는 `execution.ai_message` 도 동일하게 `payload: event.payload` 로 감싸 발송된다 — 즉 이 문장도 §6.3~§6.5 의 다른 부분과 **동일한 종류의 drift**(flat 서술 vs 실제 wrapped wire)를 갖고 있다. target 은 `ai_message` 를 명시적 비목표로 두지 않았고("종결 이벤트" 3종에만 집중한다는 §"왜" 절 범위) 그러면서도 봉투 규칙을 §6.5 전체(같은 섹션)에 손대게 되므로, 이 문장을 그대로 두면 같은 섹션 안에 "항상 `payload` 로 감싼다"(target 신규 서술)와 "`payload` 키 없이 wrap"(기존 ai_message 서술)이라는 **상호 모순 문장이 공존**하게 된다.
  - 제안: `execution.ai_message` 를 명시적으로 비목표에 추가(현재 상태 그대로 별도 후속으로 이월)하거나, 그 경우에도 §6.5 의 ai_message 서술 문장이 §0 의 "항상 이 봉투" 주장과 왜 다른지(범위 제외 사유)를 캐비엇으로 명시. 그렇지 않으면 같은 섹션 내 두 결정이 서로를 반증하는 상태로 남는다.

- **[INFO]** "직접 재작성 대신 caveat 채택" 선례와의 관계를 target Rationale 이 스스로 언급하지 않음
  - target 위치: target 문서 `## Rationale` 전체 (특히 "왜 spec 이 코드를 따르는가" 절)
  - 과거 결정 출처: `spec/5-system/6-websocket-protocol.md` `## Rationale` "§4.4 wire 필드 caveat" — 문서-실제 wire 불일치를 다룰 때 "캐노니컬 JSON 을 통째로 실 wire 로 rewrite" 대신 "논리 구조 유지 + caveat blockquote 첨부"를 원칙으로 채택한 선례.
  - 상세: target 은 (정당하게) 반대 접근 — §6.3~§6.5 의 캐노니컬 JSON 자체를 실제 wire(payload 봉투)에 맞게 rewrite — 를 택했다. 이는 R16(`§5.4 코드가 SoT`) 선례와는 정합하지만, WS 의 "caveat 우선" 선례와는 결이 다르다. 두 선례가 실제로 다른 종류의 문제(WS: 같은 개념의 SSE-vs-notification 표현 차이 / target: notification 자신의 문서-코드 drift)를 다루므로 모순은 아니지만, target 의 Rationale 이 이 구분을 스스로 밝히지 않아 향후 리뷰어가 "caveat 선례를 왜 안 따랐는가"로 재차 반려할 위험이 있다.
  - 제안: "왜 caveat 이 아니라 rewrite 를 택했는가" 한 문단을 Rationale 에 추가(요지: WS 의 caveat 선례는 서로 다른 두 채널이 같은 논리 개념을 다르게 표현하는 경우이고, 본 건은 notification 채널 자신의 캐노니컬 예시가 자신의 실제 wire 와 어긋난 경우라 R16 의 "코드가 SoT" 가 더 가까운 선례).

- **[없음 — 검증됨]** target 의 핵심 선례 인용(§5.4/R16 "코드가 SoT" 정합, `finalNodeId`/`finalPort` 의 PR #228 단일 출처, `chat-channel-adapter.md` R3 의 "EIA 우선 위임" 원칙)은 모두 `git log -S`·직접 파일 열람으로 실사실과 일치함을 확인했다. `chat-channel-adapter.md` 자체의 `## Rationale`(R1~R4, R-CCA-5~8)은 이번 bundle 입력에서 컨텍스트 예산으로 누락돼 있었으나 직접 열람한 결과 R3("EiaEvent 를 별 타입으로 정의하지 않고 EIA spec 위임 — 구체 필드의 spec 갱신은 항상 EIA spec 우선")이 target 의 §5 결정(EIA 변경 후 CCA §1.2 동반 수정)과 정확히 정합해, 기각된 대안의 재도입이나 원칙 위반은 확인되지 않았다.

## 요약

target 은 이 저장소의 실제 선례(R16 "코드가 SoT", `finalNodeId`/`finalPort` 의 무근거 초안 기원, chat-channel-adapter R3 의 EIA-우선 위임)를 `git log`/직접 근거로 정확히 인용하며 스스로 정합성을 검증하는 태도를 보였고, 명시적으로 기각된 대안을 이유 없이 되살리거나 합의된 invariant 를 직접 위반하는 지점은 발견되지 않았다. 다만 이 문서가 이미 두 차례 "규칙을 일부 절에만 적용"으로 반려된 이력이 있는데, 신규 도입하는 `payload` 봉투 규칙이 §6.2 의 기존 SSE-wire caveat(WS 스펙의 "caveat 오너십 분리" 선례로 세워진 매핑 표)와 §6.5 가 공유하는 `execution.ai_message` 의 기존 "wrap 없음" 서술 두 곳에서, 갱신 대상으로 명시되지 않은 채 조용히 stale 해질 위험이 남아 있다 — 같은 결함 계열의 세 번째 재발 가능성이다.

## 위험도

MEDIUM
