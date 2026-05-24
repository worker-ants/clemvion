---
checker: convention-compliance
scope: spec/5-system/15-chat-channel.md
mode: impl-done
diff-base: origin/main
generated: 2026-05-24T20:00:21Z
---

# 정식 규약 준수 검토 — trigger-create-multi-provider-ui

검토 대상: `spec/5-system/15-chat-channel.md` + 구현 diff (chat-channel-config.dto.ts / triggers.service.ts / triggers.service.spec.ts / chat-channel-trigger-create.e2e-spec.ts / frontend page.tsx / user-guide mdx / i18n dict)

---

## 발견사항

### [CRITICAL] `spec/5-system/15-chat-channel.md` frontmatter `status` 가 `spec-only`/`code: []` 로 미승격

- **target 위치**: `spec/5-system/15-chat-channel.md` 라인 2–4 (frontmatter `status: spec-only`, `code: []`)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §3` 전이 규칙 — "최초 코드 머지 시점에 `spec-only` → `partial` 승격" + `PROJECT.md §변경 유형 → 갱신 위치 매핑` 행 "spec 신규/대규모 변경 → frontmatter `code:` / `status:` 갱신 의무"
- **상세**: 본 PR 은 `spec/5-system/15-chat-channel.md` 이 약속한 Slack / Discord provider 의 backend service 로직, DTO, e2e, frontend UI 를 실제로 구현했다. spec `code:` 가 빈 배열이고 `status` 는 여전히 `spec-only` — `spec-impl-evidence.md §3` 의 "최초 코드 머지 → `partial` 승격" 전이 규칙을 이행하지 않았다. `spec-code-paths.test.ts` 가드가 `partial`/`implemented` 상태에서만 `code:` 매칭을 강제하므로 현재 상태에서는 가드 자체가 무음 통과하여 영구 누락 재현 가능.
- **제안**:
  ```yaml
  ---
  id: chat-channel
  status: partial
  code:
    - codebase/backend/src/modules/triggers/**
    - codebase/backend/src/modules/chat-channel/**
    - codebase/backend/test/chat-channel-trigger-create.e2e-spec.ts
    - codebase/frontend/src/app/(main)/triggers/page.tsx
  pending_plans:
    - plan/in-progress/trigger-create-multi-provider-ui.md
  ---
  ```
  (`partial` 채택 이유: Discord Gateway WebSocket — `chat-channel-discord-gateway` plan — 과 visual SSR PNG 가 미구현 상태)

---

### [CRITICAL] `spec/5-system/15-chat-channel.md §4.1` 에 `inboundSigningPlaintext` 입력 필드 정의 부재

- **target 위치**: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts` — 신규 `inboundSigningPlaintext` 필드; `codebase/backend/src/modules/triggers/triggers.service.ts` — `assertInboundSigningPlaintextByProvider` + `stripChatChannelPlaintext`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §3` — "구현 코드와 spec 의 단일 진실 원칙". `spec/5-system/15-chat-channel.md §4.1` 의 `chatChannel` config 스키마는 `inboundSigningPlaintext` 필드를 정의하지 않는다. 본 필드는 `secret-store.md §5.5 (b)` 코드 예시에서 처음 등장하지만, API 계약 (입력 DTO 의 새 필드, provider 별 400 분기) 으로서의 정식 정의는 `spec/5-system/15-chat-channel.md §4.1` 또는 `§5.4.1 single-path 정책` 에 있어야 한다.
- **상세**: `inboundSigningPlaintext` 는 사용자가 provider portal 에서 입력하는 자격증명이고, provider 별 필수/금지 분기 + hex 형식 규칙이 service 에 구현됐다. 이 API contract 가 spec 본문에 없으면 후속 개발자가 spec 만 보고 필드의 존재를 인지할 수 없다. `spec-impl-evidence.md §3` 의 `partial` 전이 의무와 함께, spec §4.1 의 "입력 전용 플레인텍스트" 섹션 추가가 필요하다.
- **제안**: `spec/5-system/15-chat-channel.md §4.1` 에 아래 항목 추가:
  > `inboundSigningPlaintext` (입력 전용, DTO 한정) — provider-issued inbound webhook 인증 자료의 plaintext. Slack = signing secret lowercase hex 32 / Discord = ed25519 public key lowercase hex 64. Telegram 은 server-issued (randomBytes 자동 발급) 이므로 본 필드 입력 시 400. service 가 즉시 `SecretResolver.rotate(inbound-signing, plaintext)` 로 옮기고 config 에는 ref 만 저장 (SS-SE-01). SoT: `secret-store.md §5.5 (b)`.

---

### [WARNING] `triggers-coverage.test.ts` 가드 — `triggers.mdx` 의 Slack / Discord provider 절 누락

- **target 위치**: `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` 및 `triggers.en.mdx` — h2/h3 heading 목록
- **위반 규약**: `spec/conventions/user-guide-evidence.md §2` 표 — "`triggers-coverage.test.ts`: `02-nodes/triggers.mdx` 의 provider 별 절 (h2/h3 텍스트가 provider 이름 포함) 안에 `<ImplAnchor kind="ui-entry">` ≥1 의무"
- **상세**: 변경 후 `triggers.mdx` 에는 `## Chat Channel 연결` 아래 `### Telegram 설정 방법` 만 존재하고 `### Slack 설정 방법` / `### Discord 설정 방법` 에 해당하는 h3 절이 없다. `triggers-coverage.test.ts` 가드가 "h2/h3 텍스트에 provider 이름 포함" 을 조건으로 `<ImplAnchor>` 존재를 검증하기 때문에, Slack 과 Discord 를 이름으로 가진 provider 절이 없으면 가드가 무음 통과한다 (검증 대상이 없어서). 반면 slack.mdx / discord.mdx 의 GUI 흐름 절에는 각각 `<ImplAnchor>` 가 정상 추가됐으므로 `integrations-coverage.test.ts` 는 통과한다.
- **제안**: `triggers.mdx` / `triggers.en.mdx` 에 아래 절 추가 (또는 "Chat Channel 연결" 아래 `### Slack 설정 방법` / `### Discord 설정 방법` h3 절을 신설하고 각 절에 `<ImplAnchor>` + 통합 가이드 링크 안내 추가). 최소 변경안:
  ```mdx
  ### Slack 설정 방법

  <ImplAnchor
    kind="ui-entry"
    file="codebase/frontend/src/app/(main)/triggers/page.tsx"
    symbol="createMutation"
    describes="트리거 생성 dialog 의 Chat Channel 섹션 — Slack provider"
  />

  상세 단계는 [Slack 통합 가이드](/docs/06-integrations-and-config/slack)를 참고해요.

  ### Discord 설정 방법

  <ImplAnchor
    kind="ui-entry"
    file="codebase/frontend/src/app/(main)/triggers/page.tsx"
    symbol="createMutation"
    describes="트리거 생성 dialog 의 Chat Channel 섹션 — Discord provider"
  />

  상세 단계는 [Discord 통합 가이드](/docs/06-integrations-and-config/discord)를 참고해요.
  ```

---

### [WARNING] `secret-store.md §5.5 (b)` 코드 예시가 `store()` 대신 `rotate()` 사용을 명시하지 않음 — 구현과 사소한 drift

- **target 위치**: `codebase/backend/src/modules/triggers/triggers.service.ts` — `setupChatChannel` 내 `await this.secrets.rotate(inboundSigningRef, ...)` 호출
- **위반 규약**: `spec/conventions/secret-store.md §5.5 (b)` 코드 예시 — `await this.secrets.rotate(ref, workspaceId, dto.chatChannel.inboundSigningPlaintext)` 로 `rotate()` 를 이미 사용해 구현과 일치한다. **단**, `§2.1 호출 규약` 표의 "Trigger 생성" 행은 "store() — 또는 rotate() 허용" 이라고 하며 `§5.5 (b)` 예시 본문 설명에 "secrets.rotate" 라고 명시되어 있어 직접 충돌은 아님.
- **상세**: 구현이 `rotate()` 를 일관되게 사용한다 (`botToken`, `inboundSigningPlaintext` 둘 다). `§5.1` 의 예시 코드는 `rotate()` 를 사용하고 있어 일치하므로 CRITICAL 이 아니나, `§5.5 (b)` 코드 주석의 "secrets.rotate" 표기가 `§2.1` 표의 "store() — rotate() 허용" 표현과 표현이 달라 혼동 여지가 있다.
- **제안**: `secret-store.md §2.1` 표의 "Trigger 생성" 행 설명에 "v1 setup 경로는 rotate() 권장 (UPSERT 재시도 안전)" 을 명시적으로 추가. 현재는 괄호 안 허용 표기만 있어 `store()` 가 primary 라고 오인하기 쉬움.

---

### [WARNING] `chat-channel-config.dto.ts` 의 `inboundSigningPlaintext` — `@ApiProperty` `description` 에서 `chat-channel-adapter.md §2.3` 참조 누락

- **target 위치**: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts` — `inboundSigningPlaintext` 의 `@ApiPropertyOptional` description 블록 (diff 라인 135–148)
- **위반 규약**: `spec/conventions/chat-channel-adapter.md §2.3 ChatChannelConfig` — `inboundSigningRef` 의 단일 슬롯 및 provider 별 자원 성격은 해당 섹션이 단일 진실. DTO 의 JSDoc `@see` 블록에는 `secret-store.md §5.5`, `slack.md §6`, `discord.md §6` 가 나열되어 있으나 `chat-channel-adapter.md §2.3` 참조가 없다.
- **상세**: `chat-channel-adapter.md §2.3` 의 `ChatChannelConfig` 는 `inboundSigningRef` 슬롯의 provider 별 검증 알고리즘 분기 표를 단일 진실로 제공한다. 신규 `inboundSigningPlaintext` DTO 필드는 이 슬롯에 plaintext 를 공급하는 진입 경로이므로 참조가 있어야 drift 인지가 용이하다.
- **제안**: `@see` 목록에 `spec/conventions/chat-channel-adapter.md §2.3 (inboundSigningRef 슬롯 단일 진실)` 한 줄 추가.

---

### [INFO] `spec/conventions/swagger.md` 에 `writeOnly: true` OpenAPI 속성 사용 지침 미등재

- **target 위치**: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts` — `botToken` 및 `inboundSigningPlaintext` 의 `@ApiProperty({ writeOnly: true })` 사용
- **위반 규약**: `spec/conventions/swagger.md` — `writeOnly` / `readOnly` OpenAPI property 에 대한 사용 가이드라인이 없음
- **상세**: `writeOnly: true` 는 OpenAPI 3.0 의 표준 property 로 구현 상 올바른 사용이다. 다만 `swagger.md` 에 이 속성에 대한 언급이 없어 다른 개발자가 동일 패턴을 일관되게 적용할 때 참조할 SoT 가 부재하다.
- **제안**: `spec/conventions/swagger.md` 에 `writeOnly: true` / `readOnly: true` 사용 지침 한 단락 추가 — "입력 전용 (응답에 절대 미포함) 필드는 `@ApiProperty({ writeOnly: true })`, 응답 전용 필드는 `readOnly: true`".

---

### [INFO] e2e 파일명 패턴 — `chat-channel-trigger-create.e2e-spec.ts` 는 규약상 허용 범위 내

- **target 위치**: `codebase/backend/test/chat-channel-trigger-create.e2e-spec.ts`
- **위반 규약**: 해당 없음 (INFO 수준)
- **상세**: e2e 파일명이 `<domain>-<scenario>.e2e-spec.ts` 패턴을 따르며 기존 e2e 파일명 (`chat-channel.e2e-spec.ts`, `chat-channel-token-rotation.e2e-spec.ts` 등) 과 일관된다. 별 위반 없음. 다만 파일 내 JSDoc 의 "Commit 5" 참조 (`plan/in-progress/trigger-create-multi-provider-ui.md Commit 5`) 는 plan 내부 구조 참조로, plan 이 `complete/` 로 이동 후 stale 이 될 수 있다. 사소한 유지보수 참고 사항.

---

## 요약

정식 규약 준수 관점에서 이번 구현은 `secret-store.md §5.5`, `chat-channel-adapter.md §2.3`, 에러 envelope 코드 (`VALIDATION_ERROR`) 등 핵심 규약을 올바르게 준수하고 있다. `ImplAnchor` 패턴도 `slack.mdx` / `discord.mdx` GUI 흐름 절에 적절히 삽입됐다. 그러나 두 가지 CRITICAL 이 남아 있다. (1) `spec/5-system/15-chat-channel.md` frontmatter 가 `spec-only`/`code: []` 상태로 미승격되어 `spec-impl-evidence.md §3` 의 전이 규칙을 위반하고, 향후 `spec-code-paths.test.ts` 가드가 빈 `code:` 를 침묵으로 통과시켜 텔레그램 chat-channel UI 영구 누락 재현 패턴과 동일한 리스크를 남긴다. (2) `inboundSigningPlaintext` 라는 신규 API 계약 필드가 `spec/5-system/15-chat-channel.md §4.1` 에 정의되지 않아 단일 진실 원칙이 깨진다. WARNING 수준으로는 `triggers.mdx` 의 Slack / Discord provider 별 절 미신설로 인한 `triggers-coverage.test.ts` 가드 무음 통과 가능성이 있다.

---

## 위험도

**HIGH**

(CRITICAL 2건: spec frontmatter 미승격 + 신규 입력 필드의 spec 본문 미정의. WARNING 1건: user-guide coverage 가드 잠재적 무음 통과.)
