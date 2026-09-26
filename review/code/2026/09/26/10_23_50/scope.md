# 변경 범위(Scope) 리뷰

## 대상과 계획 대조

`plan/in-progress/post-status-openapi.md` 의 요구 6개 항목(정적 가드 신설 · 14곳 `@HttpCode(HttpStatus.OK)` ·
`revokeInvitation` 광고 정정 · e2e `[200,201]` 조임/이양 `201→200` · CHANGELOG · 트래커)을 기준으로 31개 파일 전부를
대조했다. 컨트롤러 7개(`auth-configs` · `integrations` · `knowledge-base` · `schedules` · `workflow-assistant` ·
`workflows` · `workspaces`) 는 계획이 명시한 정확히 그 핸들러에만 `@HttpCode(HttpStatus.OK)` 를 추가했고, 부수 diff(
`workspaces.controller.ts` 의 `HttpStatus` import 추가·`ApiNoContentResponse` import 제거)는 그 자리에서 실제로
필요한 변경이었다(제거된 import 는 파일 전체에서 더 이상 참조되지 않음을 `grep` 으로 확인, `OkResultDto` 는 이미
다른 라우트에서 import 되어 있어 재사용). 신설 파일 4개(가드 `http-status-advertised-guard.ts`+`.spec.ts`, 대조군
fixture `sample.controller.ts`, e2e `action-success-status.e2e-spec.ts`)는 요구 1·4 그대로다. `test/helpers/auth.ts`
의 `inviteAndAccept` → `createInvitation` 추출은 새 e2e(`action-success-status.e2e-spec.ts`)가 초대를 만들고
수락/취소를 각각 검증해야 해서 필요한 지원 리팩터링이고, 기존 `inviteAndAccept` 의 외부 동작은 그대로 유지된다
(추출한 함수를 호출하도록만 바뀜).

나머지 e2e 파일(19개)의 `[200, 201]).toContain(...)` → `toBe(200)` / `!== 201` → `!== 200` 치환은 각 파일의 호출
경로를 추적한 결과 전부 계획의 15개 대상 라우트(`saveCanvas` · `rotate` · `oauth/begin` · `:id/test` ·
`previewExpression` · `transfer-ownership`) 중 하나에 해당했다.

## 발견사항

- **[INFO]** `workflow-crud.e2e-spec.ts` 의 `importRes.status` 두 곳이 계획의 15개 대상 라우트에 속하지 않는
  `/api/workflows/import` 에 대한 것인데도 `[200, 201]).toContain(...)` → `toBe(201)` 로 조여졌다.
  - 위치: `codebase/backend/test/workflow-crud.e2e-spec.ts:451`, `codebase/backend/test/workflow-crud.e2e-spec.ts:484`
  - 상세: `import` 라우트는 이미 `@HttpCode(HttpStatus.CREATED)` 를 명시하고 있어(`codebase/backend/src/modules/workflows/workflows.controller.ts:531`) 이번 PR 이 고치는 15곳에 들지 않는다. 계획 §요구 4 는 "대상 호출은 200 으로 조인다" 라고 명시하는데, 이 두 곳은 대상이 아닌 라우트를 201 로 조인 것이라 문서화된 스코프 문장보다 한 걸음 넓다.
  - 근거: `git log` 상 이 조임은 이번 라운드가 아니라 직전 `/ai-review` 1라운드의 조치 커밋(`f5b10f57b fix(api): ai-review 1라운드 — … import 단언 조임`)에서 이미 반영·검토된 항목이다 — 새로 유입된 스코프 이탈이 아니라 이전 리뷰가 이미 다룬 변경이다.
  - 제안: 이미 이전 라운드에서 의도적으로 처리된 항목이므로 추가 조치 불요. 다만 plan 본문의 "대상 호출은 200 으로 조인다" 문구가 이 두 곳(201 로 조인 무관 라우트)을 포함하지 않는다는 점만 참고용으로 남긴다.

## 요약

컨트롤러·가드·e2e 변경 31개 파일 전부가 plan `post-status-openapi.md` 의 6개 요구 항목에 1:1로 대응한다. 드러난
import 추가/제거는 실제로 필요한 것이었고(미사용 import 제거·재사용 가능한 기존 import 활용), 신설 helper 함수는
새 e2e 를 지원하기 위한 최소 추출이었다. 유일하게 눈에 띄는 항목(`workflow-crud.e2e-spec.ts` 의 `import` 라우트
단언 조임)은 대상 15개 라우트 목록 밖이지만 이미 직전 리뷰 라운드에서 의도적으로 처리·기록된 변경이라 이번 라운드의
새로운 스코프 이탈로 보기 어렵다. 포맷팅 잡음, 불필요한 리팩토링, 기능 확장, 무관한 설정 변경은 발견되지 않았다.

## 위험도

NONE
