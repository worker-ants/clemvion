# Plan 정합성 검토 — post-status-openapi (--impl-prep)

## 발견사항

- **[WARNING]** `revokeInvitation` 광고 수정이 미해결 planner 결정의 모집단(라우트 수)을 넓히는데 그 결정 문서가 갱신되지 않음
  - target 위치: `plan/in-progress/post-status-openapi.md` "방향 — 광고에 맞춘다(200)" 절의 `revokeInvitation` 항목(광고를
    `@ApiNoContentResponse`(204) → `ApiOkWrappedResponse(OkResultDto)`(200)로 정정, "같은 파일 DELETE 형제들처럼"), 및 요구
    3·6.
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:4861-4869` — **"`workspaces.controller.ts` 만
    삭제 성공에 204 대신 `200 {ok:true}` 를 쓴다"** (owner: planner, 2026-09-21 등재, 미결).
  - 상세: 이 pending 항목은 `spec/5-system/2-api-convention.md` §6("204 = 삭제 성공")을 위반하는 라우트로
    `DELETE /api/workspaces/:id` 와 `DELETE /api/workspaces/:id/members/:memberId` **두 자리만** 명시하면서, 그 근거로
    "`ok: true` 가 5곳" 이라고 실측했다(`workspaces.controller.ts:240,261,297,405,560`). 그런데 560번째 줄이 바로
    target 이 이번에 정확히 찾아낸 `revokeInvitation`(`DELETE /:id/invitations/:invitationId`)이다 — 즉 **세 번째 DELETE
    라우트**가 같은 §6 위반이며 이미 그 5곳 안에 들어 있었는데, pending 항목의 "위반 라우트" 서술에는 빠져 있다.
    target 은 이 라우트의 **광고만** 204→200 으로 고쳐 "형제 DELETE 들처럼" 만들고, "이 컨트롤러를 204 로 바꿀지는
    planner 트래커 항목의 결정이다 — 이 PR 이 선점하지 않는다" 고 명시적으로 적어 **방향 결정 자체는 올바르게 회피**한다.
    다만 그 결과로 pending 항목이 세는 위반 라우트 수(2)가 실제(3)와 어긋난 채 남는다. target 요구 6("트래커: 이 항목
    닫기 + «광고 없음 15곳» 신규 등재")은 이 새로 확인된 세 번째 라우트를 pending 항목에 반영하는 작업을 포함하지
    않는다.
  - 제안: `plan/in-progress/spec-draft-nullable-notation-followups.md:4861` 항목의 실측 문구("`DELETE /api/workspaces/:id`
    와 `DELETE /api/workspaces/:id/members/:memberId` 는 200 을 준다")를 세 라우트로 확장하거나 각주를 추가할 것 —
    target PR 이 같은 턴에 이 사실을 발견했으므로 반영 비용이 가장 싸다. 반영하지 않으면 그 planner 결정이 실제로
    내려질 때(204 통일 또는 §6 예외 문서화) 세 번째 라우트가 "새 발견"처럼 다시 조사돼야 한다.

- **[INFO]** 신규 repo-guard 가 별도의 미결 "repo-guard `code:` 등재 관례" 항목의 모집단을 늘리는데 카운트가 갱신되지 않음
  - target 위치: 요구 1 "정적 가드 `src/repo-guards/__tests__/http-status-advertised{-guard.ts,.spec.ts}` 신설"
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:4006-4038` — **"신규 repo-guard 가 spec `code:` 에
    미등재 — 다만 «관례» 라 부를 만큼 일관되지 않다"** (owner: planner, 2026-09-14 등재, 낮음/보류) + 인접 포인터
    `plan/in-progress/spec-conventions-engine-error-code-surface.md:112-129`.
  - 상세: 그 항목은 "가드 14 중 `code:` 등재 5 · 미등재 9" 를 실측하고 (a) 개별 가드를 spec `code:` 에 넣을지, (b) 등재
    자체를 규약으로 세울지를 planner 결정으로 열어 뒀다(현재 명시적으로 defer, 착수 조건 없음). target 은
    `spec_impact: none` 을 선언하고 새 repo-guard(`http-status-advertised-guard.ts`)를 어느 spec 의 `code:` 에도 등재하지
    않는다 — 결정을 막거나 선점하는 것은 아니지만, 그 pending 항목이 다음에 다뤄질 때 참조할 모집단(14/5/9)이 이번
    신규 가드 1개만큼 stale 해진다.
  - 제안: 이번 PR 착수를 막을 사안은 아니다. 트래커 갱신 시(요구 6) 한 줄만 추가해 "http-status-advertised-guard 도
    `code:` 미등재 목록에 포함" 정도로 표시해 두면 다음 세션의 재조사 비용이 없어진다.

## 그 외 확인한 것 (문제 없음)

- 요구의 "14곳 201→200" 항목(`plan/in-progress/spec-draft-nullable-notation-followups.md:5041-5047`)은 owner 가
  `developer` 로 명시돼 있어 이번 PR 이 직접 결정·구현해도 되는 항목이다 — "액션에 맞춰 광고를 그대로 두거나 코드를
  200 으로 맞춘다" 두 처방 후보 중 target 은 후자를 택했고, planner 전용 항목이 아니므로 결정 우회가 아니다.
- 트래커가 남긴 확인 지시("`POST /workspaces/invitations/accept` 도 같은 모양인지 확인할 것", 5047번째 줄)를 target
  이 정확히 수행해 14곳 목록에 포함시켰다 — 정합.
- `integration-personal-owner-followup.md`(RBAC/가시성) · `auth-guard-reflection-hardening.md`(가드 reflection) 등
  같은 컨트롤러 계열(`integrations`, `workspaces`)을 건드리는 다른 in-progress plan 을 확인했으나 응답 상태 코드·
  `@HttpCode`·해당 e2e 파일과 겹치는 항목이 없어 충돌 없음.
- `backend-lint-gate-broken-on-main.md`(선행 lint 인프라 이슈)는 target 이 건드리는 컨트롤러 파일들과 겹치지 않아
  선행 조건으로 걸리지 않는다.

## 요약

target 은 자신이 직접 결정할 수 있는 항목(POST 14곳의 201→200, owner: developer)과 선점하면 안 되는 planner 결정
(`workspaces.controller.ts` 204 vs 200 방향)을 정확히 구분해 후자를 명시적으로 회피하는 등 plan 규율을 잘 지켰다.
다만 그 방향 결정 대상 항목의 **모집단 카운트**(위반 라우트 2 vs 실제 3 — `revokeInvitation` 누락)가 target 자신의
실측으로 갱신돼야 하는데 반영되지 않았고, 부수적으로 신규 repo-guard 가 또 다른 미결 "guard `code:` 등재 관례"
항목의 카운트를 늘리는 것도 기록되지 않았다. 두 건 모두 구현을 막을 사안은 아니며 트래커 갱신(요구 6) 시 한두 줄
추가로 해소된다.

## 위험도

LOW
