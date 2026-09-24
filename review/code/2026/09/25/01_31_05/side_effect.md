# 부작용(Side Effect) 리뷰 — MinIO 이미지 일치 가드

## 검증 방법

- `.claude/tests/test_minio_image_parity.py` 전문을 정적으로 검토: `os.environ` · `subprocess` ·
  `requests`/`urllib`/`socket` · `open(`/`write_text`/`os.remove`/`shutil`/`.mkdir(` 패턴을 grep —
  전부 매치 없음. 파일 접근은 `Path.read_text(encoding="utf-8")` 뿐(읽기 전용).
- `python3 -m pytest .claude/tests/test_minio_image_parity.py -q` 실행 전후 `git status --short` 대조 —
  트리 변화 없음(`__pycache__` 는 gitignored, diff 에 안 잡힘). 20 passed, 45 subtests.
- `.github/workflows/harness-checks.yml` 의 신규 pathspec 3줄(`docker-compose.yml` ·
  `docker-compose.e2e.yml` · `k8s/overlays/local/infra-minio.yaml`) 확인 — 주석에 `k8s/**` 로 넓히지
  않은 이유가 명시되어 있고 실제로도 파일 단위로만 등재되어 있다.
- `test_minio_image_parity.py` 와 `test_harness_checks_paths_coverage.py` 를 함께 실행해 클래스명
  `ExtractorBoundaryTest` 중복(두 파일에 동명 클래스 존재)이 pytest 수집에 영향을 주는지 확인 —
  두 파일 동시 실행 시 46 passed, 52 subtests, 충돌 없음(pytest node-id 가 파일 단위로 스코프됨).
- `_harness.REPO_ROOT` 는 기존 공유 상수를 import 만 하고 재할당하지 않음(읽기 전용 참조).

## 발견사항

- **[INFO]** CI 트리거 표면 확장 — `harness-checks.yml` 이 이제 세 매니페스트 파일 변경 시에도 전체
  `.claude/tests` 스위트를 돈다
  - 위치: `.github/workflows/harness-checks.yml:96` (pathspec 블록, `docker-compose.yml` 부터
    `k8s/overlays/local/infra-minio.yaml` 까지 3줄)
  - 상세: 이 세 pathspec 은 이번 변경으로 신규 추가된 것으로 보이며(가드 docstring 의 "Trigger" 절이
    이를 요구), 향후 이 세 파일 중 하나만 건드리는 PR 은 이전에 안 돌던 `.claude/tests` 전체 스위트를
    실행하게 된다. 이는 가드의 목적 자체(등재가 없으면 정확히 그 PR 에서 안 돈다, `#1390` 클래스)라
    의도된 부작용이며, `k8s/**` 로 넓히지 않고 파일 단위로만 좁혀 무관한 매니페스트 변경까지 끌어들이는
    것은 피했다. 다른 reviewer(로직/스코프)가 이미 이 트리거 설계를 검토했겠지만, "CI 트리거 표면이
    넓어진다"는 부작용 자체는 기록해 둔다.
  - 제안: 조치 불요(의도된 설계). 추후 이 세 파일에 대한 PR 빈도가 높아 스위트 실행 비용이 문제가 되면
    그때 재검토.

- **[INFO]** 테스트 클래스명 중복 — `ExtractorBoundaryTest` 가 `test_minio_image_parity.py` 와
  `test_harness_checks_paths_coverage.py` 양쪽에 존재
  - 위치: `.claude/tests/test_minio_image_parity.py` `class ExtractorBoundaryTest(unittest.TestCase):`
    (전체 파일 컨텍스트 게이트 180번째 줄) / `.claude/tests/test_harness_checks_paths_coverage.py:416`
  - 상세: 두 파일을 동시에 pytest 로 실행해 확인한 결과 충돌 없음(46 passed) — pytest 는 node-id 를
    파일 경로로 스코프하므로 실질적 부작용은 없다. plan 의 `--impl-prep` 처분표(INFO 5 "명명 충돌
    없음")에서도 이미 검토·기각된 사항이라 재확인 성격의 기록.
  - 제안: 조치 불요.

## 요약

`.claude/tests/test_minio_image_parity.py` 는 세 매니페스트 파일을 `read_text` 로만 읽는 순수 읽기
전용 테스트 모듈이다 — 전역 상태 변경, 파일 생성/수정/삭제, 환경 변수 접근, 네트워크 호출, 콜백/이벤트
어느 것도 발견되지 않았다. 새 모듈 수준 상수(`DEV_COMPOSE`, `K8S_PLACES` 등)와 헬퍼 함수(`_dig`,
`_seq`, `_expect_one`, `_image_value`, `pin_violation`, `is_distroless`)는 전부 이 파일에 새로 도입된
것으로 기존 시그니처를 바꾸지 않으며, 기존 공유 상수 `REPO_ROOT` 는 읽기 전용으로만 참조한다. 유일하게
실질적인 "부작용"은 `harness-checks.yml` pathspec 확장으로 인한 CI 트리거 표면 증가인데, 이는 가드의
설계 목적 그 자체이고 범위도 파일 단위로 최소화되어 있어 문제로 보지 않는다. mutation 테스트 과정에서
저장소 파일을 임시로 고쳤다가 `cp` 로 원복한 이력이 plan 문서에 기록되어 있으며, 현재 `git status` 는
이 리뷰 세션 자신의 산출물(`review/code/2026/09/25/01_31_05/`)을 제외하면 완전히 clean 하다 — 잔여물
없음.

## 위험도
NONE
