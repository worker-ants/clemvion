# Cross-Spec 일관성 검토 — success-advert (impl-done)

## 검토 범위와 방법

- diff-base `origin/main` 대비 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/success-advert`) HEAD 를 절대경로로 직접 열어 확인했다 (프롬프트 번들은 예산 초과로 `spec/1-data-model.md`·`spec/5-system/2-api-convention.md`·`spec/5-system/14-external-interaction-api.md`·`spec/conventions/swagger.md`·git diff 본문 등 대부분이 절단돼 있어, 그 절단분은 실제 파일을 `Read`/`git show` 로 재확인했다).
- 이 PR 은 `spec/` 변경으로 `spec/conventions/swagger.md` 1개 파일만 건드린다(성공 응답 광고 규칙 강화 + `ApiOkWrappedNullableResponse` 추가). 나머지는 이미 존재하던 11개 엔드포인트 핸들러에 **응답 DTO + `@ApiOk*`/`@ApiCreated*`/`@ApiNoContent*` 데코레이터를 추가하는 것**(런타임 응답 shape·상태 코드는 불변)과 그 규칙을 강제하는 저장소 가드 강화다.
- 대상 spec 영역(코드 `code:` 매핑): `spec/2-navigation/2-trigger-list.md`, `spec/3-workflow-editor/4-ai-assistant.md`, `spec/5-system/1-auth.md`, `spec/5-system/14-external-interaction-api.md`, `spec/conventions/swagger.md`.

## 발견사항

### [WARNING] `interaction/revoke-token` 의 상태 전이 서술이 두 spec 영역에서 반대다

- target 위치: 이번 PR 이 `NotificationRotateSecretDto`/`InteractionRevokeTokenDto` 로 응답을 광고한 `POST /api/triggers/:id/interaction/revoke-token` (`codebase/backend/src/modules/triggers/triggers.controller.ts` diff, `spec/2-navigation/2-trigger-list.md` §3 API 표 해당 행)
- 충돌 대상: `spec/5-system/14-external-interaction-api.md` §7.3 (`Trigger.config.interaction.triggerToken` 서술) 및 EIA-AU-07 행
- 상세: `spec/2-navigation/2-trigger-list.md` §3 는 "감사: `trigger.interaction_token_revoked` — **회전이 아니라 폐기**다(이전 토큰 즉시 무효화)" 라고 명시한다. 반면 `spec/5-system/14-external-interaction-api.md` 961행은 "`per_trigger` 토큰은 ... revoke 시 새로운 값으로 **rotation**." 이라고 적어 같은 동작을 "rotation" 으로 부른다. 같은 문서의 EIA-AU-07(111행)은 반대로 "이전 토큰이 즉시 무효화돼 ... **회전(`*_rotated`)과 구분해 기록한다**" 고 적어, EIA 문서 **내부에서도** §7.3 서술과 EIA-AU-07 서술이 어긋난다. 즉 트리거 목록 spec(폐기) vs EIA §7.3(rotation) 의 영역 간 충돌이며, EIA 문서 자체도 자기모순이다. 구현(`revokePerTriggerToken` — 기존 토큰 무효화 + 새 토큰 발급)은 메커니즘상 "재발급" 에 가까워 EIA-AU-07 의 프레이밍(감사 액션명으로 구분)과 더 맞는다.
- 상태: 이 PR 이 새로 만든 충돌이 아니라 기존 spec 상태이며, `--impl-prep` 단계 cross_spec 검토(`review/consistency/2026/09/26/13_17_19`, W2)에서 이미 식별되어 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 소관 항목으로 등재돼 있다(“`interaction/revoke-token` 의 상태 전이를 두 spec 이 반대로 적는다”). 이번 PR 은 이 문구를 고치지 않았고, 새 DTO 주석은 절충적으로 "무효화 + 새 발급" 메커니즘을 그대로 서술해 놓았다.
- 제안: 이미 등재된 트래커 항목대로 `spec/2-navigation/2-trigger-list.md` §3 의 "폐기" 문구를 EIA-AU-07 논거로 맞추거나, 반대로 EIA §7.3 의 "rotation" 표현을 EIA-AU-07 과 일치시켜 최소 EIA 문서 내부 자기모순만이라도 먼저 해소할 것. `--spec` 재검토 필요(이미 계획됨) — 이번 PR 의 병합을 막을 사유는 아니다.

### [WARNING] `4-ai-assistant.md` §6 REST API 표에 `GET /api/workflow-assistant/sessions/latest` 가 없다

- target 위치: `spec/3-workflow-editor/4-ai-assistant.md` §6 REST API 표 (`GET .../sessions` · `POST .../sessions` · `GET .../sessions/{id}` · `PATCH` · `DELETE` · `POST .../messages` 6행만 있고 `latest` 행 없음)
- 충돌 대상: 같은 문서 §6.1 "세션 자동 선택 규칙"(이 라우트가 뒷받침하는 동작을 서술) 및 실제 코드 `workflow-assistant.controller.ts` 의 `@Get('sessions/latest')` 핸들러
- 상세: 이번 PR 은 바로 이 `latest` 핸들러에 `@ApiOkWrappedNullableResponse(AssistantSessionDto, ...)` 를 붙여 OpenAPI 에 정식 노출시켰다 — 코드·생성된 OpenAPI 에는 존재하지만 제품 spec 의 API 표에는 여전히 없는 격차가, 이 PR 로 인해 "문서화된 완전한 계약" 과 "표에 없는 라우트" 사이의 대비가 더 뚜렷해졌다.
- 상태: `--impl-prep` cross_spec/`plan_coherence`(`review/consistency/2026/09/26/13_17_19`, W1)에서 이미 식별, 동일 트래커 파일에 planner 소관 항목으로 등재됨. 이번 PR 범위(developer, 응답 스키마 광고)에서 고칠 항목이 아니다.
- 제안: 트래커 항목대로 `planner` 가 `--spec` 로 §6 표에 `GET /api/workflow-assistant/sessions/latest` 행을 추가.

### [INFO] `4-ai-assistant.md` §6 "모든 엔드포인트는 `editor` 이상 역할이 필요" 서술이 `list`/`latest`/`findOne` 의 실제 가드와 다르다

- target 위치: `spec/3-workflow-editor/4-ai-assistant.md` §6 본문 "모든 엔드포인트는 `editor` 이상 역할이 필요하고, `workspace_id`는 JWT에서 주입된다."
- 충돌 대상: `codebase/backend/src/modules/workflow-assistant/workflow-assistant.controller.ts` 의 `list`/`latest`/`findOne` (이번 PR 로 `@ApiOkWrappedArrayResponse`/`@ApiOkWrappedNullableResponse`/`@ApiOkWrappedResponse` 가 새로 붙었다) — 이 세 핸들러는 `@Roles('editor')` 가 없고 `FORBIDDEN_NOT_A_MEMBER`(멤버십만 확인) 로 문서화돼 있다. `editor` 가드는 `create`/`update`/`remove` 에만 있다.
- 상세: origin/main 기준 이미 존재하던 코드로, 이번 diff 는 이 세 핸들러의 역할 가드를 바꾸지 않았다 — 응답 스키마만 추가했다. 다만 §6 본문 문장 그대로라면 "모든" 엔드포인트가 editor+ 여야 하는데 실제로는 조회 3종은 멤버(viewer 포함)면 충분하다. 새 리뷰가 아니라도, 이번 PR 이 정확히 그 3개 GET 라우트의 계약을 OpenAPI 로 처음 정식화한 시점이라 언급해 둔다.
- 상태: 이번 PR 범위 밖(코드·의도된 동작 변경 없음), 별도 트래커에 등재돼 있지 않음.
- 제안: 다음 spec 정리 때 §6 문장을 "쓰기 계열(`POST`/`PATCH`/`DELETE`)은 `editor` 이상, 조회는 워크스페이스 멤버" 식으로 정정 권장. 이번 PR 의 병합을 막을 사유는 아니다.

## 검증되어 충돌이 없다고 판단한 항목

- `NotificationRotateSecretDto{ secret, rotatedAt }` / `InteractionRevokeTokenDto{ token }` — `trigger-list.md` §3 API 표의 "응답 `{ secret, rotatedAt }`" 서술과 정확히 일치. 전역 `TransformInterceptor` 래핑(`{ data: ... }`)은 기존 컨벤션(spec 산문은 논리 payload 표기로 통일)과 일치.
- `WebAuthnAvailabilityDto{ enabled: boolean }` — `spec/5-system/1-auth.md` §1.4.3/§5 의 "응답: `{ enabled: boolean }`" 과 정확히 일치.
- `AssistantSessionDto`/`AssistantMessageDto`(`autoResumed`/`autoResumeReason`/`autoResumeAttempt`/`finishReason`) — `spec/3-workflow-editor/4-ai-assistant.md` §6.0 필드 표와 일치.
- `ApiOkWrappedNullableResponse` (`{ data: <Dto> | null }`, `data` 키 상시 존재) — `spec/5-system/2-api-convention.md` §5.4 "부재 표현" 의 기본값(`null`, 키 present) 규칙과 정합.
- swagger.md 의 3xx(리다이렉트) 예외 신설 — 대상인 `auth.controller.ts`/`third-party-oauth.controller.ts` 의 `res.redirect` 라우트는 이번 diff 로 신설된 것이 아니라 기존에 이미 `@ApiFoundResponse` 로 302 를 광고하고 있던 라우트이며, 다른 spec 영역이 이 라우트들에 다른 상태 코드를 요구하지 않는다.
- RBAC·데이터 모델·요구사항 ID·계층 책임 — 이번 diff 는 신규 엔티티/필드, 신규 요구사항 ID, 신규 권한 구조, 코드베이스 영역 간 책임 재배치를 만들지 않는다(순수 Swagger 문서화 + 가드 강화 + 대응 테스트).

## 요약

이번 PR 은 기존 동작을 바꾸지 않고 11개 엔드포인트의 성공 응답을 OpenAPI 에 광고하며 `http-status-advertised` 가드를 "라우트는 성공 응답을 하나 이상 광고한다" 로 조이는 순수 문서화·가드 강화 변경이라, 새로 만들어 낸 데이터 모델·API 계약·RBAC·상태 전이 충돌은 없다. 다만 이 과정에서 새로 표면화된 두 개의 **기존** cross-spec 불일치 — `interaction/revoke-token` 의 "폐기 vs rotation" 용어 충돌(트리거 목록 vs EIA, EIA 문서 자기모순 포함)과 `4-ai-assistant.md` §6 API 표의 `sessions/latest` 누락 — 은 이미 이번 PR 의 `--impl-prep` 단계에서 식별되어 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 소관으로 정확히 등재돼 있으므로, 이번 PR 을 막을 사유가 아니라 후속 `--spec` 작업으로 넘기면 된다. 추가로 §6 "모든 엔드포인트는 editor 이상" 문장이 조회 3종의 실제(멤버십-only) 가드와 다른 것을 INFO 로 신규 기록했다.

## 위험도

LOW
