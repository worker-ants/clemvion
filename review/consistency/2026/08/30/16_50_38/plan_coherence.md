# Plan 정합성 검토 — spec-draft-raw-query-results.md

## 발견사항

- **[WARNING]** §D 의 `pending_plans` 등재 범위가 자매 집결 티켓의 명시 지시보다 좁은데 "값 동일"로 오기술하고, 반영 후 그 지시를 지우려 한다
  - target 위치: `plan/in-progress/spec-draft-raw-query-results.md` §D (`node-cancellation.md` frontmatter)
  - 관련 plan: `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` §"추가 위임 (2026-08-14 #12)" 말미의 "**부수**" 문단(파일 내 664행 부근)
  - 상세: target §D 는 `node-cancellation.md` 한 곳에만 `pending_plans: update-returning-tuple-shape.md` 를 추가하겠다고 적고, "같은 지시가 자매 집결 티켓에도 있다(값 동일, 충돌 아님). 반영 후 그쪽 항목을 소거한다" 라고 서술한다. 그러나 자매 티켓의 실제 문구는 "대상은 위 표의 5개 문서 전부다(checker 는 execution-engine.md·node-cancellation.md 둘만 짚었으나, caveat 을 받는 문서는 다섯이고 기준이 같다)" — 즉 target §B 가 각주를 붙이는 5개 문서(`4-execution-engine.md`·`8-embedding-pipeline.md`·`10-graph-rag.md`·`data-flow/2-auth.md`·`node-cancellation.md`) 전부에 `pending_plans` 등재를 요구한다. 실측 결과 `spec/data-flow/2-auth.md` 는애초에 frontmatter(`id`/`status`/`pending_plans`) 자체가 없는 문서 부류(`spec/data-flow/` 는 `spec-frontmatter-parse.ts` 의 `INCLUDE_PREFIXES` 밖)라 이 요구가 적용되지 않지만, 나머지 **`4-execution-engine.md`(이미 partial + pending_plans 목록 보유, 대상 plan 미등재)**·`8-embedding-pipeline.md`(`status: implemented`, pending_plans 필드 자체 없음)·`10-graph-rag.md`(동일) 세 문서는 이 frontmatter 스킴을 실제로 쓰고 있어 자매 티켓의 지시가 여전히 유효하다. target 은 이 셋을 다루지 않으면서 "값 동일"이라 단정하고, 자매 티켓의 해당 지시를 "반영 후" 삭제하겠다고 한다 — 실제로는 1/5(또는 frontmatter 가 있는 4곳 중 1곳)만 반영하고 나머지 지시를 근거 없이 지우는 셈이라, 이 스펙 초안이 집행되면 execution-engine.md·embedding-pipeline.md·graph-rag.md 세 문서의 `pending_plans` 등재 요구가 조용히 유실된다.
  - 제안: target §D 를 "5개 문서 중 frontmatter 스킴을 가진 4곳(`node-cancellation.md`·`4-execution-engine.md`·`8-embedding-pipeline.md`·`10-graph-rag.md`) 전부에 등재, `data-flow/2-auth.md` 는 스킴 부재로 제외" 로 확장하거나, 범위를 좁게 유지할 경우 자매 티켓의 "부수" 문단은 소거하지 말고 "node-cancellation.md 는 완료, 나머지 3곳은 잔존"으로 축소만 할 것.

- **[WARNING]** §E "두 `[planner 위임]` 항목을 체크한다"가 트래커의 실제 항목 수(3개)와 다르고, §A 가 이미 해소하는 세 번째 항목이 빠져 있다
  - target 위치: `plan/in-progress/spec-draft-raw-query-results.md` §E (원본 트래커 갱신)
  - 관련 plan: `plan/in-progress/update-returning-tuple-shape.md` §후속 — `- **[planner 위임]**` 표기 바로 3곳(397행 "raw SQL 결과 shape 을 규약으로 승격", 406행 "소급 각주 — 대상이 한 문서가 아니다", 457행 "같은 결함이 세 번 개별 발생했는데 invariant 가 `spec/conventions/` 에 없다")
  - 상세: `grep -n '\[planner 위임\]'` 실측 결과 트래커에 라벨이 붙은 위임 항목은 397·406·457행 **셋**이다. target §A(신규 `raw-query-results.md`)는 397행 항목뿐 아니라 457행 항목("raw UPDATE/DELETE RETURNING 소비는 `updateReturningRows` 경유"를 정식 규약으로 승격할지 판단)도 문자 그대로 같은 요청이라 동일하게 해소한다. 그런데 target §E 는 "두 항목을 체크한다"고만 적어 397·406행(§A·§B 대응)만 지목하고 457행은 언급이 없다 — 실행되면 트래커에 처리되지 않은 것처럼 보이는 위임 항목이 하나 남아, 다음 스윕이 "아직 규약 승격 판단이 안 됐다"고 오인해 §A 와 중복되는 작업을 다시 열 위험이 있다.
  - 제안: §E 서술을 "세 [planner 위임] 항목을 체크한다(397·406·457행 — 457행은 397행과 동일 요청이라 §A 로 함께 해소)"로 정정.

## 요약

target 스펙 초안은 자신이 직접 위임받은 두 트래커(`update-returning-tuple-shape.md`)의 caveat 위치·§2.4 앵커·§7.3/§10 위치 지정 등은 실측으로 정확히 검증돼 있고, §C(OAUTH_STATE_MISMATCH 카탈로그 등재)가 자매 집결 티켓에서 스코프를 가져온 근거도 타당하다. 다만 두 지점에서 **후속 항목 완결성**이 새는데, 둘 다 "이미 등재된 다른 plan/트래커의 항목을 이번 초안이 조용히 축소·소거하면서 그 사실을 정확히 서술하지 않는" 같은 패턴이다 — §D 는 자매 티켓이 5문서(실질 4문서) 대상이라 명시한 것을 1문서로 줄이고도 "값 동일"이라 적고, §E 는 트래커에 3개 있는 `[planner 위임]` 항목 중 2개만 세어 나머지 하나를 미체크 상태로 방치한다. 두 건 모두 "결정 필요" 항목을 우회하는 CRITICAL 은 아니지만, 이 초안이 그대로 집행되면 다른 plan/spec 문서에 등재됐어야 할 후속 추적이 유실되므로 반영 전 정정이 필요하다.

## 위험도

MEDIUM
