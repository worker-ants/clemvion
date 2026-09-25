# 테스트(Testing) 리뷰 — k8s-avatar-policy (3라운드)

## 검증 방법

- `.claude/tests/test_minio_bucket_policy_parity.py` 단독 및 `test_minio_image_parity.py` 와 함께 실제 실행:
  `python3 -m pytest .claude/tests/test_minio_bucket_policy_parity.py .claude/tests/test_minio_image_parity.py -q`
  → `33 passed, 62 subtests passed`.
- 하네스 전체: `python3 -m pytest .claude/tests -q` → `1173 passed, 1323 subtests passed`(회귀 없음).
- `.github/workflows/harness-checks.yml` pathspec 에 `k8s/overlays/local/infra-minio.yaml` ·
  `scripts/minio/avatars-public-read.json` 둘 다 개별 등재 확인. `scripts/minio/README.md` 본문도
  이제 "이 README 는 등재 대상이 아니다" 로 스스로 정정돼 있어(2라운드 WARNING1 반영, `fd3810242`),
  가드 트리거 범위에 대한 문서 주장과 실제 pathspec 이 일치한다.
- 2라운드 WARNING2(heredoc 이 쓰는 파일 경로와 `set-json` 이 읽는 경로가 같은지 미검증)는
  `heredoc_policy()` 가 이제 `written_path` 를 반환하고 `test_set_json_reads_the_file_the_heredoc_wrote`
  가 이를 단언하는 것으로 반영돼 있음을 코드로 확인.
- 저장소 밖 scratch 디렉터리(`mktemp` 대신 세션 scratchpad)에 프로브 스크립트를 두고 `job_script()` 를
  직접 임포트해 실행 — **저장소 파일은 쓰지 않았다** (`git status --short` 로 변경 없음 확인, 아래
  발견사항의 근거).

## 발견사항

- **[INFO]** `job_script()` 자신의 `_dig`/`_seq` 배선(metadata→spec→template→spec 체인)이 형제 가드
  수준의 "말라 뭉개진 구조는 이름 붙은 실패로" 경계 테스트를 갖고 있지 않다 — 실제로 배선을 무너뜨려
  재현했다
  - 위치: `.claude/tests/test_minio_bucket_policy_parity.py` `job_script()` (72~90번째 줄, 특히
    `pod = _dig(job, "spec", "template", "spec")` 78~86번째 줄) / 대응 테스트
    `test_job_script_failures_are_named_by_reason` (128~149번째 줄)
  - 상세: 현재 `job_script()` 는 `_dig`/`_seq` 를 통해 `metadata`·`spec`·`containers` 를 안전하게 훑고
    있어 실측상 문제는 없다(직접 확인: `metadata: [minio-create-bucket]` 처럼 리스트인 매니페스트,
    `spec: [x]` 처럼 스칼라/리스트인 매니페스트, `containers` 가 매핑·스칼라인 매니페스트를 넣어도
    전부 이름 있는 `PlaceNotFound` 로 실패했다). 다만 이 **배선 자체를 고정하는 테스트가 이 파일에는
    없다** — `test_job_script_failures_are_named_by_reason` 의 9개 subTest("no Job"·"two Jobs"·
    "no mc container"·"two mc containers"·"no args"·"args not a list"·"two args"·"non-string arg"·
    "empty arg")는 모두 **형태가 올바른 dict/list 구조에서 이름/개수만 어긋나는** 경우이고, 형제 가드
    `test_minio_image_parity.py::HelperBoundaryTest.test_k8s_malformed_shapes_are_named_not_attribute_error`
    가 담당하는 "metadata 가 list·spec 이 list·containers 가 mapping·containers 가 스칼라" 류의 **구조
    오작동** 케이스는 이 파일에 대응 테스트가 없다.
    실제로 `_dig` 대신 순진한 `.get("spec", {}).get("template", {}).get("spec", {})` 체인으로 배선을
    바꾼 뮤턴트를 저장소 밖에서 만들어 같은 두 입력("metadata is a list", "spec is a list")에
    돌렸더니 현재 테스트가 전제하는 `PlaceNotFound` 대신 **`AttributeError: 'list' object has no
    attribute 'get'`** 이 그대로 터졌다 — 이 파일의 어떤 테스트도 이 배선 회귀를 구분해 잡지 못한다는
    뜻이다. 이 저장소의 docstring 이 스스로 "네 번의 리뷰 라운드가 같은 모양을 한 자리씩 더 찾아냈다"
    고 적은 바로 그 클래스이고, 형제 가드는 전용 경계 테스트로 이를 막아 두었는데 이 새 가드는
    아직 그 대칭을 갖추지 않았다.
    다만 실패 모드 자체는 **조용하지 않다** — 실제 매니페스트가 이렇게 망가지면 pytest 가
    `AttributeError` 로 즉시 크래시하며(값이 잘못 통과해 GREEN 이 되는 게 아니라 하네스가 그 자체로
    RED), 2라운드 RESOLUTION 이 INFO 5·6(`<<-EOF` 탭 처리·닫는 EOF 뒤 개행 필요성)을 "형식이 어긋나면
    어차피 `PlaceNotFound`(found 0)로 시끄럽게 실패한다"는 같은 근거로 INFO 로 처분한 전례와 성격이
    같다. 그래서 WARNING 이 아니라 INFO 로 남긴다 — 정확성 결함이 아니라 진단 품질(예외 메시지가
    `PlaceNotFound: ... found 0` 대신 순수 트레이스백이 되는 정도) 문제다.
  - 제안: 우선순위 낮음. 다음에 `job_script()` 를 만질 일이 있으면 형제 가드의
    `test_k8s_malformed_shapes_are_named_not_attribute_error` 를 본떠 "metadata/spec/containers 가
    비-매핑·비-리스트일 때도 이름 있는 `PlaceNotFound` 로 실패한다"는 subTest 1~2개를
    `ExtractorBoundaryTest` 에 추가하면 두 가드의 배선 보증 수준이 대칭을 이룬다. 지금 당장 막을
    필요는 없다 — 실제 매니페스트가 그 모양으로 망가질 경로가 없고, 망가지면 어차피 CI 가 loud 하게
    죽는다.

