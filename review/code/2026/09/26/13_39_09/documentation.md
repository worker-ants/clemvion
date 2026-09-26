# 문서화(Documentation) Review

## 발견사항

- **[INFO]** `scanHttpStatusAdvertised` 함수 JSDoc 이 새 반환 필드 `unadvertised` 를 언급하지 않는다
  - 위치: `codebase/backend/src/repo-guards/__tests__/http-status-advertised-guard.ts` — 함수 `scanHttpStatusAdvertised` 바로 위 JSDoc(게이트 293~303행)
  - 상세: 이 diff 로 `HttpStatusScan` 에 `unadvertised`(성공 응답을 하나도 광고하지 않는 라우트) 필드가 새로 추가됐고, 그 필드 자체의 인라인 JSDoc(게이트 159~161행)은 잘 쓰여 있다. 하지만 함수 레벨 요약 JSDoc("`*.controller.ts` 들에서 **광고한 성공 코드가 실제 성공 코드를 담지 않는** 핸들러를 찾는다.")은 여전히 위반(violation) 탐지만 서술하고, 이번에 추가된 두 번째 책임(광고 자체가 없는 라우트 탐지)은 적혀 있지 않다. 같은 패턴이 `judgeHandler` 함수 JSDoc(게이트 210~213행, "핸들러 하나를 판정한다...")에도 있다 — 반환 객체에 `unadvertised` 필드가 새로 생겼는데 함수 설명은 이를 언급하지 않는다.
  - 제안: 두 함수 JSDoc 에 "성공 광고가 하나도 없는 라우트도 `unadvertised` 로 함께 보고한다" 한 문장을 추가하면 필드 문서와 함수 문서가 정합해진다. 우선순위는 낮음 — 인터페이스 필드 자체의 문서화(`HttpStatusUnadvertised`, `HttpStatusScan.unadvertised`)와 spec(`swagger.md` §2-4), CHANGELOG, 테스트 스펙 상단 설명이 이미 이 기능을 정확히 설명하고 있어 정보 손실은 없다.

## 점검 관점별 확인 결과 (문제 없음)

