---
worktree: chat-channel-error-notify-6d37ec
started: 2026-05-25
owner: project-planner (spec) → developer (impl, TBD)
status: in-progress
related_specs:
  - spec/5-system/15-chat-channel.md
  - spec/conventions/chat-channel-adapter.md
  - spec/4-nodes/7-trigger/providers/telegram.md
  - spec/4-nodes/7-trigger/providers/slack.md
  - spec/4-nodes/7-trigger/providers/discord.md
  - spec/5-system/3-error-handling.md
---

# Chat Channel — 실행 실패 안내 메시지 (CCH-ERR-*)

외부 chat channel (`config.chatChannel` 보유 Webhook 트리거) 위 execution 이 `failed` 로 종결될 때, 어댑터가 채널 사용자에게 **에러 카테고리별 generic 안내 메시지** 를 자동 전송하도록 정식화. 민감정보 (stack / URL / DB 메시지 / executionId 등) 노출 금지.

## 사용자 요구사항 (원문)

> 텔레그램, 슬랙, 디스코드처럼 외부 채널에 연동한 경우, 시스템에서 오류가 발생하면 오류가 발생했다는 메세지를 전송해 줬으면 좋겠어. LLM이나 MCP등의 서드파티 오류인 경우, http status에 따라서 일반적인 오류 메세지로 안내하고, 서버 내부 오류인 경우에는 internal server error와 같은 일반적인 안내가 좋을 것 같아.

## 진단 — 현재 상태와의 갭

