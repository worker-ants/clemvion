# Plan 정합성 검토 — impl-done (scope=`spec/5-system/`, diff-base=`origin/main`)

전제: 이번 diff 는 `spec/5-system/` 을 1바이트도 바꾸지 않는다(`git diff origin/main...HEAD -- spec/5-system/` 결과 없음). 실제 코드 변경은 `execution-engine.service.ts`·`knowledge-base.service.ts`·`auth-oauth.service.ts` + 신설 `update-returning-rows.ts` 헬퍼이며, 이는 `plan/in-progress/update-returning-tuple-shape.md` (P1, `UPDATE/DELETE … RETURNING` 튜플 shape 오독 수정)의 산출물이다. 따라서 본 검토는 "target 이 무엇을 새로 결정했는가"가 아니라 "target(spec/5-system) 이 이 코드 수정 이후에도 여전히 정확하고, 관련 plan 들의 후속이 빠짐없이 반영됐는가"를 확인하는 형태가 된다.

## 발견사항

- **[WARNING]** `retry-turn-terminal-guard.md` 의 핵심 방어 메커니즘이 정확히 같은 `persisted` 버그 위에서 12+ 라운드를 검증해 왔는데, 이번 소급 조사에서 빠졌다
  - target 위치: `spec/5-system/4-execution-engine.md` §1.1 (line 82-105, "짝 전이는 방향과 무관하게 no-op 이 될 수 있다" / "`finalizeFailedExecution` 등 terminal 마감 경로도 조건부 UPDATE… 를 거친다") — 이 문서의 frontmatter `pending_plans` 에 `plan/in-progress/retry-turn-terminal-guard.md` 가 명시돼 있어 target 범위 안이다.
  - 관련 plan: `plan/in-progress/retry-turn-terminal-guard.md` (started 2026-07-27, 12차 라운드까지 진행, 아직 `plan/complete/` 미이동), 그리고 이번 PR 의 `plan/in-progress/update-returning-tuple-shape.md` §"소급 영향" 절.
  - 상세: `retry-turn.service.ts:672` 의 `finalizeGuarded` 는 `this.driver.updateExecutionStatus(execution, target)` 을 호출해 `persisted` 를 받는다 — 이는 `execution-engine.service.ts` `updateExecutionStatus` else 분기(현재 line 8549 부근, 커밋 `1657c0435` 2026-06-14 도입 버그, 이번 PR 커밋 `8332d9a20` 2026-08-13 에서야 수정)와 **동일 함수·동일 버그 지점**이다. `retry-turn-terminal-guard.md` 는 제목 그대로 "retry-turn 종결 2경로의 무가드 terminal 쓰기 차단"이 목적이고, 1R~12R 내내 "동시 Stop 이 이미 CANCELLED 로 마감한 실행을 COMPLETED/FAILED 로 되돌리지 않는지" 를 mutation(`13/13 RED` 등)으로 검증했다고 기록했다. 그런데 그 라운드들(2026-07-27~2026-07-30)은 전부 버그 존속 구간(2026-06-14~2026-08-13) 안에 있다. `retry-turn.service.spec.ts` 는 `driver.updateExecutionStatus` 를 boundary mock 하므로 `finalizeGuarded` 자체의 분기 로직(― `persisted=false` 면 skip)은 정확히 검증됐지만, **그 mock 경계 너머 실제 프로덕션에서 `persisted` 가 무엇을 받았는지는 이 plan 의 어떤 라운드도 검사한 적이 없다** — 실제로는 늘 `true` 였으므로, 이 plan 이 "닫았다"고 선언한 "동시 cancel 방어"는 (idempotent 분기인 `target===CANCELLED`, TypeORM `UpdateResult.affected` 기반이라 버그 영향 밖인 경로 제외) 프로덕션에서 한 번도 실제로 발동하지 않았을 가능성이 있다. `plan/in-progress/update-returning-tuple-shape.md` 의 "소급 영향" 절은 `ie-resume-turn-boundary-cancel.md` 만 조사·정정했고(그 결과는 이미 배너로 반영됨), 더 직접적으로 같은 메커니즘에 의존하는 `retry-turn-terminal-guard.md` 는 언급이 없다. `retry-turn-terminal-guard.md` 본문에도 `8332d9a20`/tuple/persisted 관련 언급이 전무함을 grep 으로 확인했다.
  - 제안: `update-returning-tuple-shape.md` 의 "소급 영향" 절 대상에 `retry-turn-terminal-guard.md` 를 추가하고, 그 plan 에 `ie-resume-turn-boundary-cancel.md` 와 동일한 형태의 소급 정정 배너("1R~12R 이 'guarded UPDATE 가 레이스를 닫는다'고 검증한 것은 실제 `persisted` 계산이 상수 `true` 였던 구간과 겹친다 — `8332d9a20` 이후 재검증 필요")를 developer 턴에서 등재할 것. 완료(`plan/complete/`) 이동 전 재검증이 필요하다는 점도 명시.

