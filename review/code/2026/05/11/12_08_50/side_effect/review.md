## 부작용(Side Effect) 코드 리뷰

### 발견사항

---

**[CRITICAL]** `DB_DATABASE` 값 변경 — 기존 운영 DB 연결 단절 위험
- **위치**: `k8s/base/configmap.yaml` — `DB_DATABASE: idea_workflow` → `workflow`
- **상세**: 이 값은 NestJS TypeORM이 실제로 접속할 PostgreSQL 데이터베이스 이름이다. 이미 `idea_workflow` 데이터베이스로 운영 중인 클러스터에 이 ConfigMap을 적용하면, backend Pod가 존재하지 않는 `workflow` DB에 접속을 시도해 **즉시 서비스 장애**가 발생한다.
- **제안**: 신규 환경(local overlay에서 시드 시)에는 무해하지만, 기존 클러스터 적용 전 반드시 DB rename(`ALTER DATABASE idea_workflow RENAME TO workflow`) 또는 ConfigMap 패치 우선 순위를 운영자가 확인해야 한다. plan 문서의 리스크 §4가 이 사항을 언급하고 있지만, `local/configmap-patch.yaml`에서 `DB_DATABASE`가 override되는지 별도 확인이 필요하다.

---

**[CRITICAL]** Deployment `selector.matchLabels` 변경 — Kubernetes immutable 필드
- **위치**: `k8s/base/backend-deployment.yaml:14-16`, `k8s/base/frontend-deployment.yaml:14-16`
- **상세**: `spec.selector.matchLabels`는 Deployment 생성 후 **변경 불가(immutable)** 필드다. 기존 `idea-workflow` label로 생성된 Deployment가 클러스터에 존재할 경우, `kubectl apply`는 `field is immutable` 에러로 실패한다. `kubectl apply`가 아닌 `kubectl delete + apply` 또는 `kubectl replace --force`가 필요하며, 이 과정에서 **롤링 업데이트 없이 Pod가 전부 삭제**되는 다운타임이 발생한다.
- **제안**: plan 문서 리스크 §1에 이 사항을 명시 추가하거나, 마이그레이션 절차에 `kubectl delete deployment backend frontend -n idea-workflow` 선행 단계를 추가해야 한다.

---

**[CRITICAL]** TLS Secret 이름 변경 — 신규 Ingress에서 즉시 TLS 불가
- **위치**: `k8s/base/ingress.yaml` — `secretName: idea-workflow-{frontend,backend}-tls` → `clemvion-{frontend,backend}-tls`
- **상세**: cert-manager 또는 수동으로 생성된 TLS Secret의 이름은 `idea-workflow-*-tls`다. 새 Ingress 리소스가 적용되면 `clemvion-*-tls` 이름의 Secret을 참조하는데, 이 Secret은 존재하지 않는다. HAProxy Ingress 컨트롤러는 Secret을 찾지 못해 TLS 설정에 실패하고, 브라우저는 인증서 오류 또는 HTTP fallback을 경험하게 된다.
- **제안**: 배포 전에 기존 Secret을 새 이름으로 복사하거나(`kubectl get secret idea-workflow-frontend-tls -o yaml | sed 's/name: .*/name: clemvion-frontend-tls/' | kubectl apply -f -`), cert-manager `Certificate` CR의 `secretName`을 먼저 업데이트해야 한다.

---

**[WARNING]** 구 Ingress 리소스 orphan — 트래픽 이중 라우팅 위험
- **위치**: `k8s/base/ingress.yaml` — Ingress name 변경 (`idea-workflow-frontend` → `clemvion-frontend`)
- **상세**: Kustomize/kubectl은 이름이 바뀐 리소스를 "삭제 후 재생성"하지 않고 새 리소스를 생성한다. 기존 `idea-workflow-frontend`, `idea-workflow-backend` Ingress는 클러스터에 **그대로 남아** 동일한 Service로 라우팅을 계속 시도한다. 두 Ingress가 동시에 활성화되면 Ingress 컨트롤러 구현에 따라 예기치 않은 라우팅 충돌이 발생할 수 있다.
- **제안**: 배포 후 `kubectl delete ingress idea-workflow-frontend idea-workflow-backend -n idea-workflow` (또는 `clemvion`) 수동 정리가 필요하다. plan Phase 4 검증 항목에 추가 권장.

