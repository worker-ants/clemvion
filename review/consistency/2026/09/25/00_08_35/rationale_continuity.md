### 발견사항

이번 리뷰 target 은 `--impl-prep` 스코프(`scope-storage`)가 자동 번들한 `spec/0-overview.md`(§2.7 Object Storage, `## Rationale`) + `spec/data-flow/4-file-storage.md`(`## Rationale`) + 다수 무관 spec 의 `## Rationale` 발췌(1-data-model.md, 2-navigation/1-workflow-list.md, 2-navigation/2-trigger-list.md 등)로 구성되어 있다. 그러나 실제 구현 대상은 `plan/in-progress/minio-image-parity-guard.md` (`spec_impact: none`)에 적힌 대로 `.claude/tests/test_minio_image_parity.py` 신설뿐이다 — `docker-compose.yml`/`docker-compose.e2e.yml`/`k8s/overlays/local/infra-minio.yaml` 세 파일의 MinIO 계열 컨테이너 이미지 문자열 6곳이 서로 일치하는지 검사하는 하네스 테스트다.

- **[INFO]** 번들된 spec Rationale 과 실제 작업 영역의 불일치
  - target 위치: 번들 상단 `spec/0-overview.md §2.7` / `spec/data-flow/4-file-storage.md` 전체, 그리고 나머지 70여 개 spec 의 Rationale 발췌
  - 과거 결정 출처: 해당 없음 (스코프 번들링 결과물이라 target 자체가 spec 변경안이 아님)
  - 상세: `spec/0-overview.md`·`spec/data-flow/4-file-storage.md` 의 Rationale 은 S3 객체 **키 prefix 설계**(KB/avatar workspaceId 제외), avatar 공개 읽기, `s3Service.delete` best-effort 등 **애플리케이션 레벨 스토리지 설계**에 관한 결정이다. 이번 작업(`test_minio_image_parity.py`)은 MinIO **컨테이너 이미지 태그/다이제스트** 를 세 인프라 파일 간에 일치시키는 하네스 가드로, 위 Rationale 이 다루는 결정 영역(키 설계·격리 전략)과 접점이 없다. 따라서 이 target 문서 안에서 "기각된 대안 재도입" 이나 "합의 원칙 위반" 에 해당하는 항목은 발견되지 않았다.
  - 제안: 조치 불요. `--impl-prep` 스코프 이름이 `scope-storage` 라 오브젝트 스토리지 spec 전체가 번들됐을 뿐, 실제 diff 범위(harness 테스트 3개 인프라 파일)와는 무관함을 인지하고 넘어가면 된다.

- **[INFO]** plan 자체가 과거 결정(#1325, #1392)과의 연속성을 스스로 방어하고 있음 (긍정적 관찰)
  - target 위치: `plan/in-progress/minio-image-parity-guard.md` §A "설계" 3항, §B 뮤턴트 M1
  - 과거 결정 출처: 해당 plan 문서가 인용하는 `#1325`(quay.io 이전 시 k8s 두 자리 누락) / `#1392`(MinIO 이미지를 `pgsty/silo` 로 전환하며 다이제스트 고정·`-distroless` 회피 결정)
  - 상세: plan 은 "태그+다이제스트 고정, `latest` 금지" 및 "`-distroless` 이미지 회피(헬스체크가 이미지 내부 `curl` 사용)" 를 **명시적으로 회귀 방지 대상**으로 삼고, 뮤턴트 M1 에서 "k8s Job 이미지만 옛 `quay.io/minio/mc:latest` 형태로" 되돌리는 시나리오까지 검증 설계에 포함했다. 이는 과거에 기각된 형태(`#1325` 부분 반영 실패, latest 태그)를 재도입하지 않는지 스스로 가드하는 설계로, Rationale 연속성 원칙에 부합한다. 다만 이 결정들의 근거(`#1325`/`#1392`)는 커밋 메시지·plan 본문에만 있고 `spec/` 의 `## Rationale` 절에는 없다 — `spec_impact: none` 이므로 spec 갱신 의무는 없지만, 향후 이 이미지 선택 근거를 spec 수준에서 참조해야 할 필요가 생기면 `spec/0-overview.md §2.7` 또는 인프라 관련 convention 문서에 짧게 남기는 것을 고려할 수 있다(강제 사항 아님).
  - 제안: 조치 불요 — 참고 사항.

### 요약
target 으로 번들된 spec Rationale(§S3 객체 키 prefix 설계, Flyway, Inline Alert 위치, Cafe24/MakeShop 분류 등)은 모두 애플리케이션 레벨 설계 결정이며, 실제 작업(`.claude/tests/test_minio_image_parity.py` 신설, `spec_impact: none`)은 인프라 컨테이너 이미지 문자열 일치성 검사로 그 결정 영역과 겹치지 않는다. 기각된 대안의 재도입, 합의 원칙 위반, 무근거 번복, invariant 우회 중 어느 것도 target 에서 발견되지 않았으며, 오히려 plan 자체가 과거 이미지 전환 결정(#1325 부분반영 실패, #1392 다이제스트 고정)을 회귀시키지 않도록 뮤턴트 테스트로 명시적으로 방어하고 있어 연속성 관점에서 문제가 없다.

### 위험도
NONE
