# 신규 식별자 충돌 검토 — spec/conventions/ (--impl-prep)

## 조사 방법 요약

target 번들은 `spec/conventions/audit-actions.md`, `cafe24-api-catalog/{_overview,category,store,translation}.md`, `cafe24-api-metadata.md`, `chat-channel-adapter.md` 7개 파일(+ 컨텍스트 예산 초과로 생략된 263개 파일 목록)로 구성됐다. 실제 worktree(`spec/conventions/`)를 대상으로 `origin/main` 대비 `git diff` 를 확인한 결과 **이 브랜치에서 `spec/conventions/` 는 변경분이 없다** — 즉 번들 내용은 이미 커밋된 현재 상태이며, 이번 호출은 developer 가 구현 착수 전 의무적으로 수행하는 `--impl-prep` 게이트로 보인다 (`chat-channel-adapter.md` frontmatter 의 `pending_plans: chat-channel-discord-gateway / chat-channel-slack-socket-mode / chat-channel-visual-ssr-png`). 이에 따라 "target 이 새로 도입하는 식별자"는 이미 `codebase/backend/src/modules/chat-channel/**` 에 광범위하게 구현되어 있음을 grep 으로 확인했다 (`ChannelMessage`/`ChannelUpdate`/`ChannelButton`/`ChatChannelInternalEvent`/`openFormModal`/`escapeControlText`/`execution-failure-classifier.ts` 등 전부 코드에 1:1 대응 존재) — 따라서 이 축에서는 새 충돌이 나타나지 않았다. 아래는 그럼에도 실제로 발견된 충돌·모호성이다.

---

## 발견사항

- **[WARNING]** Rationale ID `R8` 이 스펙 전역에서 3중 정의 — target 이 파일 비한정(bare) 인용
  - target 신규 식별자: `spec/conventions/chat-channel-adapter.md` 의 §1.3(라인 155), §R-CCA-7 (a)(라인 562), (c)(라인 564) 에서 쓰인 **파일 미한정 `R8`** 인용 — "`WebsocketService.executionEvents$` (R8 — NotificationDispatcher·SseAdapter 와 동일 facade 계층의 형제 listener)", "R8 의 미등록 trigger silent skip 가드 정책 그대로 적용".
  - 기존 사용처:
    - `spec/5-system/15-chat-channel.md:567` `### R8. Fan-out facade 의 분리 — per-trigger listener 정책` — 문맥(NotificationDispatcher·SseAdapter·ChatChannelDispatcher 3종 listener, per-trigger registry)이 target 의 인용과 정확히 일치 → **의도된 참조 대상은 이 R8로 보임**.
    - `spec/5-system/14-external-interaction-api.md:1024` `### R8. Idempotency-Key 와 submit_form 검증 실패의 관계` — 완전히 다른 주제.
    - `spec/7-channel-web-chat/1-widget-app.md:232` `### R8. presentation 렌더 — 두 shape 통일 수용 + 복원 범위의 실제 경계` — 역시 다른 주제.
  - 상세: `chat-channel-adapter.md` 자신은 §Rationale 상단에서 "cross-file 인용 시에는 `[CCA §R-CCA-N]` 형태로 파일 prefix 명시" 라는 컨벤션을 스스로 선언했고, 바로 같은 문장 안에서 `EIA R10` (→ `14-external-interaction-api.md §R10`) 은 정확히 파일-접두 규칙을 지켰다. 그런데 인접한 `R8` 인용 3곳만 파일 접두 없이 bare 로 쓰여, 정작 자신이 정의한 규칙을 스스로 어겼다. `R8` 이라는 동일 식별자가 EIA/chat-channel/widget-app 세 문서에서 서로 무관한 의미로 이미 쓰이고 있어, 문서 편집자나 이 문서를 인용하는 후속 spec 이 어느 `R8` 인지 오판할 여지가 실재한다(특히 같은 문장 내 EIA 관련 논의가 섞여 있어 EIA §R8 로 오인하기 쉬운 배치).
  - 제안: 3곳의 `R8` 을 `[CC §R8]`(또는 `[15-chat-channel §R8]`) 형태로 명시하고 실제 앵커 링크(`../5-system/15-chat-channel.md#r8-fan-out-facade-의-분리--per-trigger-listener-정책`)를 붙인다. 동시에 `15-chat-channel.md`/`14-external-interaction-api.md`/`1-widget-app.md` 세 파일이 모두 로컬 `R8` 을 갖는 구조 자체도, 이미 `R-CC-N`/`R-CCA-N` 처럼 파일별 prefix 로 넘어간 최근 관례를 감안하면 장기적으로 `R-CC-8`/`R-WCA-8` 류로 재번호화하는 편이 근본적으로 안전하나, 기존 cross-link 파손 위험(문서가 스스로 인정한 이유)을 고려해 최소 조치로 인용부 파일-접두만 즉시 정정할 것을 권한다.

