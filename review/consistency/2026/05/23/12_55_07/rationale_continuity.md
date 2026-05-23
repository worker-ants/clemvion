# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-telegram-chat-channel-ui-polish.md`
검토 모드: spec draft (--spec)
검토 일시: 2026-05-23

---

## 발견사항

### 1. [WARNING] 결정 2 — botToken PATCH 차단: R-2 의 two-path 유지 원칙과 부분 긴장
- **target 위치**: 결정 2 "single-path 결정" — `PATCH body 의 config.chatChannel.botTokenRef 변경은 차단 (400 VALIDATION_ERROR)`.
- **과거 결정 출처**: `spec/2-navigation/2-trigger-list.md §3` 의 PATCH 설명 및 Rationale R-2 (Webhook HMAC secret 입력 vs rotate 분리, 2026-05-22). R-2 는 `hmacSecret` 의 두 경로(PATCH 직접 입력 v1 + rotate 액션 v1.1) 를 **의도적으로 공존** 시키는 결정이다. 관련 불변: "동일 자원에 대해 PATCH 직접 입력 경로도 v1 에서 허용".
- **상세**: R-2 의 핵심 근거는 "v1 은 PATCH 직접 입력 (grace 없음), v1.1 은 grace rotate" 이다. 이 원칙의 연장선에서 보면 `botTokenRef` 도 PATCH v1 직접 입력 → rotate v1.1 패턴이 자연스럽다. 그런데 target 결정 2 는 `botTokenRef` 에 대해 PATCH 경로를 완전히 차단하고 rotate 단일 경로만 허용한다. 이 자체는 정당화가 가능하다(`hmacSecret` 과 달리 외부 provider bot token 은 grace 정책이 항상 필요하므로). 그러나 target 은 R-2 의 맥락에서 **왜 `botTokenRef` 가 `hmacSecret` 과 다른 two-path 공존 패턴을 따르지 않는지** 를 새 Rationale 에서 명시적으로 서술하지 않고 있다. target 의 "신설 Rationale" 항목(단일 경로 정당화)에 `hmacSecret` R-2 와의 대비 설명이 없어 번복 근거가 불완전하다.
- **제안**: spec PR 의 `spec/5-system/15-chat-channel.md §5.4 Rationale` 신설 항목에 "R-2(hmacSecret 두 경로 공존) 와의 차이 — botToken 은 rotate 시 grace 24h 정책이 항상 필요하고 PATCH 직접 교체는 grace 없는 즉시 교체라 grace 정책 일관성을 깬다 (단순 입력 교체 = grace 없음 → 봇 재연결 단절 위험)" 를 한 항목으로 추가한다.

---

### 2. [INFO] 결정 3 — `visualNode: "text_only"` 기각 이력 없이 rename
- **target 위치**: 결정 3 "enum 의미" — `"text_only"` → `"text"` rename.
- **과거 결정 출처**: `spec/conventions/chat-channel-adapter.md §2.3 ChatChannelConfig.uiMapping.visualNode` (현행 `"photo" | "text_only"`). `chat-channel-adapter.md` Changelog (2026-05-21 초도 도입) 에서 `text_only` 가 원안 그대로 채택된 이력만 있고 `text_only` 를 채택한 Rationale 항목은 별도 기재되지 않았다.
- **상세**: `text_only` 가 명시적 Rationale 에서 기각된 대안이 아니라 초도 도입 값이므로, 엄밀히는 "기각된 대안의 재도입" 케이스가 아니다. 다만 rename 의 정당화(target 결정 3 의 Rationale (a)) 는 "영문 일관성 (`photo` / `auto` 와 동급 단어)" 으로 충분히 명시되어 있다. 추가 권고: spec PR 의 Changelog 행에 "이전 `text_only` 가 기각된 것이 아니라 rename 임을 명시" 문구를 한 줄 추가해 향후 검토자가 오해하지 않도록 한다.
- **제안**: `chat-channel-adapter.md` Changelog 의 해당 행 설명에 "rename (기존 `text_only` 폐기, 의미 동일)" 를 명시하면 충분.

