# 요구사항(Requirement) 리뷰 — k8s 로컬 오버레이 버킷 Job 아바타 공개 정책

## 발견사항

- **[INFO]** compose 는 정책 적용 실패를 삼키고(`exit 0`) k8s Job 은 `set -e` 로 실패시키는 비대칭이 그대로 남아 있다.
  - 위치: `k8s/overlays/local/infra-minio.yaml:121` (주석) / `docker-compose.yml:87` 부근 (`;` 로 이어지는 명령 체인, `set -e` 없음)
  - 상세: plan `E` 표의 `INFO 2` 로 이미 식별·처분(`기록만, 이 PR 범위 밖`)된 항목과 동일하다. 재확인 결과 실제로 compose 두 파일 모두 `set -e` 가 없어 여전히 유효한 관찰이지만, k8s Job 주석(`infra-minio.yaml:121`)에 "두 compose 는 exit 0 으로 실패를 삼킨다 — 이 Job 과 다른 별 갭이다" 라고 명시돼 있어 처분 그대로다. 재지적이 아니라 확인용으로 남긴다.
  - 제안: 조치 불요(plan 에서 이미 defer 확정). 후속 PR 후보로만 유지.

- **[INFO]** `_HEREDOC` 정규식(`test_minio_bucket_policy_parity.py:62`)은 닫는 `EOF` 줄이 반드시 컬럼 0에서 시작해야 매치한다 — `<<-EOF` (탭으로 들여쓴 종료 델리미터를 허용하는 변형) 를 실제로 지원하지는 않는다.
  - 위치: `.claude/tests/test_minio_bucket_policy_parity.py:62`, `:145`(`test_heredoc_body_and_quoting`)
  - 상세: 테스트는 `-EOF` 시작 델리미터(quoted=False)만 검증하고, 종료 델리미터가 들여써진 경우는 다루지 않는다. 실제 Job 스크립트는 YAML block-scalar 디덴트 덕에 종료 `EOF` 가 컬럼 0 에 오므로 현재는 문제없이 동작(실측: `python3 -m pytest .claude/tests/test_minio_bucket_policy_parity.py -q` 전체 GREEN, 32 passed / 62 subtests). 회귀 위험이 아니라 정규식의 표현 범위가 실제 사용 형태보다 좁다는 관찰이며, 현재 코드·spec 어디에도 `<<-EOF` 를 요구하지 않으므로 결함은 아니다.
  - 제안: 조치 불요. 향후 Job 스크립트가 heredoc 을 다른 들여쓰기로 바꾸면 재검토.

## 실측 확인 사항 (뮤테이션 검증, 저장소 밖 scratch 사본에서 수행 — 저장소는 변경 없음, `git status --short` 로 확인)

- D5(`set -e` 삭제) → `test_script_fails_fast` KILLED, 실측 그대로.
- D3(heredoc 버킷을 리터럴로 하드코딩) → `test_heredoc_names_the_bucket_through_the_variable` KILLED, 실측 그대로.
- `test_harness_checks_paths_coverage.py`, `test_minio_image_parity.py`, `test_minio_bucket_policy_parity.py` 전체 GREEN(로컬 재실행, 총 32+26 passed).
- plan `D. 체크리스트`의 CHANGELOG 항목(`CHANGELOG.md` Unreleased 절)·`.claude/tests/README.md` 카탈로그 행·`.github/workflows/harness-checks.yml` pathspec(`k8s/overlays/local/infra-minio.yaml`, `scripts/minio/avatars-public-read.json`) 모두 실재 확인.
- `spec/0-overview.md` Rationale(§2.7)·`spec/2-navigation/9-user-profile.md §6.1` 의 "버킷 정책은 `avatars/` 접두에 익명 `GetObject` 만 허용하고 `ListBucket` 은 허용하지 않는다" 문장이 새 가드의 `test_no_list_bucket_anywhere` · README 본문과 line-level 로 정확히 일치. `POST /api/users/me/avatar`·"배포 선행 조건"·정책 파일 경로 언급도 spec 본문(§6.1 하단 인용 블록)과 코드/문서가 동일 문구로 일치.
- 정책 파일(`scripts/minio/avatars-public-read.json`)과 k8s heredoc 을 `${S3_BUCKET}` → 실제 base configmap 값(`workflow-storage`, `k8s/base/configmap.yaml:29`)으로 치환한 결과가 `json.loads` 동치임을 직접 재현·확인.

## 요약

k8s 로컬 오버레이 Job 이 두 compose 파일과 동일한 아바타 공개 읽기 정책(`avatars/*` 익명 `GetObject`, `ListBucket` 미허용)을 heredoc + `${S3_BUCKET}` 치환으로 적용하도록 고쳤고, 이를 고정하는 신규 가드 테스트(`test_minio_bucket_policy_parity.py`)와 문서(README, 하네스 pathspec, 카탈로그, CHANGELOG)가 빠짐없이 갖춰져 있다. 가드의 각 단언(정책 적용 대상 버킷·변수 사용·heredoc 구분자 unquoted·정책 동치·ListBucket 부재·download 프리셋 금지·`set -e`)은 실제 매니페스트에 대해 전부 GREEN 이며, 대표 뮤테이션(D5, D3) 재현으로 의도한 테스트가 정확히 실패하는 것도 확인했다. 관련 spec 본문(`spec/0-overview.md` §2.7 Rationale, `spec/2-navigation/9-user-profile.md §6.1`)과 코드·문서·plan 실측 기록이 문구 수준까지 일치하며, TODO/FIXME 류 미완성 표시나 반환값 누락, 미검증 입력 경로는 발견되지 않았다. 남은 두 관찰(INFO)은 이미 plan 에서 defer 처분된 기존 비대칭의 재확인, 그리고 실사용 범위를 벗어난 정규식 표현력 한계이며 둘 다 현재 동작을 저해하지 않는다.

## 위험도

NONE
