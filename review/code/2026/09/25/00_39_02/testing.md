# 테스트(Testing) 리뷰 — MinIO 이미지 일치 가드

## 검토 범위

`.claude/tests/test_minio_image_parity.py`(신규, 206줄)와 그 트리거 표면
(`.github/workflows/harness-checks.yml` pathspec 3줄, `.claude/tests/README.md`
카탈로그 행, `CHANGELOG.md`, plan 3건). 실제 저장소 파일(`.claude/tests/test_minio_image_parity.py`)을
직접 열어 diff 게이트 번호와 실제 줄 번호가 일치함을 `cat -n` 으로 확인했다. `python3 -m pytest
.claude/tests/test_minio_image_parity.py -q` — 9 passed, 12 subtests passed(회귀 없음).

뮤테이션 검증은 저장소 밖 scratch 디렉터리(`mktemp` 상당, `/private/tmp/claude-501/...`)에
원본을 `cp` 해 두고 그 사본만 편집했다. 저장소 트리는 건드리지 않았고, 작업 종료 후
`git status --short` 로 확인했다(아래 "관측한 이상 상태" 참고).

## 발견사항

- **[WARNING]** `k8s_images` 의 컨테이너 매칭 `len(images) != 1` 분기 중 **"같은 이름의 컨테이너가
  같은 파드 안에 2개 이상"**(중복) 쪽이 어떤 boundary test 로도 검증되지 않는다. 이번 라운드에서
  이미 고쳐진 Warning 1(리소스 레벨 `len(matches) != 1` 의 "found 2" 분기)과 **정확히 같은 클래스의
  결함이 한 단계 더 안쪽 for-loop 에 그대로 남아 있다.**
  - 위치: `.claude/tests/test_minio_image_parity.py:112-113` (`k8s_images` 함수, `if len(images) != 1 or
    not isinstance(images[0], str) or not images[0]:` 분기와 그 에러 메시지)
  - 상세: 뮤턴트로 실측했다 — scratch 사본에서 `len(images) != 1` → `len(images) < 1` 로 바꾸고, 기존
    boundary test `test_k8s_missing_container_is_named` (컨테이너 0개 매칭)를 그대로 재현하면 여전히
    `PlaceNotFound` 를 내며 **통과한다**(0 < 1 도 참이므로). 반면 같은 파드 안에 이름이 같은 컨테이너가
    2개 있는 입력(내가 직접 구성)을 원본에 넣으면 `PlaceNotFound` 로 정상 실패하지만, 뮤턴트에 넣으면
    **예외 없이 두 이미지 중 하나를 조용히 골라 통과시킨다** — 관측:
    ```
    ORIGINAL: PlaceNotFound -> k.yaml: StatefulSet/minio container 'minio' image not found
    MUTANT:   NO EXCEPTION, returned: {'k.yaml StatefulSet/minio:minio': 'a:1@sha256:00...'}
    ```
    즉 이 분기를 지키는 테스트가 스위트 안에 전혀 없다 — `!= 1` 이 `< 1` 로 약해져도 9개 테스트가 모두
    그린으로 남는다. 이 모듈의 모듈 docstring 과 `k8s_images` docstring 은 "zero AND duplicates both
    fail by naming the place" 라고 **명시적으로 약속**하고 있어(`k8s_images` 함수 docstring, 95-96번
    줄), 이 약속의 절반(0개 쪽)만 테스트로 고정돼 있고 나머지 절반(중복 쪽)은 무방비다.
  - 부수 관찰(같은 자리): 위 실측에서 보듯 원본 코드 자체도 중복 매칭 시 에러 메시지가
    `"container 'minio' image not found"` 로 나온다 — 이미지가 **없어서**가 아니라 **둘 이상 찾아서**
    실패하는데도 메시지가 "not found" 라고 말해 디버깅 시 오도할 수 있다(기능은 정확히 막지만 원인
    설명이 부정확).
  - 제안: `ExtractorBoundaryTest` 에 `test_k8s_duplicate_container_is_named` 류의 케이스(같은 컨테이너
    이름이 한 파드 안에 두 번 나오는 입력)를 추가해 이 분기를 `assertRaisesRegex` 로 고정한다. 메시지도
    분기를 나눠 "found 0" / "found N" 을 구분하면(Warning 1 이 고친 리소스 레벨 메시지 `expected one
    X/Y, found N` 과 통일된 형태), 실패 원인이 더 정확해진다.

