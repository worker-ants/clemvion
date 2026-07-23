# 테스트(Testing) 리뷰 — `.claude/tests/test_e2e_exemption_paths_sync.py` 외

## 실측 검증 요약

리뷰 중 실제로 스위트를 실행하고 두 방향 뮤턴트를 직접 주입해 확인했다 (원복 완료, `git status` clean):

- `python3 -m unittest discover -s .claude/tests -p 'test_e2e_exemption_paths_sync.py'` → 16건 전부 OK.
- 하네스 전체 스위트(`-p 'test_*.py'`) → 483건 전부 OK. 회귀 없음.
- 뮤턴트 A(원래 결함 재현: `e2e.yml` push 블록에서 `.github/**` 제거) → `test_every_trigger_shares_one_paths_ignore` 와
  `test_every_whitelist_entry_is_mirrored_or_explained` 둘 다 정확히 FAIL. 낭비 방향(mirrored-or-explained) 비-vacuity 확인.
- 뮤턴트 B(안전하지 않은 방향: 화이트리스트에 없는 `codebase/backend/**` 를 `paths-ignore` 에 추가) →
  `test_no_paths_ignore_entry_escapes_the_whitelist` 정확히 FAIL. hard-fail 방향 비-vacuity 확인.

두 방향 모두 실제로 의도한 대로 잡는다 — 이 가드는 vacuous 하지 않다.

## 발견사항

- **[INFO]** `!` negation 패턴(`paths-ignore` 의 GitHub Actions 제외-취소 문법)에 대한 동작이 파서에도 테스트에도 없음
  - 위치: `.claude/tests/test_e2e_exemption_paths_sync.py` — `parse_paths_ignore_blocks`/`_yaml_scalar` 함수 (게이트 91-123, 71-88)
  - 상세: 정작 `e2e.yml` 자신의 인라인 주석(파일 상단, 이번 diff 밖)이 "`!` negation 패턴으로 이 파일을 다시 빼낼 수도 있었지만 순서 규칙이 미묘해서 `workflow_dispatch` 를 택했다"고 명시적으로 이 문법을 대안으로 검토했다고 서술한다. 즉 이 저장소의 담당자들이 실제로 고려한 미래 변경 형태인데, `parse_paths_ignore_blocks`/`_yaml_scalar` 는 `!foo/**` 를 그냥 하나의 일반 패턴 문자열로 취급한다. 이런 항목이 실제로 추가되면 `test_no_paths_ignore_entry_escapes_the_whitelist` 가 "화이트리스트에 없는 패턴"으로 하드 실패시키는데, negation 항목의 실제 의미(그 하위 경로는 오히려 e2e 를 **더 강제**하는 방향)를 감안하면 이 실패가 맞는 판정인지 오탐인지 이 스위트만으로는 확정할 수 없다 — 어느 쪽이든 pin 하는 테스트가 없어 그 순간 담당자가 코드를 새로 읽고 판단해야 한다.
  - 제안: 최소한 `!`-prefixed 항목에 대한 기대 동작(그대로 whitelist 대조 대상으로 볼지, 별도 취급할지)을 문서화하는 `ParserBoundaryTest` 케이스 1개 추가. 지금 당장 위험하지는 않음(negation 이 아직 쓰이지 않음) — 사용 전 pin 이면 충분.

- **[INFO]** `_yaml_scalar` 의 quote 처리가 YAML 의 doubled-single-quote escape(`'it''s/**'` → 리터럴 `it's/**`)를 모른다
  - 위치: `.claude/tests/test_e2e_exemption_paths_sync.py:_yaml_scalar` (게이트 71-88)
  - 상세: `end = raw.find(quote, 1)` 이 첫 닫는 따옴표를 만나는 즉시 멈추므로, YAML 표준의 이스케이프된 따옴표가 값에 등장하면 값이 잘못 잘린다. 독스트링이 "every quote style" 을 표방하는 만큼(실제로 single/double/unquoted 3종은 테스트됨), 이 특정 이스케이프 케이스는 표방과 실제 커버리지 사이 작은 간극이다. 실제 경로 패턴에 따옴표가 등장할 일이 없어 현재는 위험이 사실상 0.
  - 제안: 우선순위 낮음. 필요 시 `ParserBoundaryTest` 에 케이스 1개만 추가하거나, 독스트링에서 "every quote style" 표현을 "실제로 쓰이는 3가지 quote 스타일"로 좁혀 표방과 커버리지를 맞추는 것도 대안.

