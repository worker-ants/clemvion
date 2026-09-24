# 테스트(Testing) 리뷰 — `.claude/tests/test_minio_image_parity.py` 외

이미 3라운드에 걸쳐 리소스/컨테이너 중복·0개, 빈 문자열/비문자열 image, `latest` 태그, distroless 등
11개 분기를 뮤턴트로 개별 고정한 상태다(`plan/in-progress/minio-image-parity-guard.md` §B-2). 이번
라운드에서는 그 위에서 남은 갭을 실측으로 찾았다.

## 발견사항

- **[WARNING]** `k8s_images` 안 `_mapping()` 개별 call site 중 3곳(`metadata`·`spec`·`template`)이
  실제로는 어느 테스트로도 개별 검증되지 않는다 — 실측으로 `AttributeError` 크래시를 재현했다.
  - 위치: `.claude/tests/test_minio_image_parity.py:126` (`_mapping(d.get("metadata"))`), `:130`
    (`_mapping(_mapping(matches[0].get("spec")).get("template"))`), `:131`
    (`_mapping(pod_template.get("spec"))`) — 이 세 call site 를 감싸는 `_mapping` 함수 정의·의도는
    `:99-103`
  - 상세: `_mapping()` 의 docstring 은 "malformed shape … surfaces as `PlaceNotFound` naming the
    place, not as a bare `AttributeError`" 를 명시적으로 약속한다. 그런데 이 약속을 개별 call site
    단위로 고정한 테스트는 컨테이너 목록(`containers`)의 0개/중복/빈 값/비문자열 경우뿐이고,
    `metadata`·`spec`·`template` 필드 자체가 매핑이 아닌 경우(예: YAML 저작 오타로 리스트가 들어간
    경우)는 어떤 fixture 도 만들지 않는다. B9 뮤턴트("`_mapping` → 항등")는 **전역** 치환이라 compose
    쪽 테스트(`test_compose_malformed_service_is_named_not_attribute_error` 등)가 먼저 죽어 "킬"로
    집계됐을 뿐, k8s 쪽 개별 call site 가 실제로 `_mapping` 을 거치는지는 별도로 증명되지 않는다.
    아래처럼 `metadata` 가 truthy 한 비-매핑 값(리스트)일 때만 드러나는 국소 변형으로 재현했다
    (`.get("metadata")` 를 `_mapping()` 대신 `... or {}` 로 국소 치환 — falsy 값은 여전히 걸러지지만
    truthy 비-매핑 값은 그대로 통과):
    ```
    metadata: [foo]   # StatefulSet 문서
    ```
    이 국소 뮤턴트에서 원본 코드는 `PlaceNotFound: k.yaml: expected one StatefulSet/minio, found 0`
    로 이름을 대며 우아하게 실패했지만(설계대로), 같은 자리를 국소적으로 다르게 깨면(예: 미래에 누군가
    `_mapping()` wrap 을 실수로 빼먹는 리팩터) 현재 스위트의 어떤 테스트도 실패하지 않은 채 원시
    `AttributeError: 'list' object has no attribute 'get'` 로 이어진다 — 재현 확인함(저장소 밖 scratch
    사본에서 국소 치환 후 실행, 원본 파일은 미변경, `git status --short` 확인 완료).
  - 제안: `ExtractorBoundaryTest` 에 k8s 쪽 "매핑이 아닌 필드" 경계 테스트를 추가한다. 예:
    `metadata: [x]` (또는 `spec`/`template` 이 리스트)인 StatefulSet 문서를 넣고
    `assertRaisesRegex(PlaceNotFound, r"expected one StatefulSet/minio, found 0")` 로 각 call site 가
    실제로 `_mapping` 을 거쳐 우아하게 실패하는지 개별 고정. compose 쪽에도 대칭으로 top-level 문서
    자체가 매핑이 아닌 경우(`- a\n- b\n`)가 있는데, 이건 실측 결과 현재도 우연히 graceful 하게
    실패하지만(다른 이유로) 마찬가지로 전용 fixture 는 없다.

