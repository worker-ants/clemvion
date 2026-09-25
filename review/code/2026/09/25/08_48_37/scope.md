# 변경 범위(Scope) 리뷰 — k8s-avatar-policy

## 검증 방법

리뷰 대상 4개 파일(`k8s/overlays/local/infra-minio.yaml`, `scripts/minio/README.md`,
`.claude/tests/test_minio_bucket_policy_parity.py`, `plan/in-progress/k8s-avatar-policy.md`)에 대해
`git diff 80bfa4862~1..HEAD`(이 작업의 커밋 4개: `80bfa4862`·`9b4798054`·`1367e14ee`·`8b8eeb776`)로
실제 diff 를 확인했고, `git diff -w` 결과의 줄 수가 일반 diff 와 동일함(372줄)을 확인해 포맷팅 변경이
실질 변경에 섞여 들어가지 않았음을 검증했다. 저장소 파일은 수정하지 않았다(읽기 전용 리뷰).

## 발견사항

없음. 4개 파일 모두 "k8s 로컬 오버레이의 버킷 Job 이 아바타 공개 정책을 걸지 않는다"는 단일 결함 수정과
그 drift 가드에 정확히 대응한다.

- `k8s/overlays/local/infra-minio.yaml`: 기존 `StatefulSet`/`Service` 정의는 전혀 건드리지 않고,
  Job `minio-create-bucket` 의 `args` 스크립트에 `set -e` + heredoc 정책 적용 3줄 + 설명 주석만
  추가했다. diff 는 순수 추가(`+`)이며 기존 줄의 변형·삭제·이동이 없다.
- `scripts/minio/README.md`: "세 번째 적용 지점" 단락 하나만 삽입, 기존 문단은 무변경.
- `.claude/tests/test_minio_bucket_policy_parity.py`: 완전 신규 파일(`git log --follow` 로 확인,
  선행 버전 없음). import 는 `json`·`re`·`unittest`·`yaml`·`REPO_ROOT`·형제 가드(`test_minio_image_parity`)의
  `PlaceNotFound`/`_dig`/`_expect_one`/`_seq` 뿐이며 전부 본문에서 실사용된다(미사용 임포트 없음).
  형제 가드 파일(`test_minio_image_parity.py`) 자체는 이번 커밋 범위에서 전혀 수정되지 않았고 헬퍼만
  import — 로직 복제 대신 재사용을 택한 것으로 스코프 확장이 아니다.
- `plan/in-progress/k8s-avatar-policy.md`: 이번 작업의 실측·처방·체크리스트·리뷰 처분만 기록, 다른
  트래커·plan 항목을 건드리지 않는다(`spec_impact: none` 도 실제로 `spec/` 무변경과 일치).
- 커밋 이력상 `1367e14ee`(추출기 수정)가 `scripts/minio/README.md` 에 8줄을 추가로 얹었는데, 이는
  같은 리뷰 라운드(`review/code/2026/09/25/08_33_19`)의 W3(documentation) 지적에 대한 직접 응답이며
  임의 확장이 아니다.
- CHANGELOG·`.github/workflows/harness-checks.yml`·`.claude/tests/README.md` 변경도 확인했으나(이번
  리뷰 대상 파일 목록에는 없음) 전부 이 작업의 필수 부수 항목(pathspec 등재·카탈로그 행 추가·릴리스 노트)이며
  무관한 파일 손질은 없다.

## 요약

전 범위가 "k8s 로컬 오버레이 버킷 Job 에 아바타 공개 정책을 건다"는 단일 목표와 그 drift 가드에
정확히 대응한다. 의도 이상의 리팩토링, 무관한 파일 수정, 불필요한 임포트/설정 변경, 포맷팅과
실질 변경의 혼입이 관찰되지 않았다. 코멘트·문서·plan 서술이 길지만(예: Job 주석 13줄, 테스트
docstring 40줄) 이는 이 저장소의 "결정 근거를 그 자리에 남긴다"는 확립된 관례와 일치하며, 새로
추가된 코드 자체를 설명하는 내용이라 스코프 이탈로 보지 않는다.

## 위험도

NONE
