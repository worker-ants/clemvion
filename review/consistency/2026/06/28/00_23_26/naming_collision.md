# 신규 식별자 충돌 Check — 결과

**검토 모드**: 구현 완료 후 검토 (--impl-done, scope=spec/7-channel-web-chat/)
**분석 대상**: spec/7-channel-web-chat/ 전체 (6문서) + 구현 diff

---

## 발견사항

### 1. 요구사항 ID 충돌

요구사항 ID 중 명시적 시리즈는 `NAV-WC-01..06` 뿐이며, 이는 `spec/2-navigation/_product-overview.md` 에 정의돼 있고 다른 영역에서 동일 ID 로 다른 의미로 쓰이는 사례가 없다. 충돌 없음.

### 2. 엔티티/타입명 충돌

- `EmbedConfigDto` / `EmbedConfigService` — `spec/data-flow/14-chat-channel.md` 와 `spec/5-system/2-api-convention.md` 에서 cross-reference 로 등장하지만, 이들 파일은 target 정의를 참조하는 소비자이지 별도 정의를 둔 게 아니다. 충돌 없음.
- `WebChatAppearanceDto` — `spec/5-system/14-external-interaction-api.md` 에 1회 언급되나 정의 SoT 는 target 영역이고, EIA spec 은 target 을 참조하는 문맥이다. 충돌 없음.
- `BootConfig`, `ChatInstance`, `WidgetEvent`, `Unsubscribe` 등 타입명은 `spec/7-channel-web-chat/` 내에서만 사용되며 다른 영역 spec 에 동명 타입이 없다.

### 3. API endpoint 충돌

- `GET /api/hooks/:endpointPath/embed-config` — target(`spec/7-channel-web-chat/4-security.md §3-①`)이 정의하고, `spec/5-system/2-api-convention.md`, `spec/5-system/12-webhook.md`, `spec/data-flow/10-triggers.md` 가 모두 "target SoT 참조" 형태로만 언급한다. 기존 spec 에 같은 path 로 다른 의미의 정의가 없다. 충돌 없음.
- `POST /api/hooks/:endpointPath` (webhook) / `GET /api/external/executions/:id/stream` (SSE) / `POST .../interact` / `POST .../refresh-token` 등은 EIA(`spec/5-system/14-external-interaction-api.md`) 기존 정의이며, target 이 *소비*만 하고 재정의하지 않는다. 충돌 없음.

### 4. 이벤트/메시지명 충돌

postMessage type 네임스페이스 `wc:*`(`wc:boot`, `wc:command`, `wc:ready`, `wc:resize`, `wc:event`) 는 target 영역 이외의 spec 에서 정의 혹은 예약된 사례가 없다. 검색 결과 모두 target 참조 맥락만 등장. 충돌 없음.

SSE 이벤트명 (`execution.ai_message`, `execution.waiting_for_input` 등) 은 EIA 기존 정의이고 target 은 소비만 한다.

`wc:event` payload 의 name 값 (`open`/`close`/`message`/`unread`/`conversationStarted`/`conversationEnded`) 이 기존 WS/SSE 이벤트명과 겹치는지 확인: 내부 WS 프로토콜(`spec/5-system/6-websocket-protocol.md`)은 다른 이벤트 네임스페이스를 사용하며, `wc:event` 는 host↔iframe postMessage 전용이라 범위가 분리된다. 충돌 없음.

### 5. 환경변수·설정키 충돌

- `NEXT_PUBLIC_WIDGET_CDN_BASE` — frontend `.env.example` 에만 존재. 다른 spec 이나 코드베이스에서 동명 키를 다른 의미로 사용한 사례 없음. 충돌 없음.
- `WEB_CHAT_WIDGET_ORIGINS` — backend `main.ts` / `web-chat-cors.ts` 에 존재하며 target spec `0-architecture.md §4` 에서 SoT 로 지목한다. 기존 spec(`spec/data-flow/0-overview.md` 등)에서도 동일 키·동일 의미로 참조하며 재정의 충돌이 없다.
- `clemvion-web-chat:session:<triggerEndpointPath>` (sessionStorage 키) — `codebase/channel-web-chat/src/lib/session-store.ts` 에서 `KEY_PREFIX = "clemvion-web-chat:session:"` 로 정의. 다른 패키지에서 같은 prefix 를 다른 목적으로 쓰는 사례 없음. 충돌 없음.

### 6. 파일 경로 충돌

- `spec/7-channel-web-chat/4-security.md` — 본 파일의 frontmatter `id: web-chat-security` 에 명시적 주석(`# basename '4-security' 와 의도적으로 다름 — 타 영역의 '4-security' 슬러그와 충돌 방지`)이 달려 있다. 실제로 다른 영역에 `4-security.md` 파일이 없음을 확인했다(검색 결과 빈 값). 충돌 없음. (주석 명시로 의도 명확히 기록됨.)
- `spec/7-channel-web-chat/` 영역 번호 `7-` — `spec/0-overview.md` §8 문서 맵에서 해당 위치를 명시적으로 점유하고 있으며, 다른 폴더가 동일 prefix 를 사용하지 않는다. 충돌 없음.

### 7. 기타 — storage key 교체에 따른 drift 감지

- **[INFO] `session-store.ts` 스토리지 키 변경 — spec 키 미명시**
  - target 신규 식별자: `KEY_PREFIX = "clemvion-web-chat:session:"` (sessionStorage 에 저장)
  - 기존 사용처: 변경 전 구현에서 `localStorage` 를 사용했으며, test 파일(`session-store.test.ts`)에서 `localStorage.getItem("clemvion-web-chat:session:trig-1")` 이 사용됐다.
  - 상세: 키 문자열 자체는 변경되지 않았으나, storage 종류가 localStorage → sessionStorage 로 교체됐다. `spec/7-channel-web-chat/3-auth-session.md §R6` 에 sessionStorage 선택 근거가 문서화됐고, 테스트도 sessionStorage 기준으로 갱신됐다. 식별자 충돌은 없으나 동일 키가 localStorage 에 남아 있다면 이전 세션 데이터와 공존할 수 있다 — storage 교체 후 localStorage 의 기존 항목을 읽어들이지 않는다는 점이 spec 에 명시되지 않아 migration 동작이 암묵적이다.
  - 제안: `3-auth-session.md §3.1` 또는 `§R6` 에 "localStorage 잔류 항목은 무시됨 (읽기 경로 sessionStorage 전용)" 한 줄을 추가하면 향후 혼선을 예방할 수 있다. 차단 수준 아님.

---

## 요약

`spec/7-channel-web-chat/` 가 도입하는 신규 식별자(spec ID `web-chat-*`, 요구사항 `NAV-WC-01..06`, 타입명 `EmbedConfigDto`/`WebChatAppearanceDto`/`BootConfig`/`ChatInstance`/`WidgetEvent`, API endpoint `GET /api/hooks/:path/embed-config`, postMessage 이벤트 `wc:*`, ENV var `NEXT_PUBLIC_WIDGET_CDN_BASE`/`WEB_CHAT_WIDGET_ORIGINS`, storage key `clemvion-web-chat:session:*`, 파일 경로 `spec/7-channel-web-chat/`) 중 기존 사용처와 의미 충돌하는 사례는 발견되지 않았다. 영역 prefix `web-chat-` 전략이 일관되게 적용돼 전역 유일성을 확보한다. 유일한 비차단 INFO 항목은 localStorage → sessionStorage 교체 후의 이전 항목 처리 정책이 spec 에 명시되지 않은 점이며, 구현은 이미 올바르다.

---

## 위험도

NONE
