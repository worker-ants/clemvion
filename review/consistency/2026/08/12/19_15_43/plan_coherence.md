# Plan 정합성 검토 — spec/data-flow/ (impl-done, diff-base=origin/main)

## 검토 범위 요약

target 은 `spec/data-flow/`(핵심은 `15-external-interaction.md`). 구현 diff 는
`idempotency.interceptor.ts`/`.spec.ts` + `test/external-interaction.e2e-spec.ts` + `CHANGELOG.md`
+ 두 plan 파일(`backend-lint-gate-broken-on-main.md`, `spec-draft-eia-r8-alignment.md`) — Spec EIA
§R8 의 idempotency 캐시 닫힌 목록(`2xx`·`409`·`410`)을 실제로 구현한 작업이다(선재 결함,
2026-05-21 원본 구현부터). `git diff origin/main...HEAD --stat` 로 변경 파일을 전수 확인했다.

이 세션은 이미 `18_27_29` 회차의 plan_coherence 검토를 한 번 거쳤다. 그 회차가 지적한 유일한
WARNING(§2.2 표의 갭 caveat 삭제가 담당 planner plan 에 기록되지 않음)은 이후 커밋
`02e80d699`("--impl-done BLOCK:NO + developer 의 spec caveat 삭제를 planner plan 에 사후 기록")로
`spec-draft-eia-r8-alignment.md` 체크리스트에 반영되어 **해소됐다** (아래 재확인).

## 확인한 정합 상태

- **선행 조건 해소 확인**: `plan/in-progress/spec-draft-eia-r8-alignment.md`(owner:
  project-planner)가 `spec/data-flow/15` §1.2·§2.2·Rationale 및 `spec/5-system/14-external-
  interaction-api.md` §R8 을 SoT 로 정정한 작업을 전담했고, 체크리스트 전항목이 `[x]`다. 이
  developer 턴(`eia-r8-cache-scope`)의 착수 전제(§R8 이 정확해야 구현이 옳은 조건을 안다)가
  이미 만족된 상태에서 시작됐다 — `backend-lint-gate-broken-on-main.md` L609-616 의
  "선행 조건 해소" 사후 기록과 diff 내용이 일치한다.
- **완료 서사 자기기록 일관성**: `backend-lint-gate-broken-on-main.md` 의 해당 체크리스트
  항목(L590~662)이 1차 시도 실패(dead code, `16_29_45` CRITICAL) → 2차 재설계(`catchError`) →
  3·4차 자매 자리 누락(`16_53_26`·`17_07_45`) → e2e 판별력 확보(`18_07_36`~)까지, 실제
  `git log` 커밋 히스토리(`779a6e240`~`5bbaf5152`)와 diff 내용에 정확히 대응한다. 지어낸
  서술 없음.
- **§2.2 caveat 삭제의 사후 기록 확인**: `spec-draft-eia-r8-alignment.md` L115-123 에 "사후
  기록 — developer 턴이 §2.2 의 갭 caveat 을 지웠다"는 항목이 정확히 추가돼 있고, `spec/
  data-flow/15-external-interaction.md` §2.2 표의 현재 문구("2xx·409·410 응답 캐시 … 캐시
  대상은 닫힌 목록이다")도 `spec/5-system/14-external-interaction-api.md` §R8(origin/main 에
  이미 존재)과 정합한다. `18_27_29` WARNING 은 완전히 닫혔다.
- **미해결 백로그와의 비충돌**: `backend-lint-gate-broken-on-main.md` 에 여전히 미해결(`[ ]`)로
  남은 항목 — idempotency fail-open 구간 관측·중복 억제(L532), **idempotency 캐시 키가
  execution/인증 컨텍스트로 스코프되지 않음(L561, 5개 라운드 반복 지적 security)**,
  `responseJson` 내부 손상 무방비(L579), `readKey`/`hashBody` 경계값 테스트 부재(L587) — 는
  이번 diff 가 다루는 범위(R8 캐시 대상 닫힌 목록) 밖으로 명시적으로 분리돼 있다. 특히 L561
  항목은 "이번 PR 로 409/410 캐싱이 dead code 에서 실제 발동 경로가 됐다"는 위험 성격 변화를
  plan 스스로 이미 기록해 뒀고, target 문서(`spec/data-flow/15` §2.2)는 이 잔여 위험에 대해
  새로운 주장을 하지 않는다 — 충돌 없음, 의도된 후속 분리다.
- **관련 plan 교차 확인**: `plan/in-progress/` 전체에서 `idempotency`/`§R8` 를 언급하는 다른
  파일(`spec-sync-external-interaction-api-gaps.md`, `webchat-spec-rationale-followup.md`)은
  이번 변경과 무관한 문맥(전자는 "idempotency 는 구현 완료" 라는 일반 서술, 후자는 동명이인
  `§R8`—auth-session 문서의 발급-origin 바인딩 Rationale)이라 충돌 없음.

## 발견사항

- **[INFO]** `spec-draft-eia-r8-alignment.md` 체크리스트가 전부 `[x]`인데 `status: in-progress`
  로 남아 있다 (18_27_29 회차에서 이미 지적, 아직 미반영)
  - target 위치: 해당 없음 (plan 자체의 lifecycle 상태)
  - 관련 plan: `plan/in-progress/spec-draft-eia-r8-alignment.md` frontmatter
  - 상세: `plan-lifecycle.md` §3 완료 조건(체크박스 전부 `[x]` + 미해결 follow-up 0건)을
    만족한 것으로 보인다. 이번 PR 의 스코프는 아니며 push 를 막을 사안이 아니다.
  - 제안: 다음 planner 턴에서 `complete/` 이관 검토.

## 요약

target(`spec/data-flow/15-external-interaction.md`)과 관련 두 plan
(`backend-lint-gate-broken-on-main.md`, `spec-draft-eia-r8-alignment.md`)은 §R8 캐시 닫힌 목록
정합화라는 동일 서사를 처음부터 끝까지(선행 planner 정정 → 1~4차 개발 시도 실패·재설계 →
e2e 판별력 확보) 일관되게 기록하고 있다. 직전 회차(`18_27_29`)가 지적한 유일한 WARNING(spec
caveat 삭제의 plan 미기록)은 이후 커밋으로 해소가 확인됐고, target 이 미해결 결정을 우회하거나
선행 plan 을 무시하거나 다른 plan 의 후속 항목을 무효화한 사례는 발견되지 않았다. 남은 것은
plan lifecycle 상의 경미한 hygiene 항목(INFO) 하나뿐이다.

## 위험도

NONE
