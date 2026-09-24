# 변경 범위(Scope) 리뷰 — k8s-avatar-policy

## 검토 방법

`git diff --stat`(원본 저장소, 커밋 `80bfa4862` + `9b4798054`)로 실제 변경 파일 14개 전체가
프롬프트에 실린 목록과 정확히 일치함을 확인했다. `CHANGELOG.md` 는 프롬프트에서 "전체 파일
컨텍스트"가 크기 초과로 생략됐으나 unified diff 자체(신규 21줄, `## Unreleased` 절 1개 추가)는
실려 있어 그것으로 판단했다.

## 발견사항

발견된 CRITICAL/WARNING/INFO 없음.

의도(트래커 항목 "k8s 로컬 오버레이의 버킷 Job 이 아바타 공개 정책을 걸지 않는다" 해소)에 대해
14개 변경 파일 전부가 다음 중 하나로 직접 설명된다 — 의도 밖 추가 수정, 무관한 리팩토링, 기능
확장, 무관한 파일 수정, 포맷팅/주석 끼워넣기, 불필요한 임포트, 의도치 않은 설정 변경 어느
것도 발견하지 못했다.

- `k8s/overlays/local/infra-minio.yaml` — 핵심 수정. Job 스크립트에 `set -e` + heredoc 정책 +
  `set-json` 만 추가했다. 기존 라인(`mc alias set` 대기 루프, `mc mb`)은 문맥으로만 나타나고
  실질 변경이 섞여 있지 않다.
- `.claude/tests/test_minio_bucket_policy_parity.py`(신규) — 방금 만든 이중 소스(원본 JSON ·
  Job heredoc)의 drift 를 고정하는 가드. 플랜 §D 에 D1~D7(정책 데이터 뮤턴트)·E1~E4(추출기
  경계) 총 11개 뮤턴트 계획과 정확히 대응하는 11개 테스트만 존재 — 계획보다 넓은 기능이나
  임의의 헬퍼가 추가되지 않았다. import(`json`/`re`/`unittest`/`yaml`/`REPO_ROOT`) 전부
  사용됨.
- `.claude/tests/README.md` — 카탈로그에 신규 가드 1행 추가. 기존 `test_minio_image_parity.py`
  행 바로 아래 배치돼 있는데, 이는 `--impl-prep` 리뷰가 낸 WARNING 1(두 minio 가드의 축 차이가
  인접 이름 때문에 오인될 위험)의 명시적 처방이지 임의 편집이 아니다.
- `.github/workflows/harness-checks.yml` — pathspec 주석을 "이미지 가드"에서 "이미지·정책 두
  가드" 구도로 다시 쓰고 `scripts/minio/avatars-public-read.json` 1줄을 추가했다. 이 역시 같은
  WARNING 1 처방이며, 이미 있던 다른 pathspec 줄이나 잡 구조를 건드리지 않았다.
- `CHANGELOG.md` — 이번 결함·수정·가드를 요약하는 `## Unreleased` 절 1개 신설. 다른 절은
  손대지 않았다(diff 컨텍스트 상 뒤이은 기존 절 제목이 그대로 보임).
- `plan/in-progress/k8s-avatar-policy.md`(신규) — 이 작업 전용 plan. `spec_impact: none` 이며
  실제로 `spec/**` 파일은 diff 에 하나도 없다 — 선언과 실물이 일치한다.
- `review/consistency/2026/09/25/08_20_57/**`(8개 파일) — `/consistency-check --impl-prep`
  산출물. CLAUDE.md 정보 저장 위치 표가 요구하는 그 경로(`review/consistency/<YYYY>/.../`)에
  정확히 위치하고, plan 체크리스트의 "구현 전에" 항목과 대응한다. 산출물 자체가 스코프 밖
  검토 관점(swagger 413 누락·오브젝트 스토리지 키 네이밍 컨벤션 부재 등)을 INFO 로 발견했지만
  전부 "본 plan scope 밖(project-planner 후보)"로 명시하고 target 문서를 고치지 않았다 —
  스코프 확장이 아니라 스코프 경계를 지킨 기록이다.

두 커밋의 분리도 스코프 관점에서 깨끗하다: `80bfa4862`(fix, 14개 파일 전체)이 실제 수정 +
가드 + 문서를, `9b4798054`(docs, plan 파일 1개만)이 그 뒤 수행한 뮤턴트 11개 전수 확인
결과만 plan 체크리스트에 추가했다 — 코드 변경 없이 문서 갱신만 하는 후속 커밋으로 범위가
분리되어 있다.

## 요약

트래커의 단일 결함(k8s 로컬 오버레이 버킷 Job 의 아바타 공개 정책 누락) 하나를 닫는 데 필요한
최소 집합 — 실제 수정, 그로 인해 필요해진 drift 가드와 그 가드를 트리거하는 pathspec 등록,
README 카탈로그 갱신, CHANGELOG, plan/consistency 산출물 — 만 포함되어 있다. 가드 테스트의
테스트 개수·경계도 plan 이 사전에 선언한 뮤턴트 집합과 정확히 일치해 over-engineering 도
없고, `--impl-prep` 이 낸 유일한 WARNING 은 코드가 아니라 정확히 문서·주석 처방으로만
반영되어 스코프를 넘지 않았다. 무관한 파일·포맷팅·주석·임포트·설정 변경은 발견되지 않았다.

## 위험도
NONE
