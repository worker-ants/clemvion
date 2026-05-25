# Convention Compliance Review

**검토 대상**: `spec/5-system/15-chat-channel.md`
**검토 모드**: 구현 착수 전 검토 (--impl-prep)
**검토 일시**: 2026-05-25

---

## 발견사항

### [INFO] §5.4 응답 계약의 `{ data }` 래퍼 선언은 올바르나 Swagger 규약과의 정합 명시 누락
- **target 위치**: `§5.4 Bot Token Rotation API 응답 계약` — 성공 응답 (200 OK) 본문
- **위반 규약**: `spec/conventions/swagger.md §5 응답 DTO 규약` — 성공 응답은 응답 DTO 클래스 + 공용 래퍼 헬퍼 (`ApiOkWrappedResponse`, `ApiCreatedWrappedResponse` 등) 를 사용하며, 인라인 객체 스키마 나열보다 DTO 클래스를 참조해야 한다.
- **상세**: spec 본문의 응답 계약 예시는 jsonc 인라인 객체 형태로 기술되어 있다. 이는 spec 문서의 가독성을 위한 표현이므로 문서 자체의 오류는 아니지만, 구현자에게 응답 DTO 클래스 (`RotateBotTokenResponseDto` 등) 와 `ApiOkWrappedResponse` 헬퍼를 사용해야 함을 명시하지 않는다. 다른 시스템 spec (예: EIA §5.4) 은 "API Convention §5.1 의 `{ data }` 래퍼 + `TransformInterceptor` 적용" 이라고 언급하는 수준에서 그치며 DTO 클래스 참조를 명시하지 않는 것이 일관된 패턴이므로, 위반보다는 일관성 제안.
- **제안**: spec 본문의 "성공 응답 (200 OK)" 설명에 "구현 시 `dto/responses/rotate-bot-token-response.dto.ts` + `ApiOkWrappedResponse` 헬퍼 사용" 단서를 각주로 추가하거나, 또는 이 수준의 명시는 이미 `conventions/swagger.md` 로 위임된 것으로 간주해 현 상태 유지.

---

### [INFO] `§4.2` 의 SQL 컬럼 `chat_channel_last_error` 타입이 에러 응답 형식 규약과의 연결 미명시
- **target 위치**: `§4.2 Trigger 테이블 신규 컬럼` — `chat_channel_last_error TEXT NULL`
- **위반 규약**: `spec/conventions/swagger.md §5.5 에러 응답 참조` 및 `spec/5-system/2-api-convention.md §5.3 에러 응답` 직접 위반은 아님. 단, `chat_channel_last_error` 컬럼이 무엇을 보관하는지 (에러 코드? 에러 메시지 원문? JSON 구조?) 명시되어 있지 않아, 구현자가 임의로 `error.message` 원문을 저장할 경우 CCH-ERR-03 (민감정보 노출 금지) 과 충돌 가능성이 있다.
- **상세**: `chat_channel_health=degraded` 와 함께 `chat_channel_last_error` 컬럼은 어댑터 외부 API 호출 실패 맥락에서 쓰이는데, 저장 형식이 spec 어디에도 정의되어 있지 않다. `§3.5 CCH-ERR-03` 은 "channel 메시지 본문·로그·metric 어디에도 포함하지 않는다" 고 명시하지만, DB 컬럼에 대한 언급이 없다.
- **제안**: `§4.2` 의 `chat_channel_last_error` 컬럼 주석에 저장 형식 (예: "어댑터 sendMessage 실패 시 외부 API 에러 코드/HTTP status — error.message 원문 미저장, CCH-ERR-03 정책 동일 적용") 을 1줄 추가.

---

