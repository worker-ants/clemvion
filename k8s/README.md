# Kubernetes Manifests

Idea Workflow 의 k8s 배포 매니페스트입니다. **Kustomize** 기반으로, 공통 base 와 환경별 overlay (`local`, `staging`, `prod`) 로 구성됩니다.

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
│   └── ingress.yaml            # HAProxy Ingress (path-based 라우팅)
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
docker build -f backend/Dockerfile             -t idea-workflow/backend:latest  .
docker build -f frontend/Dockerfile            -t idea-workflow/frontend:latest .
docker build -f backend/migrations/Dockerfile  -t idea-workflow/migrate:latest  .

# 로컬 클러스터로 이미지 로드 (kind 예시)
kind load docker-image idea-workflow/backend:latest idea-workflow/frontend:latest idea-workflow/migrate:latest

# 적용
kubectl apply -k k8s/overlays/local

# 접속 (port-forward)
kubectl -n idea-workflow port-forward svc/frontend 3000:3000 &
kubectl -n idea-workflow port-forward svc/backend  3011:3011 &
```

브라우저: http://localhost:3000

### Staging / Prod

1. **이미지 빌드 & 푸시** — CI 에서 환경별 태그 (`staging`, `prod`) 로 레지스트리 푸시.
2. **Secret 생성** — SealedSecrets / external-secrets-operator 로 `backend-secret` 을 동등 namespace 에 생성. 키 목록은 `base/secret.example.yaml` 참고.
3. **endpoint 교정** — `overlays/<env>/kustomization.yaml` 의 `REPLACE_ME` placeholder 를 실 RDS / ElastiCache / S3 endpoint 로 교체.
4. **Ingress host 설정** — 동일 파일의 host placeholder 를 실 도메인으로 교체. TLS Secret (`idea-workflow-tls`) 은 cert-manager 등으로 별도 발급.
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
`ingressClassName: haproxy`. 두 종류 컨트롤러 (`haproxytech/kubernetes-ingress`, `jcmoraisjr/haproxy-ingress`) 는 annotation prefix 가 다르므로 `base/ingress.yaml` 상단 주석 참고. WebSocket(`/socket.io`) 은 `timeout-tunnel` 을 길게(예: 1h) 잡아두는 게 안전.

### NEXT_PUBLIC_* — build-time 인라인
client bundle 에 인라인되는 한계상 환경별 이미지 빌드. `frontend/Dockerfile` 의 `--build-arg` 참고. 단일 이미지로 staging/prod 를 모두 커버하려면 같은 도메인 정책을 채택하거나 runtime-injection 패턴 (별도 작업) 도입 필요.

### Pod Security
- `runAsNonRoot: true`, `runAsUser: 1000` (`node` 유저, Dockerfile 과 일치).
- `readOnlyRootFilesystem: true` + `/tmp` 는 emptyDir.
- `capabilities.drop: ["ALL"]`, `allowPrivilegeEscalation: false`.

## Smoke 테스트

```bash
# 매니페스트 syntax / 렌더 확인
kubectl kustomize k8s/overlays/local | kubectl apply --dry-run=client -f -
kubectl kustomize k8s/overlays/staging > /tmp/staging.yaml && kubectl apply --dry-run=client -f /tmp/staging.yaml

# 기동 후 헬스 체크
kubectl -n idea-workflow get pods
kubectl -n idea-workflow exec deploy/backend -- wget -qO- http://localhost:3011/api/health
kubectl -n idea-workflow exec deploy/frontend -- wget -qO- http://localhost:3000/api/health
```