---

**[WARNING]** 구 namespace `idea-workflow` orphan — 기존 리소스 방치
- **위치**: `k8s/base/namespace.yaml`, 모든 overlay `kustomization.yaml`
- **상세**: 새 namespace `clemvion`에 리소스를 배포해도 기존 `idea-workflow` namespace와 그 안의 모든 리소스(Deployment, Service, ConfigMap, Secret, PVC 등)는 자동 삭제되지 않는다. 두 네임스페이스가 동시에 실행 상태가 되어 DB connection pool을 두 배로 소비하거나, 과금(EKS/GKE Node) 낭비가 발생할 수 있다.
- **제안**: 배포 완료 확인 후 `kubectl delete namespace idea-workflow`로 수동 정리. plan 리스크 항목에 명시 권장.

---

**[WARNING]** Docker Compose 볼륨명 문서 불일치 가능성
- **위치**: `README.md:133` — `docker volume rm clemvion_backend_node_modules`
- **상세**: Docker Compose volume 이름은 `<project_name>_<volume_name>` 형태로 생성된다. Compose project name이 이전 커밋(9440725a)에서 이미 `clemvion`으로 변경됐다면 문서가 맞지만, 기존 로컬 개발 환경의 볼륨은 `idea-workflow_backend_node_modules` 이름으로 여전히 남아 디스크를 점유한다.
- **제안**: 기여자 온보딩 가이드에 `docker volume ls | grep idea-workflow` 잔존 볼륨 정리 안내를 추가하면 좋다.

---

**[WARNING]** OTEL 서비스명 변경 — 모니터링 히스토리 단절
- **위치**: `k8s/base/configmap.yaml` — `OTEL_SERVICE_NAME: idea-workflow-backend` → `clemvion-backend`
- **상세**: Jaeger, Datadog, Grafana Tempo 등에서 `idea-workflow-backend` 서비스명으로 누적된 트레이스/메트릭은 새 이름 `clemvion-backend`와 연속성이 끊긴다. 기능 부작용은 아니지만, SRE/On-call이 배포 전후 메트릭을 비교할 때 혼선을 일으킨다.
- **제안**: 모니터링 대시보드의 서비스명 필터 사전 업데이트 권장.

---

**[INFO]** Dockerfile 변경은 주석(comment)만 수정
- **위치**: `backend/Dockerfile:1`, `frontend/Dockerfile:4`, `backend/migrations/Dockerfile:2-4`
- **상세**: 실제 `FROM`, `RUN`, `COPY`, `CMD` 명령어는 변경 없음. 빌드 결과물에 영향 없다.

---

**[INFO]** plan 문서(`plan/in-progress/k8s-clemvion-rename.md`) 추가
- **위치**: 신규 파일
- **상세**: 순수 markdown 문서로, 런타임 부작용 없음. Phase 1~4 체크박스가 모두 미완(`[ ]`) 상태로 남아 있어 `plan/in-progress/`에 위치하는 것이 올바르다.

---

### 요약

이 변경은 전체적으로 `idea-workflow` → `clemvion` 브랜드 리네임을 인프라 레이어까지 일관되게 완성하는 작업이며, 코드 로직·API·함수 시그니처에는 영향이 없다. 그러나 Kubernetes 환경에서 적용 시 세 가지 즉각적인 운영 위험이 존재한다: **DB 이름 불일치로 인한 서비스 장애**, **Deployment selector 불변 필드 충돌로 인한 강제 다운타임**, **TLS Secret 이름 불일치로 인한 인증서 오류**. 이 세 가지는 신규 클러스터에서는 발생하지 않지만, 기존 클러스터에 in-place 적용 시 반드시 사전 절차(DB rename, Secret 복사, 구 리소스 삭제)가 선행되어야 한다. plan 문서의 리스크 섹션이 일부를 다루고 있으나, TLS Secret과 Deployment immutable 필드에 대한 구체적 대응 절차가 보완되어야 한다.

### 위험도

**HIGH** (신규 환경 배포 시 LOW, 기존 클러스터 in-place 적용 시 HIGH)