# Plan 정합성 검토 — spec-draft-raw-query-results.md

## 발견사항

- **[WARNING]** `node-cancellation.md` §6 구현 현황 표의 "mutation N/N 검증" 과대 주장이 소급 각주 대상에서 빠졌다
  - target 위치: `plan/in-progress/spec-draft-raw-query-results.md` §B (소급 각주 5건 표, 5번째 행) · §C (`node-cancellation.md` frontmatter)
  - 관련 plan: `plan/in-progress/retry-turn-terminal-guard.md:45-48` · `plan/in-progress/update-returning-tuple-shape.md` §후속 `[planner 위임]` 소급 각주 항목
  - 상세:
    - `retry-turn-terminal-guard.md` 는 자신의 spec 각주 필요를 `update-returning-tuple-shape.md` 의 `[planner 위임]` 소급 각주 5번째 항목에 명시적으로 위임했다: "`spec/conventions/node-cancellation.md:198` §2.4 의 '✓ mutation 13/13 검증' 서술도 이 mock 경계 안쪽만 반영한다 — 각주 갱신은 `update-returning-tuple-shape.md` §후속의 **[planner 위임] 소급 각주 5번째 항목**으로 등재했다(**196·197행도 같은 반환값에 의존**)."
    - 그런데 `update-returning-tuple-shape.md` 본문 전체를 검색해도(`grep -n "mutation 13/13\|mutation 6/6\|196\|197행\|구현 현황\|§6"`) 이 위임을 받았다는 흔적이 **0건**이다. 그 소급 각주 5번째 항목은 `node-cancellation.md` **§2.4 프로즈(불릿 나열)** 만 지목하고(`"§2.4 는 메커니즘 4개를 불릿으로 나열한다"`), **§6 "구현 현황" 표는 언급하지 않는다.**
    - target 문서(`spec-draft-raw-query-results.md`) 는 그 소급 각주 5번째 항목을 그대로 이어받아 "§2.4 네 번째 불릿"(프로즈, 현재 `spec/conventions/node-cancellation.md:97-102`) 에만 caveat 을 건다. §6 표의 두 행 — `node-cancellation.md:197`("§2.4 park↔resume 짝 전이 terminal 가드", `mutation 6/6 검증`) 과 `:199`("§2.4 retry 재진입 종결 경로 terminal 가드", `mutation 13/13 검증`) — 은 target 초안에 전혀 등장하지 않는다.
    - 이게 실제 결함인지 소스로 직접 확인했다. `:197` 행이 이름을 든 `failFirstSegmentSetup`·`finalizeFailedExecution` (둘 다 `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`) 은 각각 `const persisted = await this.updateExecutionStatus(row, ...)` 뒤 `if (!persisted) { ...emit skip...; return; }` 패턴이다 — target 문서 §B 가 "12곳/3파일" 로 이미 집계한 바로 그 `updateExecutionStatus`/`persisted` 반환값 분기이고, retry 재진입 행(`finalizeGuarded`/`resumeGraphAfterRetry`, 2곳)과 **완전히 동일한 결함 클래스**다. 즉 `:197` 행의 "mutation 6/6 검증" 도 "mock 경계 안쪽만 반영" 이라는 같은 caveat 이 필요하고, retry-turn-terminal-guard.md 가 정확히 그렇게 요청했다.
    - 결과적으로 두 plan 을 거치며 위임이 한 칸씩 좁아졌다: retry-turn-terminal-guard.md → "2개 표 행 정정" 요청 → update-returning-tuple-shape.md 의 위임 등재 → "§2.4 프로즈 1곳" 으로 축소 → target 초안 → 동일하게 "§2.4 프로즈 1곳" 만 반영. §6 표의 두 "mutation N/N 검증" 문구는 이 draft 가 실행돼도 **과신을 주는 상태 그대로 남는다**.
  - 제안: target §B 표에 6번째 소급 각주 대상을 추가한다 — `spec/conventions/node-cancellation.md` §6 표 `:197`("mutation 6/6 검증") 과 `:199`("mutation 13/13 검증") 두 행에, "이 mutation 수치는 driver mock 경계 안쪽만 검증했고 실제 프로덕션 반환값(TypeORM RETURNING 튜플)은 `#1168`(2026-08-13) 이전까지 항상 `true` 였다" 는 취지의 각주를 붙인다. §2.4 프로즈 caveat 은 유지하되 그것만으로 §6 표의 과신 문구를 대체하지 않는다는 점을 명시할 것. `retry-turn-terminal-guard.md` 쪽에도 "위임이 실제로 반영됐는지" 를 재확인하는 라인을 남기는 게 안전하다(현재 그 plan 은 "등재했다" 는 문구만 믿고 자신의 의무가 끝났다고 서술한다).

