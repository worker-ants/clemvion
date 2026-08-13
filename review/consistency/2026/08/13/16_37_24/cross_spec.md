# Cross-Spec 일관성 검토 — spec-draft-eia-notification-payload-contract

## 검토 방법

target draft(6차, `--spec` 5회 반려 이력 보유)가 제안하는 변경 — EIA §6 도입부 신설(필드 집합 SoT
단일화), WS §4.1 종결 3행 축약, `chat-channel-adapter.md` §1.2 축약, `15-chat-channel.md:76` /
`chat-channel-adapter.md:145·354` line-536 인용 제거 — 이 겨냥하는 필드(`finalNodeId`/`finalPort`/
`nodeCount`/`failedNodeId`/`durationMs`/`cancelledBy`/`error`)를 `spec/**` 전역에서 grep 하여 draft
가 언급하지 않은 잔여 참조가 있는지, 그리고 draft 가 인용하는 선례(PR #945 WS Rationale, R3, EIA §6.2
blockquote, §6.5 실제 위치 675행)가 실제로 그 내용대로 존재하는지 원본 파일을 직접 읽어 대조했다
(번들 파일 대부분이 컨텍스트 예산 초과로 절단되어 있어 `spec/5-system/14-external-interaction-api.md`,
`spec/5-system/6-websocket-protocol.md`, `spec/conventions/chat-channel-adapter.md`,
`spec/5-system/15-chat-channel.md`, `spec/1-data-model.md` 등을 직접 Read).

## 발견사항

이번 라운드에서 새로운 CRITICAL/WARNING 은 발견하지 못했다. 아래는 검증 결과와 참고용 INFO 1건이다.

