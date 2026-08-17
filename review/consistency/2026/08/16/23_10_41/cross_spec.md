# Cross-Spec 일관성 검토 — spec-draft-eia-fanout-masking.md

## 검토 방법 메모

번들 파일이 컨텍스트 예산 초과로 target 이 실제로 편집하는 3개 핵심 문서
(`spec/5-system/6-websocket-protocol.md`, `spec/5-system/12-webhook.md`,
`spec/5-system/14-external-interaction-api.md`) 와 `spec/5-system/15-chat-channel.md` 본문을
전부 생략했다(기존에 알려진 갭 — memory `feedback_consistency_spec_mode_budget`). 이 checker 는
저장소 파일시스템에서 해당 4개 spec 파일 원문과 관련 backend 소스(`websocket.service.ts`,
`redact-stored-error.ts`, `notification-fanout.service.ts`, `execution-channel-authorizer.ts`,
`executions.controller.ts`)를 직접 읽어 target 의 모든 인용·수치·표 대조 주장을 실측 검증했다.
아울러 직전 라운드 `review/consistency/2026/08/16/22_22_36/SUMMARY.md` (5건 WARNING)를 대조해
이번 target 이 각 항목을 실제로 해소하는지 확인했다.

## 발견사항

- **[INFO]** WARNING 5건(22_22_36) 해소 상태 — target 은 5건 중 spec 관련 4건(①WS wire parity,
  ②ingestion/egress 철학 상충, ③`nodeName`→`nodeLabel` drift, ④잔여 ①·② flip)을 전부 정확히
  겨냥해 반영한다. 실측 결과 모두 기존 spec/코드와 정합됨을 확인했다:
  - §R17 신규 불릿의 "wire 에도 건다" 처방은 `websocket.service.ts:246-386` 의 실제 구현
    (`maskWireEnvelope` → `deepRedactSecretsPreserving`, `emitExecutionEvent`/`emitNodeEvent`
    양쪽 적용, `WIRE_PRESERVED_FIELDS = EXTERNAL_STRIPPED_FIELDS` 로 `llmCalls` 만 wire 보존)와
    정확히 일치한다. `ExecutionChannelAuthorizer.verifyOwnership` 이 role 을 안 받는다는 주장도
    `execution-channel-authorizer.ts` 로 확인되고, `GET /api/executions/:id`(`executions.controller.ts:63-88`)
    에 `@Roles` 없음도 실측 일치. "R-5 원칙 원용" 인용문(`2-navigation/14-execution-history.md:469`
    "안전성은 롤 게이팅이 아니라 서버 boundary masking parity 에 의존")도 원문과 정확히 일치한다.
  - 잔여 ①·② flip 대상 텍스트(`14-external-interaction-api.md:1515-1518`)도 실측한 그대로다 —
    ③(workflow-assistant) 만 남기는 target 의 처리가 §R17 자신의 "열거" 원칙과 부합한다.
  - `nodeName`→`nodeLabel` 4행 정정 대상은 `6-websocket-protocol.md:186-189` 정확히 4행이고,
    같은 파일의 `execution.paused`(:185, 계획·미구현)는 5번째 `nodeName` 이지만 target 의
    "4행" 서술과 대상이 정확히 일치한다(미구현 이벤트라 실측 emit 대상이 아님 — 아래 INFO 참고).
    spec 전역 grep 결과 `nodeName` 을 인용하는 다른 spec 파일은 없다(`3-error-handling.md:249`
    의 REST 에러 예시 JSON 은 별개 표면·별도 필드로 이 정정과 무관 — 깨지지 않는다).
  - §4.6 "외부 표면 매핑" 표(`6-websocket-protocol.md:802-822`, 문서 스스로 "권위적"이라 명시)는
    `execution.node.*` 6행 모두 Outbound Notification 열이 `—` 이고, 실제
    `notification-fanout.service.ts` 의 `FANOUT_EVENTS` Set 도 `execution.node.*` 를 포함하지
    않는다 — target 1-a 의 "notification webhook 은 FANOUT_EVENTS 화이트리스트 밖" 주장과
    코드·표·target 세 곳이 정확히 일치한다.
  - `redactStoredErrorForResponse`/`redactStoredDataForResponse` 는 실제로 `executions.service.ts`
    에 이미 구현·사용 중이며(1-c 의 "여섯 표면" 서술과 라인 대조 시 함수 자체는 정합), 신규
    helper 이름 충돌 우려(직전 라운드 WARNING #5)도 `deepRedactSecretsPreserving` 이 기존
    `deepRedactSecrets` 패밀리의 명명 관례를 그대로 따르는 변형으로 구현돼 해소됐다.

- **[INFO]** ingestion/egress 철학 공존 문단(1-d)과 `12-webhook.md` Rationale 의 잔여 비대칭 —
  1-d 는 두 층("알려진 헤더 key" vs "자유 텍스트")의 구분 근거를 제시해 직전 라운드 WARNING #2
  의 핵심 요구(EIA 쪽에서 webhook Rationale 을 명시 인용)를 충족한다. 다만 `12-webhook.md`
  Rationale 원문(:439 "raw secret 이 DB 에 잔존해 유출 표면(DB 접근·백업·신규 endpoint)이
  남는다")이 지적하는 구체적 위험 — DB 원문 보존 자체가 유출 표면이라는 논거 — 을 1-d 는
  "사후 디버깅의 진실이 사라진다"는 이익 쪽 근거로만 상쇄하고, 그 위험을 "수용된 trade-off"로
  명시하지 않는다. 다만 이 잔차 위험은 §R17 기존 텍스트(:1479-1481 "egress-only" 불릿, target
  변경 대상 아님)에 이미 "DB 는 여전히 원문… 서버 로그·사후 디버깅의 진실은 유지된다"로
  기록돼 있어 문서 전체로 보면 결손은 아니다 — 다만 두 조각이 같은 문서(§R17) 안에서도
  떨어져 있어 독자가 조합해야 한다. target 을 막을 사안은 아니고, 반영 시 1-d 문단 끝에 "이
  DB 잔존 자체가 유출 표면이라는 12-webhook.md 의 우려는 §R17 egress-only 원칙(DB 원문 보존)
  아래서도 동일하게 적용되며, 자유 텍스트 필드는 대상 패턴을 사전에 완전히 특정할 수 없어
  ingestion 단계에서 안전하게 걷어낼 수 없다"는 한 문장을 보태면 대조가 더 촘촘해진다.

- **[INFO]** `execution.paused`(계획·미구현) 의 `nodeName` 잔존 — target 은 §4.1 의 4개
  구현된 행만 `nodeLabel` 로 정정하고 `execution.paused` 행(:185, "계획·미구현" 로 명시된
  브레이크포인트 기능)은 그대로 둔다. 실측(엔진 emit 전수가 `nodeLabel`)이 미구현 이벤트에는
  적용될 수 없으므로 이는 정합적인 처리다. 다만 정정 후에는 §4.1 표 안에 `nodeName` 필드를
  쓰는 행이 `execution.paused` 하나만 남아, 향후 이 기능이 구현될 때 같은 drift 가
  재발할 잠재 소지가 생긴다 — 심각한 문제는 아니나 구현 착수 시 유의사항으로 남겨둘 만하다.

- **[INFO]** WS §2-b 캐비엇의 필드 예시("자유 텍스트 `error`/`message` 안의 …")가 실제
  마스킹 스코프보다 좁아 보일 수 있음 — `websocket.service.ts:246-347`의 `maskWireEnvelope`
  는 `emitExecutionEvent`/`emitNodeEvent` 가 만드는 **전체 envelope**(필드명 무관, `llmCalls`
  제외)에 `deepRedactSecretsPreserving` 을 건다. target 2-b 문구는 "위 execution/node 이벤트의
  **payload** 는 emit 시점에 마스킹된다"고 전체 payload 기준으로 먼저 명시한 뒤 `error`/
  `message` 를 예시로 든 것이라 오독 소지는 낮지만, EIA 1-a 쪽 문구("error/input/output")와
  필드 목록이 서로 다르다(WS 는 error/message, EIA 는 error/input/output). 두 문서 모두
  "예시" 로 읽히도록 의도됐다면 문제없으나, 어느 한쪽을 "이 필드만" 으로 오독하면 두 문서가
  서로 다른 스코프를 규정하는 것처럼 보일 수 있다. 실제 구현은 필드명 불문 payload 전체이므로
  두 문구 다 예시(비-완전 열거)로 통일해 표기하면 향후 혼동을 막을 수 있다.

- **[INFO]** `plan/in-progress/spec-sync-websocket-protocol-gaps.md` 트래커에는 애초에
  `nodeName`/`nodeLabel` drift 가 등재돼 있지 않았다(직전 라운드가 지적한 그 갭). target 이
  drift 를 등재 대신 **직접 정정**하므로 이 문제 자체가 소멸한다 — 별도 조치 불요.

## 검토 요청 관점에 대한 답변

- **①·② flip 이 §R17 "열거" 원칙을 지키는가**: 그렇다. `:1515-1518` 실측 대비 target 의
  flip 대상·잔존 대상(③ 만 유지)이 정확히 일치하고, ①·② 를 해소 표기로 바꾸는 근거(새 불릿·
  1-c 갱신)도 실제로 그 표면을 덮는다.
- **2-c 가 strip-only 결정의 번복이 아니라 범위 명확화로 읽히는가**: 그렇다. 기존 Rationale
  (`:1079-1081`)은 "`llmCalls` 를 값-마스킹으로 대체"를 기각한 것이고, 2-c 는 `llmCalls` 자체는
  여전히 strip-only 라고 재확인하며 새 값-마스킹은 `llmCalls` 가 **아닌** 필드 대상이라고
  명시해 결정과 충돌하지 않는다.
- **1-d 와 변경 3 이 `12-webhook.md` Rationale 과 충돌 없이 상호 참조되는가**: 대체로 그렇다.
  위 INFO 에 적었듯 DB 잔존 위험 자체를 명시적으로 인정하는 한 문장이 빠져 있어 나란히 놓고
  읽으면 미세한 설명 공백이 남지만, 기존 §R17 텍스트에 그 근거가 이미 있어 모순은 아니다.
- **`nodeName`→`nodeLabel` 정정이 다른 인용처를 깨지 않는가**: 그렇다. spec 전역에 다른
  인용처가 없고, `3-error-handling.md:249` 는 별개 REST 에러 예시라 무관하다.

## 요약

target 은 이전 `--impl-prep` 라운드(`22_22_36`)가 지적한 5건의 WARNING(WS wire parity, ingestion/
egress 철학 상충, `nodeName`→`nodeLabel` drift, 잔여 ①·② flip, helper 명명 충돌) 중 spec 관련
4건을 모두 실제로 겨냥하며, 실측(코드·기존 spec 원문 대조) 결과 인용 라인·함수명·행 수·매핑 표가
전부 정확하다. 새로 도입하는 요구사항 ID 는 없고(§R17 카탈로그 불릿 추가일 뿐), 데이터 모델·API
계약·상태 전이·RBAC 어느 축에서도 CRITICAL 급 직접 모순은 발견되지 않았다. 유일한 잔차는 (a)
webhook Rationale 의 "DB 잔존 = 유출 표면" 논거를 1-d 가 명시적으로 인정·상쇄하지 않는 미세한
설명 공백과 (b) WS/EIA 두 문서의 마스킹 대상 필드 예시가 서로 다른 이름을 들어 "완전 열거"로
오독될 여지인데, 둘 다 문서 완성도 개선 권고 수준(INFO)이며 채택을 막을 사유는 아니다.

## 위험도

LOW
