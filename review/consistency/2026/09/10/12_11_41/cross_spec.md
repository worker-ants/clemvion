STATUS: success

# Cross-Spec 일관성 검토 — `6-websocket-protocol.md` `## Overview` 삽입 draft

대상: `plan/in-progress/spec-draft-ws-protocol-intro.md` 가 제안하는, `spec/5-system/6-websocket-protocol.md`
의 `> 관련 문서:` 註와 `## 1. 연결` 사이에 삽입될 3단락 `## Overview`.

삽입 예정 본문 (검토 대상 그대로 인용):

> 본 문서는 **실행 중인 워크플로우와 프런트엔드 사이의 양방향 채널**을 정의한다 — 서버가 실행
> 진행 상황을 밀어 보내고(§4.1), 클라이언트가 실행 제어 명령을 보내고(§4.2), 노드가 사용자 입력을
> 기다릴 때 그 왕복을 중개한다(§4.4). 구독 단위는 execution·workflow·notifications·kb 채널이며
> (§3), 놓친 이벤트는 `seq` 기반으로 복구한다(§6.2).
>
> 읽기 전에 두 가지를 알아야 한다. **첫째, 전송 계층은 Socket.IO 다** — 본문의
> `{ type, id, payload }` 프레임 표기는 논리적 메시지 형태를 보이기 위한 추상화이고, raw
> WebSocket 프레이밍을 전제한 항목들(§1.2 서브프로토콜 인증 · §8 close 코드 등)은 **비채택**이다.
> 그 경계의 SoT 는 바로 아래 §1 의 「전송 계층 (구현 현실)」 註다. **둘째, 같은 실행 상태가 두
> 표면으로 나간다** — 내부 WS 와 외부 EIA 의 REST + SSE + Outbound Notification 이며, 명령·이벤트
> 매핑의 권위는 §4.7 이 갖는다. 외부 표면은 내부 WS 경로를 facade 로 감싼 **단일 구현 경로**여야
> 하므로, **이벤트나 명령의 형태를 고칠 때 한 표면만 보고 고치면 두 표면의 의미가 갈린다.**
>
> 실행 상태 전이 자체(Execution/NodeExecution 상태 머신·블로킹/재개 계약)는
> [실행 엔진](./4-execution-engine.md) 이, 에러 코드 어휘 규약은
> [conventions/error-codes.md](../conventions/error-codes.md) 가, 외부 호출자용 REST 표면은
> [External Interaction API](./14-external-interaction-api.md) 가 SoT 다. 본 문서는 그것들이
> **wire 에서 어떤 프레임으로 보이는가**를 정한다.

---

## 발견사항

### [CRITICAL] §6.2 는 "seq 기반 복구" 가 아니라 "snapshot 기반 복구" 다 — Overview 1문단이 대상 문서 자신의 §6.2 본문과 정면으로 어긋난다

- **target 위치**: Overview 1문단 마지막 절 — "놓친 이벤트는 `seq` 기반으로 복구한다(§6.2)."
- **충돌 대상**: 같은 문서 `spec/5-system/6-websocket-protocol.md` §6.2 「놓친 이벤트 복구」 본문(969~987행), §4.7 "5분 버퍼는 SSE 어댑터 소유"(921행), 그리고 `spec/5-system/14-external-interaction-api.md` §R7 "seq 동일 공유 — SSE 와 notification"(1260~1271행).
- **상세**: §6.2 는 스스로 소제목을 **"native WebSocket 복구 모델 — `execution.snapshot`"** 이라 달고, "재연결 후 채널을 다시 구독하면 서버는 해당 execution 의 **현재 전체 상태**를 1회성 `execution.snapshot` 이벤트로 발행한다... 끊긴 동안의 모든 중간 이벤트를 순서대로 재생하는 대신, 재구독 시점의 권위 있는 현재 상태를 한 번에 받는 방식"이라고 명시한다. 그 아래 문단은 한 술 더 떠 이를 명시적으로 대조한다 — **"`seq` 기반 정밀 재전송은 SSE 전송 표면의 메커니즘이다... native WS subscribe 명령이 아니라 SSE 어댑터가 `Last-Event-Id` 헤더로 제공한다... native WS 는 위 snapshot 으로 갈음한다."** 즉 본 문서(native WS)가 다루는 채널은 **snapshot 기반**으로 복구하고, `seq` 기반 정밀 재전송은 **EIA 의 SSE 어댑터**가 소유하는 별개 채널의 메커니즘이라고 §6.2 자신이 못박아 두었다. `§2.2` 의 `seq` 필드 설명조차 "재연결 시 놓친 이벤트 **감지**용"이라 적어 "감지"와 "복구"를 구분하며, "복구" 동작 자체는 §6.2 대로 snapshot 이다. `14-external-interaction-api.md §R7` 도 seq 공유를 "SSE 와 notification" 사이로 한정해 native WS 복구를 포함시키지 않는다.
  Overview 초안의 "놓친 이벤트는 seq 기반으로 복구한다(§6.2)"는 이 셋 모두와 반대 방향을 가리킨다 — §6.2 가 실제로 하는 말은 "native WS 는 seq 기반이 **아니라** snapshot 기반"이라는 것이다. 이 문장을 그대로 두면 도입부만 읽은 사람이 "재연결 시 seq 로 이벤트를 재생한다"고 잘못 이해하고, 클라이언트 구현·디버깅 시 `execution.snapshot` 을 무시하거나 `Last-Event-Id` 유사 로직을 native WS 에 잘못 기대할 위험이 있다.
