STATUS=success naming_collision review complete — CRITICAL 0 / WARNING 1 / INFO 1

===REPORT_MARKDOWN_BELOW===

# 신규 식별자 충돌 검토 — `spec-draft-eia-notification-payload-contract.md`

## 검토 범위 확인

target 은 `spec/5-system/14-external-interaction-api.md` §6.3~§6.5, `spec/5-system/6-websocket-protocol.md`
§4.1, `spec/conventions/chat-channel-adapter.md` §1.2 를 수정하는 draft 다. 새 spec 파일을
만들지 않고, 새 요구사항 ID·엔티티명·API endpoint·이벤트명·ENV var 를 도입하지도 않는다 —
**기존에 이미 선언된 계약(필드 shape)을 실제 emit 에 맞춰 재작성**하는 성격이라 "신규 식별자"
자체가 거의 없다. 실측 결과:

- 요구사항 ID: 신규 부여 없음. `EIA-IN-04`(L74)·`EIA-RL-07`(L145)·`EIA-RL-02`(L140) 참조는
  전부 기존 ID 그대로 인용 — 새 ID 미부여, 충돌 없음.
- 엔티티/타입명: `EiaEvent`·`EiaCompletedEvent`·`EiaFailedEvent`·`EiaCancelledEvent`
  (`codebase/backend/src/modules/chat-channel/types.ts:308-410`) 는 기존 타입이고, target 은
  그 필드 구성(3 variant 의 `finalNodeId`/`finalPort` 삭제, `result`/`durationMs` optional화)만
  바꾼다. 신규 타입명 없음.
- API endpoint: 신규 endpoint 없음. 기존 outbound notification 이벤트 3종(`execution.completed`
  /`failed`/`cancelled`)의 payload 재정의뿐.
- 이벤트/메시지명: 이벤트 이름(`execution.completed` 등)은 그대로 — EIA/WS/adapter 세 문서가
  이미 같은 이름을 쓰던 걸 payload 만 정합화한다. 신규 이벤트명 없음.
- ENV var·config key: 신규 도입 없음 (`WEBCHAT_IDLE_REAP_GRACE_MS`, `EXECUTION_QUEUE_WAIT_TIMEOUT`
  등은 기존 값 인용).
- 파일 경로: 신규 spec 파일 없음. `plan/in-progress/spec-draft-eia-notification-payload-contract.md`
  파일명 자체도 기존 `spec-draft-*` 컨벤션(동 디렉터리의 `spec-draft-eia-r8-alignment.md` 등)과
  일치, 겹치는 기존 파일 없음. 인접 in-progress plan(`spec-draft-eia-r8-alignment.md`)은 같은
  `14-external-interaction-api.md` 를 건드리지만 §R8/§2.2 대 §6.3~§6.5 로 섹션이 갈려 충돌 없음.

## 발견사항

