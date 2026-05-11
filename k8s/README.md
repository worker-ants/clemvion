# Kubernetes Manifests

Clemvion 의 k8s 배포 매니페스트입니다. **Kustomize** 기반으로, 공통 base 와 환경별 overlay (`local`, `staging`, `prod`) 로 구성됩니다.

## 구조

```
k8s/
├── base/                       # 환경 공통 리소스
│   ├── kustomization.yaml
│   ├── namespace.yaml
│   ├── configmap.yaml          # backend-config, frontend-config (비-비밀 env)
│   ├── secret.example.yaml     # 키 스키마만 (실 값 X — SealedSecret 등으로 교체)
│   ├── migrate-job.yaml        # Flyway DB migration Job (ArgoCD PreSync hook)
│   ├── backend-deployment.yaml
│   ├── backend-service.yaml
│   ├── frontend-deployment.yaml
│   ├── frontend-service.yaml
│   └── ingress.yaml            # HAProxy Ingress (frontend/backend host 분리, 두 Ingress 리소스)
└── overlays/
    ├── local/                  # docker-desktop / kind / minikube
    │   ├── kustomization.yaml
    │   ├── infra-postgres.yaml # in-cluster Postgres (StatefulSet)
    │   ├── infra-redis.yaml
    │   ├── infra-minio.yaml
    │   ├── secret.yaml         # dev seed 값 (commit OK)
    │   └── configmap-patch.yaml
    ├── staging/
    │   └── kustomization.yaml  # 외부 RDS/ElastiCache/S3 endpoint patch
    └── prod/
        └── kustomization.yaml
```

## 사용법

### 로컬 (docker-desktop / kind / minikube)

```bash
# 이미지 빌드 (repo 루트에서)
docker build -f backend/Dockerfile             -t clemvion/backend:latest  .
docker build -f frontend/Dockerfile            -t clemvion/frontend:latest .
docker build -f backend/migrations/Dockerfile  -t clemvion/migrate:latest  .

# 로컬 클러스터로 이미지 로드 (kind 예시)
kind load docker-image clemvion/backend:latest clemvion/frontend:latest clemvion/migrate:latest

# 적용
kubectl apply -k k8s/overlays/local

# 접속 (port-forward)
kubectl -n clemvion port-forward svc/frontend 3000:3000 &
kubectl -n clemvion port-forward svc/backend  3011:3011 &
```

브라우저: http://localhost:3000

### Staging / Prod

1. **이미지 빌드 & 푸시** — CI 에서 환경별 태그 (`staging`, `prod`) 로 레지스트리 푸시.
2. **Secret 생성** — SealedSecrets / external-secrets-operator 로 `backend-secret` 을 동등 namespace 에 생성. 키 목록은 `base/secret.example.yaml` 참고.
3. **endpoint 교정** — `overlays/<env>/kustomization.yaml` 의 `REPLACE_ME` placeholder 를 실 RDS / ElastiCache / S3 endpoint 로 교체.
4. **Ingress host 설정** — 동일 파일의 frontend / backend 두 host placeholder 를 실 도메인으로 교체. TLS Secret (`clemvion-frontend-tls`, `clemvion-backend-tls`) 은 cert-manager 등으로 별도 발급.
5. **적용**

```bash
kubectl apply -k k8s/overlays/staging
# 또는 ArgoCD Application 의 path 를 k8s/overlays/staging 으로 지정
```

## 주요 설계 결정

### 매니페스트 형식 — Kustomize
Helm 보다 가볍고 kubectl 네이티브. CRD 도입 없이 patch 기반 환경 분리.

### Stateful 의존성 — 외부 관리형 가정
`overlays/local` 만 in-cluster Postgres/Redis/MinIO 를 띄움. staging/prod 는 RDS / ElastiCache / S3 등을 사용한다는 전제로 endpoint 만 ConfigMap 에서 교정.

### Secret — SealedSecrets 가정
`base/secret.example.yaml` 은 키 스키마(=어떤 키들이 필요한지) 만 정의한 placeholder. 실 환경에서는 동일 이름의 `Secret` 을 별도로 생성:
- **SealedSecrets**: `kubeseal < secret.yaml > sealedsecret.yaml` 후 commit, 클러스터의 controller 가 복호화.
- **external-secrets-operator**: `ExternalSecret` CR 이 Vault/AWS SM 에서 가져와 동기화.