- **[INFO]** WS 프로토콜의 `### 4.4` 헤딩 중복(target 무관 — 기존 결함)
  - target 위치: 해당 없음 (target 은 이 절을 건드리지 않음)
  - 충돌 대상: `spec/5-system/6-websocket-protocol.md` L378 `### 4.4 사용자 입력 대기 이벤트 상세` 와
    L747 `### 4.4 알림 이벤트` — 같은 문서 안에 `4.4` 헤딩이 두 번 등장하고, 그 사이에 L724
    `### 4.3 KB 문서 이벤트` 가 순서를 벗어나 끼어 있다 (실제 문서 순서: 4.1 → 4.2 → 4.4(입력대기) →
    4.3(KB) → 4.4(알림, 중복) → 4.5 → 4.6).
  - 상세: 마크다운 앵커는 슬러그가 달라(`#44-사용자-입력-대기-이벤트-상세-executionwaiting_for_input`
    vs `#44-알림-이벤트`) 기존 링크는 깨지지 않지만, 사람이 목차 번호로 "WS §4.4" 를 읽을 때 어느
    절인지 모호하다. target draft 는 여러 곳에서 "WS §4.4" 를 인용하는데(예: EIA §6.2 blockquote,
    chat-channel-adapter.md §1.2), 실제로 가리키는 절은 항상 L378(사용자 입력 대기)이고 이는 앵커
    기준으로 정확하다 — target 의 인용 자체는 틀리지 않았다.
  - 제안: target 의 스코프 밖이므로 이번 PR 에서 손댈 필요 없음. 별도 spec-doc 정리 항목으로만 기록
    권장 (번호 재부여 필요 — WS 문서는 이번 draft 가 건드리지 않는 파일이라 이 draft 의 "재넘버링
    없음" 원칙과도 무관).

## 검증한 항목 (충돌 없음 확인)

- **필드 잔여 참조 전수 검사**: `finalNodeId`/`finalPort`(EIA §6.3 L644-645, chat-channel-adapter.md
  §1.2 L146) · `nodeCount`(WS §4.1 L177) · `failedNodeId`(WS §4.1 L178) 를 `spec/` 전역 grep 한 결과,
  draft 가 이미 식별한 지점 외의 잔여 참조는 없음(`14-execution-history.md` 의
  `totalNodeCount`/`completedNodeCount`/`failedNodeCount` 와 `4-ai-assistant.md` 의 i18n
  `{nodeCount}` 는 이 종결 이벤트 payload 와 무관한 별개 필드 — 오탐 아님을 직접 대조로 확인).
- **"line 536" 인용 6곳**: spec 3곳(`chat-channel-adapter.md:145`·`:354`,
  `15-chat-channel.md:76`) 이 draft 의 명시 목록과 정확히 일치. §6.5 실제 헤딩 위치는 L675 로,
  draft 의 "536은 stale" 주장이 맞음.
- **"세 wire(webhook/SSE/WS)" 주장**: EIA §6.2 L615 blockquote("SSE 스트림은 notification envelope
  재구성 없이 fanout wire 를 그대로 전송")와 WS §4.6 L788-805 매핑 표를 대조 확인 — draft 의 정정이
  기존 spec 서술과 정합하며 WS §4.6 표 자체는 이번 draft 변경 대상이 아니므로(이벤트 이름 매핑만 다룸,
  필드 열거 없음) 추가 갱신 불필요.
- **선례 인용 정확성**: WS `## Rationale`의 "§4.4 wire 필드 caveat"(PR #945, L958-963)와
  `chat-channel-adapter.md` R3(L527-529, "구체 필드 갱신은 항상 EIA spec 우선")를 원문 대조 — draft 의
  인용·해석이 원문과 일치.
- **§6 도입부 삽입 위치**: `## 6.`(L552)과 `### 6.1`(L554) 사이가 실제로 비어 있어(L553 공백) draft
  주장대로 재넘버링 없이 도입부 삽입 가능.
- **데이터 모델**: `spec/1-data-model.md` 에 `finalNodeId`/`finalPort`/`nodeCount`/`failedNodeId`
  필드가 전혀 없음 — draft 의 "엔진에 개념이 없다" 주장과 정합, Execution 엔티티 차원 충돌 없음.
  `duration_ms` (DB 컬럼, snake_case)는 이벤트 payload 의 `durationMs` 와 자연스러운 camelCase 대응이라
  충돌 아님.
- **RBAC/권한**: target 은 payload 필드 문서화 재구성이며 권한·역할 변경을 포함하지 않음 — 5번 관점
  해당 없음.
- **요구사항 ID**: target 은 신규 `EIA-*` ID 를 부여하지 않음(구조 재편성) — 3번 관점 충돌 없음.
- **provider 문서(discord/slack/telegram)·SDK(`2-sdk.md`)·data-flow(`3-execution.md`·
  `15-external-interaction.md`)**: `execution.completed/failed/cancelled` 를 언급하지만 이벤트 이름
  또는 `error.code`/`cancelledBy` 단일 필드 참조뿐, payload 전체 구조를 재열거하지 않아 draft 의
  변경과 충돌하지 않음.

## 요약

target draft 가 정의하는 EIA §6 필드 집합 단일화·webhook/SSE 봉투 분리·WS §4.1 축약·
`chat-channel-adapter.md`/`15-chat-channel.md` line-536 인용 제거는, `spec/**` 전역에서 관련 필드·
인용을 재검색한 결과 draft 자신이 이미 식별한 범위를 벗어나는 잔여 충돌이 없었다. 데이터 모델·
API 계약·상태 전이·RBAC·계층 책임 어느 관점에서도 새로운 모순은 발견되지 않았고, draft 가 근거로
드는 기존 spec 서술(EIA §6.2 blockquote, WS §4.6 매핑 표, PR #945 Rationale, chat-channel-adapter.md
R3)도 원문과 정확히 일치했다. 유일한 지적은 target 과 무관한 WS 프로토콜 문서의 기존 `### 4.4`
헤딩 중복(INFO, 별도 후속 권장)이다.

## 위험도

NONE
