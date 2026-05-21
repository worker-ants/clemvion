# 문서화(Documentation) 리뷰

**검토 대상**: Chat Channel Telegram worktree — spec/plan/review 산출물 전체
**검토일**: 2026-05-22
**파일 수**: 35개 (spec 9, plan 2, review/consistency 24)

---

## 발견사항

### [WARNING] `spec/5-system/15-chat-channel.md` — 본문에서 참조되는 telegram.md §5.4 앵커가 중복 번호로 인해 깨질 위험

- **위치**: `spec/5-system/15-chat-channel.md §5.1` → `[providers/telegram §5.4](../4-nodes/7-trigger/providers/telegram.md#54-보안)`
- **상세**: `telegram.md` 에 `### 5.4 Carousel/Chart/Table` (줄 129) 과 `## 5.4 보안` (줄 144) 두 섹션이 동일 번호를 공유한다. Markdown 렌더러는 중복 앵커에 `-1` / `-2` suffix 를 붙이거나 첫 번째 매칭만 반환하므로, `15-chat-channel.md §5.1` 의 `#54-보안` 링크가 보안 섹션이 아닌 Carousel/Chart/Table 섹션으로 연결될 수 있다. 주석 정확성 및 cross-reference 신뢰성에 직접 영향.
- **제안**: `telegram.md` 의 보안 섹션 번호를 `## 6. 보안` 으로 승격하고, `15-chat-channel.md §5.1` 의 참조 앵커를 함께 수정.

---

### [WARNING] `spec/conventions/chat-channel-adapter.md` — `EiaEvent.execution.cancelled` 의 `/* EIA §6.5 */` 주석이 `execution.ai_message` 와 섹션 번호를 공유하여 오독 가능

- **위치**: `spec/conventions/chat-channel-adapter.md §1.2` `EiaEvent` union 마지막 member
- **상세**: `execution.ai_message` 가 `/* EIA §6.5 + WS §4.4 ai_message */`, `execution.cancelled` 가 `/* EIA §6.5 */` 로 동일 섹션 번호를 참조한다. EIA §6.5 가 두 이벤트를 하나의 섹션에서 다루기 때문에 발생한 상황이나, 인라인 주석만 보면 두 이벤트의 spec 출처가 동일 섹션인지 구분이 안 된다. 주석 정확성 문제.
- **제안**: `execution.cancelled` 주석을 `/* EIA §6.5 (cancelled) */`, `execution.ai_message` 를 `/* EIA §6.5 (ai_message) + WS §4.4 */` 로 구분하거나, EIA spec §6.5 를 `§6.5 execution.cancelled` / `§6.6 execution.ai_message` 로 분리하여 SoT 참조를 1:1 로 만든다.

---

### [WARNING] `spec/conventions/chat-channel-adapter.md` — CHANGELOG 섹션 부재로 6함수 인터페이스 변경 이력 추적 불가

- **위치**: `spec/conventions/chat-channel-adapter.md` 전체 — Rationale 이후 Changelog 섹션 없음
- **상세**: `spec/conventions/cafe24-api-catalog/_overview.md` 가 §7 CHANGELOG 를 유지하는 패턴을 이 프로젝트가 사용한다. `chat-channel-adapter.md` 는 6함수 어댑터 인터페이스(`parseUpdate` / `setupChannel` / `teardownChannel` / `renderNode` / `sendMessage` / `ackInteraction`) 를 최초로 정의하는 규약 문서임에도 초기 버전 기록과 이력 추적 수단이 없다. 향후 함수 시그니처가 변경될 때 history 를 소급하기 어렵다.
- **제안**: Rationale 다음에 `## Changelog` 섹션을 추가하고 `| 2026-05-21 | v1 — 6함수 인터페이스 최초 도입 |` 를 초기 row 로 등재.

---

### [WARNING] `spec/4-nodes/7-trigger/providers/telegram.md §5.3` — `phone` 필드 타입이 Form 노드 spec 에 정의되지 않아 인라인 주석이 불충분

- **위치**: `spec/4-nodes/7-trigger/providers/telegram.md §5.3` Form 필드 keyboard hint 표의 `(특수) phone` 행
- **상세**: `Form 노드 spec(spec/4-nodes/6-presentation/4-form.md)` 의 `type` enum 에 `phone` 이 없다. `telegram.md §5.3` 은 `phone` 을 `(특수)` 로만 표기하고, 이것이 `type: 'text' + pattern` 인지 별도 enum 값인지 인라인 주석이 설명하지 않는다. 독자(구현자)가 Form spec 을 읽고 `phone` 타입을 어디서 도출해야 하는지 알 수 없다.
- **제안**: 해당 행의 설명란에 "Form spec 에 `phone` 타입 미존재 — `type: 'text' + pattern: '<전화번호 regex>'` 로 대응하거나 Form spec 에 `phone` 추가 필요 (미결)" 를 명시. 또는 `spec/4-nodes/6-presentation/4-form.md` 에 `phone` 타입을 추가하고 telegram.md 에서 해당 spec 으로 cross-link.

---

