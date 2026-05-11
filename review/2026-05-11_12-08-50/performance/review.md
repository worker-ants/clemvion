### 발견사항

- **[INFO]** `imagePullPolicy: IfNotPresent` + `:latest` 태그 조합
  - 위치: `k8s/base/backend-deployment.yaml`, `k8s/base/frontend-deployment.yaml`, `k8s/base/migrate-job.yaml`
  - 상세: 이 diff에서 새로 도입된 것은 아니지만, 이미지 태그가 `:latest`이면서 `IfNotPresent`를 사용하면 레지스트리에서 이미지가 업데이트돼도 노드에 캐시된 이전 이미지로 계속 실행된다. 이미지 갱신이 반영되지 않아 버그 수정이나 성능 패치가 조용히 무시될 수 있다.
  - 제안: 프로덕션에서는 git SHA 또는 semver 태그를 사용하고 `imagePullPolicy: Always`는 CI/CD 파이프라인이 명시적으로 태그를 갱신할 때만 의미가 있음. `kustomize edit set image`로 배포마다 태그를 갱신하는 구조가 이미 마련되어 있으므로 `:latest`를 제거해도 된다.

- **[WARNING]** `selector.matchLabels` 변경으로 인한 기존 Deployment 재생성 필요
  - 위치: `k8s/base/backend-deployment.yaml:14`, `k8s/base/frontend-deployment.yaml:14`
  - 상세: Kubernetes Deployment의 `selector.matchLabels`는 **불변(immutable)** 필드다. `app.kubernetes.io/name: idea-workflow → clemvion`으로 변경 시 `kubectl apply`가 거부되므로 반드시 기존 Deployment를 삭제 후 재생성해야 한다. 삭제 시점부터 새 Pod가 Ready 상태가 될 때까지 무중단이 보장되지 않는다.
  - 제안: blue-green 또는 `kubectl delete deploy backend && kubectl apply -k ...` 순서로 진행. 또는 ArgoCD의 `Replace` sync option을 활용하면 자동 처리된다. plan의 "리스크" 항목에도 이 점을 명시할 것.

- **[WARNING]** `DB_DATABASE: workflow` ConfigMap 변경이 운영 DB 단절 유발 가능
  - 위치: `k8s/base/configmap.yaml:18`
  - 상세: plan 문서에 "운영 DB가 `idea_workflow`로 살아있다면 ConfigMap만 패치하거나 DB rename 결정 필요"라고 언급되어 있으나, 이 변경이 적용되는 순간 DB 연결이 전면 실패한다. 애플리케이션의 모든 DB 의존 요청이 즉각 에러를 반환하게 된다.
  - 제안: 운영 환경에서는 overlay 패치로 `DB_DATABASE`를 기존 값으로 오버라이드해 base 변경 영향을 격리한 뒤, DB 실제 rename 완료 후 오버라이드를 제거하는 2단계 배포를 권장한다.

- **[INFO]** frontend-deployment의 `fsGroup` 누락 (backend 대비 비일관성)
  - 위치: `k8s/base/frontend-deployment.yaml`
  - 상대: backend-deployment에는 `fsGroup: 1000`이 있지만 frontend에는 없다. 현재 frontend에 volume mount가 없으므로 기능상 문제는 없으나, 향후 emptyDir 등 볼륨 추가 시 파일 권한 문제가 발생할 수 있다.
  - 제안: 일관성을 위해 `fsGroup: 1000`을 추가해 두는 것이 안전하다.

- **[INFO]** Migrate Job의 `restartPolicy: OnFailure` + `backoffLimit: 3`
  - 위치: `k8s/base/migrate-job.yaml`
  - 상세: 변경 없이 유지된 기존 설정이지만, Flyway 마이그레이션은 멱등하지 않은 SQL(예: `NOT VALID` 제약)이 포함될 경우 재시도 시 중복 실행으로 오류가 발생할 수 있다. 현재 마이그레이션 파일들이 `IF NOT EXISTS` / Flyway checksum 검증으로 보호되어 있어 실질 위험은 낮으나, `connectRetries=20`은 충분하다.
  - 제안: 이슈 없음, 현 상태 유지 적절.

---

### 요약

이번 변경은 `idea-workflow` → `clemvion` 순수 리네임 작업으로, 알고리즘·자료구조·I/O·메모리 할당 등 코드 수준의 성능 이슈는 전혀 없다. 성능 관점의 위험은 모두 **운영 전환 시점의 순단(downtime)**에 집중된다. Deployment selector 불변 제약으로 인한 재생성 필요, `DB_DATABASE` 불일치로 인한 DB 연결 단절이 핵심 리스크다. `:latest` + `IfNotPresent` 조합은 기존부터 존재하던 운영 상의 비효율이며, 이 diff가 악화시킨 것은 아니다.

### 위험도

**LOW** (코드 성능 자체는 무영향, 운영 전환 절차를 잘못 수행했을 때만 서비스 단절 가능성)