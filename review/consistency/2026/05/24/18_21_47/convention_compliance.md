# 정식 규약 준수 검토 — convention_compliance

- **검토 모드**: impl-prep
- **Target**: `spec/5-system/15-chat-channel.md` (plan `trigger-create-multi-provider-ui.md` 의 구현 착수 전)
- **실 점검 대상**: plan 문서 자체의 규약 준수 + plan 이 구현하겠다고 명시한 변경 사항이 정식 규약을 따르는지
- **검토일**: 2026-05-24

---

## 발견사항

### 1. [WARNING] plan frontmatter 의 `worktree` 필드 미작성

- **target 위치**: `plan/in-progress/trigger-create-multi-provider-ui.md` frontmatter 1-6행
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4 Frontmatter 스키마`
  - 규약: `worktree: <task_name>-<slug>` 필드 필수 (동시 작업 추적 + worktree 충돌 검출용)
- **상세**: frontmatter 에 `worktree` 필드가 `(assigned at impl-start)` 로 자리 표시자만 있고 실제 worktree slug 가 채워지지 않았다. 해당 plan 이 현재 `.claude/worktrees/trigger-create-multi-provider-ui-plan-677f12/` 에서 작업 중임에도 `worktree:` 값이 공란이다. consistency-checker 의 `plan_coherence` checker 가 worktree 충돌 검출에 이 필드를 사용하므로 미작성 시 검출 기능이 무력화된다.
- **제안**: `worktree: trigger-create-multi-provider-ui-plan-677f12` 로 채워 impl-start 시점에 확정한다.

---

### 2. [CRITICAL] DTO 입력 필드명 `inboundSigning` vs. 규약 명시 `inboundSigningPlaintext` 불일치

- **target 위치**: plan `## Commit 1` 표, 특히 "inboundSigning 입력 가드를 provider 분기로 교체" 행 및 "Commit 2 — createMutation payload" 행
- **위반 규약**: `spec/conventions/secret-store.md §5.5 Chat Channel inboundSigningRef 초기화`
  - 규약 코드 예시: `dto.chatChannel?.inboundSigningPlaintext` — DTO 의 provider-issued 경로 입력 필드 이름을 **`inboundSigningPlaintext`** 로 명시
- **상세**:
  - plan 은 Commit 1 에서 DTO 의 기존 `inboundSigning?` 필드의 `@IsEmpty` 가드를 provider 분기로 교체한다고 명시한다.
  - Commit 2 에서 frontend payload 도 `{ inboundSigning }` 으로 전송한다고 명시한다.
  - 그러나 `secret-store.md §5.5` 의 provider-issued 경로 코드 예시는 DTO 입력 필드를 `inboundSigningPlaintext` 로 정의한다. 이는 "config 에 흘러들지 않을 DTO 한정 plaintext 필드"를 config 의 `inboundSigningRef` 와 명칭으로 분리하기 위한 의도적 naming이다.
  - plan 이 기존 `inboundSigning` 필드명을 그대로 재사용하면 config 필드 `inboundSigningRef` 와의 역할 구분이 코드상 불명확해지고, secret-store 규약이 명시한 DTO 한정 필드 패턴(`Plaintext` suffix)에서 벗어난다.
  - 현재 DTO 의 필드명 `inboundSigning` 은 `@IsEmpty` 로 막혀 있는 내부 필드다. plan 이 그 필드를 provider-issued 입력용으로 재사용하면 필드 의미가 "내부 ref" + "외부 plaintext 입력" 두 역할을 동시에 암시하게 된다.
- **제안**:
  - Commit 1 에서 기존 `inboundSigning?: string` 필드는 legacy 내부 필드로 유지(또는 제거)하고, provider-issued 입력을 받을 새 DTO 필드를 `inboundSigningPlaintext?: string` 으로 신설한다 (secret-store.md §5.5 의 예시와 일치).
  - Commit 2 frontend payload 도 `{ inboundSigningPlaintext: formChatChannelInboundSigning }` 로 전송.
  - 이렇게 해야 "plaintext 는 DTO 에서 config 로 흘러가지 않는다" 는 SS-SE-01 정책이 코드상 self-documenting 되고 규약 코드 예시와 일치한다.

---

### 3. [WARNING] `spec/5-system/15-chat-channel.md` frontmatter `status: spec-only` — plan 구현 완료 후 승격 의무 미언급

