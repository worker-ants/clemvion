# Plan 정합성 검토 — MinIO 이미지 패리티 가드 (--impl-prep, scope=storage)

## 발견사항

- **[WARNING]** `self-hosting-deployment.md` 가 도입할 신규 MinIO 이미지 참조 자리가 새 가드 범위 밖
  - target 위치: `plan/in-progress/minio-image-parity-guard.md` §A "설계" — 세 파일·여섯 자리를 **모듈 수준 경로 상수로 명시 열거**하고, "`k8s/**` 로 넓히면 무관한 매니페스트 변경마다 하네스가 돈다" 는 근거로 와일드카드를 의도적으로 피함
  - 관련 plan: `plan/in-progress/self-hosting-deployment.md` §3 "Docker Compose 풀 번들 (NF-DP-02)" — `docker-compose.production.yml` 신설 + "MinIO 부팅 후 버킷 자동 생성" 체크박스, §4 "Kubernetes Helm Chart (NF-DP-03)" — `charts/clemvion/` templates 에 postgres/redis/**minio** PVC 포함
  - 상세: `self-hosting-deployment.md` 는 아직 `worktree: (unstarted)` 이고 체크박스 전부 미체크이지만, 실행되면 `docker-compose.production.yml` 과 Helm chart 양쪽에 **새 MinIO 컨테이너 이미지 참조**가 생긴다. `minio-image-parity-guard.md` 가 지금 고정하는 "세 파일·여섯 자리"에는 이 미래 자리가 없다 — 그 두 파일은 아직 존재하지 않으므로 열거 대상에서 빠진 것이 당연하지만, **plan 어디에도 "self-hosting-deployment 착수 시 이 목록을 갱신해야 한다"는 상호 참조가 없다**. `minio-image-parity-guard.md` 자신이 근거로 드는 실패 사례(`#1325` 가 k8s 두 자리를 놓쳤다가 리뷰에서 잡힌 "부분 반영")가 그대로 재발할 자리다 — 이번엔 가드 자체가 놓친 새 파일이라는 점만 다르다.
  - 제안: `minio-image-parity-guard.md` 체크리스트 또는 트레일러에 "MinIO 이미지를 참조하는 새 매니페스트(예: `docker-compose.production.yml`, Helm chart)가 생기면 본 테스트의 경로 상수 목록에 추가할 것" 한 줄을 남기거나, `self-hosting-deployment.md` §3/§4 체크박스에 "MinIO 이미지 패리티 가드(`.claude/tests/test_minio_image_parity.py`) 경로 목록 갱신" 항목을 신설한다. 어느 쪽이든 두 plan 중 하나가 갱신되어야 한다 — CRITICAL 은 아니다(두 파일 모두 아직 존재하지 않아 지금 당장 가드가 깨지지는 않는다).

- **[INFO]** Target 스코프(스토리지 도메인 spec)와 plan 실제 작업(이미지 태그 하네스 가드)이 직접 대응하지 않음
  - target 위치: `spec/0-overview.md` §2.7 Object Storage, `spec/data-flow/4-file-storage.md` (scope-storage 번들 전체)
  - 관련 plan: `plan/in-progress/minio-image-parity-guard.md` (frontmatter `spec_impact: none`)
  - 상세: 이번 --impl-prep 스코프로 묶인 두 target 문서는 MinIO 를 **애플리케이션 스토리지 백엔드**(버킷 키 패턴·아바타 공개 읽기 정책 등)로 다루는 문서다. 반면 검토 대상 plan 은 MinIO 를 **컨테이너 이미지 태그/다이제스트 하네스 테스트** 관점으로만 다루며, `.claude/tests/` 신설 + `harness-checks.yml` pathspec 등재가 전부이고 `spec_impact: none` 이 명시돼 있다. 두 문서 사이에 결정 충돌·선행조건·후속 무효화가 성립할 여지가 애초에 없다 — "MinIO" 라는 키워드 일치로 스코프가 storage 영역에 걸렸을 뿐, 실제 변경면은 겹치지 않는다. Critical/Warning 부재를 "정합성 검증을 통과했다"로 과대해석하지 않도록 스코프 자체를 기록해 둔다.
  - 제안: 없음 (기록용). 스코프 산정 로직 자체를 고칠 필요가 있다면 이는 plan 정합성이 아니라 `/consistency-check` 스코프 리졸버(orchestrator) 쪽 이슈다.

- **[INFO]** 같은 k8s 파일에 이미 열려 있는 별도 백로그 항목과의 상호 참조 부재
  - target 위치: `spec/0-overview.md` §5 "두 배포 방식 모두 동일한 기능을 제공" / §2.7 아바타 공개 읽기 정책
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` (라인 5840~5849) "k8s 로컬 오버레이의 버킷 Job 이 아바타 공개 정책을 걸지 않는다" (developer, 낮음, 2026-09-24 등재 · `minio-silo-image` §D 에서 발견해 분리)
  - 상세: `#1392`(이미지 교체) 작업 중 같은 파일 `k8s/overlays/local/infra-minio.yaml` 의 Job `minio-create-bucket` 이 두 compose 파일과 달리 아바타 공개 정책(`mc anonymous set-json`)을 걸지 않는다는 결함이 발견되어, 지금 검토 중인 이미지-패리티 가드 항목과 **의도적으로 분리**됐다(plan 본문 "그 PR 의 축이 아니라 분리"). 두 항목 모두 같은 Job 을 다루지만 검사 축이 다르므로(이미지 문자열 vs 정책 적용) 직접 충돌은 없다. 다만 `minio-image-parity-guard.md` 가 이 Job 을 "이미지가 일치하는가" 관점으로 하네스에 고정하면서, 같은 Job 에 알려진 별도 결함(정책 누락)이 있다는 사실을 언급하지 않는다 — 나중에 그 결함을 고치는 사람이 이미지-패리티 가드의 존재를 모르고 Job 구조를 바꾸면(예: 컨테이너 분리) 가드가 조용히 깨질 수 있다.
  - 제안: 차단 사유는 아니다. `minio-image-parity-guard.md` 에 한 줄로 "이 Job 은 별도로 `spec-draft-nullable-notation-followups.md` 의 아바타 정책 미해결 항목의 대상이기도 하다 — 그 작업 시 컨테이너 이름 변경 여부 확인" 정도의 상호 참조를 남기면 충분하다.

## 요약

검토 대상 plan(`minio-image-parity-guard.md`)은 `spec_impact: none` 인 harness-only 작업이고, 이번 --impl-prep 스코프로 번들된 target 문서(spec/0-overview.md §2.7, spec/data-flow/4-file-storage.md)는 MinIO 를 애플리케이션 스토리지 백엔드로 다루는 별개 관심사라 두 문서 사이에 결정 충돌이나 선행조건 미해소는 발견되지 않았다. 다만 plan/in-progress 전체를 훑은 결과, 아직 착수 전인 `self-hosting-deployment.md` 가 실행되면 새 MinIO 이미지 참조 자리(`docker-compose.production.yml`·Helm chart)가 생기는데 지금 만드는 가드의 파일 목록에는 그 자리가 반영될 경로가 plan 상에 없다 — 가드가 막으려는 바로 그 "부분 반영" 실패 클래스가 재발할 소지이므로 WARNING 으로 기록한다. 그 외 같은 k8s 파일을 다루는 별도 열린 백로그 항목(아바타 정책 누락)과의 상호 참조 부재는 INFO 수준이다.

## 위험도

LOW
