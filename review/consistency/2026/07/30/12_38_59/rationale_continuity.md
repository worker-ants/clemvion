# Rationale 연속성 검토 — spec-update-retry-claim-backstop-gap.md

## 발견사항

- **[WARNING]** §7.5 Rationale 정정이 같은 문서 §7.3 "orphan row 마감" 서술과 상호 참조 없이 병존
  - target 위치: `plan/in-progress/spec-update-retry-claim-backstop-gap.md` "### After (제안)" 문단(줄 63-78, 특히 줄 70-71 "그 결과 discard 된 spawn row 자체는 RUNNING orphan 으로 영구 잔류할 수 있다"), 그리고 "## 함께 반영할 것" 절 줄 94-95 ("... 명시한 문장이 없다면 위 After 문단이 그 역할을 겸한다 — 별도 신규 절 불요")
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` §7.3 "멱등성 보장" 본문 줄 884 "orphan row 마감" 항목 — "옛 stale-fail 모델의 자식 RUNNING cascade 마감을 re-drive 진입 시점으로 옮겨 보존한 것 — **부모 Execution 종결 후 유령 `running` 노드가 타임라인/진행률 집계에 남지 않게 한다**." 이 문장의 설계 근거는 §Rationale "크래시/재시작 RUNNING 세그먼트 제어된 re-drive (PR3, 2026-07-04)"(줄 1407-1420, 특히 1413의 `failOrphanRunningNodeExecutions` 도입 근거)에 있다.
  - 상세: target 의 After 문단 자체(discard 시 recoverStuckExecutions 백스톱이 이 2차 claim discard 케이스에 닿지 않아 spawn row 가 RUNNING orphan 으로 "영구 잔류할 수 있다")는 코드 JSDoc(`retry-turn.service.ts` `claimSpawnedRetryRow`)·plan(`retry-turn-terminal-guard.md` #15)의 실측과 정확히 일치하며 조작된 이력도 없다(review/code/2026/07/30/11_41_20 SUMMARY WARNING #1 인용도 실제로 존재). 문제는 target 의 "함께 반영할 것" 절이 세운 전제다 — "orphan RUNNING spawn row 잔류 가능성 자체를 명시한 문장이 없다면"이라고 조건부로 적었으나, 실제로는 **같은 spec 문서 §7.3에 정반대로 읽히는 문장이 이미 존재한다**: "부모 Execution 종결 후 유령 running 노드가 ... 남지 않게 한다." 이 §7.3 문장은 PR3 의 case-B crash re-drive cascade cleanup(`failOrphanRunningNodeExecutions`, §7.5 case B 진입 시에만 발동)에 스코프된 것이지만, 문면 자체에는 그 스코프 한정이 명시돼 있지 않아 "일반 invariant"로 읽힐 소지가 크다. target 의 정정이 §7.5 Rationale 에만 반영되고 §7.3 에는 아무 것도 추가되지 않으면, 병합 후 spec 문서 안에 "유령 running 노드는 안 남는다"(§7.3, 마치 전역 보장처럼 읽힘)와 "유령 running 노드가 영구 잔류할 수 있다"(§7.5, retry_last_turn 2차 claim 한정)가 상호 참조 없이 나란히 존재해, 두 절만 따로 읽는 독자가 자기모순으로 오인할 수 있다. 이는 "암묵적 가정 충돌"(Rationale 에 기록된 시스템 invariant 를 우회하는 설계가 조율 없이 병존) 항목에 해당한다 — target 자체가 새 코드 설계를 도입하는 것은 아니지만(기존 코드 사실을 spec 에 반영하는 것뿐), 결과물인 spec 문서의 내부 정합성 확보 책임까지는 다하지 못했다.
  - 제안: 다음 중 하나(또는 둘 다)를 이 draft 반영 시 함께 처리할 것 — (a) `spec/5-system/4-execution-engine.md` §7.3 "orphan row 마감" 문장 끝에 "단, `retry_last_turn` 2차 claim(`claimSpawnedRetryRow`) discard 경로는 이 case-B cascade cleanup 대상이 아니다 — §7.5 Rationale 'retry 재진입의 원자 claim' 참조" 식의 스코프 각주를 추가. (b) target 의 After 문단에 "이는 §7.3 의 case-B orphan-row-마감 cascade 와는 다른, 그 cascade 가 닿지 않는 별도 경로다"라는 명시적 cross-reference 를 추가. "함께 반영할 것" 절의 조건부 서술("명시한 문장이 없다면")도 사실 확인 결과에 맞춰 "§7.3 에 있으나 스코프가 다르므로 상호 참조를 반드시 추가한다"는 확정 지시로 교체.

- **[INFO]** `spec/data-flow/3-execution.md` 의 인접 "폐기된 서술" 항목이 이번 정정과 같은 뿌리를 다루면서도 target 의 스코프 밖에 있음
  - target 위치: 해당 없음 — target 의 `spec_impact` 는 `spec/5-system/4-execution-engine.md` 하나만 선언(frontmatter 줄 7-8), `spec/data-flow/3-execution.md` 는 포함되지 않음
  - 과거 결정 출처: `spec/data-flow/3-execution.md` `## Rationale` → "폐기된 서술 (본 문서 이전 버전)" 목록, "recoverStuckExecutions 가 running 잔류 execution 을 발견하면 failed 로 마감하고 stuck node 들도 정리한다" — "실제 대상은 30분 stale heartbeat row 만이고 node_execution 정리는 수행하지 않는다 (§3.3). 과대 서술 폐기." (줄 352)
  - 상세: 이 폐기 기록은 PR3(2026-07-04, "일괄 fail" → case-B re-drive 전환) **이전** 구 모델을 기준으로 "recoverStuckExecutions 는 node_execution 을 정리하지 않는다"고 확정한 것이다. PR3 이후에는 case-B re-drive 진입 시 `failOrphanRunningNodeExecutions` 가 실제로 (크래시 시점의 구 RUNNING row 에 한해) node_execution 정리를 수행하므로, "node_execution 정리는 수행하지 않는다"는 문장 자체가 이제 부분적으로 낡았다. target 이 다루는 "recoverStuckExecutions 가 무엇을 커버하고 무엇을 커버하지 않는가"와 정확히 같은 주제이지만, target 은 이 파일을 건드리지 않는다. target 의 결함은 아니며(별도 파일·별도 PR 스코프일 수 있음), 다만 project-planner 가 이 draft 를 반영하는 세션에서 함께 손보면 "recoverStuckExecutions 커버리지" 서술의 spec 전체 정합성을 한 번에 맞출 수 있다.
  - 제안: 필수는 아니나, 이번 draft 반영 시 `spec/data-flow/3-execution.md` 의 해당 "폐기된 서술" 항목도 "node_execution 정리는 case B re-drive 진입 시 크래시 시점의 구 RUNNING row 에 한해 수행한다(§3.3, `failOrphanRunningNodeExecutions`) — retry_last_turn 2차 claim discard 로 인한 orphan 은 이 정리 대상이 아니다"로 갱신할지 검토.

