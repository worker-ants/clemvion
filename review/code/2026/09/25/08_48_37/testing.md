# 테스트(Testing) 리뷰 — k8s 아바타 정책 드리프트 가드

## 발견사항

- **[WARNING]** `scripts/minio/README.md` 가 신규 문단에서 자신이 `harness-checks.yml` pathspec 에 등재돼
  "README 만 고친 PR 에서도 가드가 돈다" 고 주장하지만, 실측 결과 **등재돼 있지 않다**.
  - 위치: `scripts/minio/README.md:17` (`"이 파일은 그 가드의 CI 트리거에 등재돼 있어 이 파일만 고친
    PR 에서도 돈다."`)
  - 상세: `.github/workflows/harness-checks.yml` 의 `changes` 잡 `pathspecs:` 블록을 grep 하면
    `k8s/overlays/local/infra-minio.yaml` 과 `scripts/minio/avatars-public-read.json` 두 개만 등재돼
    있고, `scripts/minio/README.md` 나 `scripts/minio/**` 같은 상위 glob 은 없다(확인:
    `grep -n "^\s*scripts/" .github/workflows/harness-checks.yml`). 게다가 `test_minio_bucket_policy_parity.py`
    는 애초에 README.md 를 읽지도 않으므로(모듈 상수는 `K8S_MINIO`·`POLICY` 뿐), 설령 트리거되더라도
    이 가드는 README 본문의 정확성을 검증하지 않는다 — 문장이 두 축 모두에서 실제 구현보다 넓게
    말하고 있다. 이 저장소가 `test_harness_checks_paths_coverage.py` 로 여섯 번 반복해 막아온
    "등재 안 된 가드는 안 도는데 다들 돈다고 믿는다" 클래스와 정확히 같은 실패 형태이며, 이번엔
    코드가 아니라 산문 주장이라 그 커버리지 가드(모듈 레벨 경로 상수만 검사)로는 잡히지 않는다.
  - 제안: 문장을 삭제/완화하거나(예: "이 파일이 설명하는 두 원본(JSON·k8s YAML)이 바뀌면 그 가드가
    돈다"), 실제로 README.md 를 pathspec 에 등재하고 그 가드가 README 본문의 어떤 주장을 검증하는지
    명시할 것.

- **[WARNING]** heredoc 이 쓰는 임시 파일 경로(`cat > /tmp/avatars-public-read.json <<EOF` 의 대상)와
  그것을 적용하는 `mc anonymous set-json` 의 소스 인자가 **같은 문자열이어야 한다는 것을 어떤 테스트도
  단언하지 않는다** — 실제로 뮤테이션 프로브로 확인했다.
  - 위치: `.claude/tests/test_minio_bucket_policy_parity.py` — `test_policy_is_applied_to_the_created_bucket`
    (버킷 변수 일치는 검증하지만 파일 경로 쌍은 검증하지 않음), `heredoc_policy()` (경로와 무관하게
    `<<EOF...EOF` 블록만 추출)
  - 상세: `mc anonymous set-json \S+ local/"\$S3_BUCKET"` 정규식의 `\S+` 는 소스 파일 경로로 **아무 토큰**이나
    허용한다. `k8s/overlays/local/infra-minio.yaml` 의 두 번째 인자(`/tmp/avatars-public-read.json`)를
    임의의 다른 경로(`/tmp/WRONG-PATH.json`)로 바꾼 스크립트를 만들어 기존 12개 테스트가 기대하는
    모든 단언(`heredoc==canonical`, `mb_ok`, `setjson_ok`)을 재현했더니 **전부 통과**했다 — 즉 `cat >` 대상과
    `set-json` 소스가 서로 다른 파일을 가리켜도 이 가드는 감지하지 못한다. 이 저장소가 이미 "버킷 이름을
    두 곳에서 각각 이름 짓는다" (shape 1, `mc mb` ↔ `set-json` 의 `$S3_BUCKET`)는 정확히 이 같은 클래스로
    보고 별도 단언을 뒀는데, 파일 경로라는 같은 클래스의 다른 인스턴스는 빠졌다. 이 결함이 실제로
    나면 `mc anonymous set-json` 이 존재하지 않는 파일을 읽으려다 실패해 Job 이 exit 1 로 죽으므로
    "조용한" 실패는 아니지만(배포 시점엔 시끄럽게 드러남), 이 가드의 존재 이유가 "리뷰 시점으로
    당긴다"는 것이므로 리뷰 시점에서도 못 잡는 이 갭은 그 목적을 벗어난다.
  - 검증: (저장소 파일은 건드리지 않고, `.claude/tests` 를 `sys.path` 에 넣어 헬퍼만 임포트해 저장소
    밖 scratch 스크립트에서 조작한 문자열로 재현. 원복 불필요 — 저장소에 쓰기 없음.)
  - 제안: `heredoc_policy` 가 `cat > <path> <<EOF` 의 `<path>` 도 함께 반환하게 하거나, 별도 정규식으로
    두 인자의 경로 문자열이 동일함을 단언하는 테스트를 추가한다(`test_policy_is_applied_to_the_created_bucket`
    옆에 8번째 regression shape로).

- **[INFO]** `_HEREDOC` 정규식(`<<-?[ \t]*(?P<q>['\"]?)EOF(?P=q)\n(?P<body>.*?)\nEOF\n`)은 닫는 `EOF` 바로
  뒤에 개행이 하나 더 필요하다 — 즉 heredoc 이 스크립트의 **마지막 줄**이 되면(뒤에 다른 명령이 없으면)
  매치가 실패한다. 지금은 heredoc 뒤에 `mc anonymous set-json ...` 줄이 항상 있어 문제없지만, 이 가정은
  코드에 문서화돼 있지 않고 테스트도 커버하지 않는다. 다만 실패 모드가 `PlaceNotFound`(0건)로 loud 하게
  터지므로 우선순위는 낮다.
  - 위치: `.claude/tests/test_minio_bucket_policy_parity.py:62` (`_HEREDOC` 정의)
  - 제안: 필요시 docstring 한 줄로 "heredoc 뒤에 최소 한 줄이 더 있어야 한다"는 가정을 명시하거나,
    lookahead 로 완화.

- **[INFO]** `granted_actions()` 는 policy statement 의 `Action` 키만 보고 `NotAction` 은 보지 않는다.
  이론상 `NotAction: ["s3:GetObject"]` 형태의 statement 는 `s3:ListBucket` 을 포함해 `GetObject` 를 제외한
  모든 액션을 암묵적으로 허용하지만 `granted_actions` 의 리스트엔 `s3:ListBucket` 문자열이 전혀 나타나지
  않아 `test_no_list_bucket_anywhere` 를 우회한다. 이 정책 파일은 수작업으로 짧게 유지되는 두 곳뿐이라
  실현 가능성은 낮고, 지금 가드가 막으려는 회귀 형태(직접 `Action` 나열 중 ListBucket 추가/`set download`
  프리셋)에는 해당하지 않으므로 낮은 우선순위.
  - 위치: `.claude/tests/test_minio_bucket_policy_parity.py:94-100` (`granted_actions`)

## 확인한 항목 (문제 없음)

- 신규 파일의 12개 테스트를 그대로 실행해 통과를 확인했다(`python3 -m pytest .claude/tests/test_minio_bucket_policy_parity.py -v` → `12 passed`), plan 의 "새 테스트 12개 이름으로 실행 확인" 주장과 일치한다.
- `.github/workflows/harness-checks.yml` pathspec 에 `k8s/overlays/local/infra-minio.yaml` 과
  `scripts/minio/avatars-public-read.json` 둘 다 개별 등재돼 있어, 정책 JSON 파일이나 k8s 매니페스트
  단독 수정 PR 에서도 가드가 돈다는 plan/README 의 다른 주장은 사실과 일치한다(README 자체 등재
  주장만 예외 — 위 WARNING).
- `test_minio_image_parity.py` 의 `_dig`/`_seq`/`_expect_one`/`PlaceNotFound` 를 복제하지 않고 임포트한
  설계는 docstring 이 밝히듯 4라운드 리뷰로 다져진 의도적 DRY 이며, TestCase 는 임포트하지 않아
  pytest 이중 수집도 피한다 — 적절하다.
  `test_minio_image_parity.py`·`test_harness_checks_paths_coverage.py` 를 함께 돌려도 58 passed(69
  subtests)로 회귀 없음을 확인했다.
  `job_script`/`heredoc_policy`/`granted_actions` 는 전부 순수 함수(입력을 매개변수로 받음)라 실제
  파일 I/O 는 `BucketPolicyParityTest.setUp()` 한 곳에만 있고, 나머지 경계 테스트(`ExtractorBoundaryTest`)는
  주입된 텍스트만으로 격리돼 돈다 — 테스트 용이성·격리 모두 양호.
  `granted_actions` 가 bare-string `Action` 을 문자 단위로 쪼개는 회귀를 `test_granted_actions_counts_a_bare_string`
  로 직접 가드해 두어, `assertNotIn("s3:ListBucket", ...)` 가 무심코 항상 통과하는(문자열을 문자로 쪼개
  부분열 매치가 성립 안 하는) 공허 통과 형태를 막는다 — 설계 의도가 분명하다.
  `test_heredoc_equals_canonical_policy` 가 비교 전 canonical 파일의 ARN 버킷이 정확히 1개인지 먼저
  단언해, "정규화 기준 자체가 모호하면 조용히 잘못 비교"하는 경로를 차단한다.
  `_expect_one` 을 0건과 2건(중복) 양쪽에 통일 적용해 Job/컨테이너/인자/heredoc 넷 모두에서 "정확히 하나"
  경계를 이름 있는 실패로 테스트하는 패턴은 가독성·엣지 케이스 커버리지 모두 우수하다.
  Mock/stub 은 쓰이지 않으며, 이는 golden-file/drift 가드의 성격상 적절한 선택이다(실제 저장소 파일을
  그대로 읽어야 드리프트를 잡는다).

## 요약

새 가드 `test_minio_bucket_policy_parity.py` 자체는 명명된 실패, "정확히 하나" 경계, 순수 함수 설계,
sibling 헬퍼 재사용 등 이 저장소의 성숙한 테스트 관례를 잘 따르고 있고 12개 테스트가 실측대로 통과한다.
다만 이번 검토에서 두 가지 실측 기반 갭을 찾았다: (1) `scripts/minio/README.md` 가 스스로 CI 트리거에
등재돼 있다고 적었지만 `harness-checks.yml` pathspec 에는 없다 — 이 저장소가 반복적으로 겪어온 "가드가
있다고 믿지만 실제로는 안 도는" 클래스와 같은 형태이며 이번엔 코드가 아닌 문서 주장이라 기존
`test_harness_checks_paths_coverage.py` 로도 못 잡는다. (2) heredoc 의 임시 파일 경로(`cat >` 대상)와
`set-json` 소스 인자가 같은 문자열이어야 한다는 것을 어떤 테스트도 확인하지 않는다는 것을 문자열
치환 프로브로 실증했다 — 배포 시점엔 loud 하게 실패하지만 이 가드의 존재 이유(리뷰 시점 포착)를
벗어난다. 둘 다 CRITICAL 급 결함은 아니지만 이 PR 이 스스로 표방하는 "정확한 문서·완전한 커버리지"
기준에는 못 미친다.

## 위험도

MEDIUM