- **제안**: 해당 절을 사실에 맞게 정정한다. 예: "놓친 이벤트는 재구독 시 `execution.snapshot` 으로 복구한다(§6.2) — `seq` 기반 정밀 재전송은 외부 EIA SSE 표면의 메커니즘이다(§4.7)." 처럼 두 메커니즘을 가르는 것이 안전하다. `seq` 자체는 감지·정렬용으로 남기고 "복구" 동사의 주어를 snapshot 으로 바꿀 것.

### [INFO] §3 채널 목록에서 `background:run:{id}` 채널이 빠졌다

- **target 위치**: Overview 1문단 — "구독 단위는 execution·workflow·notifications·kb 채널이며(§3)"
- **충돌 대상**: 같은 문서 §3.2 「채널 패턴」 표(123~131행) — 실제로는 5행: `execution:{executionId}` · `workflow:{workflowId}` · `kb:{documentId}` · `notifications:{userId}` · **`background:run:{id}`**.
- **상세**: 나열이 "등" 같은 비완결 표지 없이 4개만 적혀 있어, 처음 읽는 사람은 이것이 전체 목록이라고 오해하기 쉽다. Background 노드 실행 채널(`background:run:{id}`)은 §3.2 에 별도 행으로 존재하고 §3.3 인가 표에도 별도 행이 있어 사소한 항목이 아니다.
- **제안**: "execution·workflow·notifications·kb·background 채널" 로 5개를 모두 적거나, 나열 뒤에 "등" 을 붙여 예시임을 명시한다.

### [INFO] 1문단 서두 프레이밍이 문서 실제 소유 범위보다 좁다

- **target 위치**: Overview 1문단 첫 문장 — "본 문서는 **실행 중인 워크플로우와 프런트엔드 사이의 양방향 채널**을 정의한다"
- **충돌 대상**: 같은 문서 §4.3 「KB 문서 이벤트」(456행)·§4.5 「알림 이벤트」(858행) — 둘 다 "실행 중인 워크플로우" 와 무관한 채널(KB 임베딩/그래프 추출 상태, 사용자 알림)을 이 문서가 정의한다.
- **상세**: draft 작성자 스스로 plan 문서에서 "실제 무게중심은 §4(약 750줄)"라고 적어 이 프레이밍이 의도적 단순화임을 인지하고 있다. 다만 "정의한다"는 단정적 서술이 KB·알림 채널의 존재를 완전히 지워, 이 문서를 "실행 채널 문서"로만 규정하는 인상을 준다. 등급을 CRITICAL/WARNING 으로 올릴 정도는 아니다 — §4.3·§4.5 는 각각 20줄, 10줄 남짓이라 비중이 작고, Overview 가 모든 하위 채널을 나열할 의무는 없다.
- **제안**: 굳이 고칠 필요는 없으나, 여지가 된다면 "주로 실행 중인 워크플로우와..." 정도로 완화하거나 KB/알림 채널을 §3 언급 옆에 병기하는 방법이 있다.

### [INFO] 3문단 "에러 코드 어휘 규약" 표현은 `4-execution-engine.md` Overview 와 문구까지 동일 — 새 drift 아님, 다만 `error-codes.md` 자신의 명시적 scope 선언과는 결이 다르다

