# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** `AssistantSessionDetailDto` 를 위해 새 DTO 파일 하나에 7개 클래스(약 265줄)를 신설 — 목표(성공 응답 미광고 11개 라우트에 광고 추가) 대비 상세도가 높다
  - 위치: `codebase/backend/src/modules/workflow-assistant/dto/responses/assistant-session-response.dto.ts` (신규 파일, `AssistantSessionDto` · `AssistantToolCallDto` · `AssistantPlanStepDto` · `AssistantPlanDto` · `AssistantUsageDto` · `AssistantMessageDto` · `AssistantSessionDetailDto`)
  - 상세: 이번 작업의 명목상 목표는 "성공 응답을 광고하지 않던 11개 라우트에 응답 스키마 추가"(커밋 `b98dfe1da`)다. `workflow-assistant.controller.ts` 의 `findOne`(세션 상세, 메시지 포함)에 `@ApiOkWrappedResponse(AssistantSessionDetailDto, …)` 를 붙이려면 `AssistantSessionDetailDto.messages: AssistantMessageDto[]` 가 필요하고, `AssistantMessageDto` 는 다시 `toolCalls: AssistantToolCallDto[]`, `plan: AssistantPlanDto | null`, `usage: AssistantUsageDto | null` 을 갖고 있어 연쇄적으로 5개 보조 DTO 가 더 필요해진 구조다. 파일 내 주석("맞는지는 e2e 가 `assertMatchesContract` 로 본다 — 선언되지 않은 키가 응답에 있으면 실패한다")이 이 상세도가 필요한 이유(api-convention §5.4 검증 층)를 설명하고, 실제로 `workflow-assistant.e2e-spec.ts` 에서 `findOne`/`list`/`update`/`latest` 응답을 이 DTO들로 `assertMatchesContract` 검증한다 — 즉 죽은 코드가 아니라 전부 소비된다. 컨트롤러 쪽에서 새로 import 한 것도 `AssistantSessionDetailDto`·`AssistantSessionDto` 둘뿐이라 불필요한 import 노출도 없다. 다만 "1개 라우트 광고"라는 명목 작업치고는 모델링 범위가 넓어(엔티티 전체를 pass-through 하는 라우트라 불가피한 면은 있음) 원 스코프 판단자가 의도했던 범위인지 확인이 필요하다.
  - 제안: 이 파일의 DTO 세분화가 계획서(`plan/in-progress/success-advert.md` 또는 후속 `spec-draft-*`)에 명시적으로 예견됐는지 확인. 예견되지 않았다면 "세션 상세 응답의 전체 계약화"가 원래 계획의 암묵적 필요조건이었음을 plan에 기록해 두는 것을 권장(사후 정당화이지만 근거가 코드 주석에 이미 있으므로 위험도는 낮음).

- **[INFO]** 가드 파일의 기존 문서 주석 재작성(신규 로직과 무관해 보이는 문구 순서 변경)
  - 위치: `codebase/backend/src/repo-guards/__tests__/http-status-advertised-guard.ts` — `swaggerResponseStatuses` 함수 위 JSDoc (게이트 46~50줄 부근, diff 상 "이름 → 코드 표를 손으로 쓰지 않는 이유…" 문단)
  - 상세: 기존 문장 "…50개 가까이 내보낸다"를 "…50개 가까이 내보내고 그중 2xx 만 일곱이다(…포함)"로 재작성했다. 순수 문구 다듬기처럼 보이지만, 이번 PR 이 추가한 `isRedirect`/`unadvertised` 판정 로직이 "2xx 대 3xx" 구분을 다루므로, 그 구분을 뒷받침하는 통계치("2xx 만 일곱")를 정확히 밝히는 방향으로 실질 변경과 함께 움직인 것으로 보인다. 무관한 리팩토링이 아니라 이번 로직 변경에 종속된 정정으로 판단됨.
  - 제안: 없음(참고용 기록). 이 문구의 "일곱"이라는 수치가 실측인지 별도 정확성 검토는 code-quality/correctness 리뷰어 몫.

- 그 외 13개 파일(`api-wrapped.ts`/`.spec.ts`, `webauthn-response.dto.ts`, `webauthn.controller.ts`, `interaction-stream.controller.ts`, `trigger-secret-issue-response.dto.ts`, `triggers.controller.ts`, `workflow-assistant.controller.ts`, `sample.controller.ts` fixture, `http-status-advertised.spec.ts`, `advertised-response-contract.e2e-spec.ts`, `chat-channel-trigger-create.e2e-spec.ts`, `workflow-assistant.e2e-spec.ts`)는 모두 "성공 응답 미광고 11개 라우트 광고" + "가드에 unadvertised/redirect 판정 추가" + "새 DTO 의 e2e 계약 검증" 세 축에 정확히 대응한다. 포맷팅·주석·임포트 변경은 실질 변경에 종속된 최소 diff였고(예: `webauthn.controller.ts`·`chat-channel-trigger-create.e2e-spec.ts` 는 프롬프트에서 전체 컨텍스트가 잘려 있었으나 `git diff` 로 직접 대조해 diff 와 정확히 일치함을 확인, 숨은 변경 없음), 무관한 파일 수정이나 불필요한 리팩토링, 기능 확장(over-engineering)은 발견되지 않았다.

## 요약

변경 범위는 커밋 메시지가 밝힌 목표("성공 응답을 광고하지 않던 11개 라우트에 응답 스키마·가드 추가", "http-status-advertised 가드에 302 리다이렉트 대조군 강화")와 정확히 일치한다. 15개 리뷰 대상 파일 모두 이 두 축(신규 DTO/데코레이터 배선, 가드의 unadvertised/redirect 판정 확장) 및 그에 대한 e2e 계약 검증으로 설명 가능하며, 무관한 리팩토링·포맷팅 뒤섞임·불필요한 임포트·설정 변경은 없다. 유일하게 주목할 점은 `assistant-session-response.dto.ts` 가 "라우트 하나 광고"치고 상당히 큰 신규 파일(7개 클래스, 265줄)이라는 것인데, 이는 세션 상세 라우트가 중첩된 메시지·도구호출·계획·사용량 구조를 그대로 반환하고 이를 `assertMatchesContract` 로 엄격 검증하기 때문에 불가피한 부수효과로 보인다(코드 주석·e2e 테스트가 필요성을 뒷받침). 스코프 이탈로 단정할 근거는 없으나 사후 확인 차원의 INFO로 기록한다. `git diff origin/main --stat` 로 확인한 결과 `CHANGELOG.md`·`plan/**`·`spec/conventions/swagger.md`·`review/consistency/**` 등 비-코드 산출물도 함께 바뀌었으나, 이는 본 리뷰 대상(15개 코드 파일) 밖이며 이 프로젝트 관례상 기능 변경에 수반되는 정상적인 동반 문서다.

## 위험도

LOW
