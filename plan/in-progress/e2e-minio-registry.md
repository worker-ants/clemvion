---
title: minio 이미지를 quay.io 로 옮긴다 — Docker Hub 익명 pull 이 막혀 e2e 가 상시 실패
status: in-progress
owner: developer
worktree: e2e-minio-registry
started: 2026-09-12
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

`quay.io` 는 MinIO 의 공식 배포처이고 **같은 태그가 있다**. 두 compose 파일의 네 줄:

- `docker-compose.e2e.yml` — `minio` · `createbuckets`
- `docker-compose.yml` (dev) — 같은 두 서비스. **dev 도 같은 이유로 막힌다** — 새 개발자가
  `docker compose up` 을 하면 똑같이 실패한다. 한쪽만 고치면 다음 사람이 다시 진단한다.

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

## 체크리스트

- [x] `docker-compose.e2e.yml` 2줄
- [x] `docker-compose.yml` (dev) 2줄 — 같은 결함
- [x] quay pull 실증 + image ID 동일성
- [x] e2e 305/305
- [ ] `/ai-review`
- [ ] PR
- [ ] `plan/complete/` 이동
