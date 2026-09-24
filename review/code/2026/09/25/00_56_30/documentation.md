# 문서화(Documentation) 리뷰 — MinIO 이미지 일치 가드

## 발견사항

- **[INFO]** 헬퍼 함수 4개(`compose_images`, `all_images`, `_render`, `is_distroless`)에 독스트링이 없다
  - 위치: `.claude/tests/test_minio_image_parity.py:99`(`compose_images`), `:139`(`all_images`), `:147`(`_render`), `:84`(`is_distroless`)
  - 상세: 같은 파일의 `k8s_images`(:110)·`pin_violation`(:72)·`_mapping`(:92)·`PlaceNotFound`(:88)는 "왜 이런 방어 로직인지"를 설명하는 독스트링을 갖췄다. 반면 위 4개는 로직이 단순해 이름만으로도 읽히고, 모듈 최상단 독스트링(1~46행)이 전체 설계·회귀 근거를 이미 충분히 설명한다. 실질적 이해에 지장은 없다.
  - 제안: 선택 사항. 굳이 고칠 필요는 없으나, 다음에 이 파일을 손댈 때 `all_images`/`compose_images`에 "여섯 자리를 모으는 진입점" 한 줄을 붙이면 대칭성이 좋아진다.

## 검증한 항목 (문제 없음, 참고용)

아래는 이번 변경의 문서 정확성을 실측으로 대조한 결과이며 전부 일치했다 — 별도 조치 불필요:

- `test_minio_image_parity.py` 모듈 독스트링의 4개 회귀 형태 설명은 실제 테스트(`test_all_six_places_found`·`test_all_places_use_one_image`·`test_each_is_pinned_by_tag_and_digest`·`test_no_distroless_variant`)와 1:1로 대응한다. 특히 "assertion 1이 실제로 막는 것은 자리 목록 축소"라는 서술은 `PlaceNotFound`가 파일 단위 결손을 먼저 잡는다는 코드 동작과 일치한다(M3 뮤턴트로 반증 후 정정된 서술).
- `_PINNED` 정규식 주석("digest-only reference has no tag")은 `^[^:@\s]+:(?P<tag>[^@\s]+)@sha256:[0-9a-f]{64}$`의 실제 동작과 일치.
- "compose healthchecks run `curl` inside the image" 주장은 `docker-compose.yml`(30~57행)·`docker-compose.e2e.yml`(65~78행) 양쪽의 `healthcheck.test: ["CMD", "curl", ...]`로 실측 확인됨.
- `harness-checks.yml`의 신규 pathspec 주석("k8s/** 로 넓히지 않는다 — 파일 단위로만")은 실제 diff(7줄 추가, `docker-compose.yml`·`docker-compose.e2e.yml`·`k8s/overlays/local/infra-minio.yaml` 개별 등재)와 일치.
- plan 문서의 "k8s는 PRODUCT_PREFIXES 밖" 서술은 `test_harness_checks_paths_coverage.py`의 `PRODUCT_PREFIXES = ("codebase/", "spec/", "plan/", "review/")`와 대조해 정확함.
- README.md(`.claude/tests/README.md:48`) 카탈로그 항목과 CHANGELOG.md(최상단 "Unreleased" 섹션) 항목 모두 존재하며, 서술된 뮤턴트 5개·분기 11개·테스트 15개(서브테스트 포함)는 실제 실행(`python3 -m unittest discover -s .claude/tests -p 'test_minio_image_parity.py' -v` → 15 tests OK)과 일치. plan 체크리스트의 "~~7개~~ → 15개" 취소선 정정도 커밋 이력과 일치.
- `plan/in-progress/self-hosting-deployment.md`에 추가된 "새 매니페스트가 이미지를 쓰면 이 가드의 자리 목록·pathspec에 손으로 추가하라"는 안내(§3·§4)는 가드 독스트링의 "Scope is the places that exist TODAY" 서술과 상호 보강되며, 백로그 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md`)의 해당 항목은 아직 미체크 상태로 plan의 체크리스트("트래커 항목 닫기" 미완)와 일치한다.
- `--impl-prep` 처분표(D)의 참조 경로 `review/consistency/2026/09/25/00_08_35/plan_coherence.md`는 실재하며 카테고리도 일치.

## 요약

이미 두 라운드의 리뷰를 거친 변경으로, 독스트링·인라인 주석·README 카탈로그·CHANGELOG·plan 문서 사이의 상호 정합성이 실측 기준으로 전부 일치했다. 유일한 지적은 사소한 헬퍼 함수 4개의 독스트링 부재(INFO)이며, 모듈 최상단 문서가 이를 충분히 보완한다. README 업데이트·CHANGELOG 항목·설정(pathspec) 문서화·예제(뮤턴트 표를 통한 사용 근거 제시)가 모두 이미 반영되어 있어 추가 조치가 필요한 문서화 갭은 발견되지 않았다.

## 위험도

NONE
