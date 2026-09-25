# 요구사항(Requirement) 리뷰 — k8s 아바타 버킷 정책 가드

## 발견사항

- **[WARNING]** 모듈 docstring 이 "각 assertion 은 하나의 회귀 형태를 이름 붙인다" 며 회귀 형태를 **7개**로 열거하지만, `BucketPolicyParityTest` 는 실제로 **8개**의 assertion 메서드를 갖는다. 2라운드 리뷰(`fd3810242`)에서 추가된 `test_set_json_reads_the_file_the_heredoc_wrote`(heredoc 이 쓴 경로와 `set-json` 이 읽는 경로가 같은 문자열인지 — "review round 2: mutated, all green before" 라는 자체 주석까지 있는, 실측으로 발견된 별도 회귀 형태)가 docstring 의 번호 목록에 반영되지 않았다.
  - 위치: `.claude/tests/test_minio_bucket_policy_parity.py:70` (docstring 목록 헤더 "Each assertion names one regression shape:") ~ `:87` (7번 항목 끝) — 누락된 8번째 항목에 대응하는 실제 테스트는 `:180`-`:184` (`test_set_json_reads_the_file_the_heredoc_wrote`)
  - 상세: 이 가드 파일 자체의 설계 원칙(코드 리뷰 과정에서 "이미지 가드는 4라운드 동안 같은 형태의 구멍이 한 겹씩 더 발견됐다"는 교훈을 명시적으로 인용하며, 모든 구조 점검을 헬퍼 하나에 몰아 "동일 형태 재발"을 막으려 함)에 비춰 보면, docstring 의 번호 목록은 "이 가드가 막는 회귀의 전수 목록"으로 기능해야 한다. 목록이 7개로 멈춰 있으면 다음 편집자가 "경로 쌍 검사"를 별개의 독립적 안전장치로 인지하지 못하고, 함수 시그니처를 바꾸거나(예: `heredoc_policy` 가 3-튜플이 아니라 2-튜플로 되돌아가는 리팩터) 리뷰 없이 제거할 위험이 있다 — 정확히 2라운드 리뷰에서 뮤테이션으로 잡아낸 회귀(경로 불일치가 조용히 통과)가 재발할 수 있는 지점이다.
  - 제안: docstring 번호 목록에 8번째 항목 추가 — 예: "8. the file the heredoc writes (`cat > PATH`) is the same file `set-json` reads — otherwise `set-json` would apply to a file that was never written." `plan/in-progress/k8s-avatar-policy.md` §D 의 D8/D9 서술(경로 쌍 단언)과도 부합하므로 plan 은 그대로 두고 테스트 파일 docstring 만 갱신하면 된다.

## 확인된 사항 (결함 아님 — 근거로 기록)

- **기능 완전성 / spec fidelity**: `k8s/overlays/local/infra-minio.yaml` Job `minio-create-bucket` 이 heredoc 으로 `avatars/*` 에 익명 `s3:GetObject` 만 부여하는 정책을 적용하며, `scripts/minio/avatars-public-read.json` 과 (버킷명 정규화 후) 의미상 동일함을 실제로 확인했다(`cat scripts/minio/avatars-public-read.json`, `cat k8s/.../infra-minio.yaml` 대조). `spec/2-navigation/9-user-profile.md` §6.1 "아바타 서빙 전략" 문단("버킷 정책은 `avatars/` 접두에 익명 `GetObject` 만 허용하고 `ListBucket` 은 허용하지 않는다", "배포 선행 조건: … 업로드는 성공하고 이미지만 403") 과 README·plan·코드 서술이 모두 line-level 로 일치 — spec drift 없음.
- `harness-checks.yml` pathspec 에 `k8s/overlays/local/infra-minio.yaml` 과 `scripts/minio/avatars-public-read.json` 이 등재돼 있어 정책 파일 단독 수정 PR 에서도 가드가 돎을 확인.
- `.claude/tests/test_minio_bucket_policy_parity.py` 를 직접 실행 — 13 test cases, 17 subtests 전부 PASS(`python3 -m pytest .claude/tests/test_minio_bucket_policy_parity.py -v`). 정규식(`_HEREDOC`, `_SET_JSON`, `_ARN_BUCKET`)과 YAML block-scalar 들여쓰기 처리, `job_script`/`heredoc_policy`/`granted_actions` 헬퍼 시그니처를 직접 대조해 실제 Job 스크립트 문자열에 대해 매치·값이 기대대로 나옴을 확인했다.
- `test_minio_image_parity` 에서 import 한 `PlaceNotFound`/`_dig`/`_expect_one`/`_seq` 의 실제 정의(라인 98-136)를 열어 시그니처·예외 처리(zero/duplicate → `PlaceNotFound`, 비-dict/비-list 방어)가 이 파일의 사용과 일치함을 확인.
- `test_harness_checks_paths_coverage.py` 26 tests / 7 subtests 전부 PASS.
- `CHANGELOG.md` 에 해당 항목("Unreleased — k8s 로컬 오버레이에서 아바타 이미지가 403 이던 것")이 존재.
- TODO/FIXME/HACK/XXX 주석 없음(`grep` 확인).
- `plan/in-progress/k8s-avatar-policy.md` §D 의 "새 테스트 12개" 는 초기 커밋(`80bfa4862`) 시점 기준 실측치(`git show 80bfa4862:… | grep -c 'def test_'` → 12)로, 이후 두 리뷰 라운드에서 15개·17개로 늘어난 별도 항목과 함께 정확히 이력을 반영하고 있어 오류가 아니다.
- 저장소 트리 뮤테이션 없음 — 본 리뷰는 읽기 전용 명령(`cat`/`grep`/`pytest`)만 사용했고 `git status --short` 로 `review/code/2026/09/25/09_03_48/`(본 리포트 산출 디렉터리) 외 변경 없음을 확인.

## 요약

k8s 로컬 오버레이 버킷 Job 에 아바타 공개 정책을 적용하는 변경과 이를 고정하는 drift 가드는 실제 파일(heredoc·정책 JSON) 대조, spec(`9-user-profile.md §6.1`) 대조, 테스트 실행 결과 모두 일관되게 부합한다 — 기능·엣지 케이스(zero/duplicate Job·container·arg, 인자 타입/공백 등)·에러 시나리오(named `PlaceNotFound`)·비즈니스 규칙(ListBucket 배제, unquoted 구분자)·spec fidelity 전부 실측 기반으로 확인됐다. 유일한 발견사항은 두 번째 리뷰 라운드에서 추가된 "heredoc 이 쓴 파일 = set-json 이 읽는 파일" assertion 이 모듈 docstring 의 "7개 회귀 형태" 번호 목록에 반영되지 않은 문서-구현 간 괴리이며, 기능 자체는 정상 동작하므로 차단 사유는 아니다.

## 위험도

LOW
