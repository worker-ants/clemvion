### 발견사항

- **[WARNING]** 메인 트리 plan 의 미해소 항목과 구현 결정 간 갭 — plan 갱신 필요
  - target 위치: `spec/5-system/_product-overview.md` §5 관측성 테이블 NF-OB-07 행 및 NF-OB-07 메트릭 카탈로그 절 (worktree L75–89)
  - 관련 plan: `plan/in-progress/spec-sync-5-system-metrics-gap.md` §후속 (별도 PR — 본 PR 범위 밖) 항목 — 메인 트리 기준 L20
  - 상세: 메인 트리(origin/main)의 `plan/in-progress/spec-sync-5-system-metrics-gap.md` 에는 "비즈니스 커스텀 메트릭: 워크플로 실행 수·큐 깊이·LLM 토큰 사용량 등 도메인 메트릭 정의·계측 (메트릭 이름/라벨 셋 합의 필요)" 항목이 `[ ]`(미완료) 상태이며, 합의가 필요하다고 명시되어 있다. 이번 구현(target 변경)은 `clemvion.execution.total{status}`, `clemvion.execution.errors{error_code}`, `clemvion.queue.depth{queue,state}`, `clemvion.llm.tokens{model,type}`, `clemvion.node.duration{node_type,status}` 의 구체적 메트릭 이름·라벨 셋을 이미 확정해 코드에 배선하고 spec(NF-OB-07 카탈로그)에도 기재했다. 완화 요인: 워크트리 로컬 plan 에는 동 항목이 `[x]` 완료 처리되고 사용자 결정("표준 3종 + 노드 지연·에러율") 이 기록되어 있으므로 결정 자체는 존재하고 일방적 우회에는 해당하지 않는다. 그러나 메인 트리 plan 이 아직 이 상태 전이를 반영하지 않아 merge 전 plan 갱신이 필요하다.
  - 제안: PR merge 시 `/Volumes/project/private/clemvion/plan/in-progress/spec-sync-5-system-metrics-gap.md` 의 미완료(`[ ]`) 비즈니스 커스텀 메트릭 항목을 `[x]` 완료로 체크하고, 워크트리 로컬 plan 의 상세 기록(사용자 결정 내용, 메트릭 카탈로그, 후속 분리 항목 W-10·W-12·I-11·I-3·I-12 등)을 메인 트리 plan 에 반영한다.

- **[INFO]** 후속 아키텍처 개선 항목(W-10·W-12 등) — plan 에 이월 기록 확인
  - target 위치: `spec/5-system/_product-overview.md` 전체
  - 관련 plan: `plan/in-progress/spec-sync-5-system-metrics-gap.md` §후속 (아키텍처 개선 — 이번 PR 조치 안 함) — 워크트리 로컬 L28–36
  - 상세: W-10(`registerQueueDepthProvider` DI 토큰 패턴 전환), W-12(`ExecutionMetricsCollector` SRP 분리), I-11(`.env.example` 갱신), I-3(provider 타임아웃), I-12(다중 Pod cooldown) 등 후속 아키텍처 개선 항목이 워크트리 로컬 plan 에 명시적으로 이월 기록됐다. 메인 트리 plan 에는 현재 이 항목들이 없으므로 merge 후 추적 연속성을 위해 반영이 필요하다.
  - 제안: merge 시 후속 항목들을 `plan/in-progress/spec-sync-5-system-metrics-gap.md` 에 `[ ]` 항목으로 등재한다.

---

### 요약

`spec/5-system/_product-overview.md` 의 NF-OB-07 신설과 구현 diff 는 `plan/in-progress/spec-sync-5-system-metrics-gap.md` 의 진행 흐름과 실질적으로 정합한다. 유일하게 "결정 필요" 로 남아 있던 "메트릭 이름/라벨 셋 합의" 항목은 워크트리 로컬 plan 내에서 사용자 결정으로 확정된 뒤 target 에 반영됐으므로 미해결 결정 우회가 아니다. 선행 plan 미해소(NF-OB-02 Prometheus 파이프라인)도 이전 PR 에서 이미 완료됐다. 구조적 차단 이슈는 없고, 메인 트리 plan 갱신(체크박스 완료 + 후속 항목 이월)을 merge 시점에 수행해야 한다는 WARNING 수준의 갱신 필요가 있다.

### 위험도

LOW

STATUS: SUCCESS
