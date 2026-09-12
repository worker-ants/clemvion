# 문서화(Documentation) 리뷰 — e2e-minio-registry

## 발견사항

- **[WARNING]** 처분을 실행했는데, 같은 문제를 이미 기록해 둔 트래커 항목이 "처분 후보 (사용자 결정 필요)" 상태로 그대로 남는다 — 두 문서가 같은 사실을 다르게 말하게 된다
  - 위치: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` — "Docker Hub 익명 pull rate limit" 체크박스 항목 하위의 `### ⚠️ 2026-09-12 — 이 처분의 전제가 반증됐다` 블록, 그 안의 `**처분 후보** (사용자 결정 필요 — 인프라 변경)` 문단 (블록 라인 1072~1099 부근, `Read` 로 대조 완료)
  - 상세: 이 블록은 `#1324` 시점에 실측(Docker Hub `minio/*` 401 vs quay.io 200)과 함께 "처분 후보 (a) quay.io 전환 (b) CI 로그인 (c) GHCR 미러"를 적어 두고 **아직 사용자 결정이 필요하다**고 명시한다. 그런데 이번 PR(`plan/in-progress/e2e-minio-registry.md`)이 사실상 그 처분 (a)를 그대로 실행해 `docker-compose.e2e.yml`·`docker-compose.yml` 두 곳을 quay.io 로 옮기고 검증까지 마쳤다. 새 plan 은 이 사실(측정치·기각 대안)을 트래커에서 거의 그대로 재서술만 하고, 정작 트래커 쪽 블록을 갱신하거나 "처분 완료, `e2e-minio-registry` 참조"로 닫지 않는다. 결과적으로 `spec-sync-external-interaction-api-gaps.md` 를 다음에 읽는 사람(사람이든 다른 세션이든)은 여전히 "사용자 결정 필요"로 읽고 (b)/(c) 를 다시 검토하거나 재차 사용자에게 묻게 된다 — 이 프로젝트가 CLAUDE.md/MEMORY.md 에서 반복 지적하는 "단일 진실 원칙 위반"·"stale plan 서술" 클래스와 정확히 같은 형태다.
  - 제안: 같은 PR(또는 최소한 이 plan 을 `complete/` 로 옮기는 커밋)에서 `spec-sync-external-interaction-api-gaps.md` 의 해당 처분 후보 블록에 취소선 또는 후속 노트를 추가해 "실행됨 → `plan/in-progress/e2e-minio-registry.md`(추후 `plan/complete/e2e-minio-registry.md`) 참조"로 닫는다. 반대로 `e2e-minio-registry.md` 쪽에도 이 트래커 항목을 `pending_plans` 류 링크로 명시하면 인입/인출 참조가 양방향으로 맞는다.

- **[INFO]** 같은 클래스의 잠재 결함(Docker Hub `minio/*` 익명 pull 차단)이 이번 처분 범위 밖에 문서화되지 않은 채 남아 있다
  - 위치: `k8s/overlays/local/infra-minio.yaml:38`(`image: minio/minio:latest`), `:99`(`image: minio/mc:latest`)
  - 상세: 이 plan 의 "처분" 절은 영향 범위를 "두 compose 파일의 네 줄"로 명시적으로 한정한다(`docker-compose.e2e.yml`·`docker-compose.yml`). 확인 결과 `k8s/overlays/local/infra-minio.yaml` 은 현재 어떤 Makefile/CI 워크플로에서도 참조되지 않아(`grep` 0건) 이번 CI 장애와 무관하며, 범위 기술이 틀린 것은 아니다. 다만 이 파일도 동일한 `minio/*` 저장소를 Docker Hub 에서 `:latest` 로 당겨 오므로, 나중에 이 오버레이가 실제로 기동되면 같은 401 을 재현할 잠재 지점이다. 정보성으로만 남긴다 — 지금 고칠 필요는 없다.
  - 제안: 조치 불필요. 다만 향후 이 오버레이를 CI/자동화에 연결하는 작업이 생기면 이번 plan 을 참고하도록 plan 본문이나 커밋 메시지에 한 줄 남겨두면 재진단 비용을 줄인다.

## 확인했으나 문제 없음 (참고)

- 두 compose 파일의 주석은 정확하고 일관적이다. `docker-compose.e2e.yml` 은 상세 실측 근거를 중복 서술하지 않고 "dev compose 의 같은 자리 주석 참조"로 위임했고(단일 진실 지점화), `docker-compose.yml` 쪽에 실측 표·날짜·기각 사유가 모두 있다 — 두 주석이 서로 모순되지 않는다.
- `CHANGELOG.md` 는 이 저장소에서 API/행동 변경 전용으로 쓰이고 있고(과거 유사한 이미지 태그 고정·anchor 리팩터 등 순수 인프라 변경도 이력에 없음), 이번처럼 CI 인프라 이미지 레지스트리만 바꾸는 변경은 선례상 항목을 추가하지 않는 것이 이 저장소의 기존 관행과 일치한다.
- `README.md`/`PROJECT.md`/`scripts/minio/README.md`/`.github/**` 어디에도 MinIO 이미지의 레지스트리(Docker Hub vs quay.io)를 하드코딩해 서술한 곳이 없어, 추가로 갱신할 문서는 없다.
- 새 `plan/in-progress/e2e-minio-registry.md` 는 frontmatter 3필드(`worktree`/`started`/`owner`) 스키마·`spec_impact: none`(bare) 를 모두 준수하며, 증상→실측→처분→기각 대안→검증→체크리스트 구조가 명확하고 실측(HTTP 상태 코드, image ID 동일성, e2e 통과 건수)이 구체적으로 남아 있다.

## 요약

두 docker-compose 파일의 주석 갱신 자체는 정확하고 서로 참조 관계도 잘 정리돼 있어 문제가 없다. 다만 이번 변경이 실행한 처분이 이미 존재하던 트래커 항목(`spec-sync-external-interaction-api-gaps.md`)의 "사용자 결정 필요" 상태를 갱신하지 않아, 같은 이슈에 대해 한쪽은 "해결됨", 다른 한쪽은 "미결"이라고 말하는 SoT 드리프트가 하나 남는다. CHANGELOG·README·API 문서 등은 이번 변경 범위상 갱신이 불필요함을 확인했다.

## 위험도

LOW
