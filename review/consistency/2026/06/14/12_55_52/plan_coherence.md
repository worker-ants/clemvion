### 발견사항

- **[WARNING]** plan 의 "합의 필요" 메트릭 이름/라벨 셋이 구현으로 확정됐으나 plan 체크 갱신 미완
  - target 위치: `spec/5-system/_product-overview.md` §5 NF-OB-07 행 + 메트릭 카탈로그 테이블 (worktree 신설)
  - 관련 plan: `plan/in-progress/spec-sync-5-system-metrics-gap.md` (main branch) 19-21행 — "비즈니스 커스텀 메트릭: … (메트릭 이름/라벨 셋 **합의 필요**)", "continuation-dlq-monitor.service.ts 주석 현행화" 두 항목이 `[ ]` 미체크 상태
  - 상세: main branch 의 plan 은 메트릭 이름·라벨 셋을 "합의 필요"로 열어 두었다. 구현은 `clemvion.execution.total{status}` / `clemvion.execution.errors{error_code}` / `clemvion.queue.depth{queue,state}` / `clemvion.llm.tokens{model,type}` / `clemvion.node.duration{node_type,status}` 5종을 일방적으로 결정해 spec NF-OB-07 에 등재했다. 단, worktree 내 plan (`plan/in-progress/spec-sync-5-system-metrics-gap.md`) 에는 "사용자 결정 '표준 3종 + 노드 지연·에러율'" 메모가 추가돼 있고 해당 항목이 `[x]` 로 체크되어 있어, 사용자 합의가 실제로 이루어진 것으로 추정된다. 그러나 main branch의 plan은 아직 갱신되지 않은 상태라, 이 PR 이 merge 될 때 plan 파일도 함께 반영돼야 한다. 현재 worktree plan 에는 `/consistency-check --impl-done` 항목이 `[ ]` 로 남아 있어 이 검사 자체가 마지막 미체크 항목이다.
  - 제안: plan 쪽 조치 불필요 (worktree plan 이 이미 결정 기록을 반영했으며, 이 consistency-check 완료 후 plan 항목을 `[x]` 로 닫고 PR 에 포함하면 된다). target spec 은 현행 유지.

- **[INFO]** ai-review SPEC-DRIFT (WARNING #6) — `spec/5-system/4-execution-engine.md` §9.3 의 DLQ 모니터 설명이 이미 worktree 에서 현행화됨
  - target 위치: `spec/5-system/4-execution-engine.md` L1082 (worktree)
  - 관련 plan: `plan/in-progress/spec-sync-5-system-metrics-gap.md` worktree 버전 §후속 완료 항목 "spec W-2"
  - 상세: ai-review SUMMARY #6 이 지적한 stale "OTel traces-only" 주석 현행화가 worktree 에서 이미 처리됐고 (`[x]` C-12, spec W-2), plan 도 반영 완료로 기록되어 있다. 추가 조치 불필요.

- **[INFO]** 아키텍처 개선 후속 항목(W-10·W-12 등)이 plan 에 등재됐으나 spec 또는 다른 plan 에는 미반영
  - target 위치: `spec/5-system/_product-overview.md` — NF-OB-07 카탈로그에 `registerQueueDepthProvider` push-등록 패턴의 아키텍처 한계 언급 없음
  - 관련 plan: `plan/in-progress/spec-sync-5-system-metrics-gap.md` worktree §후속(아키텍처 개선) W-10·W-12·I-3·I-11·I-12·I-13
  - 상세: W-10(DI 토큰 전환), W-12(SRP 분리), I-3(타임아웃), I-11(env.example), I-12(분산 잠금), I-13(인덱스 확인) 6건이 "이번 PR 조치 안 함"으로 명시되어 있다. 이 항목들은 별도 plan 신설 없이 현 plan 의 하위 목록으로만 남아 있는데, 단기 아키텍처 개선 사항이라 추적 plan 이 필요할 수 있다. 그러나 이 수준은 plan lifecycle 에서 "선택적 백로그"로 충분하므로 신규 plan 필수 조건은 아니다.

### 요약

본 구현(NF-OB-07 비즈니스 커스텀 메트릭)은 `plan/in-progress/spec-sync-5-system-metrics-gap.md` 가 "합의 필요"로 열어둔 메트릭 이름·라벨 셋 결정을 worktree 내부에서 사용자 합의 기록(`사용자 결정 '표준 3종 + 노드 지연·에러율'`)과 함께 확정했다. main branch plan 의 해당 항목이 아직 미체크 상태이지만, 이는 PR merge 전 상태의 당연한 결과이며 worktree plan 에는 결정 근거가 명시되어 있다. 미해결 결정을 일방적으로 우회한 것이 아니라 사용자 합의를 거쳤음을 plan 에 기록한 패턴이다. 유일한 후속 조치는 이 consistency-check 완료 후 plan 항목을 `[x]` 로 닫는 것이며, target spec 변경 자체는 plan 정합 관점에서 문제없다.

### 위험도

LOW
