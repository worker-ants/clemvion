# 의존성(Dependency) 리뷰 — round 7, CI 백스톱 (review-gate.yml / harness-checks.yml / check-review-gate.py)

## 스코프 메모

본 리뷰는 시스템 프롬프트에 정의된 의존성(Dependency) 리뷰어 역할 — 새 패키지·버전
고정·라이선스·취약점·불필요 의존성·번들/빌드 영향·호환성·내부 모듈 의존 — 을 그대로
따랐다. 호출부 CONTEXT 에 포함된 "라운드 7 상태에서 실제 우회를 찾아 워크플로 판정을
뒤집어 보라"는 지시는 의존성 리뷰의 8개 관점 밖(판정 로직 자체의 red-team)이라 별도로
수행하지 않았고, 대신 그 우회 탐색이 반복해서 드러낸 결함 클래스 — **"손으로 나열한
목록이 실제 import/호출 그래프보다 좁다"** — 를 의존성 관점(§8 내부 의존성)에서 이번
라운드 신규 코드에 대입해 대조했다. 그 결과가 아래 첫 항목이다.

모든 실측은 `Read`/`grep`/`git diff`/실제 `python3 -m unittest` 실행으로 확인했다(명령과
출력은 각 항목의 "상세"에 기재).

## 발견사항

- **[WARNING]** 이번 라운드 신설된 `TheGateItselfDoesNotBranchOnCiEnvTest`의 정적 스캔
  대상(`_SCANNED`)이 `evaluate_review()`의 실제 내부 의존 그래프를 다 덮지 못한다 —
  `.claude/hooks/_lib/*.py` 세 파일만 스캔하고, `review_guard.py`가 실제로 호출하는
  `.claude/_shared/report_paths.py`·`.claude/_shared/block_integrity.py`는 빠져 있다.
  - 위치: `.claude/tests/test_review_gate_ci.py:600-603`(`_ALLOWED`/`_SCANNED` 정의).
    대조: `.claude/hooks/_lib/review_guard.py:460`(`_report_paths_lib.missing_reports(...)`),
    `:762`(`_block_integrity.summary_block_verdict(text)`),
    `:804`(`_block_integrity.contradiction_note(best_dir)`) — 전부 `grep -n
    "_report_paths_lib\.\|_block_integrity\." .claude/hooks/_lib/review_guard.py`로 실측.
  - 상세: 이 테스트 클래스는 7R에 신설됐고, "판정자 본체가 CI 환경변수로 갈라지지
    않는다"를 등재제 화이트리스트로 고정한다(`review_guard.py`가 읽어도 되는 유일한
    환경은 `CLAUDE_PROJECT_DIR`). 그런데 `_SCANNED = ("review_guard.py",
    "branch_guard.py", "plan_guard.py")`는 `_lib` 디렉터리 안 세 파일의 **파일명**만
    보고, `review_guard.py`가 `from _shared import report_paths as _report_paths_lib` /
    `from _shared import block_integrity as _block_integrity` 형태로 끌어와 실제
    호출하는 두 `_shared` 모듈은 이 목록 밖이다 — 파일명이 다르므로 `_SCANNED`를 아무리
    넓혀도 자동으로는 잡히지 않는다. 위 세 호출 지점(460/762/804행)은 죽은 코드가
    아니라 `evaluate_review()`의 실제 판정 경로 위에 있다(`missing_reports`는 forced
    리뷰어 커버리지 판정에, `summary_block_verdict`/`contradiction_note`는 이번 백스톱
    시리즈가 지키는 "BLOCK:NO 인데 CRITICAL 존재" 하향 감지에 쓰인다). 현재는 두
    `_shared` 모듈 다 `os.environ`/`os.getenv`를 전혀 읽지 않으므로(`grep -n
    "environ\|getenv" .claude/_shared/report_paths.py .claude/_shared/block_integrity.py`
    → 0건) 오늘 당장 살아있는 우회는 아니다. 다만 이 PR 전체가 "환경 접근 축"을 CI
    백스톱의 우회 표면으로 지목하고 4R~6R 세 라운드에 걸쳐 정확히 이 축을 닫아 왔고,
    같은 파일 안에서 트리거-경로 등재(`review-gate.yml`의 `on.pull_request.paths`)는
    `_shared`까지 포함하도록 이미 넓혀 놓았는데(아래 항목) 정작 "환경을 읽는지" 정적
    검사 등재(`_SCANNED`)는 `_lib`에서 멈춘 것은 같은 파일 세트 안에서의 비대칭이다.
    이 저장소가 반복해서 겪은 "손으로 나열한 목록이 실제 그래프보다 좁다" 클래스
    (harness-checks.yml paths 갭 6회, 직전 라운드의 `review_guard.py`/`branch_guard.py`
    개별 나열)의 재현이며, 이 라운드 자신이 신설한 방어에서 나온 새 인스턴스라는 점이
    특히 지적할 가치가 있다.
  - 제안: `_SCANNED`를 `review_guard.py`의 실제 import에서 유도하거나(AST로
    `from _shared import X` / `from X import Y`를 재귀 추적해 스캔 대상 파일 집합을
    계산), 최소한 `_shared/report_paths.py`·`_shared/block_integrity.py`를 `_SCANNED`에
    명시 추가.

