# Rationale 연속성 검토 — rotate-bot-token-body (--impl-prep)

대상 plan: `plan/in-progress/rotate-bot-token-body.md` — `triggers.rotateBotToken` · `executions.continueExecution` · `hooks.receiveWebhook` 3개 라우트에 요청 본문 스키마(`@ApiBody` + 문서 전용 DTO)를 광고하는 순수 문서화 변경(런타임 불변, `spec_impact: none`).

## 발견사항

- **[WARNING]** `newBotToken` 필드에 `writeOnly: true` 가 계획에 명시돼 있지 않다 — swagger.md §1-5 "의무" 미이행 위험
  - target 위치: `plan/in-progress/rotate-bot-token-body.md` 실측 표 1행(`triggers` `rotateBotToken` → `ChatChannelRotateBotTokenRequestDto`)
  - 과거 결정 출처: `spec/conventions/swagger.md` §1-5 — *"의무: secret store 입력 plaintext (e.g. `botToken`, `inboundSigningPlaintext`) 필드는 항상 `writeOnly: true` 동반."* 이 의무의 예시 자체가 "bot token plaintext" 이고, `15-chat-channel.md` §5.4.2 는 같은 원칙을 *"`botTokenRef` 자체와 `botToken` plaintext 는 응답에 절대 미포함"* 으로, §CCH-SE-03 은 secret store 암호화 보관 + ref-only 노출로 반복해서 못박고 있다.
  - 상세: 계획이 그대로 따르겠다고 밝힌 선례 `ExecuteWorkflowDto` 는 필드가 전부 non-secret(`parameterValues`/`input`)이라 `writeOnly` 를 쓸 이유가 없었던 사례다. 그 클래스를 템플릿으로 복사하면 "이 DTO 는 writeOnly 를 안 쓴다"는 선례의 **부수적 특성**이 함께 옮겨붙을 위험이 있다 — `newBotToken` 은 §1-5 가 예시로 직접 지목한 "bot token plaintext" 부류이므로, DTO 를 문서 전용으로 유지하더라도 `@ApiProperty({ writeOnly: true })` 는 별도로 필요하다. 이걸 빠뜨리면 Swagger UI 스키마상 이 필드가 응답에도 나타날 수 있는 것처럼 보여, 위 세 Rationale/요구사항이 세운 "bot token plaintext 는 응답에 나타나지 않는다"는 불변식을 문서 층에서 약화시킨다(런타임 자체는 안전하지만, §1-5 가 이 의무를 두는 이유 자체가 "문서가 실제 노출 정책과 어긋나지 않게" 이므로 문서 층 결함도 그 의도를 정면으로 벗어난다).
  - 제안: 문서 전용 DTO 작성 시 `newBotToken` 에 `@ApiProperty({ writeOnly: true, ... })` 를 명시하고, 캐너리에 "writeOnly 플래그가 렌더된 스키마에 실린다"는 검증을 한 항목 추가할 것. plan 체크리스트의 "문서 전용 DTO 둘 · `@ApiBody` 셋" 항목에 이 조건을 부기하는 것을 권장.

- **[INFO]** `newBotToken` 의 required 여부 — 선례의 "전 필드 optional" 특성이 그대로 옮겨붙을 위험
  - target 위치: 위와 동일 (실측 표 1행)
  - 과거 결정 출처: `spec/5-system/15-chat-channel.md` §5.4 요청 본문 — `newBotToken` 은 *"필수 — 신규 Bot Father 토큰"* 으로 명시돼 있고, CCH-SE-04 에러 표도 `newBotToken` 누락을 400 `INVALID_BOT_TOKEN` 으로 규정한다.
  - 상세: 선례 `ExecuteWorkflowDto` 의 두 필드는 전부 `@ApiPropertyOptional` 이다(둘 다 실제로 optional). 이 형태를 그대로 본뜨면 `newBotToken` 도 기계적으로 optional 로 문서화될 수 있는데, 그러면 OpenAPI 계약이 스펙 문서·컨트롤러 실제 검증(누락 시 400)과 어긋난다. Rationale 위반은 아니지만 "선례를 형태까지 통째로 복사"할 때 실수하기 쉬운 지점이라 암묵적 가정 충돌 관점에서 짚어 둔다.
  - 제안: `newBotToken` 필드는 `@ApiProperty(...)`(required, `@ApiPropertyOptional` 아님)로 선언해 §5.4 문면과 일치시킬 것. 캐너리 ③(렌더된 스키마) 항목에 `required` 배열 포함 여부 단언을 추가하면 이 회귀를 구조적으로 막는다.

