# 유지보수성(Maintainability) 코드 리뷰

## 리뷰 대상
1. `.claude/tests/test_dependabot_npm_coverage.py` (신규, 153줄)
2. `.github/workflows/e2e.yml`
3. `.github/workflows/harness-checks.yml`
4. `plan/in-progress/harness-guard-followups.md`

## 발견사항

- **[INFO]** 따옴표-제거 정규식 조각이 두 파서에서 독립적으로 반복
  - 위치: `.claude/tests/test_dependabot_npm_coverage.py:59` (`_workspace_globs`), `:77` (`_dependabot_npm_directories`)
  - 상세: `re.match(r"""^\s*-\s*["']?([^"'#]+?)["']?\s*$""", line)` 와 `re.search(r"""^\s*directory:\s*["']?([^"'#\n]+?)["']?\s*$""", block, re.M)` 가 "선택적 따옴표 벗기기(`["']?...["']?`)" 패턴을 각각 재정의한다. 두 파서가 라인 단위/블록 단위로 문맥이 달라 완전한 중복은 아니지만, YAML 인용 규칙이 바뀌면(예: 백틱·이스케이프 처리) 두 곳을 따로 고쳐야 한다.
  - 제안: 우선순위는 낮음. 굳이 추출한다면 `_unquote(s: str) -> str` 헬퍼로 "따옴표 벗기기" 후처리만 공유하고, 라인/블록 매칭 정규식 자체는 그대로 두는 편이 두 파서의 문맥 차이를 유지하면서 중복을 줄인다.

- **[INFO]** 손수 짠 두 YAML 미니 파서의 포맷 취약성
  - 위치: `_workspace_globs` (line 50-65), `_dependabot_npm_directories` (line 68-80)
  - 상세: `pnpm-workspace.yaml`/`dependabot.yml` 이 흐름형 리스트(`packages: [a, b]`)나 멀티라인 스칼라·앵커/별칭으로 바뀌면 두 정규식 파서가 조용히 빈 결과를 낼 수 있다. 다만 이는 파일 docstring(`.claude/tests/README.md` stdlib-only 제약)에서 의도적으로 받아들인 트레이드오프이고, `ParserSanityTest` 3건이 "빈 결과 → 항진명제 통과" 를 명시적으로 차단하고 있어 실질 리스크는 낮게 완화되어 있다.
  - 제안: 현행 방어(sanity test)로 충분. 추가 조치 불필요, 참고용 기록.

- **[INFO]** paths-ignore/paths 리스트가 `push`/`pull_request` 트리거 간 중복 유지
  - 위치: `.github/workflows/e2e.yml` line 19-25 vs 27-33 (`.github/**` 항목이 양쪽에 각각 추가됨)
  - 상세: GitHub Actions 문법상 `push:`/`pull_request:` 트리거는 각각 별도의 `paths-ignore` 목록을 가져야 하므로 이번 diff 가 항목 하나(`.github/**`)를 추가하며 기존에 있던 중복이 한 줄 더 늘었다. 구조적 한계(문법 제약)이며 이 PR 이 만든 문제가 아니다.
  - 제안: 개선 여지 낮음(GitHub Actions 자체 한계). 정보성 기록만.

## 요약

이번 변경은 신규 하네스 가드 테스트(`test_dependabot_npm_coverage.py`) 와 그에 종속된 CI 워크플로 설정(`e2e.yml`, `harness-checks.yml`) 조정, 그리고 plan 체크리스트 갱신으로 구성된다. 신규 테스트 파일은 모듈·함수·클래스 docstring 이 "왜 이 불변식이 필요한가"를 구체적 사건(undici HIGH 미탐지 이력)까지 인용해 상세히 설명하고, 함수는 모두 짧고 단일 책임이며 중첩 깊이도 최대 3단계로 과하지 않다. 매직 넘버는 없고 반복 사용되는 문자열(`package.json`)은 상수로 추출돼 있으며, 실패 assertion 메시지마다 원인과 조치법이 상세히 기술돼 있어 가독성·유지보수성이 전반적으로 우수하다. 발견된 이슈는 두 정규식 기반 미니 파서 간의 경미한 패턴 중복과 그로 인한 잠재적 포맷 취약성뿐이며, 이는 ParserSanityTest 로 이미 완화되어 있어 실질적 위험은 낮다. 워크플로 YAML 변경은 GitHub Actions 문법 제약에 따른 불가피한 목록 중복 외에 특별한 문제가 없다.

## 위험도
LOW