| 항목 | 현재 (PR #322 시점) | 본 plan 종료 후 |
|---|---|---|
| `execution.failed` event 어댑터 구독 | ✅ CCH-AD-05 가 5종 event 통합 구독 — `execution.failed` 포함 | 변경 없음 |
| Convention §3 매핑 표 `execution.failed` 행 | "에러 안내 (사용자에게 안전한 형태로 redact)" 한 줄 stub | 분류 알고리즘 §3.1 link + i18n 키 명시화 |
| 에러 카테고리 분류 정책 | 미정의 | CCH-ERR-02 (분류 입력 = `error.code` enum + `details.statusCode`) |
| i18n 안내 메시지 키 | `executionStillRunning` / `executionCompleted` / `executionStarted` / `groupChatRefusal` / `help` | + 6 신규 키 (`executionFailedThirdParty4xx` / `*5xx` / `*Timeout` / `*RateLimit` / `*ThirdParty` / `*Internal`) |
| 민감정보 strip 규약 | 미정의 | CCH-ERR-03 (`error.message` 원문·URL·query·stack·executionId 노출 금지, `{statusCode}` placeholder 만 허용) |
| 분류 helper 위치 | — | Convention §3.1 의 pure function (`classifyExecutionFailure(eiaEvent): { key, placeholders }`) — provider-invariant |
| Provider §5 (UI 매핑) | 5.1~5.5 만 (multi turn/buttons/form/visual/typing) | 신규 §5.6 "Execution Failed (CCH-ERR-*)" 한 paragraph — provider-specific 텍스트 합성 (MarkdownV2 escape / mrkdwn / Discord plain) |

## 설계 결정 요약

**Q1: 어댑터 인터페이스에 `renderError(failed)` 신설 vs 기존 `renderNode(event)` 안에 처리?**
→ **기존 `renderNode(execution.failed)` 안에 처리**. Convention §3 매핑 표가 이미 5종 EIA event 의 매핑 책임을 `renderNode` 에 부여하고 있어 (line 240 행 stub 존재), 새 함수 추가는 6함수 인터페이스 drift 를 만들 뿐 책임 분리 이득 없음. 대신 **분류 알고리즘 (provider-invariant pure function)** 을 별도 helper 로 정식화해 어댑터 안에서 호출. 분류 자체는 provider 와 무관 → DRY.

**Q2: 분류 helper 위치 — Convention vs Spec 본문 vs 코드만?**
→ **Convention `chat-channel-adapter.md` §3.1 신설**. Convention 은 이미 §3 (EIA event → renderNode 매핑), §4 (Form 다단계 시퀀스) 같은 cross-provider 공통 알고리즘의 SoT. 분류 알고리즘도 같은 layer. Spec `15-chat-channel.md` 는 시스템 동작·요구사항 ID 만 (CCH-ERR-* 등) 유지.

**Q3: `chat_channel_health` 영향?**
→ **변경 없음**. `chat_channel_health=degraded` 는 **어댑터 자체의 외부 API 호출 실패** (sendMessage retry 소진 등 — CCH-SE-01) 신호로 의미 분리. 실행 실패 안내 발송은 `output.error.code` 기반이라 어댑터 외부 자원 (LLM API / 사용자 HTTP 노드 호출 등) 상태 — health 무관. (Rationale R-CC-15 (d) 에 명시.)

**Q4: i18n placeholder 정책?**
→ **`{statusCode}` 1개만 허용**. 이는 정수이고 PII/secret 아님. `{errorCode}` / `{nodeName}` / `{message}` 등은 모두 비허용 — 사용자에게 노출되면 internal 구현 leak.

## 변경 범위 (spec)

1. **`spec/5-system/15-chat-channel.md`**
   - §3.4 (신뢰성/보안) 표 아래 새 §3.4.X "실행 실패 사용자 안내 (CCH-ERR-*)" 절 — 요구사항 ID 5개 (CCH-ERR-01 ~ 05)
   - §3.1 시퀀스 다이어그램의 `execution.failed` 박스 옆에 분류 helper → renderNode → sendMessage 화살표 추가
   - §4.1 `config.chatChannel.languageHints` 객체에 신규 키 6종 추가
   - §5.5 (Inbound HTTP Contract) 의 "어댑터 내부 에러" 행 — `chat_channel_health` 와 본 신기능 의미 분리 cross-link
   - §Rationale 신규 R-CC-15 "Execution Failed 안내 — 분류 입력 화이트리스트 + i18n key 정책"

2. **`spec/conventions/chat-channel-adapter.md`**
   - §3 매핑 표 `execution.failed` 행 — 출력을 "분류 helper §3.1 결과 → `text` 1건" 으로 격상
   - §3 끝에 신규 §3.1 "Execution Failed 분류 알고리즘 (`classifyExecutionFailure`)" — pure function 시그니처 + 카테고리 매핑 표 + placeholders 규약 + unknown fallback
   - §Rationale 신규 R5 "분류 helper 를 Convention 에 두는 이유" (cross-provider 공통, Form 다단계와 같은 layer)
   - Changelog 한 줄

3. **`spec/4-nodes/7-trigger/providers/telegram.md`**
   - §5 끝에 §5.6 "Execution Failed (CCH-ERR-*)" — MarkdownV2 escape 적용한 plain text sendMessage, `inline_keyboard` 미부여, ack 무관

4. **`spec/4-nodes/7-trigger/providers/slack.md`**
   - §5 끝에 §5.6 "Execution Failed (CCH-ERR-*)" — `chat.postMessage` plain text (mrkdwn 무사용), thread_ts 무관 (1:1 DM 가정)

5. **`spec/4-nodes/7-trigger/providers/discord.md`**
   - §5 끝에 §5.6 "Execution Failed (CCH-ERR-*)" — `POST /channels/{id}/messages` plain `content` (no embed, no components)

6. **`spec/5-system/3-error-handling.md`**
   - §1.4 (워크플로우 실행 에러) 표 아래 cross-link 한 줄 — "Chat Channel 어댑터의 사용자 안내 분류는 [Convention §3.1](../conventions/chat-channel-adapter.md#31-execution-failed-분류-알고리즘) 참조" — 본 spec 의 enum 이 분류 입력의 SoT 임을 명시

## 변경 범위 (구현 — 후속 developer plan)

본 plan 의 spec 단계 완료 후 **별 PR / 같은 PR** 결정 (Q5). 권장: **같은 PR** — spec 만으로는 사용자 체감 가치 없음. e2e 1회 통과 시까지 묶음.

### Backend (`codebase/backend/src/modules/chat-channel/`)

| 파일 | 변경 |
|---|---|
| `chat-channel.dispatcher.ts` | `execution.failed` event 분기에서 `classifyExecutionFailure(event)` 호출 → 결과 (`key`, `placeholders`) 를 `renderNode(event, ...classified)` 의 입력으로 전달 |
| `shared/execution-failure-classifier.ts` (신규) | Pure function — Convention §3.1 표를 코드로 구현. unit test fixture 다수 |
| `providers/telegram/telegram-message.renderer.ts` | `execution.failed` case 추가 — `languageHints[key]` lookup + `{statusCode}` placeholder 치환 + MarkdownV2 escape |
| `providers/slack/slack-message.renderer.ts` | 동일 — mrkdwn 무사용 plain text |
| `providers/discord/discord-message.renderer.ts` | 동일 — `content` field plain text |
| `dto/create-trigger.dto.ts` + `dto/update-trigger.dto.ts` | `languageHints` 객체 validation 에 신규 6 키 optional 허용 (기존 키와 동일 패턴). `languageLocale: "ko" \| "en"` enum field 추가 (optional, default "ko"). `languageHints` template placeholder 검증 — 허용 placeholder `{statusCode}` 만, 그 외 발견 시 `400 VALIDATION_ERROR (code='UNKNOWN_PLACEHOLDER')` (R-CC-15 (c)). |
| Default `languageHints` (registry 또는 provider adapter) | 한국어 + 영어 default 12 문구 (KO 6 + EN 6) 추가. lookup 순서: (1) `languageHints[key]` override → (2) `config.chatChannel.languageLocale` 의 default → (3) 'ko' fallback. Convention §3.1 helper 와 분리 (helper 는 key 만 결정, locale 분기는 어댑터). |

### Tests

| Layer | 파일 | 시나리오 |
|---|---|---|
| Unit | `execution-failure-classifier.spec.ts` | 카테고리 8종 매핑 + unknown fallback + `details.statusCode` 우선순위 + missing details 안전성 |
| Unit | `{telegram,slack,discord}-message.renderer.spec.ts` | `execution.failed` 입력 → `languageHints` lookup + placeholder 치환 + 민감정보 미포함 assertion |
| e2e | `chat-channel-{telegram,slack,discord}-failure-notify.e2e-spec.ts` (신규 또는 기존 e2e 확장) | execution 강제 failed (LLM mock 500 / HTTP_4XX node) → 해당 채널에 generic 안내 sendMessage 호출 mock 검증 |

### Frontend

| 영향 여부 | 비고 |
|---|---|
| `trigger-detail-drawer.tsx` (chatChannel languageHints 편집 UI) | `languageHints` 편집 form 이 존재하면 신규 6 키 추가. 미존재 시 본 plan 범위 밖 |
| i18n dict `triggers.ts` (ko/en) | "실행 실패 안내" section label 정도 — UI label 변경 시만 |

### User Guide 동반 갱신 ([PROJECT.md §변경 시 동반 갱신 매트릭스](../../PROJECT.md))

`languageHints` 편집 가이드 페이지가 `codebase/frontend/src/content/docs/**` 에 존재하면 신규 키 6종 설명 추가. 별도 사용자 가이드 페이지가 없으면 user-guide-writer 위임 검토 (별 step).

## Phase 분해

- **Phase 1 — spec 정식화** (본 plan, project-planner)
  1. spec draft 작성
  2. `/consistency-check --spec` 호출 (BLOCK 시 차단)
  3. spec 본 적용 (15-chat-channel / convention / 3 providers / 3-error-handling)
  4. `docs(spec): chat-channel — 실행 실패 안내 (CCH-ERR-*) 도입` commit

- **Phase 2 — backend impl + unit test** (developer)
  1. `/consistency-check --impl-prep` 호출
  2. classifier + renderer 변경 + DTO validation
  3. `chat-channel*` unit test 통과 (`pnpm --filter backend test`)

- **Phase 3 — e2e** (developer)
  1. provider 별 1개 e2e 시나리오 추가
  2. `pnpm --filter backend test:e2e` 통과 — 면제 화이트리스트 검토

- **Phase 4 — code review + 동반 갱신** (code-review-agents)
  1. `/ai-review` 호출
  2. user-guide / i18n dict 동반 갱신 누락 검토
  3. PR open

## 산출물

- `spec/5-system/15-chat-channel.md` diff (§3.4.X + §4.1 + §3.1 시퀀스 + Rationale R-CC-15)
- `spec/conventions/chat-channel-adapter.md` diff (§3 표 격상 + §3.1 신설 + Rationale R5 + Changelog)
- `spec/4-nodes/7-trigger/providers/{telegram,slack,discord}.md` 각각 §5.6 신규
- `spec/5-system/3-error-handling.md` §1.4 cross-link 한 줄
- 본 plan 파일 (이 파일)
- (후속) backend / test / e2e 변경 — 별 commit

## 결정 (사용자 응답 2026-05-25)

- **Q5: spec PR + 구현 PR 분리 vs 한 묶음?** → **한 묶음** (e2e 1회 통과 의미 확보). Phase 1-4 같은 worktree (`chat-channel-error-notify-6d37ec`) 연속 진행.
- **Q6: i18n default 문구 — KO + EN 둘 다?** → **KO + EN 둘 다 spec 에 미리 정의**. `config.chatChannel.languageLocale: "ko" | "en"` (default "ko") 필드 신설로 사용자 override 부담 감소. 기존 5 키 (`groupChatRefusal` 등) 의 EN 화는 본 PR 범위 밖 (별 plan). 본 변경은 commit 2 차 spec 보강으로 적용.
