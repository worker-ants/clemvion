STATUS=success plan_coherence — CRITICAL 0 / WARNING 0

===REPORT_MARKDOWN_BELOW===

# Plan 정합성 검토 — `spec/5-system/` (impl-done)

## 배경

`git diff origin/main...HEAD -- spec/**` 는 0건 — 이번 diff 는 순수 코드 결함 수정 +
plan 문서 갱신이다. 이 세션(`00_54_07`)이 보는 HEAD(`e34a85b44`)는 두 차례 선행
plan_coherence 회차(`00_00_45` WARNING 2 → `00_20_22` 반영 확인, CRITICAL 0/WARNING 0,
LOW) 이후 새로 추가된 커밋이다:

- `a53af772b` — `spec-update-node-cancellation-shutdown-classification.md` 에
  `OAUTH_STATE_MISMATCH` 카탈로그 등재 위임 항목 추가 (`00_20_22` cross_spec INFO 2 반영)
- `e34a85b44` — `auth-oauth.service.ts` 의 별개 결함(raw pg row 는 snake_case 인데
  `record.rememberMe` 로 읽어 "로그인 유지" 가 항상 무시됨) 수정. `update-returning-tuple-shape.md`
  본문·체크리스트에 상세 반영, `spec-update-node-cancellation-shutdown-classification.md`
  #12 표의 caveat 문구를 "11곳/3파일" 최종본으로 정정

## 검증한 것

1. **`00_00_45`/`00_20_22` 가 지적한 두 WARNING 이 실제로 반영됐는지 재확인** — 반영 확인.
   `exec-intake-followups.md`(admission 소급 배너), `spec-update-node-cancellation-shutdown-classification.md`
   `#12`(5건 spec 각주 집결) 모두 diff 에 존재하고 서술도 정확하다.
2. **`e34a85b44` 의 rememberMe 수정이 target(spec/5-system/) 이 서술한 보장과 충돌하는지** —
   충돌 없음. 관련 보장(`spec/1-data-model.md:686` "만료 시각 … rememberMe 시 30일")은
   target 범위 밖이고, 이 버그의 노출 창은 **한 번도 프로덕션에 나간 적이 없다** — 상위
   tuple-shape 버그(`consumed.length === 0` always-true, 8332d9a20 이전)가 모든 OAuth
   콜백을 100% 실패시켜 `record.rememberMe` 줄 자체가 도달 불가능한 죽은 코드였고,
   `8332d9a20`(20:36)→`e34a85b44`(00:53) 사이 ~4시간은 전부 이 미병합 브랜치 내부다.
   따라서 이미 등재된 `spec/data-flow/2-auth.md` 캐비엇("소셜 로그인이 상시 실패였다")이
   이 사건 전체(로그인 실패 + rememberMe 무시)를 이력상 정확히 덮는다 — 별도 6번째
   spec 각주가 필요하지 않다(다른 5건과 달리 "다른 plan 이 이 버그 위에서 이미 완료를
   선언한" 사례가 없음).
3. **rememberMe 수정이 다른 in-progress plan 의 선행 조건·완료 선언과 충돌하는지** —
   `execution-engine-residual-gaps.md`·`node-cancellation-residual-signal-propagation.md`·
   `eia-context-schema-followups.md`·`harness-consistency-summary-downgrade-rule.md` 를
   `persisted`/`updateExecutionStatus`/RETURNING 키워드로 훑었다. 유일한 교차점
   (`node-cancellation-residual-signal-propagation.md:78` 의 `updateExecutionStatus`
   `linkedNodeExec` 언급)은 별개 메커니즘(무가드 full-entity `save()` 의 lost update)이라
   이번 tuple-shape 결함 클래스와 무관 — 충돌 없음.
4. **`update-returning-tuple-shape.md` 자신의 미해결 후속(②`updateExecutionStatus`
   트랜잭션화·③ EIA emit)** — "이 PR 뒤로 미룬다" 로 명시적으로 스코프 아웃돼 있고, 이
   plan 자신이 `in-progress` 로 남아 그 항목을 계속 보유하므로 다른 plan 에 흩어지거나
   누락될 위험이 없다.
5. **target 3개 문서(`4-execution-engine.md`·`8-embedding-pipeline.md`·`10-graph-rag.md`)의
   `pending_plans:` frontmatter** — 아직 `update-returning-tuple-shape.md` 를 갖고 있지
   않음을 재확인(직접 Read). 이는 `00_20_22` 가 이미 "신규 갭이 아니라 기지 pending 상태"로
   판정한 것과 동일 사안이고, `developer` 는 `spec/` 쓰기 권한이 없어 이번 PR 로는 반영
   불가 — CRITICAL/WARNING 승격 사안 아님(정상적 권한 경계, planner 턴 대기 중).

## 발견사항

없음. 직전 두 회차의 WARNING 은 이번 커밋들로 완전히 반영됐고, 최신 커밋(`e34a85b44`)이
새로 만든 서술도 target 의 어떤 기존 결정과도 충돌하지 않으며 새로운 후속 누락도 만들지
않는다.

## 요약

`update-returning-tuple-shape.md` family 는 이 세션에서만 plan_coherence 로부터 이미
두 라운드(`00_00_45`→`00_20_22`)의 WARNING 을 받아 정확히 반영했고, 그 위에 새로 얹힌
`rememberMe` 결함 수정(`e34a85b44`)도 같은 규율(소급 배경 설명·영향 범위 재확인·CHANGELOG
정정)을 유지한 채 target(`spec/5-system/`)의 어떤 서술과도 충돌 없이 마무리됐다. 이 결함은
프로덕션에 노출된 적이 없어(동일 미병합 브랜치 내부에서 발견·수정) 다른 5건과 같은
"완료 선언이 실은 버그 위에서 이뤄졌다" 유형의 소급 spec 각주가 추가로 필요하지 않다.
남은 항목(5개 문서 `pending_plans:` 등재, `[planner 위임]` 스윕)은 이미 plan 안에 명시적
pending 으로 정확히 포인터돼 있어 새로운 발견이 아니다. plan 정합성 관점에서 이 PR 을
막을 이유가 없다.

## 위험도
LOW