---

### 3. [INFO] 결정 4 — WH-EP-07 예외 추가: webhook spec Rationale "Chat Channel 분리" 원칙과 정합 확인 필요
- **target 위치**: 결정 4 — `spec/5-system/12-webhook.md` WH-EP-07 에 chatChannel 예외 조항 추가.
- **과거 결정 출처**: `spec/5-system/12-webhook.md Rationale` — "Chat Channel 어댑터 — 별도 spec 으로 분리 (2026-05-21)": "본 spec 은 `chatChannel` config 의 위치(§2.2) + WH-MG-08/09 의 관리 요구사항 + §7 처리 흐름의 분기만 정의하고, 어댑터 인터페이스·provider 별 구체·EIA 와의 관계는 모두 Chat Channel spec 에 위임."
- **상세**: 과거 결정은 `12-webhook.md` 가 chat channel 관련 처리를 "처리 흐름 분기(§7) + 관리 요구사항(WH-MG-08/09)" 에 한정하고 상세는 `15-chat-channel.md` 에 위임하도록 경계를 설정했다. target 이 WH-EP-07 본문에 chatChannel 예외 조항을 **직접 삽입**하는 방식은 이 원칙의 경계선 안에 있다(요구사항 행 자체에 예외 조항 + cross-link 형태). 다만 `spec/5-system/12-webhook.md §3.1 응답 코드 표(line 186)` 와 `§7 처리 흐름 step 5` 에도 cross-link 를 추가하는 것은 "처리 흐름 분기 명시" 범위 안이라 과거 분리 원칙과 정합한다. 위반이 아니므로 INFO 등급. 단, spec PR 작성 시 `12-webhook.md Rationale` 의 "처리 흐름 분기만 정의" 항목에 "WH-EP-07 의 chatChannel 예외 조항도 이 범위 안에 포함됨" 을 한 문장 추가하면 명시적 근거가 더 완결된다.
- **제안**: `12-webhook.md Rationale` 마지막 항에 "WH-EP-07 chatChannel 예외 조항(비활성 트리거 200 OK)은 chat-channel provider 의 응답 코드 정책이 일반 webhook 의 정책 선언 위치(WH-EP-07)에 명시돼야 일반 webhook 구현자가 예외를 인지할 수 있으므로 본 spec 안에 예외 조항을 두었다" 를 한 문장 추가.

---

### 4. [INFO] 결정 1 — `botTokenRef` / `secretTokenRef` 를 사용자에게 노출 금지: 기존 Rationale 와 정합, 추가 명시 권고
- **target 위치**: 결정 1 — "내부 ref (`botTokenRef`, `secretTokenRef`) 는 사용자에게 절대 노출 금지 — 매트릭스 표기 X + Rationale 명시."
- **과거 결정 출처**: `spec/5-system/15-chat-channel.md CCH-SE-03` 및 `§4.1` — botTokenRef / secretTokenRef 는 config JSONB 에 ref 만 보관, plaintext 는 secret store 에. `spec/conventions/chat-channel-adapter.md §6` — "plaintext 는 config JSONB / 로그 / metric 에 절대 노출 금지".
- **상세**: 기존 Rationale 는 plaintext 노출 금지를 명시했으나 ref 자체의 UI 노출 금지는 명시적으로 별도 항목으로 기록되지 않았다. target 이 신규 UI 매트릭스에서 ref 를 제외하는 것은 합리적 확장이며 CCH-SE-03 의 암묵적 invariant 와 정합한다. 위반이 아님.
- **제안**: spec PR 의 `spec/2-navigation/2-trigger-list.md Rationale R-8` (chatChannel 카드 분리 근거) 안에 "botTokenRef / secretTokenRef 는 secret store ref 경로라 UI 상 노출 자체가 사용자에게 의미 없고 CCH-SE-03 의 노출 금지 원칙을 UI 계층까지 연장" 을 짧게 추가.

