# Cross-Spec 일관성 검토 — `spec-draft-swagger-success-advert.md`

## 검토 범위

target: `plan/in-progress/spec-draft-swagger-success-advert.md` (draft, `spec/conventions/swagger.md` §2-4/§5-2/§5-4/Rationale 변경 4건)

대조: `spec/conventions/swagger.md`(현재본) · `spec/5-system/2-api-convention.md`(§5.1/§5.2/§5.4/§6) ·
`spec/0-overview.md` · `codebase/backend/src/common/swagger/api-wrapped.ts` ·
`codebase/backend/src/modules/auth/auth.controller.ts` · `codebase/frontend/src/lib/api/assistant.ts` ·
`plan/in-progress/success-advert.md` · `plan/complete/post-status-openapi.md` ·
`plan/in-progress/spec-draft-nullable-notation-followups.md`

## 발견사항

- **[WARNING]** Rationale 교체 문구(변경 4)가 아직 일어나지 않은 일을 이미 끝난 일처럼 적는다 — `plan/complete/success-advert.md` 를 가리키지만 실제로는 `plan/in-progress/success-advert.md`(status: in-progress)
  - target 위치: draft `## 변경 (4)` — `## Rationale` §2-4 절 불릿 교체문
  - 충돌 대상: `plan/in-progress/success-advert.md`(현재 상태) · `spec/0-overview.md` `## Rationale` 서문("본문은 latest-only 사실을 기술하고 …")이 대변하는 저장소 전반의 "spec 은 이미 벌어진 사실만 적는다" 관행
  - 상세: 새 불릿은 "뒤이은 PR(`plan/complete/success-advert.md`)이 11곳을 채웠고(… workflow-assistant 세션 6곳 포함), 남은 넷은 …" 이라고 **과거형·완료형**으로 적는다. 그런데 `plan/in-progress/success-advert.md` 의 `## 요구 (순서대로)` 는 "1. spec draft → `--spec` → 반영(planner 커밋) → `--impl-prep`" 을 1번으로 두고, 실제 래퍼·DTO·가드 작업(2~6번)은 그 **뒤**에 온다. 즉 이 draft 가 `--spec` 을 통과해 `swagger.md` 본문에 반영되는 시점에는 아직 구현이 시작되지 않았을 수 있다 — 그 시점에 커밋되는 Rationale 문장은 (a) 아직 `plan/complete/` 로 옮겨지지 않은 경로를 가리키는 죽은 링크가 되고, (b) "11곳을 채웠다" 는 아직 사실이 아닌 완료 선언을 spec 본문(SoT)에 심는다. 구현이 실제로 끝나기 전까지 이 문장을 읽는 사람은 있지도 않은 완료 상태를 전제하게 된다.
  - 제안: 두 갈래 중 하나. (1) 이 Rationale 문장 갱신을 `swagger.md` 반영 시점이 아니라 **구현이 실제로 끝나고 `success-advert.md` 가 `plan/complete/` 로 옮겨진 뒤**(=developer 의 마무리 커밋)로 미룬다 — `--spec` 단계에서는 변경 (1)(2)(3)만 반영하고 변경 (4)는 보류. (2) 지금 반영해야 한다면 시제를 프로스펙티브로 낮춘다 — "뒤이은 PR(`plan/in-progress/success-advert.md`)이 채운다(예정)" 처럼 현재 진행/예정형으로 적고, 구현 완료 시 developer 가 좁게 정정한다(자기-반증형 소정정 조건과는 별개로, 원 저자가 planner 이므로 이 정정은 다시 planner 턴 필요).

- **[INFO]** `ApiOkWrappedNullableResponse(Dto)` 의 반환 스키마 `{ data: <Dto> \| null }` 가 §1-4 가 이미 겪은 "`nullable` 이 `$ref` 형제로 오면 무시된다" 문제를 다시 밟을 여지
  - target 위치: draft `## 변경 (2)` — §5-2 표 신규 행
  - 충돌 대상: `spec/conventions/swagger.md` §1-4 (닫힌 union 예시가 `oneOf` 로 감싼 뒤 `nullable: true` 를 붙임 — 순수 `$ref` 옆에 바로 붙이지 않음) · `codebase/backend/src/common/swagger/api-wrapped.ts` `wrapDataSchema`(현재 `{ data: { $ref } }` 를 그대로 만듦, nullable 인자 없음)
  - 상세: OpenAPI 3.0 은 `nullable` 이 `$ref` 와 형제로 오면 구현체 다수(특히 코드 생성기)가 이를 무시한다 — 그래서 같은 문서 §1-4 Rationale(`discriminator` 판별 절 주변)은 이미 "닫힌 union" 케이스에서 `oneOf` 로 감싼 뒤 `nullable` 을 건다. 이번 draft 의 §5-2 표는 **의미**(`{data: <Dto>|null}`)만 적을 뿐 **구현 형태**를 규정하지 않으므로, 구현자가 `wrapDataSchema` 를 단순 확장해 `{ data: { $ref: …, nullable: true } }` 로 만들면 생성된 OpenAPI 상 `data` 가 여전히 non-nullable 로 보일 수 있다.
  - 제안: 이번 draft 자체를 막을 사안은 아니지만(표는 의미 계약이지 구현 아님), `plan/in-progress/success-advert.md` 의 "래퍼 `ApiOkWrappedNullableResponse` + 단위 테스트" 항목에 "`$ref` 형제 `nullable` 금지 — `oneOf: [{$ref}], nullable: true` 형태로 구현" 캐비엇을 한 줄 남겨 구현 단계에서 §1-4 의 기존 교훈이 재발하지 않게 한다.

