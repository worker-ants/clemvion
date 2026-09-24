# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** 체크리스트에 적힌 서브테스트 수(20)가 실측(25)과 다르다 — 낡은 수치가 또 등재됐다
  - 위치: `plan/in-progress/minio-image-parity-guard.md:110`
  - 상세: 체크리스트 항목이 "`pytest -q` 15 passed · 20 subtests"라고 적고, 바로 이어서 "2라운드 `/ai-review`
    documentation W2 가 7 이 낡았다고 짚었다"고 스스로 언급한다 — 즉 이 문서는 이미 한 번 테스트-개수 서술이
    낡아 지적받은 이력이 있다. 그런데 이번에 실제로 `python3 -m pytest .claude/tests/test_minio_image_parity.py -q`
    를 돌려 보면 `15 passed, 25 subtests passed`(재현 확인: 본 리뷰에서 2회 재실행, 동일)가 나온다. `15 passed`
    는 맞지만 `20 subtests`는 실측보다 5개 적다. `test_bad_image_value_is_named`(6개: value 2 × where 2 = 4가
    아니라 `for value in ("''", "5")` × `subTest(where=...)` 2 곳 = 4개)와 `test_pin_violation_edges`(good 2 +
    bad 7 = 9개)를 포함해 세면 25가 맞다.
  - 제안: `20 subtests`를 `25 subtests`로 정정한다. 프로젝트 메모리에 이미 "CHANGELOG/카운트 서술은 쓰는
    시점에 재측정해야 한다"는 교훈이 여러 차례 쌓여 있는데(§워크플로 교훈 "실측했다가 여덟 번 틀렸다" 등),
    이 plan 문서 자체가 "지난 라운드가 낡은 카운트를 잡았다"고 적은 바로 그 문장 옆에서 다시 낡은 카운트를
    남긴 것이므로 다음 라운드가 또 같은 지적을 반복하지 않도록 지금 고치는 편이 낫다.

## 확인 완료 (이상 없음)

- `CHANGELOG.md` — "Unreleased — 오브젝트 스토리지 이미지 6곳이 서로 같은지 아무것도 보지 않던 것" 항목이
  신설 가드의 목적·네 단언·11개 분기·pathspec 등재 이유를 정확히 서술하며 코드와 불일치 없음.
- `.claude/tests/README.md:48` — 카탈로그 행이 기존 표 형식을 따르고, 여섯 자리·YAML 파서·`PlaceNotFound`
  네이밍·11개 분기·pathspec 트리거·낡은 `.pyc` 함정까지 코드/plan 서술과 일치.
- `.github/workflows/harness-checks.yml:92-98` — `docker-compose.yml` · `docker-compose.e2e.yml` ·
  `k8s/overlays/local/infra-minio.yaml` 세 개별 pathspec 이 실제로 등재되어 있고, 주석이 "이미지를 올리는
  PR 은 보통 이 세 파일만 고친다"는 근거를 정확히 댐.
- `_PINNED` 정규식 주석(`test_minio_image_parity.py:67-73`)의 "레지스트리 포트 뒤 `latest`" 처리 주장을
  `registry.example:5000/pgsty/silo:latest@sha256:<64 hex>` 로 실측 — `tag` 그룹이 정확히 `latest` 로
  캡처됨을 확인, 주석과 일치.
- `test_harness_checks_paths_coverage.py:111` `PRODUCT_PREFIXES = ("codebase/", "spec/", "plan/", "review/")`
  — plan 문서의 "k8s 는 `PRODUCT_PREFIXES` 밖" 이라는 괄호 서술과 일치.
- `plan/in-progress/minio-image-parity-guard.md` §D W3 의 "아바타 공개 정책 항목을 트래커로 옮겼다"는
  주장을 `plan/in-progress/spec-draft-nullable-notation-followups.md:5840` 에서 실제로 확인 — 상호 참조가
  실재하고 내용도 부합.
- `plan/in-progress/self-hosting-deployment.md` §3/§4 에 "새 매니페스트가 오브젝트 스토리지 이미지를 쓰면
  가드 자리 목록·pathspec 에 추가"하라는 체크박스가 실제로 추가되어 있음(§3 line 57-60, §4 line 71-72) —
  가드 docstring 의 "Scope is the places that exist TODAY" 서술과 방향이 일치.
- 테스트 모듈 docstring(`test_minio_image_parity.py:1-46`)의 네 단언 서술은 실제 클래스 `MinioImageParityTest`
  의 네 테스트 메서드와 1:1 대응하며, `ExtractorBoundaryTest` 의 각 경계 테스트 docstring/인라인 주석도
  해당 분기와 정확히 대응함(`_mapping`·`k8s_images`·`pin_violation` 독스트링 포함) — 불일치 없음.
- README/CHANGELOG 갱신 필요성: 이번 변경은 하네스 self-test 추가로, 제품 README·API 문서·환경변수 문서
  대상이 아니며 해당 카테고리에 갱신 누락 없음.

## 요약

리뷰 대상 세 파일(신규 하네스 테스트, self-hosting plan, 이번 작업의 plan)은 전반적으로 문서화 품질이
높다 — docstring 이 "왜"를 근거(이슈 번호·리뷰 라운드·실측)와 함께 촘촘히 남기고, CHANGELOG·README
카탈로그·harness-checks.yml 주석까지 코드 동작과 실제로 일치함을 직접 실행/검증했다. 유일하게 발견된
결함은 plan 체크리스트에 남은 서브테스트 개수 서술(`20`)이 실측(`25`)과 어긋난다는 점인데, 바로 그 문장이
"지난 라운드가 낡은 카운트를 지적했다"고 스스로 적고 있어 같은 클래스의 결함이 반복되고 있다는 점에서
가볍게 넘기기보다 이번에 정정하는 편이 다음 리뷰 라운드의 재지적을 막는다.

## 위험도

LOW
