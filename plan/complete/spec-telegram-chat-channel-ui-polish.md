---
worktree: telegram-chat-channel-spec-polish-49c49b
started: 2026-05-23
completed: 2026-05-29
owner: project-planner
---

> 비공식 메타: 우선순위 P1 (UI 구현 차단 해소 — 후속 developer plan 의 선행 조건). branch `claude/telegram-chat-channel-spec-polish-49c49b`. 머지 후 `plan/complete/` 로 이동.

# Plan — Telegram Chat Channel Spec 공백 4건 보강

> ✅ 완료 (2026-05-29). spec 공백 4 결정이 PR #281 (`f287a24b` — "chat-channel — 4 P1 결정") 으로 머지됨. 라이프사이클 조건(spec 6 파일 한 PR 머지)을 6 파일 전수 검증 — 결정1: `2-trigger-list.md` Chat Channel 칩/배지(§2.1)·상세 카드(§2.3)·필드 권한 매트릭스 9 row(§2.3.1)·Rationale R-8; 결정2: `15-chat-channel.md §5.4.1` botToken single-path + `§5.4.2` `hasBotToken` derived 필드 + `1-data-model.md §2.8` cross-link; 결정3: visualNode `text/photo/auto` enum (`chat-channel-adapter.md §2.3` + Changelog 2026-05-23 / `15-chat-channel.md` CCH-MP-04 / `telegram.md §5.4` 매트릭스 / R-CC-11); 결정4: `15-chat-channel.md §5.5` Inbound HTTP Contract + `12-webhook.md` WH-EP-07 예외·§3.1 응답표·§7 step 5 + `telegram.md §6` cross-link / R-CC-12. R-CC-10/11/12 Rationale 모두 실재. plan 만 `in-progress/` 잔류한 stale 상태를 grooming 으로 `complete/` 이동 ([plan-lifecycle §6.1](../../.claude/docs/plan-lifecycle.md)). 본 plan 의 "후속 plan" 4건은 별개 plan 으로 분리 진행(라이프사이클 §187) — 본 plan 완료 조건과 무관.

## 배경

