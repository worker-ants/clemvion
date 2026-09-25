# 문서화(Documentation) 리뷰 — k8s 아바타 정책 가드

## 발견사항

- **[INFO]** `heredoc_policy` 독스트링이 실패 조건을 "zero or two" 로만 적어 3개 이상인 경우를 언급하지 않는다
  - 위치: `.claude/tests/test_minio_bucket_policy_parity.py:94` (`def heredoc_policy` 독스트링)
  - 상세: 실제 구현은 `_expect_one` 을 통해 "정확히 하나가 아니면(0, 2, 3, …) 모두 실패, 개수를 이름으로 밝힌다" 이다(형제 가드 헬퍼 재사용, `granted_actions` 계열과 동일 패턴). 독스트링은 "zero or two fail" 이라고만 적어 3개 이상 케이스를 명시하지 않는다. 테스트(`test_heredoc_zero_or_two_is_named`)도 0·2 두 값만 커버한다. 동작 자체는 정확하고(`_expect_one` 이 일반화돼 있음) 문서 문구만 실제보다 좁게 읽힌다.
  - 제안: "zero or (more than one) fail" 정도로 일반화하거나 현행 문구 유지(사소함, 차단 사유 아님).

- **[INFO]** 세 문서(가드 docstring · README · plan) 간 상호 참조가 전부 실측과 일치함을 교차 확인함 — 결함 아님, 참고용 기록
  - 위치: `.claude/tests/test_minio_bucket_policy_parity.py:1-40`(모듈 docstring), `scripts/minio/README.md:11-19`, `.claude/tests/README.md:49`, `.github/workflows/harness-checks.yml:93-104`, `k8s/overlays/local/infra-minio.yaml:109-121`, `CHANGELOG.md` (커밋 `80bfa4862`)
  - 상세: `--impl-prep` 리뷰에서 지적된 "두 minio 가드의 축 차이" (W1) 는 가드 docstring 1~5번째 줄·`harness-checks.yml` 주석(93·95줄)·`.claude/tests/README.md` 48/49행 인접 배치·`infra-minio.yaml` 인라인 주석(102줄, `set -e` 관련 121줄) 전부에 실제로 반영되어 있다. INFO 2 처분("두 compose 는 `exit 0` 으로 실패를 삼킨다")도 `infra-minio.yaml:121` 주석으로 반영 확인. `harness-checks.yml` pathspec(103-104줄)에 정책 JSON·k8s 매니페스트 둘 다 등재되어 README 의 "등재돼 있어 둘 중 하나만 고친 PR 에서도 돈다" 주장과 일치. heredoc 본문(`infra-minio.yaml:130-142`)도 `avatars-public-read.json` 과 버킷명만 다르고 구조가 동일해 "의미상 같음" 단언과 부합. CHANGELOG 항목도 이미 커밋에 포함되어 plan 체크리스트의 해당 항목과 일치.
  - 제안: 없음(확인 완료, 조치 불필요).

## 요약

이번 변경(신규 가드 테스트·README 섹션·plan 문서·매니페스트 인라인 주석)은 독스트링·인라인 주석·README·CHANGELOG·`.claude/tests/README.md` 카탈로그·CI 워크플로 주석까지 전 층위에서 서로 정합하며, 실제 코드(`infra-minio.yaml` heredoc, `avatars-public-read.json`, `harness-checks.yml` pathspec, `test_minio_image_parity.py` 의 재사용 헬퍼)와 대조해도 불일치가 발견되지 않았다. `--impl-prep` 라운드에서 지적된 처분(W1: 두 가드 축 구분 명시, INFO 2: compose/k8s 실패 처리 비대칭 기록)도 실제로 반영되어 있음을 직접 확인했다. 발견된 사항은 `heredoc_policy` 독스트링의 경계 조건 서술이 실제보다 한 단계 좁다는 사소한 표현 문제 하나뿐이며 동작·테스트 커버리지에는 영향이 없다.

## 위험도

NONE
