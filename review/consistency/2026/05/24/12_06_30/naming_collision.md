# 신규 식별자 충돌 Check — 결과

검토 모드: `--impl-prep` (구현 착수 전)
대상 파일: `spec/4-nodes/7-trigger/providers/slack.md`

---

## 발견사항

### [INFO] frontmatter `id: slack` 는 기존 spec 공간에서 충돌 없음

- target 신규 식별자: `id: slack` (frontmatter)
- 기존 사용처: 동일 `id` 값을 사용하는 다른 spec 파일 없음. `grep -rn "^id: slack"` 결과 `slack.md` 단독.
- 상세: spec frontmatter `id` 는 파일 단위 식별자이며 네임스페이스가 암묵적으로 파일 경로 단위다. `id: common` 이 여러 영역 폴더에서 중복 사용되는 기존 패턴과 동일하게 허용됨.
- 제안: 변경 불필요.

---

### [INFO] provider 식별자 `"slack"` 은 기존 catalog와 정합 — 충돌 없음

- target 신규 식별자: `config.chatChannel.provider = "slack"` (런타임 식별자)
- 기존 사용처: `spec/4-nodes/7-trigger/providers/_overview.md §2` 가 이미 `slack` 을 `spec-defined / impl-pending` 표에 등록. `spec/5-system/15-chat-channel.md` CCH-AD-01 이 `slack` 을 명시적으로 열거.
- 상세: target 이 도입하는 값이 기존 corpus 가 이미 예약해 둔 값과 정확히 일치 — 충돌이 아니라 의도된 정합. `_overview.md` 의 명명 컨벤션(lower-case, 외부 플랫폼 브랜드명) 도 준수.
- 제안: 변경 불필요.

---

### [INFO] Rationale ID `R-S-1` ~ `R-S-9` 는 타 파일의 `R-S-*` 와 충돌 없음

- target 신규 식별자: `R-S-1`, `R-S-2`, ..., `R-S-9` (Rationale 레이블)
- 기존 사용처: `spec/` 전체 grep 결과 `R-S-*` 패턴은 `slack.md` 와 `discord.md` 가 Slack 에 대한 back-reference로만 사용. `discord.md` 에서 `R-S-2`, `R-S-6` 을 Slack 에 대한 참조 주석으로 인용하나, Discord 자체 Rationale 은 별도 `R-D-*` 접두사를 사용.
- 상세: `R-S-` prefix 는 사실상 "Slack-provider-specific Rationale" 의미로 파일 내부에 국한된 레이블. 타 파일에서 동일 패턴을 로컬 네임스페이스로 혼동할 가능성은 낮다. 단, `R-D-3` 이 `R-S-2 와 동일 정신` 으로 cross-ref 하므로 명칭이 다른 파일에서 참조될 때 file-prefix 가 명확한 것이 장점이다 — 현재는 `slack.md` 에서만 자체 정의·사용하므로 실제 혼동 위험 없음.
- 제안: 변경 불필요. 다만 향후 provider spec 이 늘어날 때도 동일 `R-S-*` 를 다른 파일에서 로컬로 쓰지 않도록 주의 (패턴 선례 참고).

---

### [INFO] secret-store URI `secret://triggers/{id}/inbound-signing` — slack.md 와 기존 corpus 정합 확인

- target 신규 식별자: `secret://triggers/{id}/inbound-signing` (slack.md §6)
- 기존 사용처: `spec/conventions/secret-store.md §1` 이 동일 name 슬롯 `inbound-signing` 을 Slack HMAC-SHA256 용도로 명시. `spec/1-data-model.md §2.21.1 SecretStore` 도 동일 슬롯 참조.
- 상세: `slack.md` 의 R-S-1 Rationale 에 따라 `signingSecretRef?` → `inboundSigningRef?` 로 통합 rename 이 이미 `spec-chat-channel-inbound-signing-rename` plan 으로 반영됐고, `chat-channel-adapter.md` changelog 최종 항목(2026-05-24)과 `secret-store.md` changelog(2026-05-24 두 번째 항)도 동일 통합을 확인. 세 파일 (`slack.md`, `chat-channel-adapter.md`, `secret-store.md`) 의 현재 본문이 단일 슬롯 `inboundSigningRef` / `inbound-signing` 을 일관되게 참조하고 있어 충돌 없음.
- 제안: 변경 불필요.

