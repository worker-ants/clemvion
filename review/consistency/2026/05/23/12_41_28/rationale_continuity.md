# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-telegram-chat-channel-ui-polish.md`
검토 모드: spec draft (--spec)
검토일: 2026-05-23

---

## 발견사항

### [WARNING] 결정 3 — `visualNode` enum 변경에서 기존 `text_only` 값 폐기의 Rationale 부재

- **target 위치**: 결정 3 "기존 `text_only` 와 `photo` 의 2-enum 명세를 폐기하고 위 3-enum 으로 교체 — `text_only` → `text` 로 rename (영문 일관성)"
- **과거 결정 출처**: `spec/conventions/chat-channel-adapter.md` §2.3 `ChatChannelConfig` 타입 정의 — `visualNode?: "photo" | "text_only"`. `spec/5-system/15-chat-channel.md` §4.1 데이터 모델 — `"visualNode": "photo" | "text_only"`. 두 spec 의 현 값 `"text_only"` 는 기각된 대안이 아니라 현행 합의 값이다.
- **상세**: target 은 `text_only` → `text` 로 rename 하고 `auto` 를 추가한 3-enum (`"text" | "photo" | "auto"`) 으로 교체하겠다고 선언하면서, "Rationale 신설" 을 약속하고 있다. 그러나 현행 spec 에서 `text_only` 가 선택된 배경(왜 `text` 가 아니라 `text_only` 인가)이 기존 Rationale 어디에도 명시되어 있지 않기 때문에, target 의 rename 이 단순 cosmetic 정정인지 아니면 의미적 변경인지가 현재의 plan 문서만으로는 확인이 어렵다. 한편 `auto` 신설도 기존 Rationale 에서 명시적으로 기각된 대안이 아니므로 CRITICAL 은 아니다. 다만 target 이 "Rationale 신설" 을 plan 레이어에서만 약속하고 실제 spec 파일 Rationale 절에 아직 작성되지 않은 채로 review 에 올라온다면, spec 변경 전 신뢰성 담보가 부족하다.
- **제안**: spec 변경 PR 에서 `spec/conventions/chat-channel-adapter.md` §Changelog 와 `spec/5-system/15-chat-channel.md` Rationale 에 "(a) `text_only` → `text` rename 의 이유, (b) `auto` 신설 및 v1 fallback 정책 정당화, (c) 이전 2-enum 결정과의 관계" 를 동시에 작성하도록 plan 에 명시 강화.

---

### [WARNING] 결정 4 — 비활성 트리거에 대한 200 OK 정책이 기존 WH-EP-07 / §7.5 의 `410 Gone` invariant 와 충돌 가능성

- **target 위치**: 결정 4 케이스 매트릭스 — "비활성 trigger" 케이스에 `200 OK + { ok: true }` + "silent skip"
- **과거 결정 출처**: `spec/5-system/12-webhook.md` WH-EP-07 "비활성 트리거로의 요청은 `410 Gone` 응답 반환 (필수)". §7 처리 흐름 step 5 "Trigger.isActive === false → 410 Gone". §3.1 에러 응답 표 — `410 Gone: 트리거가 비활성 상태`.
- **상세**: `12-webhook.md` 는 비활성 트리거에 대한 응답을 `410 Gone` 으로 명확히 정의하였고, 이는 WH-EP-07 (필수 요구사항) 로 격상된 합의 결정이다. target 의 결정 4 는 chat channel 어댑터 경로의 inbound 에서 "비활성 트리거" 를 `200 OK + silent skip` 으로 처리하겠다고 명시한다. 이 두 정책이 같은 `POST /api/hooks/:endpointPath` 엔드포인트에 적용되는 경우, chat channel 경로가 일반 webhook 경로의 `410 Gone` invariant 를 우회하는 구조가 된다. target 의 Rationale 에서 "텔레그램 Bot API 가 non-2xx 응답 시 webhook 자동 비활성화 + retry 폭주" 를 이유로 든 것은 새로운 근거이지만, WH-EP-07 의 기존 합의와의 관계 — "chat channel 경로에서만 예외 적용, 일반 webhook 경로는 그대로" — 가 target 문서에 명시되지 않은 채로 남아 있다.
- **제안**: 결정 4 의 Rationale 에 "WH-EP-07 의 `410 Gone` 원칙은 일반 webhook 경로에서만 유지하고, chat channel 경로(`config.chatChannel` 존재 시)에서는 텔레그램 재시도 폭주 방지를 위해 `200 OK` 예외를 적용한다" 는 관계를 명문화. 아울러 `spec/5-system/12-webhook.md` §7 처리 흐름 step 5 와 WH-EP-07 에 "chat channel 분기에서는 CCH Inbound HTTP Contract 가 적용됨 (상세 15-chat-channel.md §5.5)" 주석을 달아 두 원칙이 공존하는 범위를 경계로 표현.