---

### 5. [WARNING] 결정 2 — `hasBotToken` DTO 파생 필드: `ChatChannelConfig` in-memory type 에서 제외 결정이 기존 컨벤션의 "SoT 단일화" 원칙과 부분 긴장
- **target 위치**: 결정 2 — "`ChatChannelConfig` (`spec/conventions/chat-channel-adapter.md §2.3`) 의 in-memory type 에는 포함하지 않음 (DTO 전용 — 변환 layer 는 backend response interceptor 책임)."
- **과거 결정 출처**: `spec/conventions/chat-channel-adapter.md §2.3` — "`ChatChannelConfig` 구조는 [Spec Chat Channel §4.1] 의 단일 진실을 따른다 (drift 회피)." 변경 관리 §7 — "본 인터페이스 변경은 다음 두 spec 동시 갱신 의무: 15-chat-channel.md + 4-nodes/7-trigger/providers/<name>.md".
- **상세**: 기존 컨벤션은 `ChatChannelConfig` 의 SoT 를 `15-chat-channel.md §4.1` 로 지정하고 drift 를 방지하도록 설계했다. `hasBotToken` 은 DB 컬럼이 아니고 DTO 파생 필드라 `ChatChannelConfig` (in-memory runtime type) 에 넣지 않는 것 자체는 합리적이다. 그러나 target 이 "DTO 전용, response interceptor 책임" 으로 결정을 내리면서 `chat-channel-adapter.md §2.3` 의 `ChatChannelConfig` type 이 왜 이 필드를 포함하지 않는지, 그리고 `15-chat-channel.md §5.4 canonical` 정의와 `§4.1 ChatChannelConfig` SoT 의 관계가 어떻게 분리되는지를 컨벤션 레벨에서 명시하지 않고 있다. 컨벤션 §2.3 는 변경 없이 `hasBotToken` 이 DTO 레이어에만 존재함을 알 수 없다.
- **제안**: `spec/conventions/chat-channel-adapter.md §2.3` 에 "응답 DTO 전용 파생 필드(`hasBotToken` 등) 는 본 `ChatChannelConfig` in-memory type 에 포함하지 않는다 — [Spec Chat Channel §5.4](../5-system/15-chat-channel.md#54-bot-token-rotation-api-응답-계약) 가 DTO 파생 필드의 SoT" 를 한 줄 주석으로 추가하거나, 변경 관리 §7 에 "DTO 전용 파생 필드는 별도 동시 갱신 의무 대상 아님" 을 명시한다.

---

## 요약

target 문서(`spec-telegram-chat-channel-ui-polish.md`)의 결정 4건은 대체로 기존 Rationale 와 연속적이다. 가장 두드러진 긴장은 두 가지다. 첫째, 결정 2의 botToken single-path(PATCH 완전 차단)가 기존 `hmacSecret` 의 R-2(두 경로 공존)와 대조되는데, 왜 두 자원이 다른 정책을 적용받는지 새 Rationale 에서 명시적으로 대비 서술하지 않아 번복 근거가 불완전하다. 둘째, `hasBotToken` 을 DTO 전용으로 결정하면서 `chat-channel-adapter.md §2.3`의 "단일 진실" 컨벤션에 조용히 예외를 만드는데, 컨벤션 문서 자체를 업데이트하지 않으면 향후 drift 위험이 생긴다. 나머지는 INFO 수준으로 spec PR 작성 시 관련 Rationale 에 문장 몇 개를 추가하는 수준으로 해소된다. 명시적으로 기각된 대안을 재도입하거나 합의된 invariant 를 직접 위반하는 사안은 발견되지 않았다.

---

## 위험도

MEDIUM
