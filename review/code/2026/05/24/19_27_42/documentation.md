# 문서화(Documentation) 리뷰 — trigger-create-multi-provider-ui

리뷰 일시: 2026-05-24
리뷰 대상: multi-provider Chat Channel UI 진입점 신설 (Slack / Discord DTO + service + frontend + user guide + i18n)

---

## 발견사항

### [WARNING] `inboundSigningPlaintext` 의 `@ApiPropertyOptional` — `@IsEmpty` 없음 / 입력 strip 동작 swagger에 미반영

- **위치**: `/codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts` line 185–198 (`@ApiPropertyOptional` + `inboundSigningPlaintext` 선언)
- **상세**: swagger description 은 "응답에서 strip — config 에는 inboundSigningRef 만 보관 (SS-SE-01)" 으로 strip 사실을 명시하고 있다. 그러나 swagger 스키마에 `writeOnly: true` 속성이 없다. 인접 필드 `botToken` (`line 98-107`) 역시 `writeOnly` 없이 description 에만 "입력 전용" 을 기술하고 있어 선례는 있지만, `inboundSigningPlaintext` 는 보안 자료 plaintext 라는 특성상 swagger UI 에서 응답 스키마에서 숨겨지지 않아 혼동을 줄 수 있다. `@ApiPropertyOptional({ writeOnly: true })` 를 추가하면 Swagger UI 의 응답 예시에서 자동으로 필드가 제외된다.
- **제안**: `@ApiPropertyOptional` 에 `writeOnly: true` 를 추가해 swagger 응답 스키마에서 이 필드가 보이지 않도록 한다. 기존 `botToken` 의 "입력 전용" 기술 패턴과도 일관성을 맞출 수 있다 (동일 이슈가 `botToken` 에도 있으나 보안 민감도 순서상 `inboundSigningPlaintext` 가 더 시급).

---

### [WARNING] `inboundSigningPlaintext` 의 `@ApiPropertyOptional description` — spec cross-link 형식이 URL 앵커 없이 텍스트 참조 방식으로 기술됨

- **위치**: `chat-channel-config.dto.ts` line 186–191 (`description` 문자열) 및 JSDoc line 181–183 (`@see` 태그)
- **상세**: JSDoc 의 `@see spec/conventions/secret-store.md §5.5`, `@see spec/4-nodes/7-trigger/providers/slack.md §6 R-S-1`, `@see spec/4-nodes/7-trigger/providers/discord.md §6` 는 파일 경로를 명시해 SoT 를 추적하기에 충분하다. 단, `@ApiPropertyOptional description` 에 참조된 `SS-SE-01` 은 `spec/conventions/secret-store.md` 의 내부 ID 인데 description 에 그 파일 경로가 언급되지 않는다. Swagger UI 를 보는 API 소비자는 `SS-SE-01` 이 어디서 정의된 규약인지 알 수 없다.
- **제안**: `@ApiPropertyOptional description` 의 `(SS-SE-01)` 뒤에 `(SS-SE-01: spec/conventions/secret-store.md §4)` 형태로 파일 위치를 한 줄 부가하면 API 소비자가 규약을 추적할 수 있다. 또는 description 길이가 우려된다면 JSDoc `@see` 에 이미 §5.5 링크가 있으므로 description 에서 `SS-SE-01` 참조를 "응답에서 strip (secret-store §5.5)" 로 교체하는 방안도 유효하다.

---

### [WARNING] `inboundSigning` 필드 — 변경된 JSDoc이 "내부 필드"와 "외부 입력 금지" 맥락 혼재

