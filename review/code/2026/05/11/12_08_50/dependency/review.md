### 발견사항

- **[WARNING]** `DB_DATABASE` ConfigMap 값 변경으로 인한 런타임 의존성 단절 위험
  - 위치: `k8s/base/configmap.yaml`, `data.DB_DATABASE: "idea_workflow" → "workflow"`
  - 상세: 이 값은 애플리케이션이 연결할 PostgreSQL 데이터베이스 이름을 결정한다. 운영 또는 스테이징 클러스터에 `idea_workflow`라는 DB가 이미 존재하는 상태에서 ConfigMap만 배포되면 backend Pod가 즉시 DB 연결 불가 상태가 된다. `migrate-job.yaml`의 `flyway` 커맨드도 이 값(`${DB_DATABASE}`)을 사용하므로, 마이그레이션 Job도 wrong DB에 접속을 시도한다.
  - 제안: plan 파일 Risk §4에서 언급하고 있으나 **overlay 레벨 패치로 환경별 분리**하거나, 배포 전 운영자가 DB 이름을 `workflow`로 rename/alias 했음을 확인하는 체크리스트 항목을 명시적으로 추가할 것. 현재 `overlays/staging|prod`의 ConfigMap 패치 블록에 `DB_DATABASE` 항목이 없으므로, base 값이 그대로 내려간다는 점도 주의.

- **[WARNING]** 이미지 태그 변경과 CI 파이프라인 간 외부 의존성 미포함
  - 위치: 모든 `kustomization.yaml`의 `images:` 섹션
  - 상세: `kustomize edit set image idea-workflow/backend=<registry>/...` 형태로 이미지 태그를 갱신하는 CI 파이프라인 스크립트가 별도 저장소나 CI 설정 파일에 있다면, 이번 커밋과 함께 원자적으로 반영되지 않는다. 새 매니페스트(`clemvion/*`)는 배포되지만 CI가 아직 `idea-workflow/*` 태그로 푸시하고 있으면 `ImagePullBackOff`가 발생한다.
  - 제안: k8s/README.md의 "CI 파이프라인에서는 `kustomize edit set image clemvion/backend=...`를 사용" 문구는 정확히 갱신되어 있다. CI 저장소에도 동일 시점에 반영하거나, plan §리스크 3항에 대응 티켓/이슈 링크를 추가할 것.

- **[WARNING]** TLS Secret 이름 변경 — 클러스터 외부 cert-manager 의존성
  - 위치: `k8s/base/ingress.yaml` (`secretName: clemvion-frontend-tls`, `clemvion-backend-tls`)
  - 상세: cert-manager `Certificate` CR이 별도 저장소에 있으면 `secretName` 불일치로 TLS handshake 실패. plan §리스크 2항에서 언급하고 있으나 이번 변경 범위에 포함되지 않는다.
  - 제안: 외부 cert-manager 매니페스트에 동기 반영 항목을 Phase 5 체크리스트에 구체적으로 추가.

- **[INFO]** Docker Compose named volume 이름 변경 — 로컬 개발 환경 수동 조치 필요
  - 위치: `README.md`, `docker volume rm clemvion_backend_node_modules`
  - 상세: Docker Compose 프로젝트 이름이 디렉터리명(`clemvion`)에서 자동 파생된다면 새 volume 명칭은 정확하다. 단, 기존 개발자 로컬 환경에 `idea-workflow_backend_node_modules` 볼륨이 남아 있으면 디스크를 낭비하며, 신규 볼륨이 채워지기 전까지 `npm ci`가 재실행된다.
  - 제안: 현행 README 지침으로 충분. 선택적으로 마이그레이션 one-liner(`docker volume rm idea-workflow_backend_node_modules`) 를 업그레이드 노트로 추가하면 팀원 혼란을 줄일 수 있다.

- **[INFO]** 새로운 외부 패키지·라이브러리 추가 없음
  - 위치: 전 파일
  - 상세: 이번 변경은 순수 명칭 교체(namespace, 이미지 태그, 레이블, 도메인 placeholder, DB 이름, OTEL 서비스명)로 구성되어 있다. `package.json`, `package-lock.json`, base image(`node:24-alpine`, `flyway/flyway:10-alpine`)는 전혀 변경되지 않았다.

---

### 요약

이번 변경은 신규 외부 패키지나 라이브러리를 전혀 도입하지 않는 브랜드 리네임 작업으로, 의존성 그래프 자체는 동일하다. 그러나 `DB_DATABASE` ConfigMap 값 변경(`idea_workflow` → `workflow`)은 기존 운영 데이터베이스와의 **런타임 의존성을 단절**시킬 수 있는 유일한 실질적 위험이며, 이는 코드가 아닌 인프라 레벨에서 사전 조치(DB rename 또는 overlay 패치 분리)가 필요하다. CI 파이프라인 및 cert-manager 등 저장소 외부 컴포넌트와의 연계 변경이 동시에 이루어지지 않으면 배포 직후 서비스 불가 상태가 발생할 수 있으므로, 배포 순서와 외부 의존성 동기화 계획을 plan 문서에 명확히 기록하는 것을 권장한다.

### 위험도

**MEDIUM** — 코드 자체의 의존성 변경은 없으나, `DB_DATABASE` 런타임 설정 변경과 CI/cert-manager 외부 의존성 미동기화가 운영 환경에서 장애로 이어질 가능성이 있다.