---

### [WARNING] 결정 2 — `botTokenRef` 의 PATCH body 차단이 기존 CCH-SE-03 의 write-policy 와 관계 미명시

- **target 위치**: 결정 2 "PATCH body 의 `config.chatChannel.botTokenRef` 변경은 차단 (400 `VALIDATION_ERROR`, `details.field='botTokenRef'`)"
- **과거 결정 출처**: `spec/5-system/15-chat-channel.md` CCH-SE-03 — config JSONB 에는 ref 만 저장, plaintext 는 secret store 에 암호화 보관. `spec/conventions/chat-channel-adapter.md` §2.3 `ChatChannelConfig` — `botTokenRef: string` (필드 정의, 변경 차단 정책 미기술). `spec/5-system/15-chat-channel.md` §5.4 rotate-bot-token API 응답 계약 — rotate endpoint 는 이미 정의되어 있으나 PATCH 차단 여부는 기존 spec 에 명시 없음.
- **상세**: 기존 spec 은 PATCH body 로 `botTokenRef` 를 변경하는 것을 명시적으로 허용하거나 차단한 Rationale 가 없다. target 의 "single-path 결정" 은 새 결정이며 Rationale 를 신설한다고 약속했으므로 방향 자체는 올바르다. 다만 기존 Rationale 에서 기각된 대안과 충돌하지는 않는다 — 이는 결정이 아직 미기술이었던 영역을 채우는 것이다. 그러나 target 이 `botTokenRef` PATCH 차단을 결정하면서 `hasBotToken: boolean` boolean 필드를 UI 가 사용하도록 설계하는 것은 기존 CCH-SE-03 의 "config JSONB 에는 ref 만" 원칙과는 방향이 같으나, `hasBotToken` 이라는 새 API 응답 필드 신설이 기존 trigger 응답 계약(`spec/5-system/12-webhook.md` §3.2, `spec/1-data-model.md` §2.8)과의 정합 여부를 추가 확인 없이 plan 레이어에서만 선언하고 있다.
- **제안**: 결정 2 의 Rationale 에 "기존 spec 의 어떤 계약이 이 결정 이전에 PATCH 변경 가능성을 허용하거나 차단했는가" 를 짧게 기술. `hasBotToken` 필드 신설은 `spec/5-system/15-chat-channel.md` §4.1 또는 §5.4 의 응답 shape 에 반영되어야 하며, plan 문서에만 선언으로 남기지 않도록 명시.

---

### [INFO] 결정 4 — `401 UNAUTHORIZED` 케이스 정당화가 `telegram.md` R1 에 이미 부분적으로 기술되어 있음