- **[INFO]** `spec/5-system/2-api-convention.md` §6 HTTP 상태 코드 표에 3xx 행이 없다 — swagger.md §2-4 가 3xx 를 "성공 광고"로 명문화해도 이 표는 그대로 2xx/4xx/5xx 만 나열
  - target 위치: draft `## 변경 (1)`
  - 충돌 대상: `spec/5-system/2-api-convention.md` `## 6. HTTP 상태 코드`
  - 상세: 모순은 아니다 — §6 표는 "우리 API 가 클라이언트에 주는 상태" 카탈로그이고 3xx(OAuth 리다이렉트)는 이미 `auth.controller.ts` 에 실재하며 이 표가 그것을 부정하지 않는다. 다만 §6 만 읽는 사람은 "성공 응답 = 200/201/202/204" 로 오독하기 쉽고, swagger.md §2-4 가 이번에 3xx 를 명시적으로 "성공 광고" 축에 편입시키는 것과 비교하면 두 문서의 눈높이가 살짝 어긋난다.
  - 제안: 필수 아님. 여유가 있으면 api-convention §6 에 "리다이렉트 성공(3xx)은 [swagger.md §2-4](../conventions/swagger.md#2-4-상태-코드-응답-규칙) 참조" 한 줄만 추가하면 두 표의 스코프 차이가 다음 사람에게 분명해진다.

## 정합성 확인 (충돌 아님 — 근거로 남김)

- §5-2 신규 래퍼가 광고하는 `{ data: AssistantSessionData | null }` 는 `codebase/frontend/src/lib/api/assistant.ts` `getLatestSession` 이 **이미** 기대하는 wire shape 과 일치한다(`apiClient.get<{ data: AssistantSessionData | null }>`) — 광고가 실제를 따른다는 draft 의 주장이 코드로 확인된다.
- "세션이 없으면 `null`" 결정은 `spec/3-workflow-editor/4-ai-assistant.md` (line 614, "없으면 패널은 빈 상태로 표시")과도 맞는다 — draft 가 기각한 "404" 대안이 실제로 프런트 empty-state 계약과 충돌했을 결정이었음을 뒷받침한다.
- draft Rationale 이 인용하는 "«광고가 있어야 한다»는 별 결정으로 미뤘다"(`post-status-openapi` 트래커 등재)는 `plan/complete/post-status-openapi.md` 본문(§Rationale, 트래커 W항목)과 `spec/conventions/swagger.md` 현재 Rationale 불릿(line 698-699) 양쪽에서 문구까지 일치해 확인됐다 — 지어낸 배경이 아니다.
- 새 헬퍼명 `ApiOkWrappedNullableResponse` 는 기존 명명 축(`ApiOkWrappedResponse` / `ApiOkWrappedOneOfResponse` / `ApiOkWrappedArrayResponse` / `ApiCreatedWrappedResponse` / `ApiAcceptedWrappedResponse` / `ApiOkPaginatedResponse`)과 충돌 없이 자연스럽게 확장되고, `api-wrapped.ts` 에 동명 export 가 없다.
- 데이터 모델·요구사항 ID·상태 전이·RBAC·계층 책임 — 이번 draft 는 5개 축 모두 **건드리지 않는다**(순수 OpenAPI 문서화 규약). 새 요구사항 ID 부여도 없다.

## 요약

target 은 `spec/conventions/swagger.md` §2-4/§5-2/§5-4 와 Rationale 을 손보는 순수 문서화 규약 변경으로, 데이터 모델·API wire 계약·요구사항 ID·상태 전이·RBAC·계층 책임 등 다른 영역 spec 과는 충돌하지 않는다 — 오히려 프런트엔드 코드(`assistant.ts`)·이웃 spec(`4-ai-assistant.md`)·선행 완료 plan(`post-status-openapi.md`)과 실측·문구 양쪽에서 정합성이 확인된다. 유일하게 실질적인 문제는 draft 의 Rationale 교체문(변경 4)이 아직 완료되지 않은 구현 작업(`plan/in-progress/success-advert.md`)을 과거형으로 서술하고 존재하지 않는 `plan/complete/success-advert.md` 경로를 인용한다는 점 — `--spec` 단계에서 그대로 반영하면 SoT 문서가 일시적으로 거짓 완료 선언을 담게 된다. 이 한 항목의 시퀀싱만 조정하면 나머지는 그대로 채택 가능하다.

## 위험도

LOW
