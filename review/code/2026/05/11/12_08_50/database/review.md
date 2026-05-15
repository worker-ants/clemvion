### 발견사항

- **[WARNING]** `DB_DATABASE` 값 변경 — `idea_workflow` → `workflow`
  - 위치: `k8s/base/configmap.yaml`, `DB_DATABASE` 키
  - 상세: 이 ConfigMap을 기존 클러스터에 적용하면 백엔드가 즉시 `workflow` 라는 이름의 DB에 접속을 시도한다. 운영 DB가 아직 `idea_workflow`로 살아있다면 backend Pod가 DB에 연결하지 못해 서비스 중단이 발생한다. Flyway migrate-job도 동일 ConfigMap을 `envFrom`으로 주입받으므로(`migrate-job.yaml`) 마이그레이션 Job 역시 동일한 문제를 겪는다.
  - 제안: 적용 순서를 명확히 문서화할 것. ① DB rename 먼저 (`ALTER DATABASE idea_workflow RENAME TO workflow`) → ② ConfigMap 갱신 적용. 또는 overlay patch로 기존 환경은 `DB_DATABASE: "idea_workflow"`를 유지하다가 DB rename 완료 후 전환. plan 문서의 리스크 항목 4번이 이를 인지하고 있으나, 실제 배포 runbook에 단계별 순서가 명시되어 있지 않다는 점이 위험 요소다.

- **[INFO]** `OTEL_SERVICE_NAME` 변경 — `idea-workflow-backend` → `clemvion-backend`
  - 위치: `k8s/base/configmap.yaml`
  - 상세: 데이터베이스 직접 영향은 없으나, OTEL 기반 DB 쿼리 트레이싱 대시보드(Grafana, Jaeger 등)가 서비스명으로 필터링되어 있다면 히스토리 데이터와 신규 데이터 간 연속성이 끊긴다.
  - 제안: 모니터링 대시보드의 서비스명 필터를 함께 갱신하거나, 이전 기간 데이터 조회 시 구 서비스명도 포함되도록 쿼리를 수정할 것.

- **[INFO]** 나머지 변경사항 (Docker 이미지 태그, k8s 라벨, Ingress 이름, TLS Secret 이름, 네임스페이스, README/Dockerfile 주석)은 데이터베이스와 무관한 순수 인프라 네이밍 통일 작업이다.

---

### 요약

이번 변경에서 데이터베이스 관점의 실질적 위험은 `DB_DATABASE` 값을 `idea_workflow`에서 `workflow`로 바꾼 단 하나의 ConfigMap 항목에 집중된다. 신규 배포 환경에서는 문제 없지만, 기존 클러스터에 이 ConfigMap이 적용되는 순간 DB 접속 대상이 바뀌므로 DB rename과 ConfigMap 적용 순서가 원자적으로 조율되지 않으면 서비스 중단이 발생한다. plan 문서가 이 리스크를 인지하고 있으나 구체적인 적용 순서 runbook이 빠져 있어 운영자 실수 가능성이 남아 있다.

### 위험도

**MEDIUM**