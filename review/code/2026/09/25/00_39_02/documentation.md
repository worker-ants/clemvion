# 문서화(Documentation) 리뷰 — MinIO 이미지 일치 가드 (2라운드)

## 검토 범위

1라운드(`review/code/2026/09/25/00_25_55`) Warning 3건이 `c8a1a59b6`로 조치된 뒤의 상태를 다시 본다.
대상: `.claude/tests/test_minio_image_parity.py`(신설, 1라운드 수정 반영본), `.claude/tests/README.md`
카탈로그 행, `.github/workflows/harness-checks.yml` pathspec 3줄, `CHANGELOG.md` 신규 항목,
`plan/in-progress/minio-image-parity-guard.md`(신규 plan) 및 그로부터 파생된
`plan/in-progress/self-hosting-deployment.md` · `plan/in-progress/spec-draft-nullable-notation-followups.md`
갱신, 그리고 1라운드 산출물(`review/code/2026/09/25/00_25_55/**`) · `--impl-prep` 산출물
(`review/consistency/2026/09/25/00_08_35/**`) 커밋.

실제 저장소 파일을 직접 열어 다음을 교차 검증했다 (읽기 전용, 트리 변경 없음):
- `plan/in-progress/minio-image-parity-guard.md` 체크리스트의 "새 테스트 N개" 실측 주장을 실제
  `python3 -m unittest discover -s .claude/tests -p 'test_minio_image_parity.py' -v` 실행 결과와 대조
- `.claude/tests/README.md`의 "One exception … PyYAML" 단락이 나열하는 파일 목록을, 실제로
  `import yaml`을 쓰는 `.claude/tests/*.py` 전체와 대조
- `spec/0-overview.md:142`의 "알파벳 순 숫자 prefix" 서술과 `ls spec/data-flow | sort -n` 실측 대조
- `docker-compose.yml`/`k8s/overlays/local/infra-minio.yaml`의 `W-59` 주석, `PRODUCT_PREFIXES` 상수,
  `scripts/minio/README.md` 등 plan 본문이 인용하는 근거 파일들의 실재성

## 발견사항

- **[WARNING]** plan 체크리스트의 테스트 개수 실측 주장이 1라운드 수정 이후 갱신되지 않아 stale
  - 위치: `plan/in-progress/minio-image-parity-guard.md:81`
  - 상세: `- [x] 테스트 작성 + ... 새 테스트 7개는 이름으로 실행 확인(`-v` 7 passed)` 라고 적혀 있다.
    그러나 이 문장이 가리키는 "7개"는 **1라운드 리뷰 전** 상태다 — 1라운드 `RESOLUTION.md`가
    "기존 7 + 새 2 테스트"라고 명시하듯, Warning 1(중복 리소스 미검증)·INFO 15(malformed 타입
    미포장) 조치로 `test_k8s_duplicate_resource_is_named`·
    `test_compose_malformed_service_is_named_not_attribute_error` 두 건이 `c8a1a59b6`에서
    추가됐다. 실제로 지금 `.claude/tests/test_minio_image_parity.py`를 셌을 때
    (`grep -c "def test_"` = 9, `unittest discover` 실행 결과도 `Ran 9 tests ... OK`) 테스트는
    **9개**다. `[x]`로 완료 처리된 체크리스트 항목 안에 이제는 틀린 실측 수치가 남아 있다 —
    메모리 "«실측했다»가 여덟 번 틀렸다"가 경고하는 바로 그 패턴(측정 시점이 문서화 시점보다
    앞서 있는데 갱신이 안 됨)이다.
  - 제안: `-v 7 passed`를 `-v 9 passed`로 정정하거나, 최소한 "1라운드 조치로 2건 추가돼 9개"라는
    한 구절을 덧붙인다. 이 plan 은 `spec_impact: none`이라 정정에 별도 게이트가 걸리지 않는다.

