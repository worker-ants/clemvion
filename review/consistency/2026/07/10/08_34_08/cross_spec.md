# Cross-Spec 일관성 검토 — spec/5-system/ (impl-done, diff-base=origin/main)

검토 대상(payload 로 전달된 target 본문): `spec/5-system/1-auth.md`(전문) · `spec/5-system/10-graph-rag.md`(전문).
비교 대상(payload 동봉 + 직접 확인): `spec/0-overview.md`, `spec/1-data-model.md`, `spec/2-navigation/6-config.md`,
`spec/2-navigation/9-user-profile.md`, `spec/2-navigation/5-knowledge-base.md`, `spec/5-system/6-websocket-protocol.md`,
`spec/5-system/8-embedding-pipeline.md`, `spec/5-system/9-rag-search.md`, `spec/4-nodes/3-ai/1-ai-agent.md`,
`spec/conventions/audit-actions.md`, `spec/conventions/error-codes.md`, `spec/data-flow/12-workspace.md`,
`spec/data-flow/2-auth.md`, `spec/7-channel-web-chat/4-security.md`, 및 관련 코드
(`codebase/backend/src/modules/knowledge-base/**`, `codebase/backend/src/modules/websocket/websocket.service.ts`,
`codebase/frontend/src/lib/websocket/use-kb-events.ts`). 모든 확인은 워크트리
`/Volumes/project/private/clemvion/.claude/worktrees/conversation-thread-secret-hardening-6477bb` 절대경로 기준.

> 참고: payload 의 "구현 변경 사항" diff 섹션은 이번 회차에 실제로 동봉되지 않았다(target 본문 dump 만 제공). 현재
> HEAD 와 `origin/main` 의 실제 diff(`git diff origin/main...HEAD`)는 `spec/5-system/14-external-interaction-api.md`
> (R17 terminal 마스킹) 1개 파일 16줄 변경뿐이며, payload 가 지시한 target(`1-auth.md`·`10-graph-rag.md`)과는 무관하다.
> 이는 orchestrator 페이로드 구성 시점의 mismatch 로 보이나, 본 checker 는 지시받은 payload 원문을 그대로 따라 검토했다.
> `14-external-interaction-api.md` 자체의 cross-spec 여부는 이번 payload 범위 밖이라 다루지 않았다(별도 재검토 권장).

## 발견사항

