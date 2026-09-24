# 요구사항(Requirement) 충족 리뷰 — k8s-avatar-policy

## 검증 방법

리뷰 대상은 로컬 k8s 오버레이의 `minio-create-bucket` Job 이 아바타 공개 버킷 정책을 걸도록 하는 변경(`k8s/overlays/local/infra-minio.yaml`)과 그 drift 를 고정하는 신규 하네스 테스트(`.claude/tests/test_minio_bucket_policy_parity.py`), 관련 `harness-checks.yml` pathspec/README 카탈로그/CHANGELOG/plan 문서다. 저장소를 뮤테이션하지 않고 다음을 직접 실측했다(모두 read-only):

- `python3 -m unittest discover -s .claude/tests -p 'test_minio_bucket_policy_parity.py' -v` → **12/12 PASS**
- `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` (전체 하네스 스위트) → **1172 tests, OK** (`.claude/tests/README.md`·`harness-checks.yml`·plan 체크리스트에서 "미실행"으로 표시된 항목을 이 리뷰가 대신 실측했다)
- `python3 -m unittest discover -s .claude/tests -p 'test_harness_checks_paths_coverage.py'` / `test_spec_link_checks_scope.py` → 각 26/26, 2/2 PASS
- `kubectl kustomize k8s/overlays/local` 실 렌더 → Job `minio-create-bucket` 의 `args`가 diff 그대로 렌더되고, YAML block literal 의 공통 들여쓰기가 정확히 벗겨져 heredoc 종료 마커 `EOF`가 컬럼 0 에 위치함을 확인(진짜 bash heredoc 으로 파싱 가능한 형태)
- `scripts/minio/avatars-public-read.json`(정본) 을 직접 읽어 heredoc 본문(`${S3_BUCKET}` → `workflow-storage` 치환)과 의미상 동일함을 대조
- `spec/0-overview.md` §2.7 (line 280) 을 직접 열람해 "avatars/ 접두에 익명 GetObject 만 허용, ListBucket 불허" 문장과 구현·테스트를 대조
- 변경 파일들에 `TODO|FIXME|HACK|XXX` grep → 0건
- `git status --short` → 리뷰 세션 산출물(`review/code/...`) 외 잔여물 없음. 뮤테이션 미실시.

## 발견사항

- **[INFO]** `set -e` 도입으로 k8s Job 은 정책 적용 실패 시 fail-loud, 두 compose(`createbuckets`)는 여전히 `exit 0` 로 실패를 흡수 — 배포 경로 간 실패 거동 비대칭
  - 위치: `k8s/overlays/local/infra-minio.yaml:121`(주석 "두 compose 는 `exit 0` 으로 끝나 실패를 삼킨다 — 이 Job 과 다른 별 갭이다"), `docker-compose.yml`/`docker-compose.e2e.yml` 의 `createbuckets` entrypoint(`exit 0;`으로 종료)
  - 상세: `spec/0-overview.md` §5 "두 배포 방식 모두 동일한 기능을 제공"은 **기능** 동일성이며 실패 거동 동일성을 명시적으로 요구하지 않으므로 spec 위반은 아니다. 이번 plan 의 `--impl-prep` 단계에서 `rationale_continuity` checker 가 이미 이 비대칭을 INFO 로 짚었고(`review/consistency/2026/09/25/08_20_57/rationale_continuity.md`), 처분 결과("기록"만, compose 수정은 이 PR 축이 아님)대로 Job 주석에 한 줄이 실제로 반영되어 있다. 즉 이미 알려지고 의도적으로 defer 된 갭이며 이번 diff 의 결함은 아니다.
  - 제안: 조치 불요(이미 plan §E INFO2 로 처분·기록됨). compose 쪽 `createbuckets` 가 정책 적용 실패를 흡수하는 문제 자체는 별도 트랙 후보로 남아 있다는 점만 참고.

