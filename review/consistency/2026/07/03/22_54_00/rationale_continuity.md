### 발견사항

- **[INFO]** M-4 구현 완료 후에도 `spec/5-system/4-execution-engine.md`의 §4 Rationale("per-node → execution-level intake 큐", "Sticky fast-path 제거 — 항상 publish 원칙")에 `executeAsync`(sub-workflow 비동기) 경로의 비대칭이 여전히 문서화되지 않음
  - target 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `executeAsync` (diff L3395-L3410), spec 측 대응 위치는 `spec/5-system/4-execution-engine.md` §4.1 안내문(L379) 및 §Rationale "per-node → execution-level intake 큐"(L1447)
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` §4.1 안내문 — "`execute()` 는 Execution row 를 `pending` 으로 저장한 뒤 `execution-run` 큐에 job 을 발행" 원칙. 및 §Rationale "Durable Continuation & Graceful Shutdown" 내 "Sticky fast-path 제거 — '항상 publish' 원칙 보존" 항목(§7.4 계열)
  - 상세: `plan/in-progress/refactor/06-concurrency.md` M-4 항목이 이미 이 비대칭을 "spec 대조: B — §4 의 intake 큐 모델과 비대칭인 잔여 fire-and-forget"으로 명시 인지하고, Option A(큐 통일, §4 spec 갱신 필요)는 self-starvation 검토 선행 필요로 후속에 유보, Option B(단기 fallback 복제)를 사용자 승인 하에 "일시 부채"로 채택했다. 즉 이번 diff 는 승인된 계획대로 구현됐고, spec 본문 변경은 plan 자체가 "spec 무변경(§4 갱신은 Option A 채택 시)"으로 명시적으로 결정한 사안이라 CRITICAL/WARNING 급 무단 번복은 아니다. 다만 spec §4.1 안내문이나 §Rationale 어디에도 "sub-workflow `executeAsync` 는 아직 execution-run 큐를 경유하지 않는 예외"라는 사실이 명시돼 있지 않아, spec 만 읽는 독자는 모든 실행 시작 경로가 intake 큐를 거친다고 오인할 수 있다.
  - 제안: `spec/5-system/4-execution-engine.md` §4.1 안내문 또는 §3.3/§Rationale 인접 위치에 "sub-workflow 비동기 모드(`executeAsync`)는 §4 intake 큐 모델 밖의 in-process fire-and-forget 이며, `failFirstSegmentSetupBestEffort` 로 setup 단계 실패만 best-effort 마감한다(§7.1 stale fail 30분이 최후 방어). 큐 통일은 M-4/PR2b admission 검토 후속"이라는 한 줄을 추가해 두면 향후 checker/개발자가 동일 gap 을 재발견하는 비용을 줄일 수 있다. (spec 변경 여부는 plan 이 이미 "채택 시" 조건부로 결정했으므로 강제 아님 — INFO.)

- **[INFO]** `failFirstSegmentSetupBestEffort` 헬퍼가 `updateExecutionStatus`/`assertTransition` choke point 를 우회해 `executionRepository.save` 로 직접 status 를 `FAILED` 로 쓰는 기존 패턴(W2 유래)을 M-4 가 두 진입점에 확산
  - target 위치: `execution-engine.service.ts` L497-L560 (`failFirstSegmentSetup`, `failFirstSegmentSetupBestEffort`), 호출부 L2872(`runExecutionFromQueue`)·L3409(`executeAsync`)
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` §1.1 "원자성 보장" 문단(L81) — 상태 전이는 `updateExecutionStatus` 의 `linkedNodeExec` 단일 트랜잭션을 SoT 로 규정. 또한 §Rationale "재개 race 보장을 DB 원자 claim으로"(L1263-1271)가 choke point 우회를 "재개 claim" 이라는 좁은 예외 하나로만 명시적으로 허용
  - 상세: `failFirstSegmentSetup` 자체는 이번 diff 의 신규 도입이 아니라 기존 W2(ai-review) 유래 헬�터이고, M-4 는 그 헬퍼를 `executeAsync` 진입점에도 재사용(추출)했을 뿐이다. setup 단계 throw 는 NodeExecution row 자체가 아직 없을 수 있는 시점(dispatch 루프 진입 전)이라 "짝 전이" 개념이 성립하지 않는 예외 케이스이므로, §1.1 원자성 보장이 규정하는 "정상 상태 전이"의 범위 밖으로 보인다 — 직접 위반으로 단정하기는 어렵다. 다만 spec 이 choke point 우회를 명시적으로 예외 처리한 것은 §7.5 재개 claim 하나뿐이고, `failFirstSegmentSetup` 류의 setup-failure best-effort 마감 예외는 spec Rationale 에 명문화돼 있지 않다.
  - 제안: 강제 조치 불필요. 여유가 있다면 `spec/5-system/4-execution-engine.md` §1.1 원자성 보장 문단 인접에 "setup 단계(첫 NodeExecution row 생성 전) throw 의 best-effort terminal 마감(`failFirstSegmentSetup`)은 짝 전이 대상이 없어 choke point 예외"라는 한 줄을 Rationale 에 추가하면 향후 유사 검토에서 반복 재확인 비용을 줄인다.

### 요약

M-4 diff(`executeAsync` fire-and-forget 의 setup 2차 실패 best-effort 마감)는 `plan/in-progress/refactor/06-concurrency.md` 에 사전 문서화된 Option A/B 비교·사용자 승인(Option B, "일시 부채"로 명시 관리) 경로를 그대로 따른 구현으로, 기각된 대안의 무단 재도입이나 합의 원칙의 직접 위반은 발견되지 않았다. `failFirstSegmentSetupBestEffort` 로의 헬퍼 추출은 기존 W2 패턴의 DRY 통합이며 새로운 결정을 만들지 않는다. §4 intake 큐 모델과 sub-workflow 비동기 경로 사이의 비대칭은 spec 이 이미 대상 범위를 `execute()` 로 한정해 명시적 gap 으로 존재했고, plan 이 이를 인지한 채 후속(Option A)으로 유보했으므로 Rationale 연속성 관점에서는 "의도적으로 관리되는 잔여 부채"로 분류된다. 다만 spec 본문에는 이 잔여 비대칭과 setup-failure best-effort 예외가 명문화돼 있지 않아, 향후 재검토 비용을 줄이려면 Rationale 보강(INFO)을 고려할 만하다.

### 위험도

LOW