- **[INFO]** `_PINNED` 정규식의 "lowercase hex only" 불변식이 주석으로만 존재하고 회귀 테스트가 없다.
  - 위치: `.claude/tests/test_minio_image_parity.py:74` 정규식 정의 근처 주석("Lowercase hex only: the
    OCI image spec defines the sha256 encoded portion as `[a-f0-9]{64}`"), 경계 테스트는 `:239-257`
    (`test_pin_violation_edges`)
  - 상세: 실측 결과 대문자 hex 다이제스트(`@sha256:AAAA…`)는 현재도 정확히 거부된다
    (`not name:tag@sha256:<64 hex>`) — 코드는 맞다. 다만 그 동작을 검증하는 `bad` 케이스가 없어서,
    누군가 정규식을 `[A-Fa-f0-9]` 로 "관대하게" 고쳐도 이 스위트는 초록으로 남는다. 주석이 명시적으로
    선언한 불변식인 만큼 `bad` 튜플에 한 줄 추가할 가치가 있다.
  - 제안: `test_pin_violation_edges` 의 `bad` 목록에
    `("pgsty/silo:RELEASE.2026-09-16T00-00-00Z@sha256:" + "A" * 64, "not name:tag")` 케이스 추가.

- **[INFO]** `plan/in-progress/minio-image-parity-guard.md` 체크리스트의 "15 passed · 20 subtests"
  기재가 이미 커밋된 3라운드 수정 뒤 기준으로는 낡았다(측정값 갱신 누락).
  - 위치: `plan/in-progress/minio-image-parity-guard.md` 체크리스트 항목("테스트 작성 + …") — "**15개**
    … `pytest -q` 15 passed · 20 subtests" 부분
  - 상세: 실측(`python3 -m pytest .claude/tests/test_minio_image_parity.py -q`) 결과는 현재
    `15 passed, 25 subtests passed` 다. `git show 69a5e22b9:.claude/tests/test_minio_image_parity.py`
    로 대조하면 "20 subtests" 는 커밋 `69a5e22b9`(2라운드 조치 직후) 시점 값과 정확히 일치한다 — 즉
    체크리스트 문구는 그 시점에는 맞았지만, 바로 다음 커밋 `9d734571e`(3라운드 W1, `test_pin_violation_edges`
    에 good/bad 케이스 5개 추가)로 실제 subtest 수가 25로 늘어난 뒤 갱신되지 않았다. 코드/테스트 자체엔
    문제 없음 — plan 문서의 "측정했다" 서술이 후속 커밋으로 stale 해진 사례.
  - 제안: 체크리스트 문구를 `15 passed · 25 subtests` 로 갱신(또는 "python3 -m pytest .claude/tests -q
    전체" 미체크 항목 완료 시 한 번에 갱신).

## 요약

핵심 파리티/고정/distroless 로직은 이미 3라운드 리뷰에서 11개 분기 전수를 뮤턴트로 개별 고정했고, 이번
실측으로도 전체 하네스(1155 tests / 1285 subtests)가 회귀 없이 통과한다. 이번 라운드에서 남은 실질 갭은
`_mapping()` 이 지키기로 약속한 "malformed shape → `PlaceNotFound`, bare `AttributeError` 아님" 이라는
설계 근거가 k8s 문서의 `metadata`/`spec`/`template` 개별 call site 단위로는 실제로 뮤턴트-고정되지
않았다는 점이며, 이는 국소 치환으로 실측 재현했다(전역 B9 뮤턴트가 compose 쪽 테스트로 먼저 죽어 k8s
개별 call site 를 가려 왔다). 나머지 두 건(대문자 hex 미검증, plan 체크리스트의 subtest 수 stale)은 낮은
위험도의 보완 사항이다. 저장소 트리는 리뷰 종료 시점에 `git status --short` 로 깨끗함을 확인했다
(사전 존재하던 `review/code/2026/09/25/01_13_48/` 미추적 디렉터리만 있음, 리뷰가 만든 변경 없음).

## 위험도

LOW