- **target 위치**: plan `## 후속 plan` 절 (라인 157-161)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §3 전이 규칙` + `PROJECT.md §변경 유형 → 갱신 위치 매핑` 행 "spec 신규/대규모 변경"
  - 규약: `spec-only → partial`: 최초 코드 머지 시점에 승격 의무. `partial → implemented`: 마지막 `pending_plans` 가 `complete/` 로 이동한 commit 에서 승격 의무.
- **상세**:
  - `15-chat-channel.md` 의 현재 frontmatter 는 `status: spec-only, code: []` 이다.
  - plan 의 Commit 1~5 는 사실상 이 spec 의 핵심 surface (provider 3종 GUI 진입, DTO, service, e2e) 를 구현한다.
  - plan 완료 시 `15-chat-channel.md` 의 `status` 를 `partial` 또는 `implemented` 로 승격하고 `code:` 글로브를 채워야 하지만, plan 문서에 이 의무가 명시되지 않아 구현 후에도 `spec-only` 가 90일 TTL 을 초과할 위험이 있다.
  - plan `## 후속 plan` 에 `spec-coverage 의 code: frontmatter 갱신` 이 언급되나, 이는 `_overview.md / slack.md / discord.md` 에 대한 것이고 `15-chat-channel.md` 의 `status` / `code:` 승격은 명시되어 있지 않다.
  - `spec-impl-evidence.md §3` 은 `spec-only → partial` 을 "최초 코드 머지 시점"에 의무화하므로, 이 plan 의 첫 PR 이 머지되는 순간 `15-chat-channel.md` 를 `status: partial` + 구현된 `code:` 경로들 + `pending_plans: [...]` 로 갱신해야 한다.
- **제안**:
  - Commit 1 또는 Commit 5 (e2e 완료 시점) 에 `15-chat-channel.md` frontmatter 갱신을 명시적 작업으로 추가한다:
    - `status: partial` → `implemented` (모든 Commit 완료 후)
    - `code:` 에 `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts`, `codebase/backend/src/modules/triggers/triggers.service.ts`, `codebase/frontend/src/app/(main)/triggers/page.tsx`, e2e 파일 등 추가
  - `slack.md / discord.md` 도 현재 `status: implemented` 이나 `code:` 에 `triggers/page.tsx` 경로가 빠져 있으므로 함께 갱신을 고려한다.

---

### 4. [WARNING] Commit 4 user-guide `ImplAnchor` 누락 위험 — `triggers-coverage.test.ts` 가드 미언급

- **target 위치**: plan `## Commit 4 — user guide 동반 갱신 + ImplAnchor` 표, "Triggers 가이드 cross-link" 행
- **위반 규약**: `spec/conventions/user-guide-evidence.md §2 가드` + `PROJECT.md §변경 유형 → 갱신 위치 매핑` 행 "user-guide GUI 흐름 절 신규/변경"
  - 규약: `02-nodes/triggers.mdx` 의 provider 별 절에 `<ImplAnchor kind="ui-entry">` ≥1 이 `triggers-coverage.test.ts` 에 의해 강제됨
- **상세**:
  - plan 의 Commit 4 표에서 "Triggers 가이드 cross-link" 행이 `02-nodes/triggers.{mdx,en.mdx}` 에 provider 3종 cross-link 추가를 명시하지만, 해당 절에 `<ImplAnchor kind="ui-entry">` 를 함께 작성해야 한다는 항목이 없다.
  - `integrations-coverage.test.ts` 가드 통과는 언급됐으나 (`impl-anchor-existence / integrations-coverage` 검증 통과), `triggers-coverage.test.ts` 가드 — `02-nodes/triggers.mdx` 의 provider 별 절에 `<ImplAnchor>` ≥1 의무 — 는 명시되지 않았다.
  - plan 에서 Commit 4 의 `<ImplAnchor>` 작성 의무는 slack/discord 가이드에 대해서만 명시됐고, triggers 가이드의 provider 별 절에 대한 ImplAnchor 는 빠져 있다.
- **제안**:
  - Commit 4 표에 "triggers.mdx 의 slack / discord 절에 `<ImplAnchor kind="ui-entry">` 동반" 항목 추가.
  - 검증 명령에 `triggers-coverage` 를 명시: `npm test -- impl-anchor-existence integrations-coverage triggers-coverage`

---

### 5. [INFO] plan `## 후속 plan` 에 `spec-coverage code:` 갱신 언급이 "검토" 수준으로 모호