- **위치**: `chat-channel-config.dto.ts` line 147–163 (`inboundSigning` 필드 JSDoc 및 `@IsEmpty` message)
- **상세**: 변경 후 JSDoc 은 "외부 입력 금지 — Telegram (server-issued) 의 issuedInboundSigning 만 저장하는 내부 필드" 라고 기술한다. 그러나 `@ApiPropertyOptional description` (line 153–157) 은 여전히 "Webhook 인증용 server-issued secret" 으로 시작해 `inboundSigning` 이 실제로 secret 값을 담는 필드인 것처럼 읽힌다. 실제 코드 동작상 이 필드는 `@IsEmpty` 로 외부 입력이 차단되어 있고 setupChannel 결과를 저장하는 용도인데, API 소비자에게는 "server-issued secret 을 직접 POST 할 수 있다" 는 오해를 줄 수 있다. `botTokenRef` 의 description 패턴 ("내부 식별자 — 외부 입력 금지, 응답에서 strip") 과 달리 `inboundSigning` description 이 "secret 값 자체" 처럼 명명되어 있어 일관성이 낮다.
- **제안**: `@ApiPropertyOptional description` 을 `botTokenRef` 패턴에 맞춰 "(내부 저장 — 외부 입력 금지) setupChannel 이 발급한 Telegram server-issued signing secret. 응답에서 strip. provider-issued 입력(Slack / Discord)은 inboundSigningPlaintext 사용." 로 정리하면 필드 성격과 입력 금지 이유가 명확해진다.

---

### [INFO] `@ApiProperty description` — `provider` 필드에 spec cross-link 경로가 description 문자열 안에 인라인으로 삽입됨

- **위치**: `chat-channel-config.dto.ts` line 88–93
- **상세**: `description` 값에 `(spec/4-nodes/7-trigger/providers/_overview.md §1 단일 진실)` 을 직접 문자열로 포함한다. swagger description 에 파일 경로를 넣는 것은 이 DTO 파일 내 기존 패턴 (예: `botTokenRef` 의 `Spec Chat Channel §5.4.1 single-path` 참조 패턴) 과 다소 상이하다. 기존 패턴은 spec 섹션을 짧게 약칭 (`Spec Chat Channel §5.4.1`) 으로 기술하는데, `provider` 필드만 전체 파일 경로를 포함한다. 스타일 비일관성이지만 기능 문제는 없다.
- **제안**: 통일성을 위해 `(providers/_overview.md §1 단일 진실)` 또는 `(Spec Trigger Providers §1)` 로 축약하거나, 파일 경로 포함 방식을 DTO 전체에 통일. 차단 필요 없음.

---

### [INFO] `botToken` 필드 `@ApiProperty description` — "텔레그램 BotFather 발급" 으로 Telegram 한정 기술

- **위치**: `chat-channel-config.dto.ts` line 98–107
- **상세**: provider 가 slack / discord 로 확장됐지만 `botToken` 의 description 은 여전히 "텔레그램 BotFather 발급" 으로만 설명한다. Slack 의 `xoxb-*` bot token 이나 Discord bot token 은 BotFather 발급이 아니다.
- **제안**: description 을 "Chat 플랫폼 봇 토큰. Telegram: BotFather 발급 / Slack: OAuth & Permissions xoxb-* / Discord: Bot 탭 Reset Token." 등 3 provider 를 모두 포함하도록 갱신. 짧게 "봇 토큰 (provider 별 발급 경로는 각 통합 가이드 참조)" 도 가능.

---

### [INFO] user guide `triggers.en.mdx` / `triggers.mdx` — Slack / Discord 가이드 링크가 `/docs/06-integrations-and-config/slack` / `.../discord` 로만 명시

- **위치**: `codebase/frontend/src/content/docs/02-nodes/triggers.en.mdx` line 510–513, `triggers.mdx` line 570–575
- **상세**: 신규 provider 표에 세 provider 링크가 추가됐다. `triggers.en.mdx` 의 Telegram 행이 `/docs/06-integrations-and-config/telegram` 로 링크되는 반면, 해당 페이지의 "Telegram setup" 절은 이미 내용이 있다. 그러나 Slack/Discord 링크 대상 페이지에서 GUI 흐름 격상이 이번 PR 에 포함된다고 가정할 때, 기존 표의 Slack/Discord 링크가 "Slack integration guide" 라는 anchor text 로 표기되어 있는데 해당 가이드 페이지의 헤딩과 정확히 대응하는지 점검 필요. 현재 diff 에 표시된 `discord.en.mdx` / `slack.en.mdx` 변경에서 두 페이지 모두 헤딩이 "Connect Discord/Slack to clemvion" 등으로 확인되어 직접 충돌은 없다.
- **제안**: cross-link anchor text 와 링크 대상 페이지 헤딩의 일치 여부를 링크 QA 단계에서 한 번 확인. 차단 필요 없음.