- **target 위치**: 결정 4 `X-Telegram-Bot-Api-Secret-Token` 누락/불일치 → 401 케이스
- **과거 결정 출처**: `spec/4-nodes/7-trigger/providers/telegram.md` §6 보안 — "검증 실패 시 401 + adapter 가 `null` 반환". §Rationale R1 — "(채택) `setWebhook` 의 `secret_token` + `X-Telegram-Bot-Api-Secret-Token` 검증: 텔레그램이 공식 지원하는 webhook 인증. (기각) 웹훅 URL UUID 만 의존, (기각) HMAC 서명"
- **상세**: target 의 결정 4 가 `401 UNAUTHORIZED` 를 secret_token 인증 실패 케이스에만 적용하겠다는 정책 방향은 기존 `telegram.md §6` 및 `R1` 의 합의와 일치한다. 새 결정이 기각된 대안을 재도입하거나 원칙을 위반하지 않는다. 다만 target 이 새 Rationale 를 `spec/5-system/15-chat-channel.md §5.5` 에 작성할 때, `telegram.md R1` 의 기존 기각 근거와 중복 없이 참조(cross-link) 하는 방식이 권장된다.
- **제안**: 결정 4 Rationale 작성 시 `telegram.md R1` 에 이미 있는 기각 내용을 재기술하지 않고 "텔레그램 어댑터 인증 결정 근거는 `providers/telegram.md R1` 참조" 로 위임.

---

### [INFO] 결정 1 — `chatChannel` 별도 카드 분리와 WH-MG-09 의 "Webhook Configuration 카드 내 표시" 가능한 해석 충돌 확인 필요

- **target 위치**: 결정 1 "§2.3 상세 drawer: 별도 'Chat Channel' 카드로 분리 (Webhook Configuration 카드와 형제 위치)"
- **과거 결정 출처**: `spec/5-system/12-webhook.md` WH-MG-09 — "트리거 상세 화면에 `chatChannelHealth` 표시 (unknown / healthy / degraded). `notificationHealth` 배지와 동일 영역·동일 형식으로 나란히 배치."
- **상세**: WH-MG-09 는 health 배지의 "동일 영역·동일 형식으로 나란히 배치" 를 요구한다. target 결정 1 은 별도 "Chat Channel" 카드를 Webhook Configuration 카드의 형제 위치로 분리한다. 두 정책이 논리적으로 양립 가능하지만 (health 배지는 §2.1 행 표시 영역에 두고, 카드는 drawer 에서 별도 섹션으로 분리), WH-MG-09 의 "동일 영역" 이 drawer 안의 카드 내부를 가리키는 것인지 행 표시 영역을 가리키는 것인지 기존 spec 이 모호하다. target 은 이 점을 해소하는 Rationale 를 신설한다고 약속하고 있어 방향이 맞으나, plan 레이어에서 이 확인을 명시하는 것이 권장된다.
- **제안**: 결정 1 의 Rationale 에 "WH-MG-09 의 '동일 영역' 은 §2.1 행 표시 (provider 칩 + health 배지) 를 가리키며, drawer 내 카드 분리와 독립" 임을 명문화.

---

## 요약

target 문서 (`spec-telegram-chat-channel-ui-polish.md`) 의 4개 결정은 전반적으로 기존 spec Rationale 의 채택 원칙(Webhook 트리거 + chatChannel config 유지, SecretResolver ref 패턴, in-process EventEmitter 구독 방식, single-user DM 우선)과 방향이 일치하며, 기존 Rationale 에서 명시적으로 기각된 대안을 이유 없이 재도입하는 사례는 발견되지 않았다. 다만 두 가지 WARNING 이 존재한다: 결정 3의 `visualNode` enum rename(`text_only` → `text`) 및 `auto` 신설에 대한 기존 결정 부재 시 Rationale 부재가 결합되면 검토 불가한 영역이 생기고, 결정 4의 비활성 트리거에 대한 `200 OK` 정책이 `12-webhook.md` WH-EP-07의 `410 Gone` 필수 요구사항과의 경계를 현재 plan 문서에서 명시적으로 설정하지 않아 구현 시 인터프리테이션 충돌 가능성이 있다. 두 WARNING 모두 spec PR 에서 Rationale 절 작성 시 해소 가능하며, 지금 단계(plan 검토)에서 차단 수준은 아니다.

---

## 위험도

MEDIUM
