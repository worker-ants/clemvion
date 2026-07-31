# 변경 범위(Scope) 리뷰 — deps-guard-hardening

## 검토 방법

`git diff origin/main...HEAD --stat` (29개 파일)로 실제 diff 전체를 확보하고, prompt 가 크기
제한으로 생략한 `.claude/tests/README.md`·`.claude/tests/test_override_floors.py`·
`scripts/check-override-floors.py` 등은 `git diff`/`Read` 로 직접 원본을 대조했다. 대조 기준은
`plan/in-progress/deps-guard-hardening.md`(§1 오버라이드 바닥 침식 검출 · §2 `ignoreCves` 근거
규약 · §3 dependabot 되돌림 방지, + 체크리스트에 기록된 `/ai-review` 1차·2차 조치 이력)이다.

## 발견사항

- **[INFO]** `.github/workflows/harness-checks.yml` 의 `paths:` 트리거가 개별
  `.github/workflows/e2e.yml` 항목에서 `.github/workflows/**` 전체로 넓어져, PR 표면상으로는
  원 plan(§1~§3, "의존성 보안 가드 3건")의 직접 범위를 벗어난 "모든 워크플로 YAML 구조 검증"
  까지 diff 에 포함됐다.
  - 위치: `.github/workflows/harness-checks.yml`(paths 목록, `- '.github/workflows/**'` 행) ·
    `.claude/tests/test_harness_checks_paths_coverage.py`(`KNOWN_COVERAGE_DEPENDENCIES` 의
    `".github/workflows/**"` 키) · 신규 `.claude/tests/test_workflow_yaml_structure.py` 전체.
  - 상세: 그러나 이것은 무관한 추가가 아니라 **이 PR 자신이 2차 `/ai-review` 에서 만들어낸
    Critical**(1차 조치로 PyYAML 설치 스텝을 삽입하며 기존 스텝의 `name:`/`run:` 사이에
    끼워 넣어 `run:` 키가 중복되고 YAML 이 뒤 값을 택해 설치 명령이 통째로 사라진 사고)을
    재발 방지하기 위한 직접적 자기 교정이다. `plan/in-progress/deps-guard-hardening.md` 의
    "개발 중 실측으로 드러난 것" 절에 경위가 그대로 기록돼 있고, 넓힌 등재가 실제로 필요한지는
    기존 가드(`test_each_historical_leak_is_load_bearing`)가 개별 `e2e.yml` 항목의 중복을
    스스로 잡아 강제했다(plan: "무효 뮤턴트가 아니라 기존 가드가 잡아 중복 등재를 접고 fixture
    를 넓은 필터로 옮겼다"). 즉 범위 확장이 임의가 아니라 **테스트로 검증된 최소 필요분**이다.
  - 제안: 조치 불요 — 정당한 자기 교정. 향후 리뷰에서 "deps-guard PR 인데 왜 워크플로
    구조 가드가 들어있나"로 재론될 경우를 대비해 이 리뷰 판단을 근거로 남겨둔다.

- **[INFO]** `review/code/2026/08/01/01_12_24/**` · `review/code/2026/08/01/01_56_46/**`
  (17개 파일, 약 1,000줄)가 이 브랜치에 함께 커밋되어 diff 총량(2,433줄) 중 상당 부분을
  차지한다.
  - 위치: `review/code/2026/08/01/01_12_24/*.md,*.json` · `review/code/2026/08/01/01_56_46/*.md,*.json`.
  - 상세: `CLAUDE.md` 의 "정보 저장 위치" 표가 `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`
    를 코드 리뷰 산출물의 정식 저장 위치로 지정하며, 이 디렉터리는 gitignore 대상이 아니다
    (사용자 메모: "review/ 는 gitignored 아님"). `/ai-review` + Critical/Warning fix 는 구현
    완료 후 상시 승인된 강제 워크플로다. 따라서 이 커밋들은 PR 의도 밖 변경이 아니라 명세된
    프로세스의 정상 산출물이다.
  - 제안: 조치 불요.

이 외에 "의도 이상의 변경" · "불필요한 리팩토링" · "요청하지 않은 기능 확장" · "무관한 파일
수정" · "포맷팅-only 변경 혼입" · "불필요한 주석/임포트 변경" 에 해당하는 항목은 발견되지
않았다. 특히 다음을 직접 대조로 확인했다:

- `pnpm-workspace.yaml` diff 는 `auditConfig` 주석 추가뿐이며 `overrides`·`ignoreCves` 실제
  값은 변경되지 않았다 — `check-pnpm-security-config.py` 의 `EXPECTED_*` 2-place 동기화
  규약을 깨뜨릴 여지가 없다 (plan 이 명시적으로 경고한 함정을 피함).
- `scripts/check-override-floors.py`(신규 292줄)·`.claude/tests/test_override_floors.py`
  (신규 357줄) 은 전체가 §1(오버라이드 바닥 침식 검출)의 스크립트·회귀 테스트로만 구성되며,
  import·헬퍼 모두 실제로 사용된다. 무관한 유틸리티나 dead code 는 없다.
  - `check-override-floors.py`: 이 스크립트의 `EXPECTED_SUPPRESSED_PATHS`(`ignoreCves` 전역
    억제 대응 baseline)는 1차 리뷰의 Critical 조치로 §1 범위 안에서 추가된 것이지, 별도
    기능 확장이 아니다.
- `.github/dependabot.yml`·`.claude/tests/test_dependabot_npm_coverage.py` 변경은 §3(루트
  워크스페이스 등록 + 기존 staleness 가드 예외 처리)와 정확히 일치하며, 순수 추가(append)로
  기존 항목을 건드리지 않았다.
- `PROJECT.md` 변경은 diff stat 상 1줄 치환뿐이며(`2 +-`), 신규 `override-floors` 잡을
  기존 "의존성 취약점 audit·핀 거버넌스" 불릿의 항목 (3)으로 추가한 것 외 다른 서술은
  손대지 않았다.
- `.claude/tests/README.md` 카탈로그 표 갱신은 신규 테스트 파일 2건(`test_override_floors.py`,
  `test_workflow_yaml_structure.py`) 행 추가 + PyYAML 예외 설명 보강뿐이며, 이는
  `test_every_test_file_is_documented` 가드가 요구하는 필수 문서 동기화다.
- `plan/in-progress/deps-guard-hardening.md` 의 `worktree: (unstarted)` → `deps-guard` 변경은
  워크트리 진입 시 표준 절차이며, 체크리스트·"개발 중 실측으로 드러난 것"·`Rationale` 절
  갱신은 developer skill 이 plan/ 에 쓰기로 규정된 정상 활동이다.
- `.claude/tests/test_harness_checks_paths_coverage.py`·`test_dependabot_npm_coverage.py`
  변경은 각각 CI 배선·CI 등재 변경과 1:1로 대응하는 최소 갱신이며, 무관한 로직 정리는
  없다.

## 요약

이 PR 은 `plan/in-progress/deps-guard-hardening.md` 에 사전 기록된 §1(오버라이드 바닥 침식
검출)·§2(`ignoreCves` 근거 규약)·§3(dependabot 되돌림 방지) 세 항목과, 그 구현에 대한 2회의
`/ai-review` 가 발견한 Critical/Warning 을 조치한 결과로만 구성돼 있다. 두 번째 조치 라운드
(YAML 구조 가드 신설 + `.github/workflows/**` 등재 확장)는 표면적으로는 원 plan 범위를 넘어선
것처럼 보이지만, 이 PR 자신이 1차 조치 중 만들어낸 Critical 회귀를 되돌리기 위한 직접적
자기 교정이고 plan 문서에 경위가 투명하게 기록돼 있으며 기존 가드가 그 최소성을 강제했다.
`pnpm-workspace.yaml` 은 실제 override/ignoreCves 값을 건드리지 않고 주석만 보강했고,
`PROJECT.md`·`README.md` 갱신은 신규 코드에 정확히 대응하는 필수 문서 동기화다. 애플리케이션
코드(`codebase/backend`, `codebase/frontend` 등)는 diff 에 전혀 포함되지 않아, 변경이
"하네스/CI/의존성 거버넌스" 라는 선언된 영역 밖으로 새지 않았다. 무관한 리팩토링·기능 확장·
포맷팅 혼입·불필요한 주석/임포트 변경은 발견되지 않았다.

## 위험도

NONE