---

### [INFO] `e2e-chat-channel-fixture.ts` JSDoc — `ownerEmailVerified` 옵션 설명 삭제 후 빈 줄로 단락 구분 파괴

- **위치**: `codebase/backend/test/helpers/e2e-chat-channel-fixture.ts` line 13-27 (diff 기준)
- **상세**: `ownerEmailVerified` 옵션과 그 설명 단락 (`- ownerEmailVerified (기본 true) 옵션은 ...`) 이 삭제됐다. 해당 삭제로 JSDoc 내 "Provider 별 기본 동작:" 단락 앞의 공백이 변경됐다. 결과적으로 JSDoc 이 `password_hash` 설명 직후 바로 "Provider 별 기본 동작:" 으로 이어진다. 기능 문제 없음. 단, 삭제된 invariant (inbound 가 owner.emailVerified 무관함) 를 인지할 주석이 완전히 사라진 것이 주목된다 — plan `chat-channel-unverified-owner-e2e.md` (삭제된 plan) 에는 "헬퍼 JSDoc 의 `ownerEmailVerified` 옵션 노트와 함께 SoT 를 이룸" 이라는 설명이 있었는데 e2e 케이스와 헬퍼 JSDoc 이 모두 삭제됐다. inbound-public-route invariant 를 lock-in 하는 테스트 케이스와 JSDoc 양쪽이 사라진 것은 문서화 관점에서 후퇴다.
- **제안**: 최소한 헬퍼 JSDoc 에 "inbound webhook (/api/hooks/:path) 은 public route — JWT 인증 불필요, trigger 기반 검증만 수행" 한 줄 인라인 주석을 유지하는 것이 바람직하다. 현재 상태는 코드만 봐서는 이 invariant 를 알 수 없다.

---

### [INFO] `discord.en.mdx` / `discord.mdx` — 신규 `<Callout type="warn">` 에 spec ID 참조(`R-CC-13 / R-D-3`) 가 있으나 클릭 불가 링크

- **위치**: `codebase/frontend/src/content/docs/06-integrations-and-config/discord.en.mdx` line 623–625, `discord.mdx` line 685–687
- **상세**: "R-CC-13 / R-D-3" 는 내부 spec ID 인데 user-facing 문서에 그대로 노출된다. 일반 사용자에게는 의미 없는 내부 코드이며, 링크도 아니다.
- **제안**: user-facing 문서에서는 내부 spec ID 를 생략하거나 괄호 주석으로 "v1 아키텍처 결정" 정도로 대체하는 것이 가독성 측면에서 낫다. 내부 구현 추적 목적으로 spec ID 를 유지하려면 HTML 주석 (`<!-- R-CC-13 -->`) 으로 처리하는 것을 고려한다. 차단 필요 없음.

---

### [INFO] `slack.en.mdx` / `slack.mdx` — 신규 `<Callout type="note">` 에 "Slack 의 설계 제약(R-S-2)" 내부 ID 노출

- **위치**: `codebase/frontend/src/content/docs/06-integrations-and-config/slack.en.mdx` line 747–749, `slack.mdx` line 810–811
- **상세**: Discord callout 과 동일 패턴 — `R-S-2` 내부 spec ID 가 user-facing 문서에 그대로 삽입.
- **제안**: Discord 케이스와 동일한 처리 권고. "Slack's design constraint" / "Slack 의 설계 제약" 으로 충분하며 spec ID 는 생략하거나 HTML 주석으로 이동. 차단 필요 없음.

---

### [INFO] plan `trigger-create-multi-provider-ui.md` — `inboundSigning` 필드 처리 옵션 (a)/(b) 중 (a) 채택으로 기술되어 있으나 실제 코드에 `inboundSigning` 필드가 잔존