- **독스트링/JSDoc**: 새로 추가된 공개 함수·클래스 대부분이 적절한 문서를 갖췄다. `wrapNullableDataSchema`/`ApiOkWrappedNullableResponse`(`codebase/backend/src/common/swagger/api-wrapped.ts`)는 OpenAPI 3.0 의 `$ref`+형제 키 무시 이슈와 `api-convention §5.4` 근거를 정확히 인용한다(§5.4 본문 확인 — "기본은 `null`" 규칙과 부합). `WebAuthnAvailabilityDto`, `NotificationRotateSecretDto`, `InteractionRevokeTokenDto`, `AssistantSessionDto` 계열 DTO 모두 필드 단위 JSDoc + `@ApiProperty` description 을 갖췄다.
- **내부 서사 vs 공개 문서 분리**: `trigger-secret-issue-response.dto.ts` 와 `assistant-session-response.dto.ts` 는 "JSDoc 은 공개 OpenAPI `description` 으로 나간다"는 `spec/conventions/swagger.md §3`(직접 확인함 — "JSDoc 은 공개 OpenAPI 로 나간다" 절 존재)의 규약을 정확히 따라, 내부 설계 근거(예: 도구 인자를 닫힌 union 으로 다시 적지 않는 이유)는 `//` 주석에, 소비자용 설명은 `/** */` 에 분리해 두었다. 규약 인용이 실측과 일치한다.
- **주석 정확성**: `http-status-advertised-guard.ts` 의 수정된 주석 — "이 패키지는 `Api*Response` 데코레이터를 50개 가까이 내보내고 그중 2xx 만 일곱이다" — 를 `@nestjs/swagger` 런타임에서 직접 재현해 확인한 결과 총 49개, 2xx 는 정확히 7개(`ApiOkResponse`/`ApiCreatedResponse`/`ApiAcceptedResponse`/`ApiNonAuthoritativeInformationResponse`/`ApiNoContentResponse`/`ApiResetContentResponse`/`ApiPartialContentResponse`)로 문구가 정확했다. `trigger-secret-issue-response.dto.ts` 의 "둘 다 새 비밀을 평문으로 한 번만 돌려준다(`triggers.controller.ts` 의 `@ApiOperation` 설명)" 주석도 실제 `triggers.controller.ts` 의 두 `@ApiOperation` description 과 일치한다. `assistant-session-response.dto.ts` 의 필드 주석(`toolCalls`, `planStepId`/`planStepIds`, `AUTO_RESUME_REASONS`)은 대응 엔티티(`workflow-assistant-message.entity.ts`, `workflow-assistant-session.entity.ts`)의 주석·타입과 그대로 일치한다.
- **CHANGELOG**: `CHANGELOG.md` 상단에 이미 "OpenAPI 가 11개 엔드포인트의 성공 응답 스키마를 광고한다"와 "저장소 가드 강화: 라우트는 성공 응답을 하나 이상 광고한다" 두 항목이 등재돼 있어(선행 커밋 `ef6037dcb`), 이번 변경 범위(제품 동작 변화 + 가드 신설)가 규약(`CHANGELOG.md` 상단 "무엇이 항목을 만드는가")에 맞게 커버된다. 누락 없음.
- **spec 인용 정확성**: `wrapNullableDataSchema` 의 `api-convention §5.4`, `http-status-advertised.spec.ts`/`api-wrapped.ts` 의 `swagger.md §2-4`·`§5-2` 인용을 각각 spec 파일에서 직접 대조했고 모두 실재 절과 일치했다.
- **API 문서**: 응답 스키마가 없던 11개 엔드포인트에 `@ApiOkWrappedResponse`/`ApiOkWrappedNullableResponse`/`ApiOkWrappedArrayResponse`/`ApiCreatedWrappedResponse`/`ApiNoContentResponse`/`ApiOkResponse` 가 정확히 매칭되는 방식으로 붙었다 — OpenAPI 출력이 실제 응답과 맞는지는 새 e2e(`advertised-response-contract.e2e-spec.ts`, `workflow-assistant.e2e-spec.ts`, `chat-channel-trigger-create.e2e-spec.ts`의 `assertMatchesContract`)로 별도 검증되고 있어 "문서만 있고 검증이 없는" 상태가 아니다.
- **예제 코드/설정 문서**: 새 환경 변수나 설정 옵션은 없다. README 갱신이 필요한 사용자 대면 기능 변화도 없다(OpenAPI 문서 자체가 산출물).
- **테스트 내 주석**: `http-status-advertised.spec.ts` 상단의 장문 설명(«왜 이 가드인가», 실측 수치, `@Res()` 면제 논의)과 `sample.controller.ts` 픽스처의 자리별 주석이 diff 로 추가된 리다이렉트/302 케이스까지 정확히 서술한다.

## 요약

이번 변경은 문서화 관점에서 전반적으로 매우 견고하다 — 새로 추가된 DTO·swagger 헬퍼·가드 로직 모두 JSDoc/인라인 주석이 충실하고, spec·CHANGELOG 인용을 실측으로 대조해 본 결과 전부 정확했다(50개 중 2xx 7개 수치 재현 포함). CHANGELOG 항목도 이미 두 건 등재돼 규약을 충족한다. 유일하게 발견한 항목은 `http-status-advertised-guard.ts` 의 두 함수(`scanHttpStatusAdvertised`, `judgeHandler`) 최상위 JSDoc 이 이번에 추가된 `unadvertised` 책임을 반영하지 못한 사소한 서술 누락으로, 인터페이스 필드 자체의 문서와 spec/CHANGELOG/테스트 설명이 이를 충분히 보완하고 있어 실질적 정보 손실은 없다.

## 위험도

LOW