---

### [INFO] `xoxb-*` 봇 토큰 형식 언급 — 기존 secret-store 슬롯 `bot-token` 과 정합

- target 신규 식별자: `botToken` (Slack `xoxb-*` 형식), ref = `secret://triggers/{id}/bot-token`
- 기존 사용처: `spec/conventions/secret-store.md §1` 예시 표 — `secret://triggers/{triggerId}/bot-token` 가 "provider 공통 봇 토큰 (Telegram / Slack `xoxb-*` / Discord)" 으로 명시. `spec/1-data-model.md §2.21.1` 도 동일 슬롯 기재.
- 상세: 새로 도입되는 것이 아니라 기존에 예약된 슬롯을 Slack provider 가 사용하는 구조 — 정합.
- 제안: 변경 불필요.

---

### [INFO] API endpoint — `POST /api/triggers/:id/chat-channel/rotate-bot-token` 은 기존 정의와 정합

- target 신규 식별자: (slack.md 가 직접 신설하지 않으나 §3.2 에서 참조) `POST /api/triggers/:id/chat-channel/rotate-bot-token`
- 기존 사용처: `spec/5-system/15-chat-channel.md CCH-SE-04` 에서 이미 정의. `slack.md` 는 재정의 없이 참조만.
- 상세: 충돌 없음.
- 제안: 변경 불필요.

---

### [INFO] 파일 경로 `spec/4-nodes/7-trigger/providers/slack.md` — 기존 명명 컨벤션 준수

- target 신규 파일: `spec/4-nodes/7-trigger/providers/slack.md`
- 기존 파일들: 동 디렉토리에 `telegram.md`, `discord.md`, `_overview.md` 존재. 모두 lower-case provider 브랜드명 basename.
- 상세: `_overview.md §3` 의 신규 provider 추가 절차 step 1 ("Spec 신설: `<name>.md` 작성") 과 정확히 일치. 기존 파일과 겹치지 않음.
- 제안: 변경 불필요.

---

### [INFO] `id: slack` 중복 — `spec/conventions/spec-impl-evidence.md` 내 YAML 블록과 비교

- target 신규 식별자: frontmatter `id: slack`
- 기존 사용처: `spec/conventions/spec-impl-evidence.md` 는 파일 frontmatter가 아닌 본문 예시 스니펫 YAML 안에 `id: chat-channel` 등을 등장 예시로만 사용. `id: slack` 예시는 없음.
- 상세: 위 `id: common` / `id: chat-channel` 중복 결과는 spec frontmatter ID 가 파일 단위 단순 레이블이며 전역 namespace 가 아님을 보여주는 기존 패턴으로, slack.md 의 `id: slack` 과 충돌하는 요소가 없다.
- 제안: 변경 불필요.

---

## 요약

`spec/4-nodes/7-trigger/providers/slack.md` 가 도입하는 신규 식별자들 (frontmatter `id: slack`, provider 식별자 `"slack"`, Rationale 레이블 `R-S-1~R-S-9`, secret-store URI `inbound-signing`, 파일 경로) 은 기존 corpus 와 충돌하지 않는다. `provider = "slack"` 은 이미 `_overview.md` 와 `15-chat-channel.md` 가 예약해 둔 값이며 target 이 그것을 구체화한 것이다. secret-store URI `inbound-signing` 슬롯과 `inboundSigningRef` 필드 명명은 `spec-chat-channel-inbound-signing-rename` 의 통합 결정이 세 관련 파일 (`chat-channel-adapter.md`, `secret-store.md`, `slack.md`) 에 일관되게 반영된 상태다. 충돌하거나 다른 의미로 이미 사용 중인 식별자는 발견되지 않았다.

## 위험도

NONE

---

STATUS: OK