- **[INFO]** 정정 표시 컨벤션(날짜 스탬프·명시적 "철회/정정" 문구) 미적용
  - target 위치: `plan/in-progress/spec-update-retry-claim-backstop-gap.md` "### After (제안)" 전체 (줄 63-78)
  - 과거 결정 출처: 같은 spec 문서가 반복해 온 관행 — `spec/5-system/4-execution-engine.md` 줄 1499 "**옛 서술 철회 (2026-07-28)**: 본 절은 최초 작성(`5e0c5e449`) 당시 ... 고 단언했다. 그것은 당시 구현의 사실 서술이었으나 ... 이 그 동작을 결함으로 규정하고 차단했다 ... 따라서 ... 철회한다." 및 섹션 제목 자체에 "(옛 ... 번복 — 날짜)"를 병기하는 패턴(줄 1397, 1491 제목).
  - 상세: target 은 §7.5 Rationale 문단을 제자리에서 전면 교체하며 교체 사유·시점을 문단 내부에 녹여 서술했지만("실측 확인, 2026-07-28/30"), 이 문서가 다른 유사 정정에서 일관되게 써 온 "옛 서술 철회 (날짜)"라는 명시적 accountability 마커·헤더 갱신은 없다. 결정의 무근거 번복은 아니다(새 근거가 충분히 제시돼 있음) — 다만 문서 관행과의 완전한 정합을 위해 보완 여지가 있다.
  - 제안: 섹션 제목 "### retry 재진입의 원자 claim — spawn 단계 원자성만으로는 불충분하다 (§7.5 대칭, 2026-07-28)" 뒤에 "— 백스톱 커버리지 서술 정정 2026-07-30" 등을 덧붙이거나, After 문단 앞에 "**서술 정정(2026-07-30)**: 아래 트레이드오프 단락 중 백스톱 커버리지 부분을 실측 결과에 맞춰 수정한다" 한 줄을 추가.