- **[INFO]** `.claude/tests/README.md`의 "PyYAML 예외" 단락이 나열하는 파일 목록에 이번 PR 이 추가한
  `test_minio_image_parity.py`가 없다 — 단, 이 단락은 이번 PR 이전부터 이미 불완전했다
  - 위치: `.claude/tests/README.md:19` (단락 시작; 이번 diff 는 이 단락을 건드리지 않았다 — 카탈로그
    표 행만 추가했다)
  - 상세: 이 단락은 "`test_override_floors.py`", "`test_workflow_yaml_structure.py`",
    "`test_review_gate_ci.py`" 세 파일을 이름으로 나열하며 PyYAML 예외 대상을 서술한다. 그런데
    실제로 `import yaml`을 쓰는 `.claude/tests/*.py`는 이 셋 외에도
    `test_changed_paths_reusable.py` · `test_pnpm_workspace_action.py` ·
    `test_required_check_skip_jobs.py` · `test_spec_link_checks_scope.py` ·
    `test_workflow_run_inputs_covered.py` 5개가 이미 더 있다 — 이 5개는 이번 PR 이전부터 목록에서
    빠져 있던 기존 drift다. 이번 PR 이 추가하는 `test_minio_image_parity.py`도 `import yaml`을 쓰므로
    (`:52`) 같은 부류지만 역시 이 단락에는 반영되지 않았다. 단락 자체가 "개수를 프로즈에 박지 않는다"
    (`Deliberately not "two files" or "three"`)고 스스로 경고하면서도 **이름 목록**은 예시로 나열하고
    있어, 이름 목록이 늘어날 때마다 조용히 stale 해지는 구조는 그대로 남아 있다.
  - 제안: 이번 PR 범위에서 반드시 고칠 필요는 없다(선재 drift). 다만 이 단락을 다음에 손댈 때는
    "예시 3개 + 나머지는 `grep -l '^import yaml' .claude/tests/*.py`로 확인" 형태로 바꿔 이름 목록
    자체가 stale 해지는 구조를 없애는 편을 고려할 만하다.

- **[INFO]** 확인 결과 문제 없음 — 핵심 서술 5표면 일치, W-59/PRODUCT_PREFIXES/경로 인용 실재성 확인
  - 위치: `.claude/tests/test_minio_image_parity.py`(모듈 docstring) · `.claude/tests/README.md`(신규 행)
    · `CHANGELOG.md`(신규 Unreleased 항목) · `plan/in-progress/minio-image-parity-guard.md`(§A·§B)
    · `.github/workflows/harness-checks.yml`(pathspec 주석)
  - 상세: "단언 1이 실제로 막는 것은 자리 목록 축소"라는 M3 이후 정정된 이해가 다섯 표면 모두에
    동일하게 반영돼 있다(1라운드 documentation 리뷰가 이미 확인한 상태가 이번 라운드에도 유지됨).
    `W-59` 참조는 `docker-compose.yml:40` 등 실제 주석과 일치, `PRODUCT_PREFIXES`에 `k8s/`가 없다는
    plan 의 서술도 `test_harness_checks_paths_coverage.py:111`과 일치, `scripts/minio/README.md`도
    실재하며 아바타 공개 정책 서술과 부합한다. `review/code/.../23_33_07` INFO 3, 이번 라운드
    `--impl-prep` 산출물(`review/consistency/2026/09/25/00_08_35`)의 W1~W3 처분 표도 실제 파일
    내용과 정확히 대응한다.
  - 제안: 없음(긍정 관찰, 기록 목적).

- **[INFO]** 1라운드 Warning 3(scope) 조치 확인 — `self-hosting-deployment.md` 세부 노트 축소가 실제로
  반영됨
  - 위치: `plan/in-progress/self-hosting-deployment.md:57-62`
  - 상세: 1라운드에서 지적된 "무관한 아바타 정책 세부 기술 노트 혼입"이 `c8a1a59b6`에서 체크박스 한 줄
    + `scripts/minio/README.md` 포인터 + 백로그 트래커 참조로 축소된 것을 실제 파일에서 확인했다.
  - 제안: 없음.

## 요약

핵심 문서화 표면(README 카탈로그·CHANGELOG·plan 설계/뮤턴트 표·workflow pathspec 주석·모듈 docstring)은
1라운드에서 이미 검증된 대로 서로 line-level 로 일치하고, 1라운드 Warning 3건의 조치도 실제로 반영되어
있다. 다만 그 조치 과정에서 테스트가 7개→9개로 늘었는데 plan 체크리스트의 "7개/7 passed" 실측 문구가
갱신되지 않아 지금은 사실과 다르다(WARNING). 또한 README의 PyYAML 예외 단락이 나열하는 파일 이름
목록이 이 PR이 추가한 `test_minio_image_parity.py`를 포함해 총 6개 파일 분량 뒤처져 있으나, 이는 이번
PR 이전부터 있던 drift이고 이번 diff가 그 단락 자체를 건드리지도 않았다(INFO, 비차단).

## 위험도

LOW
