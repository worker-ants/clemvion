# Plan 정합성 검토 — post-status-openapi (--impl-done)

## 발견사항

- **[WARNING] 라운드2 `/ai-review` 가 약속한 트래커 신규 항목 "성공 응답을 광고하지 않는 라우트 핸들러가 15곳 있다" 가 아직 없음**
  - target 위치: `plan/in-progress/post-status-openapi.md` §요구 6번(`«광고 없음 15곳» ... 신규 등재`), §남기는 것("별 항목으로 트래커에 등재한다"), 체크리스트 `- [ ] 트래커 항목 닫기 · 신규 등재`
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` (트래커) — 해당 항목이 현재 파일에 **존재하지 않음**(`성공 응답을 광고하지 않는` 전문 grep 0건, `광고 없음`/`광고하지 않는` grep 0건)
  - 상세: `review/code/2026/09/26/10_23_50/RESOLUTION.md` (이미 커밋된 불변 리뷰 산출물)의 W2 처분이 "트래커 `spec-draft-nullable-notation-followups.md` «성공 응답을 광고하지 않는 라우트 핸들러가 15곳 있다» 항목에 함께 등재(수렴 예외)" — 즉 `http-status-advertised-guard.ts` docstring 의 수치 오기 정정을 이 신규 트래커 항목에 실어 처리하기로 **이미 약속**했다. 그런데 그 신규 항목 자체가 트래커에 없어 정정의 착지점이 없다. post-status-openapi.md 의 체크리스트는 `- [x] 트래커 W4 등재 · W5 · INFO4 갱신` 만 체크돼 있고 "«광고 없음 15곳» 신규 등재" 는 별도 체크 항목으로 명시돼 있지 않아, 마무리 커밋에서 원 항목("POST 라우트가 OpenAPI 로 200 을 광고...")만 닫고 이 신규 항목 추가를 누락할 위험이 있다.
  - 제안: `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 "성공 응답을 광고하지 않는 라우트 핸들러가 15곳 있다" 항목을 신설하고(§남기는 것의 15곳 목록 인용), `swaggerResponseStatuses` docstring 수치 오기 정정 메모를 함께 적을 것 — 마무리 커밋(트래커 항목 닫기) 시 반드시 포함.

- **[WARNING] 반영 완료된 planner draft plan 이 `plan/complete/` 로 이동되지 않음**
  - target 위치: `plan/in-progress/spec-draft-swagger-http-status-guard.md` (frontmatter `status: in-progress`)
  - 관련 plan: 같은 파일 — 4개 변경(①`code:` 등재 ②§2-4 문단 ③§5-4 체크리스트 ④Rationale) 전부가 `spec/conventions/swagger.md` 에 이미 반영돼 있음을 확인함(각 문구 grep 일치, 커밋 `4b88bcf74`)
  - 상세: `spec-draft-*` 류 draft plan 은 반영 후 `plan/complete/` 로 옮기는 것이 확립된 선례다(예: `plan/complete/spec-draft-web-chat-console.md`). 이 draft 는 4개 변경 전부 반영이 끝났는데도 `plan/in-progress/` 에 `status: in-progress` 로 남아 있고, `post-status-openapi.md` 체크리스트(`- [x] spec draft --spec · 반영 — ... 4b88bcf74`)에도 이동 작업이 언급돼 있지 않다.
  - 제안: 이 PR 마무리 단계(또는 별 planner 턴)에서 `spec-draft-swagger-http-status-guard.md` 를 `status: complete` 로 갱신 후 `plan/complete/` 로 이동.

