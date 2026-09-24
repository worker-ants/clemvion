# Plan 정합성 검토 — `spec-draft-frontmatter-pending-plans.md`

## 발견사항

- **[WARNING]** `update-returning-tuple-shape.md` pending_plans 제거가 다른 in-progress plan 의 "완료" 기록을 소급 무효화한다
  - target 위치: §C 적용 표 (`8-embedding-pipeline.md`/`10-graph-rag.md`/`4-execution-engine.md` 세 곳에서 `update-returning-tuple-shape.md` 를 `pending_plans` 에서 제거)
  - 관련 plan: `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` "추가 위임 (2026-08-14 #12)"
  - 상세: 세 문서의 `pending_plans: - plan/in-progress/update-returning-tuple-shape.md` 항목은 target 이 서술하듯 `5fbcd20b8` 의 우발적 부작용이 아니다 — `#12` 가 명시적으로 "부수: frontmatter `pending_plans:` 에 `update-returning-tuple-shape.md` 등재. 대상은 위 표의 5개 문서 전부다"라고 지시했고, 실측으로 확인한 바 **"✅ 완료 (2026-08-30, planner 턴) — 등재 가능한 4곳 전부 반영했다: `node-cancellation.md`·`4-execution-engine.md`·`8-embedding-pipeline.md`·`10-graph-rag.md`"** 로 기록돼 있다. 등재 이유도 명시돼 있다 — "`spec-pending-plan-existence.test.ts` 는 한 방향 가드다 … 문서가 관련 plan 을 등재하도록 강제하지 않는다 … 가드가 잡아주지 않는 규율이라 여기 적어두지 않으면 조용히 사라진다." target 이 그대로 집행되면 이 "4곳 전부 반영" 기록 중 3곳이 소리 없이 무효가 되는데, `#12` 문서 자신은 여전히 "완료"라고 말한다 — target 어디에도 `#12`/이 plan 파일에 대한 언급이 없다.
    - 특히 `4-execution-engine.md` 는 §1.1 본문(line 64)에 "전수 목록은 `plan/in-progress/update-returning-tuple-shape.md` 가 정본"이라고 **스스로** 명시한다. 즉 이 문서에서 그 항목은 R-11 이 판별 기준으로 삼는 "미구현 surface" 여부와 별개로, **본문이 그 plan 을 살아있는 SoT 로 계속 참조**하는 구조다. `pending_plans` 제거는 R-5 관점("미구현 surface 0")으로는 정당하지만, 그 결과 `spec-pending-plan-existence.test.ts` 는 이 특정 "정본" 포인터의 실존을 더 이상 추적하지 않게 된다(실측: 해당 guard 는 frontmatter `pending_plans` 배열만 보고 본문 텍스트는 보지 않음 — `spec-pending-plan-existence.test.ts:23-51`). 마침 `node-cancellation.md` 가 같은 plan 을 계속 참조해 시스템 차원에서는 안전망이 우연히 유지되지만, target 은 이 연결을 언급하지 않는다.
  - 제안: target §C 또는 §체크리스트에 `spec-update-node-cancellation-shutdown-classification.md` #12 항목을 갱신하는 작업(예: "3/4 등재가 이후 정합성 정정으로 제거됨 — 사유: `implemented` 상태는 R-5 상 `pending_plans` 를 가질 수 없고, `4-execution-engine.md` 는 R-11 판정으로 미구현 surface 0")을 명시적으로 추가한다. 이 draft 와 `#12` 는 둘 다 project-planner 소유라 같은 턴에 처리 가능하다.

