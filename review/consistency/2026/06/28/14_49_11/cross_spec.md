# Cross-Spec 일관성 검토 결과

**검토 대상**: `spec/7-channel-web-chat/` (전체 6문서)
**검토 모드**: impl-done (diff-base=origin/main)
**검토 일시**: 2026-06-28

---

## 발견사항

### [INFO] SSE wire 필드명 drift — EIA/WS spec 의 `nodeId`/`node.id` 표기와 실제 wire의 `waitingNodeId` 불일치 (이미 알려진 backlog)

- **target 위치**: `spec/7-channel-web-chat/0-architecture.md §3` — SSE wire 필드명 주석 블록
- **충돌 대상**: `spec/5-system/14-external-interaction-api.md §6.2` (`node.id` 표기), `spec/5-system/6-websocket-protocol.md §4.4` (`nodeId` 표기)
- **상세**: target `0-architecture.md §3` 의 SSE wire 필드명 주석은 "`waiting_for_input` 은 `waitingNodeId`(= `submit_message` 의 `nodeId` 로 그대로 사용)… WS §4.4 는 `nodeId`/`node.id` 로 표기돼 wire 와 drift" 를 이미 명시하고, EIA §6.2 의 SSE wire 주석(`spec/5-system/14-external-interaction-api.md` 570행)도 "notification은 `node.id` → SSE wire 는 `waitingNodeId`" 임을 명시한다. 양 spec 모두 drift 를 backlog 로 인식하고 있어 직접 모순은 아니나, `0-architecture.md` 와 EIA spec 에서 각자 단독 주석으로만 존재하며 interaction-type-registry 나 convention 에는 미반영 상태다.
- **제안**: 별도 대응 불필요 (양쪽 backlog 로 명시 완료). 다만 `spec/conventions/interaction-type-registry.md` 에 이 drift 를 cross-ref 주석으로 추가하면 향후 혼동을 줄일 수 있다.

---

### [INFO] `spec/0-overview.md §6.2` — 웹채팅 위젯 구현 상태가 "부분 구현 🚧" 분류이나 영역 spec 은 전부 `status: implemented`

- **target 위치**: `spec/7-channel-web-chat/` 전체 (모든 문서 frontmatter `status: implemented`)
- **충돌 대상**: `spec/0-overview.md §6.2` (임베드형 웹채팅 위젯 + SDK 항목이 🚧 분류에 있으며, "라이브 미리보기는 위젯 co-deploy 후 증분 2" 주석 포함)
- **상세**: `spec/7-channel-web-chat/` 6문서의 frontmatter 는 모두 `status: implemented` 다. `spec/0-overview.md §6.2` 는 이 영역을 "🚧 부분 구현" 분류에 두고 있다. `NAV-WC-06` (라이브 미리보기) 이 `🚧 (증분 2)` 로 남아있어 🚧 유지가 의도적으로 보이지만, 영역 spec 의 `implemented` 상태와 0-overview 의 `🚧` 분류가 혼재하는 것은 독자가 혼동할 수 있다. target spec 은 잔여 품질·하드닝 항목을 비차단 backlog 로 분리해 영역 종결을 선언했다.
- **제안**: 직접 모순은 아니고 표현 불일치다. `spec/0-overview.md §6.2` 의 해당 행 주석을 "라이브 미리보기 co-deploy 단계는 증분 2 — NAV-WC-06 참조" 정도로 보완해 독자에게 명확히 하면 INFO 수준 drift 가 해소된다.

---

### [INFO] `spec/5-system/14-external-interaction-api.md §6.2 페이로드` — `execution.message` 이벤트 타입 표기 불일치

- **target 위치**: `spec/7-channel-web-chat/5-admin-console.md §6` — "표시-전용 presentation 노드 렌더" 항목: "위젯이 `execution.message` SSE 이벤트([EIA §5.2])로 받아"
- **충돌 대상**: `spec/5-system/14-external-interaction-api.md §5.2 / §6` — EIA 의 SSE 이벤트 타입 열거는 `execution.waiting_for_input` / `execution.completed` / `execution.failed` / `execution.cancelled` / `execution.ai_message` 5종이며 `execution.message` 는 명시되지 않는다.
- **상세**: `5-admin-console.md §6` 에서 presentation 노드 SSE 이벤트를 `execution.message` 로 표기하나, EIA spec 에서 SSE 이벤트 화이트리스트에 `execution.message` 는 존재하지 않는다. `execution.ai_message` 와 혼동한 것으로 보인다. AI Agent 가 아닌 Presentation 노드(template/carousel/table/chart)의 자동 진행 출력이 SSE 로 전달되는 이벤트 타입이 무엇인지 EIA spec 에서 명확히 정의되어 있지 않다.
- **제안**: `5-admin-console.md §6` 의 `execution.message` 를 `execution.ai_message` 로 수정하거나, 별도 SSE 이벤트 타입이 있다면 EIA spec §5.2 이벤트 화이트리스트에 추가해 단일 진실을 확보한다. EIA spec 과 일치하지 않는 이벤트 타입 표기는 구현자가 오인할 위험이 있다.

---

### [INFO] `spec/7-channel-web-chat/5-admin-console.md §2` — trigger `interaction` 필드의 POST body 위치 설명과 EIA spec §4 등록 페이로드 표기