- **target 위치**: plan `## 후속 plan` 절, `spec-coverage 의 code: frontmatter 갱신` 항목 (라인 161)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §3.1 전이 규칙` — `partial → implemented` 시 `pending_plans` 가 `complete/` 로 이동한 commit 에서 `status` 승격 "의무"
- **상세**:
  - `spec-coverage` 갱신을 후속 plan 의 "검토" 항목으로 남긴 것은 optional 처리처럼 읽힌다. 그러나 `spec-impl-evidence.md §3` 의 `partial → implemented` 전이 규칙은 "의무" 로 명시되어 있어 follow-up 으로 미루면 `spec-status-lifecycle.test.ts` 가드 (partial 의 `pending_plans` 모두 complete 인데 status 미승격) 에 차단될 수 있다.
  - 이 항목은 "후속 검토" 가 아니라 마지막 PR commit 안에서 처리해야 할 의무적 작업이다.
- **제안**: "후속 plan" 절에서 꺼내 `## 완료 기준` 항목에 "spec frontmatter `status` / `code:` 갱신 및 `pending_plans` 정합" 을 체크박스로 추가한다. 또는 plan 내 Commit 5 직후 별 commit 항목으로 명시한다.

---

### 6. [INFO] `inboundSigning` 입력 가드 해제 시 Telegram 의 처리 — 규약 option (a)/(b) 혼용 위험

- **target 위치**: plan `## Commit 1` 표, "검증 방법 후보" 항목
- **위반 규약**: `spec/conventions/chat-channel-adapter.md §2.3 ChatChannelConfig` 주석 — "Optional — provider 에 따라 inbound 인증을 별도 자료 없이 처리하는 case 가 있을 수 있어 `?` 유지"
- **상세**:
  - plan 이 권장하는 방법 (b) (service 단 분기) 를 선택하면 DTO 의 `inboundSigning` 필드는 형식 검증 목적으로만 존재하고 telegram 에서는 서버가 무시하게 된다.
  - 이 경우 DTO 에서 `inboundSigning` 에 `@IsEmpty` 가 남으면 telegram provider 로 요청 시 `inboundSigning` 을 함께 전달하면 400 이 발생하는데, plan 의 "telegram은 입력 silent strip 또는 400" 표현이 두 가지 행동 중 어느 것인지 결정하지 않고 있다.
  - silent strip 은 보안상 올바르지 않다 — 사용자가 telegram provider 에서 임의의 `inboundSigning` 을 넣어도 수용되는 오해를 줄 수 있다. 400 반환이 더 적합하다.
  - secret-store.md §2.3 `ChatChannelConfig` 의 주석 테이블은 telegram 에서 `inboundSigning` 이 server-issued 이고 사용자가 입력할 필요가 없음을 명시한다. 따라서 telegram provider 에서 `inboundSigning` 입력 시 400 이 규약과 일치한다.
- **제안**: plan Commit 1 에서 "telegram 은 400" 으로 명확히 결정. silent strip 선택지는 제거.

---

## 요약

본 plan `trigger-create-multi-provider-ui.md` 은 `spec/conventions/chat-channel-adapter.md §2.3` 및 `secret-store.md §1/§5.5` 의 핵심 설계(단일 inboundSigningRef 슬롯, provider-issued 경로의 별도 plaintext DTO 필드)를 개념적으로 올바르게 반영하고 있으며, user-guide의 `<ImplAnchor>` 의무와 i18n KO/EN parity 의무도 인지하고 있다. 그러나 다음 두 가지에서 규약과 직접 충돌한다: (1) DTO 입력 필드명으로 `inboundSigning` 을 그대로 재사용하려 하는데 `secret-store.md §5.5` 는 `inboundSigningPlaintext` 로 명시하고 있고(CRITICAL), (2) plan frontmatter 의 `worktree` 가 미채워져 있다(WARNING). 또한 `spec/5-system/15-chat-channel.md` 의 frontmatter `status` / `code:` 승격 의무, `triggers-coverage.test.ts` 가드 대상인 `02-nodes/triggers.mdx` ImplAnchor 작성, spec-impl-evidence 의 `partial → implemented` 전이 의무가 plan 문서에 명시적으로 포함되어 있지 않아 impl 완료 후 build-time 가드 차단 또는 spec-only TTL 초과 위험이 있다.

---

## 위험도

**MEDIUM**

CRITICAL 1건(DTO 필드명 규약 불일치 — 구현 시 secret-store 규약 코드 예시와 어긋나는 필드명으로 구현될 경우 SS-SE-01 self-documenting 약화 + 추후 규약 코드와 실 코드 drift), WARNING 2건(plan frontmatter worktree 미채워짐, spec frontmatter 승격 의무 미언급), INFO 2건(triggers-coverage 가드 미명시, telegram inboundSigning 처리 결정 미확정).
