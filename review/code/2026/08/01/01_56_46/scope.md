# 변경 범위(Scope) 리뷰 — deps-guard-hardening

## 발견사항

- **[CRITICAL]** `harness-checks.yml`에 삽입된 "Install PyYAML" 스텝이 순수 추가(additive) 의도를 벗어나 인접한 기존 스텝의 YAML 매핑을 구조적으로 손상시켰다 — 의도한 변경 범위(스텝 1개 삽입)가 실제로는 기존 스텝 본문까지 침범했다.
  - 위치: `.github/workflows/harness-checks.yml:69-76`
  - 상세: 커밋 메시지(`3ff26348c`: "harness-checks unittest 잡에 PyYAML 설치")와 `plan/in-progress/deps-guard-hardening.md:118`("unittest 잡 PyYAML" — "8건 전부 반영"으로 완료 표시)는 이 변경을 "스텝 하나 추가"로 서술한다. 그러나 실제 diff는 기존 `- name: Run harness unit tests`(69행) 스텝의 `name:` 줄과 원래 그 아래 있던 `run: python3 -m unittest discover ...` 줄(76행) **사이**에 주석 4줄 + `- name: Install PyYAML` / `run: pip install "pyyaml>=6,<7"`(74-75행)를 끼워 넣었다. `Read`로 현재 워크트리 파일을 직접 열고 `yaml.safe_load()`로도 확인한 결과, 실제 파싱 구조는 다음과 같다.
    ```
    {'name': 'Run harness unit tests'}                       # run/uses 둘 다 없음 — 스키마 위반
    {'name': 'Install PyYAML',
     'run': "python3 -m unittest discover -s .claude/tests -p 'test_*.py'"}  # run 키 중복, 뒤엣것만 생존
    ```
    즉 75행과 76행이 같은 매핑(`Install PyYAML` 스텝)의 중복 `run:` 키가 되어 `pip install "pyyaml>=6,<7"`이 통째로 사라지고, "Run harness unit tests" 스텝은 `run`/`uses` 둘 다 없는 빈 스텝으로 남는다. GitHub Actions 스키마는 각 스텝에 `run` 또는 `uses`를 요구하므로 워크플로 파일 자체가 파싱 단계에서 거부될 위험이 있고, 최소한 "PyYAML을 설치해 `test_override_floors.py`의 `import yaml`을 성공시킨다"는 이 스텝의 존재 목적은 달성되지 않는다. 이 결함은 커밋 `3ff26348c` 이후 `969f7ac0d`까지 그대로 남아 있다(해당 커밋은 이 파일을 건드리지 않음). `harness-checks.yml`의 `paths:`가 `.claude/**`·`scripts/*`·`PROJECT.md` 등 광범위한 경로를 커버하므로, 병합되면 관련 경로를 건드리는 이후 모든 PR에서 이 job이 계속 깨진다. (같은 세션의 side-effect 리뷰 `review/code/2026/08/01/01_56_46/side_effect.md`도 동일 결함을 독립적으로 확인 — 교차 검증됨.)
  - 제안: 74-75행(`Install PyYAML` 스텝)을 69행 스텝 **앞**에 독립된 스텝으로 배치하고, 76행의 `run: python3 -m unittest discover ...`는 69행 "Run harness unit tests" 스텝 자신의 `run:` 값으로 되돌릴 것. 수정 후 `python3 -c "import yaml; print(yaml.safe_load(open('.github/workflows/harness-checks.yml'))['jobs']['unittest']['steps'])"`로 스텝 3개(PyYAML 설치 1개 + 기존 unittest 1개 + 그 외)가 의도대로 파싱되는지 확인.

