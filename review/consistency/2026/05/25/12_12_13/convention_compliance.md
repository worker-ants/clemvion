# 정식 규약 준수 검토 결과

**대상 문서**: `spec/5-system/15-chat-channel.md`
**검토 모드**: 구현 착수 전 (--impl-prep)
**검토 일시**: 2026-05-25

---

## 발견사항

### 발견사항 1

- **[INFO]** Frontmatter `pending_plans` 에 완료된 plan 경로 잔존 가능성
  - target 위치: frontmatter 라인 18–25 (`pending_plans:` 블록)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §4` — `spec-pending-plan-existence.test.ts` 가드: `pending_plans:` 의 모든 경로가 `plan/in-progress/` 에 실존해야 함
  - 상세: 현재 frontmatter 에 6개 pending_plans 가 선언되어 있다. 그 중 `plan/in-progress/chat-channel-dispatcher-split.md` 는 본문 Rationale §R8 마지막 줄 (line 524) 에서 "후속 추적: 본 정책 구현은 `plan/complete/chat-channel-dispatcher-split.md` (2026-05-24 완료)" 라고 명시하고 있어, 이미 `plan/complete/` 로 이동했을 가능성이 높다. 만약 실제로 완료된 plan 이라면 frontmatter 에서 제거하고 모든 pending_plans 가 complete 이면 `status: partial` → `implemented` 승격이 필요하다.
  - 제안: `plan/in-progress/chat-channel-dispatcher-split.md` 파일 실존 여부를 확인 후, complete 이동된 경우 frontmatter 의 `pending_plans:` 에서 해당 항목 제거. 나머지 5개 plan 도 동일하게 실존 확인 후 모두 완료됐다면 `status: implemented` 로 승격.

### 발견사항 2

- **[WARNING]** `§4.2` 의 마이그레이션 슬롯 번호 미예약 언급
  - target 위치: §4.2 "Trigger 테이블 신규 컬럼" 본문 마지막 문장 (line 224)
  - 위반 규약: `spec/conventions/migrations.md §5` — 신규 마이그레이션 작성 전 V번호를 `migrations.md` 에서 예약하는 것이 절차. 동 절의 의무는 "spec 이 V번호를 SoT 로 관리한다"는 방향성을 가리킴.
  - 상세: 본문에 "Flyway 마이그레이션 슬롯 번호는 PR-A 착수 직전 `spec/conventions/migrations.md` 에서 예약" 이라고 기술되어 있다. 이는 구현 착수 전(--impl-prep) 시점 기준으로 아직 V번호가 예약되지 않은 상태를 암시한다. `migrations.md §5` 는 "PR 을 열기 전" 에 V번호를 확정하도록 정의하므로, 구현 착수 직전인 현 시점에 V번호가 이미 예약돼 spec 에 반영되어 있는 것이 이상적이다.
  - 제안: 구현 PR-A 착수 시점 이전에 `migrations.md` 절차(§5) 에 따라 V번호를 예약하고, `spec/5-system/15-chat-channel.md §4.2` 의 ALTER TABLE 블록에 실제 V번호를 기재한다 (예: `V042__add_chat_channel_columns.sql`). 현재 "착수 직전 예약" 문구 자체는 절차 안내로 허용 가능하나, 실제 구현 PR 에서는 번호 기재 완료 상태여야 한다.

### 발견사항 3

- **[INFO]** `§5.4` 섹션 번호 중복
  - target 위치: `§5.4 Bot Token Rotation API 응답 계약` (line 264) 과 `§5.4 Bot Token 변경 single-path 정책` (line 299) — 두 섹션이 모두 `5.4` 번호 사용
  - 위반 규약: CLAUDE.md 가 참조하는 spec 문서 3섹션 구성 (Overview / 본문 / Rationale) 의 내부 일관성 원칙. 섹션 번호 체계가 깨지면 cross-link (`§5.4` 참조) 가 어느 절을 가리키는지 모호해짐.
  - 상세: `§5.4` 헤더가 두 번 등장한다. 첫 번째는 "Bot Token Rotation API 응답 계약", 두 번째는 "Bot Token 변경 single-path 정책". 후자가 실질적으로 `§5.4.1` 의 상위 섹션인데 잘못 번호가 붙어 있다. 본문 내 cross-link (line 266의 `[CCH-SE-04](#34-신뢰성--보안)`) 도 앵커가 정합한지 확인이 필요하다.
  - 제안: 두 번째 `§5.4` 를 `§5.5` 이후 번호로 재지정하거나, 기존 `§5.4.1`, `§5.4.1.1` 구조에 맞게 상위 절을 `§5.4` 로 두고 응답 계약을 `§5.4.0` 이나 별도 절로 분리한다. 또는 "Bot Token Rotation API 응답 계약" 을 `§5.4.1` 의 하위 절로 편입해 섹션 계층을 정비한다.

### 발견사항 4

- **[INFO]** `§5.5` / `§5.5.1` 번호 — `§5.4.1` / `§5.4.1.1` 이후에 다시 `§5.5` 가 붙어야 하나 현재 섹션 3 중 `§5.5` 가 독립
  - target 위치: `§5.5 Inbound HTTP Contract` (line 349) 와 `§5.5.1 Provider-specific 응답 예외 정책` (line 371)
  - 위반 규약: 상기 발견사항 3 과 동일 — 섹션 번호 중복으로 인한 연쇄 번호 오류
  - 상세: 발견사항 3 에서 두 번째 `§5.4` 를 수정하면 이후 섹션 (`§5.4.1`, `§5.4.1.1`, `§5.4.2`, `§5.5`, `§5.5.1`) 의 번호도 연쇄 조정이 필요하다. 단독 이슈가 아니라 발견사항 3의 파생이다.
  - 제안: 발견사항 3 수정 시 이후 모든 하위 섹션 번호를 일관되게 재지정한다.

### 발견사항 5

- **[INFO]** API 응답 계약의 Swagger 래퍼 패턴 명시 수준
  - target 위치: `§5.4` (첫 번째) 성공 응답 예시 JSON (line 276–285)
  - 위반 규약: `spec/conventions/swagger.md §5.1` — 응답 DTO 위치는 `dto/responses/*-response.dto.ts`, 응답은 공용 래퍼 헬퍼(`ApiOkWrappedResponse` / `ApiAcceptedWrappedResponse` 등) 사용 의무
  - 상세: spec 본문에서 성공 응답을 `{ "data": { ... } }` 형태로 기술하고 "[API Convention §5.1](./2-api-convention.md) 의 `{ data }` 래퍼 + `TransformInterceptor` 적용" 이라고 언급하고 있어 내용 자체는 올바르다. 다만 구현 착수(--impl-prep) 관점에서, `POST /api/triggers/:id/chat-channel/rotate-bot-token` endpoint 에 대응하는 응답 DTO (`RotateBotTokenResponseDto` 등) 가 `dto/responses/` 에 위치해야 하고 controller 에서 `ApiOkWrappedResponse(RotateBotTokenResponseDto)` 를 사용해야 한다는 의무가 spec 에 명시되어 있지 않다.
  - 제안: 본 spec 의 API 응답 계약 절 (§5.4 또는 §7 구현 파일 구조) 에 "응답 DTO 는 `chat-channel.controller.ts` 의 `dto/responses/rotate-bot-token-response.dto.ts` 에 두고 `ApiAcceptedWrappedResponse(RotateBotTokenResponseDto)` 또는 `ApiOkWrappedResponse` 를 controller 에 적용한다" 한 줄을 추가해 `swagger.md §5` 와 명시적으로 정합하도록 한다. 구현 가이드 역할이므로 WARNING 수준은 아님.

### 발견사항 6

- **[INFO]** `§7 구현 파일 구조` 의 `chat-channel.controller.ts` 에 `@ApiBearerAuth` / `@ApiTags` 지정 여부 미명시
  - target 위치: §7 구현 파일 구조 목록 (line 402)
  - 위반 규약: `spec/conventions/swagger.md §2-1` — 보호된 controller 는 `@ApiTags` + `@ApiBearerAuth('access-token')` 필수
  - 상세: `POST /api/triggers/:id/chat-channel/rotate-bot-token` 은 인증이 필요한 엔드포인트이므로 controller 에 `@ApiBearerAuth('access-token')` 이 붙어야 한다. spec 의 구현 파일 구조 절이 이를 언급하지 않는다. 단 이것은 구현 세부사항이고 spec 이 모든 데코레이터를 열거할 의무는 없으므로 INFO 수준.
  - 제안: `§7` 또는 `§5.4` 에 "controller 는 `@ApiTags('Chat Channel')` + `@ApiBearerAuth('access-token')` 를 선언한다" 한 줄 추가를 권장.

### 발견사항 7

- **[INFO]** secret ref URI 형식의 `name` 토큰 표기 일관성
  - target 위치: §4.1 `botTokenRef` 주석 (line 182): `secret://triggers/{triggerId}/bot-token` vs `secret://triggers/{id}/bot-token` (line 218 SQL 주석)
  - 위반 규약: `spec/conventions/secret-store.md §1` — URI scheme 의 `resourceId` 는 UUID v4 또는 별 spec 의 ID 형식으로 일관
  - 상세: §4.1 JSON 예시에서는 `{triggerId}`, §4.2 SQL 주석에서는 `{id}` 로 표기가 혼재한다. 의미는 동일하나 독자 관점에서 `{id}` 가 무엇인지 즉시 분명하지 않다.
  - 제안: `{triggerId}` 로 통일한다.

---

## 요약

`spec/5-system/15-chat-channel.md` 는 전반적으로 정식 규약을 잘 따르고 있다. Frontmatter 에 `id` / `status` / `code:` / `pending_plans:` 가 모두 기재되어 있고, `spec/conventions/spec-impl-evidence.md` 의 `partial` + `pending_plans` 의무를 충족한다. 출력 포맷 (API 응답 래퍼 `{ data }`, 에러 envelope `{ error: { code, message, details? } }`) 과 secret ref URI 패턴 (`secret://triggers/{id}/...`) 도 해당 convention 과 정합한다. 다만 섹션 번호 `§5.4` 중복 이 교차 참조를 모호하게 만들며, `plan/in-progress/chat-channel-dispatcher-split.md` 가 본문에서 "2026-05-24 완료" 로 기술됨에도 `pending_plans:` 에 잔존하는 불일치가 `spec-pending-plan-existence.test.ts` 가드의 잠재적 실패 지점이 된다. 마이그레이션 V번호는 구현 착수 전 예약이 요구되므로 PR-A 전에 `migrations.md §5` 절차를 이행해야 한다. 이상의 항목은 모두 INFO 또는 WARNING 수준이며 CRITICAL 위반은 없다.

---

## 위험도

LOW