- **[INFO]** `execution.node.completed` — WS 프로토콜 외부 이벤트명과 `ChatChannelInternalEvent` 내부 타입이 동일 이벤트명, 다른 payload shape
  - target 신규 식별자: `spec/conventions/chat-channel-adapter.md` §1.3 `ChatChannelInternalEvent` 의 `{ type: "execution.node.completed"; executionId; triggerId; workflowId; node: { id; type; label? }; output; meta?; timestamp; seq }`.
  - 기존 사용처: `spec/5-system/6-websocket-protocol.md:183` 의 Socket.IO 이벤트 `execution.node.completed` = `{ executionId, nodeId, nodeExecutionId, nodeName, output, duration }` (평면 필드, `duration`/`nodeExecutionId`/`nodeName` 보유, `triggerId`/`workflowId`/`seq`/`node.*` 없음).
  - 상세: target 자신이 "SoT: WS §4.4 execution.node.completed — same event name, consumed as chat-channel-internal" 이라고 명시해 **의도적 이벤트명 재사용**임을 이미 밝히고 있어 CRITICAL 은 아니다. 다만 두 표현의 필드 shape 이 상당히 다르고(`nodeId` 평면 vs `node.id` 중첩, `duration` vs 없음, `triggerId`/`workflowId`/`seq` 신규 추가) 그 매핑(WS 이벤트 → dispatcher 가 어떻게 `ChatChannelInternalEvent` 를 합성하는지)을 설명하는 명시적 변환 표가 target 문서 안에는 없다 — 구현자가 이름만 보고 두 shape 이 동일하다고 가정할 위험이 남는다.
  - 제안: §1.3 또는 §3 표에 "WS `execution.node.completed`(원본) → `ChatChannelInternalEvent.execution.node.completed`(변환)" 필드 매핑 1줄 표를 추가해 동명이의 payload 임을 명시적으로 못박는다.

- **[INFO]** cafe24 `store.md` 의 `privacy_*` operation id 와 `privacy` resource 의 `customers_privacy_*` id — 접두 중첩(기존에 이미 자체 플래그, 미해결)
  - target 신규 식별자: 해당 없음(신규 아님) — `spec/conventions/cafe24-api-catalog/store.md` 의 `privacy_boards_get`/`privacy_boards_update`/`privacy_join_get`/`privacy_join_update`/`privacy_orders_get`/`privacy_orders_update` (라인 445–450).
  - 기존 사용처: `spec/conventions/cafe24-api-catalog/privacy.md` 의 `customers_privacy_get`/`customers_privacy_list`/`customers_privacy_count`/`customers_privacy_update` — 별도 `privacy` resource.
  - 상세: 실제 `(resource, id)` 튜플은 겹치지 않아 `catalog-sync.spec.ts` 의 resource-내 unique 검증(§4 규칙6)은 통과하며 기술적 충돌은 아니다. 다만 `_overview.md` §5 각주가 "`store.md` 의 `privacy_*` id 명명 우려(별 `privacy` resource 와 prefix 충돌)는 별 트랙으로 follow-up 가능" 이라고 스스로 이미 지적해 둔 채 미해결로 남아 있다 — grep `privacy_` 시 두 resource 의 endpoint 가 섞여 나와 사람이 오인하기 쉬운 상태가 계속된다. 신규 발견은 아니고 기존 self-flagged 항목의 재확인이다.
  - 제안: 이번 impl-prep 범위(chat-channel)와 무관하므로 우선순위는 낮음. cafe24 카탈로그를 다음에 손댈 때 `store.md` 의 해당 3 operation id 를 `store_privacy_boards_get` 류로 리네이밍하거나, 최소한 `_overview.md` 각주에 두 resource 의 실제 id 목록을 나란히 적어 혼동을 줄일 것.

---

## 요약

target 번들(`spec/conventions/` 7파일)이 도입하는 식별자 대부분은 이미 `codebase/backend/src/modules/chat-channel/**` 구현과 1:1 대응돼 있어 새로운 충돌은 발견되지 않았다(`ChannelMessage`/`ChannelUpdate`/`ChannelButton`/`ChatChannelConfig`/`ChatChannelInternalEvent`/`openFormModal`/`escapeControlText`/`execution-failure-classifier.ts` 등 전수 확인). frontmatter `id`(예: `category`/`store`/`translation`/`audit-actions`/`chat-channel-adapter`)도 spec 전역에서 유일함을 확인했고 makeshop 카탈로그는 `makeshop-` 접두로 cafe24 카탈로그와의 충돌을 이미 회피하고 있다. 실질적으로 남은 문제는 (1) `chat-channel-adapter.md` 가 스스로 세운 "cross-file Rationale ID 는 파일 prefix 명시" 규칙을 어기고 스펙 전역에 3중 정의된 `R8` 을 bare 로 인용한 것(WARNING), (2) `execution.node.completed` 소켓 이벤트명의 의도적 재사용에 명시적 필드 매핑이 없는 것(INFO), (3) cafe24 `privacy_*`/`customers_privacy_*` 접두 중첩이 기존에 이미 자체 지적된 채 미해결로 남아있는 것(INFO)이다. 셋 다 구현 착수를 막을 CRITICAL 은 아니다.

## 위험도

LOW
