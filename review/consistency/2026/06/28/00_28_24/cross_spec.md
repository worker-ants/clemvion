# Cross-Spec 일관성 검토 결과

**Target**: `spec/data-flow/0-overview.md`
**검토 기준**: spec/0-overview.md · spec/1-data-model.md · spec/5-system/14-external-interaction-api.md · spec/5-system/4-execution-engine.md · spec/5-system/15-chat-channel.md · spec/conventions/secret-store.md

---

## 발견사항

### [INFO] Mermaid 다이어그램에서 executionEvents$ 세 번째 subscriber 누락
- **target 위치**: `spec/data-flow/0-overview.md` §1.1 Mermaid flowchart (lines 95–96)
- **충돌 대상**: `spec/5-system/14-external-interaction-api.md` §R10 (§1027 "세 형제 listener")
- **상세**: 다이어그램은 `executionEvents$` fan-out 엣지를 CHCH(ChatChannelDispatcher)와 EIA(SseAdapter) 두 곳에만 그린다. 그러나 §1.2 텍스트와 EIA §R10 모두 `NotificationFanout`(또는 `NotificationDispatcher`)이 세 번째 형제 listener로 같은 subject를 구독한다고 명시한다. 다이어그램이 텍스트 설명과 불일치한다.
- **제안**: 다이어그램에 `NFAN[NotificationFanout]` 노드를 Backend subgraph에 추가하고 `WS -.->|executionEvents$ fan-out| NFAN` 엣지를 추가한다.

### [INFO] §1.2 WebSocket 항목의 subscriber 명칭 — "NotificationDispatcher" vs "NotificationFanout"
- **target 위치**: `spec/data-flow/0-overview.md` §1.2 WebSocket 행
- **충돌 대상**: `spec/5-system/14-external-interaction-api.md` §R10 §1027 ("`NotificationFanout` (notification-fanout.service.ts) — 단일 sink의 executionEvents$를 구독하는 실제 listener")
- **상세**: target §1.2는 "NotificationDispatcher 가 구독"이라고 기술하나, EIA §R10은 실제로 `executionEvents$`를 구독하는 서비스가 `NotificationFanout`(notification-fanout.service.ts)이고 `NotificationDispatcher`는 그 fanout이 호출하는 BullMQ enqueue-only facade임을 명확히 구분한다. 단, `websocket.service.ts` 코드 주석(line 7, 353)이 두 이름을 혼용하고 있어 strict한 모순은 아니다.
- **제안**: target §1.2 WebSocket 행을 "… `SseAdapter`(External Interaction)·`ChatChannelDispatcher`·`NotificationFanout`(→`NotificationDispatcher` 위임) 가 구독한다"로 정정해 EIA §R10 명칭과 일치시킨다. 장기적으로 `websocket.service.ts` 주석도 통일하는 것이 권장된다.

### [INFO] §1.2 Object Storage S3 key 약식 표기와 전체 형식의 내부 불일치
- **target 위치**: `spec/data-flow/0-overview.md` §1.2 Object Storage 행과 Rationale "KB 원본 문서 S3 key 구조"
- **충돌 대상**: `spec/0-overview.md` §2.7 S3 키 패턴 표
- **상세**: §1.2 본문은 `kb/{kbId}/{docId}/{filename}` (약식)을 쓰고, 동 문서 Rationale은 `kb/{kbId}/{documentId}/{sanitizedFilename}` (전체식)을 쓴다. `spec/0-overview.md` §2.7과 `spec/data-flow/6-knowledge-base.md`는 `kb/<kbId>/<docId>/<filename>` / `kb/{kbId}/{documentId}/{sanitizedFilename}` 두 표기를 혼용한다. 실질 의미는 동일하나 일관성이 낮다.
- **제안**: target §1.2를 Rationale과 `spec/0-overview.md §2.7`의 전체식 `kb/{kbId}/{documentId}/{sanitizedFilename}`으로 통일한다.

---

## 요약

`spec/data-flow/0-overview.md`는 기존 spec 영역(아키텍처 개요·데이터 모델·EIA·실행 엔진·Chat Channel·secret-store)과 구조적으로 잘 정합되어 있다. BullMQ 큐 카탈로그 17개 항목, 도메인 인덱스 15개, Redis-only seq(in-memory degrade 포함) 정책이 모두 관련 spec과 일치한다. 발견된 3건은 전부 INFO 수준의 명칭·다이어그램 완전성 이슈로, 어느 영역도 동작 불가 수준의 모순은 없다. 가장 주목할 항목은 Mermaid 다이어그램에서 `executionEvents$` 세 번째 subscriber(NotificationFanout)가 누락된 점이며, 이는 EIA §R10의 "세 형제 listener" 정의와 다이어그램 간 불일치를 유발한다.

---

## 위험도

LOW
