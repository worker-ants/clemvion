# 변경 범위(Scope) 리뷰 — success-advert (11개 엔드포인트 성공 응답 스키마 광고 · 가드 강화, `origin/main` 대비 50개 파일)

## 발견사항

- **[INFO]** `AssistantSessionDetailDto` 계열 신규 DTO 파일이 목표(라우트 11곳에 성공 응답 광고 추가) 대비 상세도가 크다(7개 클래스, 265줄) — 이미 직전 리뷰 라운드에서 지적·수용된 사항
  - 위치: `codebase/backend/src/modules/workflow-assistant/dto/responses/assistant-session-response.dto.ts` (신규 파일 — `AssistantSessionDto`·`AssistantToolCallDto`·`AssistantPlanStepDto`·`AssistantPlanDto`·`AssistantUsageDto`·`AssistantMessageDto`·`AssistantSessionDetailDto`)
  - 상세: `git diff origin/main...HEAD` 로 직접 열어 대조한 결과, `findOne`(세션 상세, 메시지 포함) 라우트 하나에 응답 스키마를 붙이려면 `messages: AssistantMessageDto[]` → `toolCalls`/`plan`/`usage` 로 연쇄적으로 5개 보조 DTO 가 필요해지는 구조다. 컨트롤러가 새로 import 한 것도 `AssistantSessionDto`·`AssistantSessionDetailDto` 둘뿐이고, 나머지 5개 DTO 는 전부 `AssistantSessionDetailDto` 내부에서만 소비된다(죽은 코드 아님, `workflow-assistant.e2e-spec.ts` 테스트 H 가 `assertMatchesContract` 로 전 계층을 대조). `plan/in-progress/success-advert.md` 실측 표가 "세션 상세 · 메시지 + 중첩 셋"을 처방으로 미리 적어 뒀고(계획 단계부터 예견), 같은 파일이 직전 `/ai-review` 라운드(`review/code/2026/09/26/13_39_09/scope.md`)에서도 동일하게 INFO 로 지적됐으며 `RESOLUTION.md`(INFO6)에 "plan 실측 표가 이미 처방으로 적었다"로 조치 불필요 처리됐다. 새로 등장한 스코프 이탈은 아니다.
  - 제안: 조치 불필요 — 재확인만. 라우트 하나의 응답 모양이 엔티티 그대로(pass-through)라 불가피한 크기다.

- **[INFO]** `spec-draft-nullable-notation-followups.md` 에 이번 작업 중 발견한 무관 spec 갭 2건(`GET sessions/latest` API 표 누락, `revoke-token` 상태 전이 서술 상충)이 코드 변경 없이 트래커 항목으로만 추가됨
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (파일 끝 두 항목)
  - 상세: 둘 다 `--impl-prep`(`review/consistency/2026/09/26/13_17_19`) 에서 나온 W1·W2 를 "착수 조건 없음(여유 있을 때) · planner 소관" 으로 등재만 한 것이고, 이번 PR 이 그 spec 파일들을 직접 고치지는 않는다. 발견된 부수 갭을 코드로 고치지 않고 트래커에 등재만 한 것은 이 저장소의 표준 절차(발견 즉시 고치지 않고 트래커에 넘김)와 일치한다.
  - 제안: 조치 불필요.

- 나머지 47개 파일(구현 8개 · 테스트/가드 6개 · CHANGELOG · spec 본문 1개 · plan 3개 · 이전 라운드의 review/code·review/consistency 산출물 30개)은 모두 "성공 응답 미광고 11개 라우트 광고", "가드에 unadvertised/redirect 판정 추가", "e2e 계약 대조 신설/확장" 세 축 및 그 축에 대한 CLAUDE.md 규약(spec/plan/review 산출물 커밋)으로 정확히 설명된다.
  - `git diff origin/main...HEAD` 로 각 파일(특히 프롬프트에서 크기 제한으로 생략된 `assistant-session-response.dto.ts`·`http-status-advertised-guard.ts`·`workflow-assistant.e2e-spec.ts`·`success-advert.md`)을 직접 열어 대조했다 — 숨은 무관 변경은 없다.
  - `http-status-advertised-guard.ts` 의 `judgeHandler` → `classifyDecorators` 분리는 무관한 리팩터가 아니라, 같은 PR 의 직전 `/ai-review` 라운드(`13_39_09`)가 지적한 W2(SRP 압박)를 `RESOLUTION.md` 가 명시적으로 처분한 결과이며 `bf1fa96fc` 커밋 본문과 일치한다.
  - `triggers.controller.ts` 의 반환 타입을 인라인 리터럴에서 `Promise<NotificationRotateSecretDto>`/`Promise<InteractionRevokeTokenDto>` 로 좁힌 것도 같은 라운드 INFO14 의 조치이며 스코프 밖 drive-by 가 아니다.
  - `CHANGELOG.md`·`spec/conventions/swagger.md`·`plan/in-progress/*`·`review/**` 등 비-코드 파일 변경은 이 프로젝트 관례상(spec+구현이 한 PR 로 머지, 리뷰/일관성 검토 산출물 커밋 의무) 정상적인 동반 변경이다. `spec/conventions/swagger.md` 의 diff 는 같은 PR 의 `plan/in-progress/spec-draft-swagger-success-advert.md` 초안 문구와 line-level 로 일치해, planner 턴 없이 developer 가 임의로 spec 을 고친 흔적이 아니다.
  - 포맷팅만 바뀐 줄, 사용하지 않는 임포트, 무관한 주석 변경은 발견되지 않았다 — 모든 diff hunk 가 순증분(additive)이거나 이번 PR 로직에 직접 종속된 정정이다.

## 요약

변경 범위는 plan(`plan/in-progress/success-advert.md`)이 밝힌 목표 — "성공 응답을 광고하지 않던 11개 라우트에 응답 DTO·가드·e2e 계약 검증 추가" — 와 정확히 일치한다. `origin/main` 대비 50개 파일 전체를 `git diff`로 직접 대조한 결과 코드 변경은 이 목표와 그 목표에 대한 같은-PR 리뷰 라운드(13_39_09)의 처분 항목으로 전부 설명되며, 무관한 리팩토링·기능 확장·포맷팅 혼입·불필요한 임포트 정리는 없다. 유일하게 주목할 점(`assistant-session-response.dto.ts` 의 상세도)은 세션 상세 라우트가 엔티티 중첩 구조를 그대로 반환하기 때문에 불가피하며, 이미 이전 라운드에서 검토·수용됐다. spec·plan·review 산출물의 동반 변경은 이 프로젝트의 SDD 워크플로 규약(spec-draft → `--spec` → 구현 → `/ai-review` → `--impl-done`을 한 PR 로 머지)에 부합한다.

## 위험도

LOW