### Migration Job — ArgoCD PreSync hook
`base/migrate-job.yaml` 은 ArgoCD 동기화 시 backend Deployment 이전에 실행되도록 `argocd.argoproj.io/hook: PreSync`, `sync-wave: -5` 가 설정됨. ArgoCD 가 아닌 환경에서는 해당 annotation 무시되며, 일반 Job 으로 동작 (재적용 시 기존 Job 삭제 필요).

### Ingress — HAProxy
`ingressClassName: haproxy`. 두 종류 컨트롤러 (`haproxytech/kubernetes-ingress`, `jcmoraisjr/haproxy-ingress`) 는 annotation prefix 가 다르므로 `base/ingress.yaml` 상단 주석 참고.

frontend / backend 는 **host 단위로 분리**되어 두 개의 Ingress 리소스 (`clemvion-frontend`, `clemvion-backend`) 로 구성. 각 host 는 `/` (Prefix) 전체가 해당 서비스로 매핑되며, `/api`·`/socket.io`·`/docs` 는 backend host 에서 동일하게 노출됩니다. WebSocket(`/socket.io`) 의 `timeout-tunnel: 1h` annotation 은 backend Ingress 에만 적용.

### NEXT_PUBLIC_* — build-time 인라인
client bundle 에 인라인되는 한계상 환경별 이미지 빌드. `frontend/Dockerfile` 의 `--build-arg` 참고. 단일 이미지로 staging/prod 를 모두 커버하려면 같은 도메인 정책을 채택하거나 runtime-injection 패턴 (별도 작업) 도입 필요.

### Pod Security
- `runAsNonRoot: true`, `runAsUser: 1000` (`node` 유저, Dockerfile 과 일치).
- `readOnlyRootFilesystem: true` + `/tmp` 는 emptyDir.
- `capabilities.drop: ["ALL"]`, `allowPrivilegeEscalation: false`.

## Placeholder 체크리스트 (배포 전 필수 교체)

본 매니페스트는 환경 무관하게 commit 가능한 형태이므로, 실 클러스터에 적용하기 전 다음 placeholder 들을 환경에 맞게 교체해야 합니다. (`local` overlay 는 placeholder 없이 그대로 동작.)

### 1. 이미지 레지스트리

`base/kustomization.yaml` 의 `images:` 섹션 또는 overlay 의 `images:` 섹션에서 실 레지스트리 경로로 교체.

```yaml
# 예: ECR 사용 시
images:
  - name: clemvion/backend
    newName: 123456789.dkr.ecr.us-east-1.amazonaws.com/clemvion-backend
    newTag: <git-sha 또는 semver>
```

CI 파이프라인에서는 `kustomize edit set image clemvion/backend=<registry>/<repo>:<tag>` 를 사용해 자동 갱신.

### 2. Secret 실 값

`base/secret.example.yaml` 의 `stringData` 키들이 모두 `REPLACE_ME` placeholder. 실 환경에서는 동일 이름 (`backend-secret`) 의 Secret 을 별도로 공급:

| 키 | 비고 |
| -- | ---- |
| `DB_USERNAME`, `DB_PASSWORD` | 외부 DB 자격증명 |
| `JWT_SECRET` | 32 byte 이상 랜덤 |
| `S3_ACCESS_KEY`, `S3_SECRET_KEY` | IAM 사용자 / MinIO 루트 |
| `ENCRYPTION_KEY` | 정확히 32 byte hex (= 64 hex char) |
| `INTEGRATION_ENCRYPTION_KEY` | 임의 길이, SHA-256 으로 파생됨 |
| `MAIL_USER`, `MAIL_PASS` | `MAIL_TRANSPORT=smtp` 일 때만 |
| `GOOGLE_*`, `GITHUB_*`, `SLACK_*` | OAuth 사용 시 |