- **[INFO]** `compose_images` 의 `if not isinstance(image, str) or not image:` 분기 중 "값이 빈 문자열"
  (`image: ""`) 케이스는 boundary test 가 없다 — 다만 `not isinstance(image, str)` 쪽(malformed shape)은
  `test_compose_malformed_service_is_named_not_attribute_error` 로 이미 고정돼 있고, 빈 문자열은 실무에서
  나타나기 어려운 형태라 우선순위는 낮다.
  - 위치: `.claude/tests/test_minio_image_parity.py:87-89`
  - 제안: 시간 여유가 있을 때만 — 필수 아님.

- **[INFO]** 확인 결과 문제 없음 — 테스트 설계·용이성이 전반적으로 우수하다. 세 추출기(`compose_images`,
  `k8s_images`, `_PINNED`)가 모두 **순수 함수 + 텍스트 주입**으로 설계돼 있어 실제 파일을 건드리지
  않고도 `ExtractorBoundaryTest` 에서 오류 모양을 촘촘히 고정할 수 있다(Mock/stub 자체가 필요 없는
  구조). `MinioImageParityTest.setUp` 이 매 테스트마다 `all_images()` 를 새로 호출해 테스트 간 상태
  공유가 없고(격리), `subTest` 로 자리별 실패를 모두 보여주는 방식(`test_each_is_pinned_by_tag_and_digest`,
  `test_no_distroless_variant`)도 plan 문서의 M2 실측(여섯 자리 서브테스트 모두 RED)과 일치한다. 다만
  `MinioImageParityTest` 의 4개 테스트 메서드는 모두 `setUp` 에서 계산한 `self.images` 에 의존하므로,
  자리 하나가 통째로 빠지면(`PlaceNotFound`) 4개 테스트가 **개별 assertion 실패가 아니라 setUp 에러로
  동시에 죽는다** — plan §B M3 항목이 이미 이 사실을 실측·서술해 두었으므로 새 지적은 아니다.
  - 위치: `.claude/tests/test_minio_image_parity.py:174-201` (`MinioImageParityTest`)
  - 제안: 없음(기록 목적).

## 관측한 이상 상태 (뮤테이션 검증과 무관)

작업 중 `git status --short` 를 두 번 실행했다. 첫 실행에서 `?? plan/in-progress/spec-draft-__snapshot_selftest__.md`
가 나타났으나 즉시 `ls` 로 확인하니 파일이 이미 사라져 있었고, 재실행한 `git status --short` 에도
나타나지 않았다 — 나(이 세션)는 이 파일을 만들지도 지우지도 않았다. 이름 형태(`__snapshot_selftest__`)로
보아 동시에 도는 다른 프로세스(자체 self-test 스냅샷)가 생성 후 즉시 정리한 것으로 보이며, 내 작업의
잔여물이 아니다. 조용히 넘어가지 말라는 규약에 따라 관측 사실만 기록한다 — 재조사 불필요해 보이지만
다음 사람이 같은 것을 보면 참고할 수 있도록 남긴다.

## 요약

신규 하네스 테스트는 순수 함수 기반 추출기 + 텍스트 주입 boundary test + `subTest` 기반 자리별 assertion
으로 설계돼 있어 테스트 용이성·격리·가독성이 이 저장소의 기존 관례를 잘 따르고, 회귀(9 passed, 12
subtests)도 확인했다. 다만 라운드 1에서 고쳐진 "리소스 중복" 분기(`len(matches) != 1`)와 **완전히
같은 형태의 미검증 분기가 한 단계 안쪽인 "컨테이너 중복"(`len(images) != 1`)에 그대로 남아 있음을
뮤테이션으로 실측했다** — `!= 1` → `< 1` 로 약화해도 스위트 전체가 그린으로 남는다. 이 외에는 차단할
결함이 없다.

## 위험도

LOW