### [INFO] Frontmatter `pending_plans` 목록과 spec 본문 간 일관성 — `chat-channel-error-notify` plan 미포함
- **target 위치**: YAML frontmatter `pending_plans` 배열 (lines 18–25)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — `status: partial` 시 `pending_plans` 는 미구현 surface 를 책임지는 plan 경로를 의무로 포함해야 한다. `§3.5 CCH-ERR-*` 와 `§4.1.1` 의 실행 실패 안내 기능은 `plan/in-progress/chat-channel-error-notify.md` 가 담당한다고 spec 본문 곳곳에서 언급되지만, 해당 plan 이 frontmatter `pending_plans` 에 포함되어 있지 않다.
- **상세**: frontmatter 에는 다음 6개 plan 이 있다:
  - `chat-channel-discord-gateway`
  - `chat-channel-slack-socket-mode`
  - `chat-channel-form-native-modal`
  - `chat-channel-visual-ssr-png`
  - `chat-channel-secret-store-infra`
  - `chat-channel-error-notify`

  실제로 `chat-channel-error-notify` 는 목록에 포함되어 있다. 따라서 이 항목은 허위 발견이다 — frontmatter line 24 에 `- plan/in-progress/chat-channel-error-notify.md` 가 있음을 확인. 발견 없음.

---

### [WARNING] `§4.2` Flyway 마이그레이션 슬롯 예약 참조가 `migrations.md` 를 직접 지시하지 않고 절차 수행 지점 불명확
- **target 위치**: `§4.2 Trigger 테이블 신규 컬럼` 마지막 줄 — "Flyway 마이그레이션 슬롯 번호는 PR-A 착수 직전 `spec/conventions/migrations.md` 에서 예약."
- **위반 규약**: `spec/conventions/migrations.md §5 새 마이그레이션 추가 절차` — 번호 예약은 `migrations.md` 의 절차를 따라야 하며, PR 착수 직전 예약이 규약상 올바른 시점이다. 단, "PR-A" 가 무엇인지 본 spec 어디에도 정의되어 있지 않다.
- **상세**: 본 spec 에 "PR-A" 라는 단계 식별자가 사용되지만, 구현 단계 분리 방식 (PR-A / PR-B 등) 이 spec 본문에 기술되어 있지 않아 구현자가 어느 PR 에서 예약해야 하는지 판단할 근거가 없다. 다른 spec 들은 대개 "구현 PR 에서" 또는 "최초 DB 마이그레이션 PR 에서" 와 같이 맥락을 기술한다.
- **제안**: "PR-A 착수 직전" → "DB 스키마 변경을 포함하는 첫 번째 구현 PR 착수 직전" 으로 교체하거나, 또는 `plan/in-progress/chat-channel-*.md` 의 구현 단계 분할 계획과 cross-link 추가.

---

### [INFO] `§5.5 Inbound HTTP Contract` 표의 에러 응답 본문 형식 표현 — `error envelope` 참조 표기 일관성
- **target 위치**: `§5.5` 케이스 매트릭스 표 — `error envelope` 형식 참조 줄
- **위반 규약**: `spec/5-system/2-api-convention.md §5.3` — 에러 응답 형식은 `{ error: { code, message, details? } }` 이며, 일부 행에서 "표준 에러 envelope" 라는 표현이 사용되고, 마지막 요약 줄에서 별도로 참조링크가 제공된다. 이는 이미 스펙 규약과 정합하나, `error envelope` 라는 용어가 규약 원문에서 사용되지 않는 비표준 용어다.
- **상세**: `spec/5-system/2-api-convention.md §5.3` 및 타 spec 에서는 "에러 응답" 또는 "에러 형식"이라는 표현을 사용하며 `error envelope` 라는 단어는 등장하지 않는다. 사소한 용어 불일치이나, 검토자가 `error envelope` 가 별도 타입이나 규약 문서를 지칭하는 것으로 오해할 수 있다.
- **제안**: `error envelope` → "표준 에러 응답 형식 ([API Convention §5.3](...))` 으로 통일. 또는 현 상태 유지 (내용상 오류가 아니므로 강제하지 않음).

---

### [INFO] `§3.1 CCH-AD-01` 요구사항 표의 supported provider 목록 — SoT 단일성 적절, 추가 발견 없음
- `CCH-AD-01` 은 "SoT 는 `providers/_overview.md §1` 단일 진실" 이라고 명확히 위임하고 있어 중복 정의 없음. 규약 준수 정상.

---

