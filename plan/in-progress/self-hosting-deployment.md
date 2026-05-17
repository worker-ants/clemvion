# 셀프 호스팅 배포 (Docker Compose 풀 번들 / Helm Chart / 운영·보안 가이드)

> 작성일: 2026-05-11
> 상위 인덱스: [`0-unimplemented-overview.md`](./0-unimplemented-overview.md) §B

## 배경

PRD 5 §2 / §3 / §7 의 다음 항목이 ❌ :

| ID | 요구사항 | 상태 |
|----|----------|------|
| **NF-SC-08** | 셀프 호스팅 환경에서의 보안 가이드 제공 | ❌ |
| **NF-EX-03** | 셀프 호스팅 시 단일 인스턴스부터 클러스터 배포까지 지원 | ❌ |
| **NF-DP-02** | Docker Compose 를 통한 간편 셀프 호스팅 배포 | ❌ |
| **NF-DP-03** | Kubernetes Helm Chart 제공 (클러스터 배포) | ❌ |
| **NF-DP-06** | 셀프 호스팅 설치/운영 문서 | ❌ |

현재 `docker-compose.yml` 은 **로컬 개발용 인프라 (Postgres pgvector + Redis + MinIO)** 만 정의. codebase/backend/frontend 자체의 컨테이너 이미지 빌드 + 풀 번들 + production 모드 환경변수 + reverse proxy + DB 마이그레이션 자동화는 미구현.

## 관련 문서

- `prd/5-non-functional.md` §2 / §3 / §7
- `prd/0-overview.md` §6.3 "배포 자동화 확장" 로드맵
- 현재 `docker-compose.yml` (dev infra 전용)
- `codebase/backend/migrations/` (Flyway 스타일 SQL — 자동 실행 메커니즘 필요)
- `spec/0-overview.md` §2.7 Object Storage / §2.8 DB 마이그레이션 (Flyway)

## 작업 단위

### 1. 디자인 결정

- [ ] **번들 범위** — 다음 컴포넌트 모두 포함: Postgres pgvector / Redis / MinIO / backend / frontend (정적 빌드 + nginx 또는 Node SSR) / Worker / reverse proxy (Caddy 또는 Traefik)
- [ ] **frontend 호스팅** — Next.js standalone 빌드를 Node 컨테이너로 띄울지, 정적 export 후 nginx 로 띄울지
- [ ] **마이그레이션 자동화** — backend 컨테이너 startup 시 Flyway migrate → migrate 실패 시 backend 부팅 중단
- [ ] **HTTPS** — 셀프 호스팅 사용자 도메인에 Let's Encrypt 자동 발급 (Caddy 가 적합)
- [ ] **시크릿 관리** — `.env.example` 제공 + `JWT_SECRET` / `ENCRYPTION_KEY` 등 자동 생성 헬퍼 (`scripts/init-secrets.sh`)
- [ ] **버전 태깅** — semver 기반 이미지 태그 (`v1.2.3` / `latest` / `rolling`)

### 2. 컨테이너 이미지

- [ ] `codebase/backend/Dockerfile` — multi-stage build (deps → build → runtime). Flyway CLI 또는 동등한 마이그레이션 도구 포함
- [ ] `codebase/frontend/Dockerfile` — Next.js standalone 또는 정적 빌드. SSR 페이지가 있으면 standalone 권장
- [ ] CI/CD 파이프라인에서 이미지 자동 빌드 + 레지스트리 push (GHCR 또는 Docker Hub)

### 3. Docker Compose 풀 번들 (NF-DP-02)

- [ ] `docker-compose.production.yml` 생성 — postgres + redis + minio + backend + worker + frontend + caddy
- [ ] `.env.example` 정의 (모든 필수 환경변수 + 기본값)
- [ ] backend startup script — Flyway migrate → 실패 시 exit 1
- [ ] MinIO 부팅 후 버킷 자동 생성 (`mc mb` 또는 backend 의 startup 훅)
- [ ] `README` 또는 `docs/self-hosting/docker-compose.md` 에 1-command setup 안내 (`docker compose -f docker-compose.production.yml up -d`)
- [ ] e2e: 빈 디렉터리 → 1-command 실행 → 모든 서비스 healthy → 회원가입 → 워크플로 생성·실행 까지 동작 확인