- **[INFO]** `node-cancellation.md` 는 같은 `#12` 등재의 4곳 중 하나인데 target scope 밖으로 남는다 — 비대칭이 설명되지 않음
  - target 위치: target 본문 전체 (spec_impact 3파일 목록에 `spec/conventions/node-cancellation.md` 없음)
  - 관련 plan: `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` #12 (동일 등재 지시), 실측: `spec/conventions/node-cancellation.md` frontmatter 는 여전히 `pending_plans: [node-cancellation-residual-signal-propagation.md, update-returning-tuple-shape.md]`, `status: partial`
  - 상세: `node-cancellation.md` §2.4 소급 각주는 다른 세 문서와 달리 "전수 목록은 `update-returning-tuple-shape.md` §후속의 표가 정본"이라며 **아직 움직이는 리스트**(11곳/3파일, 실제로 한 차례 12로 오인됐다가 정정된 이력 있음)를 그 plan 에 위임하고 있어, 세 문서의 "닫힌 역사적 사실" 성격과 다르게 읽을 여지가 있다. 이 구분이 실제로 타당한 근거인지, 아니면 같은 §B R-11 판정이 여기도 적용돼야 하는지 target 이 전혀 검토하지 않는다. 다음 `--spec`/`--impl-done` 라운드에서 "왜 node-cancellation.md 만 다르게 취급했나"가 다시 지적될 위험이 있다.
  - 제안: target §B 또는 §D 에 한 줄로 "`node-cancellation.md` 는 같은 트래커를 참조하지만 본문이 그 plan 을 여전히 움직이는 리스트의 정본으로 지목하므로 이번 스코프에서 제외한다"는 명시적 근거를 남기거나, 동일 R-11 판정을 적용해 함께 정리한다.

## 다른 확인 사항 (문제 아님 — 실측으로 정합성 검증됨)

- A-1(그래프-rag 마이그레이션 3파일 오염), A-3(exec-intake-followups.md 가 이미 `plan/complete/` 로 완전히 이동·체크박스 0개 잔존)의 실측 서술은 저장소 현재 상태와 정확히 일치한다.
- A-2 의 "`implemented` 상태엔 `pending_plans` 없음" 규칙은 `spec-impl-evidence.md` 최초 커밋(#287, 2026-05-23경)부터 있던 규칙이며 `spec-status-lifecycle.test.ts` 는 `implemented`/`archived` 에는 idle(가드 없음) — target 의 "CI 가 못 잡는다" 서술과 일치한다.
- §B 의 R-11 여섯 항목 표는 `update-returning-tuple-shape.md` 실제 체크리스트(§후속) 6건과 문구·순서까지 정확히 일치한다.
- "가드 영향 확인"(spec-status-lifecycle (b)(c) 는 `partial` 에만 적용)도 가드 소스와 일치한다.
- `execution-engine-residual-gaps.md`·`retry-turn-terminal-guard.md` 둘 다 실제로 `status: in-progress` 로 남아 있어, 제거 후에도 `4-execution-engine.md` 가 (c) 승격 의무에 걸리지 않는다는 서술도 맞다.

## 요약

target 의 세 자리 실측(A-1/A-2/A-3)과 R-11 판정(§B)은 근거가 탄탄하고 저장소 현재 상태와 정확히 부합한다. 다만 target 이 "우발적 오염"으로 서술하는 `update-returning-tuple-shape.md` pending_plans 항목은 실제로는 다른 아직 열려 있는 planner plan(`spec-update-node-cancellation-shutdown-classification.md` #12)이 2026-08-30 에 의도적으로, 4개 문서에 걸쳐 등재한 결정이며 그 plan 은 "완료"로 기록돼 있다. target 을 그대로 집행하면 그 완료 기록의 3/4 이 소리 없이 거짓이 되고, 4번째(node-cancellation.md)만 남는 비대칭도 설명되지 않는다. `implemented` 상태의 `pending_plans` 제거 자체(R-5 근거)와 `4-execution-engine.md` 의 R-11 판정은 규약상 타당하므로 결론을 뒤집을 필요는 없지만, 이 draft 가 `#12` 를 인용하며 그 plan 의 해당 기록을 함께 갱신하지 않으면 "후속 항목 누락" 이 새로 생긴다.

## 위험도

MEDIUM
