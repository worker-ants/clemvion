### 발견사항

- **[WARNING]** 기각된 대안(OTel Gauge 신설)의 채택 — Rationale 갱신은 있으나 역할 분리 논리가 불완전
  - target 위치: `codebase/backend/src/modules/execution-engine/continuation/continuation-dlq-monitor.service.ts` — `registerQueueDepthProvider` 호출부 + `codebase/backend/src/modules/metrics/business-metrics.service.ts` 전체
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` `## Rationale` "DLQ 모니터링 — 로그 기반 알람 선택" — "택하지 않은 방향: (a) OTel Meter Gauge 신설 — 메트릭 백엔드(수집기/대시보드) 부재 상태에서 소비처 없는 메트릭. metrics 파이프라인 구축 시 재검토."
  - 상세: 과거 Rationale 은 OTel Gauge 를 **명시적으로 기각**하면서 "파이프라인 구축 시 재검토" 라는 조건부 재검토 문을 달았다. 본 PR 은 NF-OB-02(MeterProvider + PrometheusExporter 구성, commit b9df69bf)를 전제로 그 재검토 조건이 충족됐다고 보고 `clemvion.queue.depth` ObservableGauge 를 도입한다. 동시에 `spec/5-system/4-execution-engine.md` Rationale 도 갱신해 "(당시 전제 — 이후 변경됨)" + "현행화" 블록을 추가하고 **임계 초과 알람(능동 통지)은 여전히 log 기반 유지, 큐 깊이 관측은 gauge 로 분리**라는 역할 분리 논리를 기술했다. 단, Rationale 내 "현행화" 블록이 인라인 주석 형태로 기존 항목 안에 삽입돼 있어, 명시적인 "과거 결정 번복 사유" 절이 독립하지 않고 본문에 섞인다. 구조상 번복 의도는 파악 가능하나, 새 채택 결정이 기각 항목 바로 위 인라인으로만 기술돼 향후 독자가 "이 Gauge 기각이 아직 유효한가" 를 오인할 여지가 남는다.
  - 제안: Rationale "DLQ 모니터링" 항 내 `(a)` 항목을 "~~OTel Meter Gauge 신설~~ → **채택으로 전환 (NF-OB-07, 조건 충족)**: 관측(gauge)과 알람(log cooldown) 역할 분리" 형식으로 명확히 교체 표기하거나, 별도 소항목 "DLQ 모니터링 Rationale 현행화 (NF-OB-07)" 를 독립시켜 기각→채택 전환 사유를 한 곳에서 읽힐 수 있도록 구조화한다.

- **[INFO]** 기존 Rationale 의 "로그 기반 알람" 핵심 원칙은 올바르게 보존됨
  - target 위치: `continuation-dlq-monitor.service.ts` 수정된 주석 ("임계 초과 알람(능동 통지)은 log 기반을 유지") + `spec/5-system/4-execution-engine.md` 현행화 블록
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` Rationale "DLQ 모니터링" — 로그 기반 알람 채택·cooldown 방지
  - 상세: 본 PR 은 "임계 초과 알람" 만 log 기반을 유지하고 "큐 깊이 관측" 만 gauge 로 추가하는 역할 분리 설계를 채택했다. `enabled=false` 이어도 `registerQueueDepthProvider` 를 먼저 등록(알람 비활성과 무관하게 깊이 관측은 유효)하는 구현은 이 분리를 올바르게 반영한다. 보완 제안 없음.

- **[INFO]** NF-OB-02 전제 조건 충족 여부가 spec 에 inline 으로만 명시 — 독립 ADR 부재
  - target 위치: `spec/5-system/_product-overview.md` NF-OB-07 항목 (worktree 버전에 신설)
  - 과거 결정 출처: `spec/5-system/_product-overview.md` NF-OB-02 행 "비즈니스 커스텀 메트릭은 본 파이프라인 위 후속"
  - 상세: NF-OB-07 신설이 NF-OB-02 의 "후속" 약속을 이행하는 것임을 `_product-overview.md` 가 NF-OB-07 항목으로 정리하고 있어 연속성은 유지된다. 단, NF-OB-07 Rationale 이 `_product-overview.md` 본문에 미수록 — "왜 이 5개 instrument 를 선택했는가, 다른 메트릭을 제외한 이유" 같은 선택 근거가 Rationale 절에 없다. 현재 `_product-overview.md` 에는 `## Rationale` 섹션 자체가 없다.
  - 제안: `spec/5-system/_product-overview.md` 끝에 `## Rationale` 섹션을 신설하고 "NF-OB-07 메트릭 카탈로그 선택 근거" 항을 추가해 "표준 3종 + 노드 지연·에러율 채택, 더 세밀한 per-node 메트릭 미채택, Statistics API 와의 이원화 정책" 등의 결정 근거를 영속화한다.

### 요약

Rationale 연속성 관점에서 가장 중요한 충돌 지점은 `spec/5-system/4-execution-engine.md` 의 "DLQ 모니터링" Rationale 이 과거에 OTel Gauge 를 명시적으로 기각했음에도 본 PR 이 그것을 채택한 것이다. 그러나 해당 Rationale 은 **"metrics 파이프라인 구축 시 재검토"** 라는 조건부 재검토문을 이미 포함하고 있었고, 본 PR 은 NF-OB-02 를 통해 그 조건이 충족됐음을 명시하면서 Rationale 을 업데이트했다. "임계 초과 알람은 log 기반 유지, 큐 깊이 관측만 gauge" 라는 역할 분리로 과거 로그 기반 알람 핵심 원칙도 보존했다. 번복 사유가 기술됐다는 점에서 무근거 번복은 아니나, 갱신된 Rationale 이 기존 항목 내 인라인 블록으로 삽입돼 과거 기각 대안과 현재 채택 결정의 경계가 명확하지 않아 독자 혼란 여지가 남는다(WARNING). NF-OB-07 카탈로그 자체의 선택 근거를 `_product-overview.md §Rationale` 에 영속화하지 않은 점도 보완이 필요하다(INFO). 전반적으로 invariant 의 직접 위반이나 근거 없는 번복은 없다.

### 위험도
LOW

STATUS: SUCCESS