사용자 보고 (2026-05-23): 텔레그램 통합의 백엔드는 Phase 1/2 (PR #261 머지) 까지 완성되어 setupChannel·rotate-bot-token·inbound 인증·outbound dispatcher 가 모두 동작한다. 유저 가이드 (`codebase/frontend/src/content/docs/06-integrations-and-config/telegram.mdx`) 도 "트리거 생성 시 `config.chatChannel` 추가" 흐름을 약속한다. 그러나:

- 프론트엔드 트리거 생성/편집 페이지·설정 페이지 어디에도 `chatChannel` 입력 경로가 0개 — 사용자가 GUI 만으로는 시작 불가.
- spec 자체에 UI 구현이 의존하는 결정 4건이 미정의 상태로 남아 있어 developer 가 구현 착수 시 멈출 위험.

본 plan 은 그 spec 공백 4건만 닫는다. **유저 가이드 정정·프론트엔드 UI 구현은 본 plan 범위 밖** — 별도 후속 `developer` plan 으로 분리.

관련 in-progress plan 과의 관계:
- `chat-channel-secret-store-infra.md` (backlog) — 인프라 결정 대기. 본 plan 은 이미 spec 에 채택된 `SecretResolver` + `secret://` ref 패턴을 그대로 활용 (충돌 없음).
- `chat-channel-visual-ssr-png.md` (backlog) — v2 SSR PNG 격상. 본 plan 의 결정 3 (uiMapping.visualNode enum) 은 v2 trigger 신호의 SoT 가 된다 (이 plan 진입 시 enum 을 참조).
- `chat-channel-dispatcher-split.md` (backlog) — provider 증가 시 분리. 본 plan 과 영향 없음.

## 결정 4건 (요약)

### 결정 1 — 트리거 목록/상세 UI 의 `chatChannel` 가시성

**대상 spec**: `spec/2-navigation/2-trigger-list.md`

- §2.1 행 표시: webhook 트리거 행에 chatChannel 이 있으면 provider 칩 + `chatChannelHealth` 배지 (healthy / degraded / unknown). `notificationHealth` 와 같은 영역에 나란히. ([WH-MG-09](../../spec/5-system/12-webhook.md) 의 표시 요구사항 구체화).
- §2.3 상세 drawer: 별도 "Chat Channel" 카드로 분리 (Webhook Configuration 카드와 형제 위치).
- §2.3.1 필드 권한 매트릭스에 9개 row 추가:
  - `provider` (read-only after creation)
  - `botToken` (write-only 입력, masked display, rotate 액션 — 결정 2 의 single-path 정책 인용)
  - `botIdentity.username` (read-only — setupChannel 캐시 결과)
  - `uiMapping.formMode` (edit, enum `multi_step`)
  - `uiMapping.visualNode` (edit, enum — 결정 3 의 enum 인용)
  - `uiMapping.buttonLayout` (edit, enum `auto`/`vertical`/`horizontal`)
  - `rateLimitPerMinute` (edit, integer override, default 60)
  - `languageHints` (edit, Record<string,string>)
  - `chatChannelHealth` / `chatChannelLastError` / `chatChannelSetupAt` / `chatChannelRotatedAt` (read-only, 시스템 계산)
- 내부 ref (`botTokenRef`, `secretTokenRef`) 는 사용자에게 절대 노출 금지 — 매트릭스 표기 X + Rationale 명시.
- §3 API 표에 `POST /api/triggers/:id/chat-channel/rotate-bot-token` 인용 (이미 15-chat-channel.md 에 정의되어 있음 — cross-link 만).
- Rationale 신설 — "chatChannel 을 Webhook Configuration 안에 흡수하지 않고 별도 카드로 분리" 정당화.

### 결정 2 — Bot Token 입력·마스킹·변경 single-path

**대상 spec**: `spec/5-system/15-chat-channel.md` (§5.4 보강), `spec/2-navigation/2-trigger-list.md` (매트릭스 row 일부)

- write-only 동작 명시: 트리거 응답 (`GET /api/triggers/:id`) 에 botToken plaintext 절대 미포함. `botTokenRef` 자체도 응답에서 제외 (UI 는 ref 의 존재 여부를 별 boolean 필드 `chatChannel.hasBotToken: true` 로 알 수 있음). **`hasBotToken` 의 canonical 정의 위치**: `spec/5-system/15-chat-channel.md §5.4` 에 신설 — "응답 DTO 전용 derived 필드 (`botTokenRef IS NOT NULL → hasBotToken: true`); DB 컬럼 아님". `spec/1-data-model.md §2.8` 의 컬럼 목록과 분리. `ChatChannelConfig` (`spec/conventions/chat-channel-adapter.md §2.3`) 의 in-memory type 에는 포함하지 않음 (DTO 전용 — 변환 layer 는 backend response interceptor 책임).
- 형식 검증: `^\d{6,}:[A-Za-z0-9_-]{30,}$` 텔레그램 표준. 위반 시 400 `BOT_TOKEN_INVALID` (이미 15-chat-channel.md §5.4 에 정의됨).
- UI 표시: 등록 후에는 "•••• (마지막 4자)" 마스킹 placeholder + "재발급" 액션. 사용자가 "재발급" 클릭 → 새 토큰 입력 textarea → 제출 → rotate-bot-token API 호출.
- **single-path 결정**: 최초 트리거 생성 시점에만 `setupChannel` 부수효과로 토큰을 받는다. 그 후 모든 변경은 항상 `POST /api/triggers/:id/chat-channel/rotate-bot-token` 한 경로. PATCH body 의 `config.chatChannel.botTokenRef` 변경은 차단 (400 `VALIDATION_ERROR`, `details.field='botTokenRef'`). **canonical 기재 위치**: `spec/5-system/15-chat-channel.md §5.4` 가 single-path + PATCH 차단 정책의 SoT. `spec/2-navigation/2-trigger-list.md §3` 의 PATCH 설명에는 "`config.chatChannel.botTokenRef` 는 PATCH 로 변경 불가 — rotate API 사용 ([Spec Chat Channel §5.4](../5-system/15-chat-channel.md#54-bot-token-rotation-api-응답-계약))" cross-link 한 줄 추가.
- 에러 표면화: setupChannel / rotate 실패 시 DB 컬럼 `chat_channel_health='degraded'` + `chat_channel_last_error` 갱신 (DB 컨텍스트 snake_case), API 응답 시 `chatChannelHealth` / `chatChannelLastError` (DTO 컨텍스트 camelCase). 사용자 안전 메시지 (텔레그램 측 raw 에러 메시지 그대로 노출, secret 누출 위험 없음).
- **신설 Rationale (R-CC-10)** — single-path 의 정당화. 기존 [`spec/2-navigation/2-trigger-list.md` Rationale R-2](../../spec/2-navigation/2-trigger-list.md) 가 `hmacSecret` 에 대해 "v1 입력 변경 + v1.1 rotate 액션" 의 두 경로 공존을 채택했음. 본 결정은 그 원칙과 다른 결론을 내리는데, **자원의 성격 차이가 근거**:
  - hmacSecret: 우리가 보유한 server-side HMAC signing secret. PATCH 직접 교체 시 외부 수신자 (cafe24 등) 가 새 키를 동기화하기 전에 모든 webhook 검증이 실패하므로 grace 가 필요. 따라서 입력 교체 (v1) 와 rotate API (v1.1) 의 두 경로가 의미 있게 공존.
  - botToken: 외부 provider (텔레그램) 측에 등록된 토큰. PATCH 직접 교체는 우리 DB 만 갱신하고 텔레그램 측은 그대로라 webhook 수신이 즉시 깨짐 (setupChannel 재호출 필수). PATCH 와 rotate 의 두 경로 공존 시 grace 24h 정책 일관성 깨짐 + audit log mixing + 사용자 혼동.
  → botToken 은 single-path (rotate API only). 같은 Rationale 내에 R-2 와의 대비를 명시.

### 결정 3 — `uiMapping.visualNode` enum 및 v1 fallback

**원자적 동시 갱신 의무**: [chat-channel-adapter.md §7](../../spec/conventions/chat-channel-adapter.md#7-변경-관리) 의 변경 관리 조항은 "본 인터페이스 변경은 `15-chat-channel.md` (시스템 정의) + `4-nodes/7-trigger/providers/<name>.md` (모든 구체 어댑터 명세) 두 외부 spec 동시 갱신 의무 + `providers/_overview.md` catalog 함께 갱신" 을 명시한다. 본 결정은 컨벤션 파일(`chat-channel-adapter.md`) 자체도 수정하므로 **컨벤션 파일 + 두 외부 spec = 3 파일이 한 commit 으로 묶인다** (분리 commit 금지). `providers/_overview.md` catalog 는 provider 목록이 아니라 enum 한 필드 변경이라 본 결정에서는 갱신 불필요 (Rationale 에 그 판단 명시).

1. `spec/conventions/chat-channel-adapter.md` — §2.3 `ChatChannelConfig.uiMapping.visualNode` 타입 교체 (현행 `"photo" | "text_only"` → 신규 `"text" | "photo" | "auto"`, default `"auto"`). 타입 라인 옆에 한 줄 주석 추가: `// 'text' 는 시각 렌더 모드 — 동 파일 §2.2 KeyboardHint 의 'text' (입력 hint) 와 의미 다름`. §3 시각형 노드 매핑 표에 `visualNode` enum 분기 row 추가. §2.3 본문에 `text_only` legacy 값 normalize 정책 한 줄 추가: `// DB 에 저장된 'text_only' 값은 어댑터가 read-time 에 'text' 로 normalize (마이그레이션 완료 전 과도기 정책 — 후속 developer plan 책임)`. Changelog 행 추가:
   ```
   | 2026-05-23 | §2.3 `visualNode` enum 교체 (`text_only`→`text` rename + `auto` 신설). v1 photo 선택 시 fallback to text + warning 로그 정책. KeyboardHint 'text' 와의 의미 구분 주석. spec-telegram-chat-channel-ui-polish. |
   ```
2. `spec/5-system/15-chat-channel.md` — §4.1 config JSONB 예시의 `"visualNode": "photo"` 주석 갱신 (3-enum + default `auto` 명시). §3.3 CCH-MP-04 본문의 "v1 정책 / v2 정책" 분리 서술에 `visualNode` enum 분기를 인용 추가. 본 파일 Changelog (또는 Rationale 말미) 에 동일 한 줄 추가.
3. `spec/4-nodes/7-trigger/providers/telegram.md` — §5.4 Carousel/Chart/Table 매트릭스에 `visualNode` enum 값별 동작을 표 컬럼으로 추가 (단순 cross-link 아님 — 직접 행 갱신). §7 명령 처리는 변경 없음. 본 파일 Changelog (또는 Rationale 말미) 에 동일 한 줄 추가.

**enum 의미**:
- `text` (구 `text_only`): 모든 시각형 노드를 MarkdownV2 텍스트/monospace 로 fallback (v1 default 동작과 동일).
- `photo`: 가능한 노드는 SSR PNG 로 `sendPhoto` (v2 SSR 인프라 도입 후 의미). **v1 에서 photo 선택 시 정책**: fallback to text + warning 로그 (`chatChannelHealth` 변경 없음, `chat_channel_last_error` 변경 없음 — 정상 동작이며 단지 v2 인프라 미도입을 알리는 정보성 신호).
- `auto` (default): 노드 종류별 휴리스틱.

**노드타입 × enum × 버전 완전 매트릭스** (결정 3 spec PR 본문에 그대로 옮길 형태):

| 노드 | `text` (v1·v2) | `photo` v1 | `photo` v2 | `auto` v1 | `auto` v2 |
|---|---|---|---|---|---|
| AI Multi Turn | MarkdownV2 text | MarkdownV2 text (fallback) | MarkdownV2 text (이미지 변환 의미 없음) | MarkdownV2 text | MarkdownV2 text |
| Button Presentation | MarkdownV2 text + inline_keyboard | MarkdownV2 text + inline_keyboard (fallback) | MarkdownV2 text + inline_keyboard | MarkdownV2 text + inline_keyboard | MarkdownV2 text + inline_keyboard |
| Form (form_prompt) | force_reply / keyboard hint | force_reply / keyboard hint (fallback) | force_reply / keyboard hint | force_reply / keyboard hint | force_reply / keyboard hint |
| Carousel | sequential MarkdownV2 카드 (imageUrl 무시) | fallback to `auto` v1 (warning 로그) | 1~5장 collage PNG `sendPhoto` | 카드별: imageUrl 있으면 `sendPhoto`, 없으면 MarkdownV2 (기존 `telegram.md §5.4` 동작 그대로) | 카드별 분기 + 5장 collage 시도 |
| Chart | monospace mini bar chart | fallback to text (warning 로그) | satori SVG → PNG `sendPhoto` | monospace mini bar chart (chart 는 데이터 가독성이 text 가 더 좋아 `auto` 도 text 우선) | monospace mini bar chart (변경 없음) |
| Table | monospace MarkdownV2 표 | fallback to text (warning 로그) | 표 PNG `sendPhoto` | monospace MarkdownV2 표 | monospace MarkdownV2 표 |

`auto` + Carousel v1 = `spec/4-nodes/7-trigger/providers/telegram.md §5.4` 의 현행 동작 그대로 (cross-spec checker W-3 해소).

**별 plan 와의 scope 경계**: `chat-channel-visual-ssr-png` (backlog) 는 위 매트릭스의 "photo v2" / "auto v2" 열의 SSR PNG 구현을 담당. 본 plan 은 enum + scope 경계 + v1 fallback 정책의 spec 정의에 한정.

**기존 데이터 하위 호환**: PR #261 머지 이후 운영 DB 에 `visualNode: "text_only"` 값이 저장된 텔레그램 트리거가 존재할 가능성 — 본 plan 머지 시점에 운영 DB 조회로 확인 (개수 0 이면 단순 rename, 1 이상이면 read-time normalize fallback: 어댑터가 입력 단계에서 `text_only` → `text` 로 변환). 어느 쪽이든 spec 레벨은 `text` 단일 enum 만 노출. 마이그레이션 스크립트 작성은 후속 developer plan 책임 (구현 영역 — spec 범위 밖).

**Rationale 신설 항목** (spec PR 의 §Rationale 에 들어갈 초안):
- (a) `text_only` → `text` rename: 영문 일관성 (`photo` / `auto` 와 동급 단어). 운영 영향은 위 "기존 데이터 하위 호환" 항목으로 흡수.
- (b) `auto` 신설: v1 단계에서도 사용자가 "이건 photo 가 더 나은지 결정하라" 같은 사전 판단 없이 합리적 default 동작을 받도록 한다.
- (c) chart/table 의 `auto` 동작이 v2 에서도 text 우선인 이유: 데이터 정밀도가 PNG 보다 monospace text 가 더 가독적 (수치 정확 표시).
- (d) `photo` v1 fallback 의 health 변경 없음 이유: `chatChannelHealth=degraded` 는 외부 API 실패 신호. v1 인프라 미도입은 사용자 error 가 아니라 정상 fallback.

### 결정 4 — Inbound HTTP Contract (202 Accepted 고정 + auth 실패 정책)

**원자적 동시 갱신 의무**: 본 결정은 `12-webhook.md` 의 일반 webhook 응답 정책 (WH-EP-07 비활성 트리거 410 Gone) 과 충돌하므로, spec PR 은 다음 3 파일을 한 commit 으로 묶는다:

1. `spec/5-system/15-chat-channel.md` — §5.5 신설 "Inbound HTTP Contract" 절. 케이스 매트릭스 + Rationale.
2. `spec/5-system/12-webhook.md` — 세 위치 동시 갱신 (cross-link 만이 아니라 본문 원문 교체):
   - **§3.1 WH-EP-07 본문**: `| WH-EP-07 | 비활성 트리거로의 요청은 `410 Gone` 응답 반환. **예외**: `config.chatChannel` 이 설정된 트리거는 `202 Accepted + { ignored: true }` 반환 (텔레그램 등 chat-channel provider 가 non-2xx 응답 시 webhook 자동 비활성화·retry 폭주를 유발하므로). 상세 — [Spec Chat Channel §5.5](./15-chat-channel.md#55-inbound-http-contract) | 필수 |`
   - **§3.1 응답 코드 표 (line 186)**: `| 410 Gone | 트리거가 비활성 상태 (단, `config.chatChannel` 트리거는 [§5.5](./15-chat-channel.md#55-inbound-http-contract) 적용 — 비활성도 202 + ignored) |`
   - **§7 처리 흐름 step 5 (line 296)**: 다음으로 원문 교체:
     ```
     5. Trigger.isActive === false → config.chatChannel 가 있으면 step 6 (인증) → step 7c 의 silent skip 분기로 진입 (parseUpdate 호출 전에 isActive 미통과를 인지하고 update 무시, 응답은 202 + { ignored: true }). config.chatChannel 가 없으면 → 410 Gone 즉시 반환.
     ```
     순서 명확화: chatChannel 트리거의 비활성 상태에서도 **인증 (step 6) 은 그대로 수행**한다 (auth 실패 시 401 — chatChannel 케이스 매트릭스의 401 행과 일관). 인증 통과 후 trigger.isActive 가 false 면 step 7 안의 silent skip 으로 진입. parseUpdate / setupChannel / sendMessage 등 외부 API 호출은 발생하지 않음 (silent skip 의 의미 그대로). 이 순서 분리는 (a) 보안 — auth 실패한 요청에 silent 202 를 주면 공격자가 trigger 활성 여부를 inference 할 수 없도록 함, (b) 운영 — auth 실패는 운영자 디버깅 가시성 (401) 이 필요.
3. `spec/4-nodes/7-trigger/providers/telegram.md` — §6 보안 절에 "응답 코드 정책은 [Spec Chat Channel §5.5](../../../5-system/15-chat-channel.md#55-inbound-http-contract) 가 단일 진실" cross-link 추가. 본 파일 안에 케이스 매트릭스 사본을 두지 않음 (drift 회피).

**정책**: 모든 chat channel webhook inbound 정상 응답은 **`202 Accepted`** (기존 [12-webhook.md §7 step 7c·step 10](../../spec/5-system/12-webhook.md) 의 SoT 와 정합 — `200` 대신 `202` 채택). 본문은 케이스별 분리. 단, **`X-Telegram-Bot-Api-Secret-Token` 헤더 누락/불일치 만 예외로 `401 UNAUTHORIZED`**, **endpointPath 미존재만 `404 Not Found`** ([WH-RS-02](../../spec/5-system/12-webhook.md)).

**케이스 매트릭스** (spec PR 본문에 그대로 옮길 형태):

| 케이스 | HTTP | 본문 | 어댑터 행동 |
|---|---|---|---|
| private chat → 정상 update (새 execution 시작) | 202 | `{ executionId }` | execution 시작 ([12-webhook §7 step 10](../../spec/5-system/12-webhook.md) 와 동일 형식) |
| private chat → 정상 update (기존 execution forwarding) | 202 | `{ ignored: true }` | InteractionService.interact 호출 (새 execution 미생성, [§7 step 7e](../../spec/5-system/12-webhook.md) 와 정합) |
| group/supergroup/channel chat | 202 | `{ ignored: true }` | `groupChatRefusal` 안내 sendMessage 발송 |
| `from.is_bot === true` | 202 | `{ ignored: true }` | silent skip |
| `parseUpdate` 미지원 update type | 202 | `{ ignored: true }` | silent skip ([§7 step 7c](../../spec/5-system/12-webhook.md) SoT 와 동일) |
| **비활성 trigger (chatChannel 경로)** | **202** | **`{ ignored: true }`** | silent skip — **WH-EP-07 의 예외, 일반 webhook 경로는 여전히 410 Gone** |
| 트리거 미존재 (잘못된 endpointPath) | 404 | 표준 에러 envelope ([API Convention §5.3](../../spec/5-system/2-api-convention.md)) | — (chatChannel 경로도 동일, [WH-RS-02](../../spec/5-system/12-webhook.md) 와 일치). endpointPath 자체가 부재인 경우 2xx 가 오히려 stale webhook 영구 유지를 유발 |
| `X-Telegram-Bot-Api-Secret-Token` 누락/불일치 | 401 | 표준 에러 envelope | (보안 vs Telegram retry trade-off — Rationale 결정) |
| 어댑터 내부 에러 (sendMessage 실패 등) | 202 | `{ ignored: true }` 또는 `{ executionId }` (어느 단계에서 실패했는지에 따라) | 백그라운드 처리, `chat_channel_health='degraded'` 갱신 |

**Rationale 신설 항목** (spec PR 의 §Rationale 에 R-CC-12 로 들어갈 초안 — naming 충돌 피하기 위해 `R-CC-` prefix 사용. 동 파일 내 `[EIA §R10]` 외부 참조와 구분):
- (a) **`202` 고정 (200 대신) 의 이유**: 기존 [12-webhook.md §7 step 7c·step 10](../../spec/5-system/12-webhook.md) 가 이미 `202 Accepted` 를 SoT 로 정의. 텔레그램은 2xx 응답을 모두 success 로 인식하므로 200/202 차이는 텔레그램 측에 무관. spec 일관성을 위해 기존 SoT 채택. `200 OK` 신규 도입 시 §7 step 7c 도 함께 변경해야 하는데 그게 더 큰 변경 — 변경 최소화.
- (b) **2xx 고정의 이유**: 텔레그램 Bot API 가 non-2xx 응답 시 webhook 자동 비활성화 + retry 폭주를 유발 (Telegram Bot API documented behavior). 일반 webhook 경로의 410 Gone 정책 (WH-EP-07) 은 외부 호출자가 사람이거나 일반 HTTP client 인 가정 — chat-channel provider 는 그 가정에서 벗어남.
- (c) **WH-EP-07 의 일반 정책 유지 이유**: chatChannel 미사용 webhook 트리거 (cafe24, custom HTTP 클라이언트 등) 는 명시적 404/410 응답이 디버깅·UX 에 필요. 두 경로의 응답 정책 분리는 정당하다 (provider 특성 차이). 본 결정은 [12-webhook.md Rationale](../../spec/5-system/12-webhook.md) 의 "처리 흐름 분기만 정의" 범위 안에 포함됨 (chatChannel 분기가 기존 `config.chatChannel` 유무 분기의 자연스러운 확장).
- (d) **auth 실패 401 의 이유**: silent 2xx 도 가능하나 (a) 공격자가 brute-force 시 차이를 알 수 없게 하는 보안 이점은 있음. 그러나 운영자가 "왜 봇이 응답 안 함" 디버깅 시 401 가시성이 필요. (b) 텔레그램은 secret_token 검증 실패 시 retry 하지 않음을 documented behavior 로 의존 — non-2xx retry 폭주 위험 없음.
- (e) **404 케이스는 일반 webhook 경로와 동일** — endpointPath 자체가 존재하지 않으면 2xx 가 stale webhook 무한 잔존을 유발 ([WH-RS-02](../../spec/5-system/12-webhook.md) 와 동일 정책).

## 영향 spec 파일

| 파일 | 변경 요약 | 결정 |
|---|---|---|
| `spec/2-navigation/2-trigger-list.md` | §2.1 행 표시·§2.3 카드·§2.3.1 매트릭스 9 row 추가·§3 API 표 cross-link + PATCH 차단 cross-link·Rationale R-8 (chatChannel 카드 분리) | 1, 2 |
| `spec/5-system/15-chat-channel.md` | §4.1 `uiMapping.visualNode` enum 변경·§5.4 botToken single-path + `hasBotToken` derived 필드 정의·§5.5 신설 "Inbound HTTP Contract"·Rationale R-CC-10/R-CC-11/R-CC-12 추가 | 2, 3, 4 |
| `spec/5-system/12-webhook.md` | **C-1 해소** — WH-EP-07 본문에 chatChannel 예외 조항 추가 + §3.1 응답 코드 표 line 186 cross-link + §7 처리 흐름 step 5 cross-link | 4 |
| `spec/conventions/chat-channel-adapter.md` | §2.3 `ChatChannelConfig.uiMapping.visualNode` enum 변경 (text/photo/auto, default `auto`)·§3 시각형 노드 매핑 표에 enum 분기 row·Changelog 한 줄 | 3 |
| `spec/4-nodes/7-trigger/providers/telegram.md` | §5.4 시각형 매트릭스에 `visualNode` enum 값별 컬럼 직접 추가·§6 응답 코드 정책 cross-link (CCH §5.5) | 3, 4 |
| `spec/1-data-model.md` | §2.8 Trigger 의 `config` JSONB 설명 하단에 한 줄 cross-link 추가: "응답 DTO 전용 derived 필드 `hasBotToken: boolean` — SoT [Spec Chat Channel §5.4](../5-system/15-chat-channel.md#54-bot-token-rotation-api-응답-계약). DB 컬럼 아님." 컬럼 자체 변경 없음. | 2 |

**원자성 규칙**: 결정 3 (5+1 파일 중 chat-channel-adapter.md / 15-chat-channel.md / telegram.md 3개) 와 결정 4 (5+1 파일 중 15-chat-channel.md / 12-webhook.md / telegram.md 3개) 는 각각 한 commit 으로 묶는다. 결정 2 (15-chat-channel.md / 2-trigger-list.md / 1-data-model.md) 는 별도 commit 으로 분리 가능. 6 파일 전체를 한 PR 안에 두되 commit 단위는 결정별 분리 가능 (모두 같은 PR 머지).

## 영향 받지 않는 부분 (의도된 boundary)

- `spec/1-data-model.md` §2.8 의 **컬럼 구조** — 변경 없음. 이미 정의된 5개 chat_channel_* 컬럼 그대로. (단 §2.8 본문에 cross-link 한 줄만 추가 — 영향 spec 파일 표에 별도 행으로 명시했음.)
- `spec/conventions/secret-store.md` — 이미 정의된 ref 패턴 그대로.
- `spec/5-system/12-webhook.md` 의 WH-MG-08 / WH-MG-09 — 본 plan 은 WH-EP-07 + §3.1 응답 코드 표 + §7 처리 흐름 step 5 만 갱신. WH-MG-08 / WH-MG-09 본문은 그대로 (chatChannel 통합 정의 자체는 이미 cross-link 형태로 충분).
- `spec/conventions/conversation-thread.md` — 변경 없음.
- `codebase/**` — 본 plan 범위 밖. 후속 developer plan.
- `codebase/frontend/src/content/docs/**` — 본 plan 범위 밖. 후속 developer plan 에서 함께 정정.

## Rationale ID 컨벤션 (본 plan 범위)

`spec/5-system/15-chat-channel.md` 안에서 신규로 추가되는 Rationale 절은 **`R-CC-10` / `R-CC-11` / `R-CC-12`** prefix 를 사용한다 (`CC` = Chat Channel). 동 파일에는 이미 `[EIA §R10]` 등 외부 spec 의 Rationale 참조가 다수 있어 (line 33, 138, 353), 신규 로컬 Rationale 에 prefix 없는 `R10/R11/R12` 를 쓰면 검토자가 외부 참조와 혼동할 위험이 있음. `R-CC-` prefix 로 로컬-외부 구분.

`spec/2-navigation/2-trigger-list.md` 안 신규 Rationale 은 기존 `R-7` 다음의 `R-8` 사용 (기존 명명 컨벤션 유지 — 이 파일에는 외부 R-N 참조가 없음).

`spec/conventions/chat-channel-adapter.md` Changelog 행은 prefix 없이 기존 형식 그대로.

## 후속 plan (본 plan 머지 후 진입 가능)

1. `developer-trigger-list-chat-channel-card-ui` — 결정 1·2 의 UI 구현. 시작 전 `consistency-check --impl-prep` 의무.
2. `developer-telegram-guide-realign` — 유저 가이드 KO/EN 의 outdated 부분 정정 (현재 GUI 가 없음 → "현재 API 호출로만 등록 가능" 으로 다운그레이드 또는 UI plan 완료 후 GUI 단계로 격상). `codebase/frontend/src/content/docs/06-integrations-and-config/telegram.mdx` + `.en.mdx` + `02-nodes/triggers.mdx` + `.en.mdx` 4 파일.
3. **(필수 follow-up)** `chat-channel-visual-ssr-png.md` (이미 backlog) — 결정 항목 #2 본문의 `text_only` 이름을 `text` 로 rename 갱신 + `auto` v2 SSR 처리 정책 (chart/table → text 우선, carousel+imageUrl → photo collage) 추가. 본 plan 머지 직후 plan 문서만 1 commit 으로 갱신 (실제 SSR 인프라 도입은 별 trigger 조건 충족 후).
4. **(선행)** developer plan 1 의 UI 가 운영 DB 의 `visualNode: "text_only"` 값을 만나도 깨지지 않도록 어댑터 입력 단계 read-time normalize (`text_only` → `text`) fallback 코드를 함께 추가하거나, 별 마이그레이션 스크립트로 `UPDATE trigger SET config = jsonb_set(...)` 일괄 변환. 둘 중 선택은 developer plan 진입 시 운영 DB 조회 결과로 결정.

## 머지 순서 합의

본 plan 의 spec 5 파일 변경 PR 은 다음 plan 과 같은 영역을 건드린다. 머지 순서를 명시:

- `plan/in-progress/spec-fix-isactive-drawer-toggle.md` 도 `spec/2-navigation/2-trigger-list.md §2.3.1` 의 `isActive` row 를 수정한다. **본 plan 의 결정 1 매트릭스 9 row 추가는 `isActive` row 와 독립** — 두 PR 중 어느 쪽이 먼저 머지되어도 context diff 충돌 없음. 단 머지 순서 명문화:
  1. `spec-fix-isactive-drawer-toggle.md` 가 먼저 머지되면 본 plan 의 §2.3.1 base 행 수는 그대로 +1 (충돌 없음).
  2. 본 plan 이 먼저 머지되면 `spec-fix-isactive-drawer-toggle.md` 가 `isActive` row 위치를 재확인해야 함 (rebase 시 sweep).
  3. 어느 쪽도 `isActive` row 자체를 새로 추가하지 않음 → 충돌 가능성 = "같은 표 안의 다른 row 수정" 수준 (git 3-way merge 대부분 자동 해결).

## 라이프사이클

- 본 plan 의 spec 6 파일 변경이 한 PR 로 머지되면 → `plan/complete/spec-telegram-chat-channel-ui-polish.md` 로 이동.
- 후속 developer plan 들은 본 plan 의 결정을 인용하면서 별 PR 로 분리 진행.