- **target 위치**: Overview 3문단 — "에러 코드 어휘 규약은 [conventions/error-codes.md] 가... SoT 다."
- **충돌 대상**: `spec/5-system/4-execution-engine.md` Overview 32행 — "에러 코드 어휘 규약은 [conventions/error-codes.md]." (정확히 같은 문구) / `spec/5-system/3-error-handling.md` Overview — "에러 코드의 **명명 규율**(의미 기반 명명·rename 안정성·UPPER_SNAKE_CASE)의 SoT 는 conventions/error-codes.md 이고, 본 문서는 표기·카탈로그·응답 envelope·처리 정책을 정의한다." / `spec/conventions/error-codes.md` 자신의 Overview — "에러 코드의 **명명·안정성 규율**만 정의한다. 책임 경계: **카탈로그·분류·트리거**: `5-system/3-error-handling.md §1` (SoT)."
- **상세**: `conventions/error-codes.md` 는 스스로 "카탈로그(무엇이 어떤 뜻인가)는 내 책임이 아니다, `3-error-handling.md §1` 이 SoT"라고 명시한다. 그런데 이 문서와 `4-execution-engine.md` 양쪽 Overview 는 그 경계를 "명명 규율" 대신 "어휘 규약"이라는 표현으로 뭉뚱그린다 — "어휘"는 통상 "무엇이 존재하고 무슨 뜻인가(카탈로그)"로 읽히기 쉬워, `error-codes.md` 자신의 scope 선언과 결이 어긋난다. **다만 이 표현은 draft 가 새로 만든 것이 아니라 `4-execution-engine.md`(status: implemented, 기존 merge 완료 문서)의 기존 문구를 그대로 재사용한 것**이므로, 이 draft 만의 신규 결함이 아니라 이미 정착된(그리고 사소하게 부정확한) repo 관행을 답습한 것이다. `3-error-handling.md`가 사용하는 더 정확한 용어("명명 규율")를 두고 draft 가 그것을 따르지 않은 점은 아쉽지만, 자매 문서(`4-execution-engine.md`)와의 **표현 일관성**은 오히려 지켜졌다.
- **제안**: 이 draft 단독으로 고칠 필요는 없다(자매 SoT 위임 관행을 그대로 따랐을 뿐이다). 다만 향후 `error-codes.md`/`3-error-handling.md`/`4-execution-engine.md` 세 문서의 "명명 규율" vs "어휘 규약" 표현을 통일하는 별도 후속 정리를 고려할 만하다 — 이번 draft 의 스코프는 아니다.

### [INFO] 3문단이 EIA 를 "REST 표면"으로만 지칭 — 같은 draft 2문단이 이미 REST+SSE+Notification 3채널로 규정한 것과 어긋난다

- **target 위치**: Overview 3문단 — "외부 호출자용 **REST 표면**은 [External Interaction API] 가 SoT 다."
- **충돌 대상**: 같은 draft 2문단 — "내부 WS 와 외부 EIA 의 **REST + SSE + Outbound Notification**" / `14-external-interaction-api.md` 자신의 Overview — "두 채널: Outbound(Notification Webhook) · Inbound(Interaction REST + SSE)."
- **상세**: EIA 스펙은 REST 뿐 아니라 SSE(스트림 수신)·Outbound Notification(webhook push)까지 세 채널을 소유하는 문서다. 3문단이 이를 "REST 표면"으로 축약하면, 바로 앞 2문단이 명시한 세 채널 구성과 스코프가 어긋나 보인다. cross-spec 관점에서는 `14-external-interaction-api.md` 자신이 선언한 소유 범위(2채널/3표면)보다 draft 의 3문단이 좁게 서술하는 셈이다.
- **제안**: "외부 호출자용 REST/SSE/Notification 표면은..." 처럼 2문단과 동일한 3채널 표현으로 맞추거나, 3문단에서 EIA 를 지칭할 때 "외부 인터랙션 표면"처럼 채널 중립적 표현을 쓴다.

---

## 검증 완료 — 충돌 없음 (참고용 확인 사항)

