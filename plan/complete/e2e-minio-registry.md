---
title: minio 이미지를 quay.io 로 옮긴다 — Docker Hub 익명 pull 이 막혀 e2e 가 상시 실패
status: complete
owner: developer
worktree: e2e-minio-registry
started: 2026-09-12
completed: 2026-09-12
spec_impact: none
---

## 증상

`#1324` 의 CI 에서 `e2e` · `e2e-frontend` 두 job 이 **테스트를 한 건도 실행하지 못하고** 죽었다:

```text
minio Error pull access denied for minio/minio, repository does not exist or may
require 'docker login': denied: requested access to the resource is denied
make: *** [Makefile:59: e2e-test] Error 1
```

**재실행해도 같은 자리에서 죽었다**(`gh run rerun --failed` 1회). 마지막 초록은 2026-09-11 —
main·PR 양쪽에서 같은 워크플로가 통과했다. 그 사이 이 저장소는 docker-compose·Makefile·
`.github/**` 를 **한 줄도** 바꾸지 않았다.

## 실측 — rate limit 이 아니다. `minio/*` 저장소만 막혔다

익명 pull 토큰(`auth.docker.io`)을 받아 manifest 를 `HEAD` 로 찔렀다. 자격증명 없음, 읽기 전용:

| 이미지 | Docker Hub | quay.io |
|---|---|---|
| `minio/minio:RELEASE.2025-04-22T22-12-26Z` | **401** | **200** |
| `minio/mc:RELEASE.2025-04-16T18-13-26Z` | **401** | **200** |
| `minio/minio:latest` | **401** | 200 |
| `redis:7-alpine` | 200 | — |
| `pgvector/pgvector:pg18` | 200 | — |

**같은 시각 같은 클라이언트로 다른 두 이미지는 200 이다** — rate limit 이면 전부 막힌다.
증상 문구도 갈린다: 트래커에 기록된 옛 rate-limit 사고는 *"unauthorized: authentication
required"* 였고, 이번은 *"pull access denied … may require 'docker login'"* 이다.

> **그래서 트래커의 처분이 안 듣는다.** `spec-sync-external-interaction-api-gaps.md` 의
> 「Docker Hub 익명 pull rate limit」 항목은 **won't-do (2026-08-23 사용자 결정)** 로 닫히며
> *"조치는 실패 job 재실행"* 을 적어 뒀다. 그 전제(일시적 rate limit)가 이 형태에는 거짓이다 —
> `#1324` 에서 그 사실을 항목 본문에 실측과 함께 적었다.

## 처분 — 레지스트리만 바꾼다. 태그는 그대로

`quay.io` 는 MinIO 의 공식 배포처이고 **같은 태그가 있다**. 세 파일의 여섯 줄:

- `docker-compose.e2e.yml` — `minio` · `createbuckets`
- `docker-compose.yml` (dev) — 같은 두 서비스. **dev 도 같은 이유로 막힌다** — 새 개발자가
  `docker compose up` 을 하면 똑같이 실패한다. 한쪽만 고치면 다음 사람이 다시 진단한다.
- `k8s/overlays/local/infra-minio.yaml` — **세 번째 위치**(`/ai-review` dependency WARNING 이
  잡았다). 위 원칙을 내가 스스로 적어 놓고 한 파일을 빠뜨렸다. 실측상 CI·Makefile 어디서도
  참조되지 않아(`grep` → `kustomization.yaml`·`README.md` 뿐) 지금 장애의 원인은 아니지만,
  **그 오버레이를 처음 띄우는 사람이 같은 401 을 다시 진단하게 된다.**

> **태그는 이 PR 의 축이 아니다.** 그 k8s 파일은 `:latest` 를 쓰는데(이 저장소 자신의 W-59
> 주석이 경고하는 안티패턴), 여기서 함께 고치면 **레지스트리 축과 버전 고정 축이 한 diff 에
> 섞인다**. 이 PR 은 *"익명 pull 이 막혔다"* 한 축만 닫고, `:latest` → RELEASE 고정은
> 후속으로 등재한다 (`/ai-review` dependency INFO — 다이제스트 고정도 같은 축).

### 왜 이 처분인가 (기각 대안)

| 대안 | 왜 아닌가 |
|---|---|
| CI 에 Docker Hub 로그인 추가 | 시크릿 생성·등록이 사용자 몫이고, **dev compose 는 여전히 막힌다** |
| 이미지를 GHCR 로 미러링 | 미러 갱신 파이프라인이 새 유지보수 표면. 지금 필요 없다 |
| 실패 job 재실행 | **실측으로 반증됨** — 재실행해도 같은 자리 |

## 검증

- **quay 이미지가 Hub 것과 byte-동일하다** — 태그를 바꾼 것이 아니라 **레지스트리만** 바꿨음을
  image ID 로 확인했다:
  - `minio` → `sha256:6c83c74c8028…` (Hub 캐시본과 **동일**)
  - `mc` → `sha256:0029bb25aef9…` (동일)
- `docker compose -f docker-compose.e2e.yml pull minio createbuckets` → 둘 다 **Pulled**
- **`run-test.sh e2e` → `status=PASS tests=305 passed`** (이 워크트리에서 실행)
- `docker compose -f docker-compose.yml config` 로 dev compose 도 resolve 확인

## 후속 등재

- [ ] **`k8s/overlays/local/infra-minio.yaml` 의 `:latest` 를 RELEASE 태그로 고정** (developer).
      W-59 가 compose 쪽에 이미 내린 결정(*"`latest` 는 silent breaking change 위험"*)이 이
      오버레이에는 적용돼 있지 않다. 이 PR 은 레지스트리 축만 닫았다.
      함께 볼 것: **다이제스트(`@sha256:`) 고정** — 레지스트리를 옮긴 지금이 *"이 태그가 어떤
      바이트를 가리키는가"* 의 신뢰를 재설정하는 시점이라는 지적(dependency INFO).
      이번 PR 은 image ID 동일성을 **1회 수동 확인**했을 뿐 CI 가 강제하지 않는다.
- [ ] **다른 트래커 항목과의 관계 종결 확인** — `spec-sync-external-interaction-api-gaps.md` 의
      「Docker Hub 익명 pull rate limit」 항목에 *"(a) 실행됨"* 을 적었다. 그 항목은 이미
      `[x]`(won't-do) 라 체크박스는 건드리지 않았다.

## 체크리스트

- [x] `docker-compose.e2e.yml` 2줄
- [x] `docker-compose.yml` (dev) 2줄 — 같은 결함
- [x] `k8s/overlays/local/infra-minio.yaml` 2줄 — 리뷰가 잡은 세 번째 위치
- [x] quay pull 실증 + image ID 동일성
- [x] e2e 305/305
- [x] `/ai-review` — `review/code/2026/09/12/15_24_14` **CRITICAL 0 · WARNING 2** →
      RESOLUTION (세 번째 위치 수정 + 트래커 SoT 닫기). 두 건 다 같은 턴에 조치했다
- [x] PR
- [x] `plan/complete/` 이동
