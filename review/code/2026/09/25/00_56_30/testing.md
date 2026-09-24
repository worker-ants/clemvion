# 테스트(Testing) 리뷰 — minio-image-parity-guard

## 검증 절차

- `python3 -m pytest .claude/tests/test_minio_image_parity.py -q` → `15 passed, 20 subtests passed` (plan §C 체크리스트 기재값과 일치)
- `python3 -m pytest .claude/tests/test_harness_checks_paths_coverage.py -q` → `26 passed, 7 subtests passed` (트리거 계약 자체도 그린)
- `python3 -m pytest .claude/tests -q` 전체 → `1155 passed, 1280 subtests passed in 113.44s` — 회귀 없음
- 저장소 파일은 건드리지 않았다(모든 확인은 읽기 전용 실행). `git status --short` 는 리뷰 산출물 디렉터리만 untracked 로 남아 있고 그 외 변경 없음
- 모듈의 조건 분기를 소스에서 전수 재확인 — `_mapping` 1개, `pin_violation` 2개, `is_distroless` 1개, `compose_images` 의 `not isinstance or not image` 2절, `k8s_images` 의 `len(matches)!=1`(과다/과소) · `len(named)!=1`(과다/과소) · `not isinstance or not image` 2절 — plan §B-2 표(B1~B11)와 1:1 대응됨을 확인. 빠진 분기 없음

## 발견사항

- **[WARNING]** `pin_violation()` 의 정규식이 `registry:port/...` 형태에서 `latest` 태그를 조용히 놓친다 (false negative) — 이 형태에 대한 엣지 케이스 테스트가 없다
  - 위치: `.claude/tests/test_minio_image_parity.py:69` (`_PINNED` 정규식), 테스트 갭은 `test_pin_violation_edges` (line 232)
  - 상세: `_PINNED = re.compile(r"^[^:@\s]+:(?P<tag>[^@\s]+)@sha256:[0-9a-f]{64}$")` 의 name 그룹은 `:` 를 제외한 첫 세그먼트만 소비한다. `myregistry.io:5000/pgsty/silo:latest@sha256:<64hex>` 를 넣으면 name="myregistry.io" 에서 매칭이 끝나고, tag 그룹이 `"5000/pgsty/silo:latest"` 전체를 삼켜 `tag == "latest"` 비교가 실패한다. 실측:
    ```
    $ python3 -c "... pin_violation('myregistry.io:5000/pgsty/silo:latest@sha256:'+'a'*64)"
    None   # 위반 없음으로 오판 — latest 를 놓쳤다
    ```
    현재 세 파일이 모두 `pgsty/silo:...` (레지스트리 호스트:포트 접두어 없음)라 오늘 당장 잘못된 판정을 내지는 않지만, 이 함수의 존재 이유가 정확히 "`latest` 로 되돌아가는 것을 막는다"(W-59)인데 레지스트리에 포트가 붙는 형태에서 그 방어가 조용히 무력화된다. `test_pin_violation_edges` 는 "no digest / digest only / short digest / latest" 네 가지 나쁜 형태를 열거하지만 이 형태는 빠져 있다.
  - 제안: `test_pin_violation_edges` 의 `bad` 튜플에 `("myregistry.io:5000/pgsty/silo:latest" + digest, "latest")` 류 케이스를 추가해 현재 동작(오탐 여부)을 캐너리로 고정하고, 발견된 대로 오탐이면 정규식을 `name` 부분이 마지막 `/` 뒤 세그먼트만 매칭하도록 좁히거나(예: `^(?:[^/\s]+/)*[^:@/\s]+:(?P<tag>[^@\s]+)@sha256:...`), 혹은 docstring/plan 에 "레지스트리 호스트:포트 형태는 스코프 밖" 이라고 명시적으로 적어 비목표로 선언한다. 현재는 둘 다 아니어서 독자가 안전하다고 믿을 근거가 없다.

- **[INFO]** `_render()` 헬퍼는 직접 테스트되지 않는다
  - 위치: `.claude/tests/test_minio_image_parity.py:147` (`_render` 함수)
  - 상세: 실패 메시지 조립용이라 정오답에는 영향이 없고, 실패 시 사람이 읽는 텍스트만 좌우한다. 낮은 리스크지만 정렬 로직(`sorted(images.items())`)이 향후 바뀌면 실패 메시지 가독성 회귀를 잡을 테스트가 없다.
  - 제안: 필수는 아님 — 우선순위 낮음.

- **[INFO]** `_PINNED` 다이제스트 길이 상한(65자 이상) · 대문자 hex 케이스가 테스트되지 않음
  - 위치: `.claude/tests/test_minio_image_parity.py:283` (`test_pin_violation_edges`)
  - 상세: `[0-9a-f]{64}$` 는 65번째 문자가 있으면 앵커 `$` 에 의해 전체 매치가 실패해 "not pinned" 으로 안전하게 거부한다(과다 거부 방향이라 보안상 위험 없음). 대문자 hex 도 마찬가지로 거부 방향. 위 WARNING 항목과 달리 실패 방향이 "안전 쪽"이라 시급성은 낮다.
  - 제안: 선택적. 시간이 될 때 `test_pin_violation_edges` 표에 한 줄 추가 정도로 충분.

## 요약

이 변경분(테스트 파일 `test_minio_image_parity.py` + CI pathspec + plan 문서)은 이미 2라운드 리뷰를 거치며 추출기·판정 함수의 조건 분기 11개 전부를 이름 있는 뮤턴트-경계 테스트로 고정했고(B1~B11, 소스 전수 대조로 재확인), 트리거 계약(`test_harness_checks_paths_coverage.py`)도 실측 그린이다. 주입 텍스트로 격리된 `ExtractorBoundaryTest` 는 실제 파일에 의존하지 않아 독립 실행 가능하고, `MinioImageParityTest` 만 의도적으로 실제 세 파일을 읽는 통합성 테스트로 설계되어 있어 가드의 목적에 부합한다. `None` 값이 두 판정 절에 모두 걸려 아무것도 증명 못 한다는 점을 빈 문자열/숫자로 분리해 실측한 것, 그리고 `.pyc` 캐시로 인한 첫 전수 측정 무효를 재실행으로 정정하고 그 사실을 정직하게 문서화한 것도 테스트 방법론상 양호하다. 다만 `pin_violation()` 의 정규식이 `registry:port/...` 형태에서 실제로 `latest` 오탐(false negative)을 낸다는 것을 이번 리뷰에서 실측으로 새로 발견했다 — 오늘의 세 파일에는 그 형태가 없어 당장 위험하지는 않지만, 가드의 존재 이유(W-59: `latest` 회귀 차단)를 정면으로 우회할 수 있는 형태이고 테스트로 캐너리되어 있지 않다는 점에서 WARNING 으로 보고한다. 그 외에는 회귀·격리·가독성 모두 양호하며 전체 스위트(1155 tests) 재실행에서 회귀 없음을 확인했다.

## 위험도

LOW