- **[INFO]** 이 가드의 뮤턴트(비-vacuity) 검증이 plan 문서에 기록되지 않음 — 인접 항목들과 서술 비대칭
  - 위치: `plan/in-progress/harness-guard-followups.md` 게이트 276-287 (W3 항목)
  - 상세: 같은 섹션의 인접 항목들(I3 라인 위 W5, "미등록 트리 추가·등록 삭제·stale 경로 3종 뮤턴트 전부 포착")은 뮤턴트 검증 결과를 명시하는데, 이번 W3 항목 서술은 "파서는 텍스트 주입식 + fixture 로 경계 선고정"까지만 언급하고 실제 리포지토리 파일에 대한 두 방향 뮤턴트 검증 언급이 없다. 본 리뷰에서 직접 두 방향 다 검증해 실제로는 문제 없음을 확인했으나(위 "실측 검증 요약"), 서술 자체가 없으면 나중에 재확인 없이 신뢰도만으로 판단하게 된다.
  - 제안: 사소함. 굳이 고칠 필요는 없으나, 다음에 이 plan 항목을 다시 편집할 기회가 있으면 한 줄 추가 권장.

- **[INFO]** `WorkflowMirrorsWhitelistTest` 는 실제 저장소 파일(`E2E_WORKFLOW`, `PROJECT_MD`)을 mock 없이 직접 읽는다 — 의도된 설계이며 적절함
  - 위치: `.claude/tests/test_e2e_exemption_paths_sync.py:WorkflowMirrorsWhitelistTest.setUpClass` (게이트 236-243)
  - 상세: `.claude/tests/README.md` 의 "Conventions for new tests" 가 명시하는 예외(대상 자체가 두 실 파일 사이의 drift 인 경우 mock 은 "우리 모델"만 검증하고 실제 drift 는 못 잡는다)에 정확히 부합하며, 자매 가드 `test_dependabot_npm_coverage.py`/`test_router_safety_policy_doc.py` 와 같은 패턴이다. 부작용: 이 클래스의 테스트는 저장소 상태(두 파일의 현재 내용)에 의존하므로 "테스트 격리" 관점에서 고전적 유닛테스트의 순수성은 없지만, 이는 가드의 목적상 불가피하고 올바른 트레이드오프다. `ParserBoundaryTest` 가 파서 로직 자체는 순수 텍스트 주입으로 완전히 격리해 커버하므로 두 계층이 상호 보완한다 — 설계가 바람직함.

## 요약

`test_e2e_exemption_paths_sync.py` 는 손수 짠 두 개의 텍스트 파서(`paths-ignore` 블록, PROJECT.md 화이트리스트 불릿)를 `ParserBoundaryTest` 로 먼저 경계 고정(따옴표 3종·인라인 주석 vs 따옴표 안 `#`·빈 줄/주석 줄·다음 키 경계·복수 블록·부재 키·미종결 따옴표)한 뒤, 실제 두 파일을 읽어 비대칭 규약(paths-ignore 가 화이트리스트보다 넓으면 hard fail, 좁으면 `UNMIRRORED_WHITELIST_ENTRIES` 로 사유 강제)을 적용하는 2계층 구조다. 리뷰 중 직접 실행해 16/16 통과, 하네스 전체 483/483 통과를 확인했고, 원래 결함(`.github/**` 누락)과 안전하지 않은 방향(화이트리스트 밖 항목 추가) 두 뮤턴트를 실제로 주입해 각각 의도한 테스트가 정확히 실패함을 실측 확인했다 — vacuous 가드가 아니다. non-vacuity 자가 점검(`test_parsers_found_something`), 두 트리거 간 동일성 고정, whitelist stale-entry 역방향 검사까지 갖춰 커버리지 갭이 실질적으로 크지 않다. 남은 것은 전부 INFO 급 — GitHub Actions `!` negation 문법(워크플로 자신의 주석이 대안으로 언급)과 YAML doubled-quote escape 처럼, 현재 실 데이터엔 없지만 향후 등장 가능한 edge case 에 대한 pin 부재, 그리고 plan 문서 서술의 사소한 비대칭. Mock 사용은 의도적으로 최소화(파서는 순수 함수 텍스트 주입, drift 검사만 실 파일)되어 있어 적절하고, 두 클래스 간 테스트 격리도 깨끗하다.

## 위험도
LOW
