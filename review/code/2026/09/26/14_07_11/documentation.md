# 문서화(Documentation) Review

## 발견사항

- **[WARNING]** CHANGELOG 의 `workflow-assistant 세션` 항목이 실제 라우트 경로에서 모듈 세그먼트(`workflow-assistant/`)를 빠뜨려, 같은 항목의 다른 불릿과 다른 축약 규칙을 쓴다
  - 위치: `CHANGELOG.md:31`–`33` (`## Unreleased — OpenAPI 가 11개 엔드포인트의 성공 응답 스키마를 광고한다` 항목, 첫 불릿)
  - 상세: 이 불릿은 `GET /sessions` · `GET /sessions/latest` · `GET /sessions/:id` · `POST /sessions` · `PATCH /sessions/:id` · `DELETE /sessions/:id` 로 적었다. 그런데 실제 컨트롤러는 `@Controller('workflow-assistant')`(`codebase/backend/src/modules/workflow-assistant/workflow-assistant.controller.ts`)이라 전체 경로는 `/api/workflow-assistant/sessions` 등이다. 같은 CHANGELOG 항목의 나머지 세 불릿은 모두 모듈 세그먼트를 포함한 전체 상대 경로를 쓴다 — `GET /auth/2fa/webauthn/availability`(`@Controller('auth/2fa/webauthn')`), `POST /triggers/:id/notification/rotate-secret`(`@Controller('triggers')`), `GET /external/executions/:executionId/stream`(`@Controller('external/executions')`). 즉 이 항목 안에서 workflow-assistant 불릿만 규칙이 다르다 — 그룹 라벨("**workflow-assistant 세션**")에 기대어 모듈 세그먼트를 생략한 것으로 보이지만, 다른 불릿(예: "**WebAuthn**" 라벨 뒤에도 `auth/2fa/webauthn/...` 를 다시 온전히 적음)과 비교하면 일관성이 깨진다. CHANGELOG 를 보고 엔드포인트를 직접 두드려 보려는 사람이 `GET /api/sessions` 로 요청하면 404 를 받는다.
  - 제안: `GET /workflow-assistant/sessions` · `GET /workflow-assistant/sessions/latest` · `GET /workflow-assistant/sessions/:id` · `POST /workflow-assistant/sessions` · `PATCH /workflow-assistant/sessions/:id` · `DELETE /workflow-assistant/sessions/:id` 로 모듈 세그먼트를 채워 다른 세 불릿과 같은 축약 규칙(전체 `/api` prefix 는 생략, 모듈+서브라우트는 포함)을 맞춘다.

## 점검 관점별 확인 결과 (문제 없음)