### [INFO] `secret://` URI scheme 사용 — `secret-store.md §1` 과 일치 확인
- **target 위치**: `§4.1` — `botTokenRef`, `inboundSigningRef` 의 ref 형식 예시 (`secret://triggers/{triggerId}/bot-token` 등)
- **위반 규약**: `spec/conventions/secret-store.md §1 URI scheme`
- **상세**: spec 본문의 ref 형식 예시가 `secret://triggers/{triggerId}/bot-token` 와 `secret://triggers/{triggerId}/inbound-signing` 으로 기술되어 있다. `secret-store.md §1` 의 URI scheme 과의 정합 여부를 확인할 수 있으나, 본 리뷰의 프롬프트에 포함된 규약 집합에 `secret-store.md` 의 URI scheme 정의 본문이 제공되지 않아 완전 검증이 불가하다. 단, `spec/conventions/chat-channel-adapter.md §2.3` 가 동일 형식을 사용하므로 내부 일관성은 유지된다.
- **제안**: 구현 착수 전 `secret-store.md §1` 의 URI scheme 규칙 (path segment 구성, 허용 문자 등) 과 위 두 ref 형식이 일치하는지 직접 확인 권장.

---

### [WARNING] `§5.4` 의 `rotate-bot-token` 엔드포인트 응답에서 `hasBotToken` derived 필드 관련 Swagger 규약 준수 의무 미명시
- **target 위치**: `§5.4.2 응답 DTO derived 필드 — hasBotToken`
- **위반 규약**: `spec/conventions/swagger.md §1-5 writeOnly / readOnly` — "서버 derived field (`hasBotToken`, `id`, `createdAt` 등) 는 응답 DTO 한정으로 `readOnly: true` 동반" 이 의무 (SoT 는 `swagger.md §1-5`).
- **상세**: `§5.4.2` 는 `hasBotToken: boolean` 의 의미와 규칙을 잘 기술하고 있으나, 구현 시 `@ApiProperty({ readOnly: true })` 를 적용해야 한다는 의무를 명시하지 않는다. `swagger.md §1-5` 가 이미 이를 "의무" 로 선언하므로 spec 본문 오류라기보다 누락이나, 구현자가 간과할 가능성이 있다.
- **제안**: `§5.4.2` 의 "`hasBotToken` 만 노출" 항목 뒤에 "구현 DTO 에서 `@ApiProperty({ readOnly: true })` 적용 의무 (swagger.md §1-5)" 단서 1줄 추가.

---

### [WARNING] `§4.1` `chatChannel.botToken` 입력 필드와 `inboundSigningPlaintext` 에 `writeOnly` 규약 적용 의무 명시 누락
- **target 위치**: `§4.1 Trigger.config.chatChannel` JSON 예시 — `botToken`, `inboundSigningPlaintext` 필드
- **위반 규약**: `spec/conventions/swagger.md §1-5 writeOnly / readOnly` — "secret store 입력 plaintext (`botToken`, `inboundSigningPlaintext`) 필드는 항상 `writeOnly: true` 동반" 이 의무 (SoT 는 `swagger.md §1-5`).
- **상세**: spec 본문은 "입력 전용 — POST 요청 body 한정, service 가 SecretResolver.store 로 옮긴 뒤 strip" 이라고 설명하고 있어 의도는 정합하나, 구현 DTO 에서 `@ApiProperty({ writeOnly: true })` 를 반드시 적용해야 한다는 의무가 명시되어 있지 않다. `swagger.md §1-5` 예시에서 `inboundSigningPlaintext` 가 구체 예시 DTO 로 등장하므로 convention 이 명확하지만, 이 spec 을 보는 구현자가 convention 파일을 간과하면 Swagger 스키마에 secret 필드가 `readOnly` 없이 노출될 수 있다.
- **제안**: `§4.1` 의 `botToken` / `inboundSigningPlaintext` 주석에 "구현 DTO: `@ApiProperty({ writeOnly: true })` 의무 (conventions/swagger.md §1-5)" 단서를 추가하거나, 전체 구현 주의 단락을 `§7 구현 파일 구조` 하단에 1개 박스로 통합.

---

### [INFO] 문서 3섹션 구조 (Overview / 본문 / Rationale) 준수 확인
- **target 위치**: 전체 문서 구조
- **위반 규약**: CLAUDE.md "결정의 배경·근거는 해당 spec 문서 끝의 `## Rationale`"
- **상세**: `## Overview (제품 정의)` → 본문 (§3~§8) → `## Rationale` 3섹션 구조를 완전히 준수하고 있다. 규약 준수 정상.

---

### [INFO] Frontmatter `id` 값과 파일 basename 일치 확인
- **target 위치**: frontmatter `id: chat-channel` vs 파일명 `15-chat-channel.md`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — `id` 는 "파일 basename(확장자 제외) 기반 **권장**"
- **상세**: 파일명은 `15-chat-channel.md` 이고 id 는 `chat-channel` 이다. "권장" 사항이므로 위반은 아니며, `15-` prefix 는 정렬용 번호라 basename 의 핵심부 (`chat-channel`) 와 id 가 일치하는 것이 합리적이다. 기존 spec 들의 패턴 (예: `15-chat-channel.md` → `id: chat-channel`) 과 일치.

---

### [INFO] Frontmatter `status: partial` 에서 `pending_plans` 존재 여부 확인
- **target 위치**: frontmatter `status: partial` + `pending_plans` 배열
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §3` — `status: partial` 시 `pending_plans` 의무
- **상세**: `pending_plans` 에 6개 plan 이 등록되어 있어 의무 충족. 각 path 의 `plan/in-progress/` 실존 여부는 `spec-pending-plan-existence.test.ts` 가드가 별도 검증. 규약 준수 정상.

---

### [INFO] `§5.5` 표의 HTTP 상태 코드 — `2-api-convention.md §6` 와 정합 확인
- **target 위치**: `§5.5 Inbound HTTP Contract` 케이스 매트릭스
- **상세**: `202 Accepted`, `200 OK`, `404 Not Found`, `401 Unauthorized` 가 사용된다. `2-api-convention.md §6` 표에는 202 가 없으나, 이는 webhook 수신의 비동기 패턴에서 쓰이는 코드로 `12-webhook.md` 의 SoT 를 따르는 것이 명시되어 있어 정합. `spec/5-system/2-api-convention.md §6` 의 표는 일반 CRUD API 응답 코드를 정의하며 webhook/streaming 경로는 별도 spec 이 SoT 임을 인지.

---

### [INFO] `§7 구현 파일 구조` 내 파일명/디렉토리 명명 — kebab-case 일관성
- **target 위치**: `§7 구현 파일 구조` 코드 블록 내 파일명 목록
- **위반 규약**: 프로젝트 파일 명명 규약 (kebab-case)
- **상세**: `chat-channel.module.ts`, `channel-adapter.registry.ts`, `chat-channel.dispatcher.ts` 등 모두 kebab-case 를 따르고 있다. `telegram-update.parser.ts`, `telegram-message.renderer.ts` 도 kebab-case 준수. 규약 준수 정상.

---

## 요약

`spec/5-system/15-chat-channel.md` 는 정식 규약 (`spec/conventions/`) 에 대한 직접적인 CRITICAL 위반 없이 전반적으로 규약을 잘 준수하고 있다. 문서 3섹션 구조 (Overview / 본문 / Rationale), frontmatter 스키마 (`id`, `status`, `code`, `pending_plans`), API 에러 응답 형식 (`{ error: { code, message, details? } }`), 성공 응답 래퍼 (`{ data }`) 등 핵심 규약은 모두 정합하다. 발견된 항목은 주로 Swagger 규약 (`swagger.md §1-5 writeOnly/readOnly`) 의 구현 의무를 spec 본문에서 명시하지 않은 것 (WARNING 2건) 과 사소한 참조·표현 일관성 제안 (INFO 다수) 에 해당한다. 두 WARNING 항목 (`botToken`/`inboundSigningPlaintext` 의 `writeOnly` 의무 미명시, `hasBotToken` 의 `readOnly` 의무 미명시) 은 구현자가 Swagger UI 에 secret plaintext 가 노출되는 실수를 유발할 수 있으나, `swagger.md §1-5` 가 이를 이미 프로젝트 의무 규약으로 선언하고 있어 spec 문서 수정 없이도 구현자가 해당 규약을 참고하면 충족 가능하다. Flyway 마이그레이션 "PR-A" 단계 식별자의 맥락 불명확 (WARNING) 은 구현 착수 직전 단계에서 오해를 유발할 수 있어 주의를 요한다.

## 위험도

LOW
