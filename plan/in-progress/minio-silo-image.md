---
title: MinIO 이미지를 pgsty/silo 로 교체 — quay.io 의 minio/* 도 비공개가 됐다
status: in-progress
owner: developer
worktree: minio-silo-image
spec_impact: none
started: 2026-09-24
---

# quay.io 도 닫혔다 — 12일 만에 두 번째 레지스트리

`#1391` 의 `e2e` · `e2e-frontend` 가 **테스트 0건 실행**으로 죽었다. 두 잡 모두 컨테이너
기동 전 이미지 pull 에서 멈췄다:

```
createbuckets Error unauthorized: access to the requested resource is not authorized
```

`#1325`(2026-09-12)가 Docker Hub 의 `minio/*` 익명 pull 차단을 피해 quay.io 로 옮겼는데,
그 quay.io 도 막혔다. main 의 마지막 e2e 초록은 2026-09-24 12:00 UTC, `#1391` 실패는 13:41 UTC
— 그 사이에 바뀌었다. **이 저장소의 모든 e2e(main 포함)가 상시 차단된다.**

## A. 실측 — 무엇이 닫혔고 무엇이 열려 있나 (2026-09-24)

| 대상 | 결과 |
| --- | --- |
| `quay.io/minio/mc:RELEASE.2025-04-16T18-13-26Z` pull | **`unauthorized`** (로컬에서도 재현) |
| `quay.io/minio/minio:RELEASE.2025-04-22T22-12-26Z` pull | **`unauthorized`** |
| quay API `repository/minio/{mc,minio}` | **401** `Requires authentication` |
| 대조군 quay API `prometheus/prometheus` · `coreos/etcd` · `prometheus/busybox` pull | **200** · **200** · 성공 — quay 장애가 아니다 |
| Docker Hub `minio/minio` 저장소 | **404** — 이미 사라졌다 |

**로컬 e2e 가 초록이었던 이유**: 두 이미지가 로컬에 캐시돼 있었다. 새 기계·CI 는 전부 실패한다.

## B. 결정 — `pgsty/silo` (사용자 결정 2026-09-24)

`pgsty/silo` 는 Pigsty 가 유지하는 MinIO 서버의 커뮤니티 포크다(AGPL-3.0 — 원본과 같다, GitHub
별 3.4k, 2026-08-06 `pgsty/minio` 에서 개명). 사용자와 함께 검토한 대안과 기각 사유:

| 대안 | 실측 | 처분 |
| --- | --- | --- |
| `pgsty/minio:RELEASE.2026-08-04T00-00-00Z` 고정 | 동작한다. 그러나 **MinIO 이름으로 나온 마지막 릴리스**라 이후 보안 수정이 없다 | 계속 유지되는 `pgsty/silo` 로 |
| 버킷 준비를 **rclone** 으로 | rclone 은 버킷을 만들 수 있지만 **버킷 정책 명령이 없다**(`backend help s3`: restore · versioning · set 뿐). 공개 관련 손잡이는 canned ACL(`--s3-bucket-acl public-read`)뿐인데 MinIO 계열은 무시한다 — 적용해도 아바타 익명 GET 이 **403** 이다. 설령 먹어도 버킷 전체 public-read 는 `scripts/minio/README.md` 가 기각한 «목록까지 여는 프리셋» 이다. 정책을 걸려면 `curl` SigV4 PUT 이 따로 필요하고, 그 `curl` 로 버킷도 만들 수 있다 | 기각 — 이미지만 늘고 능력은 안 는다 |

**선택한 이미지**: `pgsty/silo:RELEASE.2026-09-16T00-00-00Z@sha256:635197cb9f36d01bee221d34d1c7d7960f6a95c48b0b6c01d99cd13bdae51a46`
(GitHub · Docker Hub 모두 정식 릴리스, prerelease 아님). **서버와 `createbuckets` 가 같은 이미지**를
쓴다 — 이미지에 클라이언트(`mcli`, `mc` 심볼릭 링크)와 `curl` 이 들어 있다. 외부 이미지가 둘에서
하나로 준다.

> **태그 + 다이제스트로 고정한다.** Docker Hub 태그는 가변이다. W-59 는 태그 고정까지만 했다.
> 레지스트리를 옮기는 지금이 «이 태그가 어떤 바이트를 가리키는가» 의 신뢰를 재설정하는 시점이다
> (`#1325` 의 dependency INFO 가 같은 지적을 했다).

## C. 호환성 실측 — 우리가 쓰는 표면 전부

scratch 에서 실제로 띄워 쟀다(이 저장소 파일은 바꾸지 않고).

| 표면 | 결과 | 근거 |
| --- | --- | --- |
| `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` | 그대로 | 이 값으로 기동 · `mc` 인증 통과 |
| `command: server /data --console-address ":9001"` | 그대로 | 엔트리포인트가 `server …` 를 `silo server …` 로 번역한다(`minio …` 도) |
| 헬스체크 `curl -f …/minio/health/live` | 그대로 | 이미지에 `curl` 포함 · `/minio/*` 경로 유지 |
| 콘솔 `:9001` | HTTP 200 | 서버 안에 포함된 콘솔 |
| `createbuckets` entrypoint(`mc alias set` · `mb --ignore-existing` · `anonymous set-json`) | **글자 그대로** 동작 | `/usr/bin/mc -> mcli` |
| 아바타 공개 정책 | 익명 목록 **403** · avatars GET **200** · 그 밖 **403** | **대조군**: 기각된 프리셋(`set download`)이면 목록 **200** — 판정이 공허하지 않다 |
| 백엔드 S3 동작 (`@aws-sdk/client-s3` 3.1097.0 · path-style · us-east-1) | 전부 OK | PutObject · GetObject · DeleteObject · DeleteObjects(3건) · 공개 URL 익명 GET |
| 옛 MinIO(2025-04)가 쓴 볼륨을 silo 로 | 객체 · 정책 보존 | 정책 재적용 없이 판정 통과 — dev 의 기존 `minio_data` 볼륨 |
| 역방향(silo 가 쓴 볼륨을 옛 MinIO 로) | 데이터 · 정책 유지 | 단 옛 MinIO 가 silo 가 기록한 LDAP 설정 키(`sts_trusted_proxies`)를 몰라 LDAP 설정을 끈다는 로그를 남긴다 — LDAP 미사용이라 무영향, **설정 쓰기가 한 방향**이라는 뜻 |
| **e2e 전체** (compose override 로 이미지만 교체) | **backend 70 suites · 380 passed**(`users-avatar-upload` 포함) + **playwright 51 passed** | |

**주의 셋**:

- **`mc` 링크는 문서화된 약속이 아니다.** Dockerfile 에는 있지만 README 는 클라이언트를 `mcli` 로만
  소개한다. 다이제스트 고정이라 지금은 안전하고, 버전을 올릴 때 확인한다(compose 주석에 적는다).
- **`distroless` 태그는 쓰면 안 된다** — `curl` 이 없어 헬스체크가 깨진다.
- 호환성을 깨는 변경으로 CHANGELOG 가 적은 것은 IAM 관리 권한 분리(`admin:ChangeMyPassword`)뿐 —
  우리와 무관하다.

## D. 범위 — 세 곳

`#1325` 가 리뷰에서 **세 번째 위치를 놓쳤던** 자리라 먼저 전수로 셌다(`grep` — `plan/` 이력 제외):

| 파일 | 서비스 | 변경 |
| --- | --- | --- |
| `docker-compose.e2e.yml` | `minio` · `createbuckets` | 이미지 2줄 + 주석 |
| `docker-compose.yml` (dev) | `minio` · `createbuckets` | 이미지 2줄 + 주석 |
| `k8s/overlays/local/infra-minio.yaml` | StatefulSet `minio` · Job `minio-create-bucket` | `:latest` 2줄 → 같은 고정 이미지 + 주석 |

k8s 는 `:latest` 였다 — `#1325` 가 «버전 고정 축(W-59)이라 섞지 않는다» 며 후속으로 남긴 항목
(`plan/complete/e2e-minio-registry.md` §후속 등재, 미체크)이다. 이번엔 **이미지를 바꾸는 것 자체가
고정**이라 축이 분리되지 않는다 — 같은 diff 에서 닫는다.

**범위 밖으로 등재할 것**: k8s Job `minio-create-bucket` 은 `mc mb` 만 하고 **아바타 공개 정책을
걸지 않는다.** compose 두 곳은 `#1258`(아바타 업로드)이 정책을 넣었는데 k8s 오버레이는 빠졌다 —
k8s 로컬에서는 아바타 이미지가 403 일 것이다. 이 PR 의 축(이미지 공급)이 아니므로 트래커에 등재한다.

## E. 체크리스트

- [x] `/consistency-check --impl-prep` — **구현 전에** → `review/consistency/2026/09/24/23_12_45`
      **BLOCK: NO · Critical 0 · Warning 0 · INFO 8**. scope 는 `spec/data-flow/4-file-storage.md` ·
      `spec/0-overview.md` 두 파일만 담은 scratch 사본(두 본문 5/5 적재 확인 · `meta.json` 은 저장소 경로 +
      `scope_note`). INFO 처분은 §F
- [x] 세 파일 교체 + 주석 — 치환 스크립트가 앵커 6개를 **정확히 1회씩** 매칭함을 assert
- [x] `docker compose config --images` (dev · e2e) · `kubectl kustomize k8s/overlays/local` — 세 곳 모두
      새 이미지 2건씩으로 해석
- [x] 캐시 없이 pull 되는지 — 로컬 `pgsty/silo` 이미지를 **지우고**(0건 확인) `docker compose -f
      docker-compose.e2e.yml pull minio createbuckets` → `Pulled`, 다이제스트 일치
- [x] CHANGELOG 항목 (커밋 전 staged 확인)
- [ ] TEST WORKFLOW — lint · unit · build · e2e (**실제 파일로**, override 아님)
- [ ] `/ai-review` — **e2e 가 끝난 뒤** 띄운다(바인드 마운트 e2e 와 리뷰어 뮤테이션이 겹친 전례)
- [x] 트래커 갱신 — 레지스트리 항목에 2026-09-24 경과(«재검토 불요» 취소선 + 반증 기록 + 세 번째 폐쇄 시
      GHCR 재검토) · `e2e-minio-registry` 후속 두 항목 종결 · k8s 정책 누락 등재(백로그 트래커)

## F. `--impl-prep` INFO 처분

| # | 지적 | 처분 |
| --- | --- | --- |
| 1 | spec 이 «MinIO» 를 벤더로 적는데 실제는 포크 | **안 한다(지금은).** spec 은 «S3 호환 셀프호스팅 스토리지» 라는 **역할**을 서술하고, silo 는 프로토콜 · 저장 형식 · `MINIO_*` · 서비스 이름을 유지한다. 포크라는 사실은 compose 주석이 SoT 다. checker 도 «이번 PR 에 강제하지 않음» |
| 2 · 3 | 선행 기각 대안과 정합 · 정책 invariant 유지 | 조치 불요(확인 기록) |
| 4 · 5 | 번들 scope 가 인프라 diff 와 안 맞음 · conventions 절단 | 프로세스 참고. 이번 target 은 API 계약을 다루지 않는다 |
| 6 | 트래커의 «재검토 불요» 가 반증된 전제 위에 남아 있다 | **반영** — 취소선 + 2026-09-24 반증 기록 |
| 7 | `e2e-minio-registry` 후속 두 항목이 미체크 | **반영** — 둘 다 종결 메모와 함께 `[x]` |
| 8 | 다시 제3자 공개 레지스트리 하나에 기댄다 | **반영** — 트래커에 «세 번째 폐쇄 시 GHCR 미러링 재검토» 를 적었다 |
