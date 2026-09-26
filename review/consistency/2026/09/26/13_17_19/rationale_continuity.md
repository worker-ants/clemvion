# Rationale 연속성 검토 — success-advert (성공 응답 광고 11곳)

## 검토 범위

- `plan/in-progress/success-advert.md`
- `spec/conventions/swagger.md` (§2-4 · §5-2 `ApiOkWrappedNullableResponse` · §1-4 · §1-5 · §5-1, 커밋 `24084fd0e` 반영 후)
- `spec/5-system/2-api-convention.md` §5.4 · «검증 층»
- `spec/3-workflow-editor/4-ai-assistant.md` (REST API §6, 도구 정의 §4, Rationale)
- `spec/2-navigation/2-trigger-list.md` Rationale (R-2/R-14)
- `spec/5-system/14-external-interaction-api.md` (EIA-NX-12 / EIA-AU-07)
- 실제 엔티티: `workflow-assistant-session.entity.ts` · `workflow-assistant-message.entity.ts`
- 프런트 타입: `codebase/frontend/src/lib/api/assistant.ts`
- 구현 초안(저장소 밖): `assistant-session-response.dto.ts` · `trigger-secret-issue-response.dto.ts`

## 발견사항

- **[WARNING]** Assistant `tool_calls[*].arguments`/`result` 를 `additionalProperties: true` 로 여는 근거가 §1-4 가 명시적으로 기각한 논리와 표면적으로 겹친다
  - target 위치: (저장소 밖 구현 초안) `assistant-session-response.dto.ts` `AssistantToolCallDto.arguments`/`result` 및 그 위 `//` 주석("도구마다 인자 스키마가 달라 키 집합이 런타임에 정해진다 — `swagger.md` §1-4 «열린/동적 map»") — plan 의 "방향" §3항("도구 호출의 `arguments`·`result` 는 열린 객체")도 동일 근거를 반복
  - 과거 결정 출처: `spec/conventions/swagger.md` §1-4 Rationale "§1-4 닫힌 union 을 `additionalProperties` 로 뭉개지 않는다" — *"열림"은 키 집합이 런타임에 결정된다는 사실 진술이지, 타입을 적기 번거롭다는 편의 표현이 아니다*, 그리고 §1-4 본문 "**"타입을 특정하기 번거롭다"는 사유로 쓰지 않는다** — variant 집합이 코드로 확정되면 위 닫힌 union 항목이 맞다"
  - 상세: Assistant 의 도구 집합은 16개로 **코드로 확정**돼 있고(`tool-definitions.ts`), 각 도구의 인자·반환 형태는 같은 spec(`4-ai-assistant.md` §4.1~§4.4)에 인터페이스 수준까지 **전부 문서화**돼 있다 — `get_execution_details` 의 `ExecutionDetailsResponse`, `add_node`/`update_node` 의 `{ok, id?, ports?, error?, pendingUserConfig?}` 등. 이는 EIA `context` 가 걸렸던 "variant 집합이 코드로 확정된 필드" 케이스와 구조적으로 동일하다 — §1-4 가 그 사례를 근거로 "닫힌 union 을 열린 map 으로 뭉개지 말라"를 규약화했다. 초안 주석의 "키 집합이 런타임에 정해진다"는 문구는, 실제로는 "도구 이름이라는 판별자에 따라 갈리는, 각각은 고정된 스키마"를 설명하고 있어 §1-4 가 금지한 "번거로움" 프레이밍과 결과적으로 같은 모양이 된다.
    다만 실측상 완화 요인이 있다 — 엔티티 `AssistantToolCallRecord.arguments: Record<string, unknown>` / `result?: unknown` 과 프런트 `lib/api/assistant.ts` 의 동일 타입이 **이미 양쪽 다 미분화**로 선언돼 있어(EIA 사례처럼 한쪽만 몰래 더 좁은 타입을 선언해 drift 가 생기는 구도가 아님), open map 선택이 실무적으로는 방어 가능하다. 문제는 **그 방어 논리가 draft 주석에 적혀 있지 않다**는 것 — 지금 문구는 §1-4 가 "쓰지 않는다"고 명시한 사유와 구별되지 않는다.
  - 제안: draft DTO 주석(또는 `swagger.md` §1-4 Rationale 추가 문단)에 실제 근거를 명시적으로 옮겨 적을 것 — 예: "엔티티·프런트 타입이 이미 `Record<string, unknown>`/`unknown` 으로 미분화돼 있어 EIA `context` 사례처럼 독립적으로 더 좁게 선언한 소비처가 없다(따라서 SDK narrowing drift 위험이 없다)" 또는 §1-4 의 "SoT 이중화 회피" 예외 형식을 빌려 "형태는 `4-ai-assistant.md` §4 도구 표가 SoT" 라고 명시. 둘 중 하나로 바꾸지 않으면 다음 리뷰에서 "§1-4 위반"으로 재지적될 소지가 크다(swagger.md §1-4 자신이 "번거로움" 사유를 쓰지 말라고 특정했으므로).

