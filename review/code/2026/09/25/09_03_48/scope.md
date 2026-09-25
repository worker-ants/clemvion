# 변경 범위(Scope) 리뷰 — k8s-avatar-policy (2라운드 fix)

## 검증 방법

이번 리뷰 대상 3개 파일(`.claude/tests/test_minio_bucket_policy_parity.py`, `scripts/minio/README.md`,
`plan/in-progress/k8s-avatar-policy.md`)에 대해 직전 리뷰 라운드 커밋(`8b8eeb776`)부터 `HEAD`까지
(`fd3810242` + `986d6b19b`)의 실제 diff를 `git diff 8b8eeb776..HEAD -- <세 파일>`로 확인했고, `git diff -w`
결과 줄 수(100줄)가 일반 diff와 동일해 포맷팅 변경이 섞이지 않았음을 확인했다. 이 라운드에서
`k8s/overlays/local/infra-minio.yaml`은 전혀 수정되지 않아(`git diff --stat`으로 확인) 리뷰 대상에서
빠진 것이 타당함도 검증했다. 저장소 파일은 수정하지 않았다(읽기 전용 리뷰).

직전 라운드 SUMMARY(`review/code/2026/09/25/08_48_37/SUMMARY.md`)의 WARNING 2건과 이번 diff를
1:1 대조했다.

## 발견사항

없음. 이번 라운드의 3개 파일 변경 전부가 직전 라운드에서 지적된 정확히 두 개의 WARNING에 대응하며,
그 이상의 수정이 포함되지 않았다.

- `.claude/tests/test_minio_bucket_policy_parity.py`: WARNING #2(테스트) — heredoc이 쓰는 파일 경로와
  `set-json`이 읽는 경로가 같은 문자열임을 아무 테스트도 단언하지 않는다는 지적에 정확히 대응한다.
  `_HEREDOC` 정규식에 `path` 캡처 그룹을 추가하고 `_SET_JSON` 정규식을 신설, `heredoc_policy()`의
  반환 타입을 `(body, quoted)` → `(body, quoted, written_path)`로 확장했으며 이를 사용하는 두 지점
  (`test_heredoc_body_and_quoting`, `setUp`)을 함께 갱신하고 새 단언(`test_set_json_reads_the_file_the_heredoc_wrote`)
  하나만 추가했다. 새로 추가된 임포트·헬퍼·기능은 이 목적 하나에 국한된다.
- `scripts/minio/README.md`: WARNING #1(문서화) — README가 "이 파일은 CI 트리거 pathspec에 등재돼
  있다"고 잘못 주장한 부분(실측 결과 pathspec에는 정책 JSON과 k8s 매니페스트만 등재, README는 없음)을
  정정하는 3문장 교체다. 다른 문단은 손대지 않았다.
- `plan/in-progress/k8s-avatar-policy.md`: 체크리스트 항목에 "2라운드 뒤 D8·D9 추가로 17개, 전부
  KILLED" 한 문장만 추가 — 이번 라운드의 뮤테이션 재측정 기록이며 다른 트래커·plan 항목을 건드리지
  않는다.
- 커밋 메시지(`fd3810242`)가 스스로 "W2 testing … W1 documentation …"으로 대응 관계를 명시하고 있고,
  실제 diff도 그 두 항목 외의 수정을 포함하지 않는다. 직전 라운드에서 남은 INFO 16건(private import
  공유, docstring 부재, 경로 리터럴 중복 등)에는 손대지 않았는데, 이는 "이번 라운드는 WARNING만
  해소" 라는 좁은 범위와 일치하며 스코프 이탈이 아니다.
- `k8s/overlays/local/infra-minio.yaml`, `.github/workflows/harness-checks.yml`, `CHANGELOG.md`,
  `.claude/tests/README.md`는 이번 라운드(`8b8eeb776`..`HEAD`)에서 전혀 수정되지 않았다(`git diff --stat`
  확인) — 리뷰 대상 목록에서 빠진 것이 정확하다.

## 요약

이번 라운드는 직전 리뷰의 WARNING 2건(heredoc 경로-쌍 단언 부재, README의 CI 트리거 등재 오기술)만을
정확히 겨냥한 최소 수정이며, 무관한 리팩토링·포맷팅·기능 확장·임포트 정리·설정 변경이 전혀 관찰되지
않는다. 남겨진 INFO 항목들에 손대지 않은 것도 "WARNING만 해소"라는 이번 라운드의 선언된 범위와
일치한다.

## 위험도
NONE