### [WARNING] `spec/5-system/15-chat-channel.md §4.1` — `secretToken` 필드가 ChatChannelConfig 인터페이스 문서에 누락

- **위치**: `spec/4-nodes/7-trigger/providers/telegram.md §3.1 setupChannel` — `"secret_token": "…", // config.chatChannel.secretToken 에 저장`; `spec/conventions/chat-channel-adapter.md §2.3 ChatChannelConfig` — 필드 목록에 `secretToken` 없음
- **상세**: `setWebhook` 등록 시 발급하는 webhook secret 을 `config.chatChannel.secretToken` 에 저장한다고 `telegram.md` 가 명시하나, `ChatChannelConfig` 인터페이스 문서와 `Trigger.config.chatChannel` JSONC 예시 어디에도 이 필드가 선언되지 않았다. API 문서(인터페이스 명세)와 구현 상세(provider spec) 간 불일치. 구현자가 `ChatChannelConfig` 만 보면 필드를 추가하지 않는다.
- **제안**: `spec/conventions/chat-channel-adapter.md §2.3 ChatChannelConfig` 에 `secretToken?: string` 를 추가하고, 보안 처리 방침(서버 자체 생성 값이므로 secret store reference 불필요 여부)을 명시. `15-chat-channel.md §4.1` JSONC 예시에도 반영.

---

### [WARNING] `spec/2-navigation/4-integration.md §Rationale` — Rationale 서술이 상세도를 잃어 향후 참조 맥락 감소

- **위치**: `spec/2-navigation/4-integration.md` 줄 2014 — 개정 전: `**(c) 의미 기반 명명 선례 예외** — 본 프로젝트의 에러 코드는 의미 기반 명명을 원칙으로 하나, CAFE24_PRIVATE_APP_ALREADY_CONNECTED 는 historical artifact 예외로 등록한다 (2026-05-15 신설 당시 Private 흐름 한정이었으나 이후 app_type 무관으로 확장). 신규 코드는 이 예외를 따르지 않으며 처음부터 의미 정확한 이름을 부여한다. (※ 의미 기반 명명 원칙의 정식 규약화는 별 plan 으로 추적 — cafe24-backlog-residual.md F-3 follow-up 참조)` → 개정 후 해당 역사적 맥락(신설 시점, app_type 확장 경위, follow-up plan 참조) 이 삭제됨.
- **상세**: 이 Rationale 항목에서 에러코드 신설 날짜, private 흐름 한정이었다가 확장된 이유, follow-up plan 추적 링크가 제거되었다. Rationale 의 목적은 "결정의 배경·근거" 보존이므로 삭제된 부분이 미래 검토자에게 필요한 맥락이다. 변경 이력 관점에서 후퇴.
- **제안**: 개정 후 텍스트에도 최소한 "(2026-05-15 신설 당시 Private 흐름 한정이었으나 이후 app_type 무관으로 확장 — historical artifact)" 와 F-3 follow-up plan 참조를 유지할 것.

---

### [INFO] `spec/4-nodes/7-trigger/0-common.md` — providers 디렉토리 진입 문장이 단일 줄 인라인 형태로 가독성 낮음

- **위치**: `spec/4-nodes/7-trigger/0-common.md` 줄 7 추가 라인
- **상세**: `- Webhook 트리거의 chat channel adapter provider catalog → [providers/_overview.md](./providers/_overview.md) (외부 chat 플랫폼 어댑터 — Telegram 등). 트리거 노드 자체가 아니라 Webhook 트리거의 config.chatChannel 갈래로 동작 — [Spec Chat Channel](../../5-system/15-chat-channel.md) 참조` 가 한 불릿 안에 여러 개념(카탈로그 링크 + 설명 + 동작 방식 + 별도 cross-link)을 압축하고 있다. 이 줄만 읽어서는 구조를 파악하기 어렵다.
- **제안**: 두 줄로 분리: 첫 줄은 카탈로그 진입 링크, 둘째 줄에 "트리거 유형으로 추가된 것이 아니라 Webhook trigger `config.chatChannel` 의 하위 갈래 — 상세는 [Spec Chat Channel]" 형태로 정리. 또는 `_overview.md` 링크만 남기고 상세 설명을 `_overview.md` 에서 제공.

---

### [INFO] `spec/5-system/15-chat-channel.md §4.1` — v1 구현이 `botToken` 평문 보관을 채택하지만 spec 은 `secret://` reference 만 명시 — 독자가 구현과 spec 불일치를 발견할 때 안내 없음

- **위치**: `spec/5-system/15-chat-channel.md §4.1 botTokenRef` 필드 설명
- **상세**: `chat-channel-impl.md §3.4` 결정에서 v1 구현은 평문 저장을 채택하고 spec 갱신을 별 plan 으로 분리한다고 명시되어 있으나, spec 본문 자체에는 이 일시적 불일치에 대한 주석이 없다. 구현 코드와 spec 을 대조하는 리뷰어가 혼란을 겪을 수 있다. 단일 진실 원칙에서도 spec 이 구현 의도를 정확히 반영하지 않는 과도기 상태임을 주석으로 명시하는 것이 바람직하다.
- **제안**: §4.1 의 `botTokenRef` 설명에 `<!-- v1 구현: 평문 Trigger.config.chatChannel.botToken 으로 stub. 별 plan spec-update-chat-channel-bot-token-stub 에서 secret reference 경로로 갱신 예정 -->` 주석 추가.