- **[WARNING]** `duration`→`durationMs` 통일이 같은 표 안에서 절반만 적용돼 새 비대칭을 만든다
  - target 신규 식별자: WS §4.1 `execution.completed`/`failed`/`cancelled` 세 행의 필드명을
    `duration` → `durationMs` 로 통일 (target §3 "필드명 통일" 항목)
  - 기존 사용처: `spec/5-system/6-websocket-protocol.md:183` `execution.node.completed` 행이
    같은 표 안에서 여전히 `duration` (Ms 없음) 을 쓴다. 이 행은 target 의 수정 대상 3행("종결
    3행 전부" = completed/failed/cancelled) 에 포함되지 않는다.
  - 상세: 수정 전에는 §4.1 표의 최상위(execution/node 레벨) 필드가 전부 `duration` 로
    일관됐고, 중첩(turn/tool/llm-call) 레벨만 `durationMs` 였다(`execution.ai_message`:189,
    `execution.tool_call_completed`:191, `llmCalls[].durationMs`:501). target 적용 후에는
    같은 표 안에서 `execution.completed`/`failed`/`cancelled` 는 `durationMs`, 바로 아래
    `execution.node.completed` 는 `duration` 로 남아 **표 하나 안에 같은 개념(경과 시간, ms
    단위)이 다시 두 이름으로 갈라진다** — target 이 스스로 "같은 개념이 두 이름" 이라며 없애려던
    바로 그 비대칭이 표 안에서 재생산된다. CRITICAL 로 보지 않는 이유는 두 필드가 서로 다른
    이벤트(스코프: execution 전체 vs 개별 노드)라 스키마 충돌은 아니기 때문이다.
  - 제안: `execution.node.completed.duration` 도 `durationMs` 로 함께 통일하거나(가장 깔끔),
    범위 밖으로 남긴다면 target 본문(§3 "필드명 통일" 절)에 "이번 통일은 execution-level 3행
    한정, `node.completed` 는 별도 후속" 이라고 명시해 다음 리뷰 라운드가 "절반만 고쳤다" 로
    다시 반려하지 않도록 한다(이 draft 는 1차 draft 가 정확히 이 형태의 CRITICAL 로 반려된
    이력이 있다 — target 본문 "1차 draft 가 왜 반려됐나" 절 참조).

- **[INFO]** `durationMs` 가 스코프별로 "구현됨"과 "Planned" 를 동시에 표기하게 된다
  - target 신규 식별자: EIA §6.3~§6.5 / WS §4.1 의 execution-level `durationMs` (target 결정상
    "미구현 (Planned)" 마커 부착 예정)
  - 기존 사용처: `spec/5-system/6-websocket-protocol.md:189,191,501,504` 의 turn/tool-call/
    llm-call 레벨 `durationMs` — 이미 구현·라이브 필드로 서술됨(Planned 아님)
  - 상세: 필드명 동일(`durationMs`)이지만 스코프(전체 실행 vs 개별 턴/tool/LLM 호출)가 다르고
    구현 상태도 다르다(신규 execution-level 은 Planned, 기존 하위 레벨은 이미 구현). 이름만
    보고 "durationMs 는 이미 다 구현돼 있다" 로 오독할 여지가 있다. 실질적 충돌(다른 shape 를
    가리키는 동일 식별자)은 아니라 CRITICAL/WARNING 은 아니고, target 이 이미 "미구현 (Planned)"
    마커라는 저장소 기존 컨벤션(`spec/2-navigation/*`, `spec/3-workflow-editor/*` 등 다수 선례
    확인됨)을 그대로 재사용하고 있어 표기 자체는 안전하다.
  - 제안: EIA §6.3 재작성 시 `durationMs` 옆에 "(execution 전체 소요시간 — WS `ai_message`/
    `tool_call_completed`/`llmCalls[]` 의 턴·호출 단위 `durationMs` 와는 스코프가 다름)" 한
    줄만 덧붙이면 충분하다.

## 요약

target 이 새로 도입하는 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·ENV var·spec 파일 경로는
없다 — 기존에 이미 선언돼 있던 outbound notification 3 이벤트의 payload 서술을 실제 emit 에
맞춰 재작성하는 spec 정합화 작업이라 "신규 식별자 충돌" 범주의 CRITICAL 은 발견되지 않았다.
다만 target 스스로 내세운 "EIA `durationMs` / WS `duration` 필드명 통일" 이 대상 표
(`WS §4.1`) 안에서 정확히 3행(completed/failed/cancelled)에만 적용되고 바로 인접한
`execution.node.completed.duration` 은 그대로 남아, 통일의 목적(표 안 이름 분열 제거)이
표 안에서 부분적으로만 달성된다 — 1차 draft 가 CRITICAL 로 반려됐던 "범위를 절반만 잡는" 패턴과
같은 형태이므로 WARNING 으로 표시해 명시적 처분(포함 또는 명문 제외)을 권한다.

## 위험도

LOW