- **[INFO] `plan/complete/post-status-openapi.md` 전방 참조 — 이미 추적 중, 마무리 커밋 스코프 확인 필요**
  - target 위치: `codebase/backend/test/action-success-status.e2e-spec.ts:13` (docstring), `plan/in-progress/spec-draft-nullable-notation-followups.md:4885` ("그 plan(`plan/complete/post-status-openapi.md`)이 «1차 자원...»")
  - 관련 plan: `plan/in-progress/post-status-openapi.md` (현재 `status: in-progress`, `plan/complete/post-status-openapi.md` 는 아직 미존재 — 확인함)
  - 상세: 이 두 전방 참조는 새로 발견한 문제가 아니라 `review/code/2026/09/26/10_23_50/RESOLUTION.md` INFO1 이 이미 잡아 "이 PR 의 마무리 커밋이 plan 을 `complete/` 로 옮겨 해소" 로 처분한 항목이다. 다만 그 RESOLUTION 은 e2e 헤더 1곳만 언급하고, 트래커 4885행의 동일 패턴 참조는 별도로 짚지 않았다 — 마무리 커밋(plan 이동)이 트래커 쪽 참조까지 함께 유효해지는지(경로가 실제로 존재하게 되는지) 재확인 필요.
  - 제안: 마무리 커밋에서 `plan/in-progress/post-status-openapi.md` → `plan/complete/post-status-openapi.md` 이동을 실행할 때, 두 전방 참조(e2e docstring + 트래커 각주)가 모두 유효해지는지 한 번에 검증.

- **[INFO] 신규 repo-guard 쌍이 `spec-conventions-engine-error-code-surface.md` 의 file-pair 카운트를 stale 하게 만듦**
  - target 위치: 신설 `codebase/backend/src/repo-guards/__tests__/http-status-advertised{-guard.ts,.spec.ts}`
  - 관련 plan: `plan/in-progress/spec-conventions-engine-error-code-surface.md` §관련 — "같은 축(파일 쌍)으로 오늘 다시 세면 `*-guard.ts` 14 · `*.spec.ts` 15" (repo-guards.md 신설 여부를 결정할 때 쓰일 모집단 수치)
  - 상세: 이 PR 이 추가하는 가드 쌍으로 이 축은 15/16 이 된다. 같은 트래커 파일 안의 **다른 축**(14/5/9 — `code:` 등재 여부)은 이 PR 이 이미 "위 표는 2026-09-14 시점 모집단이라 이 가드를 세지 않는다" 라고 스스로 캐비엇을 달았지만(`:4035-4037`), **같은 질문(파일 쌍 수)** 을 재는 `spec-conventions-engine-error-code-surface.md` 쪽 각주는 갱신되지 않았다. 다만 그 문서 자체가 "(b) 결정 턴에 재측정할 것" 을 관례로 이미 명시해 뒀고 현재 착수 예정이 아니므로 즉시 조치 불요.
  - 제안: 급하지 않음 — `repo-guards.md` 신설/등재 관례 결정 턴이 열릴 때 이 PR 이 늘린 가드 쌍을 포함해 재측정.

## 요약

target(`plan/in-progress/post-status-openapi.md`)이 명시적으로 보류한 두 개의 미해결 결정(①`workspaces.controller.ts` 삭제 라우트를 204 로 바꿀지 · ②repo-guard 등재를 규약으로 세울지)은 실제로 선점하지 않았고, 그 경계를 스스로 정확히 문서화했다 — CRITICAL 급 충돌은 없다. 다만 이 PR 이 자기 요구사항(§요구 6)과 라운드2 `/ai-review` RESOLUTION(이미 커밋된 불변 산출물)에서 약속한 트래커 후속 항목("광고 없음 15곳" 신규 등재 + docstring 수치 오기 정정)이 아직 트래커에 반영되지 않았고, 완전히 반영된 spec draft plan(`spec-draft-swagger-http-status-guard.md`)도 `plan/complete/` 로 옮겨지지 않은 채 남아 있다. 둘 다 이 plan의 마지막 두 체크리스트 항목("`--impl-done`" · "트래커 항목 닫기 · 신규 등재")이 아직 미완료 상태이므로 예정된 작업 범위 안에 있지만, 명시적으로 짚어 두지 않으면 마무리 커밋에서 누락될 위험이 있어 WARNING 으로 기록한다. `plan/complete/post-status-openapi.md` 전방 참조와 repo-guard 파일-쌍 카운트 stale 화는 이미 알려졌거나 급하지 않은 사안으로 INFO 처리한다.

## 위험도
LOW
