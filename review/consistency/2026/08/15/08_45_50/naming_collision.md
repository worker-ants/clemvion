# 신규 식별자 충돌 검토 — spec/5-system/ (--impl-prep)

## 조사 범위 보정 (선행 필수 기록)

프롬프트 번들이 `spec/5-system/14-external-interaction-api.md`(105,374자, 이 세션 작업
`plan/in-progress/eia-terminal-payload.md` 이 실제로 겨냥하는 문서)를 포함해 **16개 파일을
"컨텍스트 예산 초과" 로 통째로 절단**했다. 번들에 없다고 "내용 없음" 으로 판단하지 말라는
프롬프트 자체 경고에 따라, 해당 파일을 `Read` 로 직접 열어 §5(Inbound API)·§6(Outbound
Notification)·§7(데이터 모델) 전체를 실측했다. 이 보정 없이 번들만 봤다면 이번 작업의
핵심 표면(`error` 객체화, `nodeId`/`code` nullable, `durationMs`)을 전혀 검토하지 못했을
것이다 — 기존 memory 항목("consistency `--spec` 기본 예산이 conventions 를 통째로
떨군다")과 같은 클래스의 재발이며, 이 checker 를 재호출할 때도 동일 보정이 필요하다.

## 현재 상태 요약

`git status` 기준 이번 세션에 **`spec/` 파일 diff 는 0줄**이다 (`plan/in-progress/
eia-terminal-payload.md` 만 미스테이징 수정). 즉 "target 문서" 는 신규로 도입되는 식별자가
아니라 **이미 커밋된 현재 spec/5-system 상태**이며, plan 이 다음에 쓰려는 것은
`durationMs` 를 `execution.completed`/`failed`/`cancelled` 3종 전부에 채우는 작업이다
(§6 표를 `미구현 (Planned)` → `구현됨` 으로 뒤집는 것뿐 — **새 필드명을 만드는 게
아니라 이미 문서화된 필드의 상태 전환**). 아래는 (a) 현재 커밋된 상태의 신규 식별자
충돌 여부, (b) 예정된 `durationMs` 작업이 만들 잠재적 충돌을 함께 점검한 결과다.

## 발견사항

### [INFO] `durationMs` 는 이미 전역 컨벤션 — 충돌 없음, 다음 PR 작업과 정합

`spec/4-nodes/**` (Integration·Logic 노드 15+ 지점), `spec/2-navigation/14-execution-history.md`,
`spec/3-workflow-editor/4-ai-assistant.md`, `spec/5-system/6-websocket-protocol.md`
(`llmCalls[].durationMs`/`toolCalls[].durationMs`)가 전부 "ms 단위 소요시간" 의미로
`durationMs` 를 이미 쓰고 있다. `spec/4-nodes/4-integration/0-common.md §6.1` 은 과거
`meta.duration`(HTTP) 을 `meta.durationMs` 로 명시적으로 통일한 이력까지 있다. 이번 plan
이 `execution.completed`/`failed`/`cancelled` 최상위에 채우려는 `durationMs`(execution 총
소요시간)는 같은 단위 관례를 최상위 스코프로 확장하는 것으로, 기존 용법과 의미 충돌이
없다. WS 문서(`6-websocket-protocol.md` §4.1)의 `execution.node.completed.duration`(node
레벨, `Ms` 접미사 없음)과는 필드명이 다르지만 — 이는 EIA §6 표 자체가 "WS 계열은 같은
값을 `duration` 으로 표기, 전역 개명은 별건" 이라고 **이미 자기 문서에서 명시**한 기존
drift 라 이번에 새로 발생하는 충돌이 아니다.

- target 신규 식별자: `execution.completed`/`failed`/`cancelled` payload 최상위 `durationMs` (예정, 아직 미작성)
- 기존 사용처: `spec/4-nodes/4-integration/0-common.md:130-138`, `spec/2-navigation/14-execution-history.md:370,408`, `spec/5-system/6-websocket-protocol.md` §4.1/§4.4
- 상세: 의미·단위 모두 일치. 충돌 아님.
- 제안: 조치 불요.

### [INFO] `result.outputs` — 계약 미정의 상태에서 defer 결정은 충돌 회피 관점에서 타당

plan 이 `result.outputs` 를 다음 PR 에서도 제외하기로 한 근거(§6 표·§6.3 등 5곳 전부
"Planned" 뿐이고 shape·의미 문장이 0건)를 확인했다. `spec/conventions/chat-channel-adapter.md:367`
가 `execution.completed` 의 `result.outputs` 를 언급하지만 이 역시 소비 의도만 있고 shape
정의는 없다 — 새 식별자를 지금 채워 넣으면 **정의 없는 계약을 코드가 사실상 확정**하는
꼴이 되어, 이후 정식 planner 턴에서 shape 를 정의할 때 이미 배포된 필드와 충돌할 위험이
있다. defer 결정이 이 위험을 피한다.

- target 신규 식별자: (도입 안 함 — `result.outputs`)
- 기존 사용처: `spec/conventions/chat-channel-adapter.md:367` (소비 의도만, shape 미정의)
- 상세: 조기 도입 시 "정의 없는 계약 확정 → 사후 재정의와 충돌" 위험. plan 의 defer 는 이 위험을 정확히 피하는 방향.
- 제안: 조치 불요 (plan 결정 유지 권장).

### [INFO] `EIA-*` 요구사항 ID — 전량 이 문서 단독 소유, 충돌 없음

`14-external-interaction-api.md` 가 쓰는 `EIA-AU-01~08` · `EIA-IN-01~13` · `EIA-NF-01~07`
· `EIA-NX-01~12` · `EIA-RL-01~07` 전 ID 를 `spec/` 전체에서 grep 했다. 이 문서 밖에서
동일 ID 를 재사용하는 곳은 없다 (prefix `EIA-` 는 이 문서 전용 네임스페이스).

- 상세: 충돌 없음.
- 제안: 조치 불요.

### [INFO] `X-Clemvion-*` 헤더·`nodeId`/`code` nullable 필드 — 타 문서와 정합 확인됨

`X-Clemvion-Delivery`/`X-Clemvion-Signature` 등은 `spec/data-flow/15-external-interaction.md`,
`spec/conventions/chat-channel-adapter.md` 가 참조만 하고 재정의하지 않는다. `Execution.error`
의 `nodeId: "uuid" | null` / `code: "..." | null` 는 `spec/1-data-model.md:562` (`§2.14`
NodeExecution 절, `Execution.error` 도 함께 문서화)와 값·의미가 일치 — 앞선 planner 턴에서
이미 동기화됐다.

- 상세: 충돌 없음.
- 제안: 조치 불요.

### [WARNING] (신규 아님, 참고용) `resumed` 3중 의미 재사용 패턴 — 향후 신규 필드 추가 시 반복하지 말 것

`6-websocket-protocol.md` §4.2 는 (1) continuation ack 의 boolean `resumed` 필드, (2)
`execution.resumed` SSE/WS 이벤트 이름, (3) `NodeExecution` 재개 status enum 값 `"resumed"`
— 세 가지 다른 개념에 동일 토큰 `resumed` 를 재사용한다. 문서가 스스로 "**이 ack boolean
`resumed` 는 이름이 같은 `execution.resumed` 이벤트·`NodeExecution` status enum
`"resumed"` 와 별개다**" 라고 명시적으로 구분 주석을 달아 실질적 위험은 낮다. **이번
target 이 새로 만든 충돌이 아니므로 조치 대상은 아니다** — 다만 지금 진행 중인
`durationMs`/향후 `result.outputs` 작업이 새 필드명을 고를 때 이 패턴(같은 문자열을
스코프만 바꿔 재사용)을 반복하면 같은 종류의 모호성이 하나 더 쌓인다는 점을 참고로 남긴다.

- target 신규 식별자: 없음(기존 문서 상태에 대한 참고 기록)
- 기존 사용처: `spec/5-system/6-websocket-protocol.md` §4.2 (ack `resumed`), §4.1 (`execution.resumed` 이벤트), 실행 엔진 `NodeExecution` status enum
- 제안: 조치 불요. 차기 필드 명명 시 참고.

## 요약

이번 라운드에서 `spec/` 파일에 실제 diff 가 없어(`plan/` 문서만 수정) "target 문서" 는
사실상 이미 커밋된 `spec/5-system` 현재 상태였다. 그 상태와, plan 이 다음에 쓰려는
`durationMs` 3종 완성 작업 모두 기존 컨벤션·타 문서와 의미·단위가 일치해 요구사항
ID·엔티티/타입명·endpoint·이벤트명·환경변수·파일 경로 어느 관점에서도 CRITICAL 급
충돌을 찾지 못했다. 유일하게 주목할 점은 harness 가 핵심 대상 파일
(`14-external-interaction-api.md`)을 컨텍스트 예산으로 통째로 절단해 번들에서
빠뜨렸다는 것 — 이번엔 직접 `Read` 로 보정했으나, 같은 절단이 재발하면 다음 라운드
checker 가 이 문서의 신규 식별자를 전혀 못 보고 거짓 PASS 를 낼 구조적 위험이 있다.

## 위험도

LOW
