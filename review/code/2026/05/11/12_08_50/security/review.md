## 보안 코드 리뷰 결과

---

### 발견사항

- **[INFO]** 변경 범위: 브랜딩 리네임 전용
  - 위치: 전 파일
  - 상세: 이번 diff는 `idea-workflow` → `clemvion` 문자열 치환 및 문서 갱신이 전부입니다. 애플리케이션 로직·인증·데이터 처리 코드 변경 없음.
  - 제안: 해당 없음.

---

- **[WARNING]** `imagePullPolicy: IfNotPresent` + `:latest` 태그 조합
  - 위치: `k8s/base/backend-deployment.yaml`, `k8s/base/frontend-deployment.yaml`, `k8s/base/migrate-job.yaml`
  - 상세: `latest` 같은 가변 태그에 `IfNotPresent`를 쓰면 노드에 이미 캐시된 이미지가 있을 경우 새 빌드를 pull하지 않습니다. 보안 패치가 포함된 새 이미지로 교체되어도 기존 캐시가 계속 실행될 수 있습니다. `local` overlay의 개발 편의 목적으로는 허용 가능하지만 `staging`/`prod` overlay에서는 위험합니다.
  - 제안: staging/prod overlay에서는 `imagePullPolicy: Always`로 오버라이드하거나, `newTag`를 git SHA 기반 불변 태그로 변경하면 해결됩니다.

---

- **[WARNING]** NetworkPolicy 부재
  - 위치: `k8s/base/` 전체
  - 상세: namespace 내 모든 Pod 간 통신이 무제한으로 허용됩니다. frontend Pod가 postgres/redis에 직접 접근할 수 있는 상태입니다.
  - 제안: `backend → postgres/redis`, `frontend → backend`만 허용하고 나머지 인그레스/이그레스를 차단하는 NetworkPolicy를 추가하면 lateral movement 위험을 낮출 수 있습니다. (본 diff 범위 밖이지만 기록 필요.)

---

- **[WARNING]** `DB_DATABASE: "workflow"` 변경 — 운영 DB 단절 위험
  - 위치: `k8s/base/configmap.yaml`
  - 상세: `idea_workflow` → `workflow`로 바뀌었습니다. 기존 운영 클러스터에서 DB 이름을 rename하지 않고 이 ConfigMap만 적용하면 backend가 존재하지 않는 DB에 연결을 시도하며 기동에 실패합니다. 데이터 접근 불가 상태가 발생할 수 있습니다.
  - 제안: plan 문서의 리스크 메모(§4)가 이미 이를 언급하고 있습니다. 운영 DB rename 또는 ConfigMap 분리 패치를 배포 전 반드시 확인하세요.

---

- **[INFO]** `frontend-deployment.yaml`에 `fsGroup` 누락
  - 위치: `k8s/base/frontend-deployment.yaml` `spec.securityContext`
  - 상세: backend deployment는 `fsGroup: 1000`이 설정되어 있으나 frontend는 `runAsNonRoot`, `runAsUser/Group`만 있고 `fsGroup`이 없습니다. 볼륨 마운트 권한 정합성 문제로 이어질 수 있습니다.
  - 제안: frontend에도 `fsGroup: 1000` 추가.

---

- **[INFO]** `secret.example.yaml` Secret 관리 패턴 — 양호
  - 위치: `k8s/base/secret.example.yaml`
  - 상세: 모든 민감값이 `REPLACE_ME` placeholder 처리되어 있고, 실 값 커밋 금지 경고 주석이 명시되어 있습니다. SealedSecrets/external-secrets-operator 권장 안내도 포함되어 있습니다.

---

- **[INFO]** Pod 보안 컨텍스트 — 양호
  - 위치: `backend-deployment.yaml`, `frontend-deployment.yaml`
  - 상세: `runAsNonRoot: true`, `readOnlyRootFilesystem: true`, `allowPrivilegeEscalation: false`, `capabilities.drop: ["ALL"]`, `/tmp` emptyDir 분리가 모두 적용되어 있어 컨테이너 탈출 위험을 최소화하고 있습니다.

---

### 요약

이번 변경은 인프라 리소스 이름(`idea-workflow` → `clemvion`) 및 관련 문서를 일괄 치환한 것으로, 애플리케이션 보안 로직에 대한 수정은 없습니다. 기존 보안 구성(non-root 컨테이너, read-only filesystem, capability drop, TLS, Secret placeholder 체계)은 그대로 유지·승계됩니다. 주요 위험은 새로 도입된 것이 아니라 기존에 존재하던 구조적 미비사항(`imagePullPolicy` + `latest` 조합, NetworkPolicy 부재)이며, `DB_DATABASE` 값 변경은 운영 DB와 동기화되지 않으면 서비스 단절을 유발할 수 있어 배포 전 반드시 확인이 필요합니다.

---

### 위험도

**LOW** — 신규 보안 취약점 없음. 기존 구조적 미비사항 2건(WARNING) 확인 필요.