# API 계약 리뷰 — trigger-create-multi-provider-ui

검토 일시: 2026-05-24
대상: Chat Channel 다중 provider (Telegram / Slack / Discord) UI + DTO + Service 변경

---

## 발견사항

### [INFO] CHAT_CHANNEL_PROVIDERS enum 확장 — 하위 호환성 충족

- 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts` — `CHAT_CHANNEL_PROVIDERS`
- 상세: `['telegram']` → `['telegram', 'slack', 'discord']` 로 확장. 기존 `telegram` 값을 그대로 유지하므로 기존 클라이언트는 영향 없음. 열거형 확장은 additive change 로 breaking change 에 해당하지 않는다.
- 제안: 없음. 정상 확장.

---

### [WARNING] `inboundSigningPlaintext` 필드 — DTO 단 형식 검증 부재 (서비스 단 위임)

- 위치: `chat-channel-config.dto.ts` 라인 111-124 (`@IsOptional @IsString @MaxLength(128)`)
- 상세: DTO 주석에 "형식 검증은 service 단에서 수행 (provider 정보가 있어야 분기 가능)" 이라 명시되어 있으나, `@IsString` 과 `@MaxLength(128)` 만 적용되어 있어 DTO validation 파이프를 통과한 잘못된 형식의 값이 서비스까지 도달한다. `minLength: 32` 가 `@ApiPropertyOptional` 메타데이터에만 있고 실제 class-validator `@MinLength(32)` 데코레이터가 없다. 즉 Swagger 문서와 실제 런타임 검증이 불일치한다.
- 제안: `@MinLength(32)` 데코레이터를 추가하거나, Swagger `minLength` 메타를 제거하여 문서-검증 불일치를 해소한다. 서비스 단 provider별 정규식 검증은 유지하되, DTO 단에서 최소 길이 하한은 보장하는 것이 API 계약 명확성 측면에서 바람직하다.

---

### [INFO] `inboundSigningPlaintext` — Swagger `readOnly: true` 누락 (응답 strip 의도 미문서화)

- 위치: `chat-channel-config.dto.ts` 라인 111-124 (`@ApiPropertyOptional`)
- 상세: `sanitizeChatChannelForResponse` 에서 `inboundSigningPlaintext` 가 응답에서 제거(strip)된다(SS-SE-01). 그러나 `@ApiPropertyOptional` 에 `readOnly: true` 또는 `writeOnly: true` 중 어느 것도 선언되지 않아, Swagger 스키마만 보는 클라이언트 개발자는 이 필드가 응답에서 반환될 것으로 오해할 수 있다. `inboundSigning` 은 `readOnly: true` 로 마킹되어 있어 불일치가 존재한다.
- 제안: `@ApiPropertyOptional({ ..., writeOnly: true })` 를 추가하거나 Swagger 설명에 "write-only — 응답에서 제거됨 (SS-SE-01)" 을 명시한다.

---

### [INFO] 에러 응답 형식 — `VALIDATION_ERROR + details.field` 일관성 확인됨

- 위치: `triggers.service.ts` 라인 233-308 (`assertChatChannelInputSafe`, `assertInboundSigningPlaintextByProvider`)
- 상세: 모든 에러 응답이 `{ code: 'VALIDATION_ERROR', message: string, details: { field: string } }` envelope 을 일관되게 사용하고 있다. `INVALID_NOTIFICATION_URL` 는 `details` 없이 반환하는데, 해당 예외는 기존부터 유지된 패턴이며 본 PR 변경 대상이 아니다. 신규 추가된 `inboundSigningPlaintext` 분기는 모두 `details.field` 를 포함한다.
- 제안: 없음. 신규 에러 응답은 기존 envelope 규칙과 일관된다.

---

### [INFO] 응답 sanitize — `inboundSigningPlaintext` 정상 strip 확인

- 위치: `triggers.service.ts` 라인 329-333 (`sanitizeChatChannelForResponse`)
- 상세: `inboundSigningRef`, `inboundSigning`, `inboundSigningPlaintext` 가 모두 destructure-out 되어 응답에 포함되지 않는다. 신규 `inboundSigningPlaintext` 필드도 정확히 strip 대상에 포함됨이 확인된다. SS-SE-01 준수.
- 제안: 없음.

---

### [INFO] e2e 테스트 — `ownerEmailVerified=false` PING 케이스 삭제 (보안 회귀 가드 제거)

- 위치: `codebase/backend/test/chat-channel-discord.e2e-spec.ts` (삭제된 27라인), `test/helpers/e2e-chat-channel-fixture.ts` (`ownerEmailVerified` 옵션 제거)
- 상세: PR #301 ai-review security INFO #2 후속으로 추가된 "owner.emailVerified=false 일 때 inbound webhook 은 여전히 200 응답" 회귀 가드 케이스가 제거됐다. 이는 `chat-channel-unverified-owner-e2e.md` plan 이 별도 완료 처리되며 이번 PR 에서 스코프 제외된 것으로 보인다. inbound webhook 의 public route 속성이 e2e 로 커버되지 않게 되어, 향후 누군가 잘못된 emailVerified 가드를 추가해도 탐지가 어렵다. API 계약 관점에서는 "public endpoint는 인증 없이 접근 가능" 이라는 계약 속성이 테스트 커버리지를 잃었다.
- 제안: `chat-channel-unverified-owner-e2e` plan 이 완료 이동만 됐고 실제 e2e 케이스가 사라진 것이라면, 회귀 가드 e2e 복원을 별도 이슈로 추적할 것을 권장한다. 해당 plan 의 체크리스트 3번 "e2e 케이스 1건 추가 — PASS" 와 현재 코드 상태가 불일치한다.

---

### [INFO] `formDataTruncation` / `capFormDataBytes` 제거 — ai-agent 내부 LLM 계약 변경

- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` (107라인 삭제), spec §12.7 관련
- 상세: 본 PR 에서 `FORM_SUBMITTED_MAX_BYTES`, `capFormDataBytes`, `formDataTruncation` 메타가 완전 제거됐다. 이는 LLM-facing tool_result content 의 `form_submitted` shape 에서 `formDataTruncation` 옵셔널 필드가 제거됨을 의미한다. spec §12.7 이 이미 추가된 상태라면 spec 과 구현이 diverge 한다. plan `ai-agent-formdata-size-limit.md` 가 complete 로 이동됐고 해당 구현이 이번 PR 에서 다시 제거되는 것이라면, spec §12.7 도 철회되거나 해당 결정이 spec 에 기록돼야 한다.
- 제안: spec §12.7 이 존재한다면 구현 제거에 대응한 spec 갱신(철회 또는 결정 보류 기록)이 필요하다. 단순 구현 롤백이라면 spec 단일 진실 원칙상 spec 도 함께 정리해야 한다.

---

### [INFO] URL/경로 설계 — Chat Channel 관련 엔드포인트 변경 없음

- 상세: 이번 변경은 기존 `POST /api/triggers` / `PATCH /api/triggers/:id` 의 request body 에 `chatChannel.provider` 값이 추가되는 것으로, 경로 자체의 변경은 없다. RESTful 원칙 위반 없음.
- 제안: 없음.

---

### [INFO] 페이지네이션 — 영향 없음

- 상세: `findAll` 의 `PaginatedResponseDto.create` 패턴은 변경되지 않았다. `sanitizeChatChannelForResponse` 가 목록 조회 경로에도 정상 적용되어 응답 일관성 유지.
- 제안: 없음.

---

### [INFO] 인증/인가 — 신규 엔드포인트 없음, 기존 가드 그대로

- 상세: 이번 변경에서 새로운 HTTP 엔드포인트가 추가되지 않았다. 기존 JWT 가드 적용 경로는 변경 없다. inbound webhook (`/api/hooks/:path`) 은 public route 로 유지됨이 서비스 코드에서 확인된다.
- 제안: 없음.

---

## 요약

이번 변경의 핵심 API 계약 이슈는 두 가지다. 첫째, `inboundSigningPlaintext` DTO 에 `@ApiPropertyOptional({ minLength: 32 })` 로 Swagger 최소 길이를 선언했으나 실제 class-validator `@MinLength(32)` 데코레이터가 없어 문서-검증 불일치가 존재한다(WARNING). 둘째, write-only 필드임에도 Swagger `writeOnly: true` 가 없어 API 소비자에게 응답 strip 사실이 명시되지 않는다(INFO). CHAT_CHANNEL_PROVIDERS enum 확장은 additive change 로 하위 호환성 충족, 에러 응답 envelope (`VALIDATION_ERROR + details.field`)은 일관되게 적용됐으며, 응답 sanitize 로직에 신규 필드가 정확히 포함됨이 확인된다. `capFormDataBytes` 제거로 인한 spec §12.7 과의 diverge 가능성과, `ownerEmailVerified=false` 회귀 가드 e2e 케이스 삭제는 별도 추적이 권장된다.

---

## 위험도

LOW