- **[WARNING]** 커밋 `3ff26348c`의 메시지가 선언한 변경 범위와 실제 diff 내용이 불일치한다 — 보안 관련 실질 수정 2건이 메시지에 언급되지 않은 채 같은 커밋에 묶였다.
  - 위치: 커밋 `3ff26348c` 메시지 vs `scripts/check-override-floors.py`의 `EXPECTED_SUPPRESSED_PATHS`(신규 dict) · `classify_vulnerable()`(신규 함수) · `run_audit()`(재작성).
  - 상세: 해당 커밋 메시지는 "Critical: CI 등재 3건" + "Warning: override_target() 마지막 `>` · PyYAML 설치"만 나열한다. 그러나 `git diff 6b55b0f48 3ff26348c -- scripts/check-override-floors.py`로 직접 대조한 결과, 같은 커밋에 (a) `ignoreCves` 전역 억제로 인한 탐지 사각(`brace-expansion` 사례) 을 막는 `EXPECTED_SUPPRESSED_PATHS`/`classify_vulnerable`/경로-baseline 로직 전체(~60줄, 이전 리뷰 라운드 `01_12_24`의 dependency reviewer CRITICAL #1 대응)와 (b) `run_audit()`을 "빈 stdout → 취약점 0건"(fail-open)에서 "판단 불가 → exit 2"(fail-closed)로 재작성(같은 라운드 security reviewer WARNING #1 대응)한 실질 코드가 함께 들어 있는데, 둘 다 메시지에 없다. 두 수정 자체는 정당하고 필요한 수정이라 "허가받지 않은 확장"은 아니지만, 커밋 메시지만 보고는 이 커밋이 보안 탐지 로직을 실질적으로 바꿨다는 사실을 알 수 없어 추적성이 깨진다.
  - 제안: 향후 유사 상황에서는 커밋 메시지에 "ignoreCves 억제 사각 수정(axis 3 baseline 신설)"·"run_audit() fail-closed 전환"을 명시하거나, 성격이 다른 두 축(CI 배선 대 탐지 로직 강화)을 별도 커밋으로 분리할 것. plan 체크리스트(`plan/in-progress/deps-guard-hardening.md:115-118`)는 이미 이 두 항목을 사후에 정확히 기록해 두었으므로 최소 조치는 이미 돼 있다.

- **[INFO]** `test_override_floors.py` 모듈 docstring의 축 개수 서술이 실제 내용과 어긋난다 — 반복된 확장(축 4 추가) 흔적.
  - 위치: `.claude/tests/test_override_floors.py:7`("여기서 고정하는 것은 세 축이다") vs 같은 docstring 25행의 "4. **fail-closed**" 항목.
  - 상세: 커밋 `969f7ac0d`가 축 4(fail-closed, `FailClosedTest`)를 추가하면서 번호 목록(1~4)은 갱신했지만 도입부의 "세 축"이라는 요약 문장은 그대로 남았다. 기능·테스트 자체에는 영향 없는 문서 정확성 문제.
  - 제안: "세 축" → "네 축"으로 정정.

- **[INFO]** (범위 정합 — 문제 아님) `review/code/2026/08/01/01_12_24/*` 6개 파일이 이번 diff(커밋 `3ff26348c`)에 포함돼 있는데, 이는 프로젝트 컨벤션상 예상된 상태다.
  - 위치: `review/code/2026/08/01/01_12_24/{SUMMARY,dependency,security,testing}.md`, `meta.json`, `_retry_state.json`.
  - 상세: `review/` 는 gitignore 대상이 아니며, 구현 완료 후 `/ai-review` + Critical/Warning fix 는 이 프로젝트의 상시 승인된 강제 워크플로다(`CLAUDE.md` "구현 완료 후 자동 review/fix"). 이 6개 파일은 정확히 그 1차 리뷰(`01_12_24`)의 산출물이며, `3ff26348c`가 그 리뷰의 Critical 4건/Warning 4건을 조치한 근거로 함께 커밋됐다 — 무관한 파일 혼입이 아니라 리뷰 워크플로의 정상 부산물.

- **[INFO]** (긍정 관측) `pnpm-workspace.yaml` diff는 주석 확장뿐이며 `overrides`/`ignoreCves`의 실제 값은 이번 PR에서 손대지 않았다.
  - 위치: `pnpm-workspace.yaml:69-85`(신규 주석 블록) vs `overrides:`(25-54행)/`ignoreCves:`(86-113행, 값 불변).
  - 상세: §2("`ignoreCves` 근거 규약 명문화")가 요구한 것은 문서화이지 값 변경이 아니었고, diff도 정확히 그 경계 안에 머문다 — 규약 범위를 벗어난 부수적 override 조정 없음.

## 요약

파일 단위로 보면 이번 변경(15개 파일, `.claude/tests/README.md`·`test_dependabot_npm_coverage.py`·신규 `test_override_floors.py`·`dependabot.yml`·`deps-security-checks.yml`·`harness-checks.yml`·plan 문서·`pnpm-workspace.yaml`(주석뿐)·신규 `check-override-floors.py`·1차 리뷰 산출물 6건)는 plan이 선언한 §1(침식 검출)·§2(수용 근거 규약)·§3(dependabot 등록)과 그에 종속된 CI/문서 배선에 정확히 매핑되며, 무관한 파일·드라이브바이 리팩토링·불필요한 포맷팅·의미 없는 주석/임포트 정리는 발견되지 않았다. `scripts/check-override-floors.py`가 초기 설계(추출+분류 2축)에서 최종 4축(+ignoreCves baseline, +fail-closed)으로 커진 것도 실측·리뷰로 정당화된 반응적 수정이라 over-engineering으로 보지 않는다. 다만 실제 구조 결함이 하나 있다 — "PyYAML 설치 스텝 추가"라는 순수 추가 의도의 편집이 `harness-checks.yml`에서 기존 스텝의 본문을 파고들어 그 스텝을 무의미하게 만들고 신규 스텝의 `run:`도 중복 키로 소실시켰다(CRITICAL, side-effect 리뷰와 교차 확인). 이는 plan 체크리스트가 "완료"로 표시한 항목이 실제로는 깨져 있다는 뜻이라 병합 전 반드시 고쳐야 한다. 그 외 커밋 `3ff26348c`의 메시지가 실제로 포함한 두 건의 실질 보안 로직 수정(ignoreCves 사각 대응, fail-closed 전환)을 언급하지 않은 점은 결과물 자체는 정당하지만 범위 추적성 관점에서 WARNING으로 남긴다.

## 위험도

CRITICAL