## 확인한 항목 (문제 없음 — 이전 라운드 대비 회귀 없음)

- 1라운드 WARNING("정확히 하나" 미검증, 첫 매치만 반환)은 `_expect_one` 도입(`1367e14ee`)으로 해소돼
  있고, 지금 `job_script`/`heredoc_policy` 모두 0건·2건 각각 이름 붙여 실패한다
  (`test_job_script_failures_are_named_by_reason`, `test_heredoc_zero_or_two_is_named`).
- 2라운드 WARNING 둘(README 의 pathspec 등재 자기주장 오류, heredoc 쓰기 경로 vs `set-json` 읽기 경로
  미검증)은 위 "검증 방법"에서 확인한 대로 반영돼 있다.
- `granted_actions()` 가 `NotAction` 을 못 본다는 점(2라운드 INFO 7)은 "원본과의 동일성 단언이 heredoc·
  canonical 양쪽에 동일하게 추가되지 않는 한 divergence 를 잡는다"는 근거로 이미 처분됐고, 재검토해도
  같은 결론이라 다시 올리지 않는다.
- Mock/stub 미사용 — 실제 `k8s/overlays/local/infra-minio.yaml`·`scripts/minio/avatars-public-read.json`
  을 그대로 읽는 parity/drift 가드 성격상 적절하다. `BucketPolicyParityTest.setUp()` 한 곳만 실제
  파일을 읽고, `ExtractorBoundaryTest` 의 순수 함수 테스트는 전부 주입된 텍스트로 격리돼 돈다 — 테스트
  격리·테스트 용이성 모두 양호.
- `test_heredoc_names_the_bucket_through_the_variable` / `test_heredoc_equals_canonical_policy` 가
  ARN 버킷을 정규식으로 뽑아 정규화 전 개수(정확히 1개)까지 확인한 뒤 비교해, "정규화 기준 자체가
  모호한데 조용히 비교"하는 경로를 차단한다.
  `test_granted_actions_counts_a_bare_string` 가 bare-string `Action` 을 문자 단위로 쪼개 `assertNotIn`
  이 무심코 항상 통과하는 공허 통과 형태를 별도로 막아 둔 것도 확인.
- 회귀: 형제 가드 `test_minio_image_parity.py` 는 이번 변경으로 영향받지 않고 그대로 통과, 하네스
  전체 1173 passed 로 사이드이펙트 없음을 확인했다.

## 요약

3라운드 시점의 `test_minio_bucket_policy_parity.py` 는 1·2라운드에서 지적된 "정확히 하나 미검증"·
"heredoc 쓰기 경로와 set-json 읽기 경로 불일치 미검증"·"README 자기주장 오류" 를 모두 실측 가능한
형태로 반영했고(총 17개 뮤턴트 전수 KILLED, 하네스 전체 1173 passed 로 회귀 없음을 직접 재실행해
확인), 순수 함수 설계·주입 텍스트 기반 경계 테스트·형제 가드 헬퍼 재사용 등 이 저장소의 성숙한 테스트
관례를 잘 따른다. 새로 찾은 것은 하나: `job_script()` 자신의 `_dig`/`_seq` 배선이 형제 가드의
"구조가 망가져도 이름 있는 실패" 경계 테스트와 대칭을 이루지 못한다는 점을 뮤턴트로 직접 재현했는데,
실패 모드가 조용하지 않고(즉시 `AttributeError` 로 크래시) 2라운드가 같은 성격의 항목을 이미 INFO 로
처분한 전례가 있어 INFO 로 남긴다. CRITICAL/WARNING 급 결함은 발견하지 못했다 — 이번 라운드에서
정지 규칙(신규 Critical·Warning 없음)을 충족하는 것으로 판단한다.

## 위험도

LOW