- **[INFO]** 정합 확인 완료 — 재기각 대안 재도입 없음 (근거 기록용, 조치 불필요)
  - 아래는 이번 검토에서 대조했고 **충돌이 없음을 확인**한 지점들이다. 다음 리뷰어가 같은 조사를 반복하지 않도록 남긴다.
    1. **검증 파이프 우회 패턴 재사용** — plan 이 `@Body()` 를 인라인 타입으로 유지해 `CustomValidationPipe.toValidate()` 를 건너뛰는 것은 `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts` 의 확립된 선례(및 그 캐너리 `workflows-execute-body.spec.ts`)를 그대로 따른 것이지 새로운 우회가 아니다. 그 선례 자체가 "명시적으로 검증 안 함" 을 문서화한 결정이라 재도입 문제가 아니다.
    2. **`receiveWebhook` 스키마 미고정** — plan 이 `receiveWebhook` 본문을 `type` 없이 자유 스키마로 광고하기로 한 것은 `12-webhook.md` 가 반복해서 규정하는 "webhook body 는 외부 시스템이 저작한다"(§WH-EP-05, EIA §R17 인용)는 원칙과 정렬되고, `swagger.md` §1-4 의 "열린/동적 map" 허용 사유(진짜 키가 열려 있는 경우)에도 부합한다.
    3. **`formData: unknown` 개방형 스키마** — `ContinueExecutionRequestDto.formData` 를 열린 map 으로 문서화하는 것도 같은 §1-4 원칙(노드 타입/폼 필드별 자유 payload)의 정당한 적용이지, "번거로움 회피" 예외 오남용이 아니다.
    4. **전역 가드 유예** — plan 의 "안 하는 것" 절이 "`@Body()` 가 클래스가 아니면 `@ApiBody` 필수" 라는 전역 규칙을 이번 PR 로 세우지 않고 트래커에 등재만 하는 것은, `swagger.md` Rationale 이 `deprecated` 패턴에 대해 명시한 *"사례가 하나뿐이다. rule of three 를 채우기 전에 규칙으로 올리면 다음 사례가 이 형태와 다를 때 규칙이 먼저 틀린다"* 는 원칙과 같은 방향이다 — 오히려 그 원칙을 재확인하는 선택이다.
    5. **DTO 이름 패턴** — `ChatChannelRotateBotTokenRequestDto` / `ContinueExecutionRequestDto` 의 `RequestDto` 접미는 저장소에 이미 존재하는 명명 관례(`ReRunRequestDto`, `AssistantMessageRequestDto`, `EmailChangeRequestDto`)와 일치하고, §1-7 의 `Update` 접두 규칙(top-level PATCH 바디 전용) 대상도 아니다 — 규칙 오적용 없음.
    6. **`chat_channel_token_v2`/§5.4.1 single-path 정책과의 관계** — 이번 변경은 R-CC-10(bot token 변경 single-path), CCH-SE-04-C(v2 정리 스케줄) 등 회전 정책 자체를 건드리지 않는다. 요청 스키마만 광고할 뿐 `rotateBotToken` 핸들러의 로직·검증 순서는 그대로이므로 그 결정들과 충돌하지 않는다.

## 요약

이번 plan 은 `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts` 가 세운 "문서 전용 DTO + `@Body()` 인라인 유지" 선례를 두 라우트로 정직하게 확장하고, 세 번째 라우트(webhook)는 그 선례가 아니라 webhook spec 자체의 "외부 발신자가 형태를 정한다" 원칙을 따르는 등, 관련된 모든 `## Rationale` 결정(검증 파이프 우회, 열린 map 허용 기준, rule-of-three 유예 원칙, DTO 명명 관례, bot token single-path 정책)과 충돌 없이 정렬돼 있다. 유일하게 짚을 지점은 `newBotToken` 필드가 swagger.md §1-5 가 명시적으로 "의무"로 못박은 secret-plaintext `writeOnly` 표시 대상인데 plan 실측 표·본문 어디에도 이 처리가 언급되지 않는다는 점이다 — 선례(`ExecuteWorkflowDto`)엔 secret 필드가 없어 이 의무를 상기시켜 줄 참조점이 없었을 가능성이 높다. 이는 과거 결정의 "무근거 번복"이라기보다 "선례를 형태까지 그대로 복사할 때 생기는 누락 위험"에 가까우며, CRITICAL 이 아니라 구현 단계에서 손쉽게 닫을 수 있는 WARNING 이다. required 여부 관련 INFO 도 같은 성격의 주의사항이다.

## 위험도
LOW
