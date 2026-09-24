# 문서화(Documentation) 리뷰 — MinIO 이미지 일치 가드

## 검토 범위

`.claude/tests/test_minio_image_parity.py` 신설(하네스 회귀 테스트) + 그에 딸린 문서화 표면 전부:
`.claude/tests/README.md` 카탈로그 행, `.github/workflows/harness-checks.yml` pathspec 3줄 + 주석,
`CHANGELOG.md` 항목, `plan/in-progress/minio-image-parity-guard.md`(신규 plan) 및 그로부터 파생된
`plan/in-progress/self-hosting-deployment.md`·`plan/in-progress/spec-draft-nullable-notation-followups.md`
갱신, 그리고 `review/consistency/2026/09/25/00_08_35/**` (이번 작업의 `--impl-prep` 산출물, 커밋됨).

실제 저장소 파일을 열어 다음을 교차 검증했다 (읽기 전용, 트리 변경 없음):
- `_PINNED` 정규식이 docstring 의 세 반례(무다이제스트·다이제스트뿐·짧은 다이제스트)와 일치하는지
- `docker-compose.yml` / `docker-compose.e2e.yml` 의 `avatars-public-read.json` 마운트·`mc anonymous set-json`
  호출이 `self-hosting-deployment.md` 새 보탬 문단의 서술과 일치하는지
- `test_harness_checks_paths_coverage.py::PRODUCT_PREFIXES`(`codebase/`·`spec/`·`plan/`·`review/`)에 `k8s/`가
  없다는 plan 의 "k8s 는 PRODUCT_PREFIXES 밖" 서술
- `spec-draft-nullable-notation-followups.md` 의 "MinIO 계열 이미지 참조 6곳" 항목과 "k8s 버킷 Job 아바타 정책"
  항목이 실제로 존재하고 상호 참조가 가리키는 내용과 일치하는지
- `/ai-review` `review/code/2026/09/24/23_33_07` SUMMARY.md 의 INFO #3(6곳 수동 중복)이 실제로 이 가드의
  등재 근거로 인용된 그 항목인지

모두 일치했다 — 아래는 그 과정에서 남길 만한 것과, 확인 결과 문제가 아니라고 판단한 항목이다.

## 발견사항

- **[INFO]** 신규 헬퍼 함수 4개(`compose_images`, `k8s_images`, `all_images`, `_render`)에 함수 단위
  docstring이 없다.
  - 위치: `.claude/tests/test_minio_image_parity.py:76`(`compose_images`), `:88`(`k8s_images`),
    `:108`(`all_images`), `:116`(`_render`)
  - 상세: 모듈 최상단 docstring(46줄)이 파일 구조·6곳 목록·4개 단언의 회귀 형태·트리거 메커니즘·범위
    한계까지 이례적으로 촘촘히 서술하고, 각 함수 본문도 5~10줄의 단순 로직(YAML 파싱 → dict 조립)이라
    실질적으로 읽고 이해하는 데 지장은 없다. `PlaceNotFound` 클래스에는 한 줄 docstring이 있어 "이름
    있는 예외" 라는 설계 의도는 코드 자체로 드러난다. 이 스위트의 다른 기존 테스트 파일들도 함수별보다
    모듈/클래스 docstring 에 근거를 싣는 관행이라(`test_workflow_yaml_structure.py`류 README 서술과
    대조 확인) 이 파일만의 결함은 아니다.
  - 제안: 조치 불요에 가깝다. 굳이 보탠다면 `k8s_images`에 "한 kind/name 조합이 정확히 1개 문서와
    매칭되어야 한다"는 `len(matches) != 1` 분기의 의도(다중 매칭도 실패로 본다)를 한 줄 docstring으로
    남기면 다음 사람이 그 분기를 보고 "왜 1개 미만뿐 아니라 초과도 실패인가"를 재추론할 필요가 없다.

- **[INFO]** 확인 결과 문제 없음 — 문서 간 서술 일치.
  - 위치: `.claude/tests/README.md`(신규 행) · `.claude/tests/test_minio_image_parity.py`(모듈 docstring)
    · `CHANGELOG.md`(신규 Unreleased 항목) · `plan/in-progress/minio-image-parity-guard.md`(§A 설계 · §B
    뮤턴트 표)
  - 상세: 4곳 모두 "단언 1"의 서술이 동일하게 "선언된 자리 목록이 여섯에서 줄지 않는다"로 맞춰져 있다.
    plan §B의 취소선 처리(`~~서비스 · 컨테이너가 사라지거나 이름이 바뀌면...~~`)로 M3 실측이 최초 설계
    문구를 반증했음을 남기고, 그 정정이 docstring·README·CHANGELOG 세 곳에 모두 반영된 것도 확인했다
    — 한 곳만 고치고 나머지가 stale 인 흔한 실패 패턴이 없다.
  - 제안: 없음(긍정 관찰, 기록 목적).

- **[INFO]** 확인 결과 문제 없음 — plan 상호 참조의 실재성.
  - 위치: `plan/in-progress/self-hosting-deployment.md:56-65`(§3 신규 보탬 두 항목)
  - 상세: "k8s 로컬 오버레이가 아바타 공개 정책을 빠뜨렸다"는 문장이 가리키는
    `spec-draft-nullable-notation-followups.md`의 "k8s 버킷 Job 아바타 정책" 항목, 그리고 "가드 자리
    목록·pathspec 에 추가" 항목이 가리키는 `review/consistency/2026/09/25/00_08_35` plan_coherence W3 이
    실제로 그 내용을 담고 있음을 확인했다. `scripts/minio/avatars-public-read.json` 경로도
    `docker-compose.yml:79`의 실제 마운트 경로와 일치한다.
  - 제안: 없음.

## 요약

MinIO 이미지 일치 가드 자체는 코드·README 카탈로그·CHANGELOG·plan(설계+뮤턴트 실측 표)·workflow
pathspec 주석까지 다섯 표면에 동일한 핵심 서술("단언 1이 실제로 막는 것은 자리 목록 축소")을 빠짐없이
반영했고, 실제 코드(정규식·PRODUCT_PREFIXES·docker-compose 마운트 경로)와 대조해도 어긋남이 없다. plan
간 상호 참조(`self-hosting-deployment.md` ↔ `spec-draft-nullable-notation-followups.md` ↔ 이번 plan)도
실재하는 항목을 정확히 가리킨다. 유일하게 남길 만한 것은 신규 헬퍼 함수 4개에 함수 단위 docstring이
없다는 점인데, 모듈 docstring이 그 역할을 충분히 대신하고 있어 차단 사유가 아니다.

## 위험도

NONE