- **target 위치**: `spec/7-channel-web-chat/5-admin-console.md §2` 인스턴스 생성 표 — "`interaction` 은 POST body **top-level** 필드이며 backend 가 저장 시 `config.interaction` 으로 머지"
- **충돌 대상**: `spec/5-system/14-external-interaction-api.md §4` 등록/수정 페이로드 — `POST /api/triggers` 페이로드 예시
- **상세**: `5-admin-console.md §2` 는 `interaction` 이 POST body top-level 필드라고 명시한다. EIA spec §4 에도 동일한 설명이 있으며 이 부분은 일치한다. 모순은 없으나, 두 spec 이 같은 사실을 각자 설명하므로 INFO 수준의 중복 표기다. 실제 SoT 는 EIA spec §4 이며 admin-console spec 의 참조는 올바르다.
- **제안**: 현 상태 유지 가능. admin-console §2 의 해당 설명에 `(SoT: EIA §4)` 참조를 추가하면 중복 표기 drift 방지에 도움이 된다.

---

### [INFO] `spec/7-channel-web-chat/4-security.md §1` — CORS `/api/hooks/*` 에 대한 "`Access-Control-Allow-Origin: *`" 표기와 EIA spec §8.5

- **target 위치**: `spec/7-channel-web-chat/4-security.md §1` 보안 정책 표 — "CORS — `/api/hooks/*`: **무제한 유지** (`Access-Control-Allow-Origin: *`, EIA §8.5)"
- **충돌 대상**: `spec/5-system/14-external-interaction-api.md §8.5` — CORS 정책의 SoT
- **상세**: `4-security.md §1` 은 EIA §8.5 를 참조하며 내용도 일치한다. `§2.1` 구현 블록에서도 "무제한(`origin: true`, `credentials: false`)" 으로 기술되어 있어 EIA spec 과 정합한다. 모순 없음.
- **제안**: 해당 없음 (일치 확인).

---

### [INFO] `spec/7-channel-web-chat/3-auth-session.md §3.1` — `410 Gone` 의 맥락이 EIA spec `EIA-IN-12` 와 완전 정합

- **target 위치**: `spec/7-channel-web-chat/3-auth-session.md §3.1` — "`GET /api/external/executions/:id` 로 현재 상태 확인 — 종료된 execution 도 `200 OK` + `status` 로 응답…EIA-IN-12 의 `410 Gone` 은 *명령*(interact)에 대한 응답 전용"
- **충돌 대상**: `spec/5-system/14-external-interaction-api.md EIA-IN-12` — `410 Gone` 동작
- **상세**: 양쪽 spec 이 동일하게 기술되어 있으며 모순 없음. `3-auth-session.md §3.1` 이 EIA spec 의 `410` 의미를 정확히 구분해서 설명하고 있다.
- **제안**: 해당 없음 (일치 확인).

---

### [INFO] `spec/7-channel-web-chat/2-sdk.md §1` — `sendMessage` 메서드와 `1-widget-app.md` 큐 게이팅 규칙의 외부 노출

- **target 위치**: `spec/7-channel-web-chat/2-sdk.md §1` — 전역 함수 메서드 목록에 `sendMessage` 포함; `§3 wc:command` 페이로드에 `sendMessage(text)` 포함
- **충돌 대상**: `spec/7-channel-web-chat/1-widget-app.md §2 입력창` — "`awaiting_user_message` + 텍스트 표면일 때만 자유 텍스트 입력 활성"; `buttons`/`form` 이면 Composer 비활성화
- **상세**: SDK 의 `sendMessage` 공개 API 는 host 가 임의 시점에 텍스트를 전송할 수 있음을 시사하나, 위젯 상태기계는 `awaiting_user_message + ai_conversation 표면` 일 때만 텍스트 입력이 유효하다. SDK 가 `sendMessage` 를 `buttons`/`form` 상태에서 호출하면 어떻게 되는지(거부? 큐? 무시?)에 대한 명세가 두 spec 모두에 없다. 기능 gap 이나 두 spec 간 모순은 아니다.
- **제안**: `2-sdk.md §1` 의 `sendMessage` 설명 또는 §3 `wc:command` 섹션에 "현재 표면이 텍스트 표면이 아니면 위젯이 무시한다" 동작을 명시하면 host 구현자의 혼동을 방지할 수 있다.

---

## 요약

`spec/7-channel-web-chat/` 6문서와 다른 spec 영역(`spec/0-overview.md`, `spec/1-data-model.md`, `spec/5-system/14-external-interaction-api.md`, `spec/5-system/12-webhook.md`, `spec/2-navigation/2-trigger-list.md`, `spec/2-navigation/9-user-profile.md`, `spec/conventions/interaction-type-registry.md`) 간의 Cross-Spec 일관성 검토 결과, CRITICAL 또는 WARNING 수준의 모순은 발견되지 않았다. 데이터 모델(`Workspace.settings.interactionAllowedOrigins`, `Trigger.config.interaction.appearance`)·API 계약(`PATCH /api/triggers/:id`, `PATCH /api/workspaces/:id/settings`, `GET /api/triggers/:id/history`)·요구사항 ID(`NAV-WC-01..06`)·RBAC(`viewer`/`editor`+)·레이어 책임(위젯=client-consumer, EIA=기존 서버 표면 재사용) 모두 인접 spec 과 정합한다. 발견된 4건은 모두 INFO 등급으로 — SSE 이벤트 타입 표기 불일치(`execution.message` vs `execution.ai_message`) 하나가 구현 혼동 가능성이 있어 수정을 권장하지만 차단 사유는 아니다. 나머지는 이미 알려진 backlog(SSE wire 필드명 drift)이거나 0-overview 구현 상태 분류 불일치, 중복 표기 수준이다.

## 위험도

LOW