- **[WARNING]** Graph KB WebSocket 이벤트 카탈로그 — `6-websocket-protocol.md` 의 "1:1 대응"·"12개" 주장이 `10-graph-rag.md` 자체 표·코드와 불일치
  - target 위치: `spec/5-system/10-graph-rag.md` §6 "WebSocket 이벤트" (5개 이벤트 표 + `document:graph_error` dead-declared 각주)
  - 충돌 대상: `spec/5-system/6-websocket-protocol.md` §4.3 "KB 문서 이벤트" (L722, L735, L739) · `spec/2-navigation/5-knowledge-base.md` §2.7.1 (L182)
  - 상세:
    - `6-websocket-protocol.md` L722 는 "backend 권위 정의는 `WebsocketService.emitKbEvent` 의 `KbEventType` union (**12개**)" 라고 명시하고, L735 는 "그래프 추출 이벤트 (**6개**)", L739 는 `document:graph_started`/`_progress`/`_completed`/**`_error`**/`_retry`/`_failed` 를 "임베딩 이벤트와 **1:1 대응**" 이라고 서술한다.
    - 그러나 실제 backend union(`codebase/backend/src/modules/websocket/websocket.service.ts` L335-346)은 **11개** 멤버뿐이며 `document:graph_error` 는 아예 선언돼 있지 않다(embedding 쪽 6개엔 `document:embedding_error` 가 있지만, graph 쪽은 `started`/`progress`/`completed`/`retry`/`failed` 5개뿐). "12개"·"그래프 6개"·"1:1 대응" 세 서술 모두 코드와 어긋난다.
    - `10-graph-rag.md` §6 자신은 정확히 5개 이벤트만 표로 나열하고 `document:graph_error` 는 "타입 union 에만 선언되고 emit 되지 않는 dead-declared" 라고 명시한다 — 이는 실제로는 **frontend** `codebase/frontend/src/lib/websocket/use-kb-events.ts` L76 의 `KB_EVENT_NAMES`(12개, `document:graph_error` 포함)에서 선언되는 것이며, `10-graph-rag.md` 각주가 "`websocket.service.ts` 의 이벤트 타입 union" 이라고 지목한 위치는 실제와 다르다(부수적 부정확 — backend union 은 애초에 이 값을 선언조차 하지 않는다).
    - 추가로 `document:embedding_error` 도 코드 상 실제로는 emit 되는 지점이 없다(`embedding.service.ts` 는 `_retry`/`_failed`/`_started`/`_progress`/`_completed` 만 emit). 즉 embedding 쪽 `_error` 도 dead 이지만 `6-websocket-protocol.md` L731 은 이를 "in-flight 일시 오류 — `_retry` 또는 `_failed` 가 곧 따라온다" 는 **살아있는 신호**처럼 서술해, graph 쪽 대칭 서술("1:1 대응")과 함께 두 이벤트 모두의 실제 동작(둘 다 never-emitted)을 오도한다.
    - `2-navigation/5-knowledge-base.md` L182 는 `document:graph_started`/`_progress`/`_completed`/`_error`/`_retry`/`_failed` 를 캐치올로 나열하며 `_error` 가 미emit 이라는 각주가 없어, 이 문서만 읽는 프론트/QA 담당자는 `_error` 를 실제 발생 가능한 이벤트로 오인할 수 있다.
  - 제안: `6-websocket-protocol.md` §4.3 을 실제 backend union(11개: embedding 6 + graph 5)에 맞춰 "그래프 추출 이벤트 (5개)" 로 정정하고 `document:graph_error`/`document:embedding_error` 를 목록에서 제거하거나 "declared but never emitted" 각주를 추가한다. `10-graph-rag.md` §6 각주의 선언 위치("websocket.service.ts")도 실제 소스(frontend `use-kb-events.ts`)로 정정하거나, 더 안전하게는 프론트 쪽의 미사용 `document:graph_error` 구독 자체를 제거해 3개 문서 + 2개 소스 파일 사이의 "declared-but-dead" 잔재를 정리하는 편을 권한다. `2-navigation/5-knowledge-base.md` L182 는 `10-graph-rag.md` §6 로 포인터만 남기거나 동일 각주를 추가한다.

- **[INFO]** `2-navigation/5-knowledge-base.md` 의 WS 이벤트 나열이 `10-graph-rag.md` 대비 상세도가 낮음 (위 WARNING 과 동일 근본 원인)
  - target 위치: `spec/5-system/10-graph-rag.md` §6
  - 충돌 대상: `spec/2-navigation/5-knowledge-base.md` §2.7.1 (L182)
  - 상세: 위 WARNING 항목의 부분집합. `5-knowledge-base.md` 는 UI 관점에서 이벤트를 인용만 할 뿐 SoT 를 자처하지 않으므로(§ 자체가 `10-graph-rag.md` 를 가리키지 않지만 각주도 없음) 등급을 별도 INFO 로 낮춰 기록한다. WARNING 항목 수정 시 함께 정리되면 자동 해소된다.
  - 제안: 별도 조치 불요 — 위 WARNING 수정에 흡수.

## 검토 결과 — 충돌 없음으로 확인된 주요 항목 (참고용)

아래는 이번 6개 관점으로 교차 검증했으나 **충돌을 발견하지 못한** 주요 영역이다 (근거를 남겨 재검토 비용을 줄인다):