## 검증 메모 (참고)

- target 이 인용한 모든 과거 이력(코드 JSDoc `claimSpawnedRetryRow`, plan `retry-turn-terminal-guard.md` #15, `review/code/2026/07/30/11_41_20` SUMMARY WARNING #1)은 실제로 존재하며 인용이 정확함을 직접 대조로 확인했다 — 조작·과장된 "기각 이력"은 없음.
- target 의 핵심 기술 주장(`recoverStuckExecutions`/`reclaimStuckRunningExecution` 는 `Execution.status='running'` 조건만 스캔하므로, 대상 Execution 이 이미 `failed`/`cancelled` 로 terminal 이면 그 case-B 경로가 절대 발동하지 않는다)은 `execution-engine.service.ts` 코드(줄 3040-3119, `reclaimStuckRunningExecution` WHERE 절)로 직접 확인했다 — 정확함.
- target 은 기각된 대안(예: "진짜 corruption 방어는 recoverStuckExecutions 류 backstop 에 위임"이라는 리뷰어 제안, 또는 §7.1/§7.4 가 반복 확정한 "신규 주기 스캐너 미도입" 원칙)을 다시 채택하지 않는다 — discard-우선 트레이드오프를 그대로 유지하고 새 백스톱 신설도 제안하지 않는다.

## 요약

target 문서는 실제 코드(JSDoc)·plan(#15)·리뷰 이력과 대조한 결과 인용된 과거 결정·실측 근거가 모두 진짜이며, 기각된 대안을 근거 없이 되살리거나 합의된 discard-우선 트레이드오프를 무단으로 뒤집지도 않는다 — 오히려 §7.5 Rationale 내부에 있던 자기모순(백스톱이 "담당한다"는 구 서술과 "닿지 않는다"는 실측이 같은 문단에 공존)을 해소하는 정당한 정정이며, 새 근거(왜 discard 가 여전히 옳은지)도 충분히 함께 제시한다. 다만 이 정정을 §7.5 에만 반영하고 §7.3 "orphan row 마감"의 "부모 Execution 종결 후 유령 running 노드가 남지 않는다"는 기존 서술과는 교차 참조를 달지 않아, 병합 후 같은 spec 문서 안에 서로 다른 스코프(case-B crash re-drive vs retry 2차 claim discard)를 다루는 두 문장이 조율 없이 병존하게 된다 — target 자신의 "함께 반영할 것" 절이 "그런 문장이 없다면"이라 전제한 것과 달리 실제로는 존재하므로, 반영 전 이 교차 참조를 추가하는 보완이 필요하다.

## 위험도

MEDIUM