- **[INFO]** `notification/rotate-secret` · `interaction/revoke-token` 응답 DTO 는 기각된 R-2 가 아니라 살아있는 EIA-NX-12/EIA-AU-07 을 그대로 문서화한다 — 재확인 기록
  - target 위치: (저장소 밖 구현 초안) `trigger-secret-issue-response.dto.ts` `NotificationSecretRotatedDto.secret` · `PerTriggerInteractionTokenDto.token`
  - 과거 결정 출처: `spec/2-navigation/2-trigger-list.md` R-2("Webhook HMAC secret 입력 vs. rotate 분리 — **폐기, R-14 로 대체**") vs `spec/5-system/14-external-interaction-api.md` EIA-NX-12/EIA-AU-07
  - 상세: R-2 는 인바운드 webhook HMAC 자격증명 회전(`/auth/rotate-secret`, `config.hmacSecret` 경로)을 다루며 이는 **신설되지 않은 채 폐기**됐고 `POST /api/auth-configs/:id/regenerate` 로 일원화됐다(R-14). 이번 plan 이 광고를 채우는 두 라우트(`:id/notification/rotate-secret`, `:id/interaction/revoke-token`)는 R-2 가 다루던 자원이 **아니라** EIA 아웃바운드 notification secret / per-trigger interaction token 회전으로, EIA-NX-12("응답에 새 secret 을 1회 평문 반환하는 특권 작업")·EIA-AU-07 이 이미 확정한 기능이며 컨트롤러(`triggers.controller.ts`)에 이미 구현돼 있다. draft DTO 의 `secret`/`token` 평문 1회 반환은 이 기존 결정을 정확히 미러링한다 — 기각된 대안 재도입이 아니다.
  - 제안: 별도 조치 불요. 다만 R-2 표제가 "Webhook HMAC secret 입력 vs. rotate 분리"라 이름이 비슷한 두 rotate 엔드포인트를 혼동하기 쉬우므로, `swagger.md` 또는 plan 문서에 "이 rotate 는 R-2 가 아니라 EIA-NX-12 대상"이라는 각주를 남겨두면 다음 사람의 재조사 비용을 줄인다.

- **[INFO]** 세션 응답 DTO 구성은 실제 서비스 반환 모양·`§1-4`/`§5.4` 의 optional-vs-nullable 구분을 정확히 따른다 — 위반 없음, 참고용 기록
  - target 위치: draft `AssistantSessionDto`/`AssistantSessionDetailDto`/`AssistantToolCallDto` 등
  - 과거 결정 출처: `spec/5-system/2-api-convention.md` §5.4 · `spec/conventions/swagger.md` §1-4 nullable 판단 근거
  - 상세: `findDetail()` 실제 반환 `{ session, messages }`, `findLatestActive()` 의 `Session | null` 이 새로 도입되는 `ApiOkWrappedNullableResponse` 대상과 정확히 일치. `title`/`llmConfigId` 등 nullable-but-present 컬럼은 `@ApiProperty({ nullable: true })`, `planStepId`/`signature`/`result` 등 진짜 key-absent 필드는 `@ApiPropertyOptional()` 로 정확히 갈라 §5.4·§1-4 가 지적했던 오용 패턴(“null 상시 필드에 `@ApiPropertyOptional`”)을 반복하지 않는다.
  - 제안: 조치 불요.

## 요약

핵심 변경(§2-4 "성공 응답 최소 1개 광고", §5-2 `ApiOkWrappedNullableResponse", §5-4 403 코드 강제)은 swagger.md 자신의 신규 Rationale(2026-09-26 항목 둘)에 근거를 갖추고 있고, `api-convention §6` 미명문화 갭도 트래커(`spec-draft-nullable-notation-followups.md`)에 정식 등재돼 무근거 누락이 아니다. trigger secret/token rotate 응답은 기각된 R-2 가 아니라 살아있는 EIA-NX-12/EIA-AU-07 을 미러링해 재도입 리스크가 없고, 세션 응답 DTO 는 §1-4/§5.4 의 nullable-vs-optional 구분을 정확히 따른다. 유일한 연속성 리스크는 Assistant `tool_calls.arguments`/`result` 를 여는 근거 문구가 §1-4 가 명시적으로 "쓰지 않는다"고 못박은 "타입 특정이 번거롭다" 류 프레이밍과 표면적으로 구별되지 않는다는 점이다 — 실무적으로는 엔티티·프런트 타입이 이미 동일하게 미분화돼 있어 방어 가능하지만, 그 방어 논리가 문서화돼 있지 않아 다음 리뷰에서 재지적될 여지가 있다.

## 위험도

LOW