### 4. Kubernetes Helm Chart (NF-DP-03)

- [ ] `charts/clemvion/` 디렉터리 생성
- [ ] templates: Deployment (codebase/backend/frontend/worker), Service, Ingress, PVC (postgres/redis/minio), HPA, ServiceAccount, ConfigMap, Secret
- [ ] values.yaml — 환경별 override (dev/staging/prod)
- [ ] Helm test — `helm install --dry-run` + `helm test` 동작
- [ ] DB / Redis / MinIO 는 in-cluster (PVC) 또는 외부 (RDS/ElastiCache/S3) 모두 지원하도록 chart 옵션 분기
- [ ] Helm chart 자동 lint (CI)

### 5. 운영·보안 가이드 (NF-SC-08, NF-DP-06)

- [ ] `docs/self-hosting/` 디렉터리 신설 (또는 `codebase/frontend/src/content/docs/` 매뉴얼 영역)
  - `installation.md` — Docker Compose / K8s 설치 순서
  - `security.md` — 시크릿 관리 / TLS / Reverse proxy 설정 / 데이터베이스 암호화 / 백업
  - `upgrade.md` — 버전 업그레이드 절차 (마이그레이션 호환성 / 롤백)
  - `monitoring.md` — Prometheus / Grafana 연동 (NF-OB-02 와 연계)
  - `backup-restore.md` — DB 덤프 / MinIO 버킷 백업 / 복원 (NF-AV-05)
  - `troubleshooting.md` — 자주 묻는 문제 (Redis 연결 실패 / migration lock / OAuth callback URL)

### 6. 단일 → 클러스터 확장 (NF-EX-03)

- [ ] `docs/self-hosting/scaling.md` — 단일 호스트 → multi-node Compose Swarm → K8s 마이그레이션 흐름
- [ ] Worker 수평 확장 검증 — `replicas: N` 으로 Worker pod 늘렸을 때 BullMQ 분산 처리 확인 (이미 `plan/complete/foundation/` 의 stage 에서 검증되었을 가능성 높음 — 재확인만)

### 7. PRD 갱신

- [ ] `prd/5-non-functional.md` §2 NF-SC-08, §3 NF-EX-03, §7 NF-DP-02 / NF-DP-03 / NF-DP-06 상태 ❌ → ✅
- [ ] `prd/0-overview.md` §6.3 "배포 자동화 확장" 로드맵에서 본 항목 정리

### 8. REVIEW

- [ ] `ai-review` 실행 → Security / Side Effect / Architecture 중심
- [ ] 보안 가이드 자체에 대한 보안 리뷰 (`security-review` 스킬 — 셀프 호스팅 사용자가 따라할 때 안전한지)

## 수용 기준

- 1-command (`docker compose up -d`) 로 셀프 호스팅 가능
- Helm chart `helm install` 로 K8s 배포 가능
- 셀프 호스팅 운영 문서가 `docs/self-hosting/` 에 6개 페이지로 완결됨
- PRD NF-SC-08 / NF-EX-03 / NF-DP-02 / NF-DP-03 / NF-DP-06 모두 ✅
- ai-review + security-review Critical/Warning 0

## 의존성·리스크

- **의존**: codebase/backend/frontend 의 환경변수 정합성 — 누락된 env var 없는지 audit 필요
- **리스크**:
  - Flyway migration lock — production DB 에서 마이그레이션 실패 시 backend 부팅 차단 → graceful error 처리
  - MinIO 버킷 자동 생성 권한 — root credential 노출 위험. 별도 service account 권장
  - Helm chart 유지보수 부담 — semver 별 chart 버전 관리 필요