- **데이터 모델**: `1-auth.md` 의 User 필드(`password_hash`, `email_verify_token`, `pending_email`, `email_change_token`, `totp_recovery_codes`, `webauthn_recovery_codes` 등 SHA-256 해시·TTL)와 `1-data-model.md §2.1 User` 정의가 전 필드 일치. `10-graph-rag.md` §2 의 KnowledgeBase 추가 컬럼·Entity·Relation·ChunkEntity 스키마(제약조건·인덱스 포함)도 `1-data-model.md §2.11–§2.12.4` 와 완전히 일치.
- **API 계약**: `1-auth.md` §5 엔드포인트 표와 `2-navigation/9-user-profile.md §6.1`(세션·로그인이력·이메일변경·초대) · `2-navigation/6-config.md`(AuthConfig CRUD/reveal) 간 라우트·권한·상태코드가 서로 포인터 관계로 정확히 정합. `10-graph-rag.md` 의 `retry-failed`/`re-extract`/`graph/stats` 엔드포인트도 `2-navigation/5-knowledge-base.md §3 API` 표와 일치.
- **요구사항 ID**: `KB-GR-*` 접두 요구사항 ID 는 `spec/` 전체에서 `10-graph-rag.md` 에만 존재 — 중복/재사용 없음. 마이그레이션 번호(V025–V027, V037, V040, V058)도 각각 단일 spec 문서에서만 참조되어 충돌 없음.
- **상태 전이**: `Document.embedding_status`/`graph_extraction_status` 5-state enum(`pending/processing/completed/error/failed`)의 의미가 `1-data-model.md`·`8-embedding-pipeline.md §9.2`·`10-graph-rag.md §7` 전부 동일. `login_history.event` enum(`webauthn_failed` 포함)도 `1-auth.md §4.3`·`1-data-model.md §2.18.2`·마이그레이션 V058 전부 일치.
- **권한/RBAC**: `1-auth.md §3.2` RBAC 매트릭스(Auth Config CRUD/R, Reveal Admin+ 전용 등)가 `2-navigation/6-config.md` 의 실제 엔드포인트별 권한 주석과 정확히 일치. `activeWorkspaceId` 클레임·header-first 하위호환 서술도 `data-flow/12-workspace.md §1.5` 와 완전히 동형(2026-07-07 결정과 동일).
- **감사 액션 명명**: `1-auth.md §4.1`(카탈로그) ↔ `conventions/audit-actions.md`(규약: 3분류 taxonomy, 도메인 레지스트리) 간 액션 목록·시제 분류·`workspace.deleted` 제외 사유가 완전히 일치.
- **에러 코드 historical-artifact**: `1-auth.md §1.5.4` 의 lowercase 초대 에러 코드 목록이 `conventions/error-codes.md §3` 레지스트리와 1:1 대응.
- **계층 책임**: `1-auth.md §Rationale 1.4.H` 의 WebAuthn 모듈 분리(controller host=AuthModule, service/entity/DTO=WebAuthnModule, 단방향 의존)는 다른 spec 문서에서 반박되는 서술이 없다.

## 요약

target(`spec/5-system/1-auth.md`, `10-graph-rag.md`)은 이미 매우 성숙하고 촘촘히 상호 참조된 문서로, 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임의 6개 관점 모두에서 `spec/1-data-model.md`, `spec/0-overview.md`, `spec/2-navigation/*`, `spec/conventions/*`, `spec/data-flow/*` 와 광범위하게 대조했으나 실질적 모순은 발견되지 않았다. 유일한 실제 발견사항은 `10-graph-rag.md` §6 의 Graph KB WebSocket 이벤트 카탈로그(정확히 5개, `document:graph_error` dead-declared 명시)와 `spec/5-system/6-websocket-protocol.md` §4.3 의 서술("12개"·"그래프 6개"·"임베딩과 1:1 대응")이 실제 backend `KbEventType` union(11개 멤버, `document:graph_error` 미선언) 및 emit 코드 경로와 어긋나는 문서 간 카탈로그 drift 다 — 두 문서와 실제 코드(backend union 11개 vs frontend 구독 목록 12개) 세 지점이 서로 다른 숫자를 말하고 있어 WS 클라이언트 구현자가 `document:graph_error`/`document:embedding_error` 를 실제로 발생하는 신호로 오인할 위험이 있다. 이 외에는 어떤 CRITICAL 급 데이터 모델/API/RBAC/상태 전이 충돌도 확인되지 않았다. 다만 payload 가 지목한 target 이 실제 브랜치 diff(`spec/5-system/14-external-interaction-api.md`)와 무관해 보이는 점은 orchestrator 페이로드 구성 문제로 별도 보고할 가치가 있다.

## 위험도

LOW