권장 공급 방식:
- **SealedSecrets** — `kubeseal` 로 봉인된 매니페스트를 commit, 클러스터 controller 가 복호화.
- **external-secrets-operator** — `ExternalSecret` CR 이 Vault / AWS Secrets Manager / GCP SM 에서 동기화.
- 둘 다 `base/secret.example.yaml` 을 동기화 대상에서 제외 (Argo `.argocd-source.yaml` 의 exclude 또는 kustomize `patches` 로 삭제) 한 뒤 동등 이름의 봉인 매니페스트로 대체.

### 3. 외부 DB / Redis / S3 endpoint

`overlays/staging/kustomization.yaml`, `overlays/prod/kustomization.yaml` 의 다음 키:

| 키 | 현재 placeholder | 채울 값 예 |
| -- | --------------- | ---------- |
| `DB_HOST` | `REPLACE_ME.rds.amazonaws.com` | RDS endpoint |
| `REDIS_HOST` | `REPLACE_ME.cache.amazonaws.com` | ElastiCache 엔드포인트 |
| `S3_ENDPOINT` | `https://s3.us-east-1.amazonaws.com` | 리전 맞춰서 (그대로 두거나 자체 호스팅 endpoint) |

DB/Redis 포트, S3 버킷·리전은 base ConfigMap 기본값 사용. 다르면 같은 patch 블록에 추가.

### 4. Ingress 호스트 & TLS

`overlays/staging|prod/kustomization.yaml` 의 host patch (frontend / backend 두 Ingress 각각):

| 대상 | 키 | 현재 placeholder (staging 예시) | 채울 값 |
| ---- | -- | ------------------------------ | ------- |
| `clemvion-frontend` | `/spec/rules/0/host`, `/spec/tls/0/hosts/0` | `app.staging.clemvion.example.com` | 실 frontend 도메인 |
| `clemvion-backend`  | `/spec/rules/0/host`, `/spec/tls/0/hosts/0` | `api.staging.clemvion.example.com` | 실 backend 도메인 |
| `clemvion-frontend` | `tls.secretName` (base) | `clemvion-frontend-tls` | cert-manager 가 발급한 frontend Secret 이름과 일치 |
| `clemvion-backend`  | `tls.secretName` (base) | `clemvion-backend-tls`  | cert-manager 가 발급한 backend Secret 이름과 일치 |

TLS Secret 자체는 cert-manager (`Certificate` CR) 또는 외부 발급 후 import 로 별도 생성. 두 host 를 wildcard 인증서 1장으로 커버하는 경우, 두 Ingress 의 `tls.secretName` 을 동일하게 patch.

### 5. HAProxy 컨트롤러 annotation

`base/ingress.yaml` 의 annotation 은 `haproxytech/kubernetes-ingress` (prefix `haproxy.org/`) 기준으로 작성. `jcmoraisjr/haproxy-ingress` 사용 시 같은 파일 주석에 표시된 대안 (`haproxy-ingress.github.io/...`) 으로 교체.

### 6. NEXT_PUBLIC_* — 환경별 frontend 이미지

`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL` 은 build-time 에 client bundle 에 인라인됨 → staging / prod 별로 다른 이미지가 필요. CI 파이프라인 예:

```bash
docker build -f frontend/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=https://api.staging.clemvion.example.com/api \
  --build-arg NEXT_PUBLIC_WS_URL=https://api.staging.clemvion.example.com \
  -t <registry>/clemvion-frontend:staging .
```

### 7. (옵셔널) 자원 / 스케일링

`base/*-deployment.yaml` 의 `resources` requests/limits 와 `replicas` 는 starter 값. 실 트래픽 측정 후 조정. HPA / KEDA 도입 시 `replicas` 는 minimum 으로만 사용.

---

## Smoke 테스트

```bash
# 매니페스트 syntax / 렌더 확인
kubectl kustomize k8s/overlays/local | kubectl apply --dry-run=client -f -
kubectl kustomize k8s/overlays/staging > /tmp/staging.yaml && kubectl apply --dry-run=client -f /tmp/staging.yaml

# 기동 후 헬스 체크
kubectl -n clemvion get pods
kubectl -n clemvion exec deploy/backend -- wget -qO- http://localhost:3011/api/health
kubectl -n clemvion exec deploy/frontend -- wget -qO- http://localhost:3000/api/health
```