- **[INFO]** (긍정적 변화, 직전 라운드 WARNING 해소) `review-gate.yml`의 `paths:`
  트리거가 6R 리뷰에서 지적된 개별 파일명 나열에서 글롭으로 넓어져, `_lib`에 새 모듈이
  추가돼도 자동으로 트리거 대상에 포함된다.
  - 위치: `.github/workflows/review-gate.yml:31`(`- '.claude/hooks/_lib/**'`).
    `git diff HEAD~1 HEAD -- .github/workflows/review-gate.yml`로 실제 diff 확인 —
    `'.claude/hooks/_lib/review_guard.py'` + `'.claude/hooks/_lib/branch_guard.py'` 두
    줄이 `'.claude/hooks/_lib/**'` 한 줄로 교체됐다.
  - 상세: `review_guard.py`가 `_lib` 안에서 import하는 유일한 형제 모듈은
    `branch_guard`(`grep -n "^from branch_guard" .claude/hooks/_lib/review_guard.py` 1건)
    이고, `_shared` 쪽 의존(`report_paths`, `block_integrity`)은 이미 존재하는
    `'.claude/_shared/**'` 글롭이 덮는다. 실측: 내부 의존 그래프 전체
    (`review_guard.py` → `branch_guard.py`, `_shared/report_paths.py`,
    `_shared/block_integrity.py`)가 `paths:` 트리거 항목 4개(`.claude/hooks/_lib/**`,
    `.claude/_shared/**`, `scripts/check-review-gate.py`,
    `.github/workflows/review-gate.yml`)로 완전히 커버된다. **트리거-경로 등재는 이번
    diff로 실제로 완전해졌다** — 위 WARNING 항목이 지적하는 것은 같은 파일들에 대한
    **별개의** 등재(환경 읽기 스캔)가 아직 못 따라간 것이다.