- **§4.1/§4.2/§3/§4.4 섹션 내용 매핑**: 정확하다. §4.1 = "실행 이벤트 (Server → Client)"(진행 상황 push), §4.2 = "실행 제어 명령 (Client → Server)", §3 = "채널 구독", §4.4 = "사용자 입력 대기 이벤트 상세" — 이 §4.4 는 이벤트 정의뿐 아니라 `execution.submit_message`/`execution.end_conversation` 등 클라이언트 발신 명령까지 함께 다뤄 draft 가 말하는 "왕복 중개" 서술과 부합한다.
- **§1.2·§8 의 "비채택" 등급**: 정확하다. 문서 자신의 §1 「전송 계층 (구현 현실)」 註와 `## Rationale`의 `R-wontdo-rawws-rest` 는 서브프로토콜 인증(§1.2)과 raw close 코드(§8) 둘 다를 "raw-WS 전제 (전송계층 구조적 부적용)" 갈래로 묶어 **비채택 (won't-do)** 로 명시한다. 두 항목 다 "일부 구현"·"계획" 이 아니라 동일 등급이므로, draft 가 이 둘을 묶어 "비채택"이라 부른 것은 옳다(§1.3·§4.2 는 별도 "REST 대체로 충분" 갈래지만 등급은 같다).
- **§4.7 의 권위·facade 주장**: 정확하다. §4.7 본문이 "두 표면의 의미가 분기되지 않도록 본 §4.7 의 매핑 표가 권위적"이라 명시하고, "핵심 규약" 블록의 마지막 항목이 "**단일 구현 경로**: 외부 표면은 내부 WebSocket 의 명령/이벤트 처리 경로를 facade 로 감싼 형태로만 구현해야 한다"고 적는다. draft 의 인용은 과장이 아니다.
- **4-execution-engine.md Overview 가 이미 본 문서 §4.2 를 WS ack SoT 로 인용**: 확인됨. `4-execution-engine.md` 22행 이하 Overview 32행 — "> 외부(REST) 진입점 매핑·외부 표면은 [External Interaction API], **WS ack 표면은 [WebSocket 프로토콜 §4.2] 가 SoT**." draft 의 주장과 정확히 일치.
- **역방향 확인 — 다른 문서가 이미 WS 채널에 대한 orienting statement 를 갖고 있어 이번 Overview 와 충돌/중복하는가**: 충돌 없음.
  - `spec/5-system/2-api-convention.md §10` (WebSocket): §10.2~10.4 는 이미 "상세 프로토콜은 [WebSocket 프로토콜 상세] 참조"로 위임하며 자체적으로 개요를 주장하지 않는다. 단, §10.4 상단 두 줄("재연결 시 마지막 수신 이벤트 ID 전달 → 놓친 이벤트 재전송")은 raw-WS 전제 시절 문구가 아직 정정되지 않은 채 남아 있고, 바로 아래 blockquote("서버가 끊은 경우... 놓친 이벤트는 **스냅샷**으로 복구")가 이를 사실상 뒤집는 형태다. 이는 draft 가 만든 문제가 아니라 **기존에 존재하던 seq/snapshot 혼선의 방증**이며, 위 CRITICAL 발견의 근거를 강화한다(별도 후속 정리 대상이지 이 draft 의 책임 범위는 아니다).
  - `spec/3-workflow-editor/3-execution.md §8` (실행 엔진 통신): 자체 개요 없이 "상세 프로토콜: ... [WebSocket 프로토콜 상세] 참조"로 전면 위임하고, 필드 계약 SoT 도 WS §4.1 을 가리킨다. 새 Overview 와 중복·충돌 없음.
  - 두 문서 모두 새 Overview 가 하는 "SoT 경계 선언"을 스스로 하지 않으므로, 이번 삽입이 기존 orienting statement 를 대체하거나 이중화하는 상황은 없다.

---

## 요약

이번 draft 는 대체로 정확하다 — §4.1/§4.2/§3/§4.4 섹션 매핑, §1.2·§8 의 "비채택" 등급, §4.7 의 권위·facade 서술, `4-execution-engine.md` Overview 의 WS §4.2 인용 존재 등 다섯 가지 핵심 사실 주장은 모두 대상 문서·인접 spec 과 정합했다. 그러나 1문단 마지막 절 "놓친 이벤트는 `seq` 기반으로 복구한다(§6.2)"는 같은 문서 §6.2 자신이 명시적으로 부인하는 서술이다 — §6.2 는 native WS 복구가 `execution.snapshot` 기반이며 `seq` 기반 정밀 재전송은 별도 채널(EIA SSE 어댑터)의 메커니즘이라고 스스로 못박아 두었고, `14-external-interaction-api.md §R7` 도 seq 공유를 SSE/notification 사이로 한정해 이를 뒷받침한다. Overview 는 독자가 본문 전체를 읽기 전에 접하는 첫 요약이라 이 한 줄의 오류가 미치는 오도 범위가 크므로 반드시 정정이 필요하다. 그 외에는 채널 나열 완결성(background 채널 누락)·EIA 스코프 표현(REST vs REST+SSE+Notification)·에러 코드 SoT 문구("어휘 규약")의 정밀도 등 INFO 수준의 사소한 다듬을 점만 있으며, 이들 중 다수는 이미 정착된 자매 문서 관행을 따른 것이라 이 draft 만의 신규 결함으로 보기 어렵다. 역방향 검토에서도 `2-api-convention.md §10`·`3-execution.md §8` 은 이미 본 문서에 위임하는 구조라 새 Overview 와 중복·충돌하지 않는다.

## 위험도

MEDIUM — 문서 전용 변경이고 대부분의 사실 주장은 검증됐으나, §6.2 관련 CRITICAL 오류 1건이 대상 문서 자신의 본문과 직접 모순되며 Overview 라는 위치 특성상 오독 파급力이 크다. 그 한 줄만 정정하면(예: snapshot 기반으로 표현 교체) 나머지는 채택 가능한 수준이다.