- **독스트링/JSDoc**: 신규 공개 함수·클래스·DTO 전부 적절한 문서를 갖췄다. `wrapNullableDataSchema`/`ApiOkWrappedNullableResponse`(`codebase/backend/src/common/swagger/api-wrapped.ts`)의 JSDoc 이 인용하는 `api-convention §5.4`(부재 표현 — `null` vs 키 생략)를 직접 열어 대조했고 일치했다. `AssistantSessionDto`/`AssistantMessageDto`/`AssistantToolCallDto`/`AssistantPlanDto`/`AssistantPlanStepDto`/`AssistantUsageDto`/`AssistantSessionDetailDto`(`assistant-session-response.dto.ts`) 는 필드마다 JSDoc + `@ApiProperty` description 을 갖췄고, 각 필드의 nullable·optional 서술을 대응 엔티티(`workflow-assistant-message.entity.ts` — `toolCalls: jsonb nullable`, `PLAN_STEP_ACTIONS`/`AssistantStepAction` export)와 대조해 정확함을 확인했다.
- **이전 라운드 문서화 지적 사항 해소 확인**: `review/code/2026/09/26/13_39_09/documentation.md` INFO(«`scanHttpStatusAdvertised`/`judgeHandler` JSDoc 에 `unadvertised` 책임 미기술»)는 `RESOLUTION.md` 가 적은 대로 해소됐다 — 현재 `http-status-advertised-guard.ts` 의 `scanHttpStatusAdvertised`(335~336행 부근) 와 `judgeHandler`(275~277행 부근) JSDoc 모두 "성공 응답을 하나도 광고하지 않는 라우트는 `unadvertised` 로 함께 보고한다" 문장을 담고 있다. 같은 파일 `swaggerResponseStatuses` 위 JSDoc 의 수치 오기(트래커 `spec-draft-nullable-notation-followups.md:5126`, `/ai-review` `10_23_50` documentation W2 — "2xx 데코레이터를 50개 가까이 내보낸다"는 틀렸고 "`Api*Response` 가 50개 가까이, 그중 2xx 는 일곱")도 이번 plan(`success-advert.md:14`)이 예고한 대로 "`Api*Response` 데코레이터를 50개 가까이 내보내고 그중 2xx 만 일곱이다"로 정정돼 있다 — 트래커가 참조하는 구 문구는 더 이상 존재하지 않는다.
- **트리거 반환 타입 DTO 화**: 이전 라운드 INFO14(`triggers.controller.ts` 두 핸들러가 인라인 리터럴 타입 유지) 도 해소됨 — 현재 `Promise<NotificationRotateSecretDto>` / `Promise<InteractionRevokeTokenDto>` 로 좁혀져 있고, 같은 파일 `rotateBotToken` 의 확립된 관례와 일치한다.
- **테스트 사각지대(이전 WARNING) 해소**: `workflow-assistant.e2e-spec.ts` 테스트 H 가 메시지 두 건(선택 키 전부 빠진 user · 선택 키 전부 채운 assistant, `title: null` 세션)을 DB 에 직접 넣고 `assertMatchesContract(AssistantSessionDetailDto)` 로 대조하며, 대조 전에 `toStrictEqual` 로 심은 값이 그대로 왔는지 먼저 확인해 공허하지 않다.
- **CHANGELOG**: `CHANGELOG.md` 상단 "무엇이 항목을 만드는가" 기준(제품 동작 변화 / 개발 흐름 변화)에 맞춰 두 항목이 정확히 분리돼 있다 — "OpenAPI 가 11개 엔드포인트의 성공 응답 스키마를 광고한다"(제품 동작·API 계약 변화)와 "저장소 가드 강화"(개발 흐름 — 가드를 조임)는 서로 다른 성격이라 항목을 나눈 것이 규약과 맞다. 11개 엔드포인트 수·구성(workflow-assistant 6 · WebAuthn 2 · 트리거 2 · EIA 1)도 실제 diff·plan 실측표와 정확히 일치한다(위 WARNING 하나 제외).
- **spec 인용 정확성**: `wrapNullableDataSchema`/`api-wrapped.spec.ts`/`http-status-advertised.spec.ts`/`triggers.controller.ts` 등에서 인용하는 `spec/conventions/swagger.md §2-4`·`§5-2`, `api-convention §5.4` 절이 모두 실재하고 인용 문구와 절 내용이 일치했다.
- **주석 정확성**: `WebAuthnAvailabilityDto` 의 "서버에 `WEBAUTHN_RP_ID` · `WEBAUTHN_ORIGIN` 이 설정돼 WebAuthn 을 쓸 수 있는가" 설명을 `webauthn.service.ts` 의 `isEnabled()` JSDoc("`WEBAUTHN_RP_ID` + `WEBAUTHN_ORIGIN` 모두 설정되어 있어야 true")과 대조해 정확함을 확인했다. `sample.controller.ts` fixture 의 리다이렉트 주석("리다이렉트만 광고한 라우트는 2xx 짝을 대조하지 않는다")도 새로 추가된 두 fixture 핸들러의 실제 동작과 일치한다.
- **예제 코드/설정 문서**: 새 환경 변수·설정 옵션 없음(WebAuthn 관련 env 는 기존 것 재사용). README 갱신이 필요한 사용자 대면 기능 변화도 없다.

## 요약

이번 변경은 문서화 관점에서 전반적으로 견고하다 — 이전 라운드(`13_39_09`)의 documentation INFO(가드 JSDoc 의 `unadvertised` 미기술)와 관련된 다른 카테고리의 WARNING/INFO(테스트 사각지대, DTO 반환 타입 미적용, 가드 수치 오기)가 모두 이번 커밋(`bf1fa96fc` 등)에서 실제로 해소됐음을 코드 대조로 확인했다. 새로 발견한 것은 CHANGELOG `workflow-assistant 세션` 불릿이 같은 항목의 다른 세 불릿과 달리 라우트의 모듈 세그먼트(`workflow-assistant/`)를 빠뜨려, 전체 경로가 `/api/sessions` 로 오독될 수 있는 표기 불일치 하나(WARNING)뿐이다. CRITICAL 급 발견사항은 없다.

## 위험도

LOW