- **위치**: `plan/in-progress/trigger-create-multi-provider-ui.md` Commit 1 항목, "기존 `inboundSigning` 입력 가드 처리" 행 — "(a) 채택: 완전 제거 — `inboundSigning` 필드를 DTO 에서 삭제"
- **상세**: plan 은 `inboundSigning` 필드를 DTO 에서 완전 삭제하는 (a) 안을 채택으로 기술했다. 그러나 실제 구현된 DTO (`chat-channel-config.dto.ts` line 147-164) 에는 `inboundSigning` 필드가 여전히 존재하고 `@IsEmpty` 로 입력 차단만 유지된다. plan 과 구현이 불일치한다. 이 차이가 의도적 변경(안 (b) 채택으로 방향 전환)이라면 plan 을 갱신해야 하고, 미완성이라면 해당 필드를 추후 삭제해야 한다.
- **제안**: plan 의 채택 안을 실제 구현에 맞춰 "(b) legacy `@IsEmpty` 유지 — 기존 호출자 호환 보수 유지, inboundSigningPlaintext 신규 필드 추가" 로 수정. 또는 `inboundSigning` 필드를 실제로 삭제해 plan (a) 를 완성. 문서와 코드 사이의 불일치가 향후 유지보수자에게 혼동을 줄 수 있다.

---

### [INFO] `ai-agent.handler.ts` — `capFormDataBytes` / `FORM_SUBMITTED_MAX_BYTES` 삭제 코드에 `@deprecated` 또는 이동 주석 없음

- **위치**: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` diff — `FORM_SUBMITTED_MAX_BYTES`, `capFormDataBytes` 삭제 블록
- **상세**: 이 두 식별자는 직전 PR (`ai-agent-formdata-size-limit`) 에서 신설된 것인데 본 PR 에서 삭제된다. 삭제 이유 (formData cap 기능 자체를 되돌린 것인지, 다른 위치로 이동한 것인지) 에 대한 인라인 주석이 없다. `plan/complete/ai-agent-formdata-size-limit.md` 자체도 이번 PR 에서 함께 삭제되므로 이력이 complete 폴더에서 사라진다.
- **제안**: 삭제 커밋 메시지 또는 code comment 에 "formData cap 기능 revert — 별 plan 으로 재설계 예정" 등 삭제 사유 한 줄을 남기는 것이 권장된다. 현재 PR diff 만으로는 의도적 rollback 인지, 미완성 누락인지 판단이 불가하다. (plan 파일들도 함께 삭제되므로 이력 공백이 발생함.)

---

### [INFO] CHANGELOG 업데이트 없음 — Slack / Discord provider 공개는 사용자 대면 breaking change 수준의 기능 추가

- **위치**: 전체 PR diff 중 CHANGELOG 또는 release notes 파일 변경 없음
- **상세**: `CHAT_CHANNEL_PROVIDERS` 에 `slack` / `discord` 추가, `inboundSigningPlaintext` 신규 API 필드, i18n 문구 변경, user guide 격상은 v1 feature 완성 관점에서 중요한 공개 변경이다. 별도 CHANGELOG.md 관리 정책이 없다면 해당 없으나, 프로젝트 루트 또는 `codebase/` 에 CHANGELOG 가 있다면 동반 갱신이 필요하다.
- **제안**: 프로젝트에 CHANGELOG 관리 정책이 있는 경우 항목 추가. 없다면 해당 없음.

---

## 요약

이번 변경의 문서화 품질은 전반적으로 높다. `inboundSigningPlaintext` 신규 필드에 대해 JSDoc `@see` 태그로 spec cross-link 3건을 명시하고, `@ApiPropertyOptional description` 에도 provider 별 분기와 SS-SE-01 invariant 를 기술했다. user guide 4개 파일(slack/discord KO/EN) 도 GUI 흐름으로 격상되어 실제 구현과 문서가 동기화됐다. 다만 두 건의 WARNING 이 주목된다. 첫째, `inboundSigningPlaintext` 의 `@ApiPropertyOptional` 에 `writeOnly: true` 가 없어 swagger 응답 스키마에서 plaintext 필드가 숨겨지지 않는다 — 보안 민감 필드에 대한 swagger 문서화 관점의 결함이다. 둘째, plan 에서 채택으로 명시한 `inboundSigning` 필드 완전 제거(a 안)가 실제 구현에 반영되지 않아 plan-코드 불일치가 존재한다. INFO 수준으로는 `botToken` 의 telegram 한정 description, 내부 spec ID(`R-CC-13`/`R-S-2`)의 user-facing 문서 노출, `ownerEmailVerified` 관련 invariant 주석 완전 삭제가 발견됐다.

---

## 위험도

LOW