- **[WARNING]** 소급 footnote 위임 범위가 execution-engine 한 곳으로만 좁혀져, 동일 버그가 깨뜨렸던 knowledge-base CAS 락 spec 서술은 누락
  - target 위치: `spec/5-system/8-embedding-pipeline.md` §7.3 (line 260-264, 386-392 — "결과가 0행이면 `409 KB_REEMBED_IN_PROGRESS`" / "…RETURNING id 으로 race-free"), `spec/5-system/10-graph-rag.md` line 565 ("`re-extract` 동시 호출 | DB 컬럼(`reextract_status`) atomic compare-and-swap 으로 차단, 409 `KB_REEXTRACT_IN_PROGRESS`")
  - 관련 plan: `plan/in-progress/update-returning-tuple-shape.md` §"후속" — "`[planner 위임] spec/5-system/4-execution-engine.md §1.1` 인근 Rationale 에 소급 각주 한 줄" 항목.
  - 상세: 이 PR 이 고친 8곳 중 실제로 KB CAS 락 2곳(`재추출`/`재임베딩`)은 위 두 spec 문서가 이미 "atomic CAS·race-free·0행→409" 라고 명시적으로 서술한 바로 그 계약이다(코드는 spec 대로 동작하지 않고 있다가 이번에 spec 대로 고쳐졌다). `4-execution-engine.md §1.1` 은 이미 유사한 소급 footnote 선례(line 91-99, retry-reentry opt-in 미전파 사례 — "실제로 2026-07-30 까지 그 상태였다")를 갖고 있어, 같은 서술 관행을 이 두 파일에도 적용하는 것이 일관적이다. 그런데 plan 의 위임 항목은 execution-engine.md 하나만 명명하고 있어, planner 가 그 항목만 처리하면 KB spec 쪽 이력은 영구히 기록되지 않는다 — plan 자신의 Rationale 이 "이 저장소는 이미 이 결함을 세 번 겪었고 매번 그 자리만 고쳤다" 고 명시한 바로 그 패턴의 네 번째 재발 소지.
  - 제안: `update-returning-tuple-shape.md` §"후속" 의 planner 위임 항목을 `spec/5-system/4-execution-engine.md §1.1` 뿐 아니라 `spec/5-system/8-embedding-pipeline.md §7.3`·`spec/5-system/10-graph-rag.md` (동시 호출 표) 까지 확장 기재.

- **[INFO]** `plan/in-progress/update-returning-tuple-shape.md` 체크리스트 `[ ] /ai-review` 항목이 stale — 이미 완료된 라운드가 미체크 상태로 남아 있음
  - target 위치: 해당 plan 파일 자체(간접적으로 위 두 WARNING 의 후속 픽업 속도에 영향)
  - 상세: 같은 diff 안에 `review/code/2026/08/13/20_36_35/RESOLUTION.md`(CRITICAL 2 fix 완료, WARNING 8건 처분)가 이미 존재하고, 그 라운드의 CRITICAL #1 fix 는 커밋 `08d3c7fa3`("소셜 로그인이 상시 실패…")로 반영됐다. 본문 표(line 53)도 `ai-review 20_36_35 CRITICAL 1` 을 과거형으로 인용한다. 그럼에도 체크리스트(line 150)는 여전히 `- [ ] /ai-review` 로 남아 있다.
  - 제안: 체크박스를 `[x]` 로 정정하고 참조를 `review/code/2026/08/13/20_36_35` 로 명시. 미해결로 오인돼 위 두 WARNING 의 planner 픽업이 지연되지 않도록.

## 요약

이번 diff 는 `spec/5-system/` 을 직접 건드리지 않으므로 "미해결 결정 우회"(CRITICAL) 유형의 충돌은 없다. 다만 이 PR 이 고친 버그(`UPDATE/DELETE … RETURNING` 튜플 오독, 2026-06-14~2026-08-13 존속)는 `spec/5-system/4-execution-engine.md §1.1`·`8-embedding-pipeline.md §7.3`·`10-graph-rag.md` 가 이미 서술한 계약을 실제로는 지키지 못하고 있던 구간이었고, 이미 한 차례(이전 라운드 `20_36_36`) `ie-resume-turn-boundary-cancel.md` 에 대한 소급 정정이 이뤄졌다. 그러나 그 소급 조사는 완전하지 않다 — `retry-turn-terminal-guard.md` 는 같은 함수(`updateExecutionStatus` else 분기)에 12+ 라운드를 의존한 더 직접적인 당사자인데도 빠졌고, KB CAS 락에 대한 두 spec 문서의 병렬 서술도 footnote 위임 범위 밖에 있다. CRITICAL 은 없으나, "후속 항목 누락" 성격의 WARNING 2건이 실질적이다 — 이번 발견을 반영하지 않고 관련 plan 들이 `plan/complete/` 로 이동하면 spec 이 여전히 부정확한 이력을 가진 채 종결될 위험이 있다.

## 위험도

MEDIUM