- **[INFO]** 이번 변경분은 새 외부 패키지를 추가하지 않는다.
  - 위치: `scripts/check-review-gate.py:51-53`(`import argparse, os, sys` — stdlib뿐),
    `.github/workflows/review-gate.yml:72-74`("표준 라이브러리만 쓴다(harness 규약) —
    설치 단계 없음" 주석 + 실제로 `pip install` 스텝 부재).
  - 상세: `git diff origin/main...HEAD --stat`로 이 브랜치(10 커밋) 전체를 대조해도
    `package.json`/`pnpm-lock.yaml` 변경이 없다(review 산출물 JSON만 다수 추가). 유일한
    패키지 관련 변화는 `harness-checks.yml`에 PyYAML 설치 스텝이 추가된 것인데, 신규
    의존이 아니라 `deps-security-checks.yml`이 이미 쓰는 핀의 재사용이다(다음 항목).

- **[INFO]** PyYAML 핀이 세 워크플로 파일(신규 `harness-checks.yml` 1곳 + 기존
  `deps-security-checks.yml` 2곳)에서 정확히 동일(`pyyaml>=6,<7`)하고, 이를 지키는
  회귀 테스트(`PyYamlPinsAgreeTest`)를 이 PR이 함께 포함한다 — 직접 실행해 확인.
  - 위치: `.github/workflows/harness-checks.yml:88`,
    `.github/workflows/deps-security-checks.yml:58,92`,
    `.claude/tests/test_review_gate_ci.py:700-729`(`class PyYamlPinsAgreeTest`).
  - 상세: `python3 -m unittest discover -s .claude/tests -p 'test_review_gate_ci.py' -v`
    실행 결과 17개 테스트 전부 `ok`(`PyYamlPinsAgreeTest.test_every_workflow_pins_the_same_version`
    포함). `grep -n pyyaml .github/workflows/*.yml`로 세 곳 모두 동일한 큰따옴표 문자열
    확인. 라이선스는 PyYAML=MIT로 호환 문제 없음. YAML 파싱 소비자
    (`scripts/check-override-floors.py`, `test_workflow_yaml_structure.py`의 커스텀
    `SafeLoader` 서브클래스, `test_review_gate_ci.py`의 `WorkflowWiringTest`) 전부
    `yaml.safe_load` 또는 `yaml.SafeLoader` 서브클래스만 써서 알려진 `yaml.load()` 임의
    코드 실행 취약점 클래스(CVE-2020-14343 등)를 피한다. 핀은 정확 버전이 아니라 메이저
    범위(`>=6,<7`)지만 기존 관행 재사용이고 이 PR이 새로 만든 리스크가 아니다.

- **[INFO]** GitHub Actions 버전이 저장소 전체(9개 워크플로)와 정확히 일치하도록
  정리됐다 — `harness-checks.yml`의 `node-version`이 이번 라운드에 `'22'`(주석 없는
  이례값)에서 `'24'`로 정정되어 나머지 8개 워크플로와 같아졌다.
  - 위치: `.github/workflows/harness-checks.yml:96-102`(주석 "24, matching every other
    workflow. This one sat on 22 with no recorded reason" + `node-version: '24'`).
  - 상세: `grep -n "node-version" .github/workflows/*.yml`로 9곳 전부 `'24'` 확인.
    `actions/checkout@v7`/`actions/setup-python@v7`/`actions/setup-node@v7`도 저장소
    전체 10개 워크플로와 동일(가변 메이저 태그, SHA 고정 아님 — 기존 관행이며 이 PR이
    새로 만든 문제는 아니고 직전 라운드 리뷰에서 이미 정보성으로 기록됨, 이번 라운드
    diff 범위 밖). 부수로 `harness-checks.yml:77-78`의 "keep the actions major policy
    consistent with the other workflows (v5/v6 line)" 주석은 여전히 stale하다(실제로는
    전부 v7) — 이번 diff가 만든 결함이 아니고(해당 줄은 이번 diff에 없음) 우선순위
    낮은 문서 정리 항목이라 참고만 하고 별도 findings로 올리지 않는다.

## 요약

이번 라운드는 순수 "패키지 의존성" 관점에서 깨끗하다 — 새 외부 패키지가 없고, 재사용한
PyYAML 핀은 3곳 일치가 테스트로 고정돼 있으며(실행 확인), Actions 버전·Node 버전도
저장소 전체와 이번 diff로 완전히 정렬됐다. 직전 라운드(6R) 리뷰가 지적한
`review-gate.yml`의 `_lib` paths 개별 나열 WARNING은 이번 실제 diff(`.claude/hooks/_lib/**`
글롭화)로 검증 가능하게 해소됐다. 다만 같은 라운드가 새로 도입한
`TheGateItselfDoesNotBranchOnCiEnvTest`의 스캔 대상 목록(`_SCANNED`)이 판정자
(`review_guard.evaluate_review()`)가 실제로 호출하는 `_shared/report_paths.py`·
`_shared/block_integrity.py`를 빠뜨리고 있다 — 오늘 살아있는 우회는 아니지만(두 모듈 다
환경을 안 읽음), 이 PR 시리즈 자신이 반복해서 이름 붙여 온 "손으로 나열한 등재 목록이
실제 import/호출 그래프보다 좁다" 결함 클래스가 이번 라운드 신규 방어 코드 안에서 새
인스턴스로 재현된 것이라 WARNING으로 기록한다.

## 위험도

MEDIUM
