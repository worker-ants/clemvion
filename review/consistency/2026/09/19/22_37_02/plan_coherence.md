# Plan 정합성 검토 — `spec/4-nodes/4-integration/`

## 검토 맥락

이 `--impl-done` 라운드의 target(`spec/4-nodes/4-integration/`)은 `origin/main` 대비 **spec 델타 0** —
코드만 바꾼 PR 이다. 작업의 근거 plan 은 `plan/in-progress/ssrf-guard-integration-unify.md`
(frontmatter `spec_impact: none`, worktree 일치): "코드를 spec 에 맞춘다 — spec 변경 없음" 을 명시적으로
선언하고 있어, spec 델타 0 은 이 plan 의 **의도된 결과**다.

## 발견사항

이번 라운드에서 CRITICAL/WARNING 급 plan 정합성 문제는 발견되지 않았다.

- **[INFO]** SSRF 통합 결정(2026-06-11 opt-out 통일 · 2026-07-05 메시지 일반화)이 target 문서
  (`1-http-request.md` §8.2/§8.3, `2-database-query.md` Rationale, `3-send-email.md` §4 step 7/§8.0)에
  이미 반영돼 있고, `plan/in-progress/ssrf-guard-integration-unify.md` 의 실측(`http-safety.ts` vs
  `ssrf.util.ts` 두 가드 불일치 — CGNAT · IPv4-mapped IPv6)은 "spec 문언이 이미 맞고 코드가 틀렸다" 는
  전제로 코드만 고치는 방향을 잡았다. target 위치: `1-http-request.md` §4 step 8 · §8.2, `3-send-email.md`
  §4 step 7. 관련 plan: `plan/in-progress/ssrf-guard-integration-unify.md` "실측" · "할 것" 절. spec 이
  "결정 필요" 로 남긴 항목을 이 변경이 우회하거나 대신 결정하지 않았음을 확인했다 — 오히려 기존
  spec Rationale(§8.2 "기각된 대안", `spec/2-navigation/4-integration.md` §Rationale "SMTP SSRF 가드를
  http/db 와 동일 `ALLOW_PRIVATE_HOST_TARGETS` 로 통일")이 이미 내린 결정을 코드가 뒤늦게 따라간
  형태다. 제안 없음 — 정합.

- **[INFO]** LLM/S3 의 `ssrf.util.ts` (CGNAT · `[::]` 미차단)는 target 범위 밖으로 명시적으로
  "비대상" 처리됐고(`ssrf-guard-integration-unify.md` "비대상" 절), 별도 미해결 결정으로
  `plan/in-progress/spec-draft-nullable-notation-followups.md` 트래커에 "LLM 프로바이더 · S3 의 SSRF
  가드(`ssrf.util.ts`)가 CGNAT · `::` 를 막지 않는다 — 막을지 정한다" (planner 결정 대기)로 신규
  등재돼 있다. target 문서(`spec/4-nodes/4-integration/1-http-request.md` §4 step 8 콜아웃)는 "AI Agent
  의 MCP 서버는 별개 정책(`MCP_ALLOW_INSECURE_URL`)을 사용한다" 고만 서술해 LLM/S3 SSRF 가드를
  통합했다고 주장하지 않는다 — 미해결 결정을 앞질러 확정하지 않았다. 정합.

- **[INFO]** `plan/in-progress/spec-draft-nullable-notation-followups.md` 는 이번 세션에서 두 항목을
  `[x]` 로 표시하며 `plan/complete/ssrf-guard-integration-unify.md` 를 근거로 인용하지만(트래커
  4777~4784행, 4866~4871행), 실제로는 `plan/in-progress/ssrf-guard-integration-unify.md` 가 아직
  `in-progress/` 에 있고 그 체크리스트의 마지막 세 항목(`/ai-review` 수렴 · `--impl-done` · "트래커 두
  항목 해소 + 이 plan `plan/complete/` 로")이 미완료(`[ ]`)다. 두 plan 파일 모두 아직 **커밋되지 않은
  로컬 수정**(`git status`: 두 파일 모두 `M`, 관련 커밋 없음)이라 — plan 자신의 체크리스트가 명시한
  "트래커 해소 + `complete/` 이동을 한 동작으로" 관행대로, 이번 `--impl-done` 통과 확인 뒤 마무리
  커밋에서 두 문서가 함께 정리될 것으로 보인다. 지금 시점의 서술은 아직 "예정" 을 과거형으로 적어
  선반영한 상태이므로, **`/ai-review` 수렴과 `--impl-done` 을 이 라운드에서 통과시키지 못하면 트래커의
  이 두 항목 서술을 되돌려야 한다**는 점만 남긴다. target(spec) 자체와는 무관.

## 요약

target(`spec/4-nodes/4-integration/`)은 이번 PR 에서 변경되지 않았고, 그 spec 델타 0 은
`plan/in-progress/ssrf-guard-integration-unify.md`(`spec_impact: none`)가 "코드를 이미 맞는 spec 문언에
맞춘다"는 의도로 설계한 그대로다. spec 이 이미 서술한 CGNAT · IPv4-mapped IPv6 차단, SSRF 가드
opt-out 플래그 통일, LLM/S3 비대상 처리는 모두 plan 의 실측·비대상 결정과 정합하며, 어떤 미해결
"결정 필요" 항목도 이 변경으로 일방적으로 결론 나지 않았다. 유일하게 주목할 점은 이 plan 과
연계 트래커(`spec-draft-nullable-notation-followups.md`)가 아직 `--impl-done`/`/ai-review` 완료 전에
"해소" 서술을 앞당겨 적어 둔 것인데, 두 파일 모두 미커밋 상태라 마무리 커밋에서 함께 정리될
것으로 판단되며 지금 시점에 조치가 필요한 결함은 아니다.

## 위험도

NONE
