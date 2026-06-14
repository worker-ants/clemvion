# Cross-Spec 일관성 검토 결과

검토 대상: `spec/5-system/_product-overview.md` (구현 완료 후 검토 — `--impl-done`)
검토 범위: `codebase/backend/src/modules/metrics/`, `execution-engine/`, `llm/` 관련 변경

---

## 발견사항

### 발견사항 1
- **[INFO]** `spec/data-flow/9-observability.md` §4 note — 비즈니스 메트릭을 "후속이다" 로 기술
  - target 위치: 변경 없음 (본 branch 에서 업데이트 미수행)
  - 충돌 대상: `/Volumes/project/private/clemvion/spec/data-flow/9-observability.md` line 202
  - 상세: `9-observability.md §4` 의 note 블록이 "워크플로 실행 수·큐 깊이·LLM 사용량 같은 custom 비즈니스 메트릭은 후속이다" 라고 기술한다. 그러나 본 구현(NF-OB-07)으로 `BusinessMetricsService` 가 배포되어 해당 메트릭이 구현 완료됐으므로, 이 문장은 사실과 어긋난다. `spec/5-system/_product-overview.md` 의 NF-OB-07 행(✅)과 모순된다.
  - 제안: `spec/data-flow/9-observability.md` §4 note 를 갱신하여 NF-OB-07 구현 완료 사실을 반영하고 "후속이다" 문구를 제거. SoT 참조를 NF-OB-07 로 업데이트.

### 발견사항 2
- **[INFO]** `spec/5-system/4-execution-engine.md` §Rationale "DLQ 모니터링" — 이미 현행화됨, 추가 확인
  - target 위치: `/Volumes/project/private/clemvion/.claude/worktrees/metrics-business-1f9ab7/spec/5-system/4-execution-engine.md` line 1376–1381 (worktree 버전)
  - 충돌 대상: 없음 (worktree 스펙은 이미 현행화됨)
  - 상세: worktree 의 `4-execution-engine.md` Rationale 은 "(당시 전제 — 이후 변경됨)" 표기 + NF-OB-07 현행화 블록이 이미 포함되어 있다. main 브랜치의 구버전("현 backend 는 OTel traces-only") 이 삭제·교체됐으므로 본 branch 내 충돌은 없다. diff 에서 확인.
  - 제안: 해당 없음. 이미 처리됨.

### 발견사항 3
- **[INFO]** `spec/5-system/_product-overview.md` NF-OB-02 — Prometheus host 참조 상세도 차이
  - target 위치: worktree `spec/5-system/_product-overview.md` line 70
  - 충돌 대상: `spec/data-flow/9-observability.md` line 200
  - 상세: worktree `_product-overview.md` 는 `OTEL_PROMETHEUS_HOST`·`OTEL_PROMETHEUS_PORT`, 기본 `127.0.0.1:9464` 로 host 환경변수까지 기재한다. `9-observability.md` 는 `OTEL_PROMETHEUS_HOST`:`OTEL_PROMETHEUS_PORT`/`metrics`, 기본 `127.0.0.1:9464` 로 동일하게 기재하나, NF-OB-07 링크나 커스텀 메트릭 완료 사실을 포함하지 않는다. 직접 모순은 없으나 `9-observability.md` 가 "후속이다" note 와 함께 동기화 대상이다.
  - 제안: 발견사항 1 해결 시 함께 처리.

---

## 요약

본 구현(NF-OB-07 `BusinessMetricsService`, `MetricsModule`, execution-engine·llm·continuation 계측)은 `spec/5-system/_product-overview.md` 의 NF-OB-07 요구사항 및 NF-OB-07 메트릭 카탈로그와 완전히 정합한다. metric 이름(`clemvion.execution.total`, `clemvion.execution.errors`, `clemvion.queue.depth`, `clemvion.llm.tokens`, `clemvion.node.duration`), 라벨, 계측 지점, 이원화 정책 기술이 모두 일치한다. `spec/5-system/4-execution-engine.md` 의 DLQ 모니터링 Rationale 도 worktree 에서 이미 현행화됐다. 유일한 미동기화 영역은 `spec/data-flow/9-observability.md §4` note 로, "비즈니스 커스텀 메트릭은 후속이다" 라는 구문이 남아 있어 NF-OB-07 ✅ 와 사실 충돌한다. 이 단일 INFO 항목 외에 데이터 모델 충돌·API 계약 충돌·요구사항 ID 충돌·상태 전이 충돌·RBAC 충돌·계층 책임 충돌은 발견되지 않았다.

---

## 위험도

LOW
