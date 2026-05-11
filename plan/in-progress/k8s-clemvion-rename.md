# Plan: k8s 매니페스트 `idea-workflow` → `clemvion` 일괄 리네임

> 외부 plan 파일: `~/.claude/plans/k8s-abstract-canyon.md` (전체 설계). 본 문서는 저장소 내부 실행 체크리스트.

## 배경

`plan/complete/clemvion-rebrand.md` (Phase 1~5)에서 제품명을 **Idea Workflow → Clemvion**으로 일괄 전환했지만, k8s 매니페스트와 그에 결합된 Docker 이미지 태그는 "인프라 자산"으로 분류해 의도적으로 보류했다. 본 작업은 그 보류분을 마무리한다.

## 사용자 결정 사항

| 항목 | 결정 |
| --- | --- |
| 컨테이너 이미지 태그 | `idea-workflow/*` → `clemvion/*`. k8s 매니페스트뿐 아니라 `Dockerfile`/`README.md`의 build 명령도 함께 갱신 (빌드→배포 체인 정합) |
| `k8s/base/configmap.yaml` 의 `DB_DATABASE` | `idea_workflow` → `workflow` (docker-compose/.env.example 와 정합. 기존 rebrand 결정과 동일) |
| `S3_BUCKET` | `workflow-storage` 유지 (변경 없음) |
| 도메인 placeholder | `*.idea-workflow.example.com` → `*.clemvion.example.com` |

## 명시적 비변경 영역

- git repo 이름·remote URL
- 디렉터리명 (`clemvion/` 루트, `frontend/`, `backend/`)
- `Workflow AI Assistant` 서브 브랜드 명칭
- `S3_BUCKET = workflow-storage` (docker-compose 와 정합)
- `review/**`, `plan/complete/**` 시점 기록

## 체크리스트

### Phase 1 — k8s/base 매니페스트

- [ ] `k8s/base/namespace.yaml` — `metadata.name`, label `app.kubernetes.io/name`
- [ ] `k8s/base/kustomization.yaml` — `namespace`, `labels.pairs[name|part-of]`, `images[].name` 3건
- [ ] `k8s/base/configmap.yaml` — 라벨 2건, `DB_DATABASE → workflow`, `OTEL_SERVICE_NAME → clemvion-backend`
- [ ] `k8s/base/secret.example.yaml` — 라벨 1건
- [ ] `k8s/base/backend-service.yaml` — 라벨 2건
- [ ] `k8s/base/backend-deployment.yaml` — 라벨 3건 + image
- [ ] `k8s/base/frontend-service.yaml` — 라벨 2건
- [ ] `k8s/base/frontend-deployment.yaml` — 라벨 3건 + image
- [ ] `k8s/base/migrate-job.yaml` — 라벨 2건 + image + 헤더 주석의 `kubectl ... -n idea-workflow`
- [ ] `k8s/base/ingress.yaml` — Ingress name 2건, 라벨 2건, TLS secretName 2건

### Phase 2 — k8s/overlays

- [ ] `k8s/overlays/local/kustomization.yaml` — namespace + 주석 2건
- [ ] `k8s/overlays/staging/kustomization.yaml` — namespace, images 3건, 도메인 patch 4건, Ingress patch target 2건
- [ ] `k8s/overlays/prod/kustomization.yaml` — 동일 패턴 (도메인 patch 4건)

### Phase 3 — 빌드→배포 체인 (k8s 외부지만 결합)

- [ ] `backend/Dockerfile` 헤더 주석
- [ ] `frontend/Dockerfile` 헤더 주석
- [ ] `backend/migrations/Dockerfile` 헤더 주석 2건
- [ ] `backend/migrations/README.md` build/run 예시 5건
- [ ] `k8s/README.md` 본문 18라인
- [ ] `README.md` (root) — 보존 안내 문구, volume 이름, build 예시 3건
- [ ] `backend/README.md` — 보존 안내 문구, build 예시
- [ ] `frontend/README.md` — build 예시

### Phase 4 — 검증

- [ ] `grep -rn "idea-workflow\|idea_workflow" k8s/ <Dockerfile/README 대상>` 잔존 0
- [ ] `kubectl kustomize k8s/overlays/{local,staging,prod}` 모두 성공
- [ ] 결과물에 `idea-workflow|idea_workflow` 잔존 0
- [ ] staging/prod 의 Ingress patch target 이 `clemvion-frontend|backend` 로 매칭
- [ ] Configmap 정합: `DB_DATABASE: workflow`, `OTEL_SERVICE_NAME: clemvion-backend`, `S3_BUCKET: workflow-storage`

### Phase 5 — 리뷰/마무리

- [ ] `ai-review` 실행 → `review/**/RESOLUTION.md` 작성
- [ ] 본 plan → `plan/complete/`로 `git mv`
- [ ] `plan/complete/clemvion-rebrand.md` "명시적 비변경 영역"에 후속 작업 한 줄 메모 (선택)

## 리스크 / 운영자 후속 조치 메모

1. **namespace 변경** — 기존 클러스터의 `idea-workflow` namespace가 살아있다면 신규 namespace `clemvion`로 재배포. PVC 이전은 본 plan 범위 밖.
2. **TLS Secret 이름 변경** — cert-manager Issuer/Certificate 가 별도 저장소에 있다면 `secretName`을 `clemvion-{frontend,backend}-tls`로 함께 갱신.
3. **이미지 태그 변경** — 새 빌드 전까지 `idea-workflow/*` 이미지로는 동작하지 않음. CI 파이프라인의 `kustomize edit set image` 인자도 동시에 갱신 필요.
4. **`DB_DATABASE = workflow`** — 운영 DB가 `idea_workflow` 로 이미 살아있다면 ConfigMap만 따로 패치하거나 DB rename 결정 필요 (운영자 판단).