- **[INFO]** 소급 각주 대상 개수("12곳 vs 11곳")가 source plan 트래커에는 아직 정정되지 않았다
  - target 위치: `plan/in-progress/spec-draft-raw-query-results.md` §B "영향 범위 실측 (2026-08-30)" 콜아웃 — "**트래커의 '11곳' 은 낡았다**"
  - 관련 plan: `plan/in-progress/update-returning-tuple-shape.md` §후속 `[planner 위임]` 소급 각주 2번째 항목의 "영향 있음 — 11곳/3파일" 표(현재 파일에서 `finalizeCancelledExecution` 누락 상태 그대로 남아 있음)
  - 상세: target 은 소스 plan 의 "11곳" 표가 `#1172`(2026-08-15, `finalizeCancelledExecution` 추가) 로 낡았음을 정확히 진단하고 정정된 "12곳" 을 스스로 계산해 실었다 — 이 부분은 **정합적**이다. 다만 target 초안이 반영되어도 `update-returning-tuple-shape.md` 본문에 박제된 "11곳" 표 자체는 그대로 남는다. 이 plan 이 나중에 `complete/` 로 이동할 때 그 표를 읽는 사람은 다시 낡은 숫자를 마주친다.
  - 제안: target 실행(또는 그 뒤속 커밋)에서 `update-returning-tuple-shape.md` 의 "11곳" 표도 "12곳" 으로 갱신하거나, 최소한 target 이 이미 단 콜아웃과 동일한 정정 배너를 그 표 바로 아래 추가할 것. 필수는 아니나 이번 draft 가 이미 실측을 갖고 있으므로 비용이 낮다.

- **[INFO]** node-cancellation.md `pending_plans` frontmatter 갱신(C 항목)은 현재 상태와 정합
  - target 위치: `plan/in-progress/spec-draft-raw-query-results.md` §C
  - 관련 plan: 실측 확인 — `spec/conventions/node-cancellation.md` frontmatter 의 `pending_plans:` 는 현재 `node-cancellation-residual-signal-propagation.md` 한 건만 등재돼 있다(target 의 서술과 일치). `update-returning-tuple-shape.md` 추가는 `status: partial` + `spec-pending-plan-existence.test.ts` 가드와 충돌 없이 정합적이다.
  - 상세: 문제 없음 — 확인 목적으로만 기록.

## 요약

target 초안은 `update-returning-tuple-shape.md` 의 `[planner 위임]` 두 항목(규약 승격 + 소급 각주 5건)을 대체로 충실히 집행하고, 특히 "11곳→12곳" 갱신처럼 자기 소스 plan 의 낡은 숫자를 스스로 재검증해 반영한 점은 견고하다. 그러나 **`retry-turn-terminal-guard.md` 가 `update-returning-tuple-shape.md` 경유로 명시 위임한 `node-cancellation.md` §6 "구현 현황" 표의 두 "mutation N/N 검증" 과대 주장 정정이 두 plan 을 거치며 누락**됐다 — 실제 소스 코드로 확인한 결과 그 표의 "park↔resume 짝 전이"(mutation 6/6) 행은 retry 재진입 행(mutation 13/13, target 이 이미 caveat 을 단 대상)과 동일한 `updateExecutionStatus`/`persisted` 반환값 분기 결함 클래스다. 이 draft 가 그대로 실행되면 §6 표는 여전히 무조건적 "✓ ... 검증됨" 으로 읽혀, 이번 PR 이 처음부터 진단한 문제 패턴("caveat 을 한 곳에만 걸어 반대 방향 drift 를 만든다")이 §6 표에서 재현된다.

## 위험도

MEDIUM
