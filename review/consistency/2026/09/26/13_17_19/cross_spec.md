# Cross-Spec 일관성 검토 — success-advert (`--impl-prep`)

대상: `plan/in-progress/success-advert.md` 가 다음 단계(래퍼 `ApiOkWrappedNullableResponse` +
응답 DTO 11곳 + 가드 강화)로 착수하려는 구현 대상 영역 —
`spec/conventions/swagger.md`(§2-4/§5-2 신설분, 이미 커밋됨) · `spec/2-navigation/2-trigger-list.md` ·
`spec/3-workflow-editor/4-ai-assistant.md` · `spec/5-system/1-auth.md` ·
`spec/5-system/2-api-convention.md` · `spec/5-system/14-external-interaction-api.md`.

프롬프트 번들이 위 4개 파일(ai-assistant/auth/api-convention/EIA)을 예산 초과로 절단해, 저장소의
실제 파일을 직접 `Read` 해 대조했다.

## 발견사항

- **[WARNING]** `sessions/latest` 엔드포인트가 도메인 spec API 표에 없다 — 지금 이 plan 이 그 계약을 처음 문서화한다
  - target 위치: `plan/in-progress/success-advert.md` 실측표 — `workflow-assistant 세션 list · **latest** · findOne · create · update · remove` (6곳), `latest` 는 없으면 `null` → 신설 `ApiOkWrappedNullableResponse` 대상
  - 충돌 대상: `spec/3-workflow-editor/4-ai-assistant.md` §API 표 (약 585~590행) — `GET/POST/PATCH/DELETE /workflow-assistant/sessions`, `GET /workflow-assistant/sessions/:id`, SSE `POST .../messages` **5개만** 나열. `GET /api/workflow-assistant/sessions/latest` 는 그 표에 없다
  - 상세: 실제 컨트롤러(`codebase/backend/src/modules/workflow-assistant/workflow-assistant.controller.ts:73`)에는 `@Get('sessions/latest')` 가 이미 존재하고("워크플로우 편집기 진입 시 기본 선택할 세션을 조회") 프런트가 소비 중일 것으로 보이지만, 그 라우트를 문서화해야 할 도메인 spec(`4-ai-assistant.md`)의 API 표에는 등재돼 있지 않다. `swagger.md` §5-2 가 이번에 신설하는 `ApiOkWrappedNullableResponse` 의 표 안 예시 문구("없으면 `null` 인 «최근 항목» 조회")가 사실상 이 엔드포인트를 가리키는데, 그 계약의 domain-level SoT 가 비어 있는 상태에서 OpenAPI 문서만 먼저 생긴다 — 다음에 이 라우트의 동작을 바꿀 사람은 `4-ai-assistant.md` 를 읽고 그런 엔드포인트가 없다고 오판할 수 있다
  - 제안: 이번 PR 또는 후속 별 plan 에서 `4-ai-assistant.md` §API 표에 `GET /api/workflow-assistant/sessions/latest` 행을 추가(쿼리 `workflowId` 필수, 없으면 `null`, 권한 = 멤버십만). `success-advert.md` 의 `spec_impact` 가 현재 `swagger.md` 하나뿐인데, 이 갭을 이번 PR 범위에 넣을지 defer 할지 명시적으로 정하고 트래커에 남긴다

- **[WARNING]** `interaction/revoke-token` 의 상태 전이 서술이 EIA 와 trigger-list 에서 반대로 읽힌다 — "rotation" vs "폐기(회전 아님)"
  - target 위치: `spec/2-navigation/2-trigger-list.md` §3 API 표 — `POST /api/triggers/:id/interaction/revoke-token` 행: "감사: `trigger.interaction_token_revoked` — **회전이 아니라 폐기다**(이전 토큰 즉시 무효화)"
  - 충돌 대상: `spec/5-system/14-external-interaction-api.md` §7.3 (약 961행) — "`per_trigger` 토큰은 `Trigger.config.interaction.triggerToken` 에 보관되며, **revoke 시 새로운 값으로 rotation**." 및 EIA-AU-07(약 111행) — "이전 토큰이 즉시 무효화돼 ... **회전(`*_rotated`)과 구분해 기록한다**"
  - 상세: 실제 구현(`triggers.service.ts revokePerTriggerToken`)은 기존 토큰을 무효화**하고 동시에 새 `itk_*` 를 발급**해 `{ token: string }` 으로 반환한다 — 메커니즘은 EIA §7.3 이 말하는 "새로운 값으로 rotation" 그대로다. EIA-AU-07 은 그 메커니즘을 부정하지 않고, *감사 로그 액션명*을 `*_rotated` 대신 `*_revoked` 로 쓰는 이유(대화 단절이라는 파괴적 부수효과가 있어 일반 회전과 다르게 기록해야 한다)만 설명한다. 반면 trigger-list.md 는 이를 "회전이 아니라 폐기다"라는 절대 명제로 단순화해, 두 target 문서가 같은 엔드포인트의 성격을 다르게 규정한다. 지금 plan 이 이 엔드포인트의 응답 DTO(`{ token }`)와 `@ApiOperation` 설명을 작성하는 단계라, JSDoc 이 공개 OpenAPI 로 그대로 나가는 규약(`swagger.md` §3 "JSDoc 은 공개 OpenAPI 로 나간다")과 맞물려 trigger-list.md 식 "폐기(신규 토큰 없음)" 프레이밍을 그대로 옮기면 응답에 `token` 필드가 실제로 오는 것과 문서 어투가 어긋난다
  - 제안: `trigger-list.md` 의 문구를 EIA-AU-07 의 실제 논거("이전 토큰 무효화로 대화가 끊기니 회전과 감사상 구분한다" — 감사 **이름**의 문제이지 메커니즘의 문제가 아님)로 정정하거나, 최소한 "메커니즘은 회전(새 토큰 발급)이나 감사 액션명은 대화 단절을 강조해 `_revoked` 로 구분한다"로 완화. 새로 쓸 컨트롤러 JSDoc/응답 DTO 설명은 EIA §7.3 표현("무효화 후 새 토큰 발급")을 따르는 편이 응답 필드(`token`)와 일치한다

## 요약

두 발견 모두 이번 impl-prep 이 실제로 손댈 자리(신설 `ApiOkWrappedNullableResponse` 의 대상인 `sessions/latest`, 신설 응답 DTO 대상인 `interaction/revoke-token`)에서 target 문서 간 서술이 어긋난다는 점에서, 구현 착수 직전에 짚을 가치가 있는 WARNING 이다. 둘 다 구현을 막는 직접 모순(CRITICAL)은 아니다 — 코드는 이미 존재하고 동작이 명확하며, 이번 plan 이 하려는 일(래퍼·DTO·가드 강화)은 어느 해석을 택하든 진행 가능하다. 다만 JSDoc 이 그대로 공개 OpenAPI 로 나가는 이 저장소의 규약상, 새로 작성할 설명 문구가 어느 target 문서의 프레이밍을 따를지 결정하지 않고 넘어가면 방금 만든 문서 갭·용어 불일치가 공개 API 문서에 고정된다. 그 외 데이터 모델·API 계약(다른 축)·요구사항 ID·RBAC·계층 책임 관점에서는 swagger.md 신설 §2-4/§5-4 규약이 `api-convention.md`·`data-flow/12-workspace.md` 의 기존 결정(멤버십 검증 위치, 거부 코드 명명)과 정합했고, WebAuthn availability/DELETE credentials 응답 형태도 `1-auth.md` 서술과 일치했다.

## 위험도
LOW
