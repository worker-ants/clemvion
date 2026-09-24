# Rationale 연속성 검토 — minio-silo-image (--impl-prep)

## 검토 대상 요약

- **plan**: `plan/in-progress/minio-silo-image.md` — `docker-compose.e2e.yml` · `docker-compose.yml` (dev) · `k8s/overlays/local/infra-minio.yaml` 세 곳의 MinIO 서버/`createbuckets` 이미지를 quay.io `minio/*` → `pgsty/silo:RELEASE.2026-09-16T00-00-00Z@sha256:...` 로 교체 (태그+다이제스트 고정). `spec_impact: none`.
- **scope bundle**: `spec/0-overview.md` §2.7 (Object Storage) · `spec/data-flow/4-file-storage.md` 및 관련 Rationale 발췌(`spec/1-data-model.md`, `spec/2-navigation/*` 등).
- **선행 결정**: `plan/complete/e2e-minio-registry.md` (#1325, 2026-09-12) — Docker Hub 익명 pull 차단으로 `minio/*` 를 quay.io 로 이전한 결정. 이번 plan 은 그 quay.io 마저 막힌 데 대한 후속.

## 발견사항

- **[INFO]** spec 의 "MinIO" 서술은 이미지 벤더 불특정 — 이번 변경과 정합
  - target 위치: `plan/in-progress/minio-silo-image.md` §B·§D (이미지 교체 범위)
  - 과거 결정 출처: `spec/0-overview.md` §2.7 "셀프 호스팅 | MinIO 기본 제공 (Docker Compose에 포함)", `spec/data-flow/4-file-storage.md` Overview "개발/셀프 호스팅은 MinIO (docker-compose)"
  - 상세: spec 은 "MinIO" 를 self-host 스토리지 구현체로만 서술하고 구체 Docker 이미지 저장소(Docker Hub/quay.io/pgsty)나 벤더를 못박지 않는다. `pgsty/silo` 는 `pgsty/minio` 의 개명(AGPL-3.0 유지, MinIO 코드베이스의 커뮤니티 포크)이며, plan §C 가 `command: server ...` 문법·`mc` 심볼릭 링크·헬스체크 경로·버킷 정책 동작을 모두 실측으로 검증했다. 따라서 spec 문면이 서술하는 "MinIO(호환) 자체 호스팅" 이라는 사실 자체는 바뀌지 않아 `spec_impact: none` 판단은 근거가 있다. 다만 spec 이 "MinIO" 라는 고유명사를 계속 쓰는 한, 실제로는 원 프로젝트가 아닌 커뮤니티 포크를 가리키게 된다는 점은 문서에 드러나지 않는다.
  - 제안: 차단 사유는 아님. 여유가 있다면 `spec/0-overview.md` §2.7 표의 "MinIO" 옆에 "(pgsty/silo, MinIO 호환 포크)" 정도의 각주만 덧붙이는 선택지를 남겨 둘 것 — 이번 PR 의 축(이미지 공급)에 강제하지는 않는다.

- **[INFO]** 선행 rejected-alternative 이력과 이번 plan 의 관계는 재도입이 아니라 후속 결정 — 정합
  - target 위치: `plan/in-progress/minio-silo-image.md` §B 대안 표
  - 과거 결정 출처: `plan/complete/e2e-minio-registry.md` "왜 이 처분인가 (기각 대안)" — ①CI Docker Hub 로그인 ②이미지 GHCR 미러링 ③실패 job 재실행, 세 대안 모두 기각.
  - 상세: 이번 plan 은 위 세 대안 중 어느 것도 다시 꺼내지 않는다 — 새 문제(quay.io 마저 폐쇄)에 대해 새 대안(①`pgsty/minio` 마지막 릴리스 고정 ②rclone 기반 버킷 준비)을 검토하고 실측 근거와 함께 기각했다. `#1325` 가 기각한 "GHCR 미러링"(새 유지보수 파이프라인 비용)과 이번의 "pgsty/silo" 채택은 성격이 다르다 — 후자는 새 파이프라인을 만드는 것이 아니라 이미 존재하는 공개 이미지로 소스만 바꾸는 것이라 `#1325` 가 세운 "불필요한 유지보수 표면을 늘리지 않는다" 원칙과 상충하지 않는다. `#1325` 의 "태그 고정(W-59)까지만 하고 다이제스트는 후속" 이라는 유보 사항도 이번 plan 이 "레지스트리를 옮기는 지금이 신뢰 재설정 시점" 이라는 이유로 다이제스트까지 확장해 명시적으로 갚고 있다 — 번복이 아니라 이행.
  - 제안: 없음 (정합 확인용 기록).

- **[INFO]** 아바타 공개 정책·KB 격리 invariant 는 새 이미지에서도 유지됨을 실측으로 확인 — 우회 없음
  - target 위치: `plan/in-progress/minio-silo-image.md` §C 호환성 표 ("아바타 공개 정책" 행)
  - 과거 결정 출처: `spec/0-overview.md` Rationale "S3 객체 키 prefix 설계" — Avatar 는 `ListBucket` 차단 + UUID 키로만 통제, KB 는 DB 권한 검증으로 워크스페이스 격리(키 prefix 미채택).
  - 상세: plan 은 새 이미지에서 "익명 목록 403 · avatars GET 200 · 그 밖 403" 을 대조군(기각된 `set download` 프리셋이면 목록 200)까지 포함해 실측했다. 이는 `spec/0-overview.md` Rationale 이 규정한 "`ListBucket` 차단 + UUID 키" 조합 invariant 를 우회하지 않고 그대로 재확인한 것 — 결정 번복도, 원칙 위반도 없다.
  - 제안: 없음 (정합 확인용 기록). k8s 오버레이의 버킷 정책 누락(§D "범위 밖으로 등재")은 이번 plan 이 새로 만든 갭이 아니라 `#1258` 이래의 기존 갭을 정직하게 트래커에 재등재한 것이므로 Rationale 연속성 관점에서 문제 삼지 않는다.

## 요약

이번 plan 은 `spec/` 이 이미지 벤더·레지스트리를 못박지 않은 순수 인프라 영역(Docker 이미지 소스 교체)만 건드리며, `command`/`mc`/헬스체크/버킷 정책 등 spec 과 선행 Rationale(`e2e-minio-registry.md`, `0-overview.md` §S3 객체 키 prefix 설계)이 규정한 관찰 가능한 동작·invariant 를 실측으로 재확인했다. 과거에 명시적으로 기각된 대안(GHCR 미러링, CI 로그인, 재실행)을 다시 꺼내지 않았고, `#1325` 가 미룬 다이제스트 고정도 스스로 이행했다. `spec_impact: none` 판단은 spec 문면과 실측 근거로 뒷받침된다. 유일한 여지는 spec 이 여전히 고유명사 "MinIO" 를 쓰는데 실제로는 커뮤니티 포크("silo")를 가리키게 된다는 문서 정합의 미세한 틈으로, 이는 INFO 수준이며 이번 PR 의 축을 벗어난다.

## 위험도
NONE