---

### [INFO] `spec/5-system/12-webhook.md §7 처리 흐름` — Chat Channel 분기 스텝 번호가 재사용되어 기존 경로와 병렬 이해 어려움

- **위치**: `spec/5-system/12-webhook.md` diff 줄 2173–2190
- **상세**: 개정 전에는 스텝 7→8→9→10 이 선형이었다. 개정 후 스텝 7 이 "config.chatChannel 가 있으면" / 스텝 8 이 "없으면" 으로 분기되고, 스텝 9 / 10 은 두 경로가 끝난 후 공통 처리로 남아 있다. 독자는 스텝 9 ("Trigger.lastTriggeredAt 업데이트") 와 10 ("202 반환") 이 Chat Channel 분기에도 적용되는지, 혹은 분기 f 에서 이미 202 를 반환했으므로 스텝 10 이 기존 경로에만 해당하는지 파악하기 어렵다.
- **제안**: 스텝 7f 의 "202 Accepted 즉시 반환" 이후에 "→ 이 경우 스텝 9만 수행하고 스텝 10 은 스킵" 을 명시하거나, 분기별 스텝 목록을 테이블/코드 블록으로 분리.

---

### [INFO] review/consistency 산출물 파일들 — `_retry_state.json` 두 파일 모두 마지막 줄 newline 없음

- **위치**: `review/consistency/2026/05/21/17_55_28/_retry_state.json` 줄 385; `review/consistency/2026/05/21/18_10_33/_retry_state.json` 줄 1027; `review/consistency/2026/05/21/23_49_16/_retry_state.json` 줄 1460; `review/consistency/2026/05/21/23_49_16/meta.json` / `review/consistency/2026/05/21/18_10_33/meta.json` 도 동일
- **상세**: 모든 JSON 기계 생성 파일이 `\ No newline at end of file` 로 끝난다. JSON 파일 자체의 기능에는 영향 없으나, POSIX 파일 컨벤션(최종 newline 필수)에서 벗어난다. 팀의 코딩 컨벤션이 규정한다면 수정 필요.
- **제안**: 이 파일들이 자동 생성된 것이라면 생성기(orchestrator)에서 최종 newline 을 append 하도록 수정. 수동 조치 부담은 낮으나 생성기 표준화를 권장.

---

### [INFO] `plan/in-progress/node-config-required-defaults-sweep.md` — 후속 follow-up 목록에 "spec Rationale 공식화" 항목의 담당 worktree/plan이 미지정

- **위치**: `plan/in-progress/node-config-required-defaults-sweep.md §후속 follow-up` — "spec Rationale 공식화 — ... consistency-check I-5 지적사항. **UiHint DSL canonical 정의** ... — 2026-05-19 requiredwhen-dsl-whitelist 의 consistency W-2 에서 식별"
- **상세**: 이 항목은 `~~취소선~~` 처리가 없으므로 미완료 follow-up 으로 남아 있다. 그러나 담당 plan 파일명 / worktree 가 명시되지 않아 추적이 어렵다. 나머지 완료·분리 항목은 모두 `별 plan [plan-name](./plan-name.md)` 형태로 링크가 있다.
- **제안**: "spec Rationale 공식화" 항목에 별 plan 이 신설될 때까지 `(미신설 — TODO: 별 plan 생성)` 을 명시하거나, 신설 시 다른 항목과 동일하게 link 를 추가.

---

## 요약

이번 변경은 Chat Channel Telegram 어댑터의 spec / plan / review 산출물을 대거 추가한다. 전반적으로 spec 문서들은 Overview / 본문 / Rationale 3섹션 구조를 따르고, 주요 결정마다 Rationale 이 동반되며, cross-link 가 촘촘하게 구성되어 있다. 문서화 관점에서 주된 우려는 두 가지다. 첫째, `telegram.md` 의 중복 섹션 번호(`§5.4`)로 인해 `15-chat-channel.md` 에서 걸어 놓은 앵커 링크가 잘못된 섹션으로 연결될 위험이 있으며, 이는 API 문서 / spec cross-reference 정합성 문제다. 둘째, `ChatChannelConfig` 인터페이스 정의(`chat-channel-adapter.md §2.3`)에서 `secretToken` 필드가 누락되어 구현자가 `telegram.md §3.1` 의 저장 명세를 따를 때 타입 문서와 불일치를 직면한다. 그 외 인라인 주석의 정밀도 개선(EiaEvent 섹션 번호 중복 주석, phone 타입 미정의 설명), CHANGELOG 추가, v1 stub 구현과 spec 불일치에 대한 안내 주석 등이 INFO/WARNING 수준으로 발견되었다. CRITICAL 수준의 문서화 누락은 없다.

---

## 위험도

MEDIUM

---

STATUS: SUCCESS ISSUES=8 PATH=/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-telegram-0c106c/review/code/2026/05/22/00_52_38/documentation.md RESET_HINT=
