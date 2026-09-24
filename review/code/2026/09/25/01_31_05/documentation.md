# 문서화(Documentation) 리뷰 — `test_minio_image_parity.py` / `plan/in-progress/minio-image-parity-guard.md` (5라운드)

## 검증 방법

두 파일의 전체 컨텍스트를 정독하고, 문서가 하는 사실 주장을 실측으로 대조했다.

- `python3 -m pytest .claude/tests/test_minio_image_parity.py -q -rA` 실행 → **`20 passed, 45 subtests passed`**.
  plan 체크리스트(§C, `62eed299f` 7 passed · `647b60ad8` 15 passed · `5f8c1c472` 20 passed · 45 subtests)의
  최종 스냅샷 숫자와 **정확히 일치**.
- `.claude/tests/test_harness_checks_paths_coverage.py` 의 `PRODUCT_PREFIXES = ("codebase/", "spec/", "plan/", "review/")`
  를 읽어 plan 본문의 "k8s 는 `PRODUCT_PREFIXES` 밖" 서술(= k8s 경로도 예외 없이 pathspec 등재 대상)이
  기제와 일치함을 확인.
- `.github/workflows/harness-checks.yml` 에 세 파일(`docker-compose.yml` · `docker-compose.e2e.yml` ·
  `k8s/overlays/local/infra-minio.yaml`)이 개별 pathspec으로 등재되어 있고, 근거 주석이 `#1325`·가드 이름을
  정확히 인용함을 확인.
- `CHANGELOG.md`("Unreleased — 오브젝트 스토리지 이미지 6곳이...")·`.claude/tests/README.md` 카탈로그 항목이
  최신 구조(헬퍼 4개 + 16 뮤턴트 전수 + `.pyc` 함정 주석)를 반영하고 있음을 확인 — plan §B-3/§C 서술과 합치.
- `plan/in-progress/self-hosting-deployment.md` §3/§4 에 "가드 자리 목록·pathspec 에 추가" 체크박스가
  실재함을 확인 — plan D행 W3 처분("반영했다")이 사실과 일치.
- 뮤턴트 표(§B, §B-2, §B-3)의 16개 합계(H1-H7=7, W1-W6=6, P1-P3=3)를 세어 "16개" 총계와 일치함을 확인.

이 다섯 가지 모두 문서가 주장하는 숫자·기제와 실측이 어긋나지 않았다 — 4라운드에 걸쳐 반복 지적됐던
"낡은 숫자" 클래스(2·4라운드 documentation Warning)가 이번 라운드에서는 재발하지 않았다.

## 발견사항

- **[INFO]** `compose_images` · `all_images` · `_render` · `is_distroless` 4개 함수에 함수 단위 docstring이 없다.
  - 위치: `.claude/tests/test_minio_image_parity.py` 함수 `compose_images`(139번째 줄 부근) · `all_images`(168번째 줄 부근) ·
    `_render`(176번째 줄 부근) · `is_distroless`(94번째 줄 부근) — 게이트 숫자는 이 리뷰 프롬프트의
    "전체 파일 컨텍스트" 블록 왼쪽 숫자와 동일.
  - 상세: 같은 파일의 다른 헬퍼(`_dig`·`_seq`·`_expect_one`·`_image_value`·`pin_violation`·`k8s_images`·`PlaceNotFound`)는
    모두 "왜 이렇게 검사하는가"를 설명하는 docstring을 갖고 있어 대칭이 깨진다. 다만 이 지적은 신규가 아니다 —
    3라운드(`review/code/2026/09/25/00_25_55/documentation.md`)와 4라운드 직전(`00_56_30/documentation.md`)에서
    동일 대상으로 이미 INFO로 두 번 올라왔고, 두 번 모두 "모듈 최상단 docstring이 그 역할을 대신해 차단 사유가
    아니다"로 처분됐다. 기능·의미상 실질적 이해에 지장이 없다는 판단도 여전히 유효하다.
  - 제안: 조치 불요(선택 사항 유지). 다음에 이 파일을 다시 손댈 일이 있으면 `all_images`/`compose_images`에
    "여섯 자리를 모으는 진입점" 한 줄을 붙이는 정도로 충분하다.

## 요약

두 파일 모두 4라운드에 걸친 리뷰-fix 사이클을 거쳐 이미 매우 높은 문서화 수준에 도달해 있다. 모듈
docstring은 "왜 이 가드가 존재하는가"(#1325/#1392 부분 반영 이력), "왜 정규식이 아니라 YAML 파서인가",
"각 단언이 막는 회귀 형태가 무엇인가", "왜 트리거 pathspec이 필요한가", "스코프가 무엇을 커버하지 않는가"를
근거(이슈 번호·리뷰 라운드·실측)와 함께 촘촘히 남기고 있고, `_PINNED` 정규식·`pin_violation`·`_dig`/`_seq`/
`_expect_one`/`_image_value` 등 핵심 로직에는 형태·엣지케이스를 정확히 설명하는 인라인 주석/docstring이
붙어 있다. CHANGELOG·README 카탈로그·harness-checks.yml 주석·plan 문서 네 곳의 서술을 상호 대조한 결과
숫자(20 passed·45 subtests, 16 뮤턴트 전수)와 기제(PRODUCT_PREFIXES, self-hosting-deployment.md 체크박스)가
모두 실측과 일치했다. plan 문서 자체도 과거 라운드에서 지적된 "낡은 숫자" 문제를 취소선(`~~7개~~ ~~15개~~`)과
"커밋에 묶은 스냅샷"이라는 서술 방식으로 구조적으로 해결해 재발을 막고 있다. 유일하게 남은 항목(`compose_images`
등 4개 함수의 개별 docstring 부재)은 이미 두 라운드 전 INFO로 확인·처분된 비차단 사항이며 이번 라운드에서도
그 판단을 바꿀 근거가 없다. README/CHANGELOG 업데이트, API 문서(해당 없음 — API 엔드포인트 변경 아님), 설정
문서(신규 환경변수 없음), 예제 코드(테스트 자체가 유일한 사용 방식이라 별도 예제 불요) 어느 관점에서도 추가
조치가 필요한 갭을 찾지 못했다.

## 위험도

NONE