- **[INFO]** impl-prep 단계에서 지적된 유일한 WARNING(신규 가드 파일명 `test_minio_bucket_policy_parity.py` 가 기존 `test_minio_image_parity.py` 와 이름 패턴이 인접해 스코프 혼동 소지)은 최종 diff 에서 실제로 해소되어 있음을 확인
  - 위치: `.claude/tests/test_minio_bucket_policy_parity.py:1-5`(docstring 첫 문단에서 `test_minio_image_parity.py` 를 명시적으로 언급하고 "different axis" 로 구분), `.github/workflows/harness-checks.yml:92-100`(주석이 두 가드·두 축을 나란히 설명하도록 재작성됨), `.claude/tests/README.md:49`(신규 행이 기존 `test_minio_image_parity.py` 행 바로 아래 배치)
  - 상세: 결함이 아니라 정합성 확인 — `review/consistency/.../SUMMARY.md` WARNING #1 의 제안(a)(b)(c) 세 가지가 모두 실제 코드에 반영되어 있어 이 WARNING 은 종결된 것으로 판단한다.
  - 제안: 없음(이미 반영 완료).

CRITICAL/그 외 WARNING 은 발견되지 않았다. 구체적으로:
- **기능 완전성**: Job 이 버킷 생성 후 정본 JSON 과 의미상 동일한 정책을 `$S3_BUCKET` 변수로 걸어, 두 compose 파일과 아바타 공개-읽기 기능 패리티를 달성한다. `kubectl kustomize` 실 렌더로 문법 유효성도 확인됨.
- **엣지 케이스**: heredoc 구분자 unquote 여부(치환 성패), `s3:ListBucket` 부재, `anonymous set download` 프리셋 배제, 스크립트 첫 줄 `set -e`, Job/컨테이너/인자 형태가 어긋난 경우의 명명된 실패 등을 테스트가 개별로 고정.
- **TODO/FIXME**: 변경 파일 전체에서 0건.
- **의도와 구현 일치**: 함수명(`job_script`/`heredoc_policy`/`granted_actions`)과 docstring 이 실제 동작과 정확히 일치(각 함수 직접 실행 결과로 확인).
- **에러 시나리오**: `job_script`/`heredoc_policy` 모두 실패 시 대상을 이름으로 특정하는 `AssertionError` 를 던지며, 이는 "zero violations 가 곧 가드가 돈다는 증거는 아니다"라는 이 저장소의 반복 교훈과 일치하는 fail-loud 설계.
- **데이터 유효성**: `granted_actions` 는 `Action` 이 bare string 인 경우와 list 인 경우를 모두 정규화(테스트로 고정).
- **비즈니스 로직**: `spec/0-overview.md:280` 의 "avatars/ 접두 익명 GetObject 만, ListBucket 불허" 규칙이 코드·테스트·정본 JSON 세 곳에서 line-level 로 일치.
- **반환값**: 모든 헬퍼 함수가 정상/에러 경로 모두에서 명시적 반환 또는 명명된 예외를 발생시킴 — 조용한 `None`/공백 반환 경로 없음.
- **spec fidelity**: `spec/0-overview.md` §2.7(line 280)·§Rationale "S3 객체 키 prefix 설계"(374-378행) 와 구현이 정확히 일치. `spec_impact: none` 은 타당 — 이 PR 은 spec 문서를 변경하지 않으며 기존 spec 서술을 그대로 구현에 반영한다.

## 요약

k8s 로컬 오버레이의 버킷 Job 에 아바타 공개 정책(heredoc + `$S3_BUCKET` 치환 + `set -e`)을 추가하는 변경과 이를 고정하는 신규 하네스 테스트는 기능적으로 완결돼 있다. 새 테스트 12개 전부와 하네스 전체 스위트(1172개)가 실측 GREEN 이었고, `kubectl kustomize` 실 렌더로 heredoc 문법 유효성도 확인했다. `spec/0-overview.md` §2.7 이 명시한 "avatars/ 접두 익명 GetObject 만, ListBucket 불허" 규칙과 코드·테스트가 line-level 로 일치하며, `--impl-prep` 단계에서 나온 유일한 WARNING(가드 이름 인접으로 인한 스코프 혼동)은 docstring·workflow 주석·README 카탈로그 갱신으로 실제 반영되어 종결됐다. 남은 두 관찰(compose vs k8s 실패-거동 비대칭, plan 체크리스트의 전체 스위트 실행 항목)은 모두 이미 의도적으로 처분되었거나(전자) 이 리뷰가 독립적으로 검증을 대신 완료했다(후자, GREEN 확인). CRITICAL 은 없다.

## 위험도

NONE
