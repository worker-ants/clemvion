### 발견사항

- **[INFO]** `instrumentation.ts` 모듈 수준 독스트링이 새 환경변수 `OTEL_PROMETHEUS_PORT` 를 명시적으로 문서화함
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-system-metrics-prometheus-23c34e/codebase/backend/src/instrumentation.ts` (파일 상단 JSDoc 블록)
  - 상세: `OTEL_PROMETHEUS_PORT` 기본값·노출 경로(`:9464/metrics`)가 모듈 헤더에 명시되어 있고, `resolvePrometheusPort` 함수에도 JSDoc이 갖춰져 있어 공개 API 문서화 기준을 충족함. `DEFAULT_PROMETHEUS_PORT` 상수에도 한 줄 JSDoc이 달려 있음.
  - 제안: 현재 수준으로 충분함. 추가 작업 불필요.

- **[INFO]** `instrumentation.spec.ts` 파일 상단에 테스트 목적 및 범위를 명확히 설명하는 블록 주석이 있음
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-system-metrics-prometheus-23c34e/codebase/backend/src/instrumentation.spec.ts` (1-10줄)
  - 상세: "왜 `resolvePrometheusPort` 만 테스트하는가", "부수효과가 발생하지 않는 이유" 등이 인라인 주석으로 설명되어 독자가 테스트 설계 의도를 즉시 파악할 수 있음.
  - 제안: 현재 수준으로 충분함.

- **[INFO]** 인라인 주석이 복잡한 SDK 연결 지점을 정확하게 설명함
  - 위치: `instrumentation.ts` `prometheusExporter` 생성 라인 및 `metricReaders` 배열 할당 라인
  - 상세: "PrometheusExporter 는 생성 시 별도 HTTP 서버를 띄워 `/metrics` 를 노출한다", "MeterProvider 에 Prometheus reader 를 연결 — HTTP 서버 메트릭 + runtime-node 메트릭이 이 reader 로 수집·노출된다" 주석이 충분하여 코드를 처음 읽는 사람도 의도를 파악할 수 있음.
  - 제안: 현재 수준으로 충분함.

- **[INFO]** `spec/5-system/_product-overview.md` 의 NF-OB-02 상태가 ❌ → ✅ 로 정확히 갱신됨
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-system-metrics-prometheus-23c34e/spec/5-system/_product-overview.md` (NF-OB-02 행)
  - 상세: 구현 세부(환경변수명·기본 포트·노출 경로·자동 수집 메트릭 종류·후속 범위)가 상태 셀에 인라인으로 기록되어 있어 spec과 구현이 일치함.
  - 제안: 현재 수준으로 충분함.

- **[INFO]** `plan/in-progress/spec-sync-5-system-metrics-gap.md` 가 구현 결과·후속 항목을 체계적으로 기록함
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-system-metrics-prometheus-23c34e/plan/in-progress/spec-sync-5-system-metrics-gap.md`
  - 상세: 구현 경위(사용자 결정·접근 방식), 완료 체크리스트([x] NF-OB-02), 후속 미구현 항목(비즈니스 커스텀 메트릭·`continuation-dlq-monitor.service.ts` 주석 현행화) 분리가 명확함.
  - 제안: 현재 수준으로 충분함.

- **[WARNING]** `continuation-dlq-monitor.service.ts` 의 "현 backend 는 OTel traces-only" 주석이 아직 현행화되지 않음
  - 위치: `codebase/backend/src/` 내 `continuation-dlq-monitor.service.ts` (plan 파일에 언급된 라인 30)
  - 상세: 이 구현으로 메트릭 파이프라인이 추가되었으나 해당 파일의 주석은 이 변경을 반영하지 않아 "오래된 주석(stale comment)" 상태가 됨. plan 파일에서 "후속 별도 PR" 으로 분류했으나, 오독을 유발할 수 있는 직접 모순 주석이므로 주의가 필요함.
  - 제안: 해당 주석을 "OTel traces + metrics (Prometheus exporter via `instrumentation.ts`)" 로 본 PR 에서 함께 갱신하거나, 현재 plan의 후속 항목에 명확히 추적하면 충분함. 리스크는 낮으나 가시성을 위해 본 PR 에 포함하는 것을 권장함.

- **[INFO]** README 또는 배포 가이드 업데이트 없음 — 신규 환경변수 `OTEL_PROMETHEUS_PORT` 는 선택적 설정으로 기본값(9464)이 명확하고 기존 `OTEL_ENABLED` 게이트와 동일 패턴을 따르므로 별도 README 섹션 추가 필요성은 낮음
  - 위치: 리포지토리 루트 README (확인 범위 밖)
  - 상세: `spec/5-system/_product-overview.md` 가 신규 환경변수의 단일 진실 역할을 하고 있으며 `instrumentation.ts` 모듈 헤더가 운영자용 참조 문서를 겸하고 있어 현 수준에서 문서화 공백이 없음. 단, 셀프 호스팅 운영 가이드(NF-DP-06, NF-SC-08 — 현재 ❌)가 향후 작성될 때 Prometheus 스크랩 설정 예시를 포함해야 함.
  - 제안: 셀프 호스팅 문서 작성 시 Prometheus scrape job 예시(`job_name`, `targets: localhost:9464`) 포함을 plan 항목으로 명시할 것을 권장함.

- **[INFO]** CHANGELOG 업데이트는 불필요함 — 프로젝트 구조에 CHANGELOG 파일이 존재하지 않으며 spec 변경 이력은 `plan/` + `spec/` 상태 컬럼으로 관리됨
  - 위치: 해당 없음
  - 상세: 이 변경 이력 추적 방식은 이미 `plan/in-progress/spec-sync-5-system-metrics-gap.md` 에 기록됨.

### 요약

이번 변경의 문서화 품질은 전반적으로 높음. `instrumentation.ts` 는 모듈 헤더·JSDoc·인라인 주석 세 계층을 모두 갖추고 있고, `instrumentation.spec.ts` 는 테스트 제약 이유를 명확히 설명함. 신규 환경변수 `OTEL_PROMETHEUS_PORT` 는 모듈 헤더와 spec 문서 양쪽에 기록되어 있으며 spec 상태 테이블도 구현 결과와 일치하도록 갱신됨. 유일한 실질적 문서 부채는 `continuation-dlq-monitor.service.ts:30` 의 "traces-only" 주석이 구현 변경 후에도 현행화되지 않은 점이며, plan에 후속 항목으로 명시되어 있으나 직접 모순이므로 가능하면 본 PR에서 처리하는 것이 바람직함.

### 위험도

LOW